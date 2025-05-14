import * as vscode from 'vscode';
import { LogLevel } from './constants';

// Create output channel once and export for global usage
export const stepzenOutput = vscode.window.createOutputChannel(
  "StepZen Tools",
  { log: true }
);

/**
 * StepZen Logger class for structured logging with support for log levels
 */
export class Logger {
  private static instance: Logger;
  private outputChannel: vscode.OutputChannel;
  private minimumLevel: LogLevel = LogLevel.INFO;

  private constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * Get or create the singleton logger instance
   * @returns Logger instance
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(stepzenOutput);
    }
    return Logger.instance;
  }

  /**
   * Set the minimum log level
   * @param level Minimum log level to display
   */
  public setMinimumLevel(level: LogLevel): void {
    this.minimumLevel = level;
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
   * Log a message at TRACE level (most verbose)
   * @param message The message to log
   */
  public trace(message: string): void {
    this.log(LogLevel.TRACE, message);
  }

  /**
   * Internal log method that formats messages with their level
   * @param level The log level
   * @param message The message to log
   * @param error Optional error object for additional context
   */
  private log(level: string, message: string, error?: unknown): void {
    // Simple level filtering (can be extended with numeric levels)
    if (this.shouldLog(level)) {
      const formattedMessage = `[${level}] ${message}`;
      this.outputChannel.appendLine(formattedMessage);

      // For errors, append the error details on the next line
      if (error) {
        const errorDetails = error instanceof Error
          ? `${error.name}: ${error.message}\n${error.stack || ''}`
          : String(error);
        
        this.outputChannel.appendLine(`  └─ ${errorDetails}`);
      }
    }
  }

  /**
   * Determines if a message at the given level should be logged
   * @param level The log level to check
   * @returns True if the message should be logged
   */
  private shouldLog(level: string): boolean {
    // For now, log everything. This can be extended with level hierarchy.
    return true;
  }
}

// Export a default logger instance for convenience
export const logger = Logger.getInstance();