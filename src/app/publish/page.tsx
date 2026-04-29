"use client"

import { Suspense, useEffect, useRef } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  ArrowRight,
  Award,
  ExternalLink,
  Eye,
  FileCheck,
  KeyRound,
  LinkIcon,
  MessageSquare,
  Shield,
  Star,
  type LucideIcon,
} from "lucide-react"
import { publishOptions } from "@/config/publish-options"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useBackendSession } from "@/components/backend-session-provider"

const iconMap: Record<string, LucideIcon> = {
  star: Star,
  shield: Shield,
  award: Award,
  "file-check": FileCheck,
  link: LinkIcon,
  eye: Eye,
  "key-round": KeyRound,
  "message-square": MessageSquare,
}

function PublishPageContent() {
  const { session } = useBackendSession()
  const searchParams = useSearchParams()
  const highlightedType = searchParams.get("type")
  const highlightRef = useRef<HTMLDivElement>(null)
  const dashboardHref = session ? "/dashboard" : "/dashboard?action=signin"

  useEffect(() => {
    if (highlightedType && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [highlightedType])

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-3 max-w-2xl">
        <h1 className="technical-label uppercase text-primary">Publish</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {publishOptions.map((option) => {
          const Icon = iconMap[option.icon]
          const isHighlighted = highlightedType === option.schemaId

          return (
          <Card
            key={option.schemaId}
            ref={isHighlighted ? highlightRef : undefined}
            className={`flex h-full flex-col transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-950/10 ${
              isHighlighted
                ? "border-primary/50 bg-primary/5 ring-2 ring-primary/20"
                : "border-border/70 hover:border-primary/30 hover:bg-primary/5"
            }`}
          >
            <CardHeader>
              <Icon className="mb-3 h-8 w-8 text-primary" />
              <CardTitle className="text-xl tracking-tight">{option.title}</CardTitle>
              <CardDescription className="text-base">{option.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto flex items-center justify-between gap-3 pt-2">
              <Link href={option.href}>
                <Button>
                  Open Form
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>

              {option.docsHref ? (
                <Link
                  href={option.docsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Docs
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </CardContent>
          </Card>
          )
        })}
      </div>

      <div className="mt-12 rounded-2xl border border-border/80 bg-card p-6 shadow-sm shadow-slate-950/5">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Managing trust for your own service?
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Authorizing keys and responding to reviews live in the dashboard, where service
          operators can manage ongoing trust activity.
        </p>
        <Link href={dashboardHref} className="mt-4 inline-flex">
          <Button variant="outline">Open Dashboard</Button>
        </Link>
      </div>
    </div>
  )
}

export default function PublishPage() {
  return (
    <Suspense>
      <PublishPageContent />
    </Suspense>
  )
}
