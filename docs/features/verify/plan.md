# Trust Verifier --- Test Cases

**Status: Implemented**

Use `spec.md` as the source of truth. This file tracks core scenarios for
the `/verify` implementation.

## Subject Verification

- ✅ Subject only: verifies a supported subject DID and renders a trust profile.
- ✅ Unknown subject: renders an empty trust profile without failing the page.
- ✅ No attestations: renders the attestations empty state for the selected subject.
- ✅ Proof verification: renders "Verified" badge when proofs pass; no badge when they don't (no red "Failed").
- ✅ Category priority: attestations sorted by importance (security assessments first, user reviews last).
- ✅ User review cap: maximum 20 user reviews displayed.
- ✅ Trusted badge: security assessments and certifications from approved issuers show "Trusted" badge.

## Controller Authorization

- ✅ Subject plus controller: renders key authorization card with mechanisms and Basic/Intermediate/Advanced signals.
- ✅ Controller authorization uses backend `getControllerConfirmation` (same as dashboard) plus attestation data.
- ✅ Controller not found: card shows "Not authorized" with no mechanisms and all signals inactive.
- ✅ DNS TXT evidence: mechanisms list includes "DNS TXT" when key is found in DNS.
- ✅ Controller witnesses: intermediate signal active when controller-witness attestations exist for the key.
- ✅ Key binding: advanced signal active when both controller witness and key binding exist.
- ✅ Authorization card displayed first (before trust profile) when controller is provided.

## Attestation Card Display

- ✅ Controller witness cards show: Controller DID, Method, Observed date.
- ✅ User review cards hide the verification/status section in the list (shown in detail modal only).
- ✅ Status section uses "Not revoked" / "Not expired" / "Verified" / "Not verified" labels.
- ✅ Failed checks use gray (secondary) badges, not red destructive badges.
- ✅ Failure reasons use muted text color.
