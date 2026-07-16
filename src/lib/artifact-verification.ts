/**
 * Artifact Verification Library
 *
 * Re-exports from the omatrust-sdk. The core verification logic now lives in
 * @oma3/omatrust/reputation (Phase 2 extraction).
 *
 * The frontend wraps these SDK functions with enrichment (schema metadata,
 * decoded data display) but the verification logic comes from the SDK.
 *
 * See: docs/features/artifact/spec.md
 * See: docs/features/artifact/plan.md (Phase 2)
 */

export {
  verifyResponsibilityClaim,
  getVerifiedArtifactAttestations,
  isArtifactClaimedBy,
} from '@oma3/omatrust/reputation'

export type {
  VerifyResponsibilityClaimParams,
  VerifyResponsibilityClaimResult,
  GetVerifiedArtifactAttestationsParams,
  GetVerifiedArtifactAttestationsResult,
  IsArtifactClaimedByParams,
  IsArtifactClaimedByResult,
  VerifiedResponsibilityClaim,
  VerifiedArtifactAttestation,
} from '@oma3/omatrust/reputation'
