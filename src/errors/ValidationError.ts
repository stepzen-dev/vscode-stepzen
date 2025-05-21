import { StepZenError } from './StepZenError';

/**
 * Error class for validation-related errors
 * Represents errors that occur when validating schemas, inputs, or configurations
 */
export class ValidationError extends StepZenError {
  /**
   * Creates a new validation error
   * 
   * @param message The error message
   * @param code A unique code representing the specific error
   * @param cause The underlying cause of this error (optional)
   */
  constructor(message: string, code: string = 'VALIDATION_ERROR', cause?: unknown) {
    super(message, code, cause);
    this.name = 'ValidationError';
  }
}