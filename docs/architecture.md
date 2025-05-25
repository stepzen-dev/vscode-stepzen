<!--
Copyright IBM Corp. 2025
Assisted by CursorAI
-->

# Schema Indexing Architecture

This document describes the modular architecture of the StepZen VS Code extension's schema indexing system.

## Overview

The schema indexing system has been refactored from a monolithic `stepzenProjectScanner.ts` file into a modular, service-oriented architecture. This improves maintainability, testability, and separation of concerns.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Extension Layer                          │
├─────────────────────────────────────────────────────────────────┤
│  Commands  │  Panels  │  Utils  │  Language Features           │
├─────────────────────────────────────────────────────────────────┤
│                      Service Registry                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ SchemaIndexSvc  │  │ ProjectResolver │  │ StepzenCliSvc   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                    Schema Processing Layer                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ SchemaIndexer   │  │ SchemaLinker    │  │ SchemaParser    │  │
│  │ (indexer.ts)    │  │ (linker.ts)     │  │ (parser.ts)     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                      GraphQL & File System                     │
└─────────────────────────────────────────────────────────────────┘
```

## Module Structure

### Service Layer

#### `services/SchemaIndexService.ts`

- **Purpose**: High-level orchestration service for schema indexing
- **Responsibilities**:
  - Coordinates the scanning process
  - Provides progress notifications to users
  - Exposes public API for schema information retrieval
  - Manages the lifecycle of indexing operations

#### `services/index.ts`

- **Purpose**: Service registry for dependency injection
- **Responsibilities**:
  - Maintains singleton instances of all services
  - Provides service override capabilities for testing
  - Acts as the central service locator

### Schema Processing Layer

#### `services/schema/indexer.ts`

- **Purpose**: Core indexing logic for GraphQL schema definitions
- **Responsibilities**:
  - Builds definition indexes from parsed GraphQL documents
  - Tracks root operations (Query, Mutation, Subscription fields)
  - Maintains field indexes for all types
  - Processes SDL executables and persisted documents
  - Manages type relationships and directives

#### `services/schema/linker.ts`

- **Purpose**: SDL include directive traversal
- **Responsibilities**:
  - Safely traverses `@sdl(files: [...])` directives
  - Prevents infinite loops in file inclusion
  - Returns ordered list of all schema files to process

#### `services/schema/parser.ts`

- **Purpose**: GraphQL AST utility functions
- **Responsibilities**:
  - Type unwrapping (removing NonNull/List wrappers)
  - Full type string generation with nullability
  - List type detection
  - Scalar type identification

### Migration Complete

The original `utils/stepzenProjectScanner.ts` compatibility layer has been removed. All components now use the new service architecture directly through `services.schemaIndex`.

## Data Flow

1. **Initialization**: Extension activates and creates service instances
2. **Project Detection**: ProjectResolver finds StepZen configuration
3. **Schema Scanning**: SchemaIndexService orchestrates the process:
   - SchemaLinker traverses SDL includes to find all files
   - Each file is parsed using GraphQL parser
   - SchemaIndexer processes each document to build indexes
   - SDL executables are scanned for operation metadata
4. **Information Retrieval**: Commands and features query the service for:
   - Symbol definitions (go-to-definition)
   - Root operations (code lens, request execution)
   - Type relationships (visualization)
   - Persisted documents (request execution)

## Key Benefits

### Modularity

- Each module has a single, well-defined responsibility
- Dependencies are explicit and injected
- Easy to understand and modify individual components

### Testability

- Services can be mocked independently
- Each module can be unit tested in isolation
- Service registry supports test overrides

### Maintainability

- Clear separation of concerns
- Reduced coupling between components
- Easier to add new features or modify existing ones

### Performance

- Efficient file traversal with loop detection
- Incremental indexing capabilities
- Optimized data structures for fast lookups

## Migration Strategy

The refactoring has been completed in phases:

1. **Phase 1** ✅ **Complete**: New architecture with compatibility layer

   - Created modular service architecture
   - Maintained backward compatibility
   - All tests remained green

2. **Phase 2** ✅ **Complete**: Direct service usage

   - Migrated all commands and features to use services directly
   - Updated imports across the codebase
   - Removed dependency on compatibility layer

3. **Phase 3** ✅ **Complete**: Cleanup
   - Removed compatibility layer entirely
   - Full migration to service-oriented architecture achieved

## Testing Strategy

- **Unit Tests**: Each module tested independently with mocked dependencies
- **Integration Tests**: Service interactions tested with real implementations
- **Compatibility Tests**: Ensure backward compatibility is maintained
- **Performance Tests**: Verify indexing performance with large schemas

## Error Handling

- Consistent error handling across all modules
- Graceful degradation when files are missing or malformed
- Detailed logging for debugging and troubleshooting
- User-friendly progress notifications and error messages

---

_Portions of the Content may be generated with the assistance of CursorAI_
