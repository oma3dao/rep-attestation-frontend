'use client'

import { useState } from 'react'
import { AttestationSchema } from '@/config/schemas'
import { FieldRenderer } from './FieldRenderer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Send } from 'lucide-react'
import Link from 'next/link'
import { useAttestation } from '@/lib/service'

interface AttestationFormProps {
  schema: AttestationSchema
}

type FormData = Record<string, string | string[]>
type FormErrors = Record<string, string>

export function AttestationForm({ schema }: AttestationFormProps) {
  const [formData, setFormData] = useState<FormData>({})
  const [errors, setErrors] = useState<FormErrors>({})

  // Get attestation service - this handles all service selection and wallet management
  const { 
    submitAttestation, 
    isSubmitting, 
    isConnected, 
    isNetworkSupported,
    lastError,
    clearError 
  } = useAttestation()

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
    
    // Clear service error when user makes changes
    if (lastError) {
      clearError()
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
      
      // Validate that recipient is in DID format (no automatic conversion)
      const recipient = subjectValue
      
      // Check if it's a valid DID format
      if (!recipient.startsWith('did:')) {
        // If it's an Ethereum address, tell user to convert it
        if (recipient.startsWith('0x') && recipient.length === 42) {
          throw new Error(`Please convert Ethereum address to DID format. For example, use "did:pkh:eip155:1:${recipient}" or "did:ethr:${recipient}" instead of "${recipient}"`)
        }
        // If it's a CAIP-10 address, tell user to convert it
        else if (recipient.startsWith('eip155:')) {
          throw new Error(`Please convert CAIP-10 address to DID format. For example, use "did:pkh:${recipient}" instead of "${recipient}"`)
        }
        // If it looks like an email or domain, suggest using proper DID format
        else if (recipient.includes('@') || recipient.includes('.')) {
          throw new Error(`Please use DID format for identifiers. For example, use "did:web:${recipient}" instead of "${recipient}"`)
        }
        // For other identifier formats, require DID format
        else if (recipient.trim().length > 0) {
          throw new Error(`Recipient must be in DID format. You entered: "${subjectValue}". Please use a valid DID like "did:web:example.com", "did:pkh:eip155:1:0x...", or "did:ethr:0x..."`)
        }
        else {
          throw new Error(`Recipient is required and must be in DID format. Please enter a valid DID like "did:web:example.com", "did:pkh:eip155:1:0x...", or "did:ethr:0x..."`)
        }
      }
      
      // Basic DID format validation
      if (recipient.length < 7 || !recipient.includes(':')) {
        throw new Error(`Invalid DID format: "${recipient}". DIDs must follow the format "did:method:identifier"`)
      }
      
      console.log('Submitting attestation:', {
        schema: schema.id,
        recipient,
        data: completeData
      })
      
      // Use the service layer to submit attestation
      const result = await submitAttestation({
        schemaId: schema.id,
        recipient,
        data: completeData
      })
      
      console.log('Attestation created successfully:', result)
      
      // Show success message with transaction details
      alert(`Attestation submitted successfully!\n\nTransaction Hash: ${result.transactionHash}\nAttestation ID: ${result.attestationId}\nBlock Number: ${result.blockNumber}`)
      
      // Reset form after successful submission
      setFormData({})
      
    } catch (error) {
      console.error('Submission error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Failed to submit attestation: ${errorMessage}`)
    }
  }

  // Determine if submit should be enabled
  const canSubmit = isConnected && isNetworkSupported

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
                  disabled={isSubmitting || !canSubmit}
                  className="flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Submitting...
                    </>
                  ) : !isConnected ? (
                    <>
                      <Send className="h-4 w-4" />
                      Connect Wallet to Submit
                    </>
                  ) : !isNetworkSupported ? (
                    <>
                      <Send className="h-4 w-4" />
                      Switch to Supported Network
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

              {/* Wallet Connection Status */}
              {!canSubmit && (
                <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2">Connection Required</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {!isConnected && (
                      <p>• Please connect your wallet using the button in the header</p>
                    )}
                    {isConnected && !isNetworkSupported && (
                      <p>• Please switch to a supported network for attestations</p>
                    )}
                  </div>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 