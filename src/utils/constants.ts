/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

/**
 * Constants used throughout the StepZen Tools extension
 */

// Command IDs
export const COMMANDS = {
  INITIALIZE_PROJECT: "stepzen.initializeProject",
  DEPLOY: "stepzen.deploy",
  RUN_REQUEST: "stepzen.runRequest",
  OPEN_EXPLORER: "stepzen.openExplorer",
  GO_TO_DEFINITION: "stepzen.goToDefinition",
  ADD_MATERIALIZER: "stepzen.addMaterializer",
  RUN_OPERATION: "stepzen.runOperation",
  RUN_PERSISTED: "stepzen.runPersisted",
  CLEAR_RESULTS: "stepzen.clearResults",
  OPEN_SCHEMA_VISUALIZER: "stepzen.openSchemaVisualizer",
  GENERATE_OPERATIONS: "stepzen.generateOperations",
} as const;

// Configuration keys
export const CONFIG_KEYS = {
  LOG_LEVEL: "stepzen.logLevel",
  LOG_TO_FILE: "stepzen.logToFile",
} as const;

// UI component names and identifiers
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
  /** WebView identifier for query explorer */
  EXPLORER_VIEW_TYPE: "stepzenExplorer",
  /** WebView title for query explorer */
  EXPLORER_TITLE: "StepZen Query Explorer",
  /** WebView identifier for results panel */
  RESULTS_PANEL_VIEW_TYPE: "stepzen.results",
  /** WebView title for results panel */
  RESULTS_PANEL_TITLE: "StepZen Request Results",
  /** Extension display name */
  EXTENSION_NAME: "StepZen Tools",
  /** Category name for commands */
  COMMAND_CATEGORY: "StepZen",
} as const;

// File and glob patterns
export const FILE_PATTERNS = {
  /** Pattern to match schema files */
  SCHEMA_FILES: "**/*.{graphql,json}",
  /** Main StepZen schema entry file */
  MAIN_SCHEMA_FILE: "index.graphql",
  /** StepZen config file name */
  CONFIG_FILE: "stepzen.config.json",
  /** Pattern to find config files in workspace */
  CONFIG_FILE_PATTERN: "**/stepzen.config.json",
  /** Log file name */
  LOG_FILE: "stepzen.log",
  /** Operations directory */
  OPERATIONS_DIR: "operations",
  /** Example GraphQL file */
  EXAMPLE_GRAPHQL_FILE: "example.graphql",
} as const;

// Temporary file naming patterns
export const TEMP_FILE_PATTERNS = {
  /** Prefix for temporary query files */
  QUERY_PREFIX: "stepzen-query-",
  /** Prefix for temporary request files */
  REQUEST_PREFIX: "stepzen-request-",
  /** File extension for GraphQL files */
  GRAPHQL_EXTENSION: ".graphql",
} as const;

// Timeouts and delays
export const TIMEOUTS = {
  /** Default delay (ms) before cleaning up temporary files */
  FILE_CLEANUP_DELAY_MS: 5000,
} as const;

// GraphQL related constants
export const GRAPHQL = {
  /** Root GraphQL operation types */
  ROOT_OPERATION_TYPES: ["Query", "Mutation", "Subscription"] as const,
  /** Built-in scalar types */
  SCALAR_TYPES: ["String", "Int", "Float", "Boolean", "ID"] as const,
  /** Operation type patterns for regex matching */
  OPERATION_TYPE_PATTERN: /(query|mutation|subscription)\s+(\w+)/g,
} as const;

// Error codes
export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  CLI_ERROR: "CLI_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  STRING_ERROR: "STRING_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
  INVALID_QUERY: "INVALID_QUERY",
} as const;

// Log levels (enum values)
export const LOG_LEVELS = {
  ERROR: "error",
  WARN: "warn", 
  INFO: "info",
  DEBUG: "debug",
} as const;

// URLs and external links
export const URLS = {
  STEPZEN_CLI_INSTALL: "https://stepzen.com/docs/stepzen-cli/install",
} as const;

// Menu groups
export const MENU_GROUPS = {
  STEPZEN_EXPLORER: "0_stepzen@1",
  STEPZEN_EDITOR_1: "0_stepzen@1",
  STEPZEN_EDITOR_2: "0_stepzen@2", 
  STEPZEN_EDITOR_3: "0_stepzen@3",
} as const;

// Language IDs
export const LANGUAGE_IDS = {
  GRAPHQL: "graphql",
} as const;

// Context when conditions
export const WHEN_CONDITIONS = {
  GRAPHQL_EDITOR_FOCUS: "editorLangId == graphql && editorTextFocus",
} as const;

// Progress messages
export const PROGRESS_MESSAGES = {
  UPLOADING_SCHEMA: "Uploading schema to StepZen...",
} as const;

// User-facing messages
export const MESSAGES = {
  NO_WORKSPACE_OPEN: "No workspace open",
  NO_ACTIVE_EDITOR: "No active editor",
  FEATURE_NOT_AVAILABLE_UNTRUSTED: "Feature not available in untrusted workspaces",
  NO_STEPZEN_PROJECT_FOUND: "No StepZen project (stepzen.config.json) found in workspace.",
  NO_VALID_STEPZEN_PROJECT_PATHS: "No valid StepZen project paths found.",
  OPERATION_CANCELLED_BY_USER: "Operation cancelled by user.",
  PROJECT_DOES_NOT_CONTAIN_INDEX: "does not appear to contain an index.graphql. Commands will be disabled until a valid project is opened.",
  COULD_NOT_LOCATE_PROJECT: "could not locate a StepZen project under",
  FAILED_TO_REGISTER_COMMAND: "Failed to register command",
  STEPZEN_TOOLS_ACTIVATED: "StepZen Tools activated",
  OPEN_INDEX_GRAPHQL: "Open index.graphql",
  SELECT_OPERATION_TO_EXECUTE: "Select operation to execute",
  FOUND_SDL_WITHOUT_EXECUTABLES: "Found SDL directive without executables in index.graphql. Adding executables array.",
  COULD_NOT_FIND_SDL_DIRECTIVE: "Could not find @sdl directive in index.graphql. Please add the generated operations manually.",
  STEPZEN_PROJECT_DESCRIPTION: "A StepZen project should contain a <code>stepzen.config.json</code> file and an <code>index.graphql</code> file.",
} as const;

// Type definitions for better type safety
export type CommandId = typeof COMMANDS[keyof typeof COMMANDS];
export type ConfigKey = typeof CONFIG_KEYS[keyof typeof CONFIG_KEYS];
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
export type LogLevel = typeof LOG_LEVELS[keyof typeof LOG_LEVELS];
export type GraphQLOperationType = typeof GRAPHQL.ROOT_OPERATION_TYPES[number];
export type GraphQLScalarType = typeof GRAPHQL.SCALAR_TYPES[number];

