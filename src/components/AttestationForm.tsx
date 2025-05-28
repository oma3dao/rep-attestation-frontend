'use client'

import { useState } from 'react'
import { AttestationSchema } from '@/lib/schemas'
import { FieldRenderer } from './FieldRenderer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Send } from 'lucide-react'
import Link from 'next/link'

interface AttestationFormProps {
  schema: AttestationSchema
}

type FormData = Record<string, string | string[]>
type FormErrors = Record<string, string>

export function AttestationForm({ schema }: AttestationFormProps) {
  const [formData, setFormData] = useState<FormData>({})
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleFieldChange = (fieldName: string, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }))
    
    // Clear error when user starts typing
    if (errors[fieldName]) {
      setErrors(prev => ({
        ...prev,
        [fieldName]: ''
      }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}
    
    schema.fields.forEach(field => {
      const value = formData[field.name]
      
      if (field.required) {
        if (!value || (typeof value === 'string' && !value.trim()) || 
            (Array.isArray(value) && value.length === 0)) {
          newErrors[field.name] = `${field.label} is required`
        }
      }
      
      // Type-specific validation
      if (value && typeof value === 'string') {
        if (field.type === 'uri' && value.trim()) {
          try {
            new URL(value)
          } catch {
            newErrors[field.name] = 'Please enter a valid URL'
          }
        }
        
        if (field.type === 'integer') {
          const num = parseInt(value)
          if (isNaN(num)) {
            newErrors[field.name] = 'Please enter a valid number'
          } else {
            if (field.min !== undefined && num < field.min) {
              newErrors[field.name] = `Value must be at least ${field.min}`
            }
            if (field.max !== undefined && num > field.max) {
              newErrors[field.name] = `Value must be at most ${field.max}`
            }
          }
        }
      }
    })
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // TODO: Implement actual submission logic in Phase 5
      console.log('Submitting attestation:', {
        schema: schema.id,
        data: formData
      })
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // TODO: Show success message and redirect
      alert('Attestation submitted successfully!')
      
    } catch (error) {
      console.error('Submission error:', error)
      alert('Failed to submit attestation. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/attest" 
            className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to attestation types
          </Link>
          
          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-3xl font-bold">{schema.title}</h1>
            <Badge variant="secondary">
              {schema.fields.length} fields
            </Badge>
          </div>
          
          <p className="text-lg text-muted-foreground">
            {schema.description}
          </p>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Attestation Details</CardTitle>
            <CardDescription>
              Fill out the form below to create your {schema.title.toLowerCase()} attestation.
              Fields marked with * are required.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {schema.fields.map((field) => (
                <FieldRenderer
                  key={field.name}
                  field={field}
                  value={formData[field.name] || (field.type === 'array' ? [] : '')}
                  onChange={(value) => handleFieldChange(field.name, value)}
                  error={errors[field.name]}
                />
              ))}
              
              <div className="flex gap-4 pt-6">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Submit Attestation
                    </>
                  )}
                </Button>
                
                <Button type="button" variant="outline" asChild>
                  <Link href="/attest">Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 