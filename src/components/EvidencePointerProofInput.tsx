"use client"

import React, { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InfoIcon, CopyIcon, CheckIcon } from "lucide-react"
import { useWallet } from "@/lib/blockchain"

interface EvidencePointerProofInputProps {
  /** Current subject DID from the form */
  subjectDid: string
  /** Current controller DID (keyId or linkedId) from the form */
  controllerDid: string
  /** The proof URL value */
  value: string
  /** Called with the raw URL string; parent wraps into proof structure */
  onChange: (url: string) => void
  error?: string
}

/**
 * Extracts the domain from a did:web DID.
 * did:web:example.com -> example.com
 * did:web:example.com:service:api -> example.com (root domain only)
 */
function extractDomainFromDidWeb(did: string): string | null {
  if (!did.startsWith("did:web:")) return null
  const parts = did.replace("did:web:", "").split(":")
  // First part is the domain (with port-encoding: %3A for colons)
  return parts[0]?.replace(/%3A/g, ":") || null
}

/**
 * Generates the Google DNS-over-HTTPS resolver URL for _controllers.<domain>
 */
function generateDnsResolverUrl(domain: string): string {
  return `https://dns.google/resolve?name=_controllers.${domain}&type=TXT`
}

/**
 * EvidencePointerProofInput
 *
 * A simplified proof input for key-binding and linked-identifier attestations.
 * For did:web subjects, auto-generates a DNS resolver URL pointing at the
 * _controllers.<domain> TXT record. For other DID methods, shows an empty
 * text field for manual entry.
 *
 * The user always sees the URL and can edit it. The parent component wraps
 * the URL into the full evidence-pointer proof structure on submission.
 */
export function EvidencePointerProofInput({
  subjectDid,
  controllerDid,
  value,
  onChange,
  error,
}: EvidencePointerProofInputProps) {
  const { address, chainId, isConnected } = useWallet()
  const [copied, setCopied] = useState(false)

  const domain = extractDomainFromDidWeb(subjectDid)
  const isDidWeb = !!domain

  // Auto-populate URL when subject is did:web and field is empty or was auto-generated
  const [lastAutoUrl, setLastAutoUrl] = useState("")
  useEffect(() => {
    if (isDidWeb) {
      const autoUrl = generateDnsResolverUrl(domain)
      // Only auto-fill if the field is empty or still matches the previous auto-generated value
      if (!value || value === lastAutoUrl) {
        onChange(autoUrl)
        setLastAutoUrl(autoUrl)
      }
    }
  }, [domain]) // eslint-disable-line react-hooks/exhaustive-deps

  // Generate the evidence string the user needs to put in their DNS TXT record
  // Use controllerDid if available, otherwise fall back to connected wallet
  const walletDid = isConnected && address && chainId
    ? `did:pkh:eip155:${chainId}:${address}`
    : ""
  const effectiveController = controllerDid || walletDid
  const evidenceString = effectiveController ? `v=1;controller=${effectiveController}` : ""

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  const handleCopy = async () => {
    if (evidenceString) {
      await navigator.clipboard.writeText(evidenceString)
      setCopied(true)
    }
  }

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="info-panel space-y-3 p-3 text-sm">
        <div className="flex gap-2 items-start">
          <InfoIcon size={16} className="mt-0.5 flex-shrink-0 text-primary" />
          <div className="flex-1">
            {isDidWeb ? (
              <>
                <p className="mb-2 font-medium">DNS TXT Record Setup</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Go to your DNS provider for <strong>{domain}</strong></li>
                  <li>Add a TXT record at <code className="rounded bg-primary/10 px-1 text-primary">_controllers.{domain}</code></li>
                  <li>Set the value to the verification string below</li>
                </ol>
                <p className="mt-2 text-xs text-muted-foreground">
                  The proof URL below points to a public DNS resolver that verifiers will use to check your TXT record.
                  You can change it to any resolver or a did.json URL if you prefer.
                </p>
              </>
            ) : (
              <>
                <p className="mb-2 font-medium">Evidence Pointer Proof</p>
                <p className="text-muted-foreground">
                  Enter a public URL where verifiers can find evidence of your control assertion.
                  This could be a DNS resolver URL, a .well-known/did.json path, a social profile, or any publicly accessible location.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Evidence string to copy */}
        {effectiveController ? (
          <div className="rounded border border-primary/20 bg-background p-2">
            <p className="mb-1 text-xs text-primary">
              {isDidWeb ? "TXT record value:" : "Verification string to post:"}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all text-xs font-mono text-foreground">
                {evidenceString}
              </code>
              <button
                type="button"
                onClick={handleCopy}
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
          <div className="warning-panel p-2">
            <p className="text-xs">
              {controllerDid
                ? "Enter the controller field above to generate the verification string."
                : "Connect your wallet or enter the controller field to generate the verification string."}
            </p>
          </div>
        )}
      </div>

      {/* URL Input */}
      <div className="space-y-2">
        <Label>Proof URL</Label>
        <Input
          type="text"
          placeholder={isDidWeb
            ? "https://dns.google/resolve?name=_controllers.example.com&type=TXT"
            : "https://example.com/.well-known/did.json"
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`font-mono text-sm ${error ? "field-error" : ""}`}
        />
        <p className="text-xs text-muted-foreground">
          Public URL where verifiers can retrieve evidence of your control assertion.
        </p>
      </div>
    </div>
  )
}
