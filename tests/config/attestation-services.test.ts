import { describe, it, expect } from 'vitest';
import { bsc, bscTestnet } from 'thirdweb/chains';
import {
  BAS_CONFIG,
  ATTESTATION_SERVICES,
  getAttestationService,
  getServicesForChain,
  getContractAddress,
  getAllServiceIds,
  type AttestationServiceConfig
} from '@/config/attestation-services';

describe('attestation-services config', () => {
  describe('BAS_CONFIG', () => {
    it('has correct basic properties', () => {
      expect(BAS_CONFIG.id).toBe('bas');
      expect(BAS_CONFIG.name).toBe('Binance Attestation Service');
      expect(BAS_CONFIG.description).toContain('Decentralized attestation service');
      expect(BAS_CONFIG.website).toBe('https://docs.bnbchain.org/bas/');
      expect(BAS_CONFIG.docs).toBe('https://docs.bnbchain.org/bas/developer-guide/');
    });

    it('has supported chains', () => {
      expect(Array.isArray(BAS_CONFIG.supportedChains)).toBe(true);
      expect(BAS_CONFIG.supportedChains).toContain(bscTestnet.id);
      expect(BAS_CONFIG.supportedChains).toContain(bsc.id);
    });

    it('has contract addresses for supported chains', () => {
      expect(BAS_CONFIG.contracts).toBeDefined();
      expect(typeof BAS_CONFIG.contracts).toBe('object');
      expect(BAS_CONFIG.contracts[bscTestnet.id]).toBe('0x6c2270298b1e6046898a322acB3Cbad6F99f7CBD');
      expect(BAS_CONFIG.contracts[bsc.id]).toBe('0x247Fe62d887bc9410c3848DF2f322e52DA9a51bC');
    });

    it('has features array', () => {
      expect(Array.isArray(BAS_CONFIG.features)).toBe(true);
      expect(BAS_CONFIG.features.length).toBeGreaterThan(0);
      expect(BAS_CONFIG.features).toContain('On-chain attestations');
      expect(BAS_CONFIG.features).toContain('Schema registry');
      expect(BAS_CONFIG.features).toContain('Revocation support');
    });

    it('has estimated gas costs', () => {
      expect(BAS_CONFIG.estimatedGasCost).toBeDefined();
      expect(typeof BAS_CONFIG.estimatedGasCost).toBe('object');
      expect(BAS_CONFIG.estimatedGasCost?.[bscTestnet.id]).toBe(BigInt('100000'));
      expect(BAS_CONFIG.estimatedGasCost?.[bsc.id]).toBe(BigInt('100000'));
    });
  });

  describe('ATTESTATION_SERVICES', () => {
    it('exports services object with BAS_CONFIG', () => {
      expect(ATTESTATION_SERVICES).toBeDefined();
      expect(typeof ATTESTATION_SERVICES).toBe('object');
      expect(ATTESTATION_SERVICES.bas).toBe(BAS_CONFIG);
    });

    it('has correct structure for each service', () => {
      Object.values(ATTESTATION_SERVICES).forEach(service => {
        expect(service).toHaveProperty('id');
        expect(service).toHaveProperty('name');
        expect(service).toHaveProperty('description');
        expect(service).toHaveProperty('website');
        expect(service).toHaveProperty('docs');
        expect(service).toHaveProperty('supportedChains');
        expect(service).toHaveProperty('contracts');
        expect(service).toHaveProperty('features');
        expect(typeof service.id).toBe('string');
        expect(typeof service.name).toBe('string');
        expect(typeof service.description).toBe('string');
        expect(typeof service.website).toBe('string');
        expect(typeof service.docs).toBe('string');
        expect(Array.isArray(service.supportedChains)).toBe(true);
        expect(typeof service.contracts).toBe('object');
        expect(Array.isArray(service.features)).toBe(true);
      });
    });
  });

  describe('getAttestationService function', () => {
    it('returns service for valid ID', () => {
      expect(getAttestationService('bas')).toBe(BAS_CONFIG);
    });

    it('returns undefined for invalid ID', () => {
      expect(getAttestationService('non-existent')).toBeUndefined();
      expect(getAttestationService('')).toBeUndefined();
    });
  });

  describe('getServicesForChain function', () => {
    it('returns services for supported chain', () => {
      const bscTestnetServices = getServicesForChain(bscTestnet.id);
      expect(Array.isArray(bscTestnetServices)).toBe(true);
      expect(bscTestnetServices.length).toBeGreaterThan(0);
      expect(bscTestnetServices).toContain(BAS_CONFIG);

      const bscServices = getServicesForChain(bsc.id);
      expect(Array.isArray(bscServices)).toBe(true);
      expect(bscServices.length).toBeGreaterThan(0);
      expect(bscServices).toContain(BAS_CONFIG);
    });

    it('returns empty array for unsupported chain', () => {
      const unsupportedChainServices = getServicesForChain(999999);
      expect(Array.isArray(unsupportedChainServices)).toBe(true);
      expect(unsupportedChainServices).toHaveLength(0);
    });
  });

  describe('getContractAddress function', () => {
    it('returns contract address for valid service and chain', () => {
      expect(getContractAddress('bas', bscTestnet.id)).toBe('0x6c2270298b1e6046898a322acB3Cbad6F99f7CBD');
      expect(getContractAddress('bas', bsc.id)).toBe('0x247Fe62d887bc9410c3848DF2f322e52DA9a51bC');
    });

    it('returns undefined for invalid service', () => {
      expect(getContractAddress('non-existent', bscTestnet.id)).toBeUndefined();
    });

    it('returns undefined for unsupported chain', () => {
      expect(getContractAddress('bas', 999999)).toBeUndefined();
    });

    it('returns undefined for empty service ID', () => {
      expect(getContractAddress('', bscTestnet.id)).toBeUndefined();
    });
  });

  describe('getAllServiceIds function', () => {
    it('returns all service IDs', () => {
      const ids = getAllServiceIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids).toContain('bas');
    });

    it('returns array of strings', () => {
      const ids = getAllServiceIds();
      ids.forEach(id => {
        expect(typeof id).toBe('string');
      });
    });
  });

  describe('service validation', () => {
    it('all services have valid contract addresses for supported chains', () => {
      Object.values(ATTESTATION_SERVICES).forEach(service => {
        service.supportedChains.forEach(chainId => {
          const contractAddress = service.contracts[chainId];
          expect(contractAddress).toBeDefined();
          expect(typeof contractAddress).toBe('string');
          expect(contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
        });
      });
    });

    it('all services have estimated gas costs for supported chains', () => {
      Object.values(ATTESTATION_SERVICES).forEach(service => {
        if (service.estimatedGasCost) {
          service.supportedChains.forEach(chainId => {
            const gasCost = service.estimatedGasCost[chainId];
            expect(gasCost).toBeDefined();
            expect(typeof gasCost).toBe('bigint');
            expect(gasCost).toBeGreaterThan(BigInt(0));
          });
        }
      });
    });

    it('all services have non-empty features', () => {
      Object.values(ATTESTATION_SERVICES).forEach(service => {
        expect(service.features.length).toBeGreaterThan(0);
        service.features.forEach(feature => {
          expect(typeof feature).toBe('string');
          expect(feature.length).toBeGreaterThan(0);
        });
      });
    });
  });
}); 