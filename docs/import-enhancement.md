<!--
Copyright IBM Corp. 2025
Assisted by CursorAI
-->

# Import Enhancement System

The Import Enhancement System provides VS Code integration for StepZen CLI import commands, followed by intelligent functional enhancements to transform basic schemas into production-ready GraphQL APIs.

## Overview

StepZen CLI provides four core import capabilities:

- `stepzen import curl` - REST endpoints
- `stepzen import openapi` - OpenAPI specifications
- `stepzen import graphql` - GraphQL endpoints
- `stepzen import <database>` - Database connections

The VS Code extension enhances this workflow by:

1. **Phase 1:** Providing intuitive UI for CLI import commands
2. **Phase 2:** Adding functional enhancements to improve generated schemas

## Architecture

### Two-Phase Development Approach

```
Phase 1: CLI Integration → Phase 2: Functional Enhancements → Production Ready
```

**Phase 1: CLI Integration (Priority)**

- Implement UI for all four import types
- Parse user input and execute CLI commands
- Handle CLI output and error reporting
- Provide seamless VS Code experience

**Phase 2: Functional Enhancements (Future)**

- Analyze generated schemas for improvement opportunities
- Apply functional enhancements (pagination, field naming, etc.)
- Cross-directive intelligence and optimization

## Phase 1: Core Import Commands

### Import Command Structure

Following the established architecture patterns, we'll implement four core import commands:

```typescript
// src/utils/constants.ts - Command constants
export const COMMANDS = {
  // ... existing commands
  IMPORT_CURL: "stepzen.importCurl",
  IMPORT_OPENAPI: "stepzen.importOpenapi",
  IMPORT_GRAPHQL: "stepzen.importGraphql",
  IMPORT_DATABASE: "stepzen.importDatabase",
} as const;
```

### CLI Options Research

Before implementing the UI for each import type, we need to research the available CLI options:

```bash
# Research each import command's capabilities
stepzen import curl --help
stepzen import openapi --help
stepzen import graphql --help
stepzen import postgresql --help
stepzen import mysql --help
# ... other database types
```

This will help us understand:

- **Required vs optional parameters** for each import type
- **Common patterns** across different import commands
- **Database-specific options** and their variations
- **Naming and configuration flags** that should be exposed in the UI

### 1. Import cURL (`stepzen import curl`)

**Key Features:**

- Parse cURL commands from user input
- Auto-generate schema names from URLs
- Auto-detect secrets in headers
- Smart field naming (nouns, not verbs)

**UI Flow:**

```
User Input: cURL command
↓
Parse & Configure: Auto-generate names, detect secrets
↓
Execute CLI: stepzen import curl with generated flags
↓
Success: Schema files created, offer Phase 2 enhancements
```

**Implementation:**

```typescript
// src/commands/importCurl.ts
export async function importCurl() {
  try {
    services.logger.info("Starting cURL import");

    // 1. Check workspace trust
    if (!vscode.workspace.isTrusted) {
      vscode.window.showWarningMessage(
        "Import features not available in untrusted workspaces"
      );
      return;
    }

    // 2. Collect cURL command and configuration
    const importConfig = await collectCurlParameters();
    if (!importConfig) {
      services.logger.info("cURL import cancelled by user");
      return;
    }

    // 3. Execute CLI import
    const cliArgs = buildCurlImportArgs(importConfig);
    const result = await services.cli.spawnProcessWithOutput([
      "import",
      "curl",
      ...cliArgs,
    ]);

    // 4. Handle results
    if (result.success) {
      vscode.window.showInformationMessage(
        `Schema imported successfully to ${importConfig.name}`
      );
      // Future: Offer Phase 2 enhancements
      // await offerFunctionalEnhancements(importConfig.targetFile);
    } else {
      vscode.window.showErrorMessage(`Import failed: ${result.error}`);
    }

    services.logger.info("cURL import completed");
  } catch (err) {
    handleError(err);
  }
}
```

