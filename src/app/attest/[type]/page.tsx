import { notFound } from 'next/navigation'
import { getSchema } from '@/config/schemas'
import { AttestationForm } from '@/components/AttestationForm'

interface AttestationPageProps {
  params: Promise<{
    type: string
  }>
}

export default async function AttestationPage({ params }: AttestationPageProps) {
  const { type } = await params
  const schema = getSchema(type)
  
  if (!schema) {
    notFound()
  }
  
  return <AttestationForm schema={schema} />
}

// Generate static params for all available schema types
export async function generateStaticParams() {
  const { getSchemaIds } = await import('@/config/schemas')
  const schemaIds = getSchemaIds()
  
  return schemaIds.map((type: string) => ({
    type,
  }))
} 