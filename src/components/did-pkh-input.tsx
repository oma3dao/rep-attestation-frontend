"use client"

import React, { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CheckIcon,
  AlertCircleIcon,
} from "lucide-react"
import { normalizeCaip10 } from "@/lib/utils/caip10/normalize"
import { buildCaip10 } from "@/lib/utils/caip10/parse"
import { NON_EVM_CAIP2 } from "@/lib/utils/caip10/chains"
import { ChainSearchInput } from "@/components/chain-search-input"

type Ecosystem = "eip155" | "solana" | "sui"

interface DidPkhInputProps {
  value?: string
  onChange: (did: string | null) => void
  className?: string
  error?: string
}

/** Parse a did:pkh string into its CAIP-10 components */
function parseDidPkh(did: string): { namespace: string; reference: string; address: string } | null {
  const match = did.match(/^did:pkh:([a-z0-9]+):([^:]+):(.+)$/)
  if (!match) return null
  return { namespace: match[1], reference: match[2], address: match[3] }
}

/**
 * DID:PKH Input Component
 *
 * Top-level field accepts a full did:pkh:... string (paste-friendly).
 * A collapsible builder lets users construct the DID by picking
 * ecosystem, chain, and address without knowing CAIP-10 internals.
 */
export function DidPkhInput({
  value = "",
  onChange,
  className = "",
  error: externalError,
}: DidPkhInputProps) {
  // Top-level DID text
  const [inputValue, setInputValue] = useState(value)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isValid, setIsValid] = useState(false)

  // Builder state
  const [builderOpen, setBuilderOpen] = useState(false)
  const [ecosystem, setEcosystem] = useState<Ecosystem>("eip155")
  const [evmChainId, setEvmChainId] = useState<number | null>(null)
  const [solanaRef, setSolanaRef] = useState<string>(NON_EVM_CAIP2.solana.mainnetRef)
  const [suiRef, setSuiRef] = useState<string>(NON_EVM_CAIP2.sui.mainnetRef)
  const [address, setAddress] = useState("")

  const builderRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Sync with external value prop (e.g. pre-fill from dashboard)
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value)
      syncBuilderFromDid(value)
    }
  }, [value])

  // Validate whenever inputValue changes
  useEffect(() => {
    validateInput(inputValue)
  }, [inputValue])

  // Auto-scroll when builder opens
  useEffect(() => {
    if (builderOpen && builderRef.current) {
      setTimeout(() => {
        builderRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      }, 100)
    }
  }, [builderOpen])

  function syncBuilderFromDid(did: string) {
    const parsed = parseDidPkh(did)
    if (!parsed) return

    const { namespace, reference, address: addr } = parsed
    if (namespace === "eip155") {
      setEcosystem("eip155")
      setEvmChainId(parseInt(reference, 10))
    } else if (namespace === "solana") {
      setEcosystem("solana")
      setSolanaRef(reference)
    } else if (namespace === "sui") {
      setEcosystem("sui")
      setSuiRef(reference)
    }
    setAddress(addr)
  }

  function validateInput(did: string) {
    if (!did.trim()) {
      setIsValid(false)
      setValidationError(null)
      return
    }

    // Must start with did:pkh:
    if (!did.startsWith("did:pkh:")) {
      setIsValid(false)
      setValidationError("Must start with did:pkh:")
      return
    }

    // Extract CAIP-10 portion and validate
    const caip10 = did.replace("did:pkh:", "")
    const result = normalizeCaip10(caip10)

    if (result.valid) {
      setIsValid(true)
      setValidationError(null)
    } else {
      setIsValid(false)
      setValidationError(result.error || "Invalid address format")
    }
  }

  // Debounced onChange for top-level input typing
  function handleTopInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value
    setInputValue(newValue)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      emitValue(newValue)
    }, 1500)
  }

  function handleTopInputBlur() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    emitValue(inputValue)
  }

  function emitValue(did: string) {
    if (!did.trim()) {
      onChange(null)
      return
    }

    if (!did.startsWith("did:pkh:")) {
      onChange(null)
      return
    }

    const caip10 = did.replace("did:pkh:", "")
    const result = normalizeCaip10(caip10)

    if (result.valid && result.normalized) {
      const normalized = `did:pkh:${result.normalized}`
      setInputValue(normalized)
      onChange(normalized)
    } else {
      onChange(null)
    }
  }

  function handleBuilderApply() {
    let reference = ""

    switch (ecosystem) {
      case "eip155":
        if (evmChainId === null || !address) return
        reference = evmChainId.toString()
        break
      case "solana":
        if (!address) return
        reference = solanaRef
        break
      case "sui":
        if (!address) return
        reference = suiRef
        break
    }

    const caip10 = buildCaip10(ecosystem, reference, address)
    const result = normalizeCaip10(caip10)

    if (result.valid && result.normalized) {
      const did = `did:pkh:${result.normalized}`
      setInputValue(did)
      onChange(did)
      setBuilderOpen(false)
    } else {
      // Show validation from builder attempt
      setValidationError(result.error || "Invalid address")
    }
  }

  const showError = externalError || (validationError && inputValue.trim())
  const errorMessage = externalError || validationError

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Primary DID input */}
      <div className="grid gap-2">
        <Label htmlFor="did-pkh-input">Blockchain DID</Label>
        <Input
          id="did-pkh-input"
          value={inputValue}
          onChange={handleTopInputChange}
          onBlur={handleTopInputBlur}
          placeholder="did:pkh:eip155:1:0xAbc123..."
          className={showError ? "field-error" : ""}
        />

        {showError && (
          <div className="feedback-error">
            <AlertCircleIcon size={16} className="mt-0.5 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isValid && inputValue.trim() && (
          <div className="feedback-success">
            <CheckIcon size={16} className="mt-0.5 flex-shrink-0" />
            <span>Valid blockchain DID</span>
          </div>
        )}
      </div>

      {/* Collapsible Builder */}
      <div ref={builderRef} className="border rounded-md">
        <button
          type="button"
          onClick={() => setBuilderOpen(!builderOpen)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <span className="text-sm font-medium">Build DID from chain &amp; address</span>
          {builderOpen ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
        </button>

        {builderOpen && (
          <div className="p-4 border-t space-y-4">
            {/* Ecosystem / VM selector */}
            <div className="grid gap-2">
              <Label htmlFor="ecosystem">Virtual Machine</Label>
              <Select value={ecosystem} onValueChange={(v) => setEcosystem(v as Ecosystem)}>
                <SelectTrigger id="ecosystem">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eip155">EVM (Ethereum, Base, OMAChain, etc.)</SelectItem>
                  <SelectItem value="solana">Solana</SelectItem>
                  <SelectItem value="sui">Sui</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Chain selector — EVM */}
            {ecosystem === "eip155" && (
              <div className="grid gap-2">
                <Label htmlFor="evm-chain">Chain</Label>
                <div className="space-y-2">
                  <ChainSearchInput
                    value={evmChainId}
                    onChange={(chainId) => setEvmChainId(chainId)}
                    placeholder="Search by chain name or ID..."
                  />
                  <div className="text-xs text-muted-foreground">
                    Chain not listed? Enter its ID manually:
                  </div>
                  <Input
                    type="number"
                    value={evmChainId ?? ""}
                    onChange={(e) => {
                      const val = e.target.value
                      setEvmChainId(val ? parseInt(val, 10) : null)
                    }}
                    placeholder="e.g. 6623 for OMAChain"
                    className="font-mono"
                  />
                </div>
              </div>
            )}

            {/* Chain selector — Solana */}
            {ecosystem === "solana" && (
              <div className="grid gap-2">
                <Label htmlFor="solana-network">Network</Label>
                <Select value={solanaRef} onValueChange={setSolanaRef}>
                  <SelectTrigger id="solana-network">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NON_EVM_CAIP2.solana.mainnetRef}>Mainnet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Chain selector — Sui */}
            {ecosystem === "sui" && (
              <div className="grid gap-2">
                <Label htmlFor="sui-network">Network</Label>
                <Select value={suiRef} onValueChange={setSuiRef}>
                  <SelectTrigger id="sui-network">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NON_EVM_CAIP2.sui.mainnetRef}>Mainnet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Address field */}
            <div className="grid gap-2">
              <Label htmlFor="builder-address">Address</Label>
              <Input
                id="builder-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={
                  ecosystem === "eip155"
                    ? "0x1234567890abcdef..."
                    : ecosystem === "solana"
                    ? "TokenkegQfeZyiNw..."
                    : "0x000...001"
                }
              />
              <p className="text-xs text-muted-foreground">
                {ecosystem === "eip155" && "The contract or wallet address (0x + 40 hex characters)."}
                {ecosystem === "solana" && "Base58-encoded 32-byte public key."}
                {ecosystem === "sui" && "Hex address (0x + up to 64 chars). Short forms are padded."}
              </p>
            </div>

            {/* Apply */}
            <Button
              type="button"
              onClick={handleBuilderApply}
              disabled={!address || (ecosystem === "eip155" && evmChainId === null)}
              className="w-full"
            >
              Use this address
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
