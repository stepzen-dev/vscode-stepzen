import { readFileSync, existsSync } from "fs";
import * as path from "path";
import { logger } from './logger';
import { LogLevel, GRAPHQL } from './constants';
import {
  parse,
  visit,
  Kind,
  DocumentNode,
  DefinitionNode,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  FieldDefinitionNode,
  TypeNode,
  OperationDefinitionNode,
  FragmentDefinitionNode,
  ListValueNode,
  ObjectValueNode,
  StringValueNode,
  BooleanValueNode
} from "graphql";
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { stepzenOutput } from "./logger";
import { createError, formatError } from "./errors";

/** Location of a symbol inside a file (0‑based). */
interface Location {
  filePath: string;
  line: number;
  character: number;
}

/** Container‑aware location (null container ⇒ type‑level symbol). */
interface SymbolLocation extends Location {
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

// Global maps
const rootOperations: Record<string, RootOperationInfo> = {};
let definitionIndex: Map<string, SymbolLocation[]> = new Map();
const visited = new Set<string>();
const schemaFiles: string[] = [];
const operationMap: Record<string, OperationEntry[]> = {};
const persistedDocMap: Record<string, PersistedDocEntry> = {};
const fieldIndex: Record<string, FieldInfo[]> = {}; // Parent type -> fields
const typeDirectives: Record<string, DirectiveInfo[]> = {}; // Type -> directives
const typeRelationships: TypeRelationship[] = []; // Relationships between types

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
 * Clears the definition index and resets all data structures.
 * Used when rescanning a project to avoid stale data.
 */
export function clearDefinitionIndex() {
  definitionIndex = new Map();
  visited.clear();
  schemaFiles.length = 0;
  
  // Clear the new maps as well
  Object.keys(fieldIndex).forEach(key => delete fieldIndex[key]);
  Object.keys(typeDirectives).forEach(key => delete typeDirectives[key]);
  typeRelationships.length = 0;
}

/**
 * Finds all definitions of a symbol in the project.
 * @param name The symbol name to find
 * @returns Array of locations or undefined if not found
 */
export function findDefinition(name: string): SymbolLocation[] | undefined {
  if (!name || typeof name !== 'string') {
    logger.error(`Invalid symbol name provided: ${String(name)}`);
    return undefined;
  }
  
  logger.debug(`Searching for "${name}"...`);
  return definitionIndex.get(name);
}

/**
 * Dumps the entire definition index for debugging purposes.
 * @returns JSON string representation of the definition index
 */
export function dumpDefinitionIndex(): string {
  const obj: Record<string, SymbolLocation[]> = {};
  for (const [k, v] of definitionIndex.entries()) obj[k] = v;
  return JSON.stringify(obj, null, 2);
}

/* ───────────────────────── helpers ───────────────────────── */
const ROOT_TYPES = new Set(GRAPHQL.ROOT_OPERATION_TYPES);

function addLocation(key: string, loc: SymbolLocation) {
  const arr = definitionIndex.get(key);
  if (arr) {
    if (!arr.some(l => l.filePath === loc.filePath && l.line === loc.line && l.character === loc.character)) {
      arr.push(loc);
    }
  } else {
    definitionIndex.set(key, [loc]);
  }
}

function isRootObject(def: DefinitionNode): def is ObjectTypeDefinitionNode | ObjectTypeExtensionNode {
  const isObjectType = def.kind === Kind.OBJECT_TYPE_DEFINITION || def.kind === Kind.OBJECT_TYPE_EXTENSION;
  if (!isObjectType) return false;
  
  const typeName = (def as ObjectTypeDefinitionNode | ObjectTypeExtensionNode).name.value;
  const isRoot = ROOT_TYPES.has(typeName);
  
  if (isRoot) {
    logger.info(`Found root type: ${typeName}`);
  }
  
  return isObjectType && isRoot;
}

function indexDefinitions(document: DocumentNode, filePath: string) {
  for (const def of document.definitions) {
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
        addLocation((def as { name: { value: string } }).name.value, {
          container: null,
          filePath,
          line: def.loc.startToken.line - 1,
          character: def.loc.startToken.column - 1,
        });
      }
    }
    // root‑level fields
    if (isRootObject(def) && (def as ObjectTypeDefinitionNode | ObjectTypeExtensionNode).fields) {
      const parentName = (def as ObjectTypeDefinitionNode | ObjectTypeExtensionNode).name.value;
      for (const field of (def as ObjectTypeDefinitionNode | ObjectTypeExtensionNode).fields as FieldDefinitionNode[]) {
        if (!field.loc) continue;
        addLocation(field.name.value, {
          container: parentName,
          filePath,
          line: field.loc.startToken.line - 1,
          character: field.loc.startToken.column - 1,
        });
      }
    }
    // gather root operation info
    if (isRootObject(def) && (def as ObjectTypeDefinitionNode | ObjectTypeExtensionNode).fields) {
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
        
        rootOperations[fieldName] = {
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
        typeDirectives[typeName] = (def as ObjectTypeDefinitionNode).directives?.map(d => ({
          name: d.name.value,
          args: d.arguments?.map(arg => ({
            name: arg.name.value,
            value: arg.value.kind === Kind.STRING ? (arg.value as StringValueNode).value : null
          })) || []
        })) || [];
      }
      
      // Store all fields
      for (const field of (def as ObjectTypeDefinitionNode | ObjectTypeExtensionNode).fields as FieldDefinitionNode[]) {
        if (!field.loc) continue;
        
        // Record field type information for visualization
        const returnType = unwrapType(field.type);
        const isList = isListType(field.type);
        const args = field.arguments?.map(arg => ({
          name: arg.name.value,
          type: getFullType(arg.type)
        })) || [];
        
        if (!fieldIndex[typeName]) {
          fieldIndex[typeName] = [];
        }
        
        fieldIndex[typeName].push({
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
          typeRelationships.push({
            fromType: typeName,
            toType: returnType,
            fieldName: field.name.value,
            isList
          });
        }
      }
    }
  }
}

