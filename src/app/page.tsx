import React from 'react';
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, FileCheck, LinkIcon, TestTube, Star } from "lucide-react"

export default function HomePage() {
  const features = [
    {
      icon: Shield,
      title: "Certification Attestations",
      description: "Create verifiable certifications for applications and services",
    },
    {
      icon: FileCheck,
      title: "Endorsements",
      description: "Provide endorsements and recommendations for projects",
    },
    {
      icon: LinkIcon,
      title: "Linked Identifiers",
      description: "Link and verify different identity systems",
    },
    {
      icon: TestTube,
      title: "Test Deployments",
      description: "Document and validate test deployment schemas",
    },
    {
      icon: Star,
      title: "User Reviews",
      description: "Submit detailed reviews and ratings for applications",
    },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">OMA3 Attestation Portal</h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Create verifiable attestations for the OMA3 App Registry. Build trust and transparency in the Web3 ecosystem
          through cryptographically signed attestations.
        </p>
        <div className="flex justify-center">
          <Link href="/attest">
            <Button 
              size="lg" 
              className="w-full px-8 py-6 text-xl"
            >
              Create Attestation
            </Button>
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
        {features.map((feature, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <feature.icon className="h-8 w-8 text-blue-600 mb-2" />
              <CardTitle className="text-lg">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{feature.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stats Section */}
      <div className="bg-white rounded-lg shadow-sm border p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold text-blue-600 mb-2">1,234</div>
            <div className="text-gray-600">Total Attestations</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-600 mb-2">567</div>
            <div className="text-gray-600">Verified Applications</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-600 mb-2">89</div>
            <div className="text-gray-600">Active Attestors</div>
          </div>
        </div>
      </div>
    </div>
  )
}
