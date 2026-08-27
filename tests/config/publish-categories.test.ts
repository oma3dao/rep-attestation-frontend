import { describe, it, expect } from 'vitest'
import {
  PUBLISH_CATEGORIES,
  PUBLISH_MENU_ITEMS,
  getPublishCategory,
} from '@/config/publish-categories'
import { publishOptions, dashboardActions, landingUseCases } from '@/config/publish-options'

describe('publish-categories', () => {
  it('exposes the expected category keys and form lists', () => {
    expect(Object.keys(PUBLISH_CATEGORIES).sort()).toEqual(['issuer', 'review', 'trust'])
    expect(PUBLISH_CATEGORIES.review.forms).toEqual(['user-review'])
    expect(PUBLISH_CATEGORIES.issuer.forms).toEqual(['security-assessment', 'certification'])
    expect(PUBLISH_CATEGORIES.trust.forms).toContain('key-binding')
  })

  it('parses valid category query params and rejects unknowns', () => {
    expect(getPublishCategory(new URLSearchParams('category=issuer'))).toBe('issuer')
    expect(getPublishCategory(new URLSearchParams('category=review'))).toBe('review')
    expect(getPublishCategory(new URLSearchParams('category=trust'))).toBe('trust')
    expect(getPublishCategory(new URLSearchParams('category=nope'))).toBeNull()
    expect(getPublishCategory(new URLSearchParams())).toBeNull()
  })

  it('keeps dashboard publish menu items aligned with routes', () => {
    expect(PUBLISH_MENU_ITEMS.map((item) => item.id)).toEqual([
      'review',
      'claim',
      'issuer',
      'trust',
    ])
    expect(PUBLISH_MENU_ITEMS.find((item) => item.id === 'issuer')?.href).toBe(
      '/publish?category=issuer'
    )
  })
})

describe('publish-options', () => {
  it('includes core launch schemas with form hrefs', () => {
    const ids = publishOptions.map((option) => option.schemaId)
    expect(ids).toContain('key-binding')
    expect(ids).toContain('user-review')
    expect(ids).toContain('responsibility-claim')
    expect(publishOptions.every((option) => option.href.startsWith('/publish/'))).toBe(true)
  })

  it('exposes landing use cases and dashboard actions', () => {
    expect(landingUseCases.length).toBeGreaterThan(0)
    expect(dashboardActions.every((action) => action.href.startsWith('/publish/'))).toBe(true)
  })
})
