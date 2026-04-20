"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { EnrichedAttestationResult } from "@/lib/attestation-queries"
import { Shield, Award, FileCheck, LinkIcon, Star, MessageSquare, ExternalLink } from "lucide-react"
import { getActiveChain } from "@/lib/blockchain"

interface AttestationDetailModalProps {
  isOpen: boolean
  onClose: () => void
  attestation: EnrichedAttestationResult | null
}

const schemaIcons: Record<string, any> = {
  'certification': Award,
  'endorsement': FileCheck,
  'linked-identifier': LinkIcon,
  'security-assessment': Shield,
  'user-review': Star,
  'user-review-response': MessageSquare,
}

// Helper to safely convert values to strings (handles BigInt)
function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'bigint') {
    return value.toString()
  }
  if (typeof value === 'object') {
    try {
      // Custom replacer to handle BigInt in nested objects
      return JSON.stringify(value, (_, v) => 
        typeof v === 'bigint' ? v.toString() : v
      , 2)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

export function AttestationDetailModal({ isOpen, onClose, attestation }: AttestationDetailModalProps) {
  if (!attestation) return null

  const Icon = schemaIcons[attestation.schemaId || ''] || Shield
  const date = new Date(attestation.time * 1000)
  const chain = getActiveChain()
  const explorerBase = chain.blockExplorers?.[0]?.url
  const explorerUrl = explorerBase
    ? attestation.txHash
      ? `${explorerBase}/tx/${attestation.txHash}`
      : `${explorerBase}/address/${attestation.attester}`
    : null
  const explorerLabel = attestation.txHash ? 'View Transaction' : 'View Attester on Block Explorer'

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Icon className="h-6 w-6 text-primary" />
            {attestation.schemaTitle}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {date.toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 min-w-0 space-y-6">
          {/* Revocation Status */}
          {attestation.revocationTime > 0 && (
            <div className="status-panel-error p-3">
              <p className="text-sm font-medium">
                ⚠️ This attestation was revoked on{' '}
                {new Date(attestation.revocationTime * 1000).toLocaleString()}
              </p>
            </div>
          )}

          {/* Attestation Info */}
          <div className="space-y-3">
            <h3 className="font-semibold tracking-tight text-foreground">Attestation Details</h3>
            
            <div className="rounded-lg border border-border/70 bg-muted/50 p-4 space-y-2 text-sm">
              <div className="min-w-0">
                <span className="font-medium text-foreground">UID:</span>
                <p className="mt-1 font-mono text-xs text-muted-foreground break-all">{attestation.uid}</p>
              </div>
              
              <div className="min-w-0">
                <span className="font-medium text-foreground">Attester:</span>
                <p className="mt-1 font-mono text-xs text-muted-foreground break-all">{attestation.attester}</p>
              </div>
              
              <div className="min-w-0">
                <span className="font-medium text-foreground">Recipient:</span>
                <p className="mt-1 font-mono text-xs text-muted-foreground break-all">{attestation.recipient}</p>
              </div>

              {explorerUrl && (
              <div className="min-w-0">
                <a 
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1 break-all text-sm text-primary hover:text-primary/80"
                >
                  {explorerLabel}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              )}
            </div>
          </div>

          {/* Decoded Data */}
          {attestation.decodedData && Object.keys(attestation.decodedData).length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold tracking-tight text-foreground">Attestation Data</h3>
              
              <div className="rounded-lg border border-border/70 bg-muted/50 p-4 space-y-3">
                {Object.entries(attestation.decodedData).map(([key, value]) => (
                  <div key={key} className="min-w-0">
                    <span className="font-medium text-foreground capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}:
                    </span>
                    <p className="mt-1 whitespace-pre-wrap break-all text-muted-foreground">
                      {formatValue(value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expiration */}
          {attestation.expirationTime > 0 && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Expires:</span>{' '}
              {new Date(attestation.expirationTime * 1000).toLocaleString()}
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  )
}
