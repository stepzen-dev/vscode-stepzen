import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Log levels supported by the StepZen logger
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

/**
 * Maps log levels to numeric values for comparison
 */
const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  [LogLevel.ERROR]: 0,
  [LogLevel.WARN]: 1,
  [LogLevel.INFO]: 2,
  [LogLevel.DEBUG]: 3
};

/**
 * Configuration for the StepZen logger
 */
interface LoggerConfig {
  /** Minimum log level to display */
  logLevel: LogLevel;
  /** Whether to log to a file (requires trusted workspace) */
  logToFile: boolean;
}

/**
 * StepZen Logger singleton class for structured logging with support for log levels
 */
export class Logger {
  private static instance: Logger;
  private outputChannel: vscode.OutputChannel;
  private config: LoggerConfig;
  private logFilePath?: string;
  private fileLogger?: fs.WriteStream;
  private readonly MAX_LOG_SIZE_BYTES = 1024 * 1024; // 1MB
  
  private constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
    this.config = {
      logLevel: LogLevel.INFO,
      logToFile: false
    };
    this.updateConfigFromSettings();
  }

  /**
   * Get or create the singleton logger instance
   * @returns Logger instance
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      // Create output channel once for the extension
      const outputChannel = vscode.window.createOutputChannel("StepZen", { log: true });
      Logger.instance = new Logger(outputChannel);
    }
    return Logger.instance;
  }

  /**
   * Update the logger configuration based on VS Code settings
   */
  public updateConfigFromSettings(): void {
    const config = vscode.workspace.getConfiguration('stepzen');
    const logLevel = config.get<string>('logLevel', 'info') as LogLevel;
    const logToFile = config.get<boolean>('logToFile', false);
    
    this.setLogLevel(logLevel);
    this.setLogToFile(logToFile);
  }

  /**
   * Set the minimum log level
   * @param level Minimum log level to display
   */
  public setLogLevel(level: LogLevel): void {
    this.config.logLevel = level;
    this.log(LogLevel.INFO, `Log level set to ${level}`);
  }

  /**
   * Enable or disable file logging
   * @param enabled Whether to log to a file
   */
  public setLogToFile(enabled: boolean): void {
    this.config.logToFile = enabled;
    
    if (enabled) {
      this.initializeFileLogger();
    } else if (this.fileLogger) {
      this.fileLogger.end();
      this.fileLogger = undefined;
    }
  }

  /**
   * Log a message at ERROR level
   * @param message The message to log
   * @param error Optional error object for additional context
   */
  public error(message: string, error?: unknown): void {
    this.log(LogLevel.ERROR, message, error);
  }

  /**
   * Log a message at WARN level
   * @param message The message to log
   * @param error Optional error object for additional context
   */
  public warn(message: string, error?: unknown): void {
    this.log(LogLevel.WARN, message, error);
  }

  /**
   * Log a message at INFO level
   * @param message The message to log
   */
  public info(message: string): void {
    this.log(LogLevel.INFO, message);
  }

  /**
   * Log a message at DEBUG level
   * @param message The message to log
   */
  public debug(message: string): void {
    this.log(LogLevel.DEBUG, message);
  }

  /**
   * Get the current output channel
   * @returns VS Code output channel
   */
  public getOutputChannel(): vscode.OutputChannel {
    return this.outputChannel;
  }

  /**
   * Internal log method that formats messages with timestamp and level
   * and respects the configured level
   * @param level The log level
   * @param message The message to log
   * @param error Optional error object for additional context
   */
  private log(level: LogLevel, message: string, error?: unknown): void {
    // Skip if the message's level is more verbose than the configured level
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    // Log to output channel
    this.outputChannel.appendLine(formattedMessage);

    // For errors, append the error details on the next line
    if (error) {
      const errorDetails = this.formatError(error);
      this.outputChannel.appendLine(`  └─ ${errorDetails}`);
      
      // Also log error to file if enabled
      if (this.fileLogger) {
        this.fileLogger.write(`${formattedMessage}\n  └─ ${errorDetails}\n`);
      }
    } else if (this.fileLogger) {
      // Log to file if enabled (without error)
      this.fileLogger.write(`${formattedMessage}\n`);
    }
    
    // Also log to console during tests
    if (process.env.NODE_ENV === 'test') {
      console.log(formattedMessage);
      if (error) {
        console.log(`  └─ ${this.formatError(error)}`);
      }
    }
  }

  /**
   * Formats an error for logging
   * @param error The error to format
   * @returns Formatted error string
   */
  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`;
    }
    return String(error);
  }

  /**
   * Determines if a message at the given level should be logged
   * based on the current configuration
   * @param level The log level to check
   * @returns True if the message should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_VALUES[level] <= LOG_LEVEL_VALUES[this.config.logLevel];
  }

  /**
   * Initializes the file logger if file logging is enabled
   * and the workspace is trusted
   */
  private initializeFileLogger(): void {
    // Only log to file if the workspace is trusted
    if (!vscode.workspace.isTrusted) {
      this.warn('Cannot log to file in untrusted workspace');
      return;
    }

    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        this.warn('Cannot log to file: no workspace folder available');
        return;
      }

      // Use extension's storage path if available, otherwise use workspace root
      const storagePath = this.getStoragePath();
      if (!storagePath) {
        this.warn('Cannot log to file: storage path not available');
        return;
      }

      // Ensure directory exists
      if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
      }

      this.logFilePath = path.join(storagePath, 'stepzen.log');
      
      // Check if log rotation is needed
      this.rotateLogFileIfNeeded();
      
      // Create or open the log file for append
      this.fileLogger = fs.createWriteStream(this.logFilePath, { flags: 'a' });
      this.info(`Logging to file: ${this.logFilePath}`);
    } catch (err) {
      this.warn(`Failed to initialize file logging: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Gets the storage path for log files
   */
  private getStoragePath(): string | undefined {
    // Try to get the global storage path from the extension context
    // If not available, fallback to temporary directory
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return undefined;
    }

    // For now, just use a .stepzen directory in the workspace
    return path.join(workspaceFolder.uri.fsPath, '.stepzen');
  }

  /**
   * Rotates the log file if it exceeds the maximum size
   */
  private rotateLogFileIfNeeded(): void {
    if (!this.logFilePath) {
      return;
    }

    try {
      // Check if file exists and get its size
      if (fs.existsSync(this.logFilePath)) {
        const stats = fs.statSync(this.logFilePath);
        
        // Rotate if file is larger than maximum size
        if (stats.size > this.MAX_LOG_SIZE_BYTES) {
          const backupPath = `${this.logFilePath}.old`;
          if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
          }
          fs.renameSync(this.logFilePath, backupPath);
          this.info(`Log file rotated: ${this.logFilePath} -> ${backupPath}`);
        }
      }
    } catch (err) {
      this.warn(`Failed to rotate log file: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Disposes resources used by the logger
   */
  public dispose(): void {
    if (this.fileLogger) {
      this.fileLogger.end();
      this.fileLogger = undefined;
    }
    this.outputChannel.dispose();
  }
}

// Export a default logger instance for convenience
export const logger = Logger.getInstance();

// Export the output channel for backward compatibility
export const stepzenOutput = logger.getOutputChannel();