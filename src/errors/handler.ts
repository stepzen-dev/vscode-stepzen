import * as vscode from 'vscode';
import { StepZenError } from './StepZenError';
import { CliError } from './CliError';
import { ValidationError } from './ValidationError';
import { NetworkError } from './NetworkError';
import { logger } from '../services/logger';

/**
 * Central error handler for the StepZen extension
 * Normalizes errors, logs them, and shows user-friendly notifications
 * 
 * @param error The error to handle (can be any type)
 * @returns The normalized StepZenError
 */
export function handleError(error: unknown): StepZenError {
  // Step 1: Normalize to StepZenError
  const normalizedError = normalizeError(error);
  
  // Step 2: Log the full error with stack trace
  logger.error(`${normalizedError.name}[${normalizedError.code}]: ${normalizedError.message}`, normalizedError);
  
  // Step 3: Show VS Code notification with friendly message
  showErrorNotification(normalizedError);
  
  return normalizedError;
}

/**
 * Normalize any error type to a StepZenError
 * Wraps unknown errors in an appropriate StepZenError subclass
 * 
 * @param error The error to normalize (can be any type)
 * @returns A normalized StepZenError
 */
function normalizeError(error: unknown): StepZenError {
  // If already a StepZenError, return as is
  if (error instanceof StepZenError) {
    return error;
  }
  
  // Handle standard Error objects
  if (error instanceof Error) {
    // Try to categorize based on error properties and message
    if (error.message.includes('ENOTFOUND') || 
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('HTTP')) {
      return new NetworkError(
        `Network request failed: ${error.message}`,
        'NETWORK_REQUEST_FAILED',
        error
      );
    }
    
    if (error.message.includes('validation') ||
        error.message.includes('invalid') ||
        error.message.includes('schema')) {
      return new ValidationError(
        `Validation failed: ${error.message}`,
        'VALIDATION_FAILED',
        error
      );
    }
    
    if (error.message.includes('command') ||
        error.message.includes('process') ||
        error.message.includes('spawn') ||
        error.message.includes('CLI') ||
        error.message.includes('exited with code')) {
      return new CliError(
        `CLI operation failed: ${error.message}`,
        'CLI_OPERATION_FAILED',
        error
      );
    }
    
    // Default to base StepZenError if no specific category is detected
    return new StepZenError(
      error.message,
      'UNKNOWN_ERROR',
      error
    );
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return new StepZenError(
      error,
      'STRING_ERROR',
      new Error(error)
    );
  }
  
  // Handle other types (objects, etc.)
  return new StepZenError(
    `Unknown error: ${String(error)}`,
    'UNKNOWN_ERROR_TYPE',
    error
  );
}

/**
 * Show a user-friendly error notification with VS Code
 * 
 * @param error The StepZenError to show
 */
function showErrorNotification(error: StepZenError): void {
  // Generate a user-friendly message based on error type
  let friendlyMessage = getFriendlyErrorMessage(error);
  
  // Show notification with "Show Logs" action
  vscode.window.showErrorMessage(
    friendlyMessage,
    { modal: false, detail: error.message },
    'Show Logs'
  ).then(selection => {
    if (selection === 'Show Logs') {
      logger.showOutput();
    }
  });
}

/**
 * Get a user-friendly error message based on error type
 * 
 * @param error The StepZenError to get a friendly message for
 * @returns A user-friendly error message
 */
function getFriendlyErrorMessage(error: StepZenError): string {
  // Customize message based on error type
  if (error instanceof CliError) {
    return `StepZen CLI Error: ${error.message}`;
  }
  
  if (error instanceof ValidationError) {
    return `StepZen Validation Error: ${error.message}`;
  }
  
  if (error instanceof NetworkError) {
    return `StepZen Network Error: ${error.message}`;
  }
  
  // Default message for base StepZenError
  return `StepZen Error: ${error.message}`;
}