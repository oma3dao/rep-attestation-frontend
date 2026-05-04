# Reputation Frontend UI Redesign — plan.md

## 1. Implementation Goal

Refactor the OMATrust reputation frontend from a schema-oriented publishing portal into a task-oriented product experience.

The implementation should preserve existing attestation form routes where possible, but route users through higher-level workflows:

- Review an app or service.
- Manage your service trust.
- Auditors & certifiers.
- Build with OMATrust.

This plan describes implementation phases, routing changes, component changes, and suggested technical details. The product behavior is defined in `spec.md`.

## 2. Guiding Implementation Decisions

1. Do not delete existing form routes initially. Demote them from primary navigation and reuse them behind workflow cards.
2. Dashboard sections should be activated by user context, not permanently visible tabs.
3. CTA clicks may pass dashboard context through URL query parameters.
4. Relevant attestation history should eventually activate persistent modules even if the user did not enter through the CTA.
5. Keep this refactor UI-first. Do not block on backend role systems.
6. The developer/integrator CTA is a read path that routes to external docs, not to the dashboard.
7. Trust search is deferred to a future feature (see `docs/features/search/plan.md`). Do not build the search bar in this phase.

## 3. Proposed Routes

### 3.1 Public Routes

```txt
/                           -> New landing page
/activity                   -> Full activity feed
/dashboard                  -> Default signed-in dashboard
/dashboard?context=review   -> Dashboard opened in review context
/dashboard?context=service-management -> Dashboard opened in service-management context
/dashboard?context=issuer   -> Dashboard opened in issuer context
/publish                    -> Publish page (all forms, or filtered by category)
/publish?category=review    -> Publish page filtered to User Review
/publish?category=issuer    -> Publish page filtered to Security Assessment, Certification
/publish?category=trust     -> Publish page filtered to Key Binding, Linked Identifier, Controller Witness
/publish/user-review        -> Existing user review form route (direct deep link)
/publish/key-binding        -> Existing key binding form route (direct deep link)
/publish/controller-witness -> Existing controller witness route (direct deep link)
/publish/security-assessment -> Existing assessment route (direct deep link)
/publish/certification      -> Existing certification route (direct deep link)
```

Note: There is no `/dashboard?context=developer` route. The developer/integrator CTA links to external documentation.

Note: `/search` is a future route defined in `docs/features/search/plan.md`.

### 3.2 Optional Landing Routes

```txt
/service-trust            -> Optional dedicated service operator landing page
/issuers                  -> Optional dedicated professional issuer landing page
/x402                     -> Existing or future x402 funnel page
```

These optional pages can be added after the homepage/dashboard refactor.

## 4. Phase 1 — Replace Publish-Centric Homepage

### 4.1 Create New Landing Page Layout

Replace or refactor the current Activity/Home page layout into:

1. Four workflow CTA cards.
2. Latest Trust Profiles section.
3. Latest activity preview.

Suggested components:

```txt
components/home/WorkflowCards.tsx
components/home/WorkflowCard.tsx
components/home/LatestTrustProfiles.tsx
components/home/TrustProfileEntry.tsx
components/home/RecentActivityPreview.tsx
```

### 4.2 Workflow Card Configuration

Create a config array instead of hardcoding card markup.

Example:

```ts
export const HOME_WORKFLOWS = [
  {
    id: 'review',
    title: 'Review an app or service',
    description: 'Submit a public review with verifiable trust data for a service you used.',
    ctaLabel: 'Start review',
    href: '/publish/user-review',
  },
  {
    id: 'service',
    title: 'Manage your service trust',
    description: 'Verify your service, authorize signing keys, and manage review responses.',
    ctaLabel: 'Open service workspace',
    href: '/dashboard?context=service-management',
    requiresAuth: true,
  },
  {
    id: 'issuer',
    title: 'Auditors & certifiers',
    description: 'Publish assessments, issue certifications, and build trust as a professional issuer.',
    ctaLabel: 'Open issuer workspace',
    href: '/dashboard?context=issuer',
    requiresAuth: true,
  },
  {
    id: 'developer',
    title: 'Build with OMATrust',
    description:
      'Query reviews, key bindings, controller witnesses, and trust records for your app, agent, wallet, marketplace, or discovery tool.',
    ctaLabel: 'View API Docs',
    href: 'https://docs.omatrust.org', // exact path TBD
    secondaryCta: {
      label: 'Compare API Plans',
      href: 'https://docs.omatrust.org', // exact path TBD
    },
    external: true,
  },
] as const;
```

