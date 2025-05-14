# StepZen Tools Enhancement Roadmap

## ✅ Completed Enhancements

### ✅ TypeScript Type Safety
- ✅ Improved type safety throughout the codebase
- ✅ Replaced most `any` types with specific interfaces
- ✅ Proper use of TypeScript interfaces for structured data

### TypeScript Type Improvements
- Refine interfaces in `stepzenProjectScanner.ts` to remove `as any` assertions:
  - Update `FieldInfo` interface to include the `isDeprecated` property that's being used in `generateOperations.ts`
  - Standardize the structure of `fieldIndex` across the codebase to ensure consistent access patterns
  - Add proper type annotations for data structures returned by utility functions
  - Consider implementing a distinct interface for field data as consumed by operation generators

### ✅ Error Handling and Diagnostics
- ✅ Implement a consistent error handling strategy across all commands
- ✅ Add more detailed error reporting in the output channel for debugging
- ✅ Centralized error utilities with StepZenError class
- ✅ Consistent error formatting and logging

### ✅ Project Initialization
- ✅ Implement a "StepZen: Initialize Project" command that creates a new stepzen.config.json file
- ✅ Add directory selection dialog for new project location
- ✅ Implement validation for existing projects and prompt for decision (overwrite/create new directory)
- ✅ Add endpoint name specification with validation and suggestions
- ✅ Create default config templates with best practices

## Core Functionality Improvements
- Provide directive-specific validation errors and suggestions
- Add schema-level validation reporting for GraphQL schemas

### Schema Explorer Enhancements
- Link codelens to the schema definition
- Add "Go to Schema" buttons for fields and types in results
- Improve navigation and overall UI/UX of the schema visualizer
- Add search functionality within the visualizer
- Highlight types and fields with directives differently
- Add directive details on hover or in a dedicated panel

### Schema Visualizer Improvements
- Add "Compare to Deployed Schema" feature showing differences between local and deployed schemas
- Implement filtering system for types/fields with specific directives
- Add visual indicators for types that use directives like @mock, @connector, @rest, etc.
- Create a collapsible tree view of schema relationships

### Code Organization
- Consider using a class-based approach for the main extension functionality
- Move shared utilities into dedicated files to reduce duplication
- Organize code by feature area (deployment, directives, visualizer, etc.)

### Configuration Options
- Expose more settings to users (e.g., timeout values, default behaviors)
- Add a dedicated settings section in package.json
- Allow configuring different environments (dev, staging, prod)

## Directive Support Enhancements

### Directive Management and Insertion
- Enhance the existing "Add Materializer" command with more intelligent recommendations
- Add commands for inserting other common StepZen directives (@value, @sdl, @sequence, etc.)
- Create a directive management UI to view and edit directives across the schema
- Implement validation for directive arguments based on directive type
- Add context-aware directive suggestions based on schema position
- Create templates with completion suggestions for directive arguments

### Directive Visualization
- Create a "Directive Explorer" view showing all directives in the project
- Add directive-specific highlighting in the editor
- Implement quick navigation between related directives
- Add validation and quick-fixes for directive arguments

### @sdl Directive Support
- Add support for creating and managing SDL files referenced by @sdl directives
- Implement tools to manage executable documents from @sdl(executables:) argument
- Add validation of @sdl visibility patterns
- Create management UI for @sdl-based schema composition

### @mock and @mockfn Support
- Create commands to add @mock and @mockfn directives to types and fields
- Generate mock data preview based on @mock directives in the schema
- Add intellisense for available mock functions in @mockfn directive
- Implement a mock data testing UI to preview mock data without deploying

### @dbquery Support
- Add templates for common database queries and tables
- Implement SQL validation for @dbquery query arguments
- Create a database schema visualization that maps to GraphQL types
- Add code generation for filter input types based on database schema

### @rest Support
- Add support for managing connector configurations
- Create templates for common REST API patterns
- Implement validation for connector configurations
- Add testing UI for REST endpoints without deployment

## Executable Documents Integration

### Schema Testing Features
- Add detection of deprecated field usage in operations
- Implement validation checks beyond standard GraphQL validation
- Generate comprehensive test suites from schema structure
- Track which executable documents have been run and their results
- Compare results between runs for regression testing
- Validate executable documents against the current schema
- Add performance metrics for executable document runs

### Executable Document Management
- Create feature to auto-generate executable documents for root fields
- Build a UI for managing executable documents as "unit tests" for schema
- Provide tooling to update executable documents when schema changes
- Store and manage variables specifically for executable documents
- Allow saving different variable sets for different environments (dev/staging/prod)
- Add batch testing of multiple executable documents

