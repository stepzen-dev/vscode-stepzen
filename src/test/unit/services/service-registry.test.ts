import * as assert from 'assert';
import { services, setMockServices, overrideServices, resetServices, ServiceRegistry } from '../../../services';
import { createMock } from '../../helpers/test-utils';
import { StepzenCliService } from '../../../services/cli';
import { Logger } from '../../../services/logger';
import { ProjectResolver } from '../../../services/projectResolver';
import { SchemaIndexService } from '../../../services/SchemaIndexService';
import { RequestService } from '../../../services/request';
import { ImportService } from '../../../services/importService';
import { GraphQLLinterService } from '../../../services/graphqlLinter';
import * as vscode from 'vscode';

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

  test('services should contain cli, logger, projectResolver, schemaIndex, request, and import by default', () => {
    assert.ok(services.cli instanceof StepzenCliService, 'CLI service should be an instance of StepzenCliService');
    assert.ok(services.logger instanceof Logger, 'Logger should be an instance of Logger');
    assert.ok(services.projectResolver instanceof ProjectResolver, 'ProjectResolver should be an instance of ProjectResolver');
    assert.ok(services.schemaIndex instanceof SchemaIndexService, 'SchemaIndex service should be an instance of SchemaIndexService');
    assert.ok(services.request instanceof RequestService, 'Request service should be an instance of RequestService');
    assert.ok(services.import instanceof ImportService, 'Import service should be an instance of ImportService');
  });

  test('overrideServices should replace individual services', () => {
    // Create a mock CLI service
    const mockCli = createMock<StepzenCliService>({
      deploy: async () => { /* mock implementation */ },
      request: async () => 'mock response',
      getApiKey: async () => 'mock-api-key',
      getAccount: async () => 'mock-account',
      getDomain: async () => 'mock.stepzen.net'
    });

    // Store the original CLI service
    const originalCli = services.cli;

    // Override only the CLI service
    const previousServices = overrideServices({ cli: mockCli });

    // Verify that the CLI service was replaced
    assert.strictEqual(services.cli, mockCli, 'CLI service should be replaced with mock');
    
    // Verify that other services were not replaced
    assert.strictEqual(services.logger, originalServices.logger, 'Logger service should not be modified');
    assert.strictEqual(services.projectResolver, originalServices.projectResolver, 'ProjectResolver service should not be modified');
    
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
        request: async () => 'mock response from complete mock',
        getApiKey: async () => 'mock-api-key',
        getAccount: async () => 'mock-account',
        getDomain: async () => 'mock.stepzen.net'
      }),
      logger: createMock<Logger>({
        info: () => { /* mock implementation */ },
        error: () => { /* mock implementation */ },
        debug: () => { /* mock implementation */ },
        warn: () => { /* mock implementation */ }
      }),
      projectResolver: createMock<ProjectResolver>({
        resolveStepZenProjectRoot: async () => '/mock/project/root',
        clearCache: () => { /* mock implementation */ },
        getCachedProjectRoot: () => '/mock/cached/root'
      }),
      schemaIndex: createMock<SchemaIndexService>({
        scan: async () => { /* mock implementation */ },
        clearState: () => { /* mock implementation */ },
        findDefinition: () => undefined,
        getRootOperations: () => ({}),
        getOperationMap: () => ({}),
        getPersistedDocMap: () => ({}),
        getFieldIndex: () => ({}),
        getTypeDirectives: () => ({}),
        getTypeRelationships: () => [],
        computeHash: () => 'mock-hash'
      }),
      request: createMock<RequestService>({
        parseVariables: () => ({ variables: {} }),
        getApiKey: async () => 'mock-api-key',
        loadEndpointConfig: async () => ({ graphqlUrl: 'https://mock-account.mock.stepzen.net/mock-endpoint/graphql', apiKey: 'mock-key' }),
        executePersistedDocumentRequest: async () => ({ data: {} }),
        validateRequestOptions: () => { /* mock implementation */ },
        calculateDocumentHash: () => 'sha256:mockhash'
      }),
      import: createMock<ImportService>({
        executeImport: async () => ({ success: true, targetDir: './stepzen', schemaName: 'test' })
      }),
      graphqlLinter: createMock<GraphQLLinterService>({
        initialize: async () => {},
        lintFile: async () => [],
        lintProject: async () => {},
        getDiagnosticCollection: () => vscode.languages.createDiagnosticCollection('test'),
        clearDiagnostics: () => {},
        dispose: () => {}
      })
    };

    // Replace all services with mocks
    const previous = setMockServices(mockServices);

    // Verify that all services were replaced
    assert.strictEqual(services.cli, mockServices.cli, 'CLI service should be replaced with mock');
    assert.strictEqual(services.logger, mockServices.logger, 'Logger service should be replaced with mock');
    assert.strictEqual(services.projectResolver, mockServices.projectResolver, 'ProjectResolver service should be replaced with mock');
    assert.strictEqual(services.schemaIndex, mockServices.schemaIndex, 'SchemaIndex service should be replaced with mock');
    assert.strictEqual(services.request, mockServices.request, 'Request service should be replaced with mock');
    assert.strictEqual(services.import, mockServices.import, 'Import service should be replaced with mock');
    assert.strictEqual(services.graphqlLinter, mockServices.graphqlLinter, 'GraphQL Linter service should be replaced with mock');
    
    // Verify that previous contains all original services
    assert.strictEqual(previous.cli, originalServices.cli, 'previous should contain original CLI service');
    assert.strictEqual(previous.logger, originalServices.logger, 'previous should contain original logger service');
    assert.strictEqual(previous.projectResolver, originalServices.projectResolver, 'previous should contain original ProjectResolver service');
    assert.strictEqual(previous.schemaIndex, originalServices.schemaIndex, 'previous should contain original SchemaIndex service');
    assert.strictEqual(previous.request, originalServices.request, 'previous should contain original Request service');
    assert.strictEqual(previous.import, originalServices.import, 'previous should contain original Import service');
    assert.strictEqual(previous.graphqlLinter, originalServices.graphqlLinter, 'previous should contain original GraphQL Linter service');
    
    // Reset to original services
    setMockServices(previous);
    
    // Verify services were restored
    assert.strictEqual(services.cli, originalServices.cli, 'CLI service should be restored');
    assert.strictEqual(services.logger, originalServices.logger, 'Logger service should be restored');
    assert.strictEqual(services.projectResolver, originalServices.projectResolver, 'ProjectResolver service should be restored');
    assert.strictEqual(services.schemaIndex, originalServices.schemaIndex, 'SchemaIndex service should be restored');
    assert.strictEqual(services.request, originalServices.request, 'Request service should be restored');
    assert.strictEqual(services.import, originalServices.import, 'Import service should be restored');
    assert.strictEqual(services.graphqlLinter, originalServices.graphqlLinter, 'GraphQL Linter service should be restored');
  });

  test('mocked service should be usable in place of real service', async () => {
    // Create a mock ProjectResolver service with a specific behavior we can verify
    const mockProjectResolver = createMock<ProjectResolver>({
      resolveStepZenProjectRoot: async (hintUri?: any) => {
        return `/mocked/project/root${hintUri ? '/with-hint' : ''}`;
      }
    });

    // Override the ProjectResolver service
    overrideServices({ projectResolver: mockProjectResolver });

    // Use the service through the registry
    const result = await services.projectResolver.resolveStepZenProjectRoot();
    
    // Verify the mock works as expected
    assert.strictEqual(result, '/mocked/project/root', 'Mock should return the expected response');

    // Test with hint URI
    const resultWithHint = await services.projectResolver.resolveStepZenProjectRoot({} as any);
    assert.strictEqual(resultWithHint, '/mocked/project/root/with-hint', 'Mock should handle hint URI parameter');
  });
});