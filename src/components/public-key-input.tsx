"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircleIcon, CheckIcon, InfoIcon, ShieldAlertIcon } from "lucide-react"
import {
  convertToDidJwk,
  detectFormat,
  PublicKeyConversionError,
  type ConversionResult,
  type DetectedFormat,
} from "@/lib/public-key-to-jwk"

interface PublicKeyInputProps {
  /** The resolved did:jwk value (controlled) */
  value?: string
  /** Called with the resolved did:jwk or null on error/empty */
  onChange: (did: string | null) => void
  /** External error message */
  error?: string
  /** Additional CSS classes */
  className?: string
  /** Label text override */
  label?: string
}

const FORMAT_LABELS: Record<DetectedFormat, string> = {
  "pem-spki": "PEM (SPKI public key)",
  "pem-x509": "X.509 certificate",
  "pem-pkcs1-rsa": "PEM (PKCS#1 RSA)",
  "jwk-json": "JWK JSON",
  "did-jwk": "did:jwk identifier",
  "did-key": "did:key identifier (legacy)",
  "hex-secp256k1": "Hex secp256k1 public key",
  "base64url-jwk": "Base64url-encoded JWK",
  "ssh-pubkey": "SSH public key",
  "unknown": "Unknown format",
}

/**
 * PublicKeyInput — a universal public key input widget.
 *
 * Accepts public keys in any format (PEM, JWK, hex, did:key, did:jwk, base64url)
 * and auto-detects the format, converts to did:jwk, and emits the result.
 *
 * Rejects private key material with a clear error.
 */
export function PublicKeyInput({
  value = "",
  onChange,
  error: externalError,
  className = "",
  label = "Public Key",
}: PublicKeyInputProps) {
  const [rawInput, setRawInput] = useState("")
  const [result, setResult] = useState<ConversionResult | null>(null)
  const [internalError, setInternalError] = useState<string | null>(null)
  const [isPrivateKeyError, setIsPrivateKeyError] = useState(false)
  const [isConverting, setIsConverting] = useState(false)

  // Sync rawInput from external value on mount (for edit mode)
  useEffect(() => {
    if (value && value.startsWith("did:jwk:") && !rawInput) {
      setRawInput(value)
      void processInput(value)
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const processInput = useCallback(async (input: string) => {
    if (!input.trim()) {
      setResult(null)
      setInternalError(null)
      setIsPrivateKeyError(false)
      onChange(null)
      return
    }

    setIsConverting(true)
    setInternalError(null)
    setIsPrivateKeyError(false)

    try {
      const conversionResult = await convertToDidJwk(input)
      setResult(conversionResult)
      setInternalError(null)
      onChange(conversionResult.did)
    } catch (err) {
      setResult(null)
      if (err instanceof PublicKeyConversionError) {
        setInternalError(err.message)
        setIsPrivateKeyError(err.code === "PRIVATE_KEY_REJECTED")
      } else {
        setInternalError(err instanceof Error ? err.message : "Failed to process key")
      }
      onChange(null)
    } finally {
      setIsConverting(false)
    }
  }, [onChange])

  const handleBlur = () => {
    void processInput(rawInput)
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setRawInput(newValue)
    // Clear previous result on change
    if (result) {
      setResult(null)
      setInternalError(null)
      setIsPrivateKeyError(false)
    }
  }

  // Detect format live for hint display
  const liveFormat = rawInput.trim() ? detectFormat(rawInput.trim()) : null
  const showError = externalError || internalError
  const errorMessage = externalError || internalError

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="grid gap-2">
        <Label htmlFor="public-key-input">{label}</Label>
        <Textarea
          id="public-key-input"
          value={rawInput}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="Paste a public key in any format: PEM, JWK JSON, hex, did:jwk, or did:key..."
          className={`font-mono text-xs min-h-[100px] ${showError ? "border-destructive" : ""}`}
          rows={4}
        />

        <p className="text-xs text-muted-foreground">
          Accepts PEM (SPKI, X.509), JWK JSON, SSH public key, secp256k1 hex, did:jwk, or did:key.
          Do not paste your private key.
        </p>

        {/* Live format detection hint */}
        {liveFormat && liveFormat !== "unknown" && !result && !showError ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <InfoIcon size={14} className="shrink-0" />
            <span>Detected: {FORMAT_LABELS[liveFormat]}</span>
          </div>
        ) : null}

        {/* Converting indicator */}
        {isConverting ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="animate-pulse">Converting...</span>
          </div>
        ) : null}

        {/* Private key rejection */}
        {isPrivateKeyError ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <ShieldAlertIcon size={16} className="mt-0.5 shrink-0 text-destructive" />
            <div className="text-sm text-destructive">
              <p className="font-medium">Private key detected</p>
              <p className="mt-0.5 text-xs">
                This input contains private key material. Only paste public keys here.
                Your private key should never leave its secure storage.
              </p>
            </div>
          </div>
        ) : null}

        {/* Generic error */}
        {showError && !isPrivateKeyError ? (
          <div className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircleIcon size={14} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {/* Success state */}
        {result && !showError ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-primary">
              <CheckIcon size={14} className="shrink-0" />
              <span>{result.keyDescription} — {FORMAT_LABELS[result.detectedFormat]}</span>
            </div>

            {/* Resolved DID preview */}
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Resolved did:jwk:</p>
              <code className="block break-all text-xs font-mono text-foreground">
                {result.did}
              </code>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