### 2. Import OpenAPI (`stepzen import openapi`)

**Key Features:**

- File picker for OpenAPI specs (JSON/YAML)
- URL input for remote specifications
- Schema name generation from spec metadata
- Prefix and naming configuration

### 3. Import GraphQL (`stepzen import graphql`)

**Key Features:**

- GraphQL endpoint URL input
- Introspection and schema download
- Authentication header configuration
- Prefix handling for type conflicts

### 4. Import Database (`stepzen import <database>`)

**Key Features:**

- Database type selection (postgresql, mysql, etc.)
- Connection string configuration
- Table/schema selection
- Query vs table-based import options

**Database Types to Support:**

- PostgreSQL (`stepzen import postgresql`)
- MySQL (`stepzen import mysql`)
- SQL Server (`stepzen import mssql`)
- Oracle (`stepzen import oracle`)
- And others based on CLI capabilities

## Phase 2: Functional Enhancement System

_Note: This phase will be implemented after Phase 1 is complete_

### Functional Enhancement Categories

Rather than directive-specific enhancements, we'll provide **goal-oriented** functional improvements:

#### Data Access Patterns

- **Add Pagination** - Convert lists to GraphQL connections
- **Add Filtering** - Generate filter input types and logic
- **Add Sorting** - Create sort arguments and backend configuration

#### Schema Quality

- **Improve Field Names** - Convert snake_case, fix semantic naming
- **Add Documentation** - Generate descriptions and examples
- **Optimize Types** - Use built-in scalars, fix nullability

#### API Architecture

- **Connect Related Data** - Add @materializer relationships
- **Configure Authentication** - Move secrets, add auth patterns
- **Optimize Performance** - Configure caching and request optimization

#### Modern Features

- **Add AI Integration** - Configure @tool directives
- **Reshape API** - Transform structures, add computed fields

### Enhancement Detection Engine

```typescript
// src/services/functionalEnhancement.ts
export class FunctionalEnhancementEngine {
  constructor(private logger: Logger) {}

  /**
   * Analyzes schema for functional enhancement opportunities
   * Works across all directive types (@rest, @dbquery, @graphql)
   */
  async analyzeSchema(filePath: string): Promise<EnhancementOpportunity[]> {
    this.logger.info(
      `Analyzing schema for functional enhancements: ${filePath}`
    );

    const opportunities: EnhancementOpportunity[] = [];
    const fieldIndex = services.schemaIndex.getFieldIndex();
    const typeDefinitions = services.schemaIndex.getTypeDefinitions();

    // Detect pagination opportunities
    const paginationOps = this.detectPaginationOpportunities(fieldIndex);
    opportunities.push(...paginationOps);

    // Detect field naming improvements
    const namingOps = this.detectNamingImprovements(typeDefinitions);
    opportunities.push(...namingOps);

    // Detect documentation gaps
    const docOps = this.detectDocumentationOpportunities(typeDefinitions);
    opportunities.push(...docOps);

    return opportunities;
  }

  /**
   * Applies functional enhancements regardless of underlying directive
   */
  async applyEnhancement(
    opportunity: EnhancementOpportunity,
    options: EnhancementOptions
  ): Promise<void> {
    switch (opportunity.type) {
      case "ADD_PAGINATION":
        await this.addPagination(opportunity, options);
        break;
      case "IMPROVE_FIELD_NAMES":
        await this.improveFieldNames(opportunity, options);
        break;
      case "ADD_DOCUMENTATION":
        await this.addDocumentation(opportunity, options);
        break;
      // ... other enhancement types
    }
  }

  private async addPagination(
    opportunity: EnhancementOpportunity,
    options: EnhancementOptions
  ): Promise<void> {
    // Implementation works across @rest, @dbquery, @graphql directives
    // Adds connection types and configures appropriate pagination
  }
}
```
