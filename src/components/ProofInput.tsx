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

// All proof types from common.schema.json
export type ProofType = "pop-eip712" | "pop-jws" | "tx-interaction" | "tx-encoded-value" | "x402-receipt" | "x402-offer" | "evidence-pointer" | ""

// Proof purposes per spec
export type ProofPurpose = "commercial-tx" | "shared-control"

interface ProofObject {
  // tx-interaction / tx-encoded-value
  chainId?: string
  txHash?: string
  sender?: string
  contractAddress?: string
  proofPurpose?: string
  // evidence-pointer
  url?: string
  // pop-eip712
  signature?: string
  domain?: any
  message?: any
}

export interface Proof {
  proofType: ProofType
  proofPurpose: ProofPurpose
  proofObject: ProofObject | string
}

// Metadata for each proof type
const proofTypeDefs: Record<string, { emoji: string; label: string; description: string }> = {
  "pop-eip712": {
    emoji: "✍️",
    label: "EIP-712 signature",
    description: "Sign a typed message with your wallet to prove control"
  },
  "pop-jws": {
    emoji: "🔏",
    label: "JWS signature",
    description: "Provide a JSON Web Signature proving control"
  },
  "tx-interaction": {
    emoji: "🔗",
    label: "Transaction with smart contract",
    description: "Reference a transaction proving you used the service"
  },
  "tx-encoded-value": {
    emoji: "💰",
    label: "Transfer with encoded value",
    description: "Reference a transaction where the value encodes the proof"
  },
  "x402-receipt": {
    emoji: "🧾",
    label: "x402 Payment Receipt",
    description: "Provide a server-signed payment receipt proving service delivery"
  },
  "x402-offer": {
    emoji: "📋",
    label: "x402 Signed Offer",
    description: "Provide a server-signed offer proving the service committed to terms"
  },
  "evidence-pointer": {
    emoji: "📍",
    label: "Web address with proof",
    description: "Link to external proof (did.json, DNS record, etc.)"
  },
}

interface ProofInputProps {
  value: Proof | null
  onChange: (proof: Proof | null) => void
  /** Default proof purpose based on attestation type */
  defaultPurpose?: ProofPurpose
  /** Allowed proof types for this field (from x-oma3-proof-types) */
  allowedTypes?: string[]
  error?: string
  className?: string
}

/**
 * ProofInput Component
 *
 * Allows users to add a cryptographic proof to their attestation.
 * Shows only the proof types relevant to the schema context.
 */
