import { describe, it, expect } from 'vitest';
import {
  EAS_CONFIG,
  ATTESTATION_SERVICES,
  ATTESTATION_QUERY_CONFIG,
  getAttestationService,
  getServicesForChain,
  getContractAddress,
  getAllServiceIds,
} from '@/config/attestation-services';
import { omachainTestnet, omachainMainnet } from '@/config/chains';

describe('attestation-services config', () => {
  describe('EAS_CONFIG', () => {
    it('has correct basic properties', () => {
      expect(EAS_CONFIG.id).toBe('eas');
      expect(EAS_CONFIG.name).toBe('Ethereum Attestation Service');
      expect(EAS_CONFIG.description).toContain('OMAChain');
      expect(EAS_CONFIG.website).toBe('https://attest.org/');
      expect(EAS_CONFIG.docs).toBe('https://docs.attest.org/');
    });

    it('supports OMAChain Testnet and Mainnet', () => {
      expect(EAS_CONFIG.supportedChains).toContain(omachainTestnet.id);
      expect(EAS_CONFIG.supportedChains).toContain(omachainMainnet.id);
    });

    it('has contract addresses for OMAChain', () => {
      expect(EAS_CONFIG.contracts[omachainTestnet.id]).toBe('0x8835AF90f1537777F52E482C8630cE4e947eCa32');
    });

    it('has OMAChain native feature', () => {
      expect(EAS_CONFIG.features).toContain('OMAChain native');
    });

    it('has estimated gas costs for OMAChain', () => {
      expect(EAS_CONFIG.estimatedGasCost?.[omachainTestnet.id]).toBe(BigInt('100000'));
      expect(EAS_CONFIG.estimatedGasCost?.[omachainMainnet.id]).toBe(BigInt('100000'));
    });
  });

  describe('ATTESTATION_SERVICES', () => {
    it('exports EAS-only services object', () => {
      expect(ATTESTATION_SERVICES).toBeDefined();
      expect(typeof ATTESTATION_SERVICES).toBe('object');
      expect(ATTESTATION_SERVICES.eas).toBe(EAS_CONFIG);
    });

    it('has exactly one service', () => {
      expect(Object.keys(ATTESTATION_SERVICES)).toHaveLength(1);
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

  describe('ATTESTATION_QUERY_CONFIG', () => {
    it('has progressive block ranges', () => {
      expect(Array.isArray(ATTESTATION_QUERY_CONFIG.blockRanges)).toBe(true);
      expect(ATTESTATION_QUERY_CONFIG.blockRanges.length).toBeGreaterThan(0);
      ATTESTATION_QUERY_CONFIG.blockRanges.forEach(range => {
        expect(range).toHaveProperty('blocks');
        expect(range).toHaveProperty('label');
        expect(range.blocks).toBeGreaterThan(0);
      });
    });

    it('block ranges are in ascending order', () => {
      for (let i = 1; i < ATTESTATION_QUERY_CONFIG.blockRanges.length; i++) {
        expect(ATTESTATION_QUERY_CONFIG.blockRanges[i].blocks)
          .toBeGreaterThan(ATTESTATION_QUERY_CONFIG.blockRanges[i - 1].blocks);
      }
    });

    it('has default limit and fetch multiplier', () => {
      expect(ATTESTATION_QUERY_CONFIG.defaultLimit).toBeGreaterThan(0);
      expect(ATTESTATION_QUERY_CONFIG.fetchMultiplier).toBeGreaterThan(0);
    });
  });

  describe('getAttestationService function', () => {
    it('returns service for valid ID', () => {
      expect(getAttestationService('eas')).toBe(EAS_CONFIG);
    });

    it('returns undefined for invalid ID', () => {
      expect(getAttestationService('non-existent')).toBeUndefined();
      expect(getAttestationService('')).toBeUndefined();
      expect(getAttestationService('bas')).toBeUndefined();
    });
  });

  describe('getServicesForChain function', () => {
    it('returns EAS for OMAChain', () => {
      const omachainTestnetServices = getServicesForChain(omachainTestnet.id);
      expect(omachainTestnetServices).toContain(EAS_CONFIG);

      const omachainMainnetServices = getServicesForChain(omachainMainnet.id);
      expect(omachainMainnetServices).toContain(EAS_CONFIG);
    });

    it('returns empty array for unsupported chain', () => {
      const unsupportedChainServices = getServicesForChain(999999);
      expect(Array.isArray(unsupportedChainServices)).toBe(true);
      expect(unsupportedChainServices).toHaveLength(0);
    });
  });

  describe('getContractAddress function', () => {
    it('returns contract address for EAS on OMAChain', () => {
      expect(getContractAddress('eas', omachainTestnet.id)).toBe(
        '0x8835AF90f1537777F52E482C8630cE4e947eCa32'
      );
    });

    it('returns undefined for invalid service', () => {
      expect(getContractAddress('non-existent', omachainTestnet.id)).toBeUndefined();
    });

    it('returns undefined for unsupported chain', () => {
      expect(getContractAddress('eas', 999999)).toBeUndefined();
    });

    it('returns undefined for empty service ID', () => {
      expect(getContractAddress('', omachainTestnet.id)).toBeUndefined();
    });
  });

  describe('getAllServiceIds function', () => {
    it('returns all service IDs', () => {
      const ids = getAllServiceIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids).toContain('eas');
      expect(ids).not.toContain('bas');
    });

    it('returns array of strings', () => {
      const ids = getAllServiceIds();
      ids.forEach(id => {
        expect(typeof id).toBe('string');
      });
    });
  });

  describe('service validation', () => {
    it('EAS has correct contract addresses for supported chains', () => {
      expect(EAS_CONFIG.contracts[omachainTestnet.id]).toBe('0x8835AF90f1537777F52E482C8630cE4e947eCa32');
    });

    it('all services have estimated gas costs for supported chains', () => {
      Object.values(ATTESTATION_SERVICES).forEach(service => {
        const gasCostMap = service.estimatedGasCost;
        if (gasCostMap) {
          service.supportedChains.forEach(chainId => {
            const gasCost = gasCostMap[chainId];
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
