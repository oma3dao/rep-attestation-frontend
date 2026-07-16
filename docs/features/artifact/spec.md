# Artifact Verification --- Specification

**Status: Implemented**

## Purpose

Add `did:artifact` verification to the OMATrust Portal. Users can input a
`did:artifact` identifier (or upload a file to compute one) and see all verified
Responsibility Claims, Security Assessments, Certifications, and other
attestations associated with that content-addressed artifact.

This feature implements
[omatrust-sdk#34](https://github.com/oma3dao/omatrust-sdk/issues/34).

## Background

A `did:artifact` names an immutable byte sequence by its SHA-256 content hash
(CIDv1, raw multicodec, base32-lower). Responsibility Claims allow an
authorized identity to publicly accept responsibilities (creator, distributor,
maintainer) for a subject, where the subject can be a `did:artifact`.

The SDK provides:
- `artifactDidFromBytes()` / `artifactDidFromJson()` — construct a did:artifact
- `parseArtifactDid()` — validate and extract components
- `verifyDidArtifact()` — verify content matches a did:artifact
- `listAttestations()` / `getAttestationsForDid()` — query EAS attestations
- `verifyAttestation()` — structural + lifecycle verification
- `getControllerAuthorization()` — controller authorization window

After this feature is complete, the SDK will additionally export:
- `verifyResponsibilityClaim()` — schema-aware Responsibility Claim verification
- `getVerifiedArtifactAttestations()` — high-level artifact verification entry point
- `isArtifactClaimedBy()` — convenience check for a specific responsible party

## Scope

### In Scope

- SDK functions for Responsibility Claim verification
- Verify page integration: accept `did:artifact` as a subject type (paste or file upload)
- Dashboard: unhide Publish button, link to Responsibility Claim attestation form
- Responsibility Claim creation form (new schema in the attestation form picker)

### Out of Scope

- Responsibility Claims for non-artifact subjects (future — APIs, websites, agents)
- Mainnet deployment of the schema (separate ops task)
- Dedicated "Artifact Claims" dashboard section (future — deferred to avoid crowding)

---

## SDK Functions

### `verifyResponsibilityClaim()`

Verifies a single Responsibility Claim attestation.

```typescript
type VerifyResponsibilityClaimParams = {
  attestation: AttestationQueryResult;
  artifactDid?: string;           // Expected subject (optional cross-check)
  provider: unknown;
  easContractAddress?: Hex;
  chain?: string;                 // CAIP-2 chain identifier
};

type VerifyResponsibilityClaimResult = {
  valid: boolean;
  responsibleParty: string;       // DID
  controllerDid: string;          // DID of the attester-as-controller
  responsibilityTypes: string[];  // e.g. ["creator", "maintainer"]
  subjectLabel?: string;
  authorization: ControllerAuthorizationResult;
  checks: {
    schemaValid: boolean;
    subjectMatches: boolean;
    notRevoked: boolean;
    currentlyEffective: boolean;
    controllerAuthorized: boolean;
    issuedDuringAuthorizationWindow: boolean;
  };
  reasons: string[];              // Human-readable failure reasons
};
```

**Verification steps:**

1. Decode attestation data using the Responsibility Claim EAS schema string.
2. Validate required fields: `responsibleParty`, `subject`, `responsibilityType`, `issuedAt`.
3. If `artifactDid` supplied, confirm `subject` matches (case-insensitive).
4. Check `revocationTime === 0` (not revoked via EAS).
5. Check `effectiveAt <= now` and (`expiresAt === 0 || expiresAt > now`).
6. Derive the controller DID from the attester address (`did:pkh:eip155:<chainId>:<attester>`).
7. Call `getControllerAuthorization({ subjectDid: responsibleParty, controllerDid, chain })`.
8. Confirm `authorization.authorized === true`.
9. Confirm `issuedAt` falls within `[authorization.anchoredFrom, authorization.until ?? ∞)`.

### `getVerifiedArtifactAttestations()`

High-level entry point: queries and verifies all attestations for an artifact.

```typescript
type GetVerifiedArtifactAttestationsParams = {
  artifactDid: string;
  provider: unknown;
  easContractAddress?: Hex;
  chain?: string;
  schemas?: Hex[];                // Override schema filter
  fromBlock?: number;
  limit?: number;
};

type VerifiedArtifactAttestation = {
  attestation: EnrichedAttestationResult;
  verification?: VerifyAttestationResult;
};

type VerifiedResponsibilityClaim = {
  attestation: EnrichedAttestationResult;
  verification: VerifyResponsibilityClaimResult;
};

type GetVerifiedArtifactAttestationsResult = {
  artifactDid: string;
  responsibilityClaims: VerifiedResponsibilityClaim[];
  securityAssessments: VerifiedArtifactAttestation[];
  certifications: VerifiedArtifactAttestation[];
  otherAttestations: VerifiedArtifactAttestation[];
};
```

**Behavior:**

1. Parse and validate the `did:artifact` input (reject malformed DIDs early).
2. Query all attestations where the subject is the artifact DID.
3. Group by schema: responsibility-claim, security-assessment, certification, other.
4. For Responsibility Claims: run `verifyResponsibilityClaim()` on each.
5. For other schemas: run standard `verifyAttestation()`.
6. Return grouped, verified results.

### `isArtifactClaimedBy()`

Convenience helper: does a specific responsible party claim this artifact?

```typescript
type IsArtifactClaimedByParams = {
  artifactDid: string;
  responsibleParty: string;       // DID to check
  provider: unknown;
  easContractAddress?: Hex;
  chain?: string;
  responsibilityTypes?: string[]; // Filter to specific types
};

type IsArtifactClaimedByResult = {
  claimed: boolean;
  claims: VerifiedResponsibilityClaim[];
  matchedResponsibilityTypes: string[];
  reasons: string[];
};
```

---

## UI Changes

### Verify Page (`/verify`)

**Subject input — Artifact mode:**

The artifact input works like the blockchain address input for `did:pkh`:
the user can either paste a `did:artifact:b...` string directly, or they can
upload a file and the frontend computes the `did:artifact` from the file bytes
using `artifactDidFromBytes()`.

- Add `did:artifact` as a subject type option in the `SubjectIdInput` component.
- When "Artifact" is selected, show two input modes:
  - **Paste DID** — text input accepting `did:artifact:b...`
  - **Upload file** — file picker that hashes the file client-side and derives the DID
- Allowed methods for the verify page: `["web", "pkh", "jwk", "artifact"]`.

**Results rendering — Artifact layout:**

When the subject is a `did:artifact`, display results in this order:

1. **Security Assessments Summary** (top — compact summary badges/counts,
   minimal vertical space)
2. **Responsibility Claims** section:
   - Each claim card shows: responsible party DID, responsibility types (badges),
     subject label (if provided), authorization status, verification checks.
   - Green "Verified" badge when all checks pass.
   - Expandable detail showing each check with pass/fail indicators.
3. **Certifications** section (existing card format)
4. **Other Attestations** section (existing card format)

**No controller input for artifacts:**
- The optional "Signing Key" controller input is hidden when subject type is `did:artifact`.
  Authorization is evaluated per-claim (each claim has its own responsible party / controller).

### Dashboard — Publish Button

The existing hidden Publish button on the dashboard is unhidden and links to the
attestation creation form pre-configured for the Responsibility Claim schema.

The Publish button does NOT know the artifact DID — the user fills that in on the
form. The button pre-selects the schema (Responsibility Claim) and optionally
pre-fills the `responsibleParty` with the connected wallet's DID (if the user has
one registered). The subject/artifact DID is entered by the user in the form.

