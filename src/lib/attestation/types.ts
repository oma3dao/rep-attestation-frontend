// Common types for attestation services
export interface AttestationData {
  schemaId: string
  recipient: string // CAIP-2 address (e.g., "eip155:1:0x742d35Cc6634C0532925a3b844Bc454e4438f44e")
  data: Record<string, any> // Form data, may include expiration fields like 'expireAt'
  expirationTime?: number // Deprecated - now extracted from data fields
  revocable?: boolean // Deprecated - always false for BAS
}

export interface AttestationResult {
  transactionHash: string
  attestationId: string
  blockNumber?: number
  gasUsed?: bigint
}

export interface AttestationServiceClient {
  // Core attestation operations
  createAttestation(data: AttestationData): Promise<AttestationResult>
  revokeAttestation(attestationId: string): Promise<string> // returns tx hash
  getAttestation(attestationId: string): Promise<any>
  
  // Schema operations  
  registerSchema(schema: any): Promise<string> // returns schema ID
  getSchema(schemaId: string): Promise<any>
  
  // Utility
  estimateGas(data: AttestationData): Promise<bigint>
  isConnected(): boolean
  getCurrentChain(): number | undefined
} 