'use client'

import { FormField } from '@/config/schemas'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useState } from 'react'

interface FieldRendererProps {
  field: FormField
  value: string | string[]
  onChange: (value: string | string[]) => void
  error?: string
}

export function FieldRenderer({ field, value, onChange, error }: FieldRendererProps) {
  const [arrayInput, setArrayInput] = useState('')

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

  const renderField = () => {
    switch (field.type) {
      case 'string':
        if (field.name === 'reviewBody' || field.name === 'description') {
          return (
            <Textarea
              id={field.name}
              placeholder={field.placeholder}
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => onChange(e.target.value)}
              className={error ? 'border-red-500' : ''}
              rows={4}
            />
          )
        }
        return (
          <Input
            id={field.name}
            type="text"
            placeholder={field.placeholder}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            className={error ? 'border-red-500' : ''}
          />
        )

      case 'integer':
        return (
          <Input
            id={field.name}
            type="number"
            placeholder={field.placeholder}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            className={error ? 'border-red-500' : ''}
            min={field.min}
            max={field.max}
          />
        )

      case 'datetime':
        return (
          <Input
            id={field.name}
            type="datetime-local"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            className={error ? 'border-red-500' : ''}
          />
        )

      case 'uri':
        return (
          <Input
            id={field.name}
            type="url"
            placeholder={field.placeholder || 'https://example.com'}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            className={error ? 'border-red-500' : ''}
          />
        )

      case 'enum':
        return (
          <select
            id={field.name}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              error ? 'border-red-500' : ''
            }`}
          >
            <option value="">{`Select ${field.label.toLowerCase()}`}</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )

      case 'array':
        const arrayValue = Array.isArray(value) ? value : []
        return (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder={field.placeholder || 'Add item...'}
                value={arrayInput}
                onChange={(e) => setArrayInput(e.target.value)}
                onKeyPress={(e) => {
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

      default:
        return (
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

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name} className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {field.description && (
        <p className="text-sm text-muted-foreground">{field.description}</p>
      )}
      {renderField()}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
} 