'use client'

import React from 'react'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useActiveAccount } from 'thirdweb/react'
import { AttestationSchema } from '@/config/schemas'
import { FieldRenderer } from './FieldRenderer'
import { EvidencePointerProofInput } from './EvidencePointerProofInput'
import { SubjectConfirmationDialog } from '@/components/subject-confirmation-dialog'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Send } from 'lucide-react'
import Link from 'next/link'
import { useAttestation } from '@/lib/service'
import { getActiveChain } from '@/lib/blockchain'
import { CONTROLLER_WITNESS_CONFIG } from '@/config/attestation-services'
import { createEvidencePointerProof } from '@oma3/omatrust/reputation'
import { useBackendSession } from '@/components/backend-session-provider'
import {
  BackendApiError,
  buildWalletDid,
  deriveSubjectUrlHint,
  getBackendErrorMessage,
  logoutSession,
  shouldRouteBackendErrorToAccount,
  type BackendSubject,
} from '@/lib/omatrust-backend'
import logger from '@/lib/logger';

interface AttestationFormProps {
  schema: AttestationSchema
  validateForm?: (formData: Record<string, any>) => Record<string, string>
}

type FormData = Record<string, string | string[]>
type FormErrors = Record<string, string>
const SUBJECT_SCOPED_SCHEMA_IDS = new Set(['key-binding', 'linked-identifier', 'user-review-response'])

