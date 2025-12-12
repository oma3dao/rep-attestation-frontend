/**
 * Social platform definitions for did:handle identifiers
 * 
 * Platforms can submit PRs to add their proof URL patterns.
 * The proofUrl uses template variables:
 *   {handle} - the user's handle/username
 *   {proofId} - the ID of the proof post/gist/etc
 *   {instance} - for federated platforms (e.g., Mastodon)
 */

export interface SocialPlatform {
  /** Unique identifier used in the DID (e.g., "twitter" -> did:handle:twitter:username) */
  id: string
  /** Display label */
  label: string
  /** Optional URL pattern for proof verification */
  proofUrl?: string
}

export const socialPlatforms: SocialPlatform[] = [
  { id: "bitbucket", label: "Bitbucket" },
  { id: "bluesky", label: "Bluesky", proofUrl: "https://bsky.app/profile/{handle}/post/{proofId}" },
  { id: "discord", label: "Discord" },
  { id: "epic", label: "Epic Games" },
  { id: "facebook", label: "Facebook" },
  { id: "farcaster", label: "Farcaster", proofUrl: "https://warpcast.com/{handle}/{proofId}" },
  { id: "github", label: "GitHub", proofUrl: "https://gist.github.com/{handle}/{proofId}" },
  { id: "gitlab", label: "GitLab", proofUrl: "https://gitlab.com/-/snippets/{proofId}" },
  { id: "instagram", label: "Instagram" },
  { id: "kakaotalk", label: "KakaoTalk" },
  { id: "keybase", label: "Keybase" },
  { id: "lens", label: "Lens Protocol" },
  { id: "line", label: "LINE" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "mastodon", label: "Mastodon", proofUrl: "https://{instance}/@{handle}/{proofId}" },
  { id: "npm", label: "npm" },
  { id: "pinterest", label: "Pinterest" },
  { id: "playstation", label: "PlayStation" },
  { id: "reddit", label: "Reddit", proofUrl: "https://reddit.com/user/{handle}/comments/{proofId}" },
  { id: "roblox", label: "Roblox" },
  { id: "signal", label: "Signal" },
  { id: "snapchat", label: "Snapchat" },
  { id: "stackoverflow", label: "Stack Overflow" },
  { id: "steam", label: "Steam" },
  { id: "telegram", label: "Telegram" },
  { id: "threads", label: "Threads" },
  { id: "tiktok", label: "TikTok" },
  { id: "twitch", label: "Twitch" },
  { id: "twitter", label: "Twitter / X", proofUrl: "https://twitter.com/{handle}/status/{proofId}" },
  { id: "vk", label: "VK", proofUrl: "https://vk.com/wall{handle}_{proofId}" },
  { id: "wechat", label: "WeChat" },
  { id: "weibo", label: "Weibo", proofUrl: "https://weibo.com/{handle}/{proofId}" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "xbox", label: "Xbox" },
  { id: "youtube", label: "YouTube" },
]

/** Get a platform by ID */
export function getPlatformById(id: string): SocialPlatform | undefined {
  return socialPlatforms.find(p => p.id === id)
}

/** Get all platform IDs */
export function getPlatformIds(): string[] {
  return socialPlatforms.map(p => p.id)
}