The `external` flag indicates the link navigates to an external site and should open accordingly (e.g., `target="_blank"` or same-tab navigation depending on design preference).

If the app requires sign-in before dashboard access, preserve the intended destination in a redirect parameter.

Example:

```txt
/dashboard?context=issuer
```

or:

```txt
/signin?next=/dashboard?context=issuer
```

### 4.3 Workflow Card Type

Update the card type to support external links and optional secondary CTAs:

```ts
type WorkflowCard = {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  requiresAuth?: boolean;
  external?: boolean;
  secondaryCta?: {
    label: string;
    href: string;
  };
};
```

### 4.4 Latest Trust Profiles Section

#### 4.4.1 Component

Create a component to display organizations that have established trust:

```txt
components/home/LatestTrustProfiles.tsx
components/home/TrustProfileEntry.tsx
```

#### 4.4.2 Data Shape

Each trust profile entry needs the following data:

```ts
type TrustProfileEntry = {
  id: string;
  name: string;
  domain?: string;
  did?: string;
  indicators: {
    hasSigningKey: boolean;
    hasKeyOwnershipProof: boolean;
    hasOwnershipProofAnchored: boolean;
  };
};
```

The three trust indicators map to:

- `hasSigningKey` — the organization has published a key binding attestation.
- `hasKeyOwnershipProof` — the organization has proved key ownership via DNS TXT record or DID document (`did.json`).
- `hasOwnershipProofAnchored` — the organization has published a controller witness, key binding, or linked identifier attestation anchoring the ownership proof on OMATrust.

#### 4.4.3 Rendering

Each entry should display:

- Organization name and/or domain.
- Three checkbox-style indicators showing the trust posture.

The visual format is TBD, but the component should be structured to support checkbox/icon indicators. Example conceptual layout:

```txt
┌─────────────────────────────────────────────────┐
│ Example Corp (example.com)                      │
│ ✓ Signing key  ✓ Key ownership  ○ Anchored      │
│                                   on OMATrust   │
└─────────────────────────────────────────────────┘
```

#### 4.4.4 Data Source

Query the attestation index for organizations that have at least one of:

- A key binding attestation.
- A key ownership proof (DNS TXT or DID document verification).
- An ownership proof anchored on OMATrust (controller witness, key binding, or linked identifier attestation).

Suggested query approach:

```ts
const trustProfiles = await fetchLatestTrustProfiles({ limit: 5 });
```

If the backend endpoint is not ready, use mock data initially.

#### 4.4.5 Section Layout

```tsx
<LatestTrustProfiles limit={5} />
```

Entries do not link anywhere in this version. In the future, each entry should link to the search page result for the organization (when search is completed).

### 4.5 Recent Activity Preview

Reuse existing activity feed component if available.

Create a limited preview mode:

```tsx
<RecentActivityPreview limit={8} showViewAllLink />
```

The full feed should live at `/activity`.

## 5. Phase 2 — Publish Page Category Routing

### 5.1 Category Parameter

Update the `/publish` page to read a `category` query parameter and filter visible forms accordingly.

```ts
type PublishCategory = 'review' | 'issuer' | 'trust';

function getPublishCategory(searchParams: URLSearchParams): PublishCategory | null {
  const category = searchParams.get('category');
  if (category === 'review' || category === 'issuer' || category === 'trust') return category;
  return null; // show all forms
}
```

### 5.2 Category Configuration

```ts
export const PUBLISH_CATEGORIES = {
  review: {
    label: 'User Review',
    forms: ['user-review'],
  },
  issuer: {
    label: 'Audit / Certification',
    forms: ['security-assessment', 'certification'],
  },
  trust: {
    label: 'Trust Management',
    forms: ['key-binding', 'linked-identifier', 'controller-witness'],
  },
} as const;
```

