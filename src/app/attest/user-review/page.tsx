"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FormField } from "@/components/form-field"
import { ArrowLeft, Star } from "lucide-react"
import Link from "next/link"

interface UserReviewData {
  subject: string
  version: string
  summary: string
  reviewBody: string
  author: string
  datePublished: string
  ratingValue: string
  screenshotUrls: string[]
  anchoredDataURL: string
  anchoredDataAlgorithm: string
  anchoredDataHash: string
  attestationType: string
  issuedAt: string
  expiresAt: string
}

export default function UserReviewForm() {
  const [formData, setFormData] = useState<UserReviewData>({
    subject: "",
    version: "",
    summary: "",
    reviewBody: "",
    author: "",
    datePublished: "",
    ratingValue: "",
    screenshotUrls: [],
    anchoredDataURL: "",
    anchoredDataAlgorithm: "",
    anchoredDataHash: "",
    attestationType: "user-review",
    issuedAt: "",
    expiresAt: "",
  })

  const [errors, setErrors] = useState<Partial<Record<keyof UserReviewData, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateField = (field: keyof UserReviewData, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const validateForm = () => {
    const newErrors: Partial<Record<keyof UserReviewData, string>> = {}

    if (!formData.subject) newErrors.subject = "Subject is required"
    if (!formData.summary) newErrors.summary = "Summary is required"
    if (!formData.reviewBody) newErrors.reviewBody = "Review body is required"
    if (!formData.author) newErrors.author = "Author is required"
    if (!formData.ratingValue) newErrors.ratingValue = "Rating is required"
    if (!formData.issuedAt) newErrors.issuedAt = "Issued date is required"

    const rating = Number.parseFloat(formData.ratingValue)
    if (formData.ratingValue && (isNaN(rating) || rating < 1 || rating > 5)) {
      newErrors.ratingValue = "Rating must be between 1 and 5"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)

    try {
      console.log("Submitting user review:", formData)
      await new Promise((resolve) => setTimeout(resolve, 2000))
      alert("User review attestation submitted successfully!")
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
          <Star className="h-8 w-8 text-yellow-600" />
          <h1 className="text-3xl font-bold text-gray-900">User Review Attestation</h1>
        </div>

        <p className="text-gray-600">Submit a detailed review and rating for applications and services.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Review Details</CardTitle>
          <CardDescription>Provide your review and rating for the application or service.</CardDescription>
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
                description="The application or service being reviewed"
                error={errors.subject}
              />

              <FormField
                label="Version"
                name="version"
                value={formData.version}
                onChange={(value) => updateField("version", value)}
                description="Version of the application being reviewed"
                placeholder="1.0.0"
                error={errors.version}
              />
            </div>

            <FormField
              label="Summary"
              name="summary"
              value={formData.summary}
              onChange={(value) => updateField("summary", value)}
              required
              description="Brief summary of your review"
              placeholder="Great app with excellent user experience"
              error={errors.summary}
            />

            <FormField
              label="Review Body"
              name="reviewBody"
              type="textarea"
              value={formData.reviewBody}
              onChange={(value) => updateField("reviewBody", value)}
              required
              description="Detailed review content"
              placeholder="Provide your detailed review here..."
              error={errors.reviewBody}
            />

            <div className="grid md:grid-cols-3 gap-6">
              <FormField
                label="Author"
                name="author"
                value={formData.author}
                onChange={(value) => updateField("author", value)}
                required
                description="Review author name or identifier"
                error={errors.author}
              />

              <FormField
                label="Rating (1-5)"
                name="ratingValue"
                type="number"
                value={formData.ratingValue}
                onChange={(value) => updateField("ratingValue", value)}
                required
                description="Rating from 1 to 5 stars"
                placeholder="4.5"
                error={errors.ratingValue}
              />

              <FormField
                label="Date Published"
                name="datePublished"
                type="datetime-local"
                value={formData.datePublished}
                onChange={(value) => updateField("datePublished", value)}
                description="When the review was published"
                error={errors.datePublished}
              />
            </div>

            <FormField
              label="Screenshot URLs"
              name="screenshotUrls"
              type="array"
              value={formData.screenshotUrls}
              onChange={(value) => updateField("screenshotUrls", value)}
              description="URLs to screenshots supporting your review"
              placeholder="https://example.com/screenshot1.png, https://example.com/screenshot2.png"
              error={errors.screenshotUrls}
            />

            <div className="grid md:grid-cols-3 gap-6">
              <FormField
                label="Anchored Data URL"
                name="anchoredDataURL"
                type="url"
                value={formData.anchoredDataURL}
                onChange={(value) => updateField("anchoredDataURL", value)}
                description="URL to anchored review data"
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
                label="Issued Date"
                name="issuedAt"
                type="datetime-local"
                value={formData.issuedAt}
                onChange={(value) => updateField("issuedAt", value)}
                required
                description="When the review was issued"
                error={errors.issuedAt}
              />

              <FormField
                label="Expiration Date"
                name="expiresAt"
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(value) => updateField("expiresAt", value)}
                description="When the review expires (optional)"
                error={errors.expiresAt}
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
