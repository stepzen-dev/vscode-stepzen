import * as assert from 'assert';
import { services, setMockServices, overrideServices, resetServices, ServiceRegistry } from '../../../services';
import { createMock } from '../../helpers/test-utils';
import { StepzenCliService } from '../../../services/cli';
import { Logger } from '../../../services/logger';

suite('Service Registry', () => {
  let originalServices: ServiceRegistry;

  // Store original services before running tests
  suiteSetup(() => {
    originalServices = { ...services };
  });

  // Restore original services after all tests
  suiteTeardown(() => {
    setMockServices(originalServices);
  });

  // Reset to original services after each test
  teardown(() => {
    setMockServices(originalServices);
  });

  test('services should contain cli and logger by default', () => {
    assert.ok(services.cli instanceof StepzenCliService, 'CLI service should be an instance of StepzenCliService');
    assert.ok(services.logger instanceof Logger, 'Logger should be an instance of Logger');
  });

  test('overrideServices should replace individual services', () => {
    // Create a mock CLI service
    const mockCli = createMock<StepzenCliService>({
      deploy: async () => { /* mock implementation */ },
      request: async () => 'mock response'
    });

    // Store the original CLI service
    const originalCli = services.cli;

    // Override only the CLI service
    const previousServices = overrideServices({ cli: mockCli });

    // Verify that the CLI service was replaced
    assert.strictEqual(services.cli, mockCli, 'CLI service should be replaced with mock');
    
    // Verify that the logger service was not replaced
    assert.strictEqual(services.logger, originalServices.logger, 'Logger service should not be modified');
    
    // Verify that previousServices contains the original CLI service
    assert.strictEqual(previousServices.cli, originalCli, 'previousServices should contain the original CLI service');
    
    // Reset the service back to original
    resetServices(previousServices);
    
    // Verify that the CLI service was restored
    assert.strictEqual(services.cli, originalCli, 'CLI service should be restored to original');
  });

  test('setMockServices should replace all services', () => {
    // Create complete mock services
    const mockServices: ServiceRegistry = {
      cli: createMock<StepzenCliService>({
        deploy: async () => { /* mock implementation */ },
        request: async () => 'mock response from complete mock'
      }),
      logger: createMock<Logger>({
        info: () => { /* mock implementation */ },
        error: () => { /* mock implementation */ },
        debug: () => { /* mock implementation */ },
        warn: () => { /* mock implementation */ }
      })
    };

    // Replace all services with mocks
    const previous = setMockServices(mockServices);

    // Verify that all services were replaced
    assert.strictEqual(services.cli, mockServices.cli, 'CLI service should be replaced with mock');
    assert.strictEqual(services.logger, mockServices.logger, 'Logger service should be replaced with mock');
    
    // Verify that previous contains all original services
    assert.strictEqual(previous.cli, originalServices.cli, 'previous should contain original CLI service');
    assert.strictEqual(previous.logger, originalServices.logger, 'previous should contain original logger service');
    
    // Reset to original services
    setMockServices(previous);
    
    // Verify services were restored
    assert.strictEqual(services.cli, originalServices.cli, 'CLI service should be restored');
    assert.strictEqual(services.logger, originalServices.logger, 'Logger service should be restored');
  });

  test('mocked service should be usable in place of real service', async () => {
    // Create a mock CLI service with a specific behavior we can verify
    const mockCli = createMock<StepzenCliService>({
      request: async (query: string) => {
        return `Mocked response for query: ${query}`;
      }
    });

    // Override the CLI service
    overrideServices({ cli: mockCli });

    // Use the service through the registry
    const result = await services.cli.request('{ test }');
    
    // Verify the mock works as expected
    assert.strictEqual(result, 'Mocked response for query: { test }', 'Mock should return the expected response');
  });
});