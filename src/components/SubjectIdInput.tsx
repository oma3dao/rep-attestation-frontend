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
import { InfoIcon } from "lucide-react"

interface SubjectIdInputProps {
  value?: string
  onChange: (did: string | null) => void
  error?: string
  className?: string
}

type DidMethod = "did:web" | "did:pkh" | ""

/**
 * Subject ID Input Component
 * Provides a user-friendly interface for entering DID identifiers
 * Supports did:web (Web Domain) and did:pkh (Blockchain Address)
 */
export function SubjectIdInput({
  value = "",
  onChange,
  error,
  className = "",
}: SubjectIdInputProps) {
  // Determine initial method from value
  const getMethodFromValue = (val: string): DidMethod => {
    if (val.startsWith("did:web:")) return "did:web"
    if (val.startsWith("did:pkh:")) return "did:pkh"
    return ""
  }

  const [method, setMethod] = useState<DidMethod>(getMethodFromValue(value))

  // Update method when value changes externally
  useEffect(() => {
    const detectedMethod = getMethodFromValue(value)
    if (detectedMethod && detectedMethod !== method) {
      setMethod(detectedMethod)
    }
  }, [value])

  const handleMethodChange = (newMethod: string) => {
    setMethod(newMethod as DidMethod)
    // Clear the value when switching methods
    onChange(null)
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
    <div className={`space-y-4 ${className}`}>
      {/* DID Method Selector */}
      <div className="space-y-2">
        <Label htmlFor="did-method">Subject ID Type</Label>
        <Select value={method} onValueChange={handleMethodChange}>
          <SelectTrigger id="did-method">
            <SelectValue placeholder="Select identifier type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="did:web">
              🌐 Web Domain - For websites and web-based identities
            </SelectItem>
            <SelectItem value="did:pkh">
              🔑 Blockchain Address - For smart contracts and wallet addresses
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Info Banner */}
      <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
        <div className="flex gap-2 items-start">
          <InfoIcon size={16} className="mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="flex-1 text-sm text-blue-900 dark:text-blue-100">
            <p className="font-medium mb-1">What is a Subject ID?</p>
            <p className="text-blue-700 dark:text-blue-300">
              A Subject ID is a decentralized identifier (DID) that uniquely identifies 
              the entity you&apos;re creating an attestation for. Choose the type that matches 
              your subject.
            </p>
          </div>
        </div>
      </div>

      {/* Conditional Input based on selected method */}
      {method === "did:web" && (
        <DidWebInput
          value={value}
          onChange={handleDidWebChange}
          error={error}
        />
      )}

      {method === "did:pkh" && (
        <Caip10Input
          value={caip10Value}
          onChange={handleCaip10Change}
          error={error}
        />
      )}
    </div>
  )
}
