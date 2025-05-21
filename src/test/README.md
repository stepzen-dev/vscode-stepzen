# Testing Structure for StepZen VS Code Extension

This directory contains tests for the StepZen VS Code extension. The tests are organized in a way that mirrors the source code structure to make it easy to locate and maintain tests.

## Directory Structure

```
src/test/
├── unit/           # Unit tests for individual components
│   ├── utils/      # Tests for utility functions
│   └── ...         # Other unit tests organized by source directory
├── integration/    # Integration tests that test multiple components together
├── fixtures/       # Test data and mock objects
├── helpers/        # Shared test utilities and helper functions
└── extension.test.ts  # Top-level extension tests
```

## Test Organization

- **Unit Tests**: Test individual components in isolation. These are organized in the same structure as the source code.
- **Integration Tests**: Test how multiple components work together.
- **Fixtures**: Reusable test data and mock objects.
- **Helpers**: Shared test utilities and functions for setting up tests.

## Running Tests

Tests can be run using the following npm commands:

```
npm test                                # Run all tests
npm test -- --coverage --maxWorkers=2   # Run tests with coverage reports
```

## Test Naming Conventions

- Test files should be named with the `.test.ts` suffix.
- Use descriptive suite and test names that explain what functionality is being tested.

## Coverage Requirements

We aim for 100% statement, branch, and function coverage for all utility functions.

## Writing Good Tests

1. Tests should be independent and not rely on the state from other tests.
2. Use descriptive assertion messages to make test failures clear.
3. Use the test helpers where appropriate to reduce boilerplate code.
4. Consider edge cases and error conditions, not just the happy path.

## Mocking Services in Tests

The extension uses a dependency injection container for services (CLI, logger, etc.) that makes them easily mockable in tests:

```typescript
import { services, setMockServices, overrideServices } from "../../services";
import { createMock } from "../helpers/test-utils";

suite("Your Test Suite with Mocked Services", () => {
  // Mock the entire service registry
  test("Using complete service mocks", () => {
    // Create mock services
    const mockServices = {
      cli: createMock({
        deploy: async () => { /* mock implementation */ },
        request: async () => "mock response"
      }),
      logger: createMock({
        info: () => { /* mock implementation */ },
        error: () => { /* mock implementation */ }
      })
    };
    
    // Replace all services with mocks
    const origServices = setMockServices(mockServices);
    
    try {
      // Your test code using services.cli and services.logger
      // The mocked implementations will be used
    } finally {
      // Restore original services after the test
      setMockServices(origServices);
    }
  });
  
  // Override specific services only
  test("Using partial service overrides", () => {
    // Create a partial override
    const mockCli = createMock({
      deploy: async () => { /* mock implementation */ }
    });
    
    // Replace only the CLI service
    const prevServices = overrideServices({ cli: mockCli });
    
    try {
      // Your test code that uses services.cli
      // services.logger is still the original implementation
    } finally {
      // Restore original services
      resetServices(prevServices);
    }
  });
});
```