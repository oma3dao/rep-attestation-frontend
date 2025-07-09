import { describe, it, expect } from 'vitest';
import {
  certificationSchema,
  endorsementSchema,
  linkedIdentifierSchema,
  userReviewSchema,
  getSchema,
  getSchemaIds,
  getAllSchemas,
  type AttestationSchema,
  type FormField,
  type FieldType
} from './schemas';

describe('schemas config', () => {
  describe('schema exports', () => {
    it('exports all four schemas', () => {
      expect(certificationSchema).toBeDefined();
      expect(endorsementSchema).toBeDefined();
      expect(linkedIdentifierSchema).toBeDefined();
      expect(userReviewSchema).toBeDefined();
    });

    it('each schema has required properties', () => {
      const schemas = [certificationSchema, endorsementSchema, linkedIdentifierSchema, userReviewSchema];
      
      schemas.forEach(schema => {
        expect(schema).toHaveProperty('id');
        expect(schema).toHaveProperty('title');
        expect(schema).toHaveProperty('description');
        expect(schema).toHaveProperty('fields');
        expect(Array.isArray(schema.fields)).toBe(true);
        expect(schema.fields.length).toBeGreaterThan(0);
      });
    });

    it('each schema has unique IDs', () => {
      const ids = [certificationSchema.id, endorsementSchema.id, linkedIdentifierSchema.id, userReviewSchema.id];
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('each schema has deployedUIDs and deployedBlocks', () => {
      const schemas = [certificationSchema, endorsementSchema, linkedIdentifierSchema, userReviewSchema];
      
      schemas.forEach(schema => {
        expect(schema.deployedUIDs).toBeDefined();
        expect(schema.deployedBlocks).toBeDefined();
        expect(typeof schema.deployedUIDs).toBe('object');
        expect(typeof schema.deployedBlocks).toBe('object');
      });
    });
  });

  describe('certificationSchema', () => {
    it('has correct properties', () => {
      expect(certificationSchema.id).toBe('certification');
      expect(certificationSchema.title).toBe('Certification');
      expect(certificationSchema.description).toContain('certifying');
    });

    it('has required fields', () => {
      const requiredFields = certificationSchema.fields.filter(field => field.required);
      const requiredFieldNames = requiredFields.map(field => field.name);
      
      expect(requiredFieldNames).toContain('subject');
      expect(requiredFieldNames).toContain('programIdentifier');
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

  describe('linkedIdentifierSchema', () => {
    it('has correct properties', () => {
      expect(linkedIdentifierSchema.id).toBe('linked-identifier');
      expect(linkedIdentifierSchema.title).toBe('Linked Identifier Attestation (Third-Party Certified)');
      expect(linkedIdentifierSchema.description).toContain('third party');
    });
  });

  describe('userReviewSchema', () => {
    it('has correct properties', () => {
      expect(userReviewSchema.id).toBe('user-review');
      expect(userReviewSchema.title).toBe('UserReview');
      expect(userReviewSchema.description).toContain('star reviews');
    });

    it('has rating field with min/max validation', () => {
      const ratingField = userReviewSchema.fields.find(field => field.name === 'ratingValue');
      expect(ratingField).toBeDefined();
      expect(ratingField?.type).toBe('integer');
      expect(ratingField?.min).toBe(1);
      expect(ratingField?.max).toBe(5);
      expect(ratingField?.required).toBe(true);
    });

    it('has datetime field with format', () => {
      const dateField = userReviewSchema.fields.find(field => field.name === 'datePublished');
      expect(dateField).toBeDefined();
      expect(dateField?.type).toBe('datetime');
      expect(dateField?.format).toBe('date-time');
    });
  });

  describe('getSchema function', () => {
    it('returns schema for valid ID', () => {
      expect(getSchema('certification')).toBe(certificationSchema);
      expect(getSchema('endorsement')).toBe(endorsementSchema);
      expect(getSchema('linked-identifier')).toBe(linkedIdentifierSchema);
      expect(getSchema('user-review')).toBe(userReviewSchema);
    });

    it('returns undefined for invalid ID', () => {
      expect(getSchema('non-existent')).toBeUndefined();
      expect(getSchema('')).toBeUndefined();
    });
  });

  describe('getSchemaIds function', () => {
    it('returns all schema IDs', () => {
      const ids = getSchemaIds();
      expect(ids).toEqual(['certification', 'endorsement', 'linked-identifier', 'user-review']);
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
      expect(schemas).toHaveLength(4);
      expect(schemas).toContain(certificationSchema);
      expect(schemas).toContain(endorsementSchema);
      expect(schemas).toContain(linkedIdentifierSchema);
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

  describe('field validation', () => {
    it('all fields have valid types', () => {
      const validTypes: FieldType[] = ['string', 'integer', 'array', 'enum', 'datetime', 'uri', 'text'];
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
  });
}); 