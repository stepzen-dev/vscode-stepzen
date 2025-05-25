/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import { readFileSync, existsSync } from "fs";
import * as path from "path";
import {
  parse,
  visit,
  Kind,
  DocumentNode,
  DefinitionNode,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  FieldDefinitionNode,
  OperationDefinitionNode,
  FragmentDefinitionNode,
  ListValueNode,
  ObjectValueNode,
  StringValueNode,
  BooleanValueNode,
  ArgumentNode
} from "graphql";
import { Uri } from 'vscode';
import { logger } from '../logger';
import { GRAPHQL, GraphQLOperationType } from '../../utils/constants';
import { StepZenError, handleError } from "../../errors";
import { unwrapType, getFullType, isListType, isScalarType } from './parser';

/** Location of a symbol inside a file (0‑based). */
interface Location {
  filePath: string;
  line: number;
  character: number;
}

/** Container‑aware location (null container ⇒ type‑level symbol). */
export interface SymbolLocation extends Location {
  container: string | null;
}

export interface ArgInfo {
  name: string;
  type: string;
}

export interface RootOperationInfo {
  returnType: string;
  isList: boolean;
  args: ArgInfo[];
  location: { 
    uri: string; 
    range: { 
      start: { line: number; column: number; }; 
      end: { line: number; column: number; };
    } | null 
  };
}

export interface OperationEntry {
  name: string;
  type: 'query' | 'mutation' | 'subscription' | 'fragment';
  fileUri: Uri;
  range: { start: number; end: number };
  persisted: boolean;
}

export interface PersistedDocEntry {
  documentId: string;
  fileUri: Uri;
  operations: OperationEntry[];
}

export interface DirectiveInfo {
  name: string;
  args: { name: string; value: string | null }[];
}

export interface FieldInfo {
  name: string;
  type: string;
  isList: boolean;
  args: ArgInfo[];
  directives: DirectiveInfo[];
  location: { uri: string; line: number; character: number };
}

export interface TypeRelationship {
  fromType: string;
  toType: string;
  fieldName: string;
  isList: boolean;
}

/**
 * Builds indexes from GraphQL schema files
 */
export class SchemaIndexer {
  private definitionIndex: Map<string, SymbolLocation[]> = new Map();
  private rootOperations: Record<string, RootOperationInfo> = {};
  private fieldIndex: Record<string, FieldInfo[]> = {};
  private typeDirectives: Record<string, DirectiveInfo[]> = {};
  private typeRelationships: TypeRelationship[] = [];
  private operationMap: Record<string, OperationEntry[]> = {};
  private persistedDocMap: Record<string, PersistedDocEntry> = {};

  private readonly ROOT_TYPES = new Set(GRAPHQL.ROOT_OPERATION_TYPES);

  /**
   * Clears all indexes and maps
   */
  clear(): void {
    this.definitionIndex.clear();
    this.rootOperations = {};
    this.fieldIndex = {};
    this.typeDirectives = {};
    this.typeRelationships = [];
    this.operationMap = {};
    this.persistedDocMap = {};
  }

  /**
   * Indexes definitions from a GraphQL document
   * @param document The parsed GraphQL document
   * @param filePath The file path for location tracking
   */
  indexDocument(document: DocumentNode, filePath: string): void {
    for (const def of document.definitions) {
      this.indexDefinition(def, filePath);
    }
  }

