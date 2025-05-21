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

// TODO: CLEANUP ?
// /**
//  * Asserts that an async function throws an error matching the expected error
//  * 
//  * @param fn The async function to test
//  * @param expectedError The expected error (string, regex, or error instance)
//  */
// async function assertThrowsAsync(
//   fn: () => Promise<any>,
//   expectedError?: string | RegExp | Error
// ): Promise<void> {
//   let error: Error | undefined;
  
//   try {
//     await fn();
//   } catch (err) {
//     error = err instanceof Error ? err : new Error(String(err));
//   }
  
//   if (!error) {
//     assert.fail('Expected function to throw an error');
//   }
  
//   if (expectedError) {
//     if (typeof expectedError === 'string') {
//       assert.strictEqual(error.message, expectedError);
//     } else if (expectedError instanceof RegExp) {
//       assert.ok(expectedError.test(error.message), `Error message "${error.message}" does not match ${expectedError}`);
//     } else {
//       assert.strictEqual(error.name, expectedError.name);
//       assert.strictEqual(error.message, expectedError.message);
//     }
//   }
// }

// TODO: CLEANUP ?
// /**
//  * Timeout utility for tests
//  * 
//  * @param ms Milliseconds to wait
//  * @returns A promise that resolves after the specified time
//  */
// function wait(ms: number): Promise<void> {
//   return new Promise(resolve => setTimeout(resolve, ms));
// }