### 5.3 No Category Fallback

When no `category` parameter is provided, `/publish` shows all available attestation forms. This serves as the advanced/complete view for power users and deep links.

### 5.4 Remove Publish from Primary Navigation

Replace primary nav item:

```txt
Publish
```

with either:

- no nav item, or
- Advanced Tools in a secondary/account/docs menu.

The direct route `/publish` should remain functional.

### 5.5 Remove Endorsement Route from Visible UI

Since Endorsement has been removed from the schema set, remove visible links/cards to:

```txt
/publish/endorsement
```

If the route still exists temporarily, it should not appear in primary UI.

## 6. Phase 3 — Dashboard Modes and Activated Sections

### 6.1 Dashboard Context Parsing

Read the `context` query parameter.

Example:

```ts
type DashboardContext = 'default' | 'review' | 'service-management' | 'issuer';

function getDashboardContext(searchParams: URLSearchParams): DashboardContext {
  const context = searchParams.get('context');
  if (context === 'review' || context === 'service-management' || context === 'issuer') return context;
  return 'default';
}
```

Note: There is no `developer` dashboard context. The developer CTA routes to external docs.

### 6.2 Dashboard Publish Button

Add a Publish button to the top-right area of the dashboard page.

#### 6.2.1 Component

```txt
components/dashboard/PublishButton.tsx
```

#### 6.2.2 Menu Configuration

```ts
export const PUBLISH_MENU_ITEMS = [
  {
    id: 'review',
    label: 'User Review',
    href: '/publish?category=review',
  },
  {
    id: 'issuer',
    label: 'Audit / Certification',
    href: '/publish?category=issuer',
  },
  {
    id: 'trust',
    label: 'Trust Management',
    href: '/publish?category=trust',
  },
] as const;
```

#### 6.2.3 Behavior

- Render a button labeled "Publish" (or with a publish icon) in the top-right of the `DashboardShell`.
- On click, open a dropdown/popover showing the three grouped options.
- Each option navigates to `/publish` with the appropriate `category` parameter.
- The button is always visible regardless of dashboard context.

#### 6.2.4 Placement

Add the button to the dashboard shell header:

```tsx
<DashboardShell>
  <header>
    <h1>Dashboard</h1>
    <PublishButton />
  </header>
  {/* dashboard sections */}
</DashboardShell>
```

### 6.3 Dashboard Section Model

Create a section model that distinguishes:

- always-visible sections
- context-visible sections
- record-activated sections

Example:

```ts
type DashboardSectionId = 'overview' | 'reviews' | 'services' | 'issuerTools';

type DashboardSectionContext = {
  context: DashboardContext;
  hasReviews: boolean;
  hasServiceRecords: boolean;
  hasIssuerRecords: boolean;
};

function getVisibleSections(ctx: DashboardSectionContext): DashboardSectionId[] {
  const sections: DashboardSectionId[] = ['overview'];

  if (ctx.context === 'review' || ctx.hasReviews) sections.push('reviews');
  if (ctx.context === 'service-management' || ctx.context === 'issuer' || ctx.hasServiceRecords) sections.push('services');
  if (ctx.context === 'issuer' || ctx.hasIssuerRecords) sections.push('issuerTools');

  return sections;
}
```

Note: The Service Management section is visible in both `service-management` and `issuer` contexts, because issuers also need key management and identity verification.

### 6.4 Initial Data Sources

For the first implementation, determine dashboard context from available indexed attestations.

Possible checks:

```ts
hasReviews = attestations.some(a => a.schemaType === 'user-review');
hasServiceRecords = attestations.some(a => ['key-binding', 'controller-witness', 'linked-identifier'].includes(a.schemaType));
hasIssuerRecords = attestations.some(a => ['security-assessment', 'certification'].includes(a.schemaType));
```

If schema type is not available, use schema UID / schema slug mapping.

### 6.5 Dashboard Components

Suggested structure:

