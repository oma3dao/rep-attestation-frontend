"use client"

import { useRouter } from "next/navigation"
import { ArrowRight, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useBackendSession } from "@/components/backend-session-provider"
import type { WorkflowCardConfig } from "@/config/home-workflows"

interface WorkflowCardProps {
  workflow: WorkflowCardConfig
}

export function WorkflowCard({ workflow }: WorkflowCardProps) {
  const isExternal = workflow.external
  const router = useRouter()
  const { session, openAuthDialog } = useBackendSession()
  const isSignedIn = !!session

  const handleAuthRequiredClick = () => {
    if (isSignedIn) {
      router.push(workflow.href)
    } else {
      openAuthDialog({
        mode: "chooser",
        reason: "navigation",
        redirectTo: workflow.href,
      })
    }
  }

  return (
    <Card className="flex h-full flex-col border-border/70 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5 hover:shadow-lg hover:shadow-slate-950/10">
      <CardHeader className="flex-1">
        <CardTitle className="text-xl tracking-tight">
          {workflow.title}
        </CardTitle>
        <CardDescription className="text-base">
          {workflow.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap items-center gap-3">
          {isExternal ? (
            <a
              href={workflow.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button>
                {workflow.ctaLabel}
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </a>
          ) : workflow.requiresAuth ? (
            <Button onClick={handleAuthRequiredClick}>
              {workflow.ctaLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => router.push(workflow.href)}>
              {workflow.ctaLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}

          {workflow.secondaryCta && (
            <a
              href={workflow.secondaryCta.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {workflow.secondaryCta.label}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
