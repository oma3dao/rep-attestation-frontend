"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FormField } from "@/components/form-field"
import { ArrowLeft, TestTube } from "lucide-react"
import Link from "next/link"

interface TestDeployData {
  schemaId: string
  msg9: string
  isActive: boolean
  tags: string[]
  scores: string[]
  optionalDescription: string
  statusFlags: string[]
}

export default function TestDeployForm() {
  const [formData, setFormData] = useState<TestDeployData>({
    schemaId: "",
    msg9: "",
    isActive: true,
    tags: [],
    scores: [],
    optionalDescription: "",
    statusFlags: [],
  })

  const [errors, setErrors] = useState<Partial<Record<keyof TestDeployData, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateField = (field: keyof TestDeployData, value: string | string[] | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const validateForm = () => {
    const newErrors: Partial<Record<keyof TestDeployData, string>> = {}

    if (!formData.schemaId) newErrors.schemaId = "Schema ID is required"
    if (!formData.msg9) newErrors.msg9 = "Message is required"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)

    try {
      console.log("Submitting test deploy schema:", formData)
      await new Promise((resolve) => setTimeout(resolve, 2000))
      alert("Test deploy schema attestation submitted successfully!")
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
          <TestTube className="h-8 w-8 text-orange-600" />
          <h1 className="text-3xl font-bold text-gray-900">Test Deploy Schema Attestation</h1>
        </div>

        <p className="text-gray-600">Document and validate test deployment configurations and results.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test Deploy Schema Details</CardTitle>
          <CardDescription>Provide information about your test deployment schema and results.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <FormField
                label="Schema ID"
                name="schemaId"
                value={formData.schemaId}
                onChange={(value) => updateField("schemaId", value)}
                required
                description="Unique identifier for the test schema"
                error={errors.schemaId}
              />

              <FormField
                label="Message"
                name="msg9"
                value={formData.msg9}
                onChange={(value) => updateField("msg9", value)}
                required
                description="Test message or description"
                error={errors.msg9}
              />
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => updateField("isActive", e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                Schema is currently active
              </label>
            </div>

            <FormField
              label="Tags"
              name="tags"
              type="array"
              value={formData.tags}
              onChange={(value) => updateField("tags", value)}
              description="Tags associated with this test deployment"
              placeholder="production, staging, beta"
              error={errors.tags}
            />

            <FormField
              label="Scores"
              name="scores"
              type="array"
              value={formData.scores}
              onChange={(value) => updateField("scores", value)}
              description="Test scores or metrics"
              placeholder="95, 87, 92"
              error={errors.scores}
            />

            <FormField
              label="Optional Description"
              name="optionalDescription"
              type="textarea"
              value={formData.optionalDescription}
              onChange={(value) => updateField("optionalDescription", value)}
              description="Additional details about the test deployment"
              placeholder="Describe the test deployment setup and results..."
              error={errors.optionalDescription}
            />

            <FormField
              label="Status Flags"
              name="statusFlags"
              type="array"
              value={formData.statusFlags}
              onChange={(value) => updateField("statusFlags", value)}
              description="Status flags for the deployment"
              placeholder="passed, warning, critical"
              error={errors.statusFlags}
            />

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
