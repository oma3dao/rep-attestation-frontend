"use client"

import Link from "next/link"
import { ChevronDown, Star, FileCheck, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { BackendSubject } from "@/lib/omatrust-backend"

interface PublishButtonProps {
  /** Registered subjects for the current user — used to pre-fill forms */
  subjects?: BackendSubject[]
  /** Connected wallet DID; its hidden default subject should not count as a publish target */
  walletDid?: string | null
}

export function PublishButton({ subjects, walletDid }: PublishButtonProps) {
  const visibleSubjects = (subjects ?? []).filter(subject => {
    return !(subject.isDefault && walletDid && subject.canonicalDid.toLowerCase() === walletDid.toLowerCase())
  })
  // Pre-fill responsibleParty if the user has exactly one subject
  const responsiblePartyDid = visibleSubjects.length === 1 ? visibleSubjects[0].canonicalDid : null
  const responsibilityClaimHref = responsiblePartyDid
    ? `/publish/responsibility-claim?responsibleParty=${encodeURIComponent(responsiblePartyDid)}`
    : "/publish/responsibility-claim"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          Publish
          <ChevronDown className="ml-1.5 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <Link href="/publish/user-review" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            User Review
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={responsibilityClaimHref} className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            Content Claim
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/publish" className="flex items-center gap-2">
            <MoreHorizontal className="h-4 w-4" />
            Other attestations...
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
