import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, FileCheck, LinkIcon, TestTube, Star, ArrowRight } from "lucide-react"

export default function AttestPage() {
  const attestationTypes = [
    {
      id: "certification",
      title: "Certification",
      description: "Create verifiable certifications for applications, including compliance and security assessments",
      icon: Shield,
      fields: 17,
      color: "bg-blue-50 border-blue-200 hover:bg-blue-100",
    },
    {
      id: "endorsement",
      title: "Endorsement",
      description: "Provide endorsements and recommendations for projects and applications",
      icon: FileCheck,
      fields: 8,
      color: "bg-green-50 border-green-200 hover:bg-green-100",
    },
    {
      id: "linked-identifier",
      title: "Linked Identifier",
      description: "Link and verify different identity systems and accounts",
      icon: LinkIcon,
      fields: 7,
      color: "bg-purple-50 border-purple-200 hover:bg-purple-100",
    },
    {
      id: "test-deploy",
      title: "Test Deploy Schema",
      description: "Document and validate test deployment configurations and results",
      icon: TestTube,
      fields: 7,
      color: "bg-orange-50 border-orange-200 hover:bg-orange-100",
    },
    {
      id: "user-review",
      title: "User Review",
      description: "Submit detailed reviews and ratings for applications and services",
      icon: Star,
      fields: 12,
      color: "bg-yellow-50 border-yellow-200 hover:bg-yellow-100",
    },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Create Attestation</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Choose the type of attestation you want to create. Each type has specific fields and validation requirements.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {attestationTypes.map((type) => (
          <Link key={type.id} href={`/attest/${type.id}`}>
            <Card className={`cursor-pointer transition-all duration-200 ${type.color}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <type.icon className="h-8 w-8 text-gray-700" />
                  <ArrowRight className="h-5 w-5 text-gray-400" />
                </div>
                <CardTitle className="text-xl">{type.title}</CardTitle>
                <CardDescription className="text-sm text-gray-600">{type.fields} fields required</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{type.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
