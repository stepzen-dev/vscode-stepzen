<!--
Copyright IBM Corp. 2025
Assisted by CursorAI
-->

# StepZen VS Code Extension Architecture

This document provides contributors with a clear mental model of the extension's structure, coding conventions, and development practices.

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Dependency Injection Pattern](#dependency-injection-pattern)
3. [Error Handling System](#error-handling-system)
4. [Logging Setup](#logging-setup)
5. [Testing Strategy](#testing-strategy)
6. [Future Roadmap](#future-roadmap)
7. [Contributing Guidelines](#contributing-guidelines)

## High-Level Architecture

The StepZen VS Code extension follows a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Extension Layer                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │    Commands     │  │     Panels      │  │     Utils       │  │
│  │  (User Actions) │  │  (WebView UI)   │  │  (Helpers)      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                      Service Registry                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ SchemaIndexSvc  │  │ ProjectResolver │  │ StepzenCliSvc   │  │
│  │ (Schema Data)   │  │ (Project Info)  │  │ (CLI Interface) │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│  ┌─────────────────┐                                            │
│  │     Logger      │                                            │
│  │  (Diagnostics)  │                                            │
│  └─────────────────┘                                            │
├─────────────────────────────────────────────────────────────────┤
│                    Schema Processing Layer                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ SchemaIndexer   │  │ SchemaLinker    │  │ SchemaParser    │  │
│  │ (Build Indexes) │  │ (SDL Traversal) │  │ (AST Utils)     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                      VS Code API Layer                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Commands      │  │   WebViews      │  │  Diagnostics    │  │
│  │   CodeLens      │  │   Progress      │  │   Output        │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                    External Dependencies                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  StepZen CLI    │  │   GraphQL       │  │  File System    │  │
│  │  (Deploy/Run)   │  │   (Parsing)     │  │  (Read/Write)   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

#### 1. Extension Layer

- **Commands**: Handle user-initiated actions (deploy, run requests, go-to-definition)
- **Panels**: Manage WebView-based UI components (results panel, schema visualizer)
- **Utils**: Provide shared utilities and helper functions

#### 2. Service Registry

- **Dependency Injection Container**: Central registry for all services
- **Service Lifecycle Management**: Singleton pattern with override capabilities for testing
- **Cross-cutting Concerns**: Logging, configuration, and shared state

#### 3. Schema Processing Layer

- **Schema Indexing**: Build searchable indexes of GraphQL definitions
- **SDL Linking**: Traverse `@sdl(files: [...])` directives safely
- **AST Processing**: Parse and analyze GraphQL documents

> **Note:**
> The logic for traversing the schema graph to determine all access paths to a type (used in the Field Access Report) is currently implemented as a utility in the report service. In the future, this may be refactored into the SchemaIndexer or a dedicated schema traversal service for broader reuse and testability. (TODO)

#### 4. VS Code API Layer

- **Integration Points**: Commands, CodeLens, WebViews, Diagnostics
- **User Experience**: Progress reporting, notifications, output channels

#### 5. External Dependencies

- **StepZen CLI**: Deploy projects and execute GraphQL requests
- **GraphQL Parser**: Parse and validate GraphQL documents
- **File System**: Read schema files and project configuration

## Dependency Injection Pattern

The extension uses a service registry pattern for dependency injection, making the codebase testable and modular.

### Service Registry Structure

```typescript
// src/services/index.ts
export interface ServiceRegistry {
  cli: StepzenCliService;
  logger: Logger;
  projectResolver: ProjectResolver;
  schemaIndex: SchemaIndexService;
}

export const services: ServiceRegistry = {
  cli: new StepzenCliService(),
  logger,
  projectResolver: new ProjectResolver(logger),
  schemaIndex: new SchemaIndexService(),
};
```

### Using Services

```typescript
// In any module
import { services } from "../services";

// Use services instead of direct instantiation
services.logger.info("Processing schema...");
const result = await services.cli.deploy();
const definitions = services.schemaIndex.findDefinitions("User");
```

### Mocking for Tests

The service registry provides utilities for test mocking:

```typescript
// Override specific services
const mockCli = createMock({ deploy: async () => "success" });
const prevServices = overrideServices({ cli: mockCli });

try {
  // Test code using mocked CLI
} finally {
  resetServices(prevServices);
}

// Or replace entire service registry
const mockServices = createMockServiceRegistry();
const origServices = setMockServices(mockServices);
// ... test code ...
setMockServices(origServices);
```

### Benefits

- **Testability**: Easy to mock dependencies in unit tests
- **Modularity**: Clear separation of concerns between services
- **Flexibility**: Services can be swapped or extended without changing consumers
- **Consistency**: Single source of truth for service instances

## Error Handling System

The extension implements a hierarchical error handling system with consistent user experience.

### Error Hierarchy

```typescript
// Base error class
StepZenError
├── CliError          // CLI command failures
├── NetworkError      // HTTP/network issues
└── ValidationError   // Input validation failures
```

### Error Classes

#### StepZenError (Base)

```typescript
export class StepZenError extends Error {
  public code: string;
  public cause?: unknown;

  constructor(message: string, code: string, cause?: unknown) {
    super(message);
    this.name = "StepZenError";
    this.code = code;
    this.cause = cause;
  }
}
```

#### Specialized Error Types

- **CliError**: StepZen CLI command failures, process errors
- **NetworkError**: HTTP requests, connectivity issues
- **ValidationError**: Input validation, schema validation

### Error Handler

The central error handler normalizes errors and provides consistent user experience:

```typescript
// src/errors/handler.ts
export function handleError(error: unknown): StepZenError {
  // 1. Normalize to StepZenError
  const normalizedError = normalizeError(error);

  // 2. Log with full context
  logger.error(
    `${normalizedError.name}[${normalizedError.code}]: ${normalizedError.message}`,
    normalizedError
  );

  // 3. Show user-friendly notification
  showErrorNotification(normalizedError);

  return normalizedError;
}
```

### Usage Pattern

```typescript
// In command handlers
try {
  await services.cli.deploy();
} catch (err) {
  handleError(err); // Automatically logs and shows user notification
}

// For validation
if (!query.trim()) {
  throw new ValidationError("Query cannot be empty", "EMPTY_QUERY");
}
```

### Error Flow Benefits

- **Consistent UX**: All errors show user-friendly notifications with "Show Logs" action
- **Debugging**: Full error context logged to output channel
- **Categorization**: Errors automatically categorized by type and severity
- **Extensibility**: Easy to add new error types and handling logic

## Logging Setup

The extension provides structured logging with configurable levels and optional file output.

### Logger Configuration

```typescript
// Log levels (in order of verbosity)
export enum LogLevel {
  ERROR = "error", // Critical errors only
  WARN = "warn", // Warnings and errors
  INFO = "info", // General information (default)
  DEBUG = "debug", // Detailed debugging information
}
```

### VS Code Settings

Users can configure logging through VS Code settings:

```json
{
  "stepzen.logLevel": "info", // error | warn | info | debug
  "stepzen.logToFile": false // Enable file logging (requires trusted workspace)
}
```

### Logger Features

#### Output Channel Integration

- Dedicated "StepZen" output channel in VS Code
- Structured log format with timestamps and levels
- "Show Logs" action in error notifications

#### File Logging (Optional)

- Writes to extension storage directory
- Automatic log rotation (1MB limit)
- Only available in trusted workspaces

#### Usage Examples

```typescript
// Basic logging
services.logger.info("Schema indexing started");
services.logger.warn("Deprecated field usage detected");
services.logger.error("Failed to parse GraphQL", error);
services.logger.debug("Processing file: schema.graphql");

// Error context
services.logger.error("CLI command failed", {
  command: "stepzen deploy",
  exitCode: 1,
  stderr: "Authentication failed",
});
```

### Log Level Guidelines

- **ERROR**: Critical failures that prevent functionality
- **WARN**: Issues that don't prevent operation but need attention
- **INFO**: General operational information (default level)
- **DEBUG**: Detailed information for troubleshooting

## Testing Strategy

The extension uses a comprehensive testing strategy with multiple test types and frameworks.

### Test Organization

```
src/test/
├── unit/           # Unit tests for individual components
│   ├── utils/      # Utility function tests
│   ├── services/   # Service layer tests
│   └── commands/   # Command handler tests
├── integration/    # Integration tests across components
├── fixtures/       # Test data and mock objects
├── helpers/        # Shared test utilities
└── README.md       # Testing documentation
```

### Testing Framework

- **Test Runner**: VS Code Test CLI (`@vscode/test-cli`)
- **Test Framework**: Mocha with TypeScript support
- **Mocking**: Sinon for mocks and stubs
- **Coverage**: Built-in coverage reporting

### Test Types

#### 1. Unit Tests

Test individual components in isolation:

```typescript
suite("SchemaIndexService", () => {
  test("should index GraphQL definitions", () => {
    const service = new SchemaIndexService();
    const result = service.indexDocument(mockDocument);
    assert.strictEqual(result.types.length, 3);
  });
});
```

#### 2. Integration Tests

Test component interactions:

```typescript
suite("Command Integration", () => {
  test("deploy command should use CLI service", async () => {
    const mockCli = createMock({ deploy: async () => "success" });
    overrideServices({ cli: mockCli });

    await deployStepZen();

    assert(mockCli.deploy.calledOnce);
  });
});
```

#### 3. Service Mocking

Use dependency injection for clean test isolation:

```typescript
// Mock entire service registry
const mockServices = {
  cli: createMock({ deploy: async () => "success" }),
  logger: createMock({ info: () => {}, error: () => {} }),
  // ... other services
};

const origServices = setMockServices(mockServices);
try {
  // Test code using mocked services
} finally {
  setMockServices(origServices);
}
```

### Running Tests

```bash
# Run all tests
npm test

# Compile tests only
npm run compile-tests

# Watch mode for development
npm run watch-tests

# Coverage report
npm test -- --coverage
```

### Test Guidelines

1. **Independence**: Tests should not depend on each other
2. **Descriptive Names**: Use clear, descriptive test and suite names
3. **Mocking**: Mock external dependencies (CLI, file system, network)
4. **Coverage**: Aim for high coverage of utility functions and core logic
5. **Edge Cases**: Test error conditions and edge cases

### Coverage Requirements

- **Utility Functions**: 100% statement, branch, and function coverage
- **Services**: High coverage of core functionality
- **Commands**: Test both success and error paths
- **Integration**: Test key user workflows

## Future Roadmap

The extension architecture is designed to support planned enhancements and new features.

### Planned Enhancements

#### 1. Telemetry Integration

- **Optional Usage Analytics**: Track feature usage to guide development priorities
- **Error Reporting**: Aggregate error patterns for stability improvements
- **Performance Metrics**: Monitor extension performance and optimization opportunities

**Architecture Impact**:

- New `TelemetryService` in service registry
- Privacy-first design with user opt-in
- Configurable telemetry levels

#### 2. Language Server Protocol (LSP)

- **Advanced IntelliSense**: Full GraphQL language support with autocomplete
- **Real-time Validation**: Schema validation as you type
- **Hover Information**: Type information and documentation on hover

**Architecture Impact**:

- Separate language server process
- Enhanced schema indexing for LSP features
- Communication protocol between extension and language server

#### 3. Enhanced Schema Processing

- **Incremental Updates**: Watch file changes and update indexes incrementally
- **Cross-Project References**: Support for schema dependencies across projects
- **Advanced Validation**: Custom StepZen directive validation

#### 4. WebView Enhancements

- **Improved UI Framework**: Modern React-based WebView components
- **Better State Management**: Consistent state synchronization
- **Enhanced Visualizations**: More interactive schema and trace visualizations

#### 5. Testing Infrastructure

- **E2E Testing**: Full user workflow testing
- **Performance Testing**: Automated performance regression testing
- **Visual Testing**: UI component visual regression testing

### Architectural Hooks

The current architecture provides hooks for future enhancements:

#### Service Registry Extension

```typescript
// Future service additions
export interface ServiceRegistry {
  // Existing services
  cli: StepzenCliService;
  logger: Logger;
  projectResolver: ProjectResolver;
  schemaIndex: SchemaIndexService;

  // Future services
  telemetry?: TelemetryService;
  languageServer?: LanguageServerService;
  configManager?: ConfigurationService;
}
```

#### Plugin Architecture

- Service-based plugins can be added without core changes
- WebView panels can be extended with new visualizations
- Command system supports dynamic command registration

#### Configuration System

- Extensible settings schema in `package.json`
- Runtime configuration updates through logger service
- Environment-specific configuration support

### Migration Strategy

Future enhancements will follow the established patterns:

1. **Backward Compatibility**: Maintain existing APIs during transitions
2. **Incremental Rollout**: Feature flags for gradual feature enablement
3. **Service-First**: New functionality implemented as services
4. **Test Coverage**: Comprehensive testing for new features

## Contributing Guidelines

### Development Setup

1. **Clone and Install**:

   ```bash
   git clone https://github.com/stepzen-dev/vscode-stepzen.git
   cd vscode-stepzen
   npm install
   ```

2. **Development Commands**:
   ```bash
   npm run compile    # Build extension
   npm run watch      # Watch mode for development
   npm run test       # Run all tests
   npm run lint       # Code quality checks
   ```

### Code Quality Standards

#### Linting and Type Checking

```bash
npm run lint           # ESLint for code style
npm run lint:prune     # Find unused exports
npm run lint:deps      # Check dependencies
npm run check-types    # TypeScript type checking
npm run ci:lint        # All linting (used in CI)
```

#### Code Style

- **TypeScript**: Strict type checking enabled
- **ESLint**: Enforced code style and best practices
- **No Console**: Use logger service instead of console statements
- **Imports**: Organized and properly typed imports

### Architecture Patterns

#### Command Implementation

```typescript
export async function commandName() {
  // 1. Check workspace trust if needed
  if (!vscode.workspace.isTrusted) {
    vscode.window.showWarningMessage(
      "Feature not available in untrusted workspaces"
    );
    return;
  }

  // 2. Validate preconditions
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active editor");
    return;
  }

  // 3. Main logic with error handling
  try {
    // Implementation using services
    services.logger.info("Command started");
    // ... command logic ...
  } catch (err) {
    handleError(err);
  }
}
```

#### Service Implementation

```typescript
export class NewService {
  constructor(private logger: Logger) {}

  public async performOperation(): Promise<Result> {
    this.logger.debug("Starting operation");
    try {
      // Implementation
      this.logger.info("Operation completed");
      return result;
    } catch (err) {
      this.logger.error("Operation failed", err);
      throw err;
    }
  }
}
```

### Testing Requirements

- **New Features**: Must include unit tests
- **Bug Fixes**: Add regression tests
- **Services**: Mock external dependencies
- **Commands**: Test both success and error paths

### Documentation

- **JSDoc**: Document public APIs and complex logic
- **README**: Update feature list and usage instructions
- **Architecture**: Update this document for significant changes

### Pull Request Process

1. **Branch Naming**: `feature/description` or `fix/description`
2. **Commit Messages**: Clear, descriptive commit messages
3. **Testing**: All tests must pass
4. **Linting**: All linting checks must pass
5. **Documentation**: Update relevant documentation

### Getting Help

- **Issues**: Use GitHub issues for bugs and feature requests
- **Discussions**: Use GitHub discussions for questions
- **Code Review**: Maintainers will review all pull requests

---

_Portions of the Content may be generated with the assistance of CursorAI_
