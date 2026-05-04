"use client"

import Link from "next/link"
import { ChevronDown, Star, Shield, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PUBLISH_MENU_ITEMS } from "@/config/publish-categories"

const menuIcons: Record<string, typeof Star> = {
  review: Star,
  issuer: Shield,
  trust: KeyRound,
}

export function PublishButton() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          Publish
          <ChevronDown className="ml-1.5 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {PUBLISH_MENU_ITEMS.map((item) => {
          const Icon = menuIcons[item.id]
          return (
            <DropdownMenuItem key={item.id} asChild>
              <Link href={item.href} className="flex items-center gap-2">
                {Icon && <Icon className="h-4 w-4" />}
                {item.label}
              </Link>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
