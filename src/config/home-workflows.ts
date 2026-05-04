/**
 * Homepage Workflow CTA Card Configuration
 *
 * Defines the four primary workflow cards shown on the landing page.
 * See docs/features/portal-ui/spec.md §4.3 for product behavior.
 */

export interface WorkflowCardConfig {
  id: string
  title: string
  description: string
  ctaLabel: string
  href: string
  requiresAuth?: boolean
  external?: boolean
  secondaryCta?: {
    label: string
    href: string
  }
}

export const HOME_WORKFLOWS: WorkflowCardConfig[] = [
  {
    id: "review",
    title: "Review an app or service",
    description:
      "Submit a public review with verifiable trust data for a service you used.",
    ctaLabel: "Start review",
    href: "/publish/user-review",
  },
  {
    id: "service",
    title: "Manage your trust",
    description:
      "Verify your service, authorize signing keys, and manage review responses.",
    ctaLabel: "Open service workspace",
    href: "/dashboard?context=service-management",
    requiresAuth: true,
  },
  {
    id: "issuer",
    title: "Auditors & certifiers",
    description:
      "Publish assessments, issue certifications, and build trust as a professional issuer.",
    ctaLabel: "Open issuer workspace",
    href: "/dashboard?context=issuer",
    requiresAuth: true,
  },
  {
    id: "developer",
    title: "Build with OMATrust",
    description:
      "Query reviews, key bindings, controller witnesses, and trust records for your app, agent, or discovery tool.",
    ctaLabel: "View API Docs",
    href: "https://docs.omatrust.org", // exact path TBD
    secondaryCta: {
      label: "Compare API Plans",
      href: "https://docs.omatrust.org", // exact path TBD
    },
    external: true,
  },
]
