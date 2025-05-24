"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FormField } from "@/components/form-field"
import { ArrowLeft, LinkIcon } from "lucide-react"
import Link from "next/link"

interface LinkedIdentifierData {
  subject: string
  linkedId: string
  linkedIdType: string
  method: string
  issuedAt: string
  validUntil: string
  attestationType: string
}

export default function LinkedIdentifierForm() {
  const [formData, setFormData] = useState<LinkedIdentifierData>({
    subject: "",
    linkedId: "",
    linkedIdType: "",
    method: "",
    issuedAt: "",
    validUntil: "",
    attestationType: "linked-identifier",
  })

  const [errors, setErrors] = useState<Partial<LinkedIdentifierData>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateField = (field: keyof LinkedIdentifierData, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const validateForm = () => {
    const newErrors: Partial<LinkedIdentifierData> = {}

    if (!formData.subject) newErrors.subject = "Subject is required"
    if (!formData.linkedId) newErrors.linkedId = "Linked ID is required"
    if (!formData.linkedIdType) newErrors.linkedIdType = "Linked ID type is required"
    if (!formData.method) newErrors.method = "Method is required"
    if (!formData.issuedAt) newErrors.issuedAt = "Issued date is required"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)

    try {
      console.log("Submitting linked identifier:", formData)
      await new Promise((resolve) => setTimeout(resolve, 2000))
      alert("Linked identifier attestation submitted successfully!")
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
          <LinkIcon className="h-8 w-8 text-purple-600" />
          <h1 className="text-3xl font-bold text-gray-900">Linked Identifier Attestation</h1>
        </div>

        <p className="text-gray-600">
          Create a linked identifier attestation to verify connections between different identity systems.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Linked Identifier Details</CardTitle>
          <CardDescription>Link and verify different identity systems and accounts.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <FormField
              label="Subject"
              name="subject"
              value={formData.subject}
              onChange={(value) => updateField("subject", value)}
              required
              description="The primary identity being linked"
              error={errors.subject}
            />

            <div className="grid md:grid-cols-2 gap-6">
              <FormField
                label="Linked ID"
                name="linkedId"
                value={formData.linkedId}
                onChange={(value) => updateField("linkedId", value)}
                required
                description="The identifier being linked to the subject"
                error={errors.linkedId}
              />

              <FormField
                label="Linked ID Type"
                name="linkedIdType"
                value={formData.linkedIdType}
                onChange={(value) => updateField("linkedIdType", value)}
                required
                description="Type of the linked identifier"
                placeholder="email, twitter, github, etc."
                error={errors.linkedIdType}
              />
            </div>

            <FormField
              label="Method"
              name="method"
              value={formData.method}
              onChange={(value) => updateField("method", value)}
              required
              description="Method used to verify the link"
              placeholder="DNS verification, OAuth, signature, etc."
              error={errors.method}
            />

            <div className="grid md:grid-cols-2 gap-6">
              <FormField
                label="Issued Date"
                name="issuedAt"
                type="datetime-local"
                value={formData.issuedAt}
                onChange={(value) => updateField("issuedAt", value)}
                required
                description="When the link was established"
                error={errors.issuedAt}
              />

              <FormField
                label="Valid Until"
                name="validUntil"
                type="datetime-local"
                value={formData.validUntil}
                onChange={(value) => updateField("validUntil", value)}
                description="When the link expires"
                error={errors.validUntil}
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
