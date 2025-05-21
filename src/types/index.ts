/**
 * Type definitions for StepZen Tools
 * Contains common interfaces used throughout the extension
 */

/**
 * StepZen configuration file structure
 * Located at stepzen.config.json in the project root
 */
export interface StepZenConfig {
  /** Endpoint path for the StepZen deployment */
  endpoint: string;
  
  /** Optional name for the project */
  name?: string;
  
  /** Optional schema configuration */
  schema?: {
    /** Root schema file path */
    rootSchema?: string;
    
    /** Schema directory path */
    dir?: string;
  };
  
  /** Optional configuration for StepZen CLI */
  config?: {
    /** Default values for CLI operations */
    defaults?: Record<string, string>;
  };
}

/**
 * StepZen diagnostic information structure
 * Included in GraphQL responses for debugging and tracing
 */
export interface StepZenDiagnostic {
  /** Description of the diagnostic */
  message: string;
  
  /** Severity level (error, warning, info, etc.) */
  severity: string;
  
  /** Source of the diagnostic (schema, resolver, etc.) */
  source?: string;
  
  /** Field path in the GraphQL query */
  path?: string[];
  
  /** Field name the diagnostic relates to */
  fieldName?: string;
  
  /** Document hash for persisted operations */
  documentHash?: string;
  
  /** Span ID for tracing correlation */
  spanID?: string;
  
  /** Location information for source mapping */
  location?: {
    /** File URI */
    uri?: string;
    
    /** Position range in the file */
    range?: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  };
  
  /** HTTP response information */
  response?: {
    /** HTTP status code */
    statusCode?: number;
    /** Alternative field for HTTP status code */
    status_code?: number;
    /** Response headers */
    headers?: Record<string, string>;
  };
  
  /** Performance metrics */
  duration?: number;
  
  /** Execution information */
  execution?: {
    /** Duration in nanoseconds */
    duration?: number;
    /** Start time */
    startTime?: string;
    /** Other execution details */
    details?: Record<string, unknown>;
  };
  
  /** Preparation information */
  prepare?: {
    /** Duration in nanoseconds */
    duration?: number;
    /** Other preparation details */
    details?: Record<string, unknown>;
  };
  
  /** OpenTelemetry data */
  otel?: {
    /** Trace information */
    traces?: {
      /** Resource spans */
      resourceSpans?: Array<{
        /** Scope spans */
        scopeSpans?: Array<{
          /** Individual spans */
          spans?: Array<{
            /** Span ID */
            spanId: string;
            /** Span name */
            name: string;
            /** Parent span ID */
            parentSpanId?: string;
            /** Start time in nanoseconds since epoch */
            startTimeUnixNano?: string;
            /** End time in nanoseconds since epoch */
            endTimeUnixNano?: string;
            /** Span attributes */
            attributes?: Array<{
              /** Attribute key */
              key: string;
              /** Attribute value */
              value: { 
                /** Integer value */
                intValue?: number;
                /** String value */
                stringValue?: string;
                /** Boolean value */
                boolValue?: boolean;
              };
            }>;
          }>;
        }>;
      }>;
    };
  };
}

/**
 * GraphQL error structure
 * Standard GraphQL error format
 */
interface GraphQLError {
  /** Error message */
  message: string;
  
  /** Locations in the GraphQL document where the error occurred */
  locations?: Array<{ line: number; column: number }>;
  
  /** Path in the query/response where the error occurred */
  path?: string[];
  
  /** Additional error details */
  extensions?: Record<string, unknown>;
}

/**
 * StepZen GraphQL response structure
 * Follows the standard GraphQL response format with StepZen-specific extensions
 */
export interface StepZenResponse {
  /** Response data object */
  data?: Record<string, unknown>;
  
  /** GraphQL errors */
  errors?: GraphQLError[];
  
  /** Response extensions */
  extensions?: {
    /** StepZen-specific extension data */
    stepzen?: {
      /** Diagnostic information for debugging and monitoring */
      diagnostics?: StepZenDiagnostic[];
      
      /** Authentication information */
      auth?: {
        /** Authorization method used */
        method?: string;
        /** User information */
        user?: string;
      };
      
      /** Request information */
      request?: {
        /** Request ID */
        id?: string;
        /** Operation name */
        operationName?: string;
        /** Persisted document ID */
        documentId?: string;
      };
      
      /** Performance information */
      performance?: {
        /** Total duration in milliseconds */
        totalDurationMs?: number;
        /** Parse duration in milliseconds */
        parseDurationMs?: number;
        /** Validation duration in milliseconds */
        validationDurationMs?: number;
        /** Execution duration in milliseconds */
        executionDurationMs?: number;
      };
    };
    
    /** Cache information */
    cache?: {
      /** Cache status (hit, miss, etc.) */
      status?: string;
      /** Cache key */
      key?: string;
      /** Time-to-live in seconds */
      ttl?: number;
    };
  };
}