/**
 * Scans @sdl(executables: [...]) to populate operationMap & persistedDocMap
 * @param schemaSDL The schema SDL content to scan
 * @param workspaceRoot The workspace root path for resolving relative paths
 */
function scanSDLExecutables(schemaSDL: string, workspaceRoot: string) {
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
    const error = createError(
      "Error parsing schema SDL",
      "Scan SDL Executables",
      err,
      "parse"
    );
    logger.error(formatError(error), error);
    return;
  }
  
  const sdlDefs = ast.definitions.filter(def =>
    (def as DefinitionNode & { directives?: readonly { name: { value: string } }[] })
      .directives?.some(d => d.name.value === 'sdl')
  );
  sdlDefs.forEach((def: DefinitionNode & { directives?: readonly { name: { value: string }; arguments?: readonly any[] }[] }) => {
    if (!def.directives || !Array.isArray(def.directives)) {
      return;
    }
    
    const sdlDir = def.directives.find(d => d?.name?.value === 'sdl');
    if (!sdlDir || !sdlDir.arguments || !Array.isArray(sdlDir.arguments)) {
      return;
    }
    
    const execArg = sdlDir.arguments.find(a => a?.name?.value === 'executables');
    if (!execArg || execArg.value?.kind !== Kind.LIST) return;
    const values = (execArg.value as ListValueNode).values;
    if (!values || !Array.isArray(values)) {
      return;
    }
    
    values.forEach(v => {
      if (!v || v.kind !== Kind.OBJECT) return;
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
      // log
      logger.debug(`Found executable: ${documentPath} (persist: ${persist})`);
      
      let abs;
      try {
        abs = path.isAbsolute(documentPath)
          ? documentPath
          : path.join(workspaceRoot, documentPath);
      } catch (err) {
        const error = createError(
          `Error resolving path for ${documentPath}`,
          "Scan SDL Executables",
          err,
          "filesystem"
        );
        logger.error(formatError(error), error);
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
        const error = createError(
          `Error reading file ${abs}`,
          "Scan SDL Executables",
          err,
          "filesystem"
        );
        logger.error(formatError(error), error);
        return;
      }
      
      let docAST;
      try {
        docAST = parse(contents);
      } catch (err) {
        const error = createError(
          `Error parsing GraphQL in ${abs}`,
          "Scan SDL Executables",
          err,
          "parse"
        );
        logger.error(formatError(error), error);
        return;
      }
      const ops: OperationEntry[] = [];
      visit(docAST, {
        OperationDefinition(node: OperationDefinitionNode) {
          if (!node.loc) return;
          ops.push({
            name: node.name?.value || '<anonymous>',
            type: node.operation,
            fileUri,
            range: { start: node.loc.start, end: node.loc.end },
            persisted: persist
          });
        },
        FragmentDefinition(node: FragmentDefinitionNode) {
          if (!node.loc) return;
          ops.push({
            name: node.name.value,
            type: 'fragment',
            fileUri,
            range: { start: node.loc.start, end: node.loc.end },
            persisted: persist
          });
        }
      });
      operationMap[fileUri.toString()] = ops;
      if (persist && ops && ops.length) {
        const documentId = `sha256:${computeHash(contents)}`;
        if (documentId) {
          persistedDocMap[documentId] = { documentId, fileUri, operations: ops };
        }
      }
    });
  });
}

