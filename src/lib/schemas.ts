/**
 * SCHEMA DEFINITIONS FOR ATTESTATION FORMS
 * 
 * TODO: REFACTOR TO CONSUME FROM EXTERNAL SCHEMA REPOSITORY
 * ========================================================
 * 
 * Currently these schemas are hardcoded here, but they should be the single source
 * of truth from the schema-deployment repository that handles framework-specific
 * deployments across different attestation systems and chains.
 * 
 * REFACTORING OPTIONS:
 * 
 * Option 1: NPM Package (RECOMMENDED)
 * - schema-deployment-repo publishes @oma3/attestation-schemas to npm
 * - Package includes: schemas/ (JSON), types/ (generated TS), ui/ (UI transforms)
 * - This repo: npm install @oma3/attestation-schemas
 * - Benefits: Versioning, easy updates, TypeScript support
 * 
 * Option 2: Git Submodule
 * - Add schema-deployment-repo as git submodule in schemas/
 * - Create lib/schema-loader.ts to read from submodule
 * - Create lib/ui-transforms.ts to convert to UI format
 * - Benefits: Direct repo access, no publish step needed
 * 
 * Option 3: Build-time Fetch
 * - scripts/sync-schemas.js fetches from API/repo during build
 * - Generates lib/generated-schemas.ts automatically
 * - Create lib/ui-adapters.ts for form transformations
 * - Benefits: Always up-to-date, no manual sync needed
 * 
 * RECOMMENDED IMPLEMENTATION PLAN:
 * 
 * Phase 1: Dual System (No Breaking Changes)
 * - Keep current schemas.ts working
 * - Add new lib/schema-loader.ts:
 *   ```typescript
 *   import { loadExternalSchemas } from '@oma3/schemas'
 *   import { transformToUISchema } from './ui-transforms'
 *   
 *   export const attestationSchemas = transformToUISchema(
 *     loadExternalSchemas()
 *   )
 *   ```
 * 
 * Phase 2: UI Transform Layer
 * - Create lib/ui-transforms.ts:
 *   ```typescript
 *   export function transformToUISchema(jsonSchemas) {
 *     // Convert JSON schema → FormField interface
 *     // Add UI-specific properties (colors, icons, etc.)
 *     // Handle field type mappings and validation rules
 *   }
 *   ```
 * 
 * Phase 3: Gradual Migration
 * - Switch components to use new schema loader
 * - Test thoroughly with existing forms
 * - Remove hardcoded schemas once migration complete
 * 
 * CONSIDERATIONS:
 * - UI-specific data (colors, icons) should stay in frontend
 * - Need to handle schema versioning and backwards compatibility
 * - Consider caching strategy for runtime vs build-time loading
 * - Ensure type safety throughout the transformation pipeline
 * 
 * CURRENT STATUS: Using hardcoded schemas below (temporary)
 */

// Schema definitions for attestation forms
export type FieldType = 'string' | 'integer' | 'array' | 'enum' | 'datetime' | 'uri' | 'text'

export interface FormField {
  name: string
  type: FieldType
  label: string
  description?: string
  required: boolean
  placeholder?: string
  options?: string[] // for enum fields
  format?: string // for validation (uri, date-time, etc.)
  min?: number // for integer fields
  max?: number // for integer fields
}

export interface AttestationSchema {
  id: string
  title: string
  description: string
  icon: string
  color: string
  fields: FormField[]
}

