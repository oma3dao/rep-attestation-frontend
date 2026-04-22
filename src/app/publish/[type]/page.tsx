"use client"

import React from "react"
import { notFound } from "next/navigation"
import { getSchema } from "@/config/schemas"
import { AttestationForm } from "@/components/AttestationForm"
import { useEffect, useState } from "react"

interface PublishSchemaPageProps {
  params: Promise<{
    type: string
  }>
}

export default function PublishSchemaPage({ params }: PublishSchemaPageProps) {
  const [schema, setSchema] = useState<any>(null)
  const [notFoundError, setNotFoundError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSchema() {
      try {
        const { type } = await params
        const schemaData = getSchema(type)

        if (!schemaData) {
          setNotFoundError(true)
        } else {
          setSchema(schemaData)
        }
      } catch {
        setNotFoundError(true)
      } finally {
        setLoading(false)
      }
    }

    void loadSchema()
  }, [params])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    )
  }

  if (notFoundError) {
    notFound()
  }

  return <AttestationForm schema={schema} />
}
