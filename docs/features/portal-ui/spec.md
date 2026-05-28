# Reputation Frontend UI Redesign — spec.md

## 1. Purpose

This specification defines the expected behavior of the redesigned OMATrust reputation frontend. The redesign replaces the current schema/catalog-oriented publishing experience with a task-oriented interface based on user intent.

The frontend must guide users into the correct workflow without requiring them to understand attestation schema names such as Key Binding, Controller Witness, Certification, or User Review Response.

This document describes how the software should behave and is intended to support product review, QA planning, and test-case development.

## 2. Scope

### 2.1 In Scope

This specification covers:

- The redesigned public landing/home page.
- The replacement of the current general-purpose Publish tile page as the primary entrypoint.
- Four primary user-intent CTAs:
  - Review an app or service.
  - Confirm service controllers.
  - Auditors & certifiers.
  - Build with OMATrust.
- Latest Trust Profiles section on the landing page.
- Dashboard behavior after users enter one of the workflows.
- Contextual dashboard modes for reviewers, service operators, and professional issuers.
- Empty-state dashboard cards that guide users to the next relevant action.
- Rules for when dashboard sections appear.
- Treatment of recent activity / latest attestations.
- Demotion of raw attestation publishing forms to advanced/deep-link use.
- Developer/integrator landing page for reading and using OMATrust trust data.
- Dashboard Publish button with grouped category navigation.
- Publish page category filtering.

### 2.2 Out of Scope

This specification does not define:

- Smart contract behavior.
- Attestation schema changes.
- Relayer subsidy policy.
- Final copywriting for marketing pages.
- Final visual design system.
- Backend indexing logic.
- Authentication provider implementation details.
- Full issuer approval workflow.
- API/RPC pricing or subscription management.
- Trust search (see `docs/features/search/spec.md`).

## 3. Product Principles

### 3.1 User Intent Over Schema Type

The UI must route users by what they want to do, not by the underlying attestation schema.

Users should not need to know whether an action uses a Key Binding, Controller Witness, Linked Identifier, Certification, Security Assessment, or User Review Response attestation.

### 3.2 Contextual Workspaces Over Static Role Tabs

The dashboard must not show permanent empty tabs for roles that do not apply to the user.

Instead, dashboard modules should appear when:

- The user has created a relevant attestation.
- The user controls a service or DID related to a relevant attestation.
- The user enters a workflow from a dedicated CTA or landing page.
- The user has been approved or recognized as an issuer.

### 3.3 First Action Creates Future Context

The first workflow a user enters should determine the initial dashboard mode. After the user completes an action, the dashboard should show relevant follow-up actions.

Example: after submitting a first user review, the user should see review-related dashboard content.

### 3.4 Permissionless First, Approval Later

Professional issuer workflows must remain permissionless where the protocol allows it. A user may publish a security assessment or certification without being OMA3-approved, subject to the applicable attestation rules.

However, the UI may offer an optional "Become an approved issuer" path explaining that approval can improve verifier trust, ranking, or display treatment.

### 3.5 OMATrust as a Trust Data Layer

OMATrust is not only a place to publish attestations; it is also a trust data layer. Developers, AI agents, wallets, marketplaces, launchers, app stores, and discovery tools may want to read trust data without publishing or managing attestations themselves. The UI must provide a clear path for this integrator audience.

## 4. Public Landing Page

## 4.1 Landing Page Purpose

The public landing page is a workflow router that helps users choose the right path.

It should answer four user questions:

1. "How do I review a service?"
2. "How do I manage or publish trust records?"
3. "How do I read or integrate OMATrust trust data?"
4. "Which organizations have established trust on OMATrust?"

Note: A trust search bar will be added to the landing page in a future iteration. See `docs/features/search/spec.md`.

## 4.2 Required Page Sections

The public landing page must include the following major sections, in this order unless design constraints require otherwise:

1. Four workflow CTA cards.
2. Latest Trust Profiles.
3. Latest activity preview.

## 4.3 Primary CTA Cards

The landing page must show exactly four primary workflow cards at the top of the page.  These can use the existing cards except add a second row.

### 4.3.1 Review an App or Service

This CTA is for ordinary users who want to review something they used.

Behavior:

- Clicking the CTA opens the User Review form.
- If the user is not signed in, the flow will prompt for sign-in before final submission.
- After successful submission, the user is routed to the dashboard in review context.

