import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowRight } from 'lucide-react'
import { getAllSchemas } from '@/config/schemas'

export default function AttestPage() {
  const schemas = getAllSchemas()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">Create Attestation</h1>
          <p className="text-lg text-muted-foreground">
            Choose the type of attestation you want to create
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {schemas.map((schema) => {
            return (
              <Link key={schema.id} href={`/attest/${schema.id}`}>
                <Card className="h-full transition-all duration-200 cursor-pointer bg-blue-50 border-blue-200 hover:bg-blue-100">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div>
                          <CardTitle className="text-xl">{schema.title}</CardTitle>
                          <Badge variant="secondary" className="mt-1">
                            {schema.fields.length} fields
                          </Badge>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">
                      {schema.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}