```txt
components/dashboard/DashboardShell.tsx
components/dashboard/DashboardOverview.tsx
components/dashboard/PublishButton.tsx
components/dashboard/ReviewsSection.tsx
components/dashboard/ServiceManagementSection.tsx
components/dashboard/IssuerToolsSection.tsx
components/dashboard/SetupCard.tsx
```

### 6.6 Service Management Section

The Service Management section uses per-key cards rather than per-action cards. Each authorized key gets its own card showing verification progress.

#### 6.6.1 Per-Key Card Model

```ts
type KeyVerificationLevel = 'none' | 'basic' | 'intermediate' | 'advanced';

type KeyCard = {
  id: string;
  keyAddress: string;
  label: string; // e.g., "Sign-in wallet", "x402 signing key"
  verificationLevel: KeyVerificationLevel;
  isDefault: boolean; // true for the wallet used to sign in
};
```

Verification levels per key:

- **Basic** — key ownership proved via DNS TXT record or DID document (`did.json`). Already completed for the default sign-in wallet, but likely a separate key for x402 services.
- **Intermediate** — controller witness published. Explain the value: maintains verification of proofs if the developer's DNS or JSON check gets removed.
- **Advanced** — key binding attestation published on-chain.

#### 6.6.2 Section Content

The section should include:

- Per-key verification cards (first card is the sign-in wallet).
- Linked identifiers — each linked ID attestation and which identities it links.
- Review responses — lists unresponded-to reviews and responded-to reviews in separate subsections. Clicking any review opens the user review response form with fields pre-filled.

#### 6.6.3 Suggested Components

```txt
components/dashboard/ServiceManagementSection.tsx
components/dashboard/KeyVerificationCard.tsx
components/dashboard/LinkedIdentitiesList.tsx
components/dashboard/ReviewResponsesList.tsx
```

### 6.7 Issuer Tools Section

The Issuer Tools section shows the user's professional issuer attestations and provides the approved-issuer request flow.

#### 6.7.1 Section Content

The section should include:

- **My certifications** — list of certification attestations issued by the user.
- **My security audits** — list of security assessment attestations issued by the user.
- **Request approved issuer status** — shown if the user's wallet is not found in the approved-issuer JSON file (accessible via API). The button opens a form to email authorizations@oma3.org.

#### 6.7.2 Approved Issuer Request Flow

```ts
type ApprovedIssuerRequest = {
  walletAddresses: string[];
  schemas: ('security-assessment' | 'certification')[];
  email: string;
};
```

Messaging: "Make your wallets an OMA3-authorized issuer to increase trust in your attestations."

The form should ask for:
- Which wallet addresses to authorize.
- Which attestation schemas (security audit, certification, or both).
- Contact email address.

On submit, send the request to authorizations@oma3.org.

#### 6.7.3 Approved Issuer Check

```ts
async function isApprovedIssuer(walletAddress: string): Promise<boolean> {
  const approvedIssuers = await fetch('/api/approved-issuers').then(r => r.json());
  return approvedIssuers.includes(walletAddress);
}
```

If the wallet is in the approved-issuer list, hide the request button.

#### 6.7.4 Suggested Components

```txt
components/dashboard/IssuerToolsSection.tsx
components/dashboard/MyCertificationsList.tsx
components/dashboard/MySecurityAuditsList.tsx
components/dashboard/ApprovedIssuerRequest.tsx
```

The Issuer Tools section must not appear as an empty permanent section for ordinary users.

## 7. Phase 4 — User Review Flow Adjustments

### 7.1 CTA Routing

The primary Review CTA should route directly to:

```txt
/publish/user-review
```

If the user enters from a service profile, include query params:

```txt
/publish/user-review?subject=did:web:example.com
```

### 7.2 Post-Submit Redirect

After successful submission, redirect to:

```txt
/dashboard?context=review
```

or, if attestation UID is available:

```txt
/dashboard?context=review&highlight=<uid>
```

### 7.3 Dashboard Highlight

If `highlight` is present, the Reviews section should highlight the newly submitted attestation.

## 8. Phase 5 — Activity Page Split

