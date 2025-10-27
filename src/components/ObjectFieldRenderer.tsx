'use client'

import React, { useState, useEffect } from 'react'
import { FormField } from '@/config/schemas'
import { Label } from '@/components/ui/label'

// Forward declare FieldRenderer to avoid circular dependency
// We'll import it dynamically
let FieldRendererComponent: any = null

interface ObjectFieldRendererProps {
  field: FormField
  value: string | object
  onChange: (value: string) => void
  error?: string | Record<string, string>
}

/**
 * ObjectFieldRenderer
 * 
 * Renders a form field that represents a JSON object with nested sub-fields.
 * Handles the conversion between JSON string (for storage) and object (for editing).
 */
export function ObjectFieldRenderer({
  field,
  value,
  onChange,
  error
}: ObjectFieldRendererProps) {
  // Parse the JSON string value into an object for editing
  const [objectValue, setObjectValue] = useState<Record<string, any>>(() => {
    if (!value) return {}
    if (typeof value === 'object') return value
    try {
      return JSON.parse(value)
    } catch {
      console.warn(`Failed to parse object field '${field.name}':`, value)
      return {}
    }
  })

  // Lazy load FieldRenderer to avoid circular dependency
  useEffect(() => {
    if (!FieldRendererComponent) {
      import('./FieldRenderer').then(module => {
        FieldRendererComponent = module.FieldRenderer
      })
    }
  }, [])

  // Update parent when object value changes
  useEffect(() => {
    // Only stringify if we have actual data
    const hasData = Object.keys(objectValue).some(key => {
      const val = objectValue[key]
      return val !== undefined && val !== null && val !== ''
    })
    
    if (hasData) {
      onChange(JSON.stringify(objectValue))
    } else {
      onChange('')
    }
  }, [objectValue]) // Remove onChange from dependencies to prevent infinite loop

  const handleSubFieldChange = (subFieldName: string, subFieldValue: any) => {
    setObjectValue(prev => ({
      ...prev,
      [subFieldName]: subFieldValue
    }))
  }

  // Get error for a specific sub-field
  const getSubFieldError = (subFieldName: string): string | undefined => {
    if (typeof error === 'string') return undefined
    return error?.[subFieldName]
  }

  if (!field.subFields || field.subFields.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No sub-fields defined for this object
      </div>
    )
  }

  // Don't render until FieldRenderer is loaded
  if (!FieldRendererComponent) {
    return <div className="text-sm text-muted-foreground">Loading...</div>
  }

  // Render nested (with container and heading) or flat
  if (field.nested) {
    return (
      <div className="space-y-4">
        {/* Object field label and description */}
        <div className="space-y-1">
          <Label className="text-base font-semibold">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          {field.description && (
            <p className="text-sm text-muted-foreground">{field.description}</p>
          )}
        </div>

        {/* Nested sub-fields in a bordered container */}
        <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
          {field.subFields.map((subField) => (
            <FieldRendererComponent
              key={subField.name}
              field={subField}
              value={objectValue[subField.name] ?? (subField.type === 'array' ? [] : '')}
              onChange={(val: any) => handleSubFieldChange(subField.name, val)}
              error={getSubFieldError(subField.name)}
            />
          ))}
        </div>

        {/* Show error if it's a string (general error) */}
        {typeof error === 'string' && error && (
          <p className="text-sm text-red-500" data-testid="field-error">
            {error}
          </p>
        )}
      </div>
    )
  }

  // Render flat (default)
  return (
    <>
      {/* Render sub-fields flat without container or heading */}
      {field.subFields.map((subField) => (
        <FieldRendererComponent
          key={subField.name}
          field={subField}
          value={objectValue[subField.name] ?? (subField.type === 'array' ? [] : '')}
          onChange={(val: any) => handleSubFieldChange(subField.name, val)}
          error={getSubFieldError(subField.name)}
        />
      ))}

      {/* Show error if it's a string (general error) */}
      {typeof error === 'string' && error && (
        <p className="text-sm text-red-500" data-testid="field-error">
          {error}
        </p>
      )}
    </>
  )
}
