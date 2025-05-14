/**
 * Error handling utilities for StepZen Tools extension
 */

/**
 * A custom error class for StepZen Tools related errors
 * Adds context and category information to standard Error objects
 */
export class StepZenError extends Error {
  /** The operation that was being attempted when the error occurred */
  public operation: string;
  
  /** The original error that caused this error, if any */
  public cause?: unknown;
  
  /** Type of error for categorization */
  public category: 'config' | 'cli' | 'network' | 'parse' | 'filesystem' | 'user' | 'unknown';

  /**
   * Creates a new StepZen error with enhanced context
   * 
   * @param message The error message
   * @param operation The operation that was being attempted
   * @param options Additional options including cause and category
   */
  constructor(
    message: string, 
    operation: string,
    options?: { 
      cause?: unknown, 
      category?: 'config' | 'cli' | 'network' | 'parse' | 'filesystem' | 'user' | 'unknown'
    }
  ) {
    super(message);
    this.name = 'StepZenError';
    this.operation = operation;
    this.cause = options?.cause;
    this.category = options?.category || 'unknown';
    
    // Capture stack trace correctly
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Formats an error object into a user-friendly string message
 * 
 * @param err The error object to format (can be any type)
 * @param includeDetails Whether to include detailed information (stack traces, etc.)
 * @returns A string representation of the error
 */
export function formatError(err: unknown, includeDetails: boolean = false): string {
  // Handle StepZenError specifically
  if (err instanceof StepZenError) {
    const baseMessage = `${err.operation}: ${err.message}`;
    
    if (includeDetails && err.cause) {
      if (err.cause instanceof Error) {
        return `${baseMessage}\nCaused by: ${err.cause.message}${err.cause.stack ? '\n' + err.cause.stack : ''}`;
      }
      return `${baseMessage}\nCaused by: ${String(err.cause)}`;
    }
    
    return baseMessage;
  }
  
  // Handle standard Error objects
  if (err instanceof Error) {
    if (includeDetails && err.stack) {
      return `${err.message}\n${err.stack}`;
    }
    return err.message;
  }
  
  // Handle network errors with special properties
  if (err && typeof err === 'object' && 'code' in err && 'syscall' in err) {
    const networkErr = err as {code: string; syscall: string; address?: string; port?: number};
    return `Network error: ${networkErr.code} during ${networkErr.syscall}${
      networkErr.address ? ` to ${networkErr.address}${networkErr.port ? `:${networkErr.port}` : ''}` : ''
    }`;
  }
  
  // JSON parsing errors
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as {message: string}).message);
  }
  
  // Handle anything else
  return String(err);
}

/**
 * Creates a well-formatted error with contextual information
 * 
 * @param message The primary error message
 * @param operation The operation that was being attempted
 * @param cause The underlying error that caused this error (optional)
 * @param category Category of error for better organization (optional)
 * @returns A StepZenError with enhanced context
 */
export function createError(
  message: string,
  operation: string,
  cause?: unknown,
  category?: 'config' | 'cli' | 'network' | 'parse' | 'filesystem' | 'user' | 'unknown'
): StepZenError {
  return new StepZenError(message, operation, { cause, category });
}