### 8.1 Full Activity Page

Move the current full latest-attestations feed to `/activity`.

The page should include:

- full feed
- pagination or infinite scroll
- resolve wallet addresses and DIDs to human-readable text where possible (e.g., base domain or display name of the associated account — may require a new public API)

### 8.2 Landing Page Preview

The landing page should use a preview component with a small limit.

Do not duplicate full feed logic if the existing component can accept a limit prop.

## 9. Phase 6 — Optional Dedicated Landing Pages

These pages are optional after the core refactor.

### 9.1 Service Trust Landing Page

Route:

```txt
/service-trust
```

Purpose:

- explain key binding, controller witness, and service trust profile in plain language
- CTA to `/dashboard?context=service-management`

### 9.2 Issuer Landing Page

Route:

```txt
/issuers
```

Purpose:

- explain professional issuer workflows
- distinguish permissionless publishing from approved issuer status
- CTA to `/dashboard?context=issuer`

### 9.3 x402 Landing Pages

Keep x402-related landing pages as secondary funnel pages for external referrals.

They should deep-link into:

```txt
/dashboard?context=service-management
/publish/key-binding
/publish/user-review
```

as appropriate.

## 10. Phase 7 — Developer / Integrator CTA and Docs Link

### 10.1 Fourth CTA Card

Add the developer/integrator card to the `HOME_WORKFLOWS` config array (see Phase 1, section 4.2).

Implementation tasks:

1. Add the `developer` entry to `HOME_WORKFLOWS`.
2. Update `WorkflowCard` component to handle `external: true` links (e.g., render an `<a>` with `href` instead of a Next.js `<Link>`, or use `target="_blank"` depending on design preference).
3. Update `WorkflowCard` component to render an optional `secondaryCta` button/link below the primary CTA.
4. Ensure the card grid layout accommodates four cards responsively (e.g., 2×2 on medium screens, 4×1 on large, stacked on mobile).

### 10.2 Copy Constants

Add copy constants for the developer card:

```ts
export const DEVELOPER_CTA = {
  title: 'Build with OMATrust',
  description:
    'Query reviews, key bindings, controller witnesses, and trust records for your app, agent, wallet, marketplace, or discovery tool.',
  ctaLabel: 'View API Docs',
  secondaryCtaLabel: 'Compare API Plans',
} as const;
```

### 10.3 Route / URL Constants

Add the external docs URL to a shared constants file:

```ts
export const EXTERNAL_URLS = {
  docs: 'https://docs.omatrust.org', // exact path TBD
  docsApi: 'https://docs.omatrust.org', // exact path TBD — API reference
  docsApiPlans: 'https://docs.omatrust.org', // exact path TBD — pricing/plans
} as const;
```

Update these values once the exact docs paths are finalized.

### 10.4 Navigation Updates

If the top navigation includes a "Docs" link, ensure it points to `https://docs.omatrust.org`. The developer CTA and the nav Docs link may share the same base URL.

## 11. Testing Plan

### 11.1 Landing Page Tests

Test that:

- Four CTA cards render.
- Review CTA links to user review form.
- Service CTA links to `/dashboard?context=service-management`.
- Issuer CTA links to `/dashboard?context=issuer`.
- Developer CTA links to `https://docs.omatrust.org` (exact path TBD).
- Developer CTA does not link to `/dashboard`.
- Latest Trust Profiles section renders below the CTA cards with 5 entries.
- Latest activity preview renders below the Latest Trust Profiles section.
- Publish tile catalog is not shown as the main landing experience.
- No search bar is rendered on the landing page (search is a future feature).

### 11.2 Latest Trust Profiles Tests

Test that:

- The section renders with a heading.
- Each entry displays the organization name or domain.
- Each entry displays three trust indicators (signing key, key ownership, ownership proof anchored).
- Indicators correctly reflect the data (checked vs unchecked).
- Entries do not link anywhere.
- The section is visually distinct from the Latest Activity tiles.
- The section handles empty state gracefully (no organizations with trust profiles yet).

### 11.3 Developer CTA Tests

