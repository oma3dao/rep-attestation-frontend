'use client'

import { notFound } from 'next/navigation'
import { getSchema } from '@/config/schemas'
import { AttestationForm } from '@/components/AttestationForm'
import { useEffect, useState } from 'react'

interface AttestationPageProps {
  params: Promise<{
    type: string
  }>
}

export default function AttestationPage({ params }: AttestationPageProps) {
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
      } catch (error) {
        setNotFoundError(true)
      } finally {
        setLoading(false)
      }
    }

    loadSchema()
  }, [params])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
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

// Remove generateStaticParams since we're now client-side
// This prevents the build-time pre-rendering that was causing the Wagmi error 