import { describe, it, expect } from 'vitest'
import { transformToUISchema } from './update-schemas.js'

// NOTE: This is a placeholder test file for scripts/update-schemas.js
// To test this script, consider using child_process to run the script with a test directory,
// or refactor the script to export functions for direct import and unit testing.

describe('update-schemas script', () => {
  it('should run without throwing (placeholder)', async () => {
    // TODO: Use child_process.spawn or refactor script for direct import
    expect(true).toBe(true)
  })

  // Add more tests here by mocking fs, path, and providing test schema directories
})

describe('transformToUISchema', () => {
  it('transforms a minimal valid JSON schema to UI schema', () => {
    const jsonSchema = {
      title: 'Test Schema',
      description: 'A test schema',
      properties: {
        foo: { type: 'string', title: 'Foo' },
        bar: { type: 'integer', title: 'Bar' }
      },
      required: ['foo']
    }
    const result = transformToUISchema(jsonSchema, 'test-schema')
    expect(result).toEqual({
      id: 'test-schema',
      title: 'Test Schema',
      description: 'A test schema',
      fields: [
        expect.objectContaining({ name: 'foo', type: 'string', label: 'Foo', required: true }),
        expect.objectContaining({ name: 'bar', type: 'integer', label: 'Bar', required: false })
      ]
    })
  })

  it('returns UI schema with empty fields for missing properties', () => {
    const badSchema = { title: 'Bad', description: 'No properties' };
    expect(transformToUISchema(badSchema, 'bad')).toEqual({
      id: 'bad',
      title: 'Bad',
      description: 'No properties',
      fields: [],
    });
  });

  it('handles unknown field types gracefully', () => {
    const weirdSchema = {
      title: 'Weird',
      description: 'desc',
      properties: { foo: { type: 'unknown', title: 'Foo' } },
      required: []
    };
    const result = transformToUISchema(weirdSchema, 'weird');
    expect(result.fields[0].type).toBe('string');
  });

  describe('transformToUISchema uncovered branches', () => {
    it('throws if schema is missing title', () => {
      const badSchema = { description: 'desc', properties: {} };
      expect(() => transformToUISchema(badSchema, 'bad')).toThrow(/missing required 'title'/i);
    });
    it('throws if schema is missing description', () => {
      const badSchema = { title: 'Bad', properties: {} };
      expect(() => transformToUISchema(badSchema, 'bad')).toThrow(/missing required 'description'/i);
    });
    it('throws if field is missing title', () => {
      const badSchema = {
        title: 'Bad',
        description: 'desc',
        properties: { foo: { type: 'string' } },
        required: ['foo'],
      };
      expect(() => transformToUISchema(badSchema, 'bad')).toThrow(/missing required 'title'/i);
    });
    it('skips fields with x-oma3-skip-reason', () => {
      const schema = {
        title: 'Skip',
        description: 'desc',
        properties: {
          foo: { type: 'string', title: 'Foo', 'x-oma3-skip-reason': 'skip this' },
          bar: { type: 'string', title: 'Bar' },
        },
        required: [],
      };
      const result = transformToUISchema(schema, 'skip');
      expect(result.fields.length).toBe(1);
      expect(result.fields[0].name).toBe('bar');
    });
  });
}) 