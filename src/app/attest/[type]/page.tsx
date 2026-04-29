import { redirect } from 'next/navigation'

interface AttestationPageProps {
  params: Promise<{
    type: string
  }>
}

export default async function AttestationPage({ params }: AttestationPageProps) {
  const { type } = await params
  redirect(`/publish/${type}`)
}
