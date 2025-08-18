import { StepZenError } from './StepZenError';

/**
 * Structured error data extracted from StepZen CLI output
 */
export interface StepZenCliErrorDetails {
  /** The original error message */
  originalMessage: string;
  /** The type of error (authorization, graphql, etc.) */
  errorType?: string;
  /** Specific error details for GraphQL errors */
  graphqlErrors?: string[];
  /** Authorization error details */
  authError?: string;
}

/**
 * Error class for CLI-related errors
 * Represents errors that occur when interacting with the StepZen CLI
 */
export class CliError extends StepZenError {
  /** Structured error details extracted from CLI output */
  public details?: StepZenCliErrorDetails;

  /**
   * Creates a new CLI error
   * 
   * @param message The error message
   * @param code A unique code representing the specific error
   * @param cause The underlying cause of this error (optional)
   * @param details Structured error details extracted from CLI output (optional)
   */
  constructor(message: string, code: string = 'CLI_ERROR', cause?: unknown, details?: StepZenCliErrorDetails) {
    super(message, code, cause);
    this.name = 'CliError';
    this.details = details;
  }

  /**
   * Creates a string representation of the error including details if available
   */
  public toString(): string {
    let result = `${this.name}[${this.code}]: ${this.message}`;
    
    if (this.details) {
      if (this.details.errorType) {
        result += `\nError Type: ${this.details.errorType}`;
      }
      
      if (this.details.authError) {
        result += `\nAuthorization Error: ${this.details.authError}`;
      }
      
      if (this.details.graphqlErrors && this.details.graphqlErrors.length > 0) {
        result += `\nGraphQL Errors:\n${this.details.graphqlErrors.map(err => `- ${err}`).join('\n')}`;
      }
    }
    
    return result;
  }
}

// Made with Bob
