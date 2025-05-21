import { StepZenError } from './StepZenError';

/**
 * Error class for network-related errors
 * Represents errors that occur during network operations like API calls
 */
export class NetworkError extends StepZenError {
  /**
   * Creates a new network error
   * 
   * @param message The error message
   * @param code A unique code representing the specific error
   * @param cause The underlying cause of this error (optional)
   */
  constructor(message: string, code: string = 'NETWORK_ERROR', cause?: unknown) {
    super(message, code, cause);
    this.name = 'NetworkError';
  }
}