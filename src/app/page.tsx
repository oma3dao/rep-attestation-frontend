"use client"

import Link from "next/link"
import { ArrowRight, FolderKanban, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LatestAttestations } from "@/components/latest-attestations"
import { useBackendSession } from "@/components/backend-session-provider"

export default function HomePage() {
  const { session } = useBackendSession()
  const dashboardHref = session ? "/dashboard" : "/dashboard?action=signin"

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <section className="mb-3 max-w-2xl">
        <h1 className="technical-label uppercase text-primary">
          OMATrust Portal
        </h1>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="flex h-full flex-col border-border/70 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5 hover:shadow-lg hover:shadow-slate-950/10">
          <CardHeader>
            <ShieldCheck className="mb-3 h-8 w-8 text-primary" />
            <CardTitle className="text-2xl tracking-tight">Publish Trust Data</CardTitle>
            <CardDescription className="text-base">
              Submit reviews, audits, certifications, or endorsements for services.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto pt-0">
            <Link href="/publish">
              <Button className="w-full sm:w-auto">
                Start Publishing
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col border-border/70 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5 hover:shadow-lg hover:shadow-slate-950/10">
          <CardHeader>
            <FolderKanban className="mb-3 h-8 w-8 text-primary" />
            <CardTitle className="text-2xl tracking-tight">Manage Trust For Your Service</CardTitle>
            <CardDescription className="text-base">
              Authorize signing keys, link identities, and respond to reviews.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto pt-0">
            <Link href={dashboardHref}>
              <Button className="w-full sm:w-auto">
                Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      <section className="mt-16">
        <div className="mb-3 max-w-2xl">
          <p className="technical-label text-primary">Latest Activity</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/70 px-4 py-2 shadow-sm shadow-slate-950/5 sm:px-8">
          <LatestAttestations showHeading={false} />
        </div>
      </section>
    </div>
  )
}
