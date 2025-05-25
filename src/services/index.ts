import { StepzenCliService } from './cli';
import { Logger, logger } from './logger';
import { ProjectResolver } from './projectResolver';
import { SchemaIndexService } from './SchemaIndexService';
import { RequestService } from './request';

/**
 * Service registry for dependency injection of application services
 * Acts as a lightweight container for singleton services
 */
export interface ServiceRegistry {
  cli: StepzenCliService;
  logger: Logger;
  projectResolver: ProjectResolver;
  schemaIndex: SchemaIndexService;
  request: RequestService;
}

/**
 * Default service implementations
 */
export const services: ServiceRegistry = {
  cli: new StepzenCliService(),
  logger,
  projectResolver: new ProjectResolver(logger),
  schemaIndex: new SchemaIndexService(),
  request: new RequestService(logger),
};

/**
 * Override services for testing
 * 
 * @param patch Partial service registry with mocked services
 * @returns The previous services before override
 */
export function overrideServices(patch: Partial<ServiceRegistry>): Partial<ServiceRegistry> {
  const previousServices: Partial<ServiceRegistry> = {};
  
  for (const [key, value] of Object.entries(patch)) {
    const serviceKey = key as keyof ServiceRegistry;
    // Store the original service before overriding
    if (services[serviceKey]) {
      previousServices[serviceKey] = services[serviceKey] as any;
    }
    // Apply the override
    (services as any)[serviceKey] = value;
  }
  
  return previousServices;
}

/**
 * Reset overridden services with original implementations
 * 
 * @param previousServices Services to restore
 */
export function resetServices(previousServices: Partial<ServiceRegistry>): void {
  for (const [key, value] of Object.entries(previousServices)) {
    const serviceKey = key as keyof ServiceRegistry;
    (services as any)[serviceKey] = value;
  }
}

/**
 * Set all services to mocks for testing
 * Shorthand for replacing all services with mocks in tests
 * 
 * @param mocks Complete mocked service registry
 * @returns The previous services before mocking
 */
export function setMockServices(mocks: ServiceRegistry): ServiceRegistry {
  const previousServices = { ...services };
  
  for (const [key, value] of Object.entries(mocks)) {
    const serviceKey = key as keyof ServiceRegistry;
    (services as any)[serviceKey] = value;
  }
  
  return previousServices;
}