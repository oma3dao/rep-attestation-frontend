import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Shield, Award, FileCheck, LinkIcon, Star, MessageSquare } from "lucide-react"
import type { EnrichedAttestationResult } from "@/lib/attestation-queries"

interface AttestationCardProps {
  attestation: EnrichedAttestationResult
  onClick: () => void
}

// Map schema IDs to icons
const schemaIcons: Record<string, any> = {
  'certification': Award,
  'endorsement': FileCheck,
  'linked-identifier': LinkIcon,
  'security-assessment': Shield,
  'user-review': Star,
  'user-review-response': MessageSquare,
}

export function AttestationCard({ attestation, onClick }: AttestationCardProps) {
  const Icon = schemaIcons[attestation.schemaId || ''] || Shield
  const date = new Date(attestation.time * 1000).toLocaleDateString()
  const attesterShort = `${attestation.attester.slice(0, 6)}...${attestation.attester.slice(-4)}`
  const revoked = attestation.revocationTime > 0
  
  // Get subject from decoded data if available
  const subject = attestation.decodedData?.subject || attestation.recipient
  const subjectShort = subject.length > 40 
    ? `${subject.slice(0, 20)}...${subject.slice(-10)}`
    : subject

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
          </div>
          <span className="text-sm text-muted-foreground">{date}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium text-foreground">Attester:</span>{' '}
            <span className="font-mono text-muted-foreground">{attesterShort}</span>
          </div>
          <div>
            <span className="font-medium text-foreground">Subject:</span>{' '}
            <span className="font-mono text-muted-foreground break-all">{subjectShort}</span>
          </div>
          {attestation.decodedData?.ratingValue && (
            <div>
              <span className="font-medium text-foreground">Rating:</span>{' '}
              <span className="text-muted-foreground">{Number(attestation.decodedData.ratingValue)}/5</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
