/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as crypto from "crypto";
import { StepZenResponse, StepZenConfig } from "../types";
import { ValidationError, NetworkError } from "../errors";
import { Logger } from "./logger";
import { FILE_PATTERNS } from "../utils/constants";

/**
 * Request options for StepZen GraphQL requests
 */
interface RequestOptions {
  /** GraphQL query text for file-based requests */
  queryText?: string;
  /** Document content for persisted document requests */
  documentContent?: string;
  /** Name of the operation to execute */
  operationName?: string;
  /** Variable arguments (--var, --var-file) */
  varArgs?: string[];
  /** Debug level for the request */
  debugLevel?: number;
}

/**
 * Parsed variables from varArgs
 */
interface ParsedVariables {
  /** Variables as key-value pairs */
  variables: Record<string, any>;
}

/**
 * StepZen configuration with endpoint details
 */
interface EndpointConfig {
  /** GraphQL endpoint URL */
  graphqlUrl: string;
  /** API key for authentication */
  apiKey: string;
}

/**
 * Service for handling StepZen GraphQL requests
 * Handles HTTP requests to StepZen API and variable parsing
 */
export class RequestService {
  constructor(private logger: Logger) {}

  /**
   * Parse variable arguments into a variables object
   * Supports both --var name=value and --var-file path formats
   * 
   * @param varArgs Array of variable arguments
   * @returns Parsed variables object
   */
  public parseVariables(varArgs: string[]): ParsedVariables {
    const variables: Record<string, any> = {};

    if (!Array.isArray(varArgs)) {
      throw new ValidationError("Invalid variable arguments: expected an array", "INVALID_VAR_ARGS");
    }

    for (let i = 0; i < varArgs.length; i += 2) {
      if (varArgs[i] === "--var" && i + 1 < varArgs.length) {
        const varString = varArgs[i + 1];
        const equalIndex = varString.indexOf("=");
        
        if (equalIndex === -1) {
          this.logger.warn(`Invalid variable format: ${varString} (missing =)`);
          continue;
        }
        
        const name = varString.substring(0, equalIndex);
        const value = varString.substring(equalIndex + 1);
        
        if (name && value !== undefined) {
          variables[name] = value;
          this.logger.debug(`Setting variable ${name}=${value}`);
        } else {
          this.logger.warn(`Invalid variable format: ${varString}`);
        }
      } else if (varArgs[i] === "--var-file" && i + 1 < varArgs.length) {
        const varFilePath = varArgs[i + 1];
        this.logger.debug(`Reading variables from file: ${varFilePath}`);
        
        if (!fs.existsSync(varFilePath)) {
          throw new ValidationError(`Variables file not found: ${varFilePath}`, "VAR_FILE_NOT_FOUND");
        }
        
        try {
          const fileContent = fs.readFileSync(varFilePath, "utf8");
          const fileVars = JSON.parse(fileContent);
          this.logger.debug(`Loaded ${Object.keys(fileVars).length} variables from file`);
          Object.assign(variables, fileVars);
        } catch (err) {
          throw new ValidationError(
            `Failed to read variables file: ${varFilePath}`,
            "VAR_FILE_READ_ERROR",
            err
          );
        }
      }
    }

    return { variables };
  }

  /**
   * Get the API key from StepZen CLI
   * 
   * @returns Promise resolving to the API key
   */
  public async getApiKey(): Promise<string> {
    try {
      this.logger.debug("Retrieving API key from StepZen CLI");
      
      // Import services here to avoid circular dependency
      const { services } = await import('./index.js');
      
      // Use the CLI service's getApiKey method
      const apiKey = await services.cli.getApiKey();
      
      this.logger.debug("Successfully retrieved API key from CLI service");
      return apiKey;
    } catch (err) {
      throw new ValidationError(
        "Failed to retrieve API key from StepZen CLI",
        "API_KEY_RETRIEVAL_FAILED",
        err
      );
    }
  }

