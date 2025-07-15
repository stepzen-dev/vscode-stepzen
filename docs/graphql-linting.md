# GraphQL Linting with Custom Rules

This document describes the custom GraphQL linting implementation in the StepZen VS Code extension, providing comprehensive GraphQL schema validation and linting capabilities.

## Overview

The GraphQL linting feature uses the built-in GraphQL parser to provide real-time validation of GraphQL schema files. This custom implementation helps developers maintain high-quality GraphQL schemas by catching common issues and enforcing best practices without external dependencies.

## Features

### 🎯 **Real-time Linting**

- Automatically lint GraphQL files as you type (configurable)
- Instant feedback in the VS Code Problems panel
- Integration with the existing file watching system

### 📋 **Comprehensive Rules**

- **GraphQL Best Practices**: Enforce standard GraphQL conventions
- **StepZen-Specific Rules**: Customized for StepZen's GraphQL implementation
- **Customizable Configuration**: Adjust rules through VS Code settings

### 🔧 **VS Code Integration**

- Native VS Code diagnostic collection
- Problems panel integration
- Command palette access
- Progress reporting for long operations

## Architecture

The GraphQL linting feature follows the existing service registry pattern:

```
GraphQLLinterService
├── ESLint Integration
├── VS Code Diagnostics
├── Configuration Management
└── File Watching Integration
```

### Service Integration

```typescript
// Service registry includes the linter
export interface ServiceRegistry {
  // ... other services
  graphqlLinter: GraphQLLinterService;
}
```

### Diagnostic Collection

The linter creates a dedicated VS Code diagnostic collection (`stepzen-graphql-lint`) that displays linting issues in the Problems panel alongside other diagnostics.

## Configuration

### Extension Settings

Configure GraphQL linting behavior through VS Code settings:

```json
{
  "stepzen.autoLintGraphQL": false
}
```

### Settings Reference

| Setting                   | Type    | Default | Description                           |
| ------------------------- | ------- | ------- | ------------------------------------- |
| `stepzen.autoLintGraphQL` | boolean | `false` | Enable automatic linting on file save |

## Available Rules

The custom GraphQL linter includes the following built-in rules:

### Core GraphQL Rules

| Rule                         | Severity | Description                           |
| ---------------------------- | -------- | ------------------------------------- |
| `no-anonymous-operations`    | error    | Prevent anonymous GraphQL operations  |
| `no-duplicate-fields`        | error    | Prevent duplicate field definitions   |
| `require-description`        | warn     | Require descriptions for types/fields |
| `require-deprecation-reason` | warn     | Require reason for deprecated fields  |
| `field-naming-convention`    | warn     | Enforce camelCase field naming        |
| `root-fields-nullable`       | warn     | Suggest nullable root field types     |

### Pagination Rules

| Rule                           | Severity | Description                                    |
| ------------------------------ | -------- | ---------------------------------------------- |
| `connection-structure`         | error    | Ensure Connection types have edges/pageInfo    |
| `edge-structure`               | error    | Ensure Edge types have node/cursor fields      |
| `connection-arguments`         | warn     | Suggest pagination arguments for connections   |
| `pagination-argument-types`    | error    | Enforce correct types for pagination arguments |

### Rule Details

- **no-anonymous-operations**: Ensures all GraphQL operations (queries, mutations, subscriptions) have names
- **no-duplicate-fields**: Prevents duplicate field definitions within the same type
- **require-description**: Suggests adding descriptions to types and fields for better documentation
- **require-deprecation-reason**: Ensures deprecated fields include a reason for deprecation
- **field-naming-convention**: Enforces camelCase naming for field names (ignores special fields like `__typename`)
- **root-fields-nullable**: Suggests making root type fields nullable for better error handling
- **connection-structure**: Ensures Connection types follow the Relay pagination pattern with `edges` and `pageInfo` fields
- **edge-structure**: Ensures Edge types have the required `node` and `cursor` fields
- **connection-arguments**: Suggests adding `first` and `after` arguments to fields returning Connection types
- **pagination-argument-types**: Enforces correct types for pagination arguments (`first: Int!`, `after: String`)

## Usage

### Manual Linting

1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run `StepZen: Lint GraphQL Schema`
3. View results in the Problems panel

### Automatic Linting

Enable automatic linting in settings:

```json
{
  "stepzen.autoLintGraphQL": true
}
```

Files will be automatically linted when:

- A GraphQL file is saved
- The file watcher detects changes
- The project is scanned

### Command Line Integration

The linter integrates with the existing ESLint configuration:

```bash
# Lint GraphQL files using the extension's configuration
npm run lint
```

## Error Handling

### Initialization Errors

If the GraphQL linter fails to initialize:

1. Check that `@graphql-eslint/eslint-plugin` and `@graphql-eslint/parser` are installed
2. Verify VS Code settings are valid
3. Check the extension output for detailed error messages

### Linting Errors

Common linting issues and solutions:

| Issue                | Solution                                            |
| -------------------- | --------------------------------------------------- |
| Anonymous operations | Add operation names to all queries/mutations        |
| Missing descriptions | Add descriptions to types and fields                |
| Duplicate fields     | Remove duplicate field definitions                  |
| Deprecated fields    | Add deprecation reasons or remove deprecated fields |

## Performance Considerations

### File Watching

The linter integrates with the existing file watching system to minimize performance impact:

- Debounced linting (250ms delay)
- Only lints changed files when auto-linting is enabled
- Lazy initialization of ESLint instance

### Memory Management

- ESLint instance is created once and reused
- Diagnostic collection is properly disposed on extension deactivation
- File watchers are cleaned up when switching projects

## Testing

### Unit Tests

The GraphQL linter includes comprehensive unit tests:

```bash
npm run test:unit -- --grep "GraphQL Linter"
```

### Integration Tests

Test files with intentional linting issues are provided in `src/test/fixtures/schema-sample/test-lint.graphql`.

## Troubleshooting

### Common Issues

**Linter not working**

- Check that the GraphQL parser is working correctly
- Verify VS Code settings are correct
- Check extension output for error messages

**False positives**

- Review rule configuration in settings
- Consider disabling specific rules for your use case
- Check StepZen-specific rule overrides

**Performance issues**

- Disable auto-linting for large projects
- Use manual linting instead of automatic
- Check file watcher configuration

### Debug Mode

Enable debug logging to troubleshoot linting issues:

```json
{
  "stepzen.logLevel": "debug"
}
```

## Future Enhancements

### Planned Features

- **Fix Suggestions**: Auto-fix capabilities for common issues
- **Custom Rule Sets**: Predefined rule configurations for different project types
- **Performance Optimization**: Incremental linting for large schemas
- **Integration with StepZen CLI**: Use StepZen's validation alongside ESLint

### Contributing

To contribute to the GraphQL linting feature:

1. Follow the existing code patterns and architecture
2. Add tests for new functionality
3. Update documentation for new features
4. Consider performance impact of changes

## References

- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)
- [StepZen GraphQL Documentation](https://stepzen.com/docs)
- [VS Code Extension API](https://code.visualstudio.com/api)
