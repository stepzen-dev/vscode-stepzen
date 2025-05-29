/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as vscode from "vscode";
import { services } from "../services";
import { handleError } from "../errors";
import { DatabaseImportConfig, DatabaseType } from "../types/import";

/**
 * Command to import a database schema
 */
export async function importDatabase(): Promise<void> {
  try {
    services.logger.info("Starting database import");

    // 1. Check workspace trust
    if (!vscode.workspace.isTrusted) {
      vscode.window.showWarningMessage(
        "Import features not available in untrusted workspaces"
      );
      return;
    }

    // 2. Collect database configuration from user
    const config = await collectDatabaseConfiguration();
    if (!config) {
      services.logger.info("Database import cancelled by user");
      return;
    }

    // 3. Execute the import using the generalized import service
    const result = await services.import.executeImport(config);

    // 4. Handle results
    if (result.success) {
      vscode.window.showInformationMessage(
        `Database schema imported successfully to ${result.targetDir}/${result.schemaName}`
      );
      
      // TODO: Offer Phase 2 functional enhancements
      // await offerFunctionalEnhancements(result);
    } else {
      vscode.window.showErrorMessage(`Import failed: ${result.error}`);
    }

    services.logger.info("Database import completed");
  } catch (err) {
    handleError(err);
  }
}

/**
 * Collect database import configuration from the user through VS Code UI
 */
async function collectDatabaseConfiguration(): Promise<DatabaseImportConfig | undefined> {
  // Step 1: Select database type
  const dbTypeSelection = await vscode.window.showQuickPick(
    [
      { label: "PostgreSQL", description: "PostgreSQL database", value: "postgresql" as DatabaseType },
      { label: "MySQL", description: "MySQL database", value: "mysql" as DatabaseType },
      { label: "IBM Db2", description: "IBM Db2 database", value: "db2" as DatabaseType },
      { label: "Oracle", description: "Oracle database", value: "oracle" as DatabaseType },
      { label: "Snowflake", description: "Snowflake data warehouse", value: "snowflake" as DatabaseType },
      { label: "Presto", description: "Presto SQL query engine", value: "presto" as DatabaseType },
    ],
    {
      placeHolder: "Select database type",
      ignoreFocusOut: true,
    }
  );

  if (!dbTypeSelection) {
    return undefined;
  }

  const dbType = dbTypeSelection.value;

  // Step 2: Choose connection method
  const connectionMethod = await vscode.window.showQuickPick(
    [
      { label: "Connection String", description: "Provide a complete connection string/DSN" },
      { label: "Individual Parameters", description: "Enter host, user, password, etc. separately" }
    ],
    {
      placeHolder: "How would you like to provide connection details?",
      ignoreFocusOut: true,
    }
  );

  if (!connectionMethod) {
    return undefined;
  }

  let connectionConfig = {};
  if (connectionMethod.label === "Connection String") {
    connectionConfig = await collectConnectionString(dbType);
  } else {
    connectionConfig = await collectIndividualParameters(dbType);
  }

  if (!connectionConfig) {
    return undefined;
  }

  // Step 3: Get schema name
  const suggestedName = generateSchemaName(dbType, connectionConfig);
  const name = await vscode.window.showInputBox({
    prompt: "Schema name (folder name for generated files)",
    value: suggestedName,
    placeHolder: `${dbType}_db`,
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value) {
        return "Schema name is required";
      }
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(value)) {
        return "Schema name must start with a letter and contain only letters, numbers, and underscores";
      }
      return undefined;
    }
  });

  if (!name) {
    return undefined;
  }

  // Step 4: Advanced options
  const showAdvanced = await vscode.window.showQuickPick(
    ["No", "Yes"],
    {
      placeHolder: "Configure advanced options?",
      ignoreFocusOut: true,
    }
  );

  let advancedConfig = {};
  if (showAdvanced === "Yes") {
    advancedConfig = await collectAdvancedOptions(dbType);
  }

  // Step 5: Build final configuration
  const config: DatabaseImportConfig = {
    type: dbType,
    name,
    nonInteractive: true, // Always use non-interactive mode
    ...connectionConfig,
    ...advancedConfig,
  };

  return config;
}

/**
 * Collect connection string configuration
 */
async function collectConnectionString(dbType: DatabaseType): Promise<any> {
  const placeholder = getConnectionStringPlaceholder(dbType);
  
  const connectionString = await vscode.window.showInputBox({
    prompt: `Enter ${dbType} connection string`,
    placeHolder: placeholder,
    password: true, // Hide connection string as it may contain credentials
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value) {
        return "Connection string is required";
      }
      return undefined;
    }
  });

  if (!connectionString) {
    return undefined;
  }

  return { connectionString };
}

/**
 * Collect individual connection parameters
 */
