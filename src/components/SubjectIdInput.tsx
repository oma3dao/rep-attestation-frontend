"use client"

import React, { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DidWebInput } from "@/components/did-web-input"
import { Caip10Input } from "@/components/caip10-input"
import { DidHandleInput } from "@/components/did-handle-input"
import { DidKeyInput } from "@/components/did-key-input"
import { DidJwkInput } from "@/components/did-jwk-input"
import { ArtifactDidInput } from "@/components/artifact-did-input"
import { PublicKeyInput } from "@/components/public-key-input"
import { HelpCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface SubjectIdInputProps {
  value?: string
  onChange: (did: string | null) => void
  error?: string
  className?: string
  allowedMethods?: string[] // e.g. ["web", "pkh", "jwk", "key", "handle"]
  handlePlatforms?: string[] // e.g. ["twitter", "github", "discord"]
}

type DidMethod = "did:web" | "did:pkh" | "did:handle" | "did:key" | "did:jwk" | "did:artifact" | ""

/**
 * Subject ID Input Component
 * Provides a user-friendly interface for entering DID identifiers
 * Supports did:web, did:pkh, did:handle, did:key, and did:jwk
 */
export function SubjectIdInput({
  value = "",
  onChange,
  error,
  className = "",
  allowedMethods,
  handlePlatforms,
}: SubjectIdInputProps) {
  // Determine initial method from value
  const getMethodFromValue = (val: string): DidMethod => {
    if (val.startsWith("did:web:")) return "did:web"
    if (val.startsWith("did:pkh:")) return "did:pkh"
    if (val.startsWith("did:handle:")) return "did:handle"
    if (val.startsWith("did:key:")) return "did:key"
    if (val.startsWith("did:jwk:")) return "did:jwk"
    if (val.startsWith("did:artifact:")) return "did:artifact"
    return ""
  }

  const [method, setMethod] = useState<DidMethod>(getMethodFromValue(value))

  // Derive effective method: prefer detected from value when state hasn't caught up
  const effectiveMethod = method || getMethodFromValue(value)

  // Build the list of available methods based on allowedMethods prop
  const allMethodDefs: Record<string, { value: DidMethod; emoji: string; label: string }> = {
    web:      { value: "did:web", emoji: "🌐", label: "Web Domain - For websites and URLs" },
    pkh:      { value: "did:pkh", emoji: "🔑", label: "Blockchain Address - For smart contract and wallet addresses" },
    handle:   { value: "did:handle", emoji: "👤", label: "Social Handle - X, GitHub, Discord, etc." },
    jwk:      { value: "did:jwk", emoji: "🔐", label: "JWK Key - Public key identifiers" },
    artifact: { value: "did:artifact", emoji: "📦", label: "Artifact - For binaries, files, and text like JSON" },
  }

  // Default fallback order (most common to least)
  const defaultOrder = ["web", "pkh", "jwk", "artifact", "handle"]

  // If allowedMethods is provided, use its order (schema wins); otherwise use default order
  const methodOrder = allowedMethods ?? defaultOrder
  const availableMethods = methodOrder
    .filter(m => m in allMethodDefs)
    .map(m => allMethodDefs[m])

  // Update method when value changes externally
  useEffect(() => {
    const detectedMethod = getMethodFromValue(value)
    if (detectedMethod && detectedMethod !== method) {
      setMethod(detectedMethod)
    }
  }, [value])

  const handleMethodChange = (newMethod: string) => {
    const currentMethod = getMethodFromValue(value)
    setMethod(newMethod as DidMethod)
    // Only clear the value when switching to a genuinely different method
    if (currentMethod !== newMethod) {
      onChange(null)
    }
  }

  const handleDidWebChange = (did: string | null) => {
    onChange(did)
  }

  const handleCaip10Change = (caip10: string | null) => {
    // Convert CAIP-10 to did:pkh format
    const did = caip10 ? `did:pkh:${caip10}` : null
    onChange(did)
  }

  // Extract CAIP-10 from did:pkh for the input
  const caip10Value = value?.startsWith("did:pkh:") 
    ? value.replace("did:pkh:", "") 
    : ""

  return (
    <div className={`ml-4 rounded-lg border border-border/70 bg-muted/30 p-4 space-y-4 ${className}`}>
      {/* DID Method Selector */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="did-method">ID Type</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger type="button" tabIndex={-1}>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-sm">
                  Choose how your service is identified. Web domains use did:web, blockchain contracts use did:pkh, social accounts use did:handle.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Select value={effectiveMethod} onValueChange={handleMethodChange}>
          <SelectTrigger id="did-method">
            <SelectValue placeholder="Select ID type" />
          </SelectTrigger>
          <SelectContent>
            {availableMethods.map(m => (
              <SelectItem key={m.value} value={m.value}>
                {m.emoji} {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Conditional Input based on selected method */}
      {effectiveMethod === "did:web" && (
        <DidWebInput
          value={value}
          onChange={handleDidWebChange}
          error={error}
        />
      )}

      {effectiveMethod === "did:pkh" && (
        <Caip10Input
          value={caip10Value}
          onChange={handleCaip10Change}
          error={error}
        />
      )}

      {effectiveMethod === "did:handle" && (
        <DidHandleInput
          value={value}
          onChange={onChange}
          error={error}
          platforms={handlePlatforms}
        />
      )}

      {effectiveMethod === "did:key" && (
        <PublicKeyInput
          value={value}
          onChange={onChange}
          error={error}
          label="Public Key (legacy did:key)"
        />
      )}

      {effectiveMethod === "did:jwk" && (
        <PublicKeyInput
          value={value}
          onChange={onChange}
          error={error}
          label="Public Key"
        />
      )}

      {effectiveMethod === "did:artifact" && (
        <ArtifactDidInput
          value={value}
          onChange={(did) => onChange(did || "")}
          error={error}
        />
      )}

      {method === "did:jwk" && (
        <DidJwkInput
          value={value}
          onChange={onChange}
          error={error}
        />
      )}
    </div>
  )
}