  /**
   * Scans @sdl(executables: [...]) to populate operationMap & persistedDocMap
   * @param schemaSDL The schema SDL content to scan
   * @param workspaceRoot The workspace root path for resolving relative paths
   */
  scanSDLExecutables(schemaSDL: string, workspaceRoot: string): void {
    // Validate inputs
    if (!schemaSDL || typeof schemaSDL !== 'string') {
      logger.error('Invalid schema SDL provided to scanSDLExecutables');
      return;
    }
    
    if (!workspaceRoot || typeof workspaceRoot !== 'string') {
      logger.error('Invalid workspace root provided to scanSDLExecutables');
      return;
    }
    
    let ast;
    try {
      ast = parse(schemaSDL);
    } catch (err) {
      const error = new StepZenError(
        "Error parsing schema SDL",
        "SCHEMA_PARSE_ERROR",
        err
      );
      handleError(error);
      return;
    }
    
    const sdlDefs = ast.definitions.filter(def =>
      (def as DefinitionNode & { directives?: readonly { name: { value: string } }[] })
        .directives?.some(d => d.name.value === 'sdl')
    );
    
    sdlDefs.forEach((def: DefinitionNode & { directives?: readonly { name: { value: string }; arguments?: readonly any[] }[] }) => {
      this.processSdlDefinition(def, workspaceRoot);
    });
  }

  /**
   * Computes a SHA256 hash of the input string.
   * Used for generating stable document IDs.
   * @param input The string to hash
   * @returns Hex string of the SHA256 hash
   */
  computeHash(input: string): string {
    // Add validation
    if (!input || typeof input !== 'string') {
      logger.warn('Invalid input provided to computeHash');
      return '';
    }
    
    const { createHash } = require('crypto');
    return createHash('sha256').update(input).digest('hex');
  }

  // Getters
  getDefinitionIndex(): Map<string, SymbolLocation[]> {
    return this.definitionIndex;
  }

  getRootOperations(): Record<string, RootOperationInfo> {
    return this.rootOperations;
  }

  getFieldIndex(): Record<string, FieldInfo[]> {
    return this.fieldIndex;
  }

  getTypeDirectives(): Record<string, DirectiveInfo[]> {
    return this.typeDirectives;
  }

  getTypeRelationships(): TypeRelationship[] {
    return this.typeRelationships;
  }

  getOperationMap(): Record<string, OperationEntry[]> {
    return this.operationMap;
  }

  getPersistedDocMap(): Record<string, PersistedDocEntry> {
    return this.persistedDocMap;
  }

  /**
   * Finds all definitions of a symbol in the project.
   * @param name The symbol name to find
   * @returns Array of locations or undefined if not found
   */
  findDefinition(name: string): SymbolLocation[] | undefined {
    if (!name || typeof name !== 'string') {
      logger.error(`Invalid symbol name provided: ${String(name)}`);
      return undefined;
    }
    
    logger.debug(`Searching for "${name}"...`);
    return this.definitionIndex.get(name);
  }

  private addLocation(key: string, loc: SymbolLocation): void {
    const arr = this.definitionIndex.get(key);
    if (arr) {
      if (!arr.some(l => l.filePath === loc.filePath && l.line === loc.line && l.character === loc.character)) {
        arr.push(loc);
      }
    } else {
      this.definitionIndex.set(key, [loc]);
    }
  }

  private isRootObject(def: DefinitionNode): def is ObjectTypeDefinitionNode | ObjectTypeExtensionNode {
    const isObjectType = def.kind === Kind.OBJECT_TYPE_DEFINITION || def.kind === Kind.OBJECT_TYPE_EXTENSION;
    if (!isObjectType) {
      return false;
    }
    
    const typeName = (def as ObjectTypeDefinitionNode | ObjectTypeExtensionNode).name.value;
    const isRoot = this.ROOT_TYPES.has(typeName as GraphQLOperationType);
    
    if (isRoot) {
      logger.info(`Found root type: ${typeName}`);
    }
    
    return isObjectType && isRoot;
  }

