import { describe, it, expect } from 'vitest';
import * as config from './index';

describe('config index', () => {
  it('exports schemas', () => {
    expect(config.certificationSchema).toBeDefined();
    expect(config.endorsementSchema).toBeDefined();
    expect(config.linkedIdentifierSchema).toBeDefined();
    expect(config.userReviewSchema).toBeDefined();
    expect(config.getSchema).toBeDefined();
    expect(config.getSchemaIds).toBeDefined();
    expect(config.getAllSchemas).toBeDefined();
  });

  it('exports attestation services', () => {
    expect(config.BAS_CONFIG).toBeDefined();
    expect(config.ATTESTATION_SERVICES).toBeDefined();
    expect(config.getAttestationService).toBeDefined();
    expect(config.getServicesForChain).toBeDefined();
    expect(config.getContractAddress).toBeDefined();
    expect(config.getAllServiceIds).toBeDefined();
  });

  it('exports all expected functions and objects', () => {
    // Verify that all expected exports are available
    const expectedExports = [
      'certificationSchema',
      'endorsementSchema', 
      'linkedIdentifierSchema',
      'userReviewSchema',
      'getSchema',
      'getSchemaIds',
      'getAllSchemas',
      'BAS_CONFIG',
      'ATTESTATION_SERVICES',
      'getAttestationService',
      'getServicesForChain',
      'getContractAddress',
      'getAllServiceIds'
    ];
    
    expectedExports.forEach(exportName => {
      expect(config).toHaveProperty(exportName);
    });
  });

  it('exports functions are callable', () => {
    expect(typeof config.getSchema).toBe('function');
    expect(typeof config.getSchemaIds).toBe('function');
    expect(typeof config.getAllSchemas).toBe('function');
    expect(typeof config.getAttestationService).toBe('function');
    expect(typeof config.getServicesForChain).toBe('function');
    expect(typeof config.getContractAddress).toBe('function');
    expect(typeof config.getAllServiceIds).toBe('function');
  });
}); 