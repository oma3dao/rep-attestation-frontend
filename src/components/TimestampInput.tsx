'use client'

import React, { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface TimestampInputProps {
  value: number | string | undefined
  onChange: (value: string) => void
  error?: string
  required?: boolean
  hasAutoDefault?: boolean
  className?: string
}

/**
 * TimestampInput
 * 
 * A datetime picker for Unix timestamp fields.
 * Converts between Unix timestamps (seconds) and datetime-local format for display.
 * Includes a checkbox to use default value (0 for optional fields, current time for auto-default fields).
 */
export function TimestampInput({
  value,
  onChange,
  error,
  required = false,
  hasAutoDefault = false,
  className = ''
}: TimestampInputProps) {
  // Determine if user wants to enter a custom date (checkbox checked)
  // Custom date is entered when value is NOT 0, empty, or undefined
  const [enterCustomDate, setEnterCustomDate] = useState(() => {
    return !(!value || value === '' || value === '0' || value === 0)
  })

  // Update enterCustomDate when value changes externally
  useEffect(() => {
    const hasValue = !!(value && value !== '' && value !== '0' && value !== 0)
    setEnterCustomDate(hasValue)
  }, [value])

  // Convert Unix timestamp to datetime-local format (YYYY-MM-DDTHH:mm)
  const timestampToDatetimeLocal = (timestamp: number | string | undefined): string => {
    if (!timestamp || timestamp === '' || timestamp === '0' || timestamp === 0) return ''
    const ts = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp
    if (isNaN(ts)) return ''
    const date = new Date(ts * 1000) // Convert seconds to milliseconds
    return date.toISOString().slice(0, 16) // Format: YYYY-MM-DDTHH:mm
  }

  // Convert datetime-local format to Unix timestamp
  const datetimeLocalToTimestamp = (datetimeLocal: string): string => {
    if (!datetimeLocal) return '0'  // Return 0 for empty input
    const date = new Date(datetimeLocal)
    const timestamp = Math.floor(date.getTime() / 1000)
    return timestamp.toString() // Convert to seconds
  }

  const handleCheckboxChange = (checked: boolean) => {
    setEnterCustomDate(checked)
    if (!checked) {
      onChange('0')  // Set to 0 when NOT entering custom date
    }
  }

  const datetimeValue = timestampToDatetimeLocal(value)
  const checkboxLabel = hasAutoDefault ? 'Override current time' : 'Enter custom date'

  // Show picker when:
  // - Checkbox is checked (user wants to enter a custom value), OR
  // - Field has autoDefault (always show for auto-default fields)
  const showPicker = enterCustomDate || hasAutoDefault

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="enter-custom-date"
          checked={enterCustomDate}
          onChange={(e) => handleCheckboxChange(e.target.checked)}
          className="h-4 w-4"
        />
        <Label htmlFor="enter-custom-date" className="text-sm font-normal cursor-pointer">
          {checkboxLabel}
        </Label>
      </div>
      {showPicker && (
        <Input
          type="datetime-local"
          value={datetimeValue}
          onChange={(e) => {
            setEnterCustomDate(true)
            onChange(datetimeLocalToTimestamp(e.target.value))
          }}
          disabled={!enterCustomDate && hasAutoDefault}
          className={`${error ? 'border-red-500' : ''} ${!enterCustomDate && hasAutoDefault ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
      )}
    </div>
  )
}