// Certification Schema
const certificationFields: FormField[] = [
  {
    name: '@context',
    type: 'string',
    label: 'Context',
    description: 'JSON-LD context URI',
    required: false,
    placeholder: 'https://oma3.org/context.jsonld'
  },
  {
    name: '@type',
    type: 'string',
    label: 'Type',
    description: 'Semantic type identifier',
    required: false,
    placeholder: 'Certification'
  },
  {
    name: 'attester',
    type: 'string',
    label: 'Attester',
    description: 'DID of the Certification Body issuing the certification',
    required: true,
    placeholder: 'did:example:123...'
  },
  {
    name: 'subject',
    type: 'string',
    label: 'Subject',
    description: 'DID of the product, system, or organization being certified',
    required: true,
    placeholder: 'did:example:456...'
  },
  {
    name: 'subjectOwner',
    type: 'string',
    label: 'Subject Owner',
    description: 'DID of the entity responsible for the subject',
    required: false,
    placeholder: 'did:example:789...'
  },
  {
    name: 'subjectMetadataURI',
    type: 'uri',
    label: 'Subject Metadata URI',
    description: 'Optional URI controlled by the subject that provides mutable, human-readable metadata',
    required: false,
    format: 'uri'
  },
  {
    name: 'programIdentifier',
    type: 'string',
    label: 'Program Identifier',
    description: 'DID or URI of the certification program under which this certification was issued',
    required: true,
    placeholder: 'did:example:program123'
  },
  {
    name: 'programMetadataURI',
    type: 'uri',
    label: 'Program Metadata URI',
    description: 'Optional URI for mutable, human-readable certification program info',
    required: false,
    format: 'uri'
  },
  {
    name: 'anchoredDataURL',
    type: 'uri',
    label: 'Anchored Data URL',
    description: 'Immutable URI containing the canonical certification program data',
    required: false,
    format: 'uri'
  },
  {
    name: 'anchoredDataAlgorithm',
    type: 'string',
    label: 'Anchored Data Algorithm',
    description: 'Hashing algorithm used to generate anchoredDataHash',
    required: false,
    placeholder: 'sha3-256'
  },
  {
    name: 'anchoredDataHash',
    type: 'string',
    label: 'Anchored Data Hash',
    description: 'Cryptographic hash of the content located at anchoredDataURL',
    required: false
  },
  {
    name: 'assessor',
    type: 'string',
    label: 'Assessor',
    description: 'DID of the authorized assessor (test lab, auditor) who evaluated the subject',
    required: true,
    placeholder: 'did:example:assessor123'
  },
  {
    name: 'assessorMetadataURI',
    type: 'uri',
    label: 'Assessor Metadata URI',
    description: 'Optional URI with human-readable info about the assessor',
    required: false,
    format: 'uri'
  },
  {
    name: 'certificationLevel',
    type: 'string',
    label: 'Certification Level',
    description: 'Optional classification level of certification',
    required: false,
    placeholder: 'Gold, Level 2, etc.'
  },
  {
    name: 'version',
    type: 'string',
    label: 'Version',
    description: 'Software version of the certified subject',
    required: false,
    placeholder: '1.0.0'
  },
  {
    name: 'versionHW',
    type: 'string',
    label: 'Hardware Version',
    description: 'Hardware version of the certified subject, if applicable',
    required: false,
    placeholder: 'v2.1'
  },
  {
    name: 'effectiveAt',
    type: 'integer',
    label: 'Effective At',
    description: 'Unix timestamp (in seconds) when the certification becomes effective',
    required: false
  },
  {
    name: 'expiresAt',
    type: 'integer',
    label: 'Expires At',
    description: 'Optional expiration timestamp (in seconds)',
    required: false
  },
  {
    name: 'issuedAt',
    type: 'integer',
    label: 'Issued At',
    description: 'Optional timestamp (in seconds) when the certification was issued',
    required: false
  },
  {
    name: 'attestationType',
    type: 'string',
    label: 'Attestation Type',
    description: 'Optional label to help downstream tools interpret this attestation',
    required: false,
    placeholder: 'Certification'
  }
]

