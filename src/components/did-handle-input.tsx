"use client"

import React, { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CheckIcon, AlertCircleIcon, InfoIcon } from "lucide-react"

interface DidHandleInputProps {
  value?: string
  onChange: (did: string | null) => void
  className?: string
  error?: string
}

type Platform = 
  | "bluesky"
  | "discord"
  | "epic"
  | "facebook"
  | "farcaster"
  | "github"
  | "gitlab"
  | "instagram"
  | "kakaotalk"
  | "lens"
  | "line"
  | "linkedin"
  | "mastodon"
  | "pinterest"
  | "playstation"
  | "reddit"
  | "roblox"
  | "signal"
  | "snapchat"
  | "stackoverflow"
  | "steam"
  | "telegram"
  | "threads"
  | "tiktok"
  | "twitch"
  | "twitter"
  | "vk"
  | "wechat"
  | "weibo"
  | "whatsapp"
  | "xbox"
  | "youtube"
  | ""

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
  const [platform, setPlatform] = useState<Platform>("")
  const [handle, setHandle] = useState("")
  const [internalError, setInternalError] = useState<string | null>(null)

  // Parse existing DID on mount
  useEffect(() => {
    if (value && value.startsWith("did:handle:")) {
      const parts = value.replace("did:handle:", "").split(":")
      if (parts.length === 2) {
        setPlatform(parts[0] as Platform)
        setHandle(parts[1])
      }
    }
  }, [value])

  const handlePlatformChange = (newPlatform: string) => {
    setPlatform(newPlatform as Platform)
    setInternalError(null)
    if (handle && newPlatform) {
      const did = `did:handle:${newPlatform}:${handle}`
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
    if (!handle.trim() || !platform) {
      onChange(null)
      return
    }

    // Basic handle validation (alphanumeric, underscores, hyphens)
    const handleRegex = /^[a-zA-Z0-9_-]+$/
    
    if (!handleRegex.test(handle)) {
      setInternalError("Invalid handle format. Use only letters, numbers, underscores, and hyphens.")
      onChange(null)
      return
    }

    const did = `did:handle:${platform}:${handle}`
    onChange(did)
  }

  const completeDid = platform && handle ? `did:handle:${platform}:${handle}` : ""
  const showError = externalError || internalError
  const errorMessage = externalError || internalError

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="grid gap-2">
        <Label htmlFor="did-handle-platform">Platform</Label>
        <Select value={platform} onValueChange={handlePlatformChange}>
          <SelectTrigger id="did-handle-platform">
            <SelectValue placeholder="Select platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bitbucket">Bitbucket</SelectItem>
            <SelectItem value="bluesky">Bluesky</SelectItem>
            <SelectItem value="discord">Discord</SelectItem>
            <SelectItem value="epic">Epic Games</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="farcaster">Farcaster</SelectItem>
            <SelectItem value="github">GitHub</SelectItem>
            <SelectItem value="gitlab">GitLab</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="kakaotalk">KakaoTalk</SelectItem>
            <SelectItem value="lens">Lens Protocol</SelectItem>
            <SelectItem value="line">LINE</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
            <SelectItem value="mastodon">Mastodon</SelectItem>
            <SelectItem value="pinterest">Pinterest</SelectItem>
            <SelectItem value="playstation">PlayStation</SelectItem>
            <SelectItem value="reddit">Reddit</SelectItem>
            <SelectItem value="roblox">Roblox</SelectItem>
            <SelectItem value="signal">Signal</SelectItem>
            <SelectItem value="snapchat">Snapchat</SelectItem>
            <SelectItem value="steam">Steam</SelectItem>
            <SelectItem value="telegram">Telegram</SelectItem>
            <SelectItem value="threads">Threads</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
            <SelectItem value="twitch">Twitch</SelectItem>
            <SelectItem value="twitter">Twitter / X</SelectItem>
            <SelectItem value="vk">VK</SelectItem>
            <SelectItem value="wechat">WeChat</SelectItem>
            <SelectItem value="weibo">Weibo</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="xbox">Xbox</SelectItem>
            <SelectItem value="youtube">YouTube</SelectItem>
          </SelectContent>
        </Select>
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
            disabled={!platform}
            className={`border-0 focus-visible:ring-0 focus-visible:ring-offset-0 ${showError ? "border-red-500" : ""}`}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Enter the username without the @ symbol
        </p>

        {/* Error */}
        {showError && (
          <div className="flex gap-2 items-start text-red-600 dark:text-red-400 text-sm">
            <AlertCircleIcon size={16} className="mt-0.5 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success */}
        {!showError && platform && handle && (
          <div className="flex gap-2 items-start text-green-600 dark:text-green-400 text-sm">
            <CheckIcon size={16} className="mt-0.5 flex-shrink-0" />
            <span>Valid handle format</span>
          </div>
        )}
      </div>

      {/* Complete DID Preview */}
      {completeDid && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
          <div className="flex gap-2 items-start">
            <InfoIcon size={16} className="mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">
                Complete DID:
              </p>
              <code className="text-xs text-blue-700 dark:text-blue-300 break-all block font-mono">
                {completeDid}
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
