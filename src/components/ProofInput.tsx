"use client"

import React, { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChainSearchInput } from "@/components/chain-search-input"
import { InfoIcon, ChevronDownIcon, ChevronUpIcon, CopyIcon, CheckIcon } from "lucide-react"
import { useWallet } from "@/lib/blockchain"

// Proof types supported in v1
type ProofType = "tx-interaction" | "evidence-pointer" | ""

// Proof purposes per spec
type ProofPurpose = "commercial-tx" | "shared-control"

interface ProofObject {
  chainId?: string
  txHash?: string
  url?: string
}

interface Proof {
  proofType: ProofType
  proofPurpose: ProofPurpose
  proofObject: ProofObject
}

interface ProofInputProps {
  value: Proof | null
  onChange: (proof: Proof | null) => void
  /** Default proof purpose based on attestation type */
  defaultPurpose?: ProofPurpose
  error?: string
  className?: string
}

/**
 * ProofInput Component
 * 
 * Allows users to add a cryptographic proof to their attestation.
 * Supports tx-interaction (for reviews) and evidence-pointer (for linking).
 */
export function ProofInput({
  value,
  onChange,
  defaultPurpose = "commercial-tx",
  error,
  className = "",
}: ProofInputProps) {
  const { address, chainId: walletChainId, isConnected } = useWallet()
  const [proofType, setProofType] = useState<ProofType>(value?.proofType || "")
  const [chainId, setChainId] = useState<number | null>(
    value?.proofObject?.chainId ? parseInt(value.proofObject.chainId.replace("eip155:", "")) : null
  )
  const [txHash, setTxHash] = useState(value?.proofObject?.txHash || "")
  const [url, setUrl] = useState(value?.proofObject?.url || "")
  const [showInstructions, setShowInstructions] = useState(true)
  const [copied, setCopied] = useState(false)

  // Generate the controller DID from connected wallet (did:pkh:eip155:<chainId>:<address>)
  const controllerDid = isConnected && address && walletChainId 
    ? `did:pkh:eip155:${walletChainId}:${address}` 
    : ""

  // Generate the evidence string for evidence-pointer proofs
  const evidenceString = controllerDid ? `v=1;controller=${controllerDid}` : ""

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  const handleCopyEvidenceString = async () => {
    if (evidenceString) {
      await navigator.clipboard.writeText(evidenceString)
      setCopied(true)
    }
  }

  const updateProof = (updates: Partial<{ proofType: ProofType; chainId: number | null; txHash: string; url: string }>) => {
    const newProofType = updates.proofType ?? proofType
    const newChainId = updates.chainId !== undefined ? updates.chainId : chainId
    const newTxHash = updates.txHash ?? txHash
    const newUrl = updates.url ?? url

    if (!newProofType) {
      onChange(null)
      return
    }

    const proof: Proof = {
      proofType: newProofType,
      proofPurpose: defaultPurpose,
      proofObject: {}
    }

    if (newProofType === "tx-interaction" && newChainId && newTxHash) {
      proof.proofObject = {
        chainId: `eip155:${newChainId}`,
        txHash: newTxHash
      }
    } else if (newProofType === "evidence-pointer" && newUrl) {
      proof.proofObject = {
        url: newUrl
      }
    }

    onChange(proof)
  }

  const handleProofTypeChange = (newType: string) => {
    const type = newType as ProofType
    setProofType(type)
    // Reset fields when changing type
    setChainId(null)
    setTxHash("")
    setUrl("")
    updateProof({ proofType: type, chainId: null, txHash: "", url: "" })
  }

  const handleChainChange = (newChainId: number) => {
    setChainId(newChainId)
    updateProof({ chainId: newChainId })
  }

  const handleTxHashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTxHash = e.target.value
    setTxHash(newTxHash)
    updateProof({ txHash: newTxHash })
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value
    setUrl(newUrl)
    updateProof({ url: newUrl })
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Proof Type Selector */}
      <div className="space-y-2">
        <Label>Proof Type (Optional)</Label>
        <Select value={proofType} onValueChange={handleProofTypeChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select proof type (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tx-interaction">
              🔗 Transaction Interaction - Prove you used the service
            </SelectItem>
            <SelectItem value="evidence-pointer">
              📍 Evidence Pointer - Link to external proof
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Adding a proof increases trust in your attestation by providing verifiable evidence.
        </p>
      </div>

      {/* Proof Purpose Badge */}
      {proofType && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Purpose:</span>
          <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
            {defaultPurpose === "commercial-tx" ? "Commercial Transaction" : "Shared Control"}
          </span>
        </div>
      )}

      {/* tx-interaction Fields */}
      {proofType === "tx-interaction" && (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          {/* Instructions */}
          <button
            type="button"
            onClick={() => setShowInstructions(!showInstructions)}
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <InfoIcon size={16} />
            {showInstructions ? "Hide" : "Show"} instructions
            {showInstructions ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
          </button>

          {showInstructions && (
            <div className="info-panel p-3 text-sm">
              <p className="font-medium mb-2">How to provide a transaction proof:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Find a transaction where you interacted with the service</li>
                <li>Select the blockchain where the transaction occurred</li>
                <li>Paste the transaction hash below</li>
              </ol>
              <p className="mt-2 text-xs text-muted-foreground">
                The transaction must be from your wallet to the service&apos;s contract.
              </p>
            </div>
          )}

          {/* Chain Selection */}
          <div className="space-y-2">
            <Label>Blockchain</Label>
            <ChainSearchInput
              value={chainId}
              onChange={handleChainChange}
              placeholder="Search for a blockchain..."
            />
          </div>

          {/* Transaction Hash */}
          <div className="space-y-2">
            <Label>Transaction Hash</Label>
            <Input
              type="text"
              placeholder="0x..."
              value={txHash}
              onChange={handleTxHashChange}
              className={`font-mono text-sm ${error ? "field-error" : ""}`}
            />
            <p className="text-xs text-muted-foreground">
              The transaction hash proving your interaction with the service.
            </p>
          </div>
        </div>
      )}

      {/* evidence-pointer Fields */}
      {proofType === "evidence-pointer" && (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          {/* Instructions */}
          <button
            type="button"
            onClick={() => setShowInstructions(!showInstructions)}
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <InfoIcon size={16} />
            {showInstructions ? "Hide" : "Show"} instructions
            {showInstructions ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
          </button>

          {showInstructions && (
            <div className="info-panel space-y-3 p-3 text-sm">
              <div>
                <p className="font-medium mb-2">How to provide an evidence pointer:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Copy the verification string below</li>
                  <li>Post it on a platform you control (profile bio, status, pinned post, etc.)</li>
                  <li>Paste the public URL to your proof below</li>
                </ol>
              </div>

              {/* Evidence String to Copy */}
              {controllerDid ? (
                <div className="mt-3 rounded border border-primary/20 bg-background p-2">
                  <p className="mb-1 text-xs text-primary">
                    Verification string to post:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 break-all text-xs font-mono text-foreground">
                      {evidenceString}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyEvidenceString}
                      className="rounded p-1.5 transition-colors hover:bg-primary/10"
                      title="Copy to clipboard"
                    >
                      {copied ? (
                        <CheckIcon size={14} className="text-success" />
                      ) : (
                        <CopyIcon size={14} className="text-primary" />
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="warning-panel mt-3 p-2">
                  <p className="text-xs">
                    Connect your wallet to generate the verification string.
                  </p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                The URL must be publicly accessible without authentication.
              </p>
            </div>
          )}

          {/* URL Input */}
          <div className="space-y-2">
            <Label>Evidence URL</Label>
            <Input
              type="url"
              placeholder="https://twitter.com/username or https://github.com/username"
              value={url}
              onChange={handleUrlChange}
              className={error ? "field-error" : ""}
            />
            <p className="text-xs text-muted-foreground">
              Public URL where your verification string is posted (e.g., Twitter profile, GitHub bio, personal website).
            </p>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
