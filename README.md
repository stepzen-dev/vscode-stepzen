# StepZen VS Code Extension

A VS Code extension for developing GraphQL APIs with StepZen, featuring intelligent schema management, import capabilities, and development tools.

## Features

### Import and Integration

- **cURL Import** - Convert REST endpoints to GraphQL with smart cURL parsing
- **OpenAPI Import** - Generate schemas from OpenAPI specifications
- **GraphQL Import** - Import existing GraphQL endpoints with authentication
- **Database Import** - Connect PostgreSQL, MySQL, Oracle, Snowflake, and more
- **Smart Configuration** - Auto-detect secrets, generate names, validate inputs

### Schema Management

- **Schema Indexing** - Real-time analysis of GraphQL schemas and directives
- **Type Definitions** - Navigate and explore your schema structure
- **Directive Support** - Full support for StepZen directives (@rest, @dbquery, @graphql, etc.)
- **File Watching** - Automatic updates when schema files change

### Development Tools

- **CLI Integration** - Seamless StepZen CLI command execution
- **Project Management** - Initialize and manage StepZen projects
- **Request Testing** - Execute GraphQL operations directly from VS Code
- **Error Handling** - Comprehensive error reporting and validation

### Smart Features

- **Auto-completion** - Intelligent suggestions for StepZen directives
- **Syntax Highlighting** - Enhanced GraphQL syntax support
- **Schema Validation** - Real-time validation of schema files
- **GraphQL Linting** - Comprehensive GraphQL schema linting with custom rules
- **Quick Actions** - Context-aware commands and shortcuts

## Quick Start

### Installation

This extension is not published to the VS Code Marketplace. To install it:

1. Download the latest `.vsix` file from the [GitHub Releases](https://github.com/stepzen-dev/vscode-stepzen/releases) page
2. Install it in VS Code using one of these methods:
   - **Command line:** `code --install-extension vscode-stepzen-<version>.vsix`
   - **VS Code UI:** Open the Extensions view, click the `...` menu, and select "Install from VSIX..."
3. Ensure you have the [StepZen CLI](https://stepzen.com/docs/quick-start) installed

### Import Your First API

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run any of the import commands:

- **StepZen: Import cURL** - Paste a cURL command or endpoint URL
- **StepZen: Import Database** - Select a database type and provide connection details
- **StepZen: Import GraphQL** - Provide an endpoint URL and authentication
- **StepZen: Import OpenAPI** - Select a local file or provide a URL

## Commands

### Import Commands

- `StepZen: Import cURL` - Import REST endpoints using cURL syntax
- `StepZen: Import OpenAPI` - Import from OpenAPI/Swagger specifications
- `StepZen: Import GraphQL` - Import existing GraphQL endpoints
- `StepZen: Import Database` - Import database schemas (PostgreSQL, MySQL, etc.)

### Development Commands

- `StepZen: Initialize Project` - Create a new StepZen project
- `StepZen: Deploy Schema` - Deploy your schema to StepZen
- `StepZen: Run GraphQL Request` - Execute GraphQL operations
- `StepZen: Open Schema Visualizer` - Visualize your schema structure
- `StepZen: Lint GraphQL Schema` - Lint GraphQL schema files with custom rules

### Utility Commands

- `StepZen: Generate Operations` - Create sample GraphQL operations
- `StepZen: Validate Schema` - Check schema for errors
- `StepZen: Show Logs` - View extension logs and debugging info

## GraphQL Linting

The extension includes GraphQL schema linting with custom rules. Linting errors and warnings appear in the Problems panel.

Enable automatic linting in your VS Code settings:

```json
{
  "stepzen.autoLintGraphQL": true
}
```

You can also lint manually via the Command Palette with `StepZen: Lint GraphQL Schema`.

## Configuration

### Extension Settings

```json
{
  "stepzen.cliPath": "/path/to/stepzen",
  "stepzen.logLevel": "info",
  "stepzen.autoValidate": true,
  "stepzen.defaultWorkingDir": "./stepzen",
  "stepzen.autoLintGraphQL": false
}
```

### Project Configuration

The extension automatically detects StepZen projects and provides context-aware features based on your `stepzen.config.json` and schema files.

## Development

### Prerequisites

- Node.js 16+
- VS Code 1.74+
- StepZen CLI

### Building from Source

```bash
git clone https://github.com/stepzen-dev/vscode-stepzen
cd vscode-stepzen
npm install
npm run compile
```

### Running Tests

```bash
npm test                    # Run all tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Troubleshooting

### Common Issues

**CLI Not Found**

- Ensure StepZen CLI is installed and in your PATH
- Set `stepzen.cliPath` in VS Code settings if needed

**Import Failures**

- Check network connectivity for remote resources
- Verify authentication credentials
- Review VS Code output panel for detailed error messages

**Schema Validation Errors**

- Ensure GraphQL syntax is correct
- Check StepZen directive usage
- Validate file paths and references

### Getting Help

- Check the [StepZen Documentation](https://stepzen.com/docs)
- Review extension logs in VS Code Output panel
- Report issues on [GitHub](https://github.com/stepzen-dev/vscode-stepzen/issues)

## License

This extension is licensed under the MIT License. See [LICENSE](LICENSE) for details.
