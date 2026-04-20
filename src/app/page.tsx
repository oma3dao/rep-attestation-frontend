"use client"

import React from 'react';
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, FileCheck, LinkIcon, Award, Star, MessageSquare, KeyRound, Eye } from "lucide-react"
import { LatestAttestations } from "@/components/latest-attestations"

export default function HomePage() {
  const features = [
    {
      icon: Shield,
      title: "Security Assessments",
      description: "Make security assessments programmatically available",
      href: "/attest/security-assessment"
    },
    {
      icon: Award,
      title: "Certification Attestations",
      description: "Create verifiable certifications for applications and services",
      href: "/attest/certification"
    },
    {
      icon: FileCheck,
      title: "Endorsements",
      description: "Provide endorsements and recommendations for projects",
      href: "/attest/endorsement"
    },
    {
      icon: LinkIcon,
      title: "Linked Identifiers",
      description: "Link and verify different identity systems",
      href: "/attest/linked-identifier"
    },
    {
      icon: KeyRound,
      title: "Key Binding",
      description: "Publicly authorize a key to sign on your behalf",
      href: "/attest/key-binding"
    },
    {
      icon: Eye,
      title: "Controller Witness",
      description: "Be a third-party witness to a Key Binding or Linked Identifier attestation",
      href: "/attest/controller-witness"
    },
    {
      icon: Star,
      title: "User Reviews",
      description: "Submit detailed reviews and ratings for applications",
      href: "/attest/user-review"
    },
    {
      icon: MessageSquare,
      title: "User Review Responses",
      description: "Respond to a user review",
      href: "/attest/user-review-response"
    },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <div className="mb-16 px-4 py-10 text-center">
        <h1 className="text-balance mb-6 text-4xl font-semibold tracking-tight text-foreground md:text-6xl">OMATrust Reputation Portal</h1>
        <p className="text-balance mx-auto mb-8 max-w-3xl text-2xl text-muted-foreground md:text-3xl">
          Submit verifiable attestations on apps and services
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
        {features.map((feature, index) => (
          <Card key={index} className="flex flex-col border-border/70 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-950/10">
            <CardHeader>
              <feature.icon className="mb-2 h-8 w-8 text-primary" />
              <CardTitle className="text-lg tracking-tight">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <CardDescription className="flex-1">{feature.description}</CardDescription>
              <div className="flex justify-center mt-4">
                <Link href={feature.href}>
                  <Button>Submit</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stats Section - Hidden until we have more attestations */}
      {/* TODO: Re-enable when attestation count is significant
      <div className="bg-white rounded-lg shadow-sm border p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold text-primary mb-2">1,234</div>
            <div className="text-muted-foreground">Total Attestations</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary mb-2">567</div>
            <div className="text-muted-foreground">Verified Applications</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary mb-2">89</div>
            <div className="text-muted-foreground">Active Attestors</div>
          </div>
        </div>
      </div>
      */}

      {/* Latest Attestations */}
      <LatestAttestations />
    </div>
  )
}
