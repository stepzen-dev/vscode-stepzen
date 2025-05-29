/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

/**
 * Base configuration common to all import types
 */
// ts-prune-ignore-next
export interface BaseImportConfig {
  /** Working directory for the import */
  dir?: string;
  /** Subfolder name for generated schema files */
  name?: string;
  /** Disable interactive prompts */
  nonInteractive?: boolean;
}

/**
 * Authentication configuration for REST/GraphQL imports
 */
// ts-prune-ignore-next
export interface AuthConfig {
  /** Request headers */
  headers?: Array<{ name: string; value: string }>;
  /** Parameterized headers with placeholders */
  headerParams?: Array<{ name: string; value: string }>;
  /** Headers to treat as secrets */
  secrets?: string[];
}

/**
 * Schema customization options
 */
// ts-prune-ignore-next
export interface SchemaCustomization {
  /** Prefix for generated types */
  prefix?: string;
  /** Custom query field name */
  queryName?: string;
  /** Custom return type name */
  queryType?: string;
}

/**
 * Database connection configuration
 */
// ts-prune-ignore-next
export interface DatabaseConfig {
  /** Connection string/DSN */
  connectionString?: string;
  /** Database host */
  host?: string;
  /** Database user */
  user?: string;
  /** Database password */
  password?: string;
  /** Database name */
  database?: string;
  /** Database schema */
  schema?: string;
  /** Auto-link types with @materializer */
  linkTypes?: boolean;
  /** Include tables, views, or both */
  include?: 'tables-only' | 'views-only' | 'tables-and-views';
  /** Use deprecated 2022 naming convention */
  useDeprecatedNaming?: boolean;
}

/**
 * cURL-specific configuration
 */
export interface CurlImportConfig extends BaseImportConfig, AuthConfig, SchemaCustomization {
  /** The cURL command or endpoint URL */
  endpoint: string;
  /** Path parameters configuration */
  pathParams?: string;
  /** Request body data for POST/PUT/PATCH requests */
  data?: string;
  /** HTTP method (GET, POST, PUT, PATCH, DELETE) */
  method?: string;
  /** Suggested schema name (for UI) */
  suggestedName?: string;
  /** Suggested query name (for UI) */
  suggestedQueryName?: string;
}

/**
 * OpenAPI-specific configuration
 */
export interface OpenApiImportConfig extends BaseImportConfig {
  /** OpenAPI spec file path or URL */
  spec: string;
}

/**
 * GraphQL-specific configuration
 */
export interface GraphQLImportConfig extends BaseImportConfig, AuthConfig, SchemaCustomization {
  /** GraphQL endpoint URL */
  endpoint: string;
}

/**
 * Snowflake-specific additional options
 */
// ts-prune-ignore-next
export interface SnowflakeConfig {
  /** Snowflake account identifier */
  accountId?: string;
  /** Snowflake warehouse */
  warehouse?: string;
}

/**
 * Database-specific configuration with database type
 */
export interface DatabaseImportConfig extends BaseImportConfig, DatabaseConfig {
  /** Database type */
  type: DatabaseType;
  /** Database-specific options */
  specificOptions?: SnowflakeConfig; // Only Snowflake has specific options currently
}

/**
 * Supported database types
 */
export type DatabaseType = 
  | 'postgresql' 
  | 'mysql' 
  | 'db2' 
  | 'oracle' 
  | 'snowflake' 
  | 'presto';

/**
 * Union type for all import configurations
 */
export type ImportConfig = 
  | CurlImportConfig 
  | OpenApiImportConfig 
  | GraphQLImportConfig 
  | DatabaseImportConfig;

/**
 * Import command type discriminator
 */
export type ImportType = 'curl' | 'openapi' | 'graphql' | 'database';

/**
 * Result of an import operation
 */
export interface ImportResult {
  /** Whether the import was successful */
  success: boolean;
  /** Error message if import failed */
  error?: string;
  /** Generated files */
  files?: string[];
  /** Target directory */
  targetDir?: string;
  /** Schema name */
  schemaName?: string;
}

/**
 * Import command builder interface
 */
export interface ImportCommandBuilder {
  /** Build CLI arguments for the import command */
  buildArgs(config: ImportConfig): string[];
  /** Validate the configuration */
  validate(config: ImportConfig): boolean;
  /** Get the import type */
  getType(): ImportType;
} 