/**
 * Project scan: gather definitions and build schema & operations maps
 */
/**
 * Scans a StepZen project starting from an entry file.
 * Traverses all linked schema files, builds definitions index,
 * and populates operation and type information.
 * 
 * @param entryFile The path to the main entry file (typically index.graphql)
 * @returns Promise that resolves when scanning completes
 */
export async function scanStepZenProject(entryFile: string): Promise<void> {
  // Add validation
  if (!entryFile || typeof entryFile !== 'string') {
    logger.error('Invalid entry file path provided');
    return;
  }
  
  logger.info(`Scanning project starting at ${entryFile}`);
  logger.info(`ROOT_TYPES: ${Array.from(ROOT_TYPES).join(', ')}`);
  
  if (!existsSync(entryFile)) {
    logger.error(`File not found: ${entryFile}`);
    return;
  }
  

  // Show progress notification to the user
  vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "StepZen: Scanning schema...",
    cancellable: false
  }, async (progress) => {
    const queue: string[] = [entryFile];
    let filesProcessed = 0;
    
    clearDefinitionIndex();
    progress.report({ message: "Starting scan...", increment: 0 });
    
    while (queue.length) {
      const file = queue.pop()!;
      logger.debug(`Parsing ${file}`);
      if (visited.has(file)) continue;
      visited.add(file);
      schemaFiles.push(file);
      
      const content = readFileSync(file, "utf8");
      const doc = parse(content, { noLocation: false });
      indexDefinitions(doc, file);
      
      filesProcessed++;
      progress.report({ 
        message: `Processed ${filesProcessed} files...`, 
        increment: 5
      });
      
      const includeListRegex = /@sdl\(\s*files?\s*:\s*\[([^]+?)\]/g;
      for (const inc of content.matchAll(includeListRegex)) {
        const raw = inc[1];
        const pathRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g;
        for (const m of raw.matchAll(pathRegex)) {
          const rel = (m[1] ?? m[2]).trim();
          if (!rel) continue;
          const abs = path.join(path.dirname(file), rel);
          if (!visited.has(abs)) queue.push(abs);
        }
      }
    }
    
    progress.report({ message: "Building schema...", increment: 20 });
    
    // After collecting all schema files, build the full SDL and scan executables
    const fullSDL = schemaFiles.map(fp => readFileSync(fp, 'utf8')).join('\n');
    scanSDLExecutables(fullSDL, path.dirname(entryFile));
    
    
    progress.report({ message: "Schema scan complete", increment: 100 });
    
    // Log detailed information about what was found
    logger.info(`Root operations found: ${Object.keys(rootOperations).length}`);
    for (const [fieldName, fieldInfo] of Object.entries(rootOperations)) {
      logger.info(`  - ${fieldName} (returns: ${fieldInfo.returnType}, list: ${fieldInfo.isList})`);
    }
    
    logger.info(`Types in field index: ${Object.keys(fieldIndex).length}`);
    for (const typeName of Object.keys(fieldIndex)) {
      logger.info(`  ${typeName}: ${fieldIndex[typeName].length} fields`);
    }
    
    logger.info(`Schema scan completed: ${filesProcessed} files processed, ${Object.keys(fieldIndex).length} types found`);
  });
}

