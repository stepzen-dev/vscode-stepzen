/**
 * Base error class for all StepZen-related errors
 * Extends the standard Error class with additional context
 */
export class StepZenError extends Error {
  /**
   * A unique code representing the specific error
   */
  public code: string;

  /**
   * The original error that caused this error, if any
   */
  public cause?: unknown;

  /**
   * Creates a new StepZen error
   * 
   * @param message The error message
   * @param code A unique code representing the specific error
   * @param cause The underlying cause of this error (optional)
   */
  constructor(message: string, code: string, cause?: unknown) {
    super(message);
    this.name = 'StepZenError';
    this.code = code;
    this.cause = cause;
    
    // Capture stack trace correctly
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Creates a string representation of the error
   */
  public toString(): string {
    return `${this.name}[${this.code}]: ${this.message}`;
  }
}