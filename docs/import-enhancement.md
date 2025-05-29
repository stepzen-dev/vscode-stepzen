<!--
Copyright IBM Corp. 2025
Assisted by CursorAI
-->

# StepZen Import Enhancement System

This document outlines the roadmap for enhancing StepZen's import capabilities in VS Code, building on the solid foundation of CLI integration that's now in place.

## Current State

The extension now includes a complete CLI import integration system with:

- **All Import Types Supported**: cURL, OpenAPI, GraphQL, and Database imports
- **Robust Architecture**: Service-based design with command builders for each import type
- **Shell Safety**: Proper escaping for passwords and special characters
- **Type Safety**: Comprehensive TypeScript interfaces and validation
- **Test Coverage**: 227 passing tests with comprehensive coverage

## Next Steps

### Phase 1: UI Polish & User Experience

#### 1. Enhanced User Interfaces

**Current**: Basic command implementations exist
**Goal**: Rich, intuitive VS Code interfaces

- **cURL Import UI**

  - Smart cURL command parsing and preview
  - Visual header/authentication configuration
  - Real-time validation and suggestions

- **Database Import UI**

  - Connection testing before import
  - Database schema preview
  - Table/view selection interface

- **GraphQL Import UI**
  - Endpoint introspection and validation
  - Schema preview before import
  - Authentication method selection

#### 2. Import Experience Improvements

- **Progress Indicators**: Show import progress and status
- **Better Error Messages**: Actionable error descriptions with suggestions
- **Import Preview**: Show what will be generated before executing
- **Success Actions**: Quick access to generated files and next steps

#### 3. Workspace Integration

- **Project Detection**: Smarter StepZen project discovery
- **File Organization**: Intelligent placement of generated schemas
- **Conflict Resolution**: Handle naming conflicts gracefully

### Phase 2: Intelligent Schema Enhancements

Once the import UX is polished, add intelligent post-import schema improvements:

#### 1. Automatic Improvements

- **Field Name Normalization**: Convert `snake_case` to `camelCase`
- **Query Name Optimization**: Fix verb-based names (`getUser` → `user`)
- **Type Documentation**: Generate descriptions from source metadata
- **Pagination Addition**: Convert lists to GraphQL Cursor Connections

#### 2. Relationship Detection

- **Foreign Key Analysis**: Detect relationships in database schemas
- **Cross-Source Linking**: Connect data across different import sources
- **Materializer Suggestions**: Recommend `@materializer` directives

#### 3. Enhancement UI

- **Enhancement Preview**: Show proposed changes before applying
- **Selective Application**: Choose which enhancements to apply
- **Rollback Support**: Undo enhancements if needed

## Implementation Priorities

### High Priority (Next Sprint)

1. **cURL Command Parsing**: Complete the smart cURL parsing logic
2. **Database Connection Testing**: Validate connections before import
3. **Import Progress UI**: Show real-time import status

### Medium Priority

1. **Schema Preview**: Show generated schema before import
2. **Error Recovery**: Better handling of failed imports
3. **Import History**: Track and replay previous imports

### Future Considerations

1. **Custom Import Types**: Plugin system for new import sources
2. **Batch Operations**: Import multiple sources at once
3. **Schema Versioning**: Track schema changes over time

## Architecture Notes

The current implementation follows established extension patterns:

- **Service Registry**: All import functionality accessible via `services.import`
- **Command Builders**: Extensible pattern for new import types
- **Error Handling**: Consistent error reporting and logging
- **Type Safety**: Full TypeScript coverage with proper validation

New features should continue following these patterns for consistency and maintainability.

## Success Metrics

- **User Adoption**: Track usage of import commands
- **Error Reduction**: Measure import success rates
- **Time Savings**: Compare manual vs. automated import workflows
- **Schema Quality**: Assess generated schema adherence to GraphQL best practices

---

_Portions of the Content may be generated with the assistance of CursorAI_