export function ProofInput({
  value,
  onChange,
  defaultPurpose = "commercial-tx",
  allowedTypes,
  error,
  className = "",
}: ProofInputProps) {
  const { address, chainId: walletChainId, isConnected } = useWallet()
  const [proofType, setProofType] = useState<ProofType>((value?.proofType as ProofType) || "")
  const [chainId, setChainId] = useState<number | null>(
    value?.proofObject && typeof value.proofObject === 'object' && value.proofObject.chainId
      ? parseInt(value.proofObject.chainId.replace("eip155:", ""))
      : null
  )
  const [txHash, setTxHash] = useState(
    value?.proofObject && typeof value.proofObject === 'object' ? value.proofObject.txHash || "" : ""
  )
  const [url, setUrl] = useState(
    value?.proofObject && typeof value.proofObject === 'object' ? value.proofObject.url || "" : ""
  )
  const [jwsValue, setJwsValue] = useState(
    value?.proofObject && typeof value.proofObject === 'string' ? value.proofObject : ""
  )
  const [showInstructions, setShowInstructions] = useState(true)
  const [copied, setCopied] = useState(false)

  // Filter available proof types based on allowedTypes prop
  const availableTypes = allowedTypes
    ? Object.keys(proofTypeDefs).filter(t => allowedTypes.includes(t))
    : Object.keys(proofTypeDefs)

  // Generate the controller DID from connected wallet
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

  const buildProof = (type: ProofType, updates: Partial<{ chainId: number | null; txHash: string; url: string; jws: string }>): Proof | null => {
    if (!type) return null

    const newChainId = updates.chainId !== undefined ? updates.chainId : chainId
    const newTxHash = updates.txHash ?? txHash
    const newUrl = updates.url ?? url
    const newJws = updates.jws ?? jwsValue

    const proof: Proof = {
      proofType: type,
      proofPurpose: defaultPurpose,
      proofObject: {}
    }

    switch (type) {
      case "tx-interaction":
        if (newChainId && newTxHash) {
          proof.proofObject = { chainId: `eip155:${newChainId}`, txHash: newTxHash }
        }
        break
      case "tx-encoded-value":
        if (newChainId && newTxHash) {
          proof.proofObject = {
            proofPurpose: defaultPurpose,
            chainId: `eip155:${newChainId}`,
            txHash: newTxHash,
            sender: address || ""
          }
        }
        break
      case "evidence-pointer":
        if (newUrl) {
          proof.proofObject = { url: newUrl }
        }
        break
      case "pop-jws":
        if (newJws) {
          proof.proofObject = newJws
        }
        break
      case "x402-receipt":
      case "x402-offer":
        if (newJws) {
          // Receipt/offer can be JWS string or JSON object — store as-is
          try {
            proof.proofObject = JSON.parse(newJws)
          } catch {
            proof.proofObject = newJws
          }
        }
        break
      case "pop-eip712":
        // EIP-712 signing is handled by the wallet — placeholder for now
        // The full implementation would trigger a wallet signing flow
        break
    }

    return proof
  }

  const handleProofTypeChange = (newType: string) => {
    const type = newType as ProofType
    setProofType(type)
    setChainId(null)
    setTxHash("")
    setUrl("")
    setJwsValue("")
    onChange(buildProof(type, { chainId: null, txHash: "", url: "", jws: "" }))
  }

  const handleChainChange = (newChainId: number) => {
    setChainId(newChainId)
    onChange(buildProof(proofType, { chainId: newChainId }))
  }

  const handleTxHashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setTxHash(val)
    onChange(buildProof(proofType, { txHash: val }))
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setUrl(val)
    onChange(buildProof(proofType, { url: val }))
  }

  const handleJwsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setJwsValue(val)
    onChange(buildProof(proofType, { jws: val }))
  }

  // Does the selected proof type need chain + txHash inputs?
  const needsTransaction = proofType === "tx-interaction" || proofType === "tx-encoded-value"
  // Does the selected proof type need a URL input?
  const needsUrl = proofType === "evidence-pointer"
  // Does the selected proof type need a JWS string input?
  const needsJws = proofType === "pop-jws"
  // Does the selected proof type need a receipt/offer (JWS or EIP-712)?
  const needsReceipt = proofType === "x402-receipt" || proofType === "x402-offer"
  // Does the selected proof type need wallet signing (future)?
  const needsWalletSign = proofType === "pop-eip712"

  return (
    <div className={`ml-4 rounded-lg border border-border/70 bg-muted/30 p-4 space-y-4 ${className}`}>
      {/* Proof Type Selector */}
      <div className="space-y-2">
        <Label>Proof Type</Label>
        <Select value={proofType} onValueChange={handleProofTypeChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select proof type" />
          </SelectTrigger>
          <SelectContent>
            {availableTypes.map(type => {
              const def = proofTypeDefs[type]
              return (
                <SelectItem key={type} value={type}>
                  {def.emoji} {def.label}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        {proofType && proofTypeDefs[proofType] && (
          <p className="text-xs text-muted-foreground">
            {proofTypeDefs[proofType].description}
          </p>
        )}
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

      {/* Transaction-based proof fields (tx-interaction, tx-encoded-value) */}
      {needsTransaction && (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <button
            type="button"
            onClick={() => setShowInstructions(!showInstructions)}
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <InfoIcon size={16} />
            {showInstructions ? "Hide" : "Show"} instructions
            {showInstructions ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
          </button>

          {showInstructions && proofType === "tx-interaction" && (
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

          {showInstructions && proofType === "tx-encoded-value" && (
            <div className="info-panel p-3 text-sm">
              <p className="font-medium mb-2">How to provide a transfer proof:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Calculate the deterministic transfer amount using the OMATrust SDK</li>
                <li>Send that exact amount to the service&apos;s address on the selected chain</li>
                <li>Paste the transaction hash below</li>
              </ol>
              <div className="mt-3 rounded border border-border/50 bg-background p-2 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Amount formula:</p>
                <code className="block">Amount = BASE + (U256(keccak256(Seed)) mod RANGE)</code>
                <p className="mt-1">Where Seed is JCS-canonicalized JSON containing hashes of the subject and counterparty DIDs. BASE and RANGE are chain-specific constants.</p>
                <p className="mt-1">Use <code>calculateTransferAmount()</code> from the OMATrust SDK to compute the exact value.</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Blockchain</Label>
            <ChainSearchInput
              value={chainId}
              onChange={handleChainChange}
              placeholder="Search for a blockchain..."
            />
          </div>

          <div className="space-y-2">
            <Label>Transaction Hash</Label>
            <Input
              type="text"
              placeholder="0x..."
              value={txHash}
              onChange={handleTxHashChange}
              className={`font-mono text-sm ${error ? "field-error" : ""}`}
            />
          </div>
        </div>
      )}

      {/* Evidence pointer fields */}
      {needsUrl && (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
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

          <div className="space-y-2">
            <Label>Evidence URL</Label>
            <Input
              type="url"
              placeholder="https://twitter.com/username or https://example.com/.well-known/proof"
              value={url}
              onChange={handleUrlChange}
              className={error ? "field-error" : ""}
            />
            <p className="text-xs text-muted-foreground">
              Public URL where your verification string is posted.
            </p>
          </div>
        </div>
      )}

      {/* JWS proof fields (pop-jws only) */}
      {needsJws && (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <div className="info-panel p-3 text-sm">
            <p className="font-medium mb-2">Paste your JWS proof:</p>
            <p className="text-xs text-muted-foreground">
              A compact JWS (header.payload.signature) proving control of the identity. The payload must include &apos;oma3_proof_purpose&apos;.
            </p>
          </div>

          <div className="space-y-2">
            <Label>JWS Proof</Label>
            <Input
              type="text"
              placeholder="eyJhbGciOi..."
              value={jwsValue}
              onChange={handleJwsChange}
              className={`font-mono text-sm ${error ? "field-error" : ""}`}
            />
            <p className="text-xs text-muted-foreground">
              Compact JWS format: header.payload.signature
            </p>
          </div>
        </div>
      )}

      {/* x402 receipt/offer fields */}
      {needsReceipt && (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <div className="info-panel p-3 text-sm">
            <p className="font-medium mb-2">
              {proofType === "x402-offer" ? "Paste your x402 signed offer:" : "Paste your x402 payment receipt:"}
            </p>
            <p className="text-xs text-muted-foreground">
              {proofType === "x402-offer"
                ? "The signed offer returned by the service in the x402 payment requirements response. Can be EIP-712 (JSON object) or JWS (compact string)."
                : "The receipt returned by the service after successful payment and delivery. Can be EIP-712 (JSON object) or JWS (compact string)."}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{proofType === "x402-offer" ? "Signed Offer" : "Payment Receipt"}</Label>
            <Input
              type="text"
              placeholder='{"format":"eip712","payload":{...},"signature":"0x..."} or eyJhbGci...'
              value={jwsValue}
              onChange={handleJwsChange}
              className={`font-mono text-sm ${error ? "field-error" : ""}`}
            />
            <p className="text-xs text-muted-foreground">
              Paste the complete artifact as provided by the x402 service (JSON object or JWS string).
            </p>
          </div>
        </div>
      )}

      {/* EIP-712 wallet signing (placeholder for future implementation) */}
      {needsWalletSign && (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <div className="info-panel p-3 text-sm">
            <p className="font-medium mb-2">EIP-712 Wallet Signature</p>
            <p className="text-xs text-muted-foreground">
              This proof type requires signing a typed message with your connected wallet.
              Your wallet will prompt you to sign a message proving you control this identity.
            </p>
          </div>

          {isConnected ? (
            <div className="rounded border border-primary/20 bg-primary/5 p-3">
              <p className="text-sm text-primary">
                ✓ Wallet connected: {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                The signature will be requested when you submit the attestation.
              </p>
            </div>
          ) : (
            <div className="warning-panel p-3">
              <p className="text-sm">
                Please connect your wallet to use EIP-712 signing.
              </p>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