Test that:

- Developer CTA card renders with correct title, description, and CTA labels.
- Primary CTA ("View API Docs") links to the configured external docs URL.
- Secondary CTA ("Compare API Plans") links to the configured external plans URL.
- The link is marked as external (e.g., `target="_blank"` or `rel="noopener"`).
- Clicking the developer CTA does not navigate to `/dashboard` or any dashboard context.
- The developer CTA does not require authentication.

### 11.4 Dashboard Publish Button Tests

Test that:

- The Publish button renders in the top-right of the dashboard.
- Clicking the Publish button opens a menu with three options.
- "User Review" option links to `/publish?category=review`.
- "Audit / Certification" option links to `/publish?category=issuer`.
- "Trust Management" option links to `/publish?category=trust`.
- The Publish button is visible in all dashboard contexts (default, review, service-management, issuer).

### 11.5 Publish Page Category Tests

Test that:

- `/publish?category=review` shows only the User Review form.
- `/publish?category=issuer` shows Security Assessment and Certification forms.
- `/publish?category=trust` shows Key Binding, Linked Identifier, and Controller Witness forms.
- `/publish` with no category shows all available attestation forms.
- Invalid category values fall back to showing all forms.

### 11.6 Dashboard Context Tests

Test that:

- `/dashboard` shows default dashboard only.
- `/dashboard?context=service-management` shows Service Management section.
- `/dashboard?context=issuer` shows Issuer Tools section and Service Management section.
- `/dashboard?context=review` shows Reviews section.
- Ordinary users do not see Issuer Tools by default.
- No `developer` dashboard context exists; `/dashboard?context=developer` falls back to default.

### 11.7 Activation Tests

With mocked attestation history:

- A user with user-review attestations sees Reviews section.
- A user with key-binding/controller-witness/linked-identifier records sees Service Management section.
- A user with security-assessment/certification records sees Issuer Tools section.

### 11.8 Post-Submit Tests

Test that successful User Review submission redirects to `/dashboard?context=review`.

### 11.9 Navigation Tests

Test that:

- Primary nav no longer emphasizes Publish.
- Activity nav opens full activity feed.
- Dashboard nav opens signed-in workspace.

### 11.10 Responsive Layout Tests

Test that:

- Four CTA cards display correctly on mobile (stacked).
- Four CTA cards display correctly on tablet (2×2 grid).
- Four CTA cards display correctly on desktop (4-column or 2×2 grid).
- Latest Trust Profiles section is responsive.

## 12. Rollout Plan

### 12.1 Feature Flag

Introduce a feature flag:

```ts
NEXT_PUBLIC_REPUTATION_UI_REDESIGN=true
```

When disabled, preserve the current UI.

### 12.2 Rollout Stages

1. Build new landing page behind flag.
2. Build dashboard contexts behind flag.
3. Move publish page to advanced route/copy.
4. Enable flag on preview environment.
5. QA user flows.
6. Enable in production.
7. Remove old publish-first navigation.

## 13. Risks and Mitigations

### 13.1 Risk: Users Cannot Find Raw Forms

Mitigation:

- Keep `/publish` as Advanced Publishing.
- Link from Docs.
- Add advanced link in dashboard footer or settings.

### 13.2 Risk: Dashboard Feels Empty

Mitigation:

- Use context-specific empty-state cards.
- Default section remains useful for all users.

### 13.3 Risk: Issuer Workflow Looks Permissioned

Mitigation:

- Copy must state that publishing can be permissionless where supported.
- Approved issuer status is an optional trust signal, not a requirement.

### 13.4 Risk: External Docs URL Not Finalized

Mitigation:

- Use a shared `EXTERNAL_URLS` constant so the URL can be updated in one place.
- Mark the exact path as TBD in config and comments until finalized.
- The CTA card and tests should reference the constant, not a hardcoded string.

### 13.5 Risk: Trust Profile Data Not Available

Mitigation:

- Build the Latest Trust Profiles component with mock data support.
- Handle empty state gracefully if no organizations have trust profiles yet.
- Do not block the landing page on trust profile indexing.
