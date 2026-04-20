"use client"

import React, { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CheckIcon, AlertCircleIcon, InfoIcon, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { socialPlatforms, getPlatformById } from "@/config/social-platforms"

interface DidHandleInputProps {
  value?: string
  onChange: (did: string | null) => void
  className?: string
  error?: string
}

/**
 * Input for did:handle identifiers
 * Format: did:handle:<platform>:<username>
 */
export function DidHandleInput({
  value = "",
  onChange,
  className = "",
  error: externalError,
}: DidHandleInputProps) {
  const [open, setOpen] = useState(false)
  const [platformId, setPlatformId] = useState("")
  const [handle, setHandle] = useState("")
  const [internalError, setInternalError] = useState<string | null>(null)

  // Parse existing DID on mount
  useEffect(() => {
    if (value && value.startsWith("did:handle:")) {
      const parts = value.replace("did:handle:", "").split(":")
      if (parts.length === 2) {
        setPlatformId(parts[0])
        setHandle(parts[1])
      }
    }
  }, [value])

  const handlePlatformSelect = (newPlatformId: string) => {
    setPlatformId(newPlatformId)
    setOpen(false)
    setInternalError(null)
    if (handle && newPlatformId) {
      const did = `did:handle:${newPlatformId}:${handle}`
      onChange(did)
    } else {
      onChange(null)
    }
  }

  const handleHandleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHandle = e.target.value
    setHandle(newHandle)
    setInternalError(null)
  }

  const handleBlur = () => {
    if (!handle.trim() || !platformId) {
      onChange(null)
      return
    }

    // Basic handle validation (alphanumeric, underscores, hyphens, dots)
    const handleRegex = /^[a-zA-Z0-9_.\-]+$/

    if (!handleRegex.test(handle)) {
      setInternalError("Invalid handle format. Use only letters, numbers, underscores, hyphens, and dots.")
      onChange(null)
      return
    }

    const did = `did:handle:${platformId}:${handle}`
    onChange(did)
  }

  const selectedPlatform = getPlatformById(platformId)
  const completeDid = platformId && handle ? `did:handle:${platformId}:${handle}` : ""
  const showError = externalError || internalError
  const errorMessage = externalError || internalError

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="grid gap-2">
        <Label>Platform</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="justify-between font-normal"
            >
              {selectedPlatform ? selectedPlatform.label : "Select platform..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
            <Command>
              <CommandInput placeholder="Search platforms..." />
              <CommandList>
                <CommandEmpty>No platform found.</CommandEmpty>
                <CommandGroup>
                  {socialPlatforms.map((platform) => (
                    <CommandItem
                      key={platform.id}
                      value={platform.label}
                      onSelect={() => handlePlatformSelect(platform.id)}
                    >
                      <CheckIcon
                        className={cn(
                          "mr-2 h-4 w-4",
                          platformId === platform.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {platform.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="did-handle-username">Username / Handle</Label>
        <div className="flex items-center border rounded-md">
          <span className="px-3 py-2 text-sm text-muted-foreground bg-muted border-r select-none">
            @
          </span>
          <Input
            id="did-handle-username"
            value={handle}
            onChange={handleHandleChange}
            onBlur={handleBlur}
            placeholder="username"
            disabled={!platformId}
            className={`border-0 focus-visible:ring-0 focus-visible:ring-offset-0 ${showError ? "field-error" : ""}`}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Enter the username without the @ symbol
        </p>

        {/* Error */}
        {showError && (
          <div className="feedback-error">
            <AlertCircleIcon size={16} className="mt-0.5 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success */}
        {!showError && platformId && handle && (
          <div className="feedback-success">
            <CheckIcon size={16} className="mt-0.5 flex-shrink-0" />
            <span>Valid handle format</span>
          </div>
        )}
      </div>

      {/* Complete DID Preview */}
      {completeDid && (
        <div className="info-panel p-3">
          <div className="flex gap-2 items-start">
            <InfoIcon size={16} className="mt-0.5 flex-shrink-0 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="mb-1 text-xs font-medium">
                Complete DID:
              </p>
              <code className="block break-all text-xs font-mono text-muted-foreground">
                {completeDid}
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