// Endorsement Schema
const endorsementFields: FormField[] = [
  {
    name: '@context',
    type: 'string',
    label: 'Context',
    description: 'JSON-LD context URI for semantic processing',
    required: false,
    placeholder: 'https://oma3.org/context.jsonld'
  },
  {
    name: '@type',
    type: 'string',
    label: 'Type',
    description: 'Semantic type identifier',
    required: false,
    placeholder: 'Endorsement'
  },
  {
    name: 'attester',
    type: 'string',
    label: 'Attester',
    description: 'DID or address of the entity issuing the endorsement or approval',
    required: true,
    placeholder: 'did:example:123...'
  },
  {
    name: 'subject',
    type: 'string',
    label: 'Subject',
    description: 'DID of the entity being endorsed or approved',
    required: true,
    placeholder: 'did:example:456...'
  },
  {
    name: 'purpose',
    type: 'string',
    label: 'Purpose',
    description: 'Optional short string indicating the reason or context of the endorsement',
    required: false,
    placeholder: 'Quality assurance, partnership, etc.'
  },
  {
    name: 'version',
    type: 'string',
    label: 'Version',
    description: 'Optional semantic version of the subject being endorsed',
    required: false,
    placeholder: '1.0.0'
  },
  {
    name: 'attestationType',
    type: 'enum',
    label: 'Attestation Type',
    description: 'Distinguishes attestation purpose',
    required: false,
    options: ['Endorsement', 'Approval']
  },
  {
    name: 'policyURI',
    type: 'uri',
    label: 'Policy URI',
    description: 'Optional URI pointing to the criteria or process used for formal approvals',
    required: false,
    format: 'uri'
  },
  {
    name: 'effectiveAt',
    type: 'integer',
    label: 'Effective At',
    description: 'Optional Unix timestamp when the endorsement becomes effective',
    required: false
  },
  {
    name: 'expiresAt',
    type: 'integer',
    label: 'Expires At',
    description: 'Optional Unix timestamp after which the endorsement expires',
    required: false
  },
  {
    name: 'issuedAt',
    type: 'integer',
    label: 'Issued At',
    description: 'Optional Unix timestamp for when the attestation was issued',
    required: false
  }
]

// Linked Identifier Schema
const linkedIdentifierFields: FormField[] = [
  {
    name: 'attester',
    type: 'string',
    label: 'Attester',
    description: 'CAIP-2 address or DID of the third-party entity making the assertion',
    required: true,
    placeholder: 'did:example:123...'
  },
  {
    name: 'subject',
    type: 'string',
    label: 'Subject',
    description: 'CAIP-2 address or DID of the subject that controls the linked identifier',
    required: true,
    placeholder: 'did:example:456...'
  },
  {
    name: 'linkedId',
    type: 'string',
    label: 'Linked ID',
    description: 'The identifier being claimed as controlled by the subject',
    required: true,
    placeholder: 'example@email.com, @username, domain.com'
  },
  {
    name: 'linkedIdType',
    type: 'enum',
    label: 'Linked ID Type',
    description: 'Type or namespace of the linkedId being asserted',
    required: true,
    options: ['did:web', 'did:key', 'email', 'twitter', 'github', 'caip2', 'other']
  },
  {
    name: 'method',
    type: 'enum',
    label: 'Verification Method',
    description: 'Verification method used to confirm control of the linkedId',
    required: true,
    options: ['http-file', 'dns-txt', 'email-challenge', 'social-post', 'manual', 'oauth', 'other']
  },
  {
    name: 'issuedAt',
    type: 'datetime',
    label: 'Issued At',
    description: 'Timestamp when the attestation was issued',
    required: true,
    format: 'date-time'
  },
  {
    name: 'validUntil',
    type: 'datetime',
    label: 'Valid Until',
    description: 'Optional expiration timestamp',
    required: false,
    format: 'date-time'
  },
  {
    name: 'attestationType',
    type: 'enum',
    label: 'Attestation Type',
    description: 'Optional classification of the attestation',
    required: false,
    options: ['domain-ownership', 'social-handle', 'email-control', 'identity-link', 'account-recovery', 'group-membership', 'reputation-score', 'other']
  }
]

