/**
 * Test utilities for the StepZen extension tests
 */

/**
 * Creates a mock object with the specified properties and methods
 * 
 * @param properties Object containing properties to add to the mock
 * @returns A mock object with the specified properties
 */
export function createMock<T>(properties: Partial<T> = {}): T {
  return properties as T;
}

