/**
 * Schemas eligible for gas subsidies
 * Server pays gas for attestations using these schema UIDs
 * 
 * Schema IDs reference the canonical definitions in schemas.ts,
 * which maintains the deployed UIDs per chain.
 */

import { getSchema } from './schemas';

// Schema IDs that are subsidized (server pays gas)
// These reference schema definitions in schemas.ts
const SUBSIDIZED_SCHEMA_IDS: string[] = [
  'user-review',
  'linked-identifier',
];

/**
 * Check if a schema is eligible for gas subsidy on a given chain
 * @param chainId - The chain ID
 * @param schemaUID - The schema UID to check
 * @returns true if the schema is subsidized
 */
export function isSubsidizedSchema(chainId: number, schemaUID: string): boolean {
  const normalizedUID = schemaUID.toLowerCase();
  
  return SUBSIDIZED_SCHEMA_IDS.some(schemaId => {
    const schema = getSchema(schemaId);
    const deployedUID = schema?.deployedUIDs?.[chainId];
    return deployedUID?.toLowerCase() === normalizedUID;
  });
}

/**
 * Get all subsidized schema UIDs for a given chain
 * Useful for debugging and documentation
 */
export function getSubsidizedSchemaUIDs(chainId: number): string[] {
  return SUBSIDIZED_SCHEMA_IDS
    .map(schemaId => {
      const schema = getSchema(schemaId);
      return schema?.deployedUIDs?.[chainId];
    })
    .filter((uid): uid is string => !!uid && uid !== '0x' + '0'.repeat(64));
}
