"use client"

import React, { useState } from "react"
import { ProofInput, type Proof, type ProofPurpose } from "@/components/ProofInput"
import { Button } from "@/components/ui/button"
import { PlusIcon, TrashIcon } from "lucide-react"

interface ProofArrayInputProps {
  /** JSON-stringified array of proofs, or array of JSON strings */
  value: string | string[]
  onChange: (value: string | string[]) => void
  defaultPurpose?: ProofPurpose
  allowedTypes?: string[]
  error?: string
  className?: string
}

/**
 * ProofArrayInput Component
 *
 * Manages an array of proofs. Each proof gets its own ProofInput form.
 * Users can add/remove proofs from the array.
 */
export function ProofArrayInput({
  value,
  onChange,
  defaultPurpose = "commercial-tx",
  allowedTypes,
  error,
  className = "",
}: ProofArrayInputProps) {
  // Parse the current proofs array from the value
  const parseProofs = (): Proof[] => {
    if (!value) return []

    if (typeof value === 'string') {
      if (!value.trim()) return []
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) return parsed
        return [parsed]
      } catch {
        return []
      }
    }

    if (Array.isArray(value)) {
      return value
        .map(item => {
          try { return JSON.parse(item) }
          catch { return null }
        })
        .filter(Boolean) as Proof[]
    }

    return []
  }

  const [proofs, setProofs] = useState<(Proof | null)[]>(() => {
    const parsed = parseProofs()
    // Always show at least one empty slot
    return parsed.length > 0 ? parsed : [null]
  })

  const emitChange = (updatedProofs: (Proof | null)[]) => {
    const validProofs = updatedProofs.filter(Boolean) as Proof[]
    if (validProofs.length === 0) {
      onChange('')
    } else {
      onChange(JSON.stringify(validProofs))
    }
  }

  const handleProofChange = (index: number, proof: Proof | null) => {
    const updated = [...proofs]
    updated[index] = proof
    setProofs(updated)
    emitChange(updated)
  }

  const handleAddProof = () => {
    const updated = [...proofs, null]
    setProofs(updated)
  }

  const handleRemoveProof = (index: number) => {
    if (proofs.length <= 1) {
      // Don't remove the last one — just clear it
      const updated = [null]
      setProofs(updated)
      emitChange(updated)
      return
    }
    const updated = proofs.filter((_, i) => i !== index)
    setProofs(updated)
    emitChange(updated)
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {proofs.map((proof, index) => (
        <div key={index} className="relative">
          {/* Proof number header with remove button */}
          {proofs.length > 1 && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                Proof {index + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveProof(index)}
                className="h-6 px-2 text-xs text-destructive hover:text-destructive"
              >
                <TrashIcon className="h-3 w-3 mr-1" />
                Remove
              </Button>
            </div>
          )}

          <ProofInput
            value={proof}
            onChange={(newProof) => handleProofChange(index, newProof)}
            defaultPurpose={defaultPurpose}
            allowedTypes={allowedTypes}
            error={index === 0 ? error : undefined}
          />
        </div>
      ))}

      {/* Add another proof button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAddProof}
        className="flex items-center gap-1.5"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        Add another proof
      </Button>
    </div>
  )
}
