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
      className="hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">{attestation.schemaTitle}</CardTitle>
            {revoked ? (
              <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Revoked</Badge>
            ) : (
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
            )}
          </div>
          <span className="text-sm text-gray-500">{date}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium text-gray-700">Attester:</span>{' '}
            <span className="text-gray-600 font-mono">{attesterShort}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Subject:</span>{' '}
            <span className="text-gray-600 font-mono break-all">{subjectShort}</span>
          </div>
          {attestation.decodedData?.ratingValue && (
            <div>
              <span className="font-medium text-gray-700">Rating:</span>{' '}
              <span className="text-gray-600">{Number(attestation.decodedData.ratingValue)}/5</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
