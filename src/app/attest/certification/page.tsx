"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FormField } from "@/components/form-field"
import { ArrowLeft, Shield } from "lucide-react"
import Link from "next/link"

interface CertificationData {
  subject: string
  subjectOwner: string
  subjectMetadataURI: string
  programIdentifier: string
  programMetadataURI: string
  anchoredDataURL: string
  anchoredDataAlgorithm: string
  anchoredDataHash: string
  assessor: string
  assessorMetadataURI: string
  certificationLevel: string
  version: string
  versionHW: string
  effectiveAt: string
  expiresAt: string
  issuedAt: string
  attestationType: string
}

export default function CertificationForm() {
  const [formData, setFormData] = useState<CertificationData>({
    subject: "",
    subjectOwner: "",
    subjectMetadataURI: "",
    programIdentifier: "",
    programMetadataURI: "",
    anchoredDataURL: "",
    anchoredDataAlgorithm: "",
    anchoredDataHash: "",
    assessor: "",
    assessorMetadataURI: "",
    certificationLevel: "",
    version: "",
    versionHW: "",
    effectiveAt: "",
    expiresAt: "",
    issuedAt: "",
    attestationType: "certification",
  })

  const [errors, setErrors] = useState<Partial<CertificationData>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateField = (field: keyof CertificationData, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const validateForm = () => {
    const newErrors: Partial<CertificationData> = {}

    if (!formData.subject) newErrors.subject = "Subject is required"
    if (!formData.subjectOwner) newErrors.subjectOwner = "Subject owner is required"
    if (!formData.programIdentifier) newErrors.programIdentifier = "Program identifier is required"
    if (!formData.assessor) newErrors.assessor = "Assessor is required"
    if (!formData.certificationLevel) newErrors.certificationLevel = "Certification level is required"
    if (!formData.issuedAt) newErrors.issuedAt = "Issued date is required"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)

    try {
      // Placeholder for actual submission logic
      console.log("Submitting certification:", formData)
      await new Promise((resolve) => setTimeout(resolve, 2000))
      alert("Certification attestation submitted successfully!")
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
          <Shield className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Certification Attestation</h1>
        </div>

        <p className="text-gray-600">
          Create a verifiable certification attestation for applications, compliance, and security assessments.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Certification Details</CardTitle>
          <CardDescription>Fill in all required fields to create your certification attestation.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <FormField
                label="Subject"
                name="subject"
                value={formData.subject}
                onChange={(value) => updateField("subject", value)}
                required
                description="The entity being certified"
                error={errors.subject}
              />

              <FormField
                label="Subject Owner"
                name="subjectOwner"
                value={formData.subjectOwner}
                onChange={(value) => updateField("subjectOwner", value)}
                required
                description="Owner of the subject being certified"
                error={errors.subjectOwner}
              />
            </div>

            <FormField
              label="Subject Metadata URI"
              name="subjectMetadataURI"
              type="url"
              value={formData.subjectMetadataURI}
              onChange={(value) => updateField("subjectMetadataURI", value)}
              description="URI pointing to metadata about the subject"
              placeholder="https://example.com/metadata.json"
              error={errors.subjectMetadataURI}
            />

            <div className="grid md:grid-cols-2 gap-6">
              <FormField
                label="Program Identifier"
                name="programIdentifier"
                value={formData.programIdentifier}
                onChange={(value) => updateField("programIdentifier", value)}
                required
                description="Unique identifier for the certification program"
                error={errors.programIdentifier}
              />

              <FormField
                label="Program Metadata URI"
                name="programMetadataURI"
                type="url"
                value={formData.programMetadataURI}
                onChange={(value) => updateField("programMetadataURI", value)}
                description="URI pointing to certification program metadata"
                placeholder="https://example.com/program.json"
                error={errors.programMetadataURI}
              />
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <FormField
                label="Anchored Data URL"
                name="anchoredDataURL"
                type="url"
                value={formData.anchoredDataURL}
                onChange={(value) => updateField("anchoredDataURL", value)}
                description="URL to anchored certification data"
                error={errors.anchoredDataURL}
              />

              <FormField
                label="Anchored Data Algorithm"
                name="anchoredDataAlgorithm"
                value={formData.anchoredDataAlgorithm}
                onChange={(value) => updateField("anchoredDataAlgorithm", value)}
                description="Algorithm used for data anchoring"
                placeholder="SHA-256"
                error={errors.anchoredDataAlgorithm}
              />

              <FormField
                label="Anchored Data Hash"
                name="anchoredDataHash"
                value={formData.anchoredDataHash}
                onChange={(value) => updateField("anchoredDataHash", value)}
                description="Hash of the anchored data"
                error={errors.anchoredDataHash}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <FormField
                label="Assessor"
                name="assessor"
                value={formData.assessor}
                onChange={(value) => updateField("assessor", value)}
                required
                description="Entity performing the assessment"
                error={errors.assessor}
              />

              <FormField
                label="Assessor Metadata URI"
                name="assessorMetadataURI"
                type="url"
                value={formData.assessorMetadataURI}
                onChange={(value) => updateField("assessorMetadataURI", value)}
                description="URI pointing to assessor metadata"
                placeholder="https://example.com/assessor.json"
                error={errors.assessorMetadataURI}
              />
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <FormField
                label="Certification Level"
                name="certificationLevel"
                value={formData.certificationLevel}
                onChange={(value) => updateField("certificationLevel", value)}
                required
                description="Level or grade of certification"
                placeholder="Level 1, Gold, etc."
                error={errors.certificationLevel}
              />

              <FormField
                label="Version"
                name="version"
                value={formData.version}
                onChange={(value) => updateField("version", value)}
                description="Software version being certified"
                placeholder="1.0.0"
                error={errors.version}
              />

              <FormField
                label="Hardware Version"
                name="versionHW"
                value={formData.versionHW}
                onChange={(value) => updateField("versionHW", value)}
                description="Hardware version (if applicable)"
                placeholder="v2.1"
                error={errors.versionHW}
              />
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <FormField
                label="Effective Date"
                name="effectiveAt"
                type="datetime-local"
                value={formData.effectiveAt}
                onChange={(value) => updateField("effectiveAt", value)}
                description="When the certification becomes effective"
                error={errors.effectiveAt}
              />

              <FormField
                label="Expiration Date"
                name="expiresAt"
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(value) => updateField("expiresAt", value)}
                description="When the certification expires"
                error={errors.expiresAt}
              />

              <FormField
                label="Issued Date"
                name="issuedAt"
                type="datetime-local"
                value={formData.issuedAt}
                onChange={(value) => updateField("issuedAt", value)}
                required
                description="When the certification was issued"
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
