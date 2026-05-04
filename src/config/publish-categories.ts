/**
 * Publish Page Category Configuration
 *
 * Maps category query parameter values to the attestation form schema IDs
 * that should be shown. Used by /publish?category=<value>.
 * See docs/features/portal-ui/spec.md §8.2 for product behavior.
 */

export interface PublishCategory {
  label: string
  forms: string[]
}

export const PUBLISH_CATEGORIES: Record<string, PublishCategory> = {
  review: {
    label: "User Review",
    forms: ["user-review"],
  },
  issuer: {
    label: "Audit / Certification",
    forms: ["security-assessment", "certification"],
  },
  trust: {
    label: "Trust Management",
    forms: ["key-binding", "linked-identifier", "controller-witness"],
  },
}

/**
 * Dashboard Publish button menu items.
 * Each routes to /publish with the appropriate category parameter.
 */
export const PUBLISH_MENU_ITEMS = [
  {
    id: "review",
    label: "User Review",
    href: "/publish?category=review",
  },
  {
    id: "issuer",
    label: "Audit / Certification",
    href: "/publish?category=issuer",
  },
  {
    id: "trust",
    label: "Trust Management",
    href: "/publish?category=trust",
  },
] as const

export type PublishCategoryKey = keyof typeof PUBLISH_CATEGORIES

export function getPublishCategory(
  searchParams: Pick<URLSearchParams, "get">
): PublishCategoryKey | null {
  const category = searchParams.get("category")
  if (
    category === "review" ||
    category === "issuer" ||
    category === "trust"
  ) {
    return category
  }
  return null
}