## Results Panel Enhancements

### Data Visualization
- Add search functionality within large result sets
- Add visualization options for certain result types
- Replace grouped view with OTEL viewer
- Add filtering options for response data
- Implement exportable test reports from result data

### Performance Metrics
- Add detailed timing information for requests
- Visualize performance metrics over time
- Compare performance between different queries
- Add bottleneck identification for complex queries

## Security Features

### Field Policies Management
- Create a visual editor for StepZen Field Policies
- Provide a policy testing tool with simulated JWT tokens
- Implement policy validation against schema structure
- Add security analyzer to identify sensitive fields needing protection
- Include templates for common security patterns (admin-only, public, etc.)

### JWT Integration and Testing
- Provide JWT token visualization and debugging
- Create test environment for policy evaluation with different JWT claims
- Add policy effectiveness reporting
- Implement automation for policy deployment across environments

## Multi-Environment Support

### Environment Management
- Add profiles for different environments (dev, staging, prod)
- Allow switching between different StepZen endpoints
- Create environment-specific variable sets
- Add deployment workflows for different environments

### Collaborative Features
- Share queries with team members
- Export/import operation collections
- Share executable document test suites with team

## Documentation and Productivity

### Documentation Generator
- Create a feature to generate documentation from your GraphQL schema
- Export as Markdown or HTML
- Generate visualizations of schema relationships for documentation
- Add directive documentation to schema documentation

### GraphQL Snippets
- Add code snippets for common GraphQL patterns
- Create template operations for the current schema
- Add snippets for common directive patterns
- Generate starter queries based on schema analysis

## Project Setup and Import

### Schema Import Features
- Create UI for "StepZen: Import Schema" with source type selection
- Implement specialized import forms for each data source type:
  - REST API import with curl-style configuration
  - GraphQL subgraph import with endpoint and header configuration
  - Database schema import (MySQL, PostgreSQL, Snowflake, DB2, Oracle)
  - StepZen flow expressions import
- Add argument validation specific to each import source type
- Provide visual feedback during import operations
- Support for storing and managing import credentials securely
- Implement template selection for common import patterns
- Add preview feature to show expected schema result before finalizing import

### Import Result Management
- Add post-import schema validation and error reporting
- Create schema diff view to compare before/after import changes
- Implement undo/rollback functionality for imports
- Add import history tracking for project
- Provide suggestions for next steps after successful import

## Architecture and Infrastructure

### Command Pattern Implementation
- Consider implementing a command pattern for better testability
- This would make unit testing much easier

### Extension API
- Create a proper API for other extensions to leverage your functionality
- This could enable ecosystem growth around your extension

### Testing Infrastructure
- Add unit tests for core functionality
- Implement integration tests for the extension

### Telemetry
- Add optional telemetry to track feature usage
- This could help prioritize future development

### Modular Architecture
- Separate core StepZen functionality from VS Code integration
- This could enable building other tools on the same core

## Prioritized Next Steps Recommendation

Based on the analysis of the current codebase and StepZen directives, these improvements would be most beneficial:

1. **Project Setup and Import**
   - Implement "StepZen: Initialize Project" command to streamline project creation
   - Create UI-based import flows for all supported data sources
   - Build validation and template systems for import operations

2. **Comprehensive Directive Support**
   - Implement support for all StepZen directives
   - Add directive-specific validation and suggestions
   - Create a directive explorer/management UI

3. **Schema Testing with Executable Documents**
   - Leverage the "executables" argument in SDL directives
   - Create tools to generate test operations for all root-level entries
   - Implement checks for deprecated field usage in operations

4. **Schema Visualizer Improvements**
   - Enhance navigation and visual design of the schema visualizer
   - Add directive-based highlighting and filtering
   - Implement "Compare to Deployed Schema" functionality

5. **Field Policy Management**
   - Create visual editor for configuring field policies
   - Add policy testing with JWT simulation
   - Implement security analysis for sensitive fields

6. **Database Integration Tools**
   - Add support for @dbquery directive
   - Create database schema to GraphQL type mapping tools
   - Implement query builders for common database operations

7. **Mock Data Generation**
   - Implement @mock and @mockfn directive support
   - Create a mock data preview feature
   - Build testing tools that use mock data

These focused improvements would enhance the developer experience while promoting schema stability through better testing and visualization capabilities, along with improved directive management. The new project setup features will make it significantly easier for developers to get started with StepZen projects directly from VS Code.
