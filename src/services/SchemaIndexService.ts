/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import { readFileSync } from "fs";
import * as path from "path";
import { parse } from "graphql";
import * as vscode from 'vscode';
import { logger } from './logger';
import { traverseSDLIncludes } from './schema/linker';
import { SchemaIndexer, SymbolLocation, RootOperationInfo, FieldInfo, DirectiveInfo, TypeRelationship, OperationEntry, PersistedDocEntry } from './schema/indexer';

/**
 * Service for indexing and querying StepZen GraphQL schemas
 * Provides a high-level interface for schema scanning and information retrieval
 */
export class SchemaIndexService {
  private indexer: SchemaIndexer = new SchemaIndexer();

  /**
   * Scans a StepZen project starting from an entry file.
   * Traverses all linked schema files, builds definitions index,
   * and populates operation and type information.
   * 
   * @param entryFile The path to the main entry file (typically index.graphql)
   * @returns Promise that resolves when scanning completes
   */
  async scan(entryFile: string): Promise<void> {
    // Add validation
    if (!entryFile || typeof entryFile !== 'string') {
      logger.error('Invalid entry file path provided');
      return;
    }
    
    logger.info(`Scanning project starting at ${entryFile}`);
    
    // Show progress notification to the user
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "StepZen: Scanning schema...",
      cancellable: false
    }, async (progress) => {
      progress.report({ message: "Starting scan...", increment: 0 });
      
      // Clear previous state
      this.indexer.clear();
      
      // Traverse all linked schema files
      const schemaFiles = traverseSDLIncludes(entryFile);
      logger.debug(`Found ${schemaFiles.length} schema files to process`);
      
      let filesProcessed = 0;
      
      // Index each schema file
      for (const file of schemaFiles) {
        logger.debug(`Parsing ${file}`);
        
        try {
          const content = readFileSync(file, "utf8");
          const doc = parse(content, { noLocation: false });
          this.indexer.indexDocument(doc, file);
          
          filesProcessed++;
          progress.report({ 
            message: `Processed ${filesProcessed} files...`, 
            increment: Math.floor((filesProcessed / schemaFiles.length) * 70)
          });
        } catch (err) {
          logger.error(`Error processing file ${file}: ${err}`);
        }
      }
      
      progress.report({ message: "Building schema...", increment: 80 });
      
      // After collecting all schema files, build the full SDL and scan executables
      try {
        const fullSDL = schemaFiles.map(fp => readFileSync(fp, 'utf8')).join('\n');
        this.indexer.scanSDLExecutables(fullSDL, path.dirname(entryFile));
      } catch (err) {
        logger.error(`Error scanning SDL executables: ${err}`);
      }
      
      progress.report({ message: "Schema scan complete", increment: 100 });
      
      // Log detailed information about what was found
      const rootOperations = this.indexer.getRootOperations();
      const fieldIndex = this.indexer.getFieldIndex();
      
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
   * Clears all scanner state including root operations, operation map, and persisted documents.
   * Used for testing to ensure clean state between test runs.
   */
  clearState(): void {
    this.indexer.clear();
  }

  /**
   * Finds all definitions of a symbol in the project.
   * @param name The symbol name to find
   * @returns Array of locations or undefined if not found
   */
  findDefinition(name: string): SymbolLocation[] | undefined {
    return this.indexer.findDefinition(name);
  }

  /**
   * Returns the map of root operations (fields on Query, Mutation, Subscription).
   * @returns Record of operation names to operation details
   */
  getRootOperations(): Record<string, RootOperationInfo> {
    return this.indexer.getRootOperations();
  }

  /**
   * Returns the map of GraphQL operations in all scanned files.
   * @returns Map of file URIs to operation entries
   */
  getOperationMap(): Record<string, OperationEntry[]> {
    return this.indexer.getOperationMap();
  }

  /**
   * Returns the map of persisted documents.
   * @returns Map of document IDs to persisted document entries
   */
  getPersistedDocMap(): Record<string, PersistedDocEntry> {
    return this.indexer.getPersistedDocMap();
  }

  /**
   * Returns the index of fields grouped by parent type.
   * @returns Record mapping type names to their field information
   */
  getFieldIndex(): Record<string, FieldInfo[]> {
    return this.indexer.getFieldIndex();
  }

  /**
   * Returns directives applied to each type.
   * @returns Record mapping type names to their directive information
   */
  getTypeDirectives(): Record<string, DirectiveInfo[]> {
    return this.indexer.getTypeDirectives();
  }

  /**
   * Returns relationships between types in the schema.
   * @returns Array of type relationship objects
   */
  getTypeRelationships(): TypeRelationship[] {
    return this.indexer.getTypeRelationships();
  }

  /**
   * Computes a SHA256 hash of the input string.
   * Used for generating stable document IDs.
   * @param input The string to hash
   * @returns Hex string of the SHA256 hash
   */
  computeHash(input: string): string {
    return this.indexer.computeHash(input);
  }
} 