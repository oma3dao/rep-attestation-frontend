"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { HelpCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface FormFieldProps {
  label: string
  name: string
  type?: "text" | "email" | "url" | "date" | "datetime-local" | "number" | "textarea" | "array"
  value: string | string[]
  onChange: (value: string | string[]) => void
  required?: boolean
  description?: string
  placeholder?: string
  error?: string
}

export function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  required = false,
  description,
  placeholder,
  error,
}: FormFieldProps) {
  const handleArrayChange = (arrayValue: string) => {
    const items = arrayValue
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
    onChange(items)
  }

  const arrayValue = Array.isArray(value) ? value.join(", ") : ""

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Label htmlFor={name} className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {description && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {type === "textarea" ? (
        <Textarea
          id={name}
          name={name}
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={error ? "border-red-500" : ""}
          rows={3}
        />
      ) : type === "array" ? (
        <Input
          id={name}
          name={name}
          value={arrayValue}
          onChange={(e) => handleArrayChange(e.target.value)}
          placeholder={placeholder || "Enter items separated by commas"}
          className={error ? "border-red-500" : ""}
        />
      ) : (
        <Input
          id={name}
          name={name}
          type={type}
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={error ? "border-red-500" : ""}
        />
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