async function collectIndividualParameters(dbType: DatabaseType): Promise<any> {
  const config: any = {};

  // Host
  const host = await vscode.window.showInputBox({
    prompt: "Database host (with port if needed)",
    placeHolder: "localhost:5432",
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value) {
        return "Host is required";
      }
      return undefined;
    }
  });

  if (!host) {
    return undefined;
  }
  config.host = host;

  // User
  const user = await vscode.window.showInputBox({
    prompt: "Database user",
    placeHolder: "username",
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value) {
        return "User is required";
      }
      return undefined;
    }
  });

  if (!user) {
    return undefined;
  }
  config.user = user;

  // Password
  const password = await vscode.window.showInputBox({
    prompt: "Database password",
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value) {
        return "Password is required";
      }
      return undefined;
    }
  });

  if (!password) {
    return undefined;
  }
  config.password = password;

  // Database name
  const database = await vscode.window.showInputBox({
    prompt: "Database name",
    placeHolder: "mydb",
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value) {
        return "Database name is required";
      }
      return undefined;
    }
  });

  if (!database) {
    return undefined;
  }
  config.database = database;

  // Schema (optional for some databases)
  if (dbType === 'postgresql' || dbType === 'oracle' || dbType === 'db2') {
    const schema = await vscode.window.showInputBox({
      prompt: "Database schema (optional)",
      placeHolder: "public",
      ignoreFocusOut: true,
    });

    if (schema) {
      config.schema = schema;
    }
  }

  return config;
}

/**
 * Collect advanced configuration options
 */
async function collectAdvancedOptions(dbType: DatabaseType): Promise<any> {
  const options: any = {};

  // Link types with @materializer
  const linkTypes = await vscode.window.showQuickPick(
    ["No", "Yes"],
    {
      placeHolder: "Auto-link related types with @materializer?",
      ignoreFocusOut: true,
    }
  );

  if (linkTypes === "Yes") {
    options.linkTypes = true;
  }

  // Include tables/views
  const include = await vscode.window.showQuickPick(
    [
      { label: "Tables and Views", value: "tables-and-views" },
      { label: "Tables Only", value: "tables-only" },
      { label: "Views Only", value: "views-only" }
    ],
    {
      placeHolder: "What to include in the schema?",
      ignoreFocusOut: true,
    }
  );

  if (include) {
    options.include = include.value;
  }

  // Working directory
  const dir = await vscode.window.showInputBox({
    prompt: "Working directory (optional)",
    placeHolder: "./stepzen",
    ignoreFocusOut: true,
  });

  if (dir) {
    options.dir = dir;
  }

  // Database-specific options
  if (dbType === 'snowflake') {
    const snowflakeOptions = await collectSnowflakeOptions();
    if (snowflakeOptions) {
      options.specificOptions = snowflakeOptions;
    }
  }

  return options;
}

/**
 * Collect Snowflake-specific options
 */
async function collectSnowflakeOptions(): Promise<any> {
  const options: any = {};

  const accountId = await vscode.window.showInputBox({
    prompt: "Snowflake account identifier (optional)",
    placeHolder: "myorg-myaccount",
    ignoreFocusOut: true,
  });

  if (accountId) {
    options.accountId = accountId;
  }

  const warehouse = await vscode.window.showInputBox({
    prompt: "Snowflake warehouse (optional)",
    placeHolder: "COMPUTE_WH",
    ignoreFocusOut: true,
  });

  if (warehouse) {
    options.warehouse = warehouse;
  }

  return Object.keys(options).length > 0 ? options : undefined;
}

/**
 * Generate a schema name from database type and connection info
 */
function generateSchemaName(dbType: DatabaseType, connectionConfig: any): string {
  let name = dbType;
  
  if (connectionConfig.database) {
    name += '_' + connectionConfig.database;
  } else if (connectionConfig.connectionString) {
    // Try to extract database name from connection string
    const dbMatch = connectionConfig.connectionString.match(/\/([^/?]+)/);
    if (dbMatch) {
      name += '_' + dbMatch[1];
    }
  }
  
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Get connection string placeholder for database type
 */
function getConnectionStringPlaceholder(dbType: DatabaseType): string {
  switch (dbType) {
    case 'postgresql':
      return 'postgresql://username:password@localhost:5432/dbname';
    case 'mysql':
      return 'username:password@tcp(localhost:3306)/dbname';
    case 'db2':
      return 'jdbc:db2://host:port/database:user=username;password=password;';
    case 'oracle':
      return 'jdbc:oracle:thin:username/password@//host:port/service';
    case 'snowflake':
      return 'username:password@account_identifier/database/schema?warehouse=warehouse';
    case 'presto':
      return 'protocol://username:password@account_identifier:port/catalog/schema';
    default:
      return 'connection_string';
  }
} 