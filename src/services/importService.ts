/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import { Logger } from "./logger";
import { StepzenCliService } from "./cli";
import { 
  ImportConfig, 
  ImportResult, 
  ImportType, 
  ImportCommandBuilder,
  CurlImportConfig,
  OpenApiImportConfig,
  GraphQLImportConfig,
  DatabaseImportConfig
} from "../types/import";
import { ValidationError } from "../errors";

/**
 * Generalized import service that handles all StepZen import types
 */
export class ImportService {
  private builders: Map<ImportType, ImportCommandBuilder> = new Map();

  constructor(
    private logger: Logger,
    private cli: StepzenCliService
  ) {
    this.registerBuilders();
  }

  /**
   * Register command builders for each import type
   */
  private registerBuilders(): void {
    this.builders.set('curl', new CurlCommandBuilder());
    this.builders.set('openapi', new OpenApiCommandBuilder());
    this.builders.set('graphql', new GraphQLCommandBuilder());
    this.builders.set('database', new DatabaseCommandBuilder());
  }

  /**
   * Execute an import command with the given configuration
   */
  async executeImport(config: ImportConfig): Promise<ImportResult> {
    this.logger.info(`Starting ${this.getImportType(config)} import`);

    // Get the appropriate command builder
    const builder = this.getBuilder(config);
    
    // Validate configuration - let validation errors bubble up
    if (!builder.validate(config)) {
      throw new ValidationError(
        "Invalid import configuration",
        "INVALID_CONFIG"
      );
    }

    try {
      // Build CLI arguments
      const args = builder.buildArgs(config);
      this.logger.debug(`CLI args: ${args.join(' ')}`);

      // Execute the CLI command and handle the response
      try {
        const output = await this.cli.spawnProcessWithOutput(args);
        this.logger.debug(`CLI output: ${output}`);
        
        this.logger.info(`${this.getImportType(config)} import completed successfully`);
        return {
          success: true,
          targetDir: config.dir || './stepzen',
          schemaName: config.name,
          files: [] // TODO: Parse CLI output to get generated files
        };
      } catch (cliError: any) {
        this.logger.error(`Import failed: ${cliError.message}`);
        return {
          success: false,
          error: cliError.message
        };
      }
    } catch (err) {
      this.logger.error("Import execution failed", err);
      throw new ValidationError(
        "Import execution failed",
        "IMPORT_FAILED",
        err
      );
    }
  }

  /**
   * Get the appropriate command builder for the configuration
   */
  private getBuilder(config: ImportConfig): ImportCommandBuilder {
    const type = this.getImportType(config);
    const builder = this.builders.get(type);
    
    if (!builder) {
      throw new ValidationError(
        `No builder found for import type: ${type}`,
        "BUILDER_NOT_FOUND"
      );
    }
    
    return builder;
  }

  /**
   * Determine the import type from the configuration
   */
  private getImportType(config: ImportConfig): ImportType {
    // Check for database import first (has 'type' property)
    if ('type' in config) {
      return 'database';
    }
    
    // Check for OpenAPI import (has 'spec' property)
    if ('spec' in config) {
      return 'openapi';
    }
    
    // Both cURL and GraphQL have 'endpoint', so we need to distinguish them
    if ('endpoint' in config) {
      // Check for cURL-specific properties
      const curlConfig = config as CurlImportConfig;
      if (curlConfig.pathParams || 
          curlConfig.suggestedName || 
          curlConfig.suggestedQueryName ||
          curlConfig.queryName) {
        return 'curl';
      }
      
      // If it has endpoint but no cURL-specific properties, assume GraphQL
      return 'graphql';
    }
    
    throw new ValidationError(
      "Unable to determine import type from configuration",
      "UNKNOWN_IMPORT_TYPE"
    );
  }
}

/**
 * Command builder for cURL imports
 */
class CurlCommandBuilder implements ImportCommandBuilder {
  getType(): ImportType {
    return 'curl';
  }

  validate(config: ImportConfig): boolean {
    const curlConfig = config as CurlImportConfig;
    return !!curlConfig.endpoint && curlConfig.endpoint.trim().length > 0;
  }

  buildArgs(config: ImportConfig): string[] {
    const curlConfig = config as CurlImportConfig;
    const args = ['import', 'curl'];

    // Add endpoint (required)
    args.push(curlConfig.endpoint);

    // Add common flags
    this.addCommonFlags(args, curlConfig);

    // Add authentication flags
    this.addAuthFlags(args, curlConfig);

    // Add schema customization flags
    this.addSchemaFlags(args, curlConfig);

    // Add cURL-specific flags
    if (curlConfig.pathParams) {
      args.push('--path-params', curlConfig.pathParams);
    }

    return args;
  }

  private addCommonFlags(args: string[], config: CurlImportConfig): void {
    if (config.dir) {
      args.push('--dir', config.dir);
    }
    if (config.name) {
      args.push('--name', config.name);
    }
    if (config.nonInteractive) {
      args.push('--non-interactive');
    }
  }

  private addAuthFlags(args: string[], config: CurlImportConfig): void {
    if (config.headers) {
      config.headers.forEach(header => {
        args.push('-H', `${header.name}: ${header.value}`);
      });
    }

    if (config.headerParams) {
      config.headerParams.forEach(param => {
        args.push('--header-param', `${param.name}: ${param.value}`);
      });
    }

    if (config.secrets) {
      config.secrets.forEach(secret => {
        args.push('--secrets', secret);
      });
    }
  }

