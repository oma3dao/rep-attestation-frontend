"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { EnrichedAttestationResult } from "@/lib/attestation-queries"
import { Shield, Award, FileCheck, LinkIcon, Star, MessageSquare, ExternalLink } from "lucide-react"
import { omachainTestnet } from "@/config/chains"

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
  const explorerUrl = `${omachainTestnet.blockExplorers[0].url}/tx/${attestation.uid}`

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Icon className="h-6 w-6 text-blue-600" />
            {attestation.schemaTitle}
          </DialogTitle>
          <p className="text-sm text-gray-500">
            {date.toLocaleString()}
          </p>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Attestation Info */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Attestation Details</h3>
            
            <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
              <div>
                <span className="font-medium text-gray-700">UID:</span>
                <p className="font-mono text-xs text-gray-600 break-all mt-1">{attestation.uid}</p>
              </div>
              
              <div>
                <span className="font-medium text-gray-700">Attester:</span>
                <p className="font-mono text-xs text-gray-600 break-all mt-1">{attestation.attester}</p>
              </div>
              
              <div>
                <span className="font-medium text-gray-700">Recipient:</span>
                <p className="font-mono text-xs text-gray-600 break-all mt-1">{attestation.recipient}</p>
              </div>

              <div>
                <a 
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                >
                  View on Block Explorer
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Decoded Data */}
          {attestation.decodedData && Object.keys(attestation.decodedData).length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">Attestation Data</h3>
              
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                {Object.entries(attestation.decodedData).map(([key, value]) => (
                  <div key={key}>
                    <span className="font-medium text-gray-700 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}:
                    </span>
                    <p className="text-gray-600 mt-1 break-words whitespace-pre-wrap">
                      {formatValue(value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expiration */}
          {attestation.expirationTime > 0 && (
            <div className="text-sm text-gray-600">
              <span className="font-medium">Expires:</span>{' '}
              {new Date(attestation.expirationTime * 1000).toLocaleString()}
            </div>
          )}

          {/* Revocation Status */}
          {attestation.revocationTime > 0 && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
              <p className="text-sm text-red-800 font-medium">
                ⚠️ This attestation was revoked on{' '}
                {new Date(attestation.revocationTime * 1000).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