  /**
   * Load StepZen configuration and extract endpoint details
   * 
   * @param projectRoot Path to the StepZen project root
   * @returns Endpoint configuration
   */
  public async loadEndpointConfig(projectRoot: string): Promise<EndpointConfig> {
    const configPath = path.join(projectRoot, FILE_PATTERNS.CONFIG_FILE);
    this.logger.debug(`Looking for config file at: ${configPath}`);

    if (!fs.existsSync(configPath)) {
      throw new ValidationError(
        `StepZen configuration file not found at: ${configPath}`,
        "CONFIG_NOT_FOUND"
      );
    }

    let config: StepZenConfig;
    try {
      const configContent = fs.readFileSync(configPath, "utf8");
      
      if (!configContent) {
        throw new ValidationError("StepZen configuration file is empty", "EMPTY_CONFIG");
      }
      
      config = JSON.parse(configContent);
      
      if (!config || !config.endpoint) {
        throw new ValidationError("Invalid StepZen configuration: missing endpoint", "MISSING_ENDPOINT");
      }
    } catch (err) {
      if (err instanceof ValidationError) {
        throw err;
      }
      throw new ValidationError(
        "Failed to parse StepZen configuration file",
        "CONFIG_PARSE_ERROR",
        err
      );
    }

    // Parse endpoint to validate format
    const endpointParts = config.endpoint.split("/");
    if (endpointParts.length < 2) {
      throw new ValidationError(
        `Invalid StepZen endpoint format: ${config.endpoint}`,
        "INVALID_ENDPOINT_FORMAT"
      );
    }

    // Import services here to avoid circular dependency
    const { services } = await import('./index.js');
    
    // Get account, domain, and API key from the CLI
    const [account, domain, apiKey] = await Promise.all([
      services.cli.getAccount(),
      services.cli.getDomain(),
      this.getApiKey()
    ]);
    
    // Construct the GraphQL endpoint URL using the correct pattern
    const graphqlUrl = `https://${account}.${domain}/${config.endpoint}/graphql`;
    
    this.logger.debug(`Constructed GraphQL URL: ${graphqlUrl}`);

    return { graphqlUrl, apiKey };
  }

  /**
   * Calculate SHA256 hash of document content for persisted documents
   * 
   * @param documentContent The GraphQL document content
   * @returns SHA256 hash in the format "sha256:hash"
   */
  public calculateDocumentHash(documentContent: string): string {
    if (!documentContent || typeof documentContent !== 'string') {
      throw new ValidationError("Invalid document content for hash calculation", "INVALID_DOCUMENT_CONTENT");
    }

    const hash = crypto.createHash('sha256').update(documentContent, 'utf8').digest('hex');
    return `sha256:${hash}`;
  }

  /**
   * Execute a persisted document request via HTTP
   * 
   * @param endpointConfig Endpoint configuration
   * @param documentContent The GraphQL document content (used to calculate hash)
   * @param variables Request variables
   * @param operationName Optional operation name
   * @param headers Optional custom headers
   * @returns Promise resolving to StepZen response
   */
  public async executePersistedDocumentRequest(
    endpointConfig: EndpointConfig,
    documentContent: string,
    variables: Record<string, any>,
    operationName?: string,
    headers?: Record<string, string>,
  ): Promise<StepZenResponse> {
    this.logger.info("Making HTTP request to StepZen API for persisted document");

    // Calculate the document hash as required by StepZen persisted documents
    const documentId = this.calculateDocumentHash(documentContent);
    this.logger.debug(`Calculated document hash: ${documentId}`);

    const requestBody = {
      documentId,
      operationName,
      variables
    };

    return new Promise<StepZenResponse>((resolve, reject) => {
      const postData = JSON.stringify(requestBody);
      // Use custom headers if provided, otherwise default
      const requestHeaders = headers ? { ...headers, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } : {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': endpointConfig.apiKey ? `Apikey ${endpointConfig.apiKey}` : ''
      };
      // debug log the request details
      this.logger.debug(`Request details: ${JSON.stringify({ headers: requestHeaders })}`);
      this.logger.debug(`Request body: ${postData}`);
      this.logger.debug(`Request URL: ${endpointConfig.graphqlUrl}`);
      const options = {
        method: 'POST',
        headers: requestHeaders
      };
      const req = https.request(endpointConfig.graphqlUrl, options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          try {
            const json = JSON.parse(responseData);
            resolve(json);
          } catch (err) {
            reject(new ValidationError(
              "Failed to parse StepZen response",
              "RESPONSE_PARSE_ERROR",
              err
            ));
          }
        });
      });
      req.on('error', (err) => {
        reject(new NetworkError(
          "Failed to connect to StepZen API",
          "API_CONNECTION_ERROR",
          err
        ));
      });
      req.write(postData);
      req.end();
    });
  }

  /**
   * Validate request options
   * 
   * @param options Request options to validate
   */
  public validateRequestOptions(options: RequestOptions): void {
    if (!options || typeof options !== 'object') {
      throw new ValidationError("Invalid request options provided", "INVALID_OPTIONS");
    }

    const { queryText, documentContent, operationName, varArgs } = options;

    // Validate at least one of queryText or documentContent is provided and valid
    if (documentContent === undefined && (!queryText || typeof queryText !== 'string')) {
      throw new ValidationError("Invalid request: either documentContent or queryText must be provided", "MISSING_QUERY");
    }

    // Validate operationName if provided
    if (operationName !== undefined && typeof operationName !== 'string') {
      throw new ValidationError("Invalid operation name provided", "INVALID_OPERATION_NAME");
    }

    // Validate varArgs is an array
    if (varArgs !== undefined && !Array.isArray(varArgs)) {
      throw new ValidationError("Invalid variable arguments: expected an array", "INVALID_VAR_ARGS");
    }
  }
} 