  private indexDefinition(def: DefinitionNode, filePath: string): void {
    // type‑level symbols
    if ([
      Kind.OBJECT_TYPE_DEFINITION,
      Kind.INPUT_OBJECT_TYPE_DEFINITION,
      Kind.INTERFACE_TYPE_DEFINITION,
      Kind.ENUM_TYPE_DEFINITION,
      Kind.UNION_TYPE_DEFINITION,
      Kind.SCALAR_TYPE_DEFINITION
    ].includes(def.kind)) {
      if (def.loc) {
        this.addLocation((def as { name: { value: string } }).name.value, {
          container: null,
          filePath,
          line: def.loc.startToken.line - 1,
          character: def.loc.startToken.column - 1,
        });
      }
    }

    // root‑level fields
    if (this.isRootObject(def) && (def as ObjectTypeDefinitionNode | ObjectTypeExtensionNode).fields) {
      const parentName = (def as ObjectTypeDefinitionNode | ObjectTypeExtensionNode).name.value;
      for (const field of (def as ObjectTypeDefinitionNode | ObjectTypeExtensionNode).fields as FieldDefinitionNode[]) {
        if (!field.loc) {
          continue;
        }
        this.addLocation(field.name.value, {
          container: parentName,
          filePath,
          line: field.loc.startToken.line - 1,
          character: field.loc.startToken.column - 1,
        });
      }
    }

    // gather root operation info
    if (this.isRootObject(def) && (def as ObjectTypeDefinitionNode | ObjectTypeExtensionNode).fields) {
      const parentTypeName = (def as ObjectTypeDefinitionNode | ObjectTypeExtensionNode).name.value;
      logger.info(`Processing fields for root type: ${parentTypeName}`);
      
      for (const field of (def as ObjectTypeDefinitionNode | ObjectTypeExtensionNode).fields as FieldDefinitionNode[]) {
        const fieldName = field.name.value;
        const returnType = unwrapType(field.type);
        const isList = isListType(field.type);
        const args = field.arguments?.map(arg => ({
          name: arg.name.value,
          type: getFullType(arg.type)
        })) || [];
        
        logger.info(`Found root operation field: ${parentTypeName}.${fieldName} (returns: ${returnType})`);
        
        this.rootOperations[fieldName] = {
          returnType,
          isList,
          args,
          location: { 
            uri: filePath, 
            range: field.name.loc ? {
              start: { line: field.name.loc.startToken.line, column: field.name.loc.startToken.column },
              end: { line: field.name.loc.endToken.line, column: field.name.loc.endToken.column }
            } : null
          }
        };
      }
    }

    // For ALL object types (not just root types)
    if ((def.kind === Kind.OBJECT_TYPE_DEFINITION || def.kind === Kind.OBJECT_TYPE_EXTENSION) && 
        (def as ObjectTypeDefinitionNode | ObjectTypeExtensionNode).fields) {
      const typeName = (def as ObjectTypeDefinitionNode | ObjectTypeExtensionNode).name.value;
      
      // Store type directives if present
      if (def.kind === Kind.OBJECT_TYPE_DEFINITION && (def as ObjectTypeDefinitionNode).directives?.length) {
        this.typeDirectives[typeName] = (def as ObjectTypeDefinitionNode).directives?.map(d => ({
          name: d.name.value,
          args: d.arguments?.map(arg => ({
            name: arg.name.value,
            value: arg.value.kind === Kind.STRING ? (arg.value as StringValueNode).value : null
          })) || []
        })) || [];
      }
      
      // Store all fields
      for (const field of (def as ObjectTypeDefinitionNode | ObjectTypeExtensionNode).fields as FieldDefinitionNode[]) {
        if (!field.loc) {
          continue;
        }
        
        // Record field type information for visualization
        const returnType = unwrapType(field.type);
        const isList = isListType(field.type);
        const args = field.arguments?.map(arg => ({
          name: arg.name.value,
          type: getFullType(arg.type)
        })) || [];
        
        if (!this.fieldIndex[typeName]) {
          this.fieldIndex[typeName] = [];
        }
        
        this.fieldIndex[typeName].push({
          name: field.name.value,
          type: returnType,
          isList,
          args,
          directives: field.directives?.map(d => ({
            name: d.name.value,
            args: d.arguments?.map(arg => ({
              name: arg.name.value,
              value: arg.value.kind === Kind.STRING ? (arg.value as StringValueNode).value : null
            })) || []
          })) || [],
          location: { 
            uri: filePath, 
            line: field.loc.startToken.line - 1, 
            character: field.loc.startToken.column - 1 
          }
        });
        
        // Store relationships between types (if returnType is a custom type, not scalar)
        if (!isScalarType(returnType)) {
          this.typeRelationships.push({
            fromType: typeName,
            toType: returnType,
            fieldName: field.name.value,
            isList
          });
        }
      }
    }
  }