The CTA must not expose raw schema terminology such as "User Review attestation" unless used in advanced/help text.

### 4.3.2 Manage Your Trust

This CTA is for service operators, developers, and x402 service providers that want to manage trust records for a service.

Behavior:

- Clicking the CTA routes to the dashboard in service-management context.
- The dashboard should display service-management empty-state cards if the user has not yet configured a service.
- The first screen must not send the user directly to a raw Key Binding form.

Primary service-management actions include:

- Verify or claim a service identity 
  - enter in the service DID
  - verify
  - add the key as an authorized key in the "Key Authorizations" section
- Key Authorizations (key+subject pairs).
  - Each card represents a unique key+subject pair.
  - The card shows the subject DID, key DID, sources, and verification levels.
  - Verification levels per pair:
    - basic verification: DNS or json check (Already completed for the default key that was used to sign in to the account but perhaps, and most likely with x402, it's a separate sign-in key).
    - intermediate verification: trigger a controller witness (describe the value of a controller witness, Mainly that it maintains the verification of proofs if the developer's DNS or JSON check gets removed for some reason).
    - advanced verification: key binding attestation
  - "Add to account" button on cards where the subject is not yet registered in the user's account.
- Link related identities.  Each linked ID attestation and which identities it links.
- Manage reviews and responses (lists unresponded to review and responded to reviews in different subsections, and clicking on any review opens the user review response form with everything filled out).

### 4.3.3 Auditors & Certifiers

This CTA is for security firms, auditors, certification bodies, test labs, and other professional issuers.

Behavior:

- Clicking the CTA routes to the dashboard in issuer context (eventually it will route to a dedicated issuer landing page that then routes to dashboard issuer context).  
- The first screen should not open the Certification form directly.
- The issuer workspace should provide setup and publishing cards.

Primary issuer actions include:

- Create or verify issuer profile.
- Authorize issuer signing key.
- Publish a security assessment.
- Issue a certification.
- Apply to become an approved issuer.

The UI must not show professional issuer modules to all users by default.

### 4.3.4 Build with OMATrust

This CTA is for developers, AI agents, wallets, marketplaces, launchers, app stores, and discovery tools that want to verify services by reading and using OMATrust trust data.

Card subtitle:

> Query reviews, key bindings, controller witnesses, and trust records for your app, agent, wallet, marketplace, or discovery tool.

Primary CTA label: "View API Docs"

Secondary CTA label: "Compare API Plans" or "Premium API Access"

Behavior:

- Clicking the primary CTA opens the OMATrust developer documentation at `https://docs.omatrust.org` (exact path TBD).
- This CTA does not route to `/dashboard`. The developer/integrator cohort is a read/integrate path, not a publish/manage path.
- Sign-in is not required to view the documentation.
- The destination page should explain how to read OMATrust trust data and link to API documentation.
- The page should include examples for querying:
  - User reviews.
  - Key bindings.
  - Controller witnesses.
  - Linked identifiers.
  - Security assessments.
  - Certifications.
  - Service trust summaries.
- The page should mention that premium API/RPC access may be available for higher rate limits, lower latency, indexed queries, historical data, webhooks/event streams, or commercial support.
- Premium API/RPC subscription should be presented as an optional upgrade, not the primary call to action.

The UI must not create an empty dashboard tab for developers/integrators.  docs.omatrust.org is in the developer-docs repository.

## 4.4 Latest Trust Profiles

The landing page must include a "Latest Trust Profiles" section below the CTA cards and above the latest activity preview.

### 4.4.1 Purpose

This section highlights organizations that have actively established controller confirmations and trust credentials on OMATrust. It gives visitors a quick view of which organizations are building verifiable trust and how far along they are.

### 4.4.2 Content

Each entry in the Latest Trust Profiles section represents an organization or service that has published service-trust attestations. The exact visual format is TBD, but each entry must communicate the following trust indicators as a set of checkboxes or equivalent status markers:

- **Signing key specified** — whether the organization has published a key binding attestation specifying a signing key.
- **Key ownership proved** — whether the organization has proved ownership of the signing key via DNS TXT record or DID document (`did.json`).
- **Ownership proof anchored on OMATrust** — whether the organization has published a controller witness, key binding, or linked identifier attestation for the keys.

### 4.4.3 Behavior

- The section should display the latest 5 (can be modified in the future) trust profiles.
- Each entry does not link anywhere.  In the future it should link to the search page (when it is completed) result of the organization.
- The section is read-only and public. No sign-in is required to view it.

### 4.4.4 Distinction from Latest Activity

The Latest Trust Profiles section is distinct from the Latest Activity section:

- **Latest Trust Profiles** shows organizations and their trust posture as a set of status indicators (checkboxes). It is organization-centric.
- **Latest Activity** shows individual attestation events as a chronological feed of tiles. It is event-centric.

The two sections serve different purposes and should have visually distinct presentations.

## 4.5 Latest Activity Preview

The landing page should retain a latest activity preview below the Latest Trust Profiles section.

The preview should show a limited number of latest attestations and provide a link to a full Activity page.

The preview should be secondary. It must not be the main navigation mechanism for first-time users.

## 5. Activity Page

## 5.1 Purpose

The Activity page must become a dedicated page for browsing public network activity.

## 5.2 Required Capabilities

The Activity page should include:

- Latest attestations feed.
- Links to attestation detail pages.
- Links to related service profile pages.
- resolve wallet addresses and DIDs to human readable text where possible (e.g.- base domain or display name of the associated account.  We may need to implement another public API)

## 5.3 Relationship to Landing Page

The landing page shows a latest activity preview. The full feed belongs on the Activity page.

## 6. Dashboard

## 6.1 Dashboard Purpose

The dashboard is the signed-in workspace for ongoing trust activity.

It should not be a generic list of every possible attestation form. It should show modules based on user context and relevant records.

The dashboard is for users who publish or manage attestations. It is not the destination for the developer/integrator cohort.

## 6.2 Dashboard Publish Button

The dashboard must include a Publish button in the top-right area of the dashboard page. This button provides quick access to all attestation publishing forms without requiring the user to navigate away from the dashboard.

### 6.2.1 Behavior

Clicking the Publish button opens a dropdown or popover menu showing three grouped options:

- **User Review** — routes to `/publish?category=review`.
- **Audit / Certification** — routes to `/publish?category=issuer`.
- **Trust Management** — routes to `/publish?category=trust`.

The Publish button is always visible on the dashboard regardless of the current dashboard context. It does not change based on context or user records.

### 6.2.2 Relationship to /publish Page

Each menu option routes to the `/publish` page with a `category` query parameter. The `/publish` page filters the visible attestation forms based on the category. See section 8 for `/publish` page category behavior.

## 6.3 Dashboard Section Matrix

Dashboard sections are controlled by the current dashboard context and by the user's existing records.

The table below defines which sections are shown because of the current context parameter. On the no-context dashboard, additional sections may appear when the user has relevant records, as described in section 6.4. A section should not appear in another explicit context unless that context includes it in the table.

| Section                      | No context | `review` | `service-management` | `issuer` |
| ---------------------------- | ---------- | -------- | -------------------- | -------- |
| Account                      | X          | X        | X                    | X        |
| My Attestations              | X          | X        | X                    | X        |
| Reviews                      |            | X        |                      |          |
| Service Controller Workspace |            |          | X                    | X        |
| Issuer Tools                 |            |          |                      | X        |

There is no `developer` dashboard context. The developer/integrator cohort is served by external documentation, not the dashboard.

## 6.4 Dashboard Sections

### 6.4.1 Account

Every signed-in user should see the Account section.

This is the default section of the dashboard. It gives users confidence that they are signed in as the expected account and provides a path to account management.

The section should include:

- Account summary with a link to the account page.
  - Display name.
  - Service identities (all discovered service DIDs), if any exist.

Connected wallets and service keys belong in the Service Controller Workspace, not in the Account section.

Subject management (adding subjects to account) is handled in the Service Controller Workspace via the "Add to account" button on key authorization cards. The Account page is read-only for subjects — it does not display or manage them.

### 6.4.2 My Attestations

Every signed-in user should see the My Attestations section.

This section should include attestations published by the signed-in account or connected wallet, ordered latest to earliest, with clear user-facing schema titles.

The section may include an empty state. Empty-state copy should be generally relevant and should not imply that every user needs to become an issuer, manage a service, or write a review.

### 6.4.3 Reviews Section

Show this section when:

- The user has submitted a review.
- The dashboard is in review context.

The section should include:

- Reviews written by the user.
- Review another service CTA.
- Links to attestation detail pages.

User-review authoring belongs in this section and should not be part of the Service Controller Workspace.

### 6.4.4 Service Controller Workspace

Show this section when:

- The dashboard is in service-management or issuer context.
- The dashboard has no context, and the user has created or controls a Key Binding, Controller Witness, Linked Identifier, or similar service-control attestation.
- The dashboard has no context, and the user has submitted a Security Assessment or Certification attestation.
- The dashboard has no context, and the user controls a service that has received reviews.

This section should help users confirm and manage service controllers for a service they operate. It should not be a generic account profile page, and it should not prioritize ordinary user-review authoring.

The section should include:

- Key Authorizations (key+subject pairs).
  - Each card represents a unique key+subject pair, not a deduplicated key.
  - The subject DID is shown on each card (e.g. "did:web:lumian.org").
  - The key DID is shown on each card (e.g. "did:pkh:eip155:66238:0x...").
  - Sources are listed (Account wallet, DNS TXT, DID document, Key binding, Controller witness).
  - Verification levels are shown for each pair:
    - Basic verification: DNS TXT or DID document proof.
    - Intermediate verification: controller witness.
    - Advanced verification: key binding attestation.
  - All service DIDs are shown flat — there is no single-subject selector/dropdown. The workspace loads controller summaries and attestations for ALL discovered service DIDs simultaneously.
  - Service DIDs are discovered from: the user's registered subjects (primarySubject), and subjects appearing in key-binding, controller-witness, linked-identifier, security-assessment, and certification attestations.
  - The user's wallet DID is filtered out via `isRealSubjectDid()` — only real service subjects are shown.
  - "Add to account" button: if a subject appears in key-binding attestations but is NOT in the user's registered account subjects, an "Add to account" button is shown on that card. Clicking it opens the SubjectConfirmationDialog pre-filled with that subject DID. On success, the subjects list refreshes and the button disappears.
  - The dashboard is the primary place to manage subjects. The Account page no longer has a subject add flow.
  - For domain service identities, use the OMATrust service-controller summary API to inspect DNS TXT, `did.json`, and `agent.json` metadata for authorized keys.
  - Smart contract proof discovery is out of scope for this version.
  - Allow users to authorize additional signing keys.
- Linked identities.
  - Show linked identifiers across all service DIDs.
  - If no linked identifiers exist, the section may remain empty.
  - Provide a "What is this?" link to the full Linked Identifiers documentation.
  - Provide a CTA to link another identity.
- Review management for services the user controls.
  - Label this area "Reviews of My Services".
  - Show reviews received by controlled services, not reviews written by the signed-in user.
  - Show attester, recipient, date, rating stars, review text, and response action.
  - Resolve attester and recipient labels through an identity resolution API where available.
  - Separate unresponded and responded reviews.
  - Allow opening a response form prefilled from the selected review.
- Security reviews and certifications.
  - Show Security Assessment and Certification attestations across all service DIDs.
  - Do not show this subsection if no service has Security Assessment or Certification attestations.
- Trusted attestations.
  - Show certifications, security assessments, and controller witnesses filed by approved issuers for the user's services.

In the Service Controller Workspace there should be a "Request" button only when:

- The dashboard is in issuer context, or the user has submitted Security Assessment or Certification attestations.
- The wallet does not show up as approved in the service-controller summary API response.

The button opens a form to send an email to `authorizations@oma3.org`. The messaging should be: "Make your wallets an OMA3-authorized issuer to increase trust in your attestations." The form should ask for:

- Which wallets should be authorized.
- Which attestation schemas the authorization is for: security audit, certification, or both.
- The user's email address.

### 6.4.5 Issuer Tools Section

Show this section when:

- The dashboard is in issuer context.
- The user has submitted a Security Assessment or Certification attestation.

The section should include cards for:

- My certifications.
- My security audits.

The Issuer Tools section must not appear as an empty permanent tab for ordinary users.

## 6.5 Dashboard Mode

Dashboard routes may accept a context parameter to display the relevant empty-state cards.

Example contexts:

- `review`
- `service-management`
- `issuer`

Mode affects the current dashboard presentation but does not permanently assign a user role.

There is no `developer` dashboard context. The developer/integrator cohort is served by external documentation, not the dashboard.

## 6.6 Empty-State Behavior

Empty-state dashboard cards must explain the action in user-facing terms, not schema terms.

Examples:

- "Authorize a signing key" may include help text such as "Let your service sign x402 receipts and other trust proofs."
- "Publish a controller witness" may include help text explaining stronger control evidence.
- "Issue a certification" must explain that this is intended for certification bodies or authorized issuers.

## 7. Individual Workflows

## 7.1 User Review Flow

The User Review flow is a single-action workflow.

Expected behavior:

1. User enters the flow from CTA, service page, widget, iframe, or dashboard.
2. User selects or confirms the service being reviewed.
3. User completes review fields.
4. User attaches or confirms required proof/evidence when applicable.
5. User submits attestation (and goes through sign in flow if necessary).
6. UI routes to dashboard review context or review detail page.

## 7.2 Service Controller Flow

The Service Controller flow is a multi-step workspace.

Expected behavior:

1. User enters from Manage Your Trust or from an external site that sets dashboard context.
2. Dashboard opens in service-management context.
3. UI shows service controller confirmation and setup cards.
4. User can complete one or more service-management tasks.
5. Completed tasks activate persistent service dashboard modules.

## 7.3 Professional Issuer Flow

The Professional Issuer flow is a multi-step workspace.

Expected behavior:

1. User enters from Auditors & Certifiers or from an external site that sets dashboard context.
2. Dashboard opens in issuer context.
3. UI shows issuer setup and publishing cards, as well as the Service Controller Workspace.
4. User may publish assessments/certifications permissionlessly.
5. UI offers Become an Approved Issuer as an optional trust upgrade if the service-controller summary API does not report the wallet as approved.
6. Completed issuer actions activate persistent issuer dashboard modules.

## 7.4 Developer / Integrator Flow

The developer/integrator flow is an external documentation path, not a dashboard workflow.

Expected behavior:

1. User clicks "Build with OMATrust" CTA on the homepage.
2. Browser navigates to `https://docs.omatrust.org` (exact path TBD).
3. The documentation page explains how to query OMATrust trust data.
4. The page provides examples for reading reviews, key bindings, controller witnesses, linked identifiers, and trust summaries.
5. The page links to free/public endpoint information where available.
6. The page presents premium API/RPC access as an optional upgrade for higher limits, lower latency, indexed queries, historical data, webhooks/event streams, or commercial support.
7. No sign-in is required to view the documentation.
8. The user is not routed to `/dashboard` at any point in this flow.

## 8. Publish Page

## 8.1 Publish Page Purpose

The `/publish` page is the centralized attestation publishing interface. It is no longer the primary user entrypoint — users reach it through the dashboard Publish button, workflow cards, or direct links.

The `/publish` page supports a `category` query parameter that filters which attestation forms are shown.

## 8.2 Category Behavior

### 8.2.1 User Review (`/publish?category=review`)

When `category=review`, the publish page shows:

- **User Review** form.

### 8.2.2 Audit / Certification (`/publish?category=issuer`)

When `category=issuer`, the publish page shows:

- **Security Assessment** form.
- **Certification** form.

### 8.2.3 Trust Management (`/publish?category=trust`)

When `category=trust`, the publish page shows:

- **Key Binding** form.
- **Linked Identifier** form.
- **Controller Witness** form.

### 8.2.4 No Category (`/publish`)

When no `category` parameter is provided, the publish page shows all available attestation forms. This serves as the advanced/complete view.

## 8.3 Removed or Hidden Tiles

The following should not appear as public homepage CTAs:

- Respond to a user review.
- Key Binding as raw schema action.
- Controller Witness as raw schema action.
- Linked Identifier as raw schema action.
- Certification as raw schema action.
- Security Assessment as raw schema action.

They are reachable through the dashboard Publish button and through workflow dashboard cards.

## 9. Navigation

The top navigation should prioritize user-facing concepts.

Recommended primary navigation:

- Activity.
- Dashboard.
- Docs.
- Account
- Sign In button (Account).

The existing Publish item should be removed from primary navigation.

## 10. Acceptance Criteria

### 10.1 Landing Page

- The landing page shows four workflow CTA cards at the top, a Latest Trust Profiles section, and a latest activity preview.
- The four CTA cards route to the correct workflow destinations.
- The page does not expose the old attestation tile catalog as the main experience.
- The page does not include a search bar in this version (search is a future feature).

### 10.2 User Review CTA

- Clicking Review an App or Service opens the User Review form.
- If the user is not signed in, the flow prompts for sign-in before final submission.
- Successful submission routes the user to the dashboard in review context or to the review detail page.

### 10.3 Service Controller CTA

- Clicking Manage Your Trust opens the dashboard in service-management context.
- The dashboard shows the Service Controller Workspace, not a raw schema form.
- The Service Controller Workspace displays per key+subject pair cards with verification levels (basic, intermediate, advanced).
- Each card shows the subject DID and key DID.
- Cards for subjects not registered in the user's account show an "Add to account" button.
- Clicking "Add to account" opens the SubjectConfirmationDialog pre-filled with that subject DID.
- There is no single-subject selector/dropdown — all key+subject pairs are shown flat.

### 10.4 Professional Issuer CTA

- Clicking Auditors & Certifiers opens the dashboard in issuer context.
- The dashboard shows the Issuer Tools section (My certifications, My security audits) and the Service Controller Workspace.
- Certification and security assessment tools are not shown as default dashboard sections to ordinary users.
- If the user's wallet is not in the approved-issuer JSON file, a "Request approved issuer" button is shown with a form to email authorizations@oma3.org.

### 10.5 Build with OMATrust CTA

- Clicking Build with OMATrust navigates to `https://docs.omatrust.org` (exact path TBD).
- The CTA does not open the dashboard.
- The destination page is accessible without sign-in.
- The destination page explains how to read OMATrust trust data and links to API documentation.
- Premium API/RPC access is presented as an optional upgrade, not the primary action.

### 10.6 Latest Trust Profiles

- The Latest Trust Profiles section renders below the CTA cards.
- The section displays the latest 5 trust profiles.
- Each entry displays trust indicators: signing key specified, key ownership proved, ownership proof anchored on OMATrust.
- Entries do not link anywhere in this version. Future: link to search results for the organization.
- The section is visually distinct from the Latest Activity tiles.
- The section is publicly visible without sign-in.

### 10.7 Dashboard

- Account appears for all signed-in users and is the default dashboard section.
- My Attestations appears for all signed-in users.
- Service Controller Workspace appears when the dashboard is in service-management or issuer context, or when the no-context dashboard has relevant service-control or issuer records.
- Issuer Tools section appears when the dashboard is in issuer context or the user has security assessment/certification records.
- Reviews section appears when the dashboard is in review context or the user has submitted reviews.
- Empty Service Controller Workspace, Issuer Tools, and Reviews sections are not shown to ordinary users by default.
- The approved-issuer request button appears only inside the Service Controller Workspace when the context is issuer or the user has security assessment/certification records, and the wallet is not approved according to the service-controller summary API.
- No developer/integrator dashboard context exists.
- The dashboard is the primary place to manage subjects (add subjects to account). The Account page does not have a subject add flow.
- The Account page does not display registered subjects. Subject information is visible only in the dashboard's Key Authorizations cards and the Account section's service identities display.
- Backend subject registration no longer blocks on "owned by another account" — ownership verification (DNS/did.json/contract) is the real gate.

### 10.8 Dashboard Publish Button

- The dashboard displays a Publish button in the top-right area.
- Clicking the Publish button opens a menu with three grouped options: User Review, Audit / Certification, Trust Management.
- User Review routes to `/publish?category=review`.
- Audit / Certification routes to `/publish?category=issuer`.
- Trust Management routes to `/publish?category=trust`.
- The Publish button is visible regardless of dashboard context.

### 10.9 Publish Page Categories

- `/publish?category=review` shows only the User Review form.
- `/publish?category=issuer` shows Security Assessment and Certification forms.
- `/publish?category=trust` shows Key Binding, Linked Identifier, and Controller Witness forms.
- `/publish` with no category shows all available attestation forms.

### 10.10 Activity

- Landing page shows a limited activity preview below the Latest Trust Profiles section.
- Full activity feed is available on the Activity page.
- Wallet addresses and DIDs are resolved to human-readable text where possible.

## 11. Non-Goals and Constraints

- The redesign must not require schema changes.
- Existing attestation form routes may continue to work as deep links.
- The redesign must not block permissionless issuance where currently supported.
- Approval as an issuer must be an optional trust enhancement, not a protocol requirement.
- The developer/integrator CTA must not require sign-in or route to the dashboard.
- Trust search is deferred to a future feature and is not part of this specification.
