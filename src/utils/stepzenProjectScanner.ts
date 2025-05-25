/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

// Compatibility layer for stepzenProjectScanner
// This file maintains the original API while delegating to the new SchemaIndexService

import { services } from '../services';

// Re-export types from the new modules
export type {
  SymbolLocation,
  ArgInfo,
  RootOperationInfo,
  OperationEntry,
  PersistedDocEntry,
  DirectiveInfo,
  FieldInfo,
  TypeRelationship
} from '../services/schema/indexer';

/**
 * Scans a StepZen project starting from an entry file.
 * 
 * @deprecated Use services.schemaIndex.scan() instead
 * This function is maintained for backward compatibility during migration
 * 
 * @param entryFile The path to the main entry file (typically index.graphql)
 * @returns Promise that resolves when scanning completes
 */
export async function scanStepZenProject(entryFile: string): Promise<void> {
  return services.schemaIndex.scan(entryFile);
}

/**
 * Clears all scanner state including root operations, operation map, and persisted documents.
 * Used for testing to ensure clean state between test runs.
 * 
 * @deprecated Use services.schemaIndex.clearState() instead
 */
export function clearScannerState(): void {
  services.schemaIndex.clearState();
}

/**
 * Finds all definitions of a symbol in the project.
 * 
 * @deprecated Use services.schemaIndex.findDefinition() instead
 * 
 * @param name The symbol name to find
 * @returns Array of locations or undefined if not found
 */
export function findDefinition(name: string) {
  return services.schemaIndex.findDefinition(name);
}

/**
 * Returns the map of root operations (fields on Query, Mutation, Subscription).
 * 
 * @deprecated Use services.schemaIndex.getRootOperations() instead
 * 
 * @returns Record of operation names to operation details
 */
export function getRootOperationsMap() {
  return services.schemaIndex.getRootOperations();
}

/**
 * Returns the map of GraphQL operations in all scanned files.
 * 
 * @deprecated Use services.schemaIndex.getOperationMap() instead
 * 
 * @returns Map of file URIs to operation entries
 */
export function getOperationMap() {
  return services.schemaIndex.getOperationMap();
}

/**
 * Returns the map of persisted documents.
 * 
 * @deprecated Use services.schemaIndex.getPersistedDocMap() instead
 * 
 * @returns Map of document IDs to persisted document entries
 */
export function getPersistedDocMap() {
  return services.schemaIndex.getPersistedDocMap();
}

/**
 * Returns the index of fields grouped by parent type.
 * 
 * @deprecated Use services.schemaIndex.getFieldIndex() instead
 * 
 * @returns Record mapping type names to their field information
 */
export function getFieldIndex() {
  return services.schemaIndex.getFieldIndex();
}

/**
 * Returns directives applied to each type.
 * 
 * @deprecated Use services.schemaIndex.getTypeDirectives() instead
 * 
 * @returns Record mapping type names to their directive information
 */
export function getTypeDirectives() {
  return services.schemaIndex.getTypeDirectives();
}

/**
 * Returns relationships between types in the schema.
 * 
 * @deprecated Use services.schemaIndex.getTypeRelationships() instead
 * 
 * @returns Array of type relationship objects
 */
export function getTypeRelationships() {
  return services.schemaIndex.getTypeRelationships();
}

/**
 * Computes a SHA256 hash of the input string.
 * Used for generating stable document IDs.
 * 
 * @deprecated Use services.schemaIndex.computeHash() instead
 * 
 * @param input The string to hash
 * @returns Hex string of the SHA256 hash
 */
export function computeHash(input: string): string {
  return services.schemaIndex.computeHash(input);
}
