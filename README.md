# StepZen VS Code Extension

A comprehensive VS Code extension for developing GraphQL APIs with StepZen, featuring intelligent schema management, import capabilities, and development tools.

## Features

### 🚀 Import & Integration

- **cURL Import** - Convert REST endpoints to GraphQL with smart cURL parsing
- **OpenAPI Import** - Generate schemas from OpenAPI specifications
- **GraphQL Import** - Import existing GraphQL endpoints with authentication
- **Database Import** - Connect PostgreSQL, MySQL, Oracle, Snowflake, and more
- **Smart Configuration** - Auto-detect secrets, generate names, validate inputs

### 📊 Schema Management

- **Schema Indexing** - Real-time analysis of GraphQL schemas and directives
- **Type Definitions** - Navigate and explore your schema structure
- **Directive Support** - Full support for StepZen directives (@rest, @dbquery, @graphql, etc.)
- **File Watching** - Automatic updates when schema files change

### 🛠️ Development Tools

- **CLI Integration** - Seamless StepZen CLI command execution
- **Project Management** - Initialize and manage StepZen projects
- **Request Testing** - Execute GraphQL operations directly from VS Code
- **Error Handling** - Comprehensive error reporting and validation

### 🎯 Smart Features

- **Auto-completion** - Intelligent suggestions for StepZen directives
- **Syntax Highlighting** - Enhanced GraphQL syntax support
- **Schema Validation** - Real-time validation of schema files
- **Quick Actions** - Context-aware commands and shortcuts

## Quick Start

### Installation

1. Install the extension from the VS Code Marketplace
2. Ensure you have the [StepZen CLI](https://stepzen.com/docs/quick-start) installed
3. Open a workspace and start building GraphQL APIs

### Import Your First API

#### Import a REST API

```bash
# Command Palette: "StepZen: Import cURL"
# Paste your cURL command or endpoint URL
curl -H "Authorization: Bearer token" https://api.github.com/user
```

#### Import a Database

```bash
# Command Palette: "StepZen: Import Database"
# Select database type and provide connection details
postgresql://user:pass@localhost:5432/mydb
```

#### Import GraphQL Endpoint

```bash
# Command Palette: "StepZen: Import GraphQL"
# Provide endpoint and authentication
https://api.github.com/graphql
```

#### Import OpenAPI Specification

```bash
# Command Palette: "StepZen: Import OpenAPI"
# Select local file or provide URL
https://petstore.swagger.io/v2/swagger.json
```

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

### Utility Commands

- `StepZen: Generate Operations` - Create sample GraphQL operations
- `StepZen: Validate Schema` - Check schema for errors
- `StepZen: Show Logs` - View extension logs and debugging info

## Import Features

### Smart cURL Parsing

- **Auto-detection** of authentication headers and secrets
- **Path parameter** extraction and configuration
- **Query name generation** from URL paths
- **Schema naming** from hostnames

### Database Integration

- **Multiple database types**: PostgreSQL, MySQL, IBM Db2, Oracle, Snowflake, Presto
- **Flexible connection**: Connection strings or individual parameters
- **Auto-linking**: Automatic `@materializer` relationships
- **Advanced options**: Schema selection, table filtering, custom naming

### Authentication Support

- **Bearer tokens** for API authentication
- **API key headers** with custom header names
- **Basic authentication** with username/password
- **Custom headers** for proprietary auth schemes
- **Secret management** with automatic detection and secure storage

### Configuration Options

- **Working directories** for organized project structure
- **Schema naming** with validation and suggestions
- **Type prefixes** to avoid naming conflicts
- **Advanced settings** for fine-tuned control

## Architecture

The extension follows a layered architecture with clear separation of concerns:

```
Extension Layer (Commands, Panels, Utils)
    ↓
Service Registry (CLI, Logger, Import, SchemaIndex, Request)
    ↓
Schema Processing Layer (Indexer, Linker, Parser)
    ↓
Types (Pure data structures)
```

### Key Services

- **ImportService** - Handles all import operations with type-specific builders
- **SchemaIndexService** - Real-time schema analysis and indexing
- **StepzenCliService** - CLI integration and command execution
- **Logger** - Comprehensive logging and debugging
- **RequestService** - GraphQL request execution

## Configuration

### Extension Settings

```json
{
  "stepzen.cliPath": "/path/to/stepzen",
  "stepzen.logLevel": "info",
  "stepzen.autoValidate": true,
  "stepzen.defaultWorkingDir": "./stepzen"
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

---

_Portions of the Content may be generated with the assistance of CursorAI_
