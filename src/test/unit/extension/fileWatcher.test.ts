import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";

suite("File Watcher Debounce Tests", () => {
  // Create a simplified version of the rescan function from extension.ts
  // This test focuses on verifying the debounce behavior in isolation
  
  test("Debounce should only trigger one scan for multiple rapid changes", async () => {
    // Set up fake timers for controlling time
    const clock = sinon.useFakeTimers();
    
    // Create spies and stubs for monitoring function calls
    const scanSpy = sinon.spy();
    const loggerDebugSpy = sinon.spy();
    const loggerInfoSpy = sinon.spy();
    const hashFn = sinon.stub();
    
    // First call returns initial hash
    hashFn.onFirstCall().returns("hash1");
    // Second call returns same hash (no changes)
    hashFn.onSecondCall().returns("hash1");
    // Third call returns different hash (changes)
    hashFn.onThirdCall().returns("hash2");
    
    // Mock filesystem calls
    const mockFindFiles = sinon.stub().resolves([
      vscode.Uri.file("/project/index.graphql"),
      vscode.Uri.file("/project/schema.graphql")
    ]);
    
    const mockReadFile = sinon.stub().resolves("schema content");
    
    // Keep track of current hash
    let lastHash: string | undefined;
    
    // Simplified version of the debounce function from extension.ts
    let debounceTimer: NodeJS.Timeout | undefined;
    let debouncePromiseResolve: (() => void) | undefined;
    
    const rescan = async (uri: vscode.Uri): Promise<void> => {
      // Clear any existing timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      // Create a promise that will resolve when the debounce completes
      const debouncePromise = new Promise<void>(resolve => {
        debouncePromiseResolve = resolve;
      });
      
      // Set a new timer (250ms)
      debounceTimer = setTimeout(async () => {
        try {
          // Compute hash of all schema files
          await mockFindFiles();
          await mockReadFile();
          
          // Get current hash
          const currentHash = hashFn();
          
          // Skip if unchanged
          if (lastHash && lastHash === currentHash) {
            loggerDebugSpy(`Rescan skipped (no changes) after event in ${uri.fsPath}`);
          } else {
            // Log and scan
            loggerInfoSpy(`Rescanning project after change in ${uri.fsPath}`);
            scanSpy();
            
            // Update hash
            lastHash = currentHash;
          }
        } catch (err) {
          // Just silently fail in test
        } finally {
          // Always resolve the promise
          if (debouncePromiseResolve) {
            debouncePromiseResolve();
          }
        }
      }, 250);
      
      return debouncePromise;
    };
    
    try {
      // Test 1: Multiple rapid changes should only trigger one scan
      
      // Call rescan 5 times in rapid succession
      const fileUri = vscode.Uri.file("/project/index.graphql");
      let lastPromise;
      for (let i = 0; i < 5; i++) {
        lastPromise = rescan(fileUri);
      }
      
      // Fast-forward 100ms (not enough for debounce)
      clock.tick(100);
      
      // Verify scan was not called yet
      assert.strictEqual(scanSpy.callCount, 0, 
        "Scan should not be called before debounce period");
      
      // Fast-forward remaining time
      clock.tick(250);
      
      // Wait for debounce to complete
      await lastPromise;
      
      // Verify scan was called exactly once
      assert.strictEqual(scanSpy.callCount, 1, 
        "Scan should be called exactly once after debounce period");
      
      // Verify log message
      assert.strictEqual(loggerInfoSpy.callCount, 1,
        "Should log rescanning message once");
      
      // Reset call counts
      scanSpy.resetHistory();
      loggerInfoSpy.resetHistory();
      loggerDebugSpy.resetHistory();
      
      // Test 2: No changes (same hash) should skip scan
      
      // Call rescan 5 more times
      for (let i = 0; i < 5; i++) {
        lastPromise = rescan(fileUri);
      }
      
      // Fast-forward past debounce period
      clock.tick(300);
      
      // Wait for debounce to complete
      await lastPromise;
      
      // Verify scan was not called due to unchanged hash
      assert.strictEqual(scanSpy.callCount, 0, 
        "Scan should not be called when hash is unchanged");
      
      // Verify debug log for skipped rescan
      assert.strictEqual(loggerDebugSpy.callCount, 1,
        "Should log skipped rescan message");
      
      // Reset call counts
      scanSpy.resetHistory();
      loggerInfoSpy.resetHistory();
      loggerDebugSpy.resetHistory();
      
      // Test 3: With changes (different hash) should trigger scan
      
      // Call rescan 5 more times
      for (let i = 0; i < 5; i++) {
        lastPromise = rescan(fileUri);
      }
      
      // Fast-forward past debounce period
      clock.tick(300);
      
      // Wait for debounce to complete
      await lastPromise;
      
      // Verify scan was called
      assert.strictEqual(scanSpy.callCount, 1, 
        "Scan should be called when hash changes");
      
    } finally {
      // Clean up
      clock.restore();
    }
  });
});