  private processSdlDefinition(def: DefinitionNode & { directives?: readonly { name: { value: string }; arguments?: readonly any[] }[] }, workspaceRoot: string): void {
    if (!def.directives || !Array.isArray(def.directives)) {
      return;
    }
    
    const sdlDir = def.directives.find(d => d?.name?.value === 'sdl');
    if (!sdlDir || !sdlDir.arguments || !Array.isArray(sdlDir.arguments)) {
      return;
    }
    
    const execArg = sdlDir.arguments.find((a: ArgumentNode) => a?.name?.value === 'executables');
    if (!execArg || execArg.value?.kind !== Kind.LIST) {
      return;
    }
    const values = (execArg.value as ListValueNode).values;
    if (!values || !Array.isArray(values)) {
      return;
    }
    
    values.forEach(v => {
      if (!v || v.kind !== Kind.OBJECT) {
        return;
      }
      let documentPath = '';
      let persist = false;
      
      const fields = (v as ObjectValueNode).fields;
      if (!fields || !Array.isArray(fields)) {
        return;
      }
      
      fields.forEach(field => {
        if (!field.name || !field.value) {
          return;
        }
        
        if (field.name.value === 'document' && field.value.kind === Kind.STRING) {
          documentPath = (field.value as StringValueNode).value;
        }
        if (field.name.value === 'persist' && field.value.kind === Kind.BOOLEAN) {
          persist = (field.value as BooleanValueNode).value;
        }
      });
      
      if (!documentPath) {
        return;
      }
      
      logger.debug(`Found executable: ${documentPath} (persist: ${persist})`);
      
      let abs;
      try {
        abs = path.isAbsolute(documentPath)
          ? documentPath
          : path.join(workspaceRoot, documentPath);
      } catch (err) {
        const error = new StepZenError(
          `Error resolving path for ${documentPath}`,
          "PATH_RESOLUTION_ERROR",
          err
        );
        handleError(error);
        return;
      }
      
      if (!abs || !existsSync(abs)) {
        logger.warn(`File does not exist: ${abs}`);
        return;
      }
      const fileUri = Uri.file(abs);
      
      let contents;
      try {
        contents = readFileSync(abs, 'utf8');
        if (!contents) {
          logger.warn(`Empty file: ${abs}`);
          return;
        }
      } catch (err) {
        const error = new StepZenError(
          `Error reading file ${abs}`,
          "FILE_READ_ERROR",
          err
        );
        handleError(error);
        return;
      }
      
      let docAST;
      try {
        docAST = parse(contents);
      } catch (err) {
        const error = new StepZenError(
          `Error parsing GraphQL in ${abs}`,
          "GRAPHQL_PARSE_ERROR",
          err
        );
        handleError(error);
        return;
      }
      
      const ops: OperationEntry[] = [];
      visit(docAST, {
        OperationDefinition(node: OperationDefinitionNode) {
          if (!node || !node.loc) {
            return;
          }
          ops.push({
            name: node.name?.value || '<anonymous>',
            type: node.operation,
            fileUri,
            range: { start: node.loc.start, end: node.loc.end },
            persisted: persist
          });
        },
        FragmentDefinition(node: FragmentDefinitionNode) {
          if (!node.loc) {
            return;
          }
          ops.push({
            name: node.name.value,
            type: 'fragment',
            fileUri,
            range: { start: node.loc.start, end: node.loc.end },
            persisted: persist
          });
        }
      });
      
      this.operationMap[fileUri.toString()] = ops;
      if (persist && ops && ops.length) {
        const documentId = `sha256:${this.computeHash(contents)}`;
        if (documentId) {
          this.persistedDocMap[documentId] = { documentId, fileUri, operations: ops };
        }
      }
    });
  }
} 