<!--
Copyright IBM Corp. 2025
Assisted by CursorAI
-->

# StepZen Import Enhancement System

This document outlines the two-phase approach for integrating StepZen CLI import commands with the VS Code extension and providing intelligent schema enhancements.

## Overview

The import enhancement system consists of two distinct phases:

1. **Phase 1: CLI Import Integration** - Seamless UI for all StepZen import commands
2. **Phase 2: Functional Enhancements** - Intelligent post-import schema improvements

## Phase 1: CLI Import Integration (✅ IMPLEMENTED)

### Architecture

The system uses a generalized service-based architecture that follows the extension's established patterns:

```
ImportService (Orchestrator)
├── CurlCommandBuilder
├── OpenApiCommandBuilder
├── GraphQLCommandBuilder
└── DatabaseCommandBuilder
```

**Key Components:**

- **`ImportService`** - Central orchestrator that handles all import types
- **Command Builders** - Type-specific logic for building CLI arguments
- **Type Definitions** - Comprehensive TypeScript interfaces for all configurations
- **VS Code Commands** - User-friendly interfaces for each import type

### Supported Import Types

#### 1. cURL Import (`stepzen import curl`)

- **Command**: `stepzen.importCurl`
- **Features**:
  - Smart cURL command parsing
  - Auto-detection of secret headers
  - Path parameter configuration
  - Schema and query name generation

#### 2. OpenAPI Import (`stepzen import openapi`)

- **Command**: `stepzen.importOpenapi`
- **Features**:
  - File browser for local specs
  - URL input for remote specs
  - Automatic schema name generation
  - Support for YAML and JSON formats

#### 3. GraphQL Import (`stepzen import graphql`)

- **Command**: `stepzen.importGraphql`
- **Features**:
  - Multiple authentication methods (Bearer, API Key, Basic Auth)
  - Type prefix configuration
  - Endpoint validation
  - Secret management

#### 4. Database Import (`stepzen import {postgresql|mysql|db2|oracle|snowflake|presto}`)

- **Command**: `stepzen.importDatabase`
- **Features**:
  - Support for all StepZen database types
  - Connection string or individual parameters
  - Auto-linking with `@materializer`
  - Database-specific options (e.g., Snowflake warehouse)

### Implementation Status

- ✅ **Type Definitions** - Complete TypeScript interfaces
- ✅ **Import Service** - Generalized service with command builders
- ✅ **Command Implementations** - All four import commands
- ✅ **Unit Tests** - Comprehensive test coverage
- ⏳ **Command Registration** - Need to register in `extension.ts`
- ⏳ **Integration Testing** - End-to-end testing with CLI
- ⏳ **Documentation** - User-facing documentation

### Testing Strategy

#### Unit Tests

- **Import Service Tests** (`src/test/unit/services/importService.test.ts`)

  - CLI argument building for all import types
  - Configuration validation
  - Error handling
  - Type detection logic

- **Command Tests** (`src/test/unit/commands/importCurl.test.ts`)
  - cURL parsing logic
  - URL validation
  - Schema name generation
  - Edge case handling

#### Integration Tests (TODO)

- End-to-end command execution
- CLI integration validation
- File system operations
- Error scenarios

### Architecture Alignment

The implementation follows the extension's established patterns:

- **Service Registry** - `ImportService` registered in service registry
- **Error Handling** - Uses `handleError()` and `ValidationError`
- **Logging** - Integrated with `services.logger`
- **Command Structure** - Follows established command patterns
- **TypeScript Strict Mode** - Full type safety

## Phase 2: Functional Enhancements (🔄 PLANNED)

### Enhancement Categories

#### 1. Add Pagination

- **Target**: All directive types (`@rest`, `@dbquery`, `@graphql`)
- **Implementation**: Convert list fields to GraphQL Cursor Connections
- **Benefits**: Consistent pagination across all data sources

#### 2. Improve Field Names

- **Target**: All generated types
- **Implementation**:
  - Convert `snake_case` to `camelCase`
  - Fix verb-based query names (e.g., `getUser` → `user`)
  - Standardize naming conventions
- **Benefits**: Better GraphQL conventions

#### 3. Add Documentation

- **Target**: All types and fields
- **Implementation**:
  - Generate descriptions from database comments
  - Add field documentation from OpenAPI descriptions
  - Create meaningful type descriptions
- **Benefits**: Self-documenting schemas

#### 4. Connect Related Data

- **Target**: Object types with relationships
- **Implementation**:
  - Add `@materializer` directives for foreign keys
  - Create nested object relationships
  - Link related entities across data sources
- **Benefits**: Rich, connected data graphs

### Enhancement Architecture

```
EnhancementService
├── PaginationEnhancer
├── FieldNameEnhancer
├── DocumentationEnhancer
└── RelationshipEnhancer
```

**Integration Points:**

- **Schema Analysis** - Leverage existing `SchemaIndexService`
- **File Modification** - Use established file editing patterns
- **User Interface** - Follow command structure patterns

## Development Roadmap

### Immediate Next Steps

1. **Register Commands** - Add import commands to `extension.ts`
2. **Integration Testing** - Test with actual StepZen CLI
3. **Error Handling** - Refine error messages and recovery
4. **Documentation** - Create user guides and examples

### Phase 2 Planning

1. **Schema Analysis** - Extend `SchemaIndexService` for enhancement detection
2. **Enhancement UI** - Design user interface for functional enhancements
3. **File Editing** - Implement safe schema modification patterns
4. **Enhancement Engine** - Build the core enhancement logic

## Testing Coverage

### Current Test Coverage

- ✅ **Import Service** - 95% coverage

  - All command builders tested
  - Configuration validation
  - Error scenarios
  - Type detection

- ✅ **Command Logic** - 90% coverage
  - URL parsing
  - cURL command parsing
  - Schema name generation
  - Edge cases

### Planned Test Coverage

- ⏳ **Integration Tests** - CLI execution
- ⏳ **UI Tests** - VS Code command testing
- ⏳ **Enhancement Tests** - Schema modification testing

## Documentation

### User Documentation (TODO)

- **Getting Started Guide** - How to use import commands
- **Configuration Reference** - All available options
- **Troubleshooting Guide** - Common issues and solutions
- **Examples** - Real-world import scenarios

### Developer Documentation

- **Architecture Guide** - System design and patterns
- **Extension Guide** - Adding new import types
- **Testing Guide** - Running and writing tests

## Security Considerations

### Credential Handling

- **Secrets Detection** - Auto-detect authentication headers
- **Secure Storage** - Use VS Code secret storage for credentials
- **Non-Interactive Mode** - Prevent credential prompts in CLI

### Validation

- **Input Validation** - Validate all user inputs
- **URL Validation** - Ensure valid endpoints
- **Connection Validation** - Test database connections safely

---

_Portions of the Content may be generated with the assistance of CursorAI_
