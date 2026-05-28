"use client"

import React, { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckIcon, AlertCircleIcon, InfoIcon } from "lucide-react"

interface DidJwkInputProps {
  value?: string
  onChange: (did: string | null) => void
  className?: string
  error?: string
}

/**
 * Input for did:jwk identifiers
 * Format: did:jwk:<base64url-encoded-JWK>
 */
export function DidJwkInput({
  value = "",
  onChange,
  className = "",
  error: externalError,
}: DidJwkInputProps) {
  const [jwkValue, setJwkValue] = useState("")
  const [internalError, setInternalError] = useState<string | null>(null)

  // Parse existing DID on mount
  useEffect(() => {
    if (value && value.startsWith("did:jwk:")) {
      setJwkValue(value.replace("did:jwk:", ""))
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setJwkValue(newValue)
    setInternalError(null)
  }

  const handleBlur = () => {
    if (!jwkValue.trim()) {
      onChange(null)
      return
    }

    // Basic validation: should be base64url characters
    if (!/^[A-Za-z0-9_-]+$/.test(jwkValue)) {
      setInternalError("Invalid format. Should be base64url-encoded (letters, digits, - and _ only)")
      onChange(null)
      return
    }

    // Try to decode and validate it's a JWK
    try {
      const decoded = atob(jwkValue.replace(/-/g, '+').replace(/_/g, '/'))
      const parsed = JSON.parse(decoded)
      if (!parsed.kty) {
        setInternalError("Decoded JWK is missing 'kty' (key type) field")
        onChange(null)
        return
      }
    } catch {
      setInternalError("Could not decode as valid JWK. Ensure it is base64url-encoded JSON with a 'kty' field.")
      onChange(null)
      return
    }

    const did = `did:jwk:${jwkValue}`
    onChange(did)
  }

  const completeDid = jwkValue ? `did:jwk:${jwkValue}` : ""
  const showError = externalError || internalError
  const errorMessage = externalError || internalError

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="grid gap-2">
        <Label htmlFor="did-jwk-value">Public Key (Base64url-encoded JWK)</Label>
        <div className="flex items-center border rounded-md">
          <span className="px-3 py-2 text-sm text-muted-foreground bg-muted border-r select-none">
            did:jwk:
          </span>
          <Input
            id="did-jwk-value"
            value={jwkValue}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="eyJrdHkiOiJFQyIs..."
            className={`border-0 font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0 ${showError ? "field-error" : ""}`}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Paste the base64url-encoded JWK public key
        </p>

        {/* Error */}
        {showError && (
          <div className="feedback-error">
            <AlertCircleIcon size={16} className="mt-0.5 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success */}
        {!showError && jwkValue && (
          <div className="feedback-success">
            <CheckIcon size={16} className="mt-0.5 flex-shrink-0" />
            <span>Valid JWK format</span>
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

      {/* Info about did:jwk */}
      <div className="muted-panel p-3">
        <div className="flex gap-2 items-start">
          <InfoIcon size={16} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
          <div className="flex-1 text-xs text-muted-foreground">
            <p className="font-medium mb-1">About did:jwk</p>
            <p>
              did:jwk encodes a JSON Web Key directly in the identifier. Useful for non-EVM 
              chains (Solana, Cosmos) where did:pkh may not have CAIP-2 support yet.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
