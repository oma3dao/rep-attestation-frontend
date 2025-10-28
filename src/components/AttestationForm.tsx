'use client'

import React from 'react'
import { useState, useEffect, useRef } from 'react'
import { AttestationSchema } from '@/config/schemas'
import { FieldRenderer } from './FieldRenderer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Send } from 'lucide-react'
import Link from 'next/link'
import { useAttestation } from '@/lib/service'
import { useToast } from '@/components/ui/toast'
import logger from '@/lib/logger';

interface AttestationFormProps {
  schema: AttestationSchema
  validateForm?: (formData: Record<string, any>) => Record<string, string>
}

type FormData = Record<string, string | string[]>
type FormErrors = Record<string, string>

export function validateField(field: any, value: any): string | undefined {
  if (field.required) {
    if (!value || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && value.length === 0)) {
      return `${field.label} is required`;
    }
  }
  if (value && typeof value === 'string') {
    const trimmedValue = value.trim();
    
    // String length validation
    if (field.minLength !== undefined && trimmedValue.length < field.minLength) {
      return `${field.label} must be at least ${field.minLength} characters`;
    }
    if (field.maxLength !== undefined && trimmedValue.length > field.maxLength) {
      return `${field.label} must be at most ${field.maxLength} characters`;
    }
    
    if (field.type === 'uri' && trimmedValue) {
      try {
        new URL(value);
      } catch {
        return 'Please enter a valid URL';
      }
    }
    if (field.type === 'integer') {
      const num = parseInt(value);
      if (isNaN(num)) {
        return 'Please enter a valid number';
      } else {
        if (field.min !== undefined && num < field.min) {
          return `Value must be at least ${field.min}`;
        }
        if (field.max !== undefined && num > field.max) {
          return `Value must be at most ${field.max}`;
        }
      }
    }
  }
  return undefined;
}

export function AttestationForm({ schema, validateForm }: AttestationFormProps) {
  const [formData, setFormData] = useState<FormData>({})
  const [errors, setErrors] = useState<FormErrors>({})
  const [generalError, setGeneralError] = useState<string | null>(null)

  // Get attestation service - this handles all service selection and wallet management
  const {
    submitAttestation,
    isSubmitting,
    isConnected,
    isNetworkSupported,
    lastError,
    clearError
  } = useAttestation()

  // Toast for wallet approval
  const { showToast, ToastContainer, dismissToast } = useToast()
  const prevIsSubmitting = useRef(false)
  const approvalToastId = useRef<string | null>(null)
  useEffect(() => {
    if (isSubmitting && !prevIsSubmitting.current) {
      approvalToastId.current = showToast('Please check your wallet and approve the transaction.', 'info', 60000)
    }
    prevIsSubmitting.current = isSubmitting
  }, [isSubmitting, showToast])

  // Dismiss toast on success or error
  useEffect(() => {
    if (!isSubmitting && approvalToastId.current) {
      dismissToast(approvalToastId.current)
      approvalToastId.current = null
    }
  }, [isSubmitting, dismissToast])

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

  const validateFormInternal = (): boolean => {
    if (validateForm) {
      const newErrors = validateForm(formData)
      setErrors(newErrors)
      // Debug log
      logger.log('validateForm newErrors:', newErrors)
      return Object.keys(newErrors).length === 0
    }
    const newErrors: FormErrors = {}

    schema.fields.forEach(field => {
      const value = formData[field.name]

      const error = validateField(field, value)
      if (error) {
        newErrors[field.name] = error
      }
    })
    // Debug log
    logger.log('validateForm newErrors:', newErrors)
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralError(null)
    if (!validateFormInternal()) {
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

      logger.log('Submitting attestation:', {
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

      logger.log('Attestation created successfully:', result)

      // Show success message with transaction details
      alert(`Attestation submitted successfully!\n\nTransaction Hash: ${result.transactionHash}\nAttestation ID: ${result.attestationId}\nBlock Number: ${result.blockNumber}`)

      // Reset form after successful submission
      setFormData({})

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setGeneralError(errorMessage)
      logger.error('Submission error:', error)
    }
  }

  // Determine if submit should be enabled
  const canSubmit = isConnected && isNetworkSupported

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <ToastContainer position="center" />
        {(generalError || lastError) && (
          <div className="bg-red-100 text-red-800 px-4 py-2 rounded mb-4" data-testid="form-error">
            {generalError || lastError}
          </div>
        )}
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">{schema.title}</h1>

          <p className="text-lg text-muted-foreground">
            {schema.description}
          </p>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardDescription>
              Fields marked with * are required.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
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