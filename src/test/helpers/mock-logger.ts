import { Logger, LogLevel } from "../../services/logger";

/**
 * Creates a mock logger for testing purposes
 *
 * @returns An object with the mock logger and tracking arrays for log calls
 */
export function createMockLogger() {
  const logCalls = {
    error: [] as string[],
    warn: [] as string[],
    info: [] as string[],
    debug: [] as string[],
    all: [] as Array<{ level: LogLevel; message: string; error?: unknown }>,
  };

  const mockOutputChannel = {
    appendLine: (_text: string) => {},
    append: (_text: string) => {},
    clear: () => {},
    show: () => {},
    hide: () => {},
    dispose: () => {},
    name: "StepZen",
    replace: (_value: string) => {},
    processId: undefined as string | undefined,
  };

  // Create a mock implementation
  const mockLogger = {
    error: (message: string, error?: unknown) => {
      logCalls.error.push(message);
      logCalls.all.push({ level: LogLevel.ERROR, message, error });
    },
    warn: (message: string, error?: unknown) => {
      logCalls.warn.push(message);
      logCalls.all.push({ level: LogLevel.WARN, message, error });
    },
    info: (message: string) => {
      logCalls.info.push(message);
      logCalls.all.push({ level: LogLevel.INFO, message });
    },
    debug: (message: string) => {
      logCalls.debug.push(message);
      logCalls.all.push({ level: LogLevel.DEBUG, message });
    },
    getOutputChannel: () => mockOutputChannel,
    setLogLevel: (_level: LogLevel) => {},
    setLogToFile: (_enabled: boolean) => {},
    updateConfigFromSettings: () => {},
    dispose: () => {},
  };

  return {
    mockLogger,
    logCalls,
    // Pass this to setup and restore in your tests
    setupMocks: () => {
      // Store original prototype methods
      const originalGetInstance = Logger.getInstance;

      // Replace with mock implementations
      Logger.getInstance = () => mockLogger as unknown as Logger;

      return () => {
        // Restore original methods
        Logger.getInstance = originalGetInstance;
      };
    },
  };
}
