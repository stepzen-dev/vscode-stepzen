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
  ADD_DIRECTIVE: "stepzen.addDirective",
  ADD_MATERIALIZER: "stepzen.addMaterializer",
  ADD_VALUE: "stepzen.addValue",
  ADD_TOOL: "stepzen.addTool",
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
  /** Built-in GraphQL scalar types */
  SCALAR_TYPES: ["String", "Int", "Float", "Boolean", "ID"] as const,
  /** StepZen-specific scalar types */
  STEPZEN_SCALAR_TYPES: ["Date", "DateTime", "JSON", "Secret"] as const,
  /** All scalar types (built-in + StepZen) */
  ALL_SCALAR_TYPES: ["String", "Int", "Float", "Boolean", "ID", "Date", "DateTime", "JSON", "Secret"] as const,
  /** Operation type patterns for regex matching */
  OPERATION_TYPE_PATTERN: /(query|mutation|subscription)\s+(\w+)/g,
} as const;



// URLs and external links
export const URLS = {
  STEPZEN_CLI_INSTALL: "https://stepzen.com/docs/stepzen-cli/install",
} as const;

// Language IDs
export const LANGUAGE_IDS = {
  GRAPHQL: "graphql",
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
  SCHEMA_VISUALIZER_NO_TYPES_FOUND: "No Schema Types Found",
  SCHEMA_VISUALIZER_NO_TYPES_DESCRIPTION: "The schema visualizer could not find any GraphQL types to display. This might happen if your schema files are empty or contain only directives.",
  SCHEMA_VISUALIZER_LOADING: "Loading schema data...",
  SCHEMA_VISUALIZER_ERROR_TITLE: "Schema Visualization Error",
  EXPLORER_LOADING: "Loading...",
  // Run request messages
  NO_DOCUMENT_AVAILABLE: "No document available in active editor.",
  NO_GRAPHQL_QUERY_FOUND: "No GraphQL query selected or found.",
  INVALID_OPERATION_PROVIDED: "Invalid operation provided",
  DOCUMENT_NOT_FOUND: "Could not open document",
  INVALID_OPERATION_RANGE: "Invalid operation range",
  INVALID_DOCUMENT_ID: "Invalid document ID provided",
  INVALID_OPERATION_NAME: "Invalid operation name provided",
  PERSISTED_DOC_MAP_NOT_AVAILABLE: "Persisted document map is not available",
  PERSISTED_DOC_NOT_FOUND: "Could not find persisted document.",
  INVALID_FILE_URI: "Invalid file URI in persisted document entry",
  INVALID_OPERATIONS_LIST: "Invalid operations list in persisted document entry",
  OPERATION_NOT_FOUND_IN_DOC: "Operation \"{0}\" not found in document.",
  RESULTS_CLEARED: "Results cleared",
  // Workspace trust messages
  GRAPHQL_OPERATIONS_NOT_AVAILABLE_UNTRUSTED: "Running GraphQL operations is not available in untrusted workspaces. Open this folder in a trusted workspace to enable this feature.",
  PERSISTED_OPERATIONS_NOT_AVAILABLE_UNTRUSTED: "Running persisted GraphQL operations is not available in untrusted workspaces. Open this folder in a trusted workspace to enable this feature.",
} as const;

// Type definitions for better type safety
export type GraphQLOperationType = typeof GRAPHQL.ROOT_OPERATION_TYPES[number];
export type GraphQLScalarType = typeof GRAPHQL.SCALAR_TYPES[number];