export function validateField(field: any, value: any): string | undefined {
  if (field.required) {
    const isEmpty = !value || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && value.length === 0)
    if (isEmpty && !field.autoDefault) {
      return `${field.label} is required`;
    }
  }
  if (value && typeof value === 'string') {
    const trimmedValue = value.trim();
    
    if (field.minLength !== undefined && trimmedValue.length < field.minLength) {
      return `${field.label} must be at least ${field.minLength} characters`;
    }
    if (field.maxLength !== undefined && trimmedValue.length > field.maxLength) {
      return `${field.label} must be at most ${field.maxLength} characters`;
    }
    
    if (field.pattern && trimmedValue) {
      try {
        const regex = new RegExp(field.pattern);
        if (!regex.test(trimmedValue)) {
          if (field.subtype === 'semver') {
            return `${field.label} must be a valid version (e.g., 1, 1.2, or 1.2.3)`;
          }
          return `${field.label} format is invalid`;
        }
      } catch {
        // Invalid regex pattern in schema - skip validation
      }
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
  const router = useRouter()
  const [formData, setFormData] = useState<FormData>({})
  const [errors, setErrors] = useState<FormErrors>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [showAccountAction, setShowAccountAction] = useState(false)
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false)
  const [subjectDialogMessage, setSubjectDialogMessage] = useState<string | null>(null)
  const pendingSubmitDataRef = useRef<Record<string, any> | null>(null)
  const { session, setSession, openAuthDialog } = useBackendSession()
  const activeAccount = useActiveAccount()

  const {
    submitAttestation,
    isSubmitting,
    lastError,
    clearError
  } = useAttestation()

  const submissionStatusMessage =
    session?.wallet?.executionMode === 'subscription'
      ? session.wallet.isManagedWallet
        ? 'Submitting with your OMATrust subscription.'
        : 'Check your wallet to sign the attestation request, then return here. OMATrust will sponsor the on-chain write.'
      : 'Please check your wallet and approve the transaction.'

  const requiredFields = schema.fields.filter(field => field.required)
  const optionalFields = schema.fields.filter(field => !field.required)

  const handleFieldChange = (fieldName: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }))

    if (errors[fieldName]) {
      setErrors(prev => ({ ...prev, [fieldName]: '' }))
    }
    if (lastError) {
      clearError()
    }
    if (generalError) {
      setGeneralError(null)
      setShowAccountAction(false)
    }
  }

  const validateFormInternal = (): boolean => {
    if (validateForm) {
      const newErrors = validateForm(formData)
      setErrors(newErrors)
      return Object.keys(newErrors).length === 0
    }
    const newErrors: FormErrors = {}
    schema.fields.forEach(field => {
      const error = validateField(field, formData[field.name])
      if (error) {
        newErrors[field.name] = error
      }
    })
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const buildCompleteData = () => {
    const completeData: Record<string, any> = {}

    schema.fields.forEach(field => {
      const value = formData[field.name]
      if (value !== undefined && value !== null && value !== '') {
        completeData[field.name] = value
      } else if (field.autoDefault === 'current-timestamp') {
        completeData[field.name] = Math.floor(Date.now() / 1000)
      } else {
        completeData[field.name] = field.type === 'array' ? [] : field.type === 'integer' ? 0 : ''
      }
    })

    if (schema.easSchemaString) {
      const easFields = schema.easSchemaString.split(',').map(f => f.trim().split(/\s+/))
      for (const [type, name] of easFields) {
        if (name && completeData[name] === undefined) {
          if (type.endsWith('[]')) {
            completeData[name] = []
          } else if (type.startsWith('uint') || type.startsWith('int')) {
            completeData[name] = 0
          } else {
            completeData[name] = ''
          }
        }
      }
    }

    if (isWitnessSchema && typeof completeData['proofs'] === 'string' && completeData['proofs']) {
      completeData['proofs'] = [createEvidencePointerProof(completeData['proofs'])]
    }

    if (schema.easSchemaString) {
      const arrayFieldNames = schema.easSchemaString
        .split(',')
        .map(f => f.trim().split(/\s+/))
        .filter(([type]) => type?.endsWith('[]'))
        .map(([, name]) => name)

      for (const name of arrayFieldNames) {
        let arr = completeData[name]
        if (typeof arr === 'string') {
          try { arr = JSON.parse(arr) } catch { arr = arr ? [arr] : [] }
        }
        if (!Array.isArray(arr)) {
          arr = arr ? [arr] : []
        }
        completeData[name] = arr.map((item: unknown) =>
          typeof item === 'string' ? item : JSON.stringify(item)
        )
      }
    }

    if (CONTROLLER_WITNESS_CONFIG.graceSchemaIds.includes(schema.id)) {
      const userExplicitlySetEffectiveAt = formData['effectiveAt'] !== undefined && formData['effectiveAt'] !== ''
      if (!userExplicitlySetEffectiveAt) {
        completeData['effectiveAt'] = Math.floor(Date.now() / 1000) + CONTROLLER_WITNESS_CONFIG.graceSeconds
      }
    }

    return completeData
  }

  const submitPreparedAttestation = async (completeData: Record<string, any>) => {
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

    const recipient = subjectValue

    if (!recipient.startsWith('did:')) {
      if (recipient.startsWith('0x') && recipient.length === 42) {
        throw new Error(`Please convert Ethereum address to DID format. For example, use "did:pkh:eip155:1:${recipient}" or "did:ethr:${recipient}" instead of "${recipient}"`)
      } else if (recipient.startsWith('eip155:')) {
        throw new Error(`Please convert CAIP-10 address to DID format. For example, use "did:pkh:${recipient}" instead of "${recipient}"`)
      } else if (recipient.includes('@') || recipient.includes('.')) {
        throw new Error(`Please use DID format for identifiers. For example, use "did:web:${recipient}" instead of "${recipient}"`)
      } else if (recipient.trim().length > 0) {
        throw new Error(`Recipient must be in DID format. You entered: "${subjectValue}". Please use a valid DID like "did:web:example.com", "did:pkh:eip155:1:0x...", "did:handle:twitter:username", or "did:key:z6Mk..."`)
      } else {
        throw new Error(`Recipient is required and must be in DID format. Please enter a valid DID like "did:web:example.com", "did:pkh:eip155:1:0x...", "did:handle:twitter:username", or "did:key:z6Mk..."`)
      }
    }

    if (recipient.length < 7 || !recipient.includes(':')) {
      throw new Error(`Invalid DID format: "${recipient}". DIDs must follow the format "did:method:identifier"`)
    }

    logger.log('Submitting attestation:', { schema: schema.id, recipient, data: completeData })

    const result = await submitAttestation({
      schemaId: schema.id,
      recipient,
      data: completeData
    })

    logger.log('Attestation created successfully:', result)
    setFormData({})
    router.push('/dashboard')
  }

  /**
   * Extract the subject DID from the built attestation data.
   */
  const extractSubjectDid = (completeData: Record<string, any>): string => {
    return (
      typeof completeData.subject === 'string' ? completeData.subject
      : typeof completeData.subjectId === 'string' ? completeData.subjectId
      : typeof completeData.recipient === 'string' ? completeData.recipient
      : ''
    )
  }

  /**
   * Submission gate:
   *
   * Gate 1 — Session + Wallet (2×2 matrix)
   * Subject ownership — enforced by the backend. If the backend returns
   * SUBJECT_OWNERSHIP_REQUIRED, the frontend opens the SubjectOwnershipDialog
   * and auto-submits after verification.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralError(null)
    setShowAccountAction(false)
    if (!validateFormInternal()) return

    try {
      const completeData = buildCompleteData()

      const hasSession = !!session
      const hasWallet = !!activeAccount

      // --- Gate 1: Session + Wallet ---

      if (!hasSession || !hasWallet) {
        if (hasSession && !hasWallet) {
          try { await logoutSession() } catch { /* best-effort */ }
          setSession(null)
        }

        const subjectValue = extractSubjectDid(completeData)
        openAuthDialog({
          mode: 'chooser',
          reason: 'submission',
          schemaId: schema.id,
          schemaTitle: schema.title,
          subjectScoped: SUBJECT_SCOPED_SCHEMA_IDS.has(schema.id),
          subjectHint: deriveSubjectUrlHint(subjectValue),
        })
        return
      }

      // --- Submit (backend enforces subject ownership for subject-scoped schemas) ---
      await submitPreparedAttestation(completeData)
    } catch (error) {
      // Handle SUBJECT_OWNERSHIP_REQUIRED from the backend relay
      if (error instanceof BackendApiError && error.code === 'SUBJECT_OWNERSHIP_REQUIRED') {
        logger.log('[AttestationForm] Backend requires subject ownership proof, opening dialog')
        pendingSubmitDataRef.current = buildCompleteData()
        setSubjectDialogMessage(
          'Subject ownership verification failed. Re-confirm your proof and try again.  Failure explanation- ' + (error.details || error.message)
        )
        setSubjectDialogOpen(true)
        return
      }

      const errorMessage = getBackendErrorMessage(error)
      setShowAccountAction(shouldRouteBackendErrorToAccount(error))
      setGeneralError(errorMessage)
      logger.error('Submission error:', error)
    }
  }

  /**
   * Called when the SubjectOwnershipDialog successfully verifies and
   * attaches a subject. Auto-submits the pending attestation.
   */
  const handleSubjectVerified = async (_subject: BackendSubject) => {
    setSubjectDialogOpen(false)
    const completeData = pendingSubmitDataRef.current
    pendingSubmitDataRef.current = null

    if (!completeData) return

    try {
      await submitPreparedAttestation(completeData)
    } catch (error) {
      const errorMessage = getBackendErrorMessage(error)
      setShowAccountAction(shouldRouteBackendErrorToAccount(error))
      setGeneralError(errorMessage)
      logger.error('Submission error after subject verification:', error)
    }
  }

  const isWitnessSchema = !!schema.witness
  const controllerFieldName = schema.witness?.controllerField

  const renderField = (field: typeof schema.fields[0]) => {
    if (isWitnessSchema && field.name === 'proofs') {
      const subjectDid = (formData['subject'] as string) || ''
      const controllerDid = controllerFieldName ? (formData[controllerFieldName] as string) || '' : ''
      const proofUrl = (formData['proofs'] as string) || ''

      return (
        <div key={field.name} className="space-y-2">
          <Label htmlFor={field.name} className="text-sm font-medium">
            {field.label}
            {field.required && <span className="ml-1 text-destructive">*</span>}
          </Label>
          {field.description && (
            <p className="text-sm text-muted-foreground">{field.description}</p>
          )}
          <EvidencePointerProofInput
            subjectDid={subjectDid}
            controllerDid={controllerDid}
            value={proofUrl}
            onChange={(url) => handleFieldChange('proofs', url)}
            error={errors[field.name]}
          />
          {errors[field.name] && <p className="text-sm text-destructive" data-testid="field-error">{errors[field.name]}</p>}
        </div>
      )
    }

    return (
      <FieldRenderer
        key={field.name}
        field={field}
        value={formData[field.name] || (field.type === 'array' ? [] : '')}
        onChange={(value) => handleFieldChange(field.name, value)}
        error={errors[field.name]}
      />
    )
  }

  const walletDid = activeAccount?.address
    ? buildWalletDid(activeAccount.address, getActiveChain().id)
    : null

  return (
    <>
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {(generalError || lastError) && (
          <div className="status-panel-error mb-4 space-y-3 px-4 py-3" data-testid="form-error">
            <p>{generalError || lastError}</p>
            {showAccountAction ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/account">Manage account</Link>
              </Button>
            ) : null}
          </div>
        )}

        <div className="mb-8">
          <h1 className="mb-4 text-3xl font-semibold tracking-tight">{schema.title}</h1>
          <p className="text-lg text-muted-foreground">{schema.description}</p>
        </div>

        <Card>
          <CardHeader>
            <CardDescription>Fields marked with * are required.</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {requiredFields.map((field) => renderField(field))}
              {optionalFields.length > 0 && optionalFields.map((field) => renderField(field))}

              <div className="flex flex-wrap gap-4 pt-6">
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
                  <Link href="/publish">Cancel</Link>
                </Button>
              </div>

              {isSubmitting ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                  {submissionStatusMessage}
                </div>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>

    <SubjectConfirmationDialog
      open={subjectDialogOpen}
      onOpenChange={(open) => {
        setSubjectDialogOpen(open)
        if (!open) {
          pendingSubmitDataRef.current = null
          setSubjectDialogMessage(null)
        }
      }}
      walletDid={walletDid}
      existingSubjectDids={[]}
      initialMessage={subjectDialogMessage}
      onSubjectCreated={(subject) => {
        void handleSubjectVerified(subject)
      }}
    />
    </>
  )
}