  private addSchemaFlags(args: string[], config: CurlImportConfig): void {
    if (config.prefix) {
      args.push('--prefix', config.prefix);
    }
    if (config.queryName) {
      args.push('--query-name', config.queryName);
    }
    if (config.queryType) {
      args.push('--query-type', config.queryType);
    }
  }
}

/**
 * Command builder for OpenAPI imports
 */
class OpenApiCommandBuilder implements ImportCommandBuilder {
  getType(): ImportType {
    return 'openapi';
  }

  validate(config: ImportConfig): boolean {
    const openApiConfig = config as OpenApiImportConfig;
    return !!openApiConfig.spec && openApiConfig.spec.trim().length > 0;
  }

  buildArgs(config: ImportConfig): string[] {
    const openApiConfig = config as OpenApiImportConfig;
    const args = ['import', 'openapi'];

    // Add spec file/URL (required)
    args.push(openApiConfig.spec);

    // Add common flags
    if (openApiConfig.dir) {
      args.push('--dir', openApiConfig.dir);
    }
    if (openApiConfig.name) {
      args.push('--name', openApiConfig.name);
    }
    if (openApiConfig.nonInteractive) {
      args.push('--non-interactive');
    }

    return args;
  }
}

/**
 * Command builder for GraphQL imports
 */
class GraphQLCommandBuilder implements ImportCommandBuilder {
  getType(): ImportType {
    return 'graphql';
  }

  validate(config: ImportConfig): boolean {
    const graphqlConfig = config as GraphQLImportConfig;
    return !!graphqlConfig.endpoint && graphqlConfig.endpoint.trim().length > 0;
  }

  buildArgs(config: ImportConfig): string[] {
    const graphqlConfig = config as GraphQLImportConfig;
    const args = ['import', 'graphql'];

    // Add endpoint (required)
    args.push(graphqlConfig.endpoint);

    // Add common flags
    if (graphqlConfig.dir) {
      args.push('--dir', graphqlConfig.dir);
    }
    if (graphqlConfig.name) {
      args.push('--name', graphqlConfig.name);
    }
    if (graphqlConfig.nonInteractive) {
      args.push('--non-interactive');
    }

    // Add authentication flags (same as cURL)
    if (graphqlConfig.headers) {
      graphqlConfig.headers.forEach(header => {
        args.push('-H', `${header.name}: ${header.value}`);
      });
    }

    if (graphqlConfig.headerParams) {
      graphqlConfig.headerParams.forEach(param => {
        args.push('--header-param', `${param.name}: ${param.value}`);
      });
    }

    if (graphqlConfig.secrets) {
      graphqlConfig.secrets.forEach(secret => {
        args.push('--secrets', secret);
      });
    }

    // Add schema customization flags
    if (graphqlConfig.prefix) {
      args.push('--prefix', graphqlConfig.prefix);
    }

    return args;
  }
}

/**
 * Command builder for database imports
 */
class DatabaseCommandBuilder implements ImportCommandBuilder {
  getType(): ImportType {
    return 'database';
  }

  validate(config: ImportConfig): boolean {
    const dbConfig = config as DatabaseImportConfig;
    return !!dbConfig.type && (!!dbConfig.connectionString || !!dbConfig.host);
  }

  buildArgs(config: ImportConfig): string[] {
    const dbConfig = config as DatabaseImportConfig;
    const args = ['import', dbConfig.type];

    // Add connection string if provided
    if (dbConfig.connectionString) {
      args.push(dbConfig.connectionString);
    }

    // Add common flags
    if (dbConfig.dir) {
      args.push('--dir', dbConfig.dir);
    }
    if (dbConfig.name) {
      args.push('--name', dbConfig.name);
    }
    if (dbConfig.nonInteractive) {
      args.push('--non-interactive');
    }

    // Add database connection flags
    if (dbConfig.host) {
      args.push('--db-host', dbConfig.host);
    }
    if (dbConfig.user) {
      args.push('--db-user', dbConfig.user);
    }
    if (dbConfig.password) {
      args.push('--db-password', dbConfig.password);
    }
    if (dbConfig.database) {
      args.push('--db-database', dbConfig.database);
    }
    if (dbConfig.schema) {
      args.push('--db-schema', dbConfig.schema);
    }

    // Add database-specific flags
    if (dbConfig.linkTypes) {
      args.push('--db-link-types');
    }
    if (dbConfig.include) {
      args.push('--db-include', dbConfig.include);
    }
    if (dbConfig.useDeprecatedNaming) {
      args.push('--db-use-deprecated-2022-naming');
    }

    // Add database-specific options
    if (dbConfig.type === 'snowflake' && dbConfig.specificOptions) {
      const snowflakeOptions = dbConfig.specificOptions;
      if (snowflakeOptions.accountId) {
        args.push('--snowflake-account-id', snowflakeOptions.accountId);
      }
      if (snowflakeOptions.warehouse) {
        args.push('--snowflake-warehouse', snowflakeOptions.warehouse);
      }
    }

    return args;
  }
} 