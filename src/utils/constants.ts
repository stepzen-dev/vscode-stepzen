/**
 * Constants used throughout the StepZen Tools extension
 */

// Extension identifiers and names
export const EXTENSION = {
  /** Extension name used for terminal, channel, etc. */
  NAME: "StepZen Tools",
  /** Extension command prefix for all registered commands */
  COMMAND_PREFIX: "stepzen.",
};

// UI component names
export const UI = {
  /** Name for the output channel */
  OUTPUT_CHANNEL_NAME: "StepZen Tools",
  /** Name for terminal instances */
  TERMINAL_NAME: "StepZen Tools",
  /** Name for the diagnostic collection */
  DIAGNOSTIC_COLLECTION_NAME: "StepZen Request Diagnostics",
  /** WebView identifier for schema visualizer */
  SCHEMA_VISUALIZER_VIEW_TYPE: "stepzenSchemaVisualizer",
  /** WebView title for schema visualizer */
  SCHEMA_VISUALIZER_TITLE: "StepZen Schema Visualizer",
};

// File and glob patterns
export const FILE_PATTERNS = {
  /** Pattern to match schema files */
  SCHEMA_FILES: "**/*.{graphql,json}",
  /** Main StepZen schema entry file */
  MAIN_SCHEMA_FILE: "index.graphql",
  /** StepZen config file name */
  CONFIG_FILE: "stepzen.config.json",
};

// Configuration keys
export const CONFIG = {
  /** Debug level config key */
  DEBUG_LEVEL: "stepzen.request.debugLevel",
};

// Log levels
export enum LogLevel {
  ERROR = "ERROR",
  WARN = "WARN",
  INFO = "INFO",
  DEBUG = "DEBUG",
  TRACE = "TRACE",
}

// Timeouts and delays
export const TIMEOUTS = {
  /** Default delay (ms) before cleaning up temporary files */
  FILE_CLEANUP_DELAY_MS: 5000,
};

// GraphQL related constants
export const GRAPHQL = {
  /** Root GraphQL operation types */
  ROOT_OPERATION_TYPES: ["Query", "Mutation", "Subscription"],
  /** Scalar types */
  SCALAR_TYPES: ["String", "Int", "Float", "Boolean", "ID"],
};

// API versioning
export const API = {
  /** API version for extension API */
  VERSION: "0.1.0",
};