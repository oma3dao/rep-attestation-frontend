'use client'

import React from 'react'
import { useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useActiveAccount } from 'thirdweb/react'
import { AttestationSchema } from '@/config/schemas'
import { FieldRenderer } from './FieldRenderer'
import { SubjectConfirmationDialog } from '@/components/subject-confirmation-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Send } from 'lucide-react'
import Link from 'next/link'
import { useAttestation } from '@/lib/service'
import { getActiveChain } from '@/lib/blockchain'
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
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState<FormData>({})
  const [errors, setErrors] = useState<FormErrors>({})
  const [generalError, setGeneralErrorRaw] = useState<string | null>(null)
  const setGeneralError = (message: string | null) => {
    setGeneralErrorRaw(message)
    if (message) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }
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

  // Pre-fill form fields from URL query parameters (e.g., ?subject=did:web:example.com)
  React.useEffect(() => {
    setFormData(prev => {
      const next = { ...prev }
      let changed = false

      for (const field of schema.fields) {
        const existingValue = next[field.name]
        const hasExistingValue = Array.isArray(existingValue)
          ? existingValue.length > 0
          : typeof existingValue === 'string' && existingValue.length > 0
        if (hasExistingValue) continue

        if (field.type === 'array') {
          const values = searchParams.getAll(field.name).filter(Boolean)
          if (values.length > 0) {
            next[field.name] = values
            changed = true
          }
          continue
        }

        const value = searchParams.get(field.name)
        if (value !== null) {
          next[field.name] = value
          changed = true
        } else if ((field as any).default !== undefined) {
          next[field.name] = String((field as any).default)
          changed = true
        }
      }

      return changed ? next : prev
    })
  }, [schema.fields, searchParams])

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

  // Mirrors the key-binding schema's allOf rule (1.0.1): publicKeyJwk is hidden
  // when the keyId already contains the full key (did:jwk embeds it; a Solana
  // address is the raw ed25519 public key), optional for did:pkh:eip155 (the key
  // is recoverable from any ECDSA signature), and required for every other keyId
  // method (hash-based addresses like Sui or Cosmos). Returns null when hidden.
  const resolvePublicKeyJwkField = (field: typeof schema.fields[0]) => {
    const keyId = typeof formData['keyId'] === 'string' ? formData['keyId'] : ''
    if (keyId.startsWith('did:jwk:') || keyId.startsWith('did:pkh:eip155:') || keyId.startsWith('did:pkh:solana:')) return null
    if (keyId) return { ...field, required: true }
    return field
  }

  const validateFormInternal = (): boolean => {
    if (validateForm) {
      const newErrors = validateForm(formData)
      setErrors(newErrors)
      return Object.keys(newErrors).length === 0
    }
    const newErrors: FormErrors = {}
    schema.fields.forEach(field => {
      const effective = field.name === 'publicKeyJwk' ? resolvePublicKeyJwkField(field) : field
      if (!effective) return
      const error = validateField(effective, formData[field.name])
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

    // Route to dashboard with the appropriate context based on schema type
    const contextMap: Record<string, string> = {
      'user-review': 'review',
      'user-review-response': 'review',
      'key-binding': 'service-management',
      'controller-witness': 'service-management',
      'linked-identifier': 'service-management',
      'security-assessment': 'issuer',
      'certification': 'issuer',
    }
    const ctx = contextMap[schema.id]
    router.push(ctx ? `/dashboard?context=${ctx}` : '/dashboard')
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

  // Track whether the optional proofs section is expanded
  const [proofsExpanded, setProofsExpanded] = useState(false)
  // Track whether the optional publicKeyJwk section is expanded
  const [publicKeyExpanded, setPublicKeyExpanded] = useState(false)

  const renderField = (field: typeof schema.fields[0]) => {
    // Conditional visibility: hide proofs field unless method is 'proof'
    // Only applies to schemas that have a 'method' field (e.g., linked-identifier)
    if (field.name === 'proofs' && schema.fields.some(f => f.name === 'method') && formData['method'] !== 'proof') {
      return null
    }

    // Collapsible proofs for key-binding and linked-identifier when subject is did:web or did:pkh
    // (verification is implicit via controller witness, DNS TXT, or wallet signing)
    if (field.name === 'proofs' && SUBJECT_SCOPED_SCHEMA_IDS.has(schema.id)) {
      const subject = typeof formData['subject'] === 'string' ? formData['subject'] : ''
      if (subject.startsWith('did:web:') || subject.startsWith('did:pkh:')) {
        return (
          <div key={field.name} className="space-y-2">
            <button
              type="button"
              onClick={() => setProofsExpanded(!proofsExpanded)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className={`transition-transform ${proofsExpanded ? 'rotate-90' : ''}`}>▶</span>
              <span>Add proof manually</span>
              <span className="text-xs">(optional — controller witness provides verification)</span>
            </button>
            {proofsExpanded && (
              <FieldRenderer
                field={field}
                value={formData[field.name] || []}
                onChange={(value) => handleFieldChange(field.name, value)}
                error={errors[field.name]}
              />
            )}
          </div>
        )
      }
    }

    // publicKeyJwk visibility and requiredness depend on keyId (schema allOf rule)
    if (field.name === 'publicKeyJwk') {
      const resolved = resolvePublicKeyJwkField(field)
      if (!resolved) {
        const keyId = typeof formData['keyId'] === 'string' ? formData['keyId'] : ''
        // did:pkh:eip155 — key is recoverable but not embedded, show collapsible
        if (keyId.startsWith('did:pkh:eip155:')) {
          return (
            <div key={field.name} className="space-y-2">
              <button
                type="button"
                onClick={() => setPublicKeyExpanded(!publicKeyExpanded)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className={`transition-transform ${publicKeyExpanded ? 'rotate-90' : ''}`}>▶</span>
                <span>Add optional public key</span>
                <span className="text-xs">(not common)</span>
              </button>
              {publicKeyExpanded && (
                <FieldRenderer
                  field={{ ...field, required: false }}
                  value={formData[field.name] || ''}
                  onChange={(value) => handleFieldChange(field.name, value)}
                  error={errors[field.name]}
                />
              )}
            </div>
          )
        }
        // did:jwk or did:pkh:solana — key is embedded in the DID, hide entirely
        return null
      }
      field = resolved
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
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {schema.fields.map((field) => renderField(field))}

              {isSubmitting ? (
                <div className="rounded-xl border border-yellow-500/30 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-500/20 dark:bg-yellow-950/30 dark:text-yellow-200">
                  {submissionStatusMessage}
                </div>
              ) : null}

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
