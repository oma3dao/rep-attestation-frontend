import { describe, it, expect } from 'vitest'
import { socialPlatforms, getPlatformById, getPlatformIds } from '@/config/social-platforms'

describe('social-platforms config', () => {
  describe('socialPlatforms array', () => {
    it('contains expected platforms', () => {
      const ids = socialPlatforms.map(p => p.id)
      expect(ids).toContain('twitter')
      expect(ids).toContain('github')
      expect(ids).toContain('discord')
      expect(ids).toContain('telegram')
      expect(ids).toContain('linkedin')
    })

    it('has unique IDs', () => {
      const ids = socialPlatforms.map(p => p.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('all platforms have id and label', () => {
      socialPlatforms.forEach(platform => {
        expect(platform.id).toBeDefined()
        expect(platform.id.length).toBeGreaterThan(0)
        expect(platform.label).toBeDefined()
        expect(platform.label.length).toBeGreaterThan(0)
      })
    })

    it('platforms with proofUrl have valid template variables', () => {
      const platformsWithProof = socialPlatforms.filter(p => p.proofUrl)
      
      platformsWithProof.forEach(platform => {
        // proofUrl should contain at least {handle} or {proofId}
        const hasHandle = platform.proofUrl!.includes('{handle}')
        const hasProofId = platform.proofUrl!.includes('{proofId}')
        expect(hasHandle || hasProofId).toBe(true)
      })
    })

    it('twitter has correct proofUrl pattern', () => {
      const twitter = socialPlatforms.find(p => p.id === 'twitter')
      expect(twitter?.proofUrl).toBe('https://twitter.com/{handle}/status/{proofId}')
    })

    it('github has correct proofUrl pattern', () => {
      const github = socialPlatforms.find(p => p.id === 'github')
      expect(github?.proofUrl).toBe('https://gist.github.com/{handle}/{proofId}')
    })

    it('mastodon has instance variable in proofUrl', () => {
      const mastodon = socialPlatforms.find(p => p.id === 'mastodon')
      expect(mastodon?.proofUrl).toContain('{instance}')
    })
  })

  describe('getPlatformById', () => {
    it('returns platform for valid ID', () => {
      const twitter = getPlatformById('twitter')
      expect(twitter).toBeDefined()
      expect(twitter?.id).toBe('twitter')
      expect(twitter?.label).toBe('Twitter / X')
    })

    it('returns undefined for invalid ID', () => {
      const result = getPlatformById('nonexistent')
      expect(result).toBeUndefined()
    })

    it('returns platform with proofUrl when available', () => {
      const github = getPlatformById('github')
      expect(github?.proofUrl).toBeDefined()
    })

    it('returns platform without proofUrl when not available', () => {
      const discord = getPlatformById('discord')
      expect(discord).toBeDefined()
      expect(discord?.proofUrl).toBeUndefined()
    })

    it('is case-sensitive', () => {
      const result = getPlatformById('Twitter')
      expect(result).toBeUndefined()
    })
  })

  describe('getPlatformIds', () => {
    it('returns array of all platform IDs', () => {
      const ids = getPlatformIds()
      expect(Array.isArray(ids)).toBe(true)
      expect(ids.length).toBe(socialPlatforms.length)
    })

    it('contains expected IDs', () => {
      const ids = getPlatformIds()
      expect(ids).toContain('twitter')
      expect(ids).toContain('github')
      expect(ids).toContain('discord')
    })

    it('returns strings only', () => {
      const ids = getPlatformIds()
      ids.forEach(id => {
        expect(typeof id).toBe('string')
      })
    })

    it('matches socialPlatforms order', () => {
      const ids = getPlatformIds()
      socialPlatforms.forEach((platform, index) => {
        expect(ids[index]).toBe(platform.id)
      })
    })
  })
})
