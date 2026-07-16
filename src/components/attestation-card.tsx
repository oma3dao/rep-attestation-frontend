import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Shield, Award, LinkIcon, Star, MessageSquare, CheckCircle2 } from "lucide-react"
import type { EnrichedAttestationResult } from "@/lib/attestation-queries"
import { StarRating } from "@/components/star-rating"
import { getAttestationFieldLabel } from "@/lib/display"

interface AttestationCardProps {
  attestation: EnrichedAttestationResult
  /** When true, shows a "Trusted" badge indicating the attester is an approved issuer in the trust anchors. */
  trusted?: boolean
  onClick: () => void
}

// Map schema IDs to icons
const schemaIcons: Record<string, any> = {
  'certification': Award,
  'linked-identifier': LinkIcon,
  'security-assessment': Shield,
  'user-review': Star,
  'user-review-response': MessageSquare,
}

/** Format check names to be more user-friendly */
function formatCheckName(name: string, passed: boolean): string {
  switch (name) {
    case 'revocation': return passed ? 'Not revoked' : 'Revoked'
    case 'expiration': return passed ? 'Not expired' : 'Expired'
    case 'proofs': return passed ? 'Verified' : 'Not verified'
    default: return name.replace(/([A-Z])/g, ' $1').trim()
  }
}

export function AttestationCard({ attestation, trusted, onClick }: AttestationCardProps) {
  const Icon = schemaIcons[attestation.schemaId || ''] || Shield
  const date = new Date(attestation.time * 1000).toLocaleDateString()
  const revoked = attestation.revocationTime > 0
  const verification = attestation.verification
  const isUserReview = attestation.schemaId === 'user-review' || attestation.schemaId === 'user-review-response'
  const isControllerWitness = attestation.schemaId === 'controller-witness'
  
  // Get subject from decoded data if available
  const subject = attestation.decodedData?.subject || attestation.recipient

  return (
    <Card 
      className="cursor-pointer border-border/70 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-950/10"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg tracking-tight">{attestation.schemaTitle}</CardTitle>
            {revoked ? (
              <Badge variant="destructive">Revoked</Badge>
            ) : (
              <Badge variant="success">Active</Badge>
            )}
            {verification?.valid ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Verified
              </Badge>
            ) : null}
            {trusted ? (
              <Badge variant="warning" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Trusted
              </Badge>
            ) : null}
          </div>
          <span className="text-sm text-muted-foreground">{date}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium text-foreground">Attester:</span>{' '}
            <span className="font-mono text-muted-foreground break-all">{attestation.attester}</span>
          </div>
          <div>
            <span className="font-medium text-foreground">{getAttestationFieldLabel('subject', attestation.schemaId)}:</span>{' '}
            <span className="font-mono text-muted-foreground break-all">{subject}</span>
          </div>
          {isControllerWitness && attestation.decodedData?.controller && (
            <div>
              <span className="font-medium text-foreground">{getAttestationFieldLabel('controller', attestation.schemaId)}:</span>{' '}
              <span className="font-mono text-muted-foreground break-all">
                {String(attestation.decodedData.controller)}
              </span>
            </div>
          )}
          {isControllerWitness && attestation.decodedData?.method && (
            <div>
              <span className="font-medium text-foreground">{getAttestationFieldLabel('method', attestation.schemaId)}:</span>{' '}
              <span className="text-muted-foreground capitalize">
                {String(attestation.decodedData.method).replace(/-/g, ' ')}
              </span>
            </div>
          )}
          {isControllerWitness && attestation.decodedData?.observedAt && (
            <div>
              <span className="font-medium text-foreground">{getAttestationFieldLabel('observedAt', attestation.schemaId)}:</span>{' '}
              <span className="text-muted-foreground">
                {(() => {
                  const val = attestation.decodedData!.observedAt
                  const num = typeof val === 'bigint' ? Number(val) : Number(val)
                  if (!num || num <= 0) return 'Unknown'
                  const ms = num > 1e12 ? num : num * 1000
                  return new Date(ms).toLocaleDateString()
                })()}
              </span>
            </div>
          )}
          {attestation.decodedData?.ratingValue && (
            <div>
              <span className="font-medium text-foreground">Rating:</span>{' '}
              <StarRating value={attestation.decodedData.ratingValue as string | number} />
            </div>
          )}
          {/* Verification section: show in list for non-user-review schemas only */}
          {verification && !isUserReview ? (
            <div className="rounded-md border border-border/70 bg-muted/40 p-3">
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="font-medium text-foreground">Status:</span>
                <span className={verification.valid ? "text-primary" : "text-muted-foreground"}>
                  {verification.valid ? "Passed" : "Not verified"}
                </span>
              </div>
              {Object.keys(verification.checks).length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(verification.checks).map(([name, passed]) => (
                    <Badge key={name} variant={passed ? "success" : "secondary"}>
                      {formatCheckName(name, passed)}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {verification.reasons.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {verification.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
