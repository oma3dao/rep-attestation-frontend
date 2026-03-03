'use client'

import React from 'react'
import { FormField, RichOption } from '@/config/schemas'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { SubjectIdInput } from '@/components/SubjectIdInput'
import { ObjectFieldRenderer } from '@/components/ObjectFieldRenderer'
import { TimestampInput } from '@/components/TimestampInput'
import { ProofInput } from '@/components/ProofInput'
import { useState } from 'react'

interface FieldRendererProps {
  field: FormField
  value: string | string[]
  onChange: (value: string | string[]) => void
  error?: string
}

export function FieldRenderer({ field, value, onChange, error }: FieldRendererProps) {
  const [arrayInput, setArrayInput] = useState('')

  // Compute effective value once (for simple scalar types only)
  const effectiveValue = (() => {
    // If value is explicitly set (including empty string), use it
    // Empty string means user cleared the field
    if (value !== undefined && value !== null) {
      // For timestamp fields, don't apply defaults if value is empty string (user cleared it)
      if (field.subtype === 'timestamp' && value === '') {
        return ''
      }
      // For other fields, return value if not empty
      if (value !== '') {
        return value
      }
    }

    // Only apply defaults to simple scalar types when value is undefined/null
    if (['string', 'integer', 'enum', 'uri', 'datetime'].includes(field.type)) {
      // Auto-generate defaults based on type
      if (field.autoDefault === 'current-timestamp') {
        return Math.floor(Date.now() / 1000)  // Unix timestamp in seconds
      }
      if (field.autoDefault === 'current-datetime') {
        return new Date().toISOString()  // ISO 8601 datetime: "2025-10-27T15:30:00.000Z"
      }
      if (field.autoDefault === 'current-date') {
        return new Date().toISOString().split('T')[0]  // ISO 8601 date: "2025-10-27"
      }

      // Use static default if provided
      if (field.default !== undefined) {
        return field.default
      }
    }

    // For complex types or no default, return original value
    return value !== undefined ? value : (field.type === 'array' ? [] : '')
  })()

  // Array handlers
  const handleArrayAdd = () => {
    if (arrayInput.trim()) {
      const currentArray = Array.isArray(value) ? value : []
      onChange([...currentArray, arrayInput.trim()])
      setArrayInput('')
    }
  }

  const handleArrayRemove = (index: number) => {
    if (Array.isArray(value)) {
      const newArray = value.filter((_, i) => i !== index)
      onChange(newArray)
    }
  }

  // Special case: Object fields handle their own rendering
  // - Nested objects (nested: true) render with their own label/container
  // - Flat objects (nested: false/omitted) render sub-fields without container
  // Either way, return early without FieldRenderer's wrapper
  if (field.type === 'object') {
    return (
      <ObjectFieldRenderer
        field={field}
        value={value}
        onChange={onChange}
        error={error}
      />
    )
  }

  // Determine which field element to render
  let fieldElement

  // Special case: Subject field - always use original value, no defaults
  if (field.name === 'subject') {
    fieldElement = (
      <SubjectIdInput
        value={typeof value === 'string' ? value : ''}
        onChange={(did) => onChange(did || '')}
        error={error}
      />
    )
  }
  // Regular field types
  else {
    switch (field.type) {
      case 'string':
        if (field.name === 'reviewBody' || field.name === 'description') {
          fieldElement = (
            <Textarea
              id={field.name}
              placeholder={field.placeholder}
              value={typeof effectiveValue === 'string' ? effectiveValue : ''}
              onChange={(e) => onChange(e.target.value)}
              className={error ? 'border-red-500' : ''}
              rows={4}
            />
          )
        } else {
          fieldElement = (
            <Input
              id={field.name}
              type="text"
              placeholder={field.placeholder}
              value={typeof effectiveValue === 'string' ? effectiveValue : ''}
              onChange={(e) => onChange(e.target.value)}
              className={error ? 'border-red-500' : ''}
            />
          )
        }
        break

      case 'integer':
        // Handle timestamp subtype with datetime picker
        if (field.subtype === 'timestamp') {
          fieldElement = (
            <TimestampInput
              value={effectiveValue as number | string | undefined}
              onChange={onChange}
              error={error}
              required={field.required}
              hasAutoDefault={!!field.autoDefault}
            />
          )
        } else {
          // Regular integer input
          fieldElement = (
            <Input
              id={field.name}
              type="number"
              placeholder={field.placeholder}
              value={typeof effectiveValue === 'string' || typeof effectiveValue === 'number' ? effectiveValue : ''}
              onChange={(e) => onChange(e.target.value)}
              className={error ? 'border-red-500' : ''}
              min={field.min}
              max={field.max}
            />
          )
        }
        break

      case 'datetime':
        fieldElement = (
          <Input
            id={field.name}
            type="datetime-local"
            value={typeof effectiveValue === 'string' ? effectiveValue : ''}
            onChange={(e) => onChange(e.target.value)}
            className={error ? 'border-red-500' : ''}
          />
        )
        break

      case 'uri':
        fieldElement = (
          <Input
            id={field.name}
            type="url"
            placeholder={field.placeholder || 'https://example.com'}
            value={typeof effectiveValue === 'string' ? effectiveValue : ''}
            onChange={(e) => onChange(e.target.value)}
            className={error ? 'border-red-500' : ''}
          />
        )
        break

      case 'enum': {
        const enumValue = typeof effectiveValue === 'string' ? effectiveValue : ''
        const enumOptions = field.options ?? []
        const isRichEnumOption = (opt: string | number | RichOption): opt is RichOption =>
          typeof opt === 'object' && 'value' in opt

        if (enumOptions.length > 0 && enumOptions.length <= 7) {
          // Radio buttons for small option sets
          fieldElement = (
            <div className="space-y-2">
              {enumOptions.map((opt) => {
                const optValue = isRichEnumOption(opt) ? opt.value : String(opt)
                const optLabel = isRichEnumOption(opt) ? opt.label : String(opt)
                const optDesc = isRichEnumOption(opt) ? opt.description : undefined
                const radioId = `${field.name}-${optValue}`
                const checked = enumValue === optValue

                return (
                  <label
                    key={optValue}
                    htmlFor={radioId}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      checked ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/50'
                    }`}
                  >
                    <input
                      type="radio"
                      id={radioId}
                      name={field.name}
                      value={optValue}
                      checked={checked}
                      onChange={() => onChange(optValue)}
                      className="mt-0.5 h-4 w-4 border-gray-300"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{optLabel}</span>
                      {optDesc && (
                        <p className="text-xs text-muted-foreground mt-0.5">{optDesc}</p>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          )
        } else {
          // Dropdown for large option sets or no options
          fieldElement = (
            <select
              id={field.name}
              value={enumValue}
              onChange={(e) => onChange(e.target.value)}
              className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${error ? 'border-red-500' : ''}`}
            >
              <option value="">{`Select ${field.label.toLowerCase()}`}</option>
              {enumOptions.map((opt) => {
                const optValue = isRichEnumOption(opt) ? opt.value : String(opt)
                const optLabel = isRichEnumOption(opt) ? opt.label : String(opt)
                return (
                  <option key={optValue} value={optValue}>{optLabel}</option>
                )
              })}
            </select>
          )
        }
        break
      }

      case 'array': {
        const arrayValue = Array.isArray(value) ? value : []

        // If options are provided, render as checkboxes (≤7) or multi-select listbox (>7)
        if (field.options && field.options.length > 0) {
          const isRichOption = (opt: string | number | RichOption): opt is RichOption =>
            typeof opt === 'object' && 'value' in opt

          const handleToggle = (optValue: string) => {
            if (arrayValue.includes(optValue)) {
              onChange(arrayValue.filter(v => v !== optValue))
            } else {
              onChange([...arrayValue, optValue])
            }
          }

          if (field.options.length <= 7) {
            // Checkboxes for small option sets
            fieldElement = (
              <div className="space-y-2">
                {field.options.map((opt) => {
                  const optValue = isRichOption(opt) ? opt.value : String(opt)
                  const optLabel = isRichOption(opt) ? opt.label : String(opt)
                  const optDesc = isRichOption(opt) ? opt.description : undefined
                  const checked = arrayValue.includes(optValue)
                  const checkboxId = `${field.name}-${optValue}`

                  return (
                    <label
                      key={optValue}
                      htmlFor={checkboxId}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        checked ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        id={checkboxId}
                        checked={checked}
                        onChange={() => handleToggle(optValue)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{optLabel}</span>
                        {optDesc && (
                          <p className="text-xs text-muted-foreground mt-0.5">{optDesc}</p>
                        )}
                      </div>
                    </label>
                  )
                })}
                {error && arrayValue.length === 0 && (
                  <p className="text-xs text-red-500">At least one option must be selected</p>
                )}
              </div>
            )
          } else {
            // Multi-select listbox for large option sets
            fieldElement = (
              <div className="space-y-1">
                <select
                  id={field.name}
                  multiple
                  value={arrayValue}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map(o => o.value)
                    onChange(selected)
                  }}
                  className={`flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${error ? 'border-red-500' : ''}`}
                  size={Math.min(field.options.length, 10)}
                >
                  {field.options.map((opt) => {
                    const optValue = isRichOption(opt) ? opt.value : String(opt)
                    const optLabel = isRichOption(opt) ? opt.label : String(opt)
                    return <option key={optValue} value={optValue}>{optLabel}</option>
                  })}
                </select>
                <p className="text-xs text-muted-foreground">Hold Ctrl / Cmd to select multiple</p>
                {error && arrayValue.length === 0 && (
                  <p className="text-xs text-red-500">At least one option must be selected</p>
                )}
              </div>
            )
          }
        } else {
          // No options — free-text array input (existing behavior)
          fieldElement = (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder={field.placeholder || 'Add item...'}
                  value={arrayInput}
                  onChange={(e) => setArrayInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleArrayAdd()
                    }
                  }}
                  className={error ? 'border-red-500' : ''}
                />
                <button
                  type="button"
                  onClick={handleArrayAdd}
                  className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                  Add
                </button>
              </div>
              {arrayValue.length > 0 && (
                <div className="space-y-1">
                  {arrayValue.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                      <span className="flex-1">{item}</span>
                      <button
                        type="button"
                        onClick={() => handleArrayRemove(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        }
        break
      }

      default:
        // Handle proofs field specially
        if (field.name === 'proofs') {
          // Parse existing proof from JSON string if present
          let proofValue = null
          if (typeof value === 'string' && value) {
            try {
              const parsed = JSON.parse(value)
              // If it's an array, take the first proof
              proofValue = Array.isArray(parsed) ? parsed[0] : parsed
            } catch {
              // Invalid JSON, ignore
            }
          }

          // Determine proof purpose from field config or default to commercial-tx
          // Use 'shared-control' for linking attestations (linked-identifier, key-binding)
          const proofPurpose = (field as any).proofPurpose || 'commercial-tx'

          fieldElement = (
            <ProofInput
              value={proofValue}
              onChange={(proof) => {
                // Store as JSON string array with single proof
                if (proof) {
                  onChange(JSON.stringify([proof]))
                } else {
                  onChange('')
                }
              }}
              defaultPurpose={proofPurpose}
              error={error}
            />
          )
        } else {
          fieldElement = (
            <Input
              id={field.name}
              type="text"
              placeholder={field.placeholder}
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => onChange(e.target.value)}
              className={error ? 'border-red-500' : ''}
            />
          )
        }
    }
  }

  // Single wrapper for ALL field types - no duplication
  return (
    <div className="space-y-2">
      <Label htmlFor={field.name} className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {field.description && (
        <p className="text-sm text-muted-foreground">{field.description}</p>
      )}
      {fieldElement}
      {error && <p className="text-sm text-red-500" data-testid="field-error">{error}</p>}
    </div>
  )
} 