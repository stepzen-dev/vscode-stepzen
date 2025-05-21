# StepZen Tools for VSCode

This extension adds tools for working with StepZen projects inside Visual Studio Code.

## Features

- **Initialize StepZen Projects**
  Start a new StepZen project with `stepzen.config.json`, sample schema, and operations files.

- **Deploy StepZen Projects**
  Run `stepzen deploy` directly from the Command Palette.

- **Run GraphQL Requests**
  Select a query (or run the entire editor content) and send it via `stepzen request`. Supports multiple operations with a quick operation picker.

- **Code Lens for GraphQL Operations**
  Run GraphQL operations directly from your `.graphql` files with code lens buttons. Supports both regular and persisted operations.

- **Results Panel with Trace View**
  View GraphQL results in a panel with tabs for data, errors, debug information, and a waterfall visualization of operation timing.

- **Open Query Explorer**
  Launch an embedded GraphiQL interface inside VSCode, connected to your deployed StepZen endpoint.

- **Schema Visualizer**
  Visualize your GraphQL schema structure with an interactive diagram showing relationships between types.

- **Go to Definition for Types and Fields**
  Navigate to types or query fields in your StepZen project. Works across multiple included schema files.

- **Add Materializer**
  Quickly add materializer directives to your GraphQL types.

- **Generate Operations**
  Automatically generate GraphQL operations for your schema with correctly typed variables, including proper nullability handling.

## Installation

Choose one of the following installation methods:

### Download Latest Release

1. Download the `.vsix` file from the [Releases page](https://github.com/stepzen-dev/vscode-stepzen/releases/latest)

2. Install the extension into VS Code:
   - Open the Command Palette (`Ctrl+Shift+P`)
   - Choose **Extensions: Install from VSIX...**
   - Select the downloaded `.vsix` file

### Install from Source

1. Build the extension:

   ```bash
   npm install
   npm run compile
   npx @vscode/vsce package
   ```

2. Install the extension into VS Code:
   - Open the Command Palette (`Ctrl+Shift+P`)
   - Choose **Extensions: Install from VSIX...**
   - Select the generated `.vsix` file

## Usage

- **StepZen: Initialize Project**
  Create a new StepZen project with sample files.
  - Choose where to create your project (current folder, subfolder, or new location)
  - Define your endpoint in the format "folder/name" (e.g., dev/myapi)
  - Access created files immediately after initialization

- **StepZen: Deploy Project**
  Deploy the current StepZen project to your StepZen endpoint.

- **StepZen: Run GraphQL Request**
  Run a GraphQL operation via the StepZen CLI.
  - If multiple operations are present, a picker will prompt you.
  - If nothing is selected, the entire editor contents will be sent.

- **CodeLens: Run and Run (persisted)**
  Click the CodeLens buttons above GraphQL operations in files declared in `@sdl(executables: [])` to execute them directly.

- **StepZen: Open Query Explorer**
  Opens an interactive GraphiQL editor directly inside VSCode.
  - Uses your deployed StepZen endpoint and credentials automatically.
  - Live schema introspection is enabled.

- **StepZen: Open Schema Visualizer**
  Opens an interactive visualization of your GraphQL schema.
  - Shows relationships between types in your schema.
  - Click on types to focus and explore their connections.
  - Access via command palette or through CodeLens buttons on type definitions.

- **StepZen: Go to Definition**
  Right-click a type or field inside a `.graphql` file to jump to its definition.

- **StepZen: Add Materializer**
  Right-click on a field in a GraphQL type to add a materializer directive.

- **StepZen: Generate Operations from Schema**
  Creates GraphQL operation files for each query field in the schema and adds them to the executable documents section of the SDL directive.
  - Files are created in an 'operations' directory
  - Each operation includes all available fields (up to 4 levels deep)
  - Query variables are correctly typed with proper nullability (e.g., String, String!, [Int]!, etc.)
  - Arguments match schema definitions exactly, preventing type mismatch errors
  - Existing operations are preserved with timestamped versions
  - Great for creating schema snapshots for testing and validation

## Requirements

- [StepZen CLI](https://stepzen.com/docs/stepzen-cli/install) must be installed and configured.
  (`stepzen whoami` should succeed.)

- Your workspace must contain a `stepzen.config.json` at the root.

## Known Limitations

- Only `.graphql` files are recognized for Go to Definition.
- The extension expects your project to define included schemas via the `@sdl` directive.
- Advanced GraphQL language server features (e.g., full IntelliSense) are not yet implemented.

## Development

### Building

```bash
# Install dependencies
npm install

# Build the extension
npm run compile

# Watch for changes during development
npm run watch
```

### Testing

The extension uses the standard VS Code testing framework with Mocha. The tests are located in the `src/test` directory. View the README.md file in that directory for more details.

#### Running Tests

To run tests, use the following commands:

```bash
# Compile the tests and run them
npm run test

# Just compile the tests
npm run compile-tests

# Watch for changes in tests
npm run watch-tests
```

The recommended approach for testing during development:

1. Make changes to the extension code
2. Run `npm run compile-tests` to compile the tests
3. Use VS Code's built-in Test Explorer to run and debug tests
4. For CI/CD pipelines, use `npm run test` to run all tests

#### Writing Tests

Tests are written using Mocha's test suite format in TypeScript. Examples of tests include:

1. **Unit tests** - Test individual functions or components
2. **Integration tests** - Test how components work together
3. **Extension tests** - Test extension commands and functionality

A simple test follows this pattern:

```typescript
import * as assert from "assert";
import * as vscode from "vscode";

suite("Your Test Suite Name", () => {
  test("Your Test Name", () => {
    // Your test code here
    assert.strictEqual(actual, expected);
  });
});
```

All tests will be automatically compiled to the `out/test` directory and run by the VS Code test runner.

For more detailed information about testing, including how to mock services in tests, please refer to the [test directory README](src/test/README.md).


## Feedback

Feel free to open issues or suggest improvements!