/**
 * Returns the map of root operations (fields on Query, Mutation, Subscription).
 * @returns Record of operation names to operation details
 */
export function getRootOperationsMap() {
  return rootOperations;
}

/**
 * Returns the map of GraphQL operations in all scanned files.
 * @returns Map of file URIs to operation entries
 */
export function getOperationMap() {
  return operationMap;
}

/**
 * Returns the map of persisted documents.
 * @returns Map of document IDs to persisted document entries
 */
export function getPersistedDocMap() {
  return persistedDocMap;
}

/**
 * Returns the index of fields grouped by parent type.
 * @returns Record mapping type names to their field information
 */
export function getFieldIndex() {
  return fieldIndex;
}

/**
 * Returns directives applied to each type.
 * @returns Record mapping type names to their directive information
 */
export function getTypeDirectives() {
  return typeDirectives;
}

/**
 * Returns relationships between types in the schema.
 * @returns Array of type relationship objects
 */
export function getTypeRelationships() {
  return typeRelationships;
}

/**
 * Peels away wrappers (NonNull, List) to get the named type.
 * @param type The GraphQL type node to unwrap
 * @returns The name of the inner named type
 */
export function unwrapType(type: TypeNode): string {
  // Add validation
  if (!type) {
    logger.warn('Null type provided to unwrapType');
    return '';
  }
  
  if (type.kind === Kind.NAMED_TYPE) return type.name.value;
  if (type.kind === Kind.NON_NULL_TYPE || type.kind === Kind.LIST_TYPE) {
    return unwrapType(type.type);
  }
  return '';
}

/**
 * Gets the full type string including nullability and list wrappers.
 * @param type The GraphQL type node to analyze
 * @returns The full type string with appropriate wrapping (e.g., "String!", "[Int]", "[User!]!")
 */
export function getFullType(type: TypeNode): string {
  if (!type) {
    logger.warn('Null type provided to getFullType');
    return '';
  }
  
  if (type.kind === Kind.NAMED_TYPE) {
    return type.name.value;
  }
  
  if (type.kind === Kind.LIST_TYPE) {
    return `[${getFullType(type.type)}]`;
  }
  
  if (type.kind === Kind.NON_NULL_TYPE) {
    return `${getFullType(type.type)}!`;
  }
  
  return '';
}

/**
 * Checks if a type is or contains a list type.
 * @param type The GraphQL type node to check
 * @returns True if the type is or contains a list type
 */
function isListType(type: TypeNode): boolean {
  // Add validation
  if (!type) {
    logger.warn('Null type provided to isListType');
    return false;
  }
  
  if (type.kind === Kind.LIST_TYPE) return true;
  if (type.kind === Kind.NON_NULL_TYPE) return isListType(type.type);
  return false;
}

/**
 * Computes a SHA256 hash of the input string.
 * Used for generating stable document IDs.
 * @param input The string to hash
 * @returns Hex string of the SHA256 hash
 */
function computeHash(input: string): string {
  // Add validation
  if (!input || typeof input !== 'string') {
    logger.warn('Invalid input provided to computeHash');
    return '';
  }
  
  const { createHash } = require('crypto');
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Checks if a type name represents a GraphQL scalar type.
 * @param typeName The name of the type to check
 * @returns True if the type is a scalar type
 */
function isScalarType(typeName: string): boolean {
  return GRAPHQL.SCALAR_TYPES.includes(typeName);
}
