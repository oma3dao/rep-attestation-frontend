# Artifact Verification --- Implementation Plan

**Reference:** [spec.md](./spec.md)

---

## Phase 1: Library Implementation + Frontend Integration

Implement the three SDK functions as a local library in the frontend, integrate
them into the verify page and dashboard, then validate with smoke tests.

The library lives at `src/lib/artifact-verification.ts` during this phase. It
imports from `@oma3/omatrust/reputation` and `@oma3/omatrust/identity` for
primitives (listAttestations, getControllerAuthorization, parseArtifactDid,
artifactDidFromBytes) and builds the higher-level verification logic on top.

### Tasks

#### 1.1 Implement `verifyResponsibilityClaim()`

**File:** `src/lib/artifact-verification.ts`

Implement the single-claim verifier per the spec. Internally:
- Decode attestation data using `decodeAttestationData()` with the Responsibility
  Claim schema string from `schemas.ts`.
- Run the 6-check verification pipeline (schema, subject match, revocation,
  effective dates, controller authorized, issued in window).
- Return `VerifyResponsibilityClaimResult`.

#### 1.2 Implement `getVerifiedArtifactAttestations()`

**File:** `src/lib/artifact-verification.ts`

High-level orchestrator:
- Validate the `did:artifact` input via `parseArtifactDid()`.
- Query attestations using existing `getVerifiedAttestationsForDIDWithMetadata()`
  (which wraps `listAttestations`).
- Group by schema ID.
- Run `verifyResponsibilityClaim()` for each responsibility-claim attestation.
- Return the grouped `GetVerifiedArtifactAttestationsResult`.

#### 1.3 Implement `isArtifactClaimedBy()`

**File:** `src/lib/artifact-verification.ts`

Convenience wrapper:
- Call `getVerifiedArtifactAttestations()`.
- Filter `responsibilityClaims` where `responsibleParty` matches the input.
- Optionally filter by `responsibilityTypes`.
- Return `IsArtifactClaimedByResult`.

#### 1.4 Add `artifact` subject type to `SubjectIdInput`

Add "Artifact" to the allowed methods. Dual input: paste DID or file upload.

#### 1.5 Integrate into Verify Page

- Wire `getVerifiedArtifactAttestations()` when subject starts with `did:artifact:`.
- Render artifact-specific results layout per spec (Security Assessments summary
  at top, then Responsibility Claims, Certifications, Other).
- Hide the optional controller/signing key input for artifact subjects.

#### 1.6 Unhide Dashboard Publish Button

- Unhide the existing Publish button on the dashboard.
- Link to the attestation form with Responsibility Claim schema pre-selected.
- Pre-fill `responsibleParty` with connected wallet DID if available.

#### 1.7 Verify Creation Form

- Confirm the attestation creation form renders correctly for Responsibility Claim.
- Test delegated attestation submission on OMAChain Testnet.

#### 1.8 Update schema priority ordering

Add `responsibility-claim` to `SCHEMA_PRIORITY` in `attestation-queries.ts`.

---

### Phase 1 Smoke Tests

Run these manually against OMAChain Testnet after implementation.

| # | Test | Steps | Expected |
|---|------|-------|----------|
| S1 | Create Responsibility Claim | Use the attestation form to create a Responsibility Claim for a `did:artifact` with type "creator". Submit via delegated attestation. | Attestation created on-chain. Appears in dashboard attestation lists. |
| S2 | Verify artifact with valid claim | Go to `/verify`, enter the `did:artifact` from S1. | Security Assessments summary at top (empty/zero). Responsibility Claim appears below with "Verified" badge. All 6 checks pass. |
| S3 | Verify artifact via file upload | Go to `/verify`, select "Artifact", upload the original file. | DID is computed client-side. Same results as S2. |
| S4 | Verify artifact with no attestations | Go to `/verify`, enter a random `did:artifact:b...` that has no attestations. | Empty state message displayed. |
| S5 | Verify with revoked claim | Revoke the attestation from S1 via `eas-revoke` task. Re-verify the artifact. | Claim appears with failed verification — `notRevoked` check fails. |
| S6 | Verify unauthorized attester | Create a claim from a wallet that is NOT authorized for the responsible party. | Claim appears with "Not authorized" — `controllerAuthorized` check fails. |
| S7 | Malformed DID input | Enter `did:artifact:invalid` in the verify page. | Inline validation error, no query executed. |
| S8 | Publish button | Click Publish on the dashboard. | Navigates to attestation form with Responsibility Claim schema pre-selected. Subject field is empty (user fills in artifact DID). |

---

## Phase 2: SDK Extraction + Full Test Coverage

Move the verified library into the SDK, publish a new version, update the frontend
to consume it, and write comprehensive tests.

### Tasks

#### 2.1 Move verification logic to SDK

**Source:** `rep-attestation-frontend/src/lib/artifact-verification.ts`
**Destination:** `omatrust-sdk/src/reputation/artifact-verification.ts`

- Copy types and implementation.
- Replace frontend-specific imports (`@/config/schemas`, `@/lib/attestation-queries`)
  with SDK-internal equivalents (`./encode`, `./query`, `./types`).
- The SDK version accepts a raw `AttestationQueryResult` (not `EnrichedAttestationResult`).
  Enrichment remains the frontend's responsibility.

