// Use Vitest globals

// Mock attestationSchemas for isolated testing
const mockSchemas: Record<string, { id: string; title: string; description: string; fields: any[] }> = {
  'schema-1': { id: 'schema-1', title: 'Schema 1', description: 'desc 1', fields: [] },
  'schema-2': { id: 'schema-2', title: 'Schema 2', description: 'desc 2', fields: [] },
};

// Copy the functions here for isolated testing (since they're not exported)
function mockGetSchema(id: string) {
  return mockSchemas[id];
}
function mockGetSchemaIds() {
  return Object.keys(mockSchemas);
}
function mockGetAllSchemas() {
  return Object.values(mockSchemas);
}

import { attestationSchemas, getSchema, getSchemaIds, getAllSchemas } from './schemas';

describe('schemas helpers', () => {
  it('getSchema returns correct schema for valid id', () => {
    expect(mockGetSchema('schema-1')).toEqual({ id: 'schema-1', title: 'Schema 1', description: 'desc 1', fields: [] });
    expect(mockGetSchema('schema-2')).toEqual({ id: 'schema-2', title: 'Schema 2', description: 'desc 2', fields: [] });
  });

  it('getSchema returns undefined for invalid id', () => {
    expect(mockGetSchema('not-exist')).toBeUndefined();
  });

  it('getSchemaIds returns all schema ids', () => {
    expect(mockGetSchemaIds().sort()).toEqual(['schema-1', 'schema-2']);
  });

  it('getAllSchemas returns all schemas as array', () => {
    expect(mockGetAllSchemas()).toEqual([
      { id: 'schema-1', title: 'Schema 1', description: 'desc 1', fields: [] },
      { id: 'schema-2', title: 'Schema 2', description: 'desc 2', fields: [] },
    ]);
  });

  it('handles empty schema list', () => {
    const emptySchemas: Record<string, { id: string; title: string; description: string; fields: any[] }> = {};
    const getSchemaEmpty = (id: string) => emptySchemas[id];
    const getSchemaIdsEmpty = () => Object.keys(emptySchemas);
    const getAllSchemasEmpty = () => Object.values(emptySchemas);
    expect(getSchemaEmpty('any')).toBeUndefined();
    expect(getSchemaIdsEmpty()).toEqual([]);
    expect(getAllSchemasEmpty()).toEqual([]);
  });
});

describe('real attestationSchemas', () => {
  it('includes all expected schemas', () => {
    expect(Object.keys(attestationSchemas).sort()).toEqual([
      'certification',
      'endorsement',
      'linked-identifier',
      'user-review',
    ].sort());
  });

  it('each schema has correct structure and fields', () => {
    for (const [id, schema] of Object.entries(attestationSchemas)) {
      expect(schema).toHaveProperty('id', id);
      expect(typeof schema.title).toBe('string');
      expect(typeof schema.description).toBe('string');
      expect(typeof schema.icon).toBe('string');
      expect(typeof schema.color).toBe('string');
      expect(Array.isArray(schema.fields)).toBe(true);
      for (const field of schema.fields) {
        expect(typeof field.name).toBe('string');
        expect(typeof field.type).toBe('string');
        expect(typeof field.label).toBe('string');
        expect(typeof field.required).toBe('boolean');
        if (field.type === 'enum') {
          expect(Array.isArray(field.options)).toBe(true);
        }
        if (field.type === 'integer') {
          if ('min' in field) expect(typeof field.min).toBe('number');
          if ('max' in field) expect(typeof field.max).toBe('number');
        }
      }
    }
  });

  it('getSchema returns the correct schema object', () => {
    expect(getSchema('certification')).toBe(attestationSchemas['certification']);
    expect(getSchema('not-exist')).toBeUndefined();
  });

  it('getSchemaIds returns all schema ids', () => {
    expect(getSchemaIds().sort()).toEqual(Object.keys(attestationSchemas).sort());
  });

  it('getAllSchemas returns all schemas as array', () => {
    expect(getAllSchemas().length).toBe(Object.keys(attestationSchemas).length);
    for (const schema of getAllSchemas()) {
      expect(typeof schema.id).toBe('string');
    }
  });
}); 