### Dashboard — Attestation Lists

- Responsibility Claim attestations appear in "My Attestations" and "Latest Attestations"
  using the existing attestation card format.
- Schema title: "Responsibility Claim"
- Decoded fields displayed: responsibleParty, subject, subjectLabel, responsibilityType

### Attestation Creation Form

- Responsibility Claim is available in the schema picker (already handled by
  `update-schemas` since the schema is now in `schemas.ts`).
- The form renders fields from the schema definition: responsibleParty, subject,
  subjectLabel, responsibilityType, effectiveAt, expiresAt.
- Subject field: SubjectIdInput with allowed methods `["web", "pkh", "jwk", "artifact"]`.
- ResponsibleParty field: DID input with allowed methods `["web", "pkh", "handle"]`.
- ResponsibilityType field: multi-select from the `x-oma3-enum` values (creator, distributor, maintainer).

---

## Schema Priority

Add `responsibility-claim` to the category priority ordering:

```typescript
const SCHEMA_PRIORITY: Record<string, number> = {
  'security-assessment': 0,
  'responsibility-claim': 1,
  'certification': 2,
  'controller-witness': 3,
  'key-binding': 4,
  'linked-identifier': 5,
  'user-review-response': 6,
  'user-review': 7,
}
```

---

## Error Handling

| Condition | Behavior |
|-----------|----------|
| Malformed `did:artifact` | Reject at input validation with inline error |
| File upload too large | Reject with size limit message (TBD — 100MB?) |
| No attestations found | Show empty state: "No attestations found for this artifact." |
| Controller authorization fails | Claim shown with "Not authorized" badge + reason |
| EAS query fails (RPC error) | Surface error in UI, allow retry |
| Schema decode fails | Attestation shown as "raw" without decoded fields |

---

## Dependencies

| Dependency | Status |
|------------|--------|
| `responsibility-claim.schema.json` authored | ✅ Done |
| EAS schema generated (`Responsibility-Claim.eas.json`) | ✅ Done |
| Schema deployed to OMAChain Testnet | ✅ Done (UID: `0x8779...b651`) |
| Frontend `schemas.ts` updated | ✅ Done |
| Backend trust anchors updated | ✅ Done (testnet) |
| `did:artifact` support in SDK | ✅ Done (`@oma3/omatrust/identity`) |
| `getControllerAuthorization()` in SDK | ✅ Done |
| `listAttestations()` in SDK | ✅ Done |

---

## Acceptance Criteria

- [ ] `verifyResponsibilityClaim()` validates all 6 checks and returns structured results.
- [ ] `getVerifiedArtifactAttestations()` queries and groups attestations by schema type.
- [ ] `isArtifactClaimedBy()` correctly reports whether a party claims an artifact.
- [ ] Verify page accepts `did:artifact` via paste or file upload.
- [ ] File upload computes `did:artifact` client-side and queries attestations.
- [ ] Verify page renders Security Assessments summary at top, then Responsibility Claims.
- [ ] Controller input is hidden when subject is `did:artifact`.
- [ ] Dashboard Publish button visible, links to Responsibility Claim form.
- [ ] Responsibility Claim creation form works and submits via delegated attestation.
- [ ] Responsibility Claims appear in dashboard attestation lists.
- [ ] Schema priority ordering: security assessments first, then responsibility claims.
- [ ] Error states handled gracefully (malformed DID, no attestations, RPC failure, file too large).
- [ ] Unit tests cover the SDK verification functions with full coverage.
