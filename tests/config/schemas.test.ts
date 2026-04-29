import { describe, it, expect } from 'vitest';
import {
  certificationSchema,
  commonSchema,
  controllerWitnessSchema,
  endorsementSchema,
  keyBindingSchema,
  linkedIdentifierSchema,
  securityAssessmentSchema,
  userReviewResponseSchema,
  userReviewSchema,
  getSchema,
  getSchemaIds,
  getAllSchemas,
  type AttestationSchema,
  type FormField,
  type FieldType
} from '@/config/schemas';

describe('schemas config', () => {
  describe('schema exports', () => {
    it('exports all nine schemas', () => {
      expect(certificationSchema).toBeDefined();
      expect(commonSchema).toBeDefined();
      expect(controllerWitnessSchema).toBeDefined();
      expect(endorsementSchema).toBeDefined();
      expect(keyBindingSchema).toBeDefined();
      expect(linkedIdentifierSchema).toBeDefined();
      expect(securityAssessmentSchema).toBeDefined();
      expect(userReviewResponseSchema).toBeDefined();
      expect(userReviewSchema).toBeDefined();
    });

    it('each schema has required properties', () => {
      const schemas = getAllSchemas();
      
      schemas.forEach(schema => {
        expect(schema).toHaveProperty('id');
        expect(schema).toHaveProperty('title');
        expect(schema).toHaveProperty('description');
        expect(schema).toHaveProperty('fields');
        expect(Array.isArray(schema.fields)).toBe(true);
        // commonSchema has no fields, others should have at least one
        if (schema.id !== 'common') {
          expect(schema.fields.length).toBeGreaterThan(0);
        }
      });
    });

    it('each schema has unique IDs', () => {
      const schemas = getAllSchemas();
      const ids = schemas.map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('each schema has deployedUIDs and deployedBlocks as objects', () => {
      const schemas = getAllSchemas();
      
      schemas.forEach(schema => {
        expect(schema.deployedUIDs).toBeDefined();
        expect(schema.deployedBlocks).toBeDefined();
        expect(typeof schema.deployedUIDs).toBe('object');
        expect(typeof schema.deployedBlocks).toBe('object');
      });
    });

    it('schemas with OMAchain Testnet deployments have correct UIDs', () => {
      const expectedDeployedUIDs: Record<string, string> = {
        'certification': '0x2b0d1100f7943c0c2ea29e35c1286bd860fa752124e035cafb503bb83f234805',
        'controller-witness': '0xc81419f828755c0be2c49091dcad0887b5ca7342316dfffb4314aadbf8205090',
        'endorsement': '0xb0cf93ef0f3feb858aa5d07a54f6589da5852883f378dfd0cae5315da1d679ac',
        'key-binding': '0x807b38ce9aa23fdde4457de01db9c5e8d6ec7c8feebee242e52be70847b7b966',
        'linked-identifier': '0x26e21911c55587925afee4b17839ab091e9829321b4a4e1658c497eb0088b453',
        'security-assessment': '0x67bcc2424e3721d56e85bb650c6aba8bf7f1711d9c9a434c3afae3a22d23eed7',
        'user-review-response': '0x53498ae8ae4928a8789e09663f44d6e3c77daeb703c3765aa184b958c3ca41be',
        'user-review': '0x7ab3911527e5e47eaab9f5a2c571060026532dde8cb4398185553053963b2a47',
      };
      for (const [schemaId, expectedUid] of Object.entries(expectedDeployedUIDs)) {
        const schema = getSchema(schemaId);
        expect(schema?.deployedUIDs?.[66238]).toBe(expectedUid);
      }
    });
  });

  describe('certificationSchema', () => {
    it('has correct properties', () => {
      expect(certificationSchema.id).toBe('certification');
      expect(certificationSchema.title).toBe('Certification');
      expect(certificationSchema.description).toContain('certification');
    });

    it('has required fields', () => {
      const requiredFields = certificationSchema.fields.filter(field => field.required);
      const requiredFieldNames = requiredFields.map(field => field.name);
      
      expect(requiredFieldNames).toContain('subject');
      expect(requiredFieldNames).toContain('programID');
      expect(requiredFieldNames).toContain('assessor');
    });

    it('has URI fields with format validation', () => {
      const uriFields = certificationSchema.fields.filter(field => field.type === 'uri');
      uriFields.forEach(field => {
        expect(field.format).toBe('uri');
        expect(field.placeholder).toMatch(/^https:\/\/example\.com/);
      });
    });
  });

  describe('controllerWitnessSchema', () => {
    it('has correct properties', () => {
      expect(controllerWitnessSchema.id).toBe('controller-witness');
      expect(controllerWitnessSchema.title).toBe('Controller Witness');
      expect(controllerWitnessSchema.description).toContain('witness');
    });

    it('has correct required fields', () => {
      const requiredFields = controllerWitnessSchema.fields.filter(f => f.required);
      const names = requiredFields.map(f => f.name);
      expect(names).toContain('subject');
      expect(names).toContain('controller');
      expect(names).toContain('method');
      expect(names).toContain('observedAt');
    });

    it('has method field with observation method enum options', () => {
      const methodField = controllerWitnessSchema.fields.find(f => f.name === 'method');
      expect(methodField).toBeDefined();
      expect(methodField?.type).toBe('enum');
      expect(methodField?.options).toEqual(['dns-txt', 'did-json', 'social-profile', 'manual']);
    });

    it('has observedAt timestamp field', () => {
      const observedAt = controllerWitnessSchema.fields.find(f => f.name === 'observedAt');
      expect(observedAt).toBeDefined();
      expect(observedAt?.type).toBe('integer');
      expect(observedAt?.subtype).toBe('timestamp');
      expect(observedAt?.autoDefault).toBe('current-timestamp');
    });

    it('has EAS schema string', () => {
      expect(controllerWitnessSchema.easSchemaString).toBe(
        'string subject, string controller, string method, uint256 observedAt'
      );
    });

    it('has deployedUID on OMAchain Testnet', () => {
      expect(controllerWitnessSchema.deployedUIDs?.[66238]).toBe(
        '0xc81419f828755c0be2c49091dcad0887b5ca7342316dfffb4314aadbf8205090'
      );
    });
  });

  describe('keyBindingSchema', () => {
    it('has correct properties', () => {
      expect(keyBindingSchema.id).toBe('key-binding');
      expect(keyBindingSchema.title).toBe('Key Binding');
      expect(keyBindingSchema.revocable).toBe(true);
    });

    it('has witness configuration for controller witness', () => {
      expect(keyBindingSchema.witness).toBeDefined();
      expect(keyBindingSchema.witness?.subjectField).toBe('subject');
      expect(keyBindingSchema.witness?.controllerField).toBe('keyId');
    });

    it('has keyId as required field', () => {
      const keyIdField = keyBindingSchema.fields.find(f => f.name === 'keyId');
      expect(keyIdField).toBeDefined();
      expect(keyIdField?.required).toBe(true);
      expect(keyIdField?.pattern).toBe('^did:[a-z0-9]+:.+$');
    });

    it('has keyPurpose array field', () => {
      const keyPurpose = keyBindingSchema.fields.find(f => f.name === 'keyPurpose');
      expect(keyPurpose).toBeDefined();
      expect(keyPurpose?.type).toBe('array');
      expect(keyPurpose?.required).toBe(true);
    });

    it('has priorUIDs for OMAchain Testnet', () => {
      expect(keyBindingSchema.priorUIDs).toBeDefined();
      expect(keyBindingSchema.priorUIDs?.[66238]).toEqual([
        '0x290ce7f909a98f74d2356cf24102ac813555fa0bcd456f1bab17da2d92632e1d'
      ]);
    });

    it('has EAS schema string', () => {
      expect(keyBindingSchema.easSchemaString).toContain('string subject');
      expect(keyBindingSchema.easSchemaString).toContain('string keyId');
      expect(keyBindingSchema.easSchemaString).toContain('string[] keyPurpose');
      expect(keyBindingSchema.easSchemaString).toContain('string[] proofs');
    });
  });

  describe('linkedIdentifierSchema', () => {
    it('has correct properties', () => {
      expect(linkedIdentifierSchema.id).toBe('linked-identifier');
      expect(linkedIdentifierSchema.title).toBe('Linked Identifier');
      expect(linkedIdentifierSchema.description).toContain('third party');
      expect(linkedIdentifierSchema.revocable).toBe(true);
    });

    it('has witness configuration for controller witness', () => {
      expect(linkedIdentifierSchema.witness).toBeDefined();
      expect(linkedIdentifierSchema.witness?.subjectField).toBe('subject');
      expect(linkedIdentifierSchema.witness?.controllerField).toBe('linkedId');
    });

    it('has linkedId as required field', () => {
      const linkedIdField = linkedIdentifierSchema.fields.find(f => f.name === 'linkedId');
      expect(linkedIdField).toBeDefined();
      expect(linkedIdField?.required).toBe(true);
      expect(linkedIdField?.pattern).toBe('^did:[a-z0-9]+:.+$');
    });

    it('has method as required field', () => {
      const methodField = linkedIdentifierSchema.fields.find(f => f.name === 'method');
      expect(methodField).toBeDefined();
      expect(methodField?.required).toBe(true);
      expect(methodField?.type).toBe('string');
    });
  });

  describe('securityAssessmentSchema', () => {
    it('has correct properties', () => {
      expect(securityAssessmentSchema.id).toBe('security-assessment');
      expect(securityAssessmentSchema.title).toBe('Security Assessment');
    });

    it('has payload as object field with nested subFields', () => {
      const payload = securityAssessmentSchema.fields.find(f => f.name === 'payload');
      expect(payload).toBeDefined();
      expect(payload?.type).toBe('object');
      expect(payload?.required).toBe(true);
      expect(Array.isArray(payload?.subFields)).toBe(true);
      expect(payload?.subFields?.length).toBeGreaterThan(0);
    });
  });

  describe('commonSchema', () => {
    it('has correct properties', () => {
      expect(commonSchema.id).toBe('common');
      expect(commonSchema.title).toBe('OMA3 Common Definitions');
      expect(commonSchema.fields).toHaveLength(0);
    });
  });

  describe('userReviewResponseSchema', () => {
    it('has correct properties', () => {
      expect(userReviewResponseSchema.id).toBe('user-review-response');
      expect(userReviewResponseSchema.title).toBe('User Review Response');
    });

    it('has refUID and responseBody as required', () => {
      const refUID = userReviewResponseSchema.fields.find(f => f.name === 'refUID');
      const responseBody = userReviewResponseSchema.fields.find(f => f.name === 'responseBody');
      expect(refUID?.required).toBe(true);
      expect(responseBody?.required).toBe(true);
    });
  });

  describe('endorsementSchema', () => {
    it('has correct properties', () => {
      expect(endorsementSchema.id).toBe('endorsement');
      expect(endorsementSchema.title).toBe('Endorsement');
      expect(endorsementSchema.description).toContain('lightweight');
    });

    it('has subject as required field', () => {
      const subjectField = endorsementSchema.fields.find(field => field.name === 'subject');
      expect(subjectField).toBeDefined();
      expect(subjectField?.required).toBe(true);
    });
  });

  describe('userReviewSchema', () => {
    it('has correct properties', () => {
      expect(userReviewSchema.id).toBe('user-review');
      expect(userReviewSchema.title).toBe('User Review');
      expect(userReviewSchema.description).toContain('star reviews');
    });

    it('has rating field with enum options', () => {
      const ratingField = userReviewSchema.fields.find(field => field.name === 'ratingValue');
      expect(ratingField).toBeDefined();
      expect(ratingField?.type).toBe('enum');
      expect(ratingField?.options).toEqual([1, 2, 3, 4, 5]);
      expect(ratingField?.required).toBe(true);
    });
  });

  describe('witness configuration', () => {
    it('only key-binding and linked-identifier have witness config', () => {
      const schemas = getAllSchemas();
      const witnessSchemas = schemas.filter(s => s.witness);
      expect(witnessSchemas).toHaveLength(2);
      expect(witnessSchemas.map(s => s.id).sort()).toEqual(['key-binding', 'linked-identifier']);
    });

    it('witness config has correct shape', () => {
      const witnessSchemas = getAllSchemas().filter(s => s.witness);
      witnessSchemas.forEach(schema => {
        expect(schema.witness).toHaveProperty('subjectField');
        expect(schema.witness).toHaveProperty('controllerField');
        expect(typeof schema.witness!.subjectField).toBe('string');
        expect(typeof schema.witness!.controllerField).toBe('string');
      });
    });
  });

  describe('priorUIDs', () => {
    it('key-binding has priorUIDs for backward compatibility', () => {
      expect(keyBindingSchema.priorUIDs).toBeDefined();
      expect(keyBindingSchema.priorUIDs?.[66238]).toEqual([
        '0x290ce7f909a98f74d2356cf24102ac813555fa0bcd456f1bab17da2d92632e1d',
      ]);
    });
  });

  describe('revocable schemas', () => {
    it('key-binding and linked-identifier are revocable', () => {
      expect(keyBindingSchema.revocable).toBe(true);
      expect(linkedIdentifierSchema.revocable).toBe(true);
    });

    it('other schemas are not explicitly revocable', () => {
      expect(certificationSchema.revocable).toBeFalsy();
      expect(endorsementSchema.revocable).toBeFalsy();
      expect(controllerWitnessSchema.revocable).toBeFalsy();
    });
  });

  describe('getSchema function', () => {
    it('returns schema for valid ID', () => {
      expect(getSchema('certification')).toBe(certificationSchema);
      expect(getSchema('endorsement')).toBe(endorsementSchema);
      expect(getSchema('linked-identifier')).toBe(linkedIdentifierSchema);
      expect(getSchema('user-review')).toBe(userReviewSchema);
      expect(getSchema('controller-witness')).toBe(controllerWitnessSchema);
      expect(getSchema('key-binding')).toBe(keyBindingSchema);
      expect(getSchema('security-assessment')).toBe(securityAssessmentSchema);
      expect(getSchema('common')).toBe(commonSchema);
      expect(getSchema('user-review-response')).toBe(userReviewResponseSchema);
    });

    it('returns undefined for invalid ID', () => {
      expect(getSchema('non-existent')).toBeUndefined();
      expect(getSchema('')).toBeUndefined();
    });
  });

  describe('getSchemaIds function', () => {
    it('returns all schema IDs', () => {
      const ids = getSchemaIds();
      expect(ids).toEqual(['certification', 'common', 'controller-witness', 'endorsement', 'key-binding', 'linked-identifier', 'security-assessment', 'user-review-response', 'user-review']);
    });

    it('returns array of strings', () => {
      const ids = getSchemaIds();
      expect(Array.isArray(ids)).toBe(true);
      ids.forEach(id => {
        expect(typeof id).toBe('string');
      });
    });
  });

  describe('getAllSchemas function', () => {
    it('returns all schemas', () => {
      const schemas = getAllSchemas();
      expect(schemas).toHaveLength(9);
      expect(schemas).toContain(certificationSchema);
      expect(schemas).toContain(commonSchema);
      expect(schemas).toContain(controllerWitnessSchema);
      expect(schemas).toContain(endorsementSchema);
      expect(schemas).toContain(keyBindingSchema);
      expect(schemas).toContain(linkedIdentifierSchema);
      expect(schemas).toContain(securityAssessmentSchema);
      expect(schemas).toContain(userReviewResponseSchema);
      expect(schemas).toContain(userReviewSchema);
    });

    it('returns array of AttestationSchema objects', () => {
      const schemas = getAllSchemas();
      expect(Array.isArray(schemas)).toBe(true);
      schemas.forEach(schema => {
        expect(schema).toHaveProperty('id');
        expect(schema).toHaveProperty('title');
        expect(schema).toHaveProperty('description');
        expect(schema).toHaveProperty('fields');
      });
    });
  });

  describe('EAS schema strings', () => {
    it('schemas with fields have EAS schema strings', () => {
      const schemasWithFields = getAllSchemas().filter(s => s.fields.length > 0);
      schemasWithFields.forEach(schema => {
        expect(schema.easSchemaString).toBeDefined();
        expect(typeof schema.easSchemaString).toBe('string');
        expect(schema.easSchemaString!.length).toBeGreaterThan(0);
      });
    });

    it('EAS schema strings contain Solidity types', () => {
      const schemasWithEAS = getAllSchemas().filter(s => s.easSchemaString);
      schemasWithEAS.forEach(schema => {
        // All should contain at least a string type
        expect(schema.easSchemaString).toMatch(/string |uint256 |string\[\] /);
      });
    });
  });

  describe('field validation', () => {
    it('all fields have valid types', () => {
      const validTypes: FieldType[] = ['string', 'integer', 'array', 'enum', 'datetime', 'uri', 'object', 'json'];
      const allSchemas = getAllSchemas();
      
      allSchemas.forEach(schema => {
        schema.fields.forEach(field => {
          expect(validTypes).toContain(field.type);
        });
      });
    });

    it('all fields have required properties', () => {
      const allSchemas = getAllSchemas();
      
      allSchemas.forEach(schema => {
        schema.fields.forEach(field => {
          expect(field).toHaveProperty('name');
          expect(field).toHaveProperty('type');
          expect(field).toHaveProperty('label');
          expect(field).toHaveProperty('required');
          expect(typeof field.name).toBe('string');
          expect(typeof field.type).toBe('string');
          expect(typeof field.label).toBe('string');
          expect(typeof field.required).toBe('boolean');
        });
      });
    });

    it('all DID fields have proper pattern validation', () => {
      const allSchemas = getAllSchemas();
      allSchemas.forEach(schema => {
        schema.fields.forEach(field => {
          if (field.format === 'did') {
            expect(field.pattern).toBe('^did:[a-z0-9]+:.+$');
          }
        });
      });
    });
  });
}); 