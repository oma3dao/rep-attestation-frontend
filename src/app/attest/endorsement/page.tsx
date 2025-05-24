"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FormField } from "@/components/form-field"
import { ArrowLeft, FileCheck } from "lucide-react"
import Link from "next/link"

interface EndorsementData {
  subject: string
  purpose: string
  version: string
  attestationType: string
  policyURI: string
  effectiveAt: string
  expiresAt: string
  issuedAt: string
}

export default function EndorsementForm() {
  const [formData, setFormData] = useState<EndorsementData>({
    subject: "",
    purpose: "",
    version: "",
    attestationType: "endorsement",
    policyURI: "",
    effectiveAt: "",
    expiresAt: "",
    issuedAt: "",
  })

  const [errors, setErrors] = useState<Partial<EndorsementData>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateField = (field: keyof EndorsementData, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const validateForm = () => {
    const newErrors: Partial<EndorsementData> = {}

    if (!formData.subject) newErrors.subject = "Subject is required"
    if (!formData.purpose) newErrors.purpose = "Purpose is required"
    if (!formData.issuedAt) newErrors.issuedAt = "Issued date is required"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)

    try {
      console.log("Submitting endorsement:", formData)
      await new Promise((resolve) => setTimeout(resolve, 2000))
      alert("Endorsement attestation submitted successfully!")
    } catch (error) {
      console.error("Submission error:", error)
      alert("Failed to submit attestation. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <Link href="/attest" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Attestation Types
        </Link>

        <div className="flex items-center space-x-3 mb-4">
          <FileCheck className="h-8 w-8 text-green-600" />
          <h1 className="text-3xl font-bold text-gray-900">Endorsement Attestation</h1>
        </div>

        <p className="text-gray-600">
          Create an endorsement attestation to recommend and vouch for projects and applications.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Endorsement Details</CardTitle>
          <CardDescription>Provide details about your endorsement and recommendation.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <FormField
              label="Subject"
              name="subject"
              value={formData.subject}
              onChange={(value) => updateField("subject", value)}
              required
              description="The entity being endorsed"
              error={errors.subject}
            />

            <FormField
              label="Purpose"
              name="purpose"
              type="textarea"
              value={formData.purpose}
              onChange={(value) => updateField("purpose", value)}
              required
              description="Purpose and reason for this endorsement"
              placeholder="Describe why you are endorsing this entity..."
              error={errors.purpose}
            />

            <div className="grid md:grid-cols-2 gap-6">
              <FormField
                label="Version"
                name="version"
                value={formData.version}
                onChange={(value) => updateField("version", value)}
                description="Version of the subject being endorsed"
                placeholder="1.0.0"
                error={errors.version}
              />

              <FormField
                label="Policy URI"
                name="policyURI"
                type="url"
                value={formData.policyURI}
                onChange={(value) => updateField("policyURI", value)}
                description="URI pointing to endorsement policy"
                placeholder="https://example.com/policy.json"
                error={errors.policyURI}
              />
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <FormField
                label="Effective Date"
                name="effectiveAt"
                type="datetime-local"
                value={formData.effectiveAt}
                onChange={(value) => updateField("effectiveAt", value)}
                description="When the endorsement becomes effective"
                error={errors.effectiveAt}
              />

              <FormField
                label="Expiration Date"
                name="expiresAt"
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(value) => updateField("expiresAt", value)}
                description="When the endorsement expires"
                error={errors.expiresAt}
              />

              <FormField
                label="Issued Date"
                name="issuedAt"
                type="datetime-local"
                value={formData.issuedAt}
                onChange={(value) => updateField("issuedAt", value)}
                required
                description="When the endorsement was issued"
                error={errors.issuedAt}
              />
            </div>

            <div className="flex justify-end space-x-4 pt-6">
              <Link href="/attest">
                <Button variant="outline">Cancel</Button>
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Attestation"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