#### 2.2 Export from SDK package

**File:** `omatrust-sdk/src/reputation/index.ts`

Add exports:
```typescript
export { verifyResponsibilityClaim } from "./artifact-verification";
export { getVerifiedArtifactAttestations } from "./artifact-verification";
export { isArtifactClaimedBy } from "./artifact-verification";
```

Export types from `./types.ts`:
```typescript
export type {
  VerifyResponsibilityClaimParams,
  VerifyResponsibilityClaimResult,
  GetVerifiedArtifactAttestationsParams,
  GetVerifiedArtifactAttestationsResult,
  IsArtifactClaimedByParams,
  IsArtifactClaimedByResult,
  VerifiedResponsibilityClaim,
  VerifiedArtifactAttestation,
};
```

#### 2.3 Write SDK tests

Create `omatrust-sdk/test/artifact-verification.test.ts` with full coverage.
See test guidance below.

#### 2.4 Publish SDK

- Bump version in `package.json`.
- Run full test suite.
- Publish to npm (`@oma3/omatrust`).

#### 2.5 Update frontend to use SDK

**File:** `rep-attestation-frontend/src/lib/artifact-verification.ts`

Replace the local implementation with imports from the SDK:

```typescript
export {
  verifyResponsibilityClaim,
  getVerifiedArtifactAttestations,
  isArtifactClaimedBy,
} from '@oma3/omatrust/reputation';
```

The frontend still wraps these with enrichment (schema metadata, decoded data)
but the core verification logic now comes from the SDK.

#### 2.6 Update `package.json`

Bump the `@oma3/omatrust` dependency to the new version.

#### 2.7 Regression test

Re-run all Phase 1 smoke tests against the SDK-backed implementation to confirm
no behavioral changes.

---

### Phase 2 Test Engineering Guidance

These are the areas that need comprehensive automated test coverage (unit + integration).
The test engineer should use the spec's type definitions and verification steps as the
source of truth.

#### `verifyResponsibilityClaim()` — Unit Tests

**Happy path:**
- Valid claim with authorized attester → all checks pass, `valid: true`.
- Valid claim with multiple responsibility types → types correctly extracted.
- Valid claim with `subjectLabel` → label present in result.
- Valid claim near authorization window boundaries (issuedAt == anchoredFrom, issuedAt == until - 1).

**Check isolation (each check fails independently):**
- Missing `responsibleParty` → `schemaValid: false`.
- Missing `subject` → `schemaValid: false`.
- Missing `responsibilityType` → `schemaValid: false`.
- Empty `responsibilityType` array → `schemaValid: false`.
- Missing `issuedAt` → `schemaValid: false`.
- Subject doesn't match provided `artifactDid` → `subjectMatches: false`.
- `revocationTime > 0` → `notRevoked: false`.
- `effectiveAt` in the future → `currentlyEffective: false`.
- `expiresAt` in the past → `currentlyEffective: false`.
- `expiresAt === 0` (no expiration) → `currentlyEffective: true`.
- Controller not authorized → `controllerAuthorized: false`.
- `issuedAt` before `anchoredFrom` → `issuedDuringAuthorizationWindow: false`.
- `issuedAt` after `until` → `issuedDuringAuthorizationWindow: false`.

**Edge cases:**
- `artifactDid` param omitted → `subjectMatches` always true (no cross-check).
- Case-insensitive subject matching (DID with mixed case).
- Attestation with `effectiveAt === 0` → treated as "effective immediately".
- Multiple checks fail simultaneously → all failures reported in `reasons[]`.

#### `getVerifiedArtifactAttestations()` — Unit Tests

- Empty result set (no attestations) → all arrays empty.
- Mixed attestation types → correctly grouped by schema.
- Responsibility claims verified, other schemas get standard verification.
- Invalid `did:artifact` input → throws/rejects with descriptive error.
- Valid DID with only non-responsibility-claim attestations → `responsibilityClaims` empty, others populated.

#### `isArtifactClaimedBy()` — Unit Tests

- Responsible party has valid claim → `claimed: true`.
- Responsible party has no claims → `claimed: false`, reasons explain.
- Filter by `responsibilityTypes` → only matching types returned.
- Multiple claims from same party → all returned.
- Claim exists but verification fails → `claimed: false`.

#### Integration Tests (SDK)

- SDK functions work without frontend-specific context (no Next.js, no `schemas.ts`).
- Integration test: SDK functions called with a real provider against a Hardhat
  local node with EAS deployed and test attestations created in a fixture.
- Confirm `getVerifiedArtifactAttestations` correctly calls through to
  `getControllerAuthorization` and respects its results.

#### Frontend Regression Tests

- `SubjectIdInput` accepts `did:artifact:b...` strings when `artifact` method is allowed.
- `SubjectIdInput` file upload computes DID and populates input.
- `SubjectIdInput` rejects malformed artifact DIDs.
- Verify page hides controller input when subject is `did:artifact`.
- Verify page shows controller input when subject is `did:web`.
- Responsibility Claim card renders all expected fields.
- Schema priority ordering: security assessments first, then responsibility claims.
- Dashboard Publish button visible and navigates to correct form.
- Frontend enrichment layer (decoding, schema title, trusted badge) still works
  when verification is delegated to the SDK.
