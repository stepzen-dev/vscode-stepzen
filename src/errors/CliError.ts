import { StepZenError } from './StepZenError';

/**
 * Error class for CLI-related errors
 * Represents errors that occur when interacting with the StepZen CLI
 */
export class CliError extends StepZenError {
  /**
   * Creates a new CLI error
   * 
   * @param message The error message
   * @param code A unique code representing the specific error
   * @param cause The underlying cause of this error (optional)
   */
  constructor(message: string, code: string = 'CLI_ERROR', cause?: unknown) {
    super(message, code, cause);
    this.name = 'CliError';
  }
}