// User Review Schema
const userReviewFields: FormField[] = [
  {
    name: '@context',
    type: 'string',
    label: 'Context',
    description: 'JSON-LD context URI for semantic processing',
    required: false,
    placeholder: 'https://oma3.org/context.jsonld'
  },
  {
    name: '@type',
    type: 'string',
    label: 'Type',
    description: 'Semantic type identifier',
    required: false,
    placeholder: 'UserReview'
  },
  {
    name: 'attester',
    type: 'string',
    label: 'Attester',
    description: 'Ethereum address or DID of the entity submitting the review',
    required: true,
    placeholder: 'did:example:123...'
  },
  {
    name: 'subject',
    type: 'string',
    label: 'Subject',
    description: 'DID or URI of the application or entity being reviewed',
    required: true,
    placeholder: 'did:example:app456'
  },
  {
    name: 'version',
    type: 'string',
    label: 'Version',
    description: 'Version of the reviewed subject',
    required: false,
    placeholder: '1.0.0'
  },
  {
    name: 'summary',
    type: 'string',
    label: 'Summary',
    description: 'Short title or headline for the review',
    required: false,
    placeholder: 'Great app!, Needs improvement, etc.'
  },
  {
    name: 'reviewBody',
    type: 'string',
    label: 'Review Body',
    description: 'Free-form text describing the user experience or feedback',
    required: false,
    placeholder: 'Detailed review text...'
  },
  {
    name: 'author',
    type: 'string',
    label: 'Author',
    description: 'DID, handle, or name of the user who wrote the review',
    required: false,
    placeholder: '@username or John Doe'
  },
  {
    name: 'datePublished',
    type: 'datetime',
    label: 'Date Published',
    description: 'Timestamp when the review was written or published',
    required: false,
    format: 'date-time'
  },
  {
    name: 'ratingValue',
    type: 'integer',
    label: 'Rating Value',
    description: 'Numerical rating from 1 (worst) to 5 (best)',
    required: true,
    min: 1,
    max: 5
  },
  {
    name: 'screenshotUrls',
    type: 'array',
    label: 'Screenshot URLs',
    description: 'Optional screenshots showing the app during review',
    required: false,
    placeholder: 'https://example.com/screenshot1.png'
  },
  {
    name: 'anchoredDataURL',
    type: 'uri',
    label: 'Anchored Data URL',
    description: 'URI pointing to offchain review content',
    required: false,
    format: 'uri'
  },
  {
    name: 'anchoredDataAlgorithm',
    type: 'string',
    label: 'Anchored Data Algorithm',
    description: 'Hashing algorithm used for anchoredDataHash',
    required: false,
    placeholder: 'sha3-256'
  },
  {
    name: 'anchoredDataHash',
    type: 'string',
    label: 'Anchored Data Hash',
    description: 'Cryptographic hash of the content located at anchoredDataURL',
    required: false
  },
  {
    name: 'attestationType',
    type: 'string',
    label: 'Attestation Type',
    description: 'Type identifier for this attestation',
    required: false,
    placeholder: 'UserReview'
  },
  {
    name: 'issuedAt',
    type: 'integer',
    label: 'Issued At',
    description: 'Unix timestamp for when the review was submitted',
    required: false
  },
  {
    name: 'expiresAt',
    type: 'integer',
    label: 'Expires At',
    description: 'Optional expiration timestamp for the attestation',
    required: false
  }
]

// Export all schemas
export const attestationSchemas: Record<string, AttestationSchema> = {
  certification: {
    id: 'certification',
    title: 'Certification',
    description: 'Create verifiable certifications for applications, including compliance and security assessments',
    icon: 'Shield',
    color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    fields: certificationFields
  },
  endorsement: {
    id: 'endorsement',
    title: 'Endorsement',
    description: 'Provide endorsements and recommendations for projects and applications',
    icon: 'FileCheck',
    color: 'bg-green-50 border-green-200 hover:bg-green-100',
    fields: endorsementFields
  },
  'linked-identifier': {
    id: 'linked-identifier',
    title: 'Linked Identifier',
    description: 'Link and verify different identity systems and accounts',
    icon: 'LinkIcon',
    color: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
    fields: linkedIdentifierFields
  },
  'user-review': {
    id: 'user-review',
    title: 'User Review',
    description: 'Submit detailed reviews and ratings for applications and services',
    icon: 'Star',
    color: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100',
    fields: userReviewFields
  }
}

// Helper function to get schema by ID
export function getSchema(id: string): AttestationSchema | undefined {
  return attestationSchemas[id]
}

// Helper function to get all schema IDs
export function getSchemaIds(): string[] {
  return Object.keys(attestationSchemas)
}

// Helper function to get all schemas as array
export function getAllSchemas(): AttestationSchema[] {
  return Object.values(attestationSchemas)
} 