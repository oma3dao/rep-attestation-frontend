import { getSchema } from '@/config/schemas'

/**
 * Get the human-readable label for a schema field.
 *
 * Looks up the field's `label` from the schema definition (sourced from the
 * JSON schema `title` property). Falls back to camelCase splitting if the
 * schema or field is not found.
 */
export function getAttestationFieldLabel(fieldName: string, schemaId?: string): string {
  if (schemaId) {
    const schema = getSchema(schemaId)
    if (schema) {
      const field = schema.fields.find(f => f.name === fieldName)
      if (field?.label) return field.label
    }
  }
  // Fallback: split camelCase into words
  return fieldName.replace(/([A-Z])/g, ' $1').trim()
}

/**
 * Determine whether a decoded attestation field should be hidden in the UI.
 *
 * A field is hidden when:
 * 1. It was excluded from the schema's form fields (e.g. x-oma3-skip-reason: unused), AND
 * 2. Its decoded value is empty (null, undefined, empty string, empty array)
 *
 * If the field has actual data, it's always shown regardless of skip status.
 */
export function isHiddenAttestationField(fieldName: string, value: unknown, schemaId?: string): boolean {
  if (!schemaId) return false

  const schema = getSchema(schemaId)
  if (!schema) return false

  // If the field is in the schema's form fields, it's not hidden
  const field = schema.fields.find(f => f.name === fieldName)
  if (field) return false

  // Field was skipped — hide it only if the value is empty
  return isEmpty(value)
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string' && value.trim() === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}
