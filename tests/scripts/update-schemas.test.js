import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { transformToUISchema, transformFields } from '../../scripts/update-schemas.ts'

describe('update-schemas script', () => {
  describe('transformToUISchema', () => {
    it('transforms a minimal valid JSON schema to UI schema', async () => {
      const jsonSchema = {
        title: 'Test Schema',
        description: 'A test schema',
        properties: {
          foo: { type: 'string', title: 'Foo' },
          bar: { type: 'integer', title: 'Bar' }
        },
        required: ['foo']
      }
      const result = await transformToUISchema(jsonSchema, 'test-schema')
      expect(result).toEqual({
        id: 'test-schema',
        title: 'Test Schema',
        description: 'A test schema',
        revocable: false,
        fields: [
          expect.objectContaining({ name: 'foo', type: 'string', label: 'Foo', required: true }),
          expect.objectContaining({ name: 'bar', type: 'integer', label: 'Bar', required: false })
        ]
      })
    })

    it('returns UI schema with empty fields for missing properties', async () => {
      const badSchema = { title: 'Bad', description: 'No properties' }
      const result = await transformToUISchema(badSchema, 'bad')
      expect(result).toEqual({
        id: 'bad',
        title: 'Bad',
        description: 'No properties',
        revocable: false,
        fields: [],
      })
    })

    it('handles unknown field types gracefully', async () => {
      const weirdSchema = {
        title: 'Weird',
        description: 'desc',
        properties: { foo: { type: 'unknown', title: 'Foo' } },
        required: []
      }
      const result = await transformToUISchema(weirdSchema, 'weird')
      expect(result.fields[0].type).toBe('string')
    })

    it('throws if schema is missing title', async () => {
      const badSchema = { description: 'desc', properties: {} }
      await expect(transformToUISchema(badSchema, 'bad')).rejects.toThrow(/missing required 'title'/i)
    })

    it('throws if schema is missing description', async () => {
      const badSchema = { title: 'Bad', properties: {} }
      await expect(transformToUISchema(badSchema, 'bad')).rejects.toThrow(/missing required 'description'/i)
    })

    it('throws if field is missing title', async () => {
      const badSchema = {
        title: 'Bad',
        description: 'desc',
        properties: { foo: { type: 'string' } },
        required: ['foo'],
      }
      await expect(transformToUISchema(badSchema, 'bad')).rejects.toThrow(/missing required 'title'/i)
    })

    it('skips fields with x-oma3-skip-reason', async () => {
      const schema = {
        title: 'Skip',
        description: 'desc',
        properties: {
          foo: { type: 'string', title: 'Foo', 'x-oma3-skip-reason': 'skip this' },
          bar: { type: 'string', title: 'Bar' },
        },
        required: [],
      }
      const result = await transformToUISchema(schema, 'skip')
      expect(result.fields.length).toBe(1)
      expect(result.fields[0].name).toBe('bar')
    })
  })

  describe('transformFields', () => {
    it('handles uri format fields', async () => {
      const properties = {
        website: { type: 'string', format: 'uri', title: 'Website' }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].type).toBe('uri')
      expect(result[0].format).toBe('uri')
    })

    it('handles datetime format fields', async () => {
      const properties = {
        createdAt: { type: 'string', format: 'date-time', title: 'Created At' }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].type).toBe('datetime')
      expect(result[0].format).toBe('date-time')
    })

    it('handles number type as integer', async () => {
      const properties = {
        amount: { type: 'number', title: 'Amount' }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].type).toBe('integer')
    })

    it('handles array type', async () => {
      const properties = {
        items: { type: 'array', title: 'Items' }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].type).toBe('array')
    })

    it('handles boolean type as enum with Yes/No options', async () => {
      const properties = {
        active: { type: 'boolean', title: 'Active' }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].type).toBe('enum')
      expect(result[0].options).toEqual(['Yes', 'No'])
    })

    it('handles enum fields', async () => {
      const properties = {
        status: { type: 'string', title: 'Status', enum: ['active', 'inactive', 'pending'] }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].type).toBe('enum')
      expect(result[0].options).toEqual(['active', 'inactive', 'pending'])
    })

    it('handles integer fields with min/max', async () => {
      const properties = {
        age: { type: 'integer', title: 'Age', minimum: 0, maximum: 150 }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].min).toBe(0)
      expect(result[0].max).toBe(150)
    })

    it('handles string fields with minLength/maxLength', async () => {
      const properties = {
        name: { type: 'string', title: 'Name', minLength: 1, maxLength: 100 }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].minLength).toBe(1)
      expect(result[0].maxLength).toBe(100)
    })

    it('handles string fields with pattern', async () => {
      const properties = {
        code: { type: 'string', title: 'Code', pattern: '^[A-Z]{3}$' }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].pattern).toBe('^[A-Z]{3}$')
    })

    it('handles default values', async () => {
      const properties = {
        count: { type: 'integer', title: 'Count', default: 10 }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].default).toBe(10)
    })

    it('handles x-oma3-default auto-default marker', async () => {
      const properties = {
        timestamp: { type: 'string', title: 'Timestamp', 'x-oma3-default': 'current-timestamp' }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].autoDefault).toBe('current-timestamp')
    })

    it('handles x-oma3-subtype', async () => {
      const properties = {
        timestamp: { type: 'integer', title: 'Timestamp', 'x-oma3-subtype': 'timestamp' }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].subtype).toBe('timestamp')
    })

    it('uses examples as placeholder', async () => {
      const properties = {
        email: { type: 'string', title: 'Email', examples: ['user@example.com'] }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].placeholder).toBe('user@example.com')
    })

    it('generates placeholder for DID fields', async () => {
      const properties = {
        userDID: { type: 'string', title: 'User DID' }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].placeholder).toBe('did:example:123...')
    })

    it('generates placeholder for uri format', async () => {
      const properties = {
        website: { type: 'string', format: 'uri', title: 'Website' }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].placeholder).toBe('https://example.com')
    })

    it('generates placeholder for date-time format', async () => {
      const properties = {
        createdAt: { type: 'string', format: 'date-time', title: 'Created At' }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].placeholder).toBe('2024-01-01T00:00:00Z')
    })

    it('generates placeholder for integer type', async () => {
      const properties = {
        count: { type: 'integer', title: 'Count' }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].placeholder).toBe('0')
    })

    it('generates default placeholder for other fields', async () => {
      const properties = {
        userName: { type: 'string', title: 'User Name' }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].placeholder).toBe('Enter username')
    })

    it('handles object fields with expanded render mode (default)', async () => {
      const properties = {
        address: {
          type: 'object',
          title: 'Address',
          properties: {
            street: { type: 'string', title: 'Street' },
            city: { type: 'string', title: 'City' }
          },
          required: ['street']
        }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].type).toBe('object')
      expect(result[0].subFields).toHaveLength(2)
      expect(result[0].subFields[0].name).toBe('street')
      expect(result[0].subFields[0].required).toBe(true)
      expect(result[0].subFields[1].name).toBe('city')
      expect(result[0].subFields[1].required).toBe(false)
    })

    it('handles object fields with raw render mode', async () => {
      const properties = {
        metadata: {
          type: 'object',
          title: 'Metadata',
          description: 'Raw JSON metadata',
          properties: { foo: { type: 'string', title: 'Foo' } },
          'x-oma3-render': 'raw'
        }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].type).toBe('json')
      expect(result[0].placeholder).toBe('Paste JSON object...')
    })

    it('handles object fields with x-oma3-nested flag', async () => {
      const properties = {
        nested: {
          type: 'object',
          title: 'Nested',
          properties: {
            inner: { type: 'string', title: 'Inner' }
          },
          'x-oma3-nested': true
        }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].nested).toBe(true)
    })

    it('handles object fields with x-oma3-nested set to false', async () => {
      const properties = {
        flat: {
          type: 'object',
          title: 'Flat',
          properties: {
            inner: { type: 'string', title: 'Inner' }
          },
          'x-oma3-nested': false
        }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].nested).toBe(false)
    })

    it('handles required fields correctly', async () => {
      const properties = {
        required1: { type: 'string', title: 'Required 1' },
        optional1: { type: 'string', title: 'Optional 1' },
        required2: { type: 'string', title: 'Required 2' }
      }
      const result = await transformFields(properties, ['required1', 'required2'], 'test')
      expect(result[0].required).toBe(true)
      expect(result[1].required).toBe(false)
      expect(result[2].required).toBe(true)
    })

    it('handles empty properties object', async () => {
      const result = await transformFields({}, [], 'test')
      expect(result).toEqual([])
    })

    it('handles nested object fields with required sub-fields', async () => {
      const properties = {
        contact: {
          type: 'object',
          title: 'Contact',
          description: 'Contact information',
          properties: {
            email: { type: 'string', format: 'uri', title: 'Email' },
            phone: { type: 'string', title: 'Phone' }
          },
          required: ['email']
        }
      }
      const result = await transformFields(properties, ['contact'], 'test')
      expect(result[0].type).toBe('object')
      expect(result[0].required).toBe(true)
      expect(result[0].description).toBe('Contact information')
      expect(result[0].subFields[0].required).toBe(true)
      expect(result[0].subFields[1].required).toBe(false)
    })

    it('handles deeply nested object fields', async () => {
      const properties = {
        level1: {
          type: 'object',
          title: 'Level 1',
          properties: {
            level2: {
              type: 'object',
              title: 'Level 2',
              properties: {
                value: { type: 'string', title: 'Value' }
              }
            }
          }
        }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].type).toBe('object')
      expect(result[0].subFields[0].type).toBe('object')
      expect(result[0].subFields[0].subFields[0].name).toBe('value')
    })

    it('handles field with all string constraints', async () => {
      const properties = {
        code: {
          type: 'string',
          title: 'Code',
          minLength: 3,
          maxLength: 10,
          pattern: '^[A-Z]+$',
          format: 'custom'
        }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].minLength).toBe(3)
      expect(result[0].maxLength).toBe(10)
      expect(result[0].pattern).toBe('^[A-Z]+$')
      expect(result[0].format).toBe('custom')
    })

    it('handles field with all integer constraints', async () => {
      const properties = {
        score: {
          type: 'integer',
          title: 'Score',
          minimum: 0,
          maximum: 100,
          default: 50
        }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].min).toBe(0)
      expect(result[0].max).toBe(100)
      expect(result[0].default).toBe(50)
    })

    it('handles number type with constraints', async () => {
      const properties = {
        price: {
          type: 'number',
          title: 'Price',
          minimum: 0.01,
          maximum: 9999.99
        }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].type).toBe('integer')
      expect(result[0].min).toBe(0.01)
      expect(result[0].max).toBe(9999.99)
    })

    it('handles field with multiple x-oma3 extensions', async () => {
      const properties = {
        timestamp: {
          type: 'integer',
          title: 'Timestamp',
          'x-oma3-default': 'current-timestamp',
          'x-oma3-subtype': 'timestamp'
        }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].autoDefault).toBe('current-timestamp')
      expect(result[0].subtype).toBe('timestamp')
    })

    it('handles object field with explicit expanded render mode', async () => {
      const properties = {
        details: {
          type: 'object',
          title: 'Details',
          properties: {
            name: { type: 'string', title: 'Name' }
          },
          'x-oma3-render': 'expanded'
        }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].type).toBe('object')
      expect(result[0].subFields).toBeDefined()
    })

    it('handles DID field name variations', async () => {
      const properties = {
        did: { type: 'string', title: 'DID' },
        subjectDID: { type: 'string', title: 'Subject DID' },
        userDid: { type: 'string', title: 'User DID' }
      }
      const result = await transformFields(properties, [], 'test')
      // The code checks for 'did' or 'DID' in the field name
      expect(result[0].placeholder).toBe('did:example:123...')
      expect(result[1].placeholder).toBe('did:example:123...')
      // 'userDid' contains 'did' (lowercase) so it matches
      expect(result[2].placeholder).toBe('Enter userdid')
    })

    it('handles enum with integer options', async () => {
      const properties = {
        level: {
          type: 'integer',
          title: 'Level',
          enum: [1, 2, 3, 4, 5]
        }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].type).toBe('enum')
      expect(result[0].options).toEqual([1, 2, 3, 4, 5])
    })

    it('handles object field without nested flag', async () => {
      const properties = {
        simple: {
          type: 'object',
          title: 'Simple',
          properties: {
            value: { type: 'string', title: 'Value' }
          }
        }
      }
      const result = await transformFields(properties, [], 'test')
      expect(result[0].nested).toBeUndefined()
    })

    it('handles raw object field with description', async () => {
      const properties = {
        config: {
          type: 'object',
          title: 'Config',
          description: 'Configuration object',
          properties: {},
          'x-oma3-render': 'raw'
        }
      }
      const result = await transformFields(properties, ['config'], 'test')
      expect(result[0].type).toBe('json')
      expect(result[0].description).toBe('Configuration object')
      expect(result[0].required).toBe(true)
    })
  })

  describe('transformToUISchema edge cases', () => {
    it('handles schema with all field types', async () => {
      const schema = {
        title: 'Complete Schema',
        description: 'A schema with all field types',
        properties: {
          stringField: { type: 'string', title: 'String' },
          intField: { type: 'integer', title: 'Integer' },
          numField: { type: 'number', title: 'Number' },
          boolField: { type: 'boolean', title: 'Boolean' },
          arrayField: { type: 'array', title: 'Array' },
          enumField: { type: 'string', title: 'Enum', enum: ['a', 'b'] },
          uriField: { type: 'string', format: 'uri', title: 'URI' },
          dateField: { type: 'string', format: 'date-time', title: 'Date' },
          objectField: {
            type: 'object',
            title: 'Object',
            properties: {
              nested: { type: 'string', title: 'Nested' }
            }
          }
        },
        required: ['stringField', 'intField']
      }
      const result = await transformToUISchema(schema, 'complete')
      expect(result.fields).toHaveLength(9)
      expect(result.fields.find(f => f.name === 'stringField').type).toBe('string')
      expect(result.fields.find(f => f.name === 'intField').type).toBe('integer')
      expect(result.fields.find(f => f.name === 'numField').type).toBe('integer')
      expect(result.fields.find(f => f.name === 'boolField').type).toBe('enum')
      expect(result.fields.find(f => f.name === 'arrayField').type).toBe('array')
      expect(result.fields.find(f => f.name === 'enumField').type).toBe('enum')
      expect(result.fields.find(f => f.name === 'uriField').type).toBe('uri')
      expect(result.fields.find(f => f.name === 'dateField').type).toBe('datetime')
      expect(result.fields.find(f => f.name === 'objectField').type).toBe('object')
    })

    it('handles schema with empty required array', async () => {
      const schema = {
        title: 'Optional Schema',
        description: 'All fields optional',
        properties: {
          field1: { type: 'string', title: 'Field 1' },
          field2: { type: 'string', title: 'Field 2' }
        },
        required: []
      }
      const result = await transformToUISchema(schema, 'optional')
      expect(result.fields.every(f => f.required === false)).toBe(true)
    })

    it('handles schema with undefined required', async () => {
      const schema = {
        title: 'No Required Schema',
        description: 'No required array',
        properties: {
          field1: { type: 'string', title: 'Field 1' }
        }
      }
      const result = await transformToUISchema(schema, 'no-required')
      expect(result.fields[0].required).toBe(false)
    })

    it('preserves schema id in result', async () => {
      const schema = {
        title: 'ID Test',
        description: 'Testing ID preservation',
        properties: {}
      }
      const result = await transformToUISchema(schema, 'my-custom-id')
      expect(result.id).toBe('my-custom-id')
    })

    it('handles special characters in title and description', async () => {
      const schema = {
        title: "Schema with 'quotes' and \"double quotes\"",
        description: 'Description with\nnewlines and\ttabs',
        properties: {}
      }
      const result = await transformToUISchema(schema, 'special-chars')
      expect(result.title).toBe("Schema with 'quotes' and \"double quotes\"")
      expect(result.description).toBe('Description with\nnewlines and\ttabs')
    })
  })
})
