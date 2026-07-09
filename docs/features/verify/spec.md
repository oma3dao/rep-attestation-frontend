# Trust Verifier --- Specification

**Status: Implemented**

## Purpose

The Trust Verifier provides a visual interface for inspecting a subject's trust
profile, verifying attestations, and optionally determining whether a
controller/signing key is authorized for that subject.

## Scope

### In Scope

-   Dedicated `/verify` page.
-   Subject verification with attestation list sorted by category priority.
-   Optional controller/signing key authorization verification.
-   Reuse existing UI components (attestation cards, badges, subject picker).
-   "Verified" badge for attestations that pass proof verification.
-   "Trusted" badge for security assessments and certifications from approved issuers in the trust anchors.
-   Category-priority ordering (security assessments → certifications → controller witnesses → key bindings → linked identifiers → user reviews).
-   User review cap (20 max in the verify results).

### UI

#### Inputs

Required:
- Subject — Subject Type picker (reuse existing SubjectIdInput)
  - Web Domain / URL
  - Blockchain Address
  - JWK Key

Optional:
- Controller / Signing Key (reuse SubjectIdInput with pkh/jwk methods)

#### Verify Button

Runs verification and renders results.

## Trust Profile

Display:

-   Subject DID
-   Canonical DID
-   Subject type badge
-   Summary counts:
    -   Reviews
    -   Certifications
    -   Security Assessments
    -   Controller Witnesses
    -   Key Bindings

## Attestations

Lists all attestations for the subject, sorted by category priority (most important trust signals first, user reviews last).

Uses the shared `LatestAttestations` component with pre-fetched data.

Each card displays:

-   Schema icon and title
-   Attester
-   Service ID
-   Date
-   Active/Revoked status badge
-   "Verified" badge (green, with CheckCircle2) when proof verification passes
-   "Trusted" badge (amber, with CheckCircle2) when attester is an approved issuer for that schema
-   Status section with check badges (Not revoked, Not expired, Verified) — hidden on list cards for user reviews, shown in detail modal
-   Controller witness cards additionally show: Controller DID, Method, Observed date

## Controller Authorization

Shown only when the optional controller/signing key is supplied. Displayed as the **first section** in the results.

Uses `getControllerConfirmation` from the OMATrust backend (same as the dashboard) combined with attestation data to derive authorization levels.

Card displays:

-   Service ID
-   Key ID
-   Mechanisms used (DNS TXT, DID document, Controller witness, Key binding)
-   Basic / Intermediate / Advanced signal badges
-   Authorized / Not authorized status badge

## Implementation Notes

-   Removed the frontend `/api/verify/controller-authorization` route. Controller authorization uses the backend's `controller-confirm` endpoint directly.
-   Verification detail section uses "Status" heading (not "Verification"). Check names are user-friendly: "Not revoked", "Not expired", "Verified" / "Not verified".
-   Failed verification checks use gray (secondary) badges, not red. Failure reasons use muted text, not destructive.
-   Trust anchors are fetched alongside attestations to determine the "Trusted" badge.

## Acceptance Criteria

-   ✅ Verify page available at `/verify`
-   ✅ Subject verification works without controller input
-   ✅ Optional controller input enables authorization card (displayed first)
-   ✅ Attestations display verification status with "Verified" and "Trusted" badges
-   ✅ Attestations sorted by category priority
-   ✅ User reviews capped at 20, verification detail hidden from list cards
-   ✅ Existing UI components reused (LatestAttestations, AttestationCard, SubjectIdInput, Badge)
-   ✅ No red "Failed" badges — absence of green indicates not verified
