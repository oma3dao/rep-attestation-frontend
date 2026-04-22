export interface PublishOption {
  schemaId: string
  title: string
  description: string
  href: string
  icon: "star" | "shield" | "award" | "file-check" | "link" | "eye"
  docsHref?: string
}

export interface DashboardAction {
  title: string
  description: string
  href: string
}

export const publishOptions: PublishOption[] = [
  {
    schemaId: "user-review",
    title: "Review an app or service",
    description: "Submit a public review with verifiable trust data for a service you have used.",
    href: "/publish/user-review",
    icon: "star",
  },
  {
    schemaId: "security-assessment",
    title: "Publish a security assessment",
    description: "Publish an assessment that helps others understand a service's security posture.",
    href: "/publish/security-assessment",
    icon: "shield",
  },
  {
    schemaId: "certification",
    title: "Issue a certification",
    description: "Publish a certification for a service, product, or organization.",
    href: "/publish/certification",
    icon: "award",
  },
  {
    schemaId: "endorsement",
    title: "Endorse a service",
    description: "Publish an endorsement or recommendation for a service or organization.",
    href: "/publish/endorsement",
    icon: "file-check",
  },
  {
    schemaId: "linked-identifier",
    title: "Link two identities under common ownership",
    description: "Publish a trust record showing that two identifiers are controlled by the same entity.",
    href: "/publish/linked-identifier",
    icon: "link",
  },
  {
    schemaId: "controller-witness",
    title: "Publish a controller witness",
    description: "Publish a witness attestation for a controller assertion. See documentation for setup requirements.",
    href: "/publish/controller-witness",
    icon: "eye",
    docsHref: "https://docs.omatrust.org/",
  },
]

export const landingUseCases: string[] = [
  "Developers authorize signing keys for their services",
  "Auditors publish security assessments",
  "Certification bodies issue verifiable certifications",
  "Users submit reviews and endorsements",
  "Service providers respond to user reviews",
]

export const dashboardActions: DashboardAction[] = [
  {
    title: "Authorize a key",
    description: "Publish a key binding for a service you manage.",
    href: "/publish/key-binding",
  },
  {
    title: "Link identities",
    description: "Connect service identities under common ownership.",
    href: "/publish/linked-identifier",
  },
  {
    title: "Respond to reviews",
    description: "Publish a public response on behalf of your service.",
    href: "/publish/user-review-response",
  },
]
