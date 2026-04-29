"use client"

import React, { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckIcon, AlertCircleIcon, InfoIcon } from "lucide-react"

interface DidKeyInputProps {
  value?: string
  onChange: (did: string | null) => void
  className?: string
  error?: string
}

/**
 * Input for did:key identifiers
 * Format: did:key:<multibase-encoded-public-key>
 */
export function DidKeyInput({
  value = "",
  onChange,
  className = "",
  error: externalError,
}: DidKeyInputProps) {
  const [keyValue, setKeyValue] = useState("")
  const [internalError, setInternalError] = useState<string | null>(null)

  // Parse existing DID on mount
  useEffect(() => {
    if (value && value.startsWith("did:key:")) {
      setKeyValue(value.replace("did:key:", ""))
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value
    setKeyValue(newKey)
    setInternalError(null)
  }

  const handleBlur = () => {
    if (!keyValue.trim()) {
      onChange(null)
      return
    }

    // Basic validation for multibase format (should start with 'z' for base58btc)
    if (!keyValue.startsWith("z")) {
      setInternalError("Invalid did:key format. Should start with 'z' (base58btc encoding)")
      onChange(null)
      return
    }

    // Check minimum length (a valid key should be reasonably long)
    if (keyValue.length < 40) {
      setInternalError("Key value appears too short. Please check the format.")
      onChange(null)
      return
    }

    const did = `did:key:${keyValue}`
    onChange(did)
  }

  const completeDid = keyValue ? `did:key:${keyValue}` : ""
  const showError = externalError || internalError
  const errorMessage = externalError || internalError

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="grid gap-2">
        <Label htmlFor="did-key-value">Public Key (Multibase Encoded)</Label>
        <div className="flex items-center border rounded-md">
          <span className="px-3 py-2 text-sm text-muted-foreground bg-muted border-r select-none">
            did:key:
          </span>
          <Input
            id="did-key-value"
            value={keyValue}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="z6Mk..."
            className={`border-0 font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0 ${showError ? "field-error" : ""}`}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Enter the multibase-encoded public key (typically starts with &apos;z&apos; for base58btc)
        </p>

        {/* Error */}
        {showError && (
          <div className="feedback-error">
            <AlertCircleIcon size={16} className="mt-0.5 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success */}
        {!showError && keyValue && (
          <div className="feedback-success">
            <CheckIcon size={16} className="mt-0.5 flex-shrink-0" />
            <span>Valid key format</span>
          </div>
        )}
      </div>

      {/* Complete DID Preview */}
      {completeDid && (
        <div className="info-panel p-3">
          <div className="flex gap-2 items-start">
            <InfoIcon size={16} className="mt-0.5 flex-shrink-0 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="mb-1 text-xs font-medium">
                Complete DID:
              </p>
              <code className="block break-all text-xs font-mono text-muted-foreground">
                {completeDid}
              </code>
            </div>
          </div>
        </div>
      )}

      {/* Info about did:key */}
      <div className="muted-panel p-3">
        <div className="flex gap-2 items-start">
          <InfoIcon size={16} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
          <div className="flex-1 text-xs text-muted-foreground">
            <p className="font-medium mb-1">About did:key</p>
            <p>
              did:key is a self-certifying DID method where the identifier is derived directly 
              from a cryptographic public key. No blockchain or registry is required.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
