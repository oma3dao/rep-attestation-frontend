'use client'

import { useState } from 'react'
import { AttestationSchema } from '@/config/schemas'
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

  // Group fields by required status
  const requiredFields = schema.fields.filter(field => field.required)
  const optionalFields = schema.fields.filter(field => !field.required)

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
      // Ensure all schema fields are present with empty strings for optional fields
      // This maintains compatibility with BAS indexers and search functionality
      const completeData: Record<string, any> = {}
      
      schema.fields.forEach(field => {
        const value = formData[field.name]
        if (value !== undefined && value !== null && value !== '') {
          completeData[field.name] = value
        } else {
          // Use empty string for missing optional fields to maintain search compatibility
          completeData[field.name] = field.type === 'array' ? [] : ''
        }
      })
      
      // Extract subject field for recipient
      const subjectField = schema.fields.find(field => 
        field.name === 'subject' || field.name === 'subjectId' || field.name === 'recipient'
      )
      
      if (!subjectField) {
        throw new Error('No subject field found in schema')
      }
      
      const subjectValue = completeData[subjectField.name] as string
      if (!subjectValue) {
        throw new Error('Subject field is required')
      }
      
      // Convert to CAIP-2 format if needed
      let recipient = subjectValue
      if (!recipient.startsWith('eip155:')) {
        // Assume it's an Ethereum address and convert to CAIP-2
        if (recipient.startsWith('0x') && recipient.length === 42) {
          recipient = `eip155:1:${recipient}` // Default to Ethereum mainnet
        } else {
          throw new Error('Invalid recipient address format')
        }
      }
      
      console.log('Submitting attestation:', {
        schema: schema.id,
        recipient,
        data: completeData
      })
      
      // TODO: Use BAS client here
      // const { createAttestation } = useBASClient()
      // const result = await createAttestation({
      //   schemaId: schema.id,
      //   recipient,
      //   data: completeData // Use completeData
      // })
      
      // Simulate API call for now
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      alert('Attestation submitted successfully!')
      
    } catch (error) {
      console.error('Submission error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Failed to submit attestation: ${errorMessage}`)
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
              {requiredFields.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Required Fields
                  </h3>
                </div>
              )}
              
              {requiredFields.map((field) => (
                <FieldRenderer
                  key={field.name}
                  field={field}
                  value={formData[field.name] || (field.type === 'array' ? [] : '')}
                  onChange={(value) => handleFieldChange(field.name, value)}
                  error={errors[field.name]}
                />
              ))}
              
              {optionalFields.length > 0 && (
                <>
                  <div className="border-t pt-6 mt-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Optional Fields
                    </h3>
                  </div>
                  
                  {optionalFields.map((field) => (
                    <FieldRenderer
                      key={field.name}
                      field={field}
                      value={formData[field.name] || (field.type === 'array' ? [] : '')}
                      onChange={(value) => handleFieldChange(field.name, value)}
                      error={errors[field.name]}
                    />
                  ))}
                </>
              )}
              
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