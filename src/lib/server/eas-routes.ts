/**
 * Server-side EAS route logic
 *
 * Core business logic for EAS API routes, separated from HTTP handling
 * for testability. Accepts the SDK's PrepareDelegatedAttestationResult
 * shape from the client.
 */

import { keccak256, toUtf8Bytes, verifyTypedData, JsonRpcProvider, Wallet, Contract, isAddress } from 'ethers';
import { getContractAddress } from '@/config/attestation-services';
import { omachainTestnet, omachainMainnet } from '@/config/chains';
import { isSubsidizedSchema } from '@/config/subsidized-schemas';
import { splitSignature, buildDelegatedTypedDataFromEncoded, type Hex, type PrepareDelegatedAttestationResult } from '@oma3/omatrust/reputation';
import { loadEasDelegatePrivateKey, getThirdwebManagedWallet } from '@/lib/server/eas-delegate-key';
import { createThirdwebClient, getContract, prepareContractCall, defineChain, waitForReceipt, Engine } from 'thirdweb';

// ============================================================================
// Types
// ============================================================================

export interface GetNonceResult {
  nonce: string;
  chain: string;
  chainId: number;
  easAddress: string;
}

/** Payload sent by the client (matches SDK's submitDelegatedAttestation body) */
export interface DelegatedAttestationParams {
  prepared: PrepareDelegatedAttestationResult;
  signature: string;
  attester: string;
}

export interface DelegatedAttestationResult {
  success: true;
  txHash: string;
  uid: string | null;
  blockNumber: number;
  chain: string;
}

export class EasRouteError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'EasRouteError';
  }
}

// ============================================================================
// Shared Utilities
// ============================================================================

/**
 * Get active chain configuration from environment
 */
export function getActiveChain() {
  const activeChain = process.env.NEXT_PUBLIC_ACTIVE_CHAIN;
  
  switch (activeChain) {
    case 'omachain-testnet':
      return omachainTestnet;
    case 'omachain-mainnet':
      return omachainMainnet;
    default:
      return omachainTestnet; // Fallback to testnet
  }
}

/**
 * Check if we're on mainnet
 */
export function isMainnet(): boolean {
  return process.env.NEXT_PUBLIC_ACTIVE_CHAIN === 'omachain-mainnet';
}

// EAS ABI fragments
const EAS_READ_ABI = [
  'function getNonce(address account) view returns (uint256)',
  'function getSchemaRegistry() view returns (address)'
];

const EAS_WRITE_ABI = [
  {
    "inputs": [
      {
        "components": [
          { "name": "schema", "type": "bytes32" },
          {
            "components": [
              { "name": "recipient", "type": "address" },
              { "name": "expirationTime", "type": "uint64" },
              { "name": "revocable", "type": "bool" },
              { "name": "refUID", "type": "bytes32" },
              { "name": "data", "type": "bytes" },
              { "name": "value", "type": "uint256" }
            ],
            "name": "data",
            "type": "tuple"
          },
          {
            "components": [
              { "name": "v", "type": "uint8" },
              { "name": "r", "type": "bytes32" },
              { "name": "s", "type": "bytes32" }
            ],
            "name": "signature",
            "type": "tuple"
          },
          { "name": "attester", "type": "address" },
          { "name": "deadline", "type": "uint64" }
        ],
        "name": "delegatedRequest",
        "type": "tuple"
      }
    ],
    "name": "attestByDelegation",
    "outputs": [{ "name": "", "type": "bytes32" }],
    "stateMutability": "payable",
    "type": "function"
  }
];

// ============================================================================
// Nonce Lookup
// ============================================================================

/**
 * Get the current EAS nonce for an attester address.
 *
 * @throws EasRouteError on validation or RPC failure
 */
export async function getNonce(attester: string): Promise<GetNonceResult> {
  if (!attester) {
    throw new EasRouteError('Missing required parameter: attester', 400);
  }

  if (!isAddress(attester)) {
    throw new EasRouteError('Invalid attester address format', 400);
  }

  const chainConfig = getActiveChain();
  const chainId = chainConfig.id;
  const easAddress = getContractAddress('eas', chainId);

  if (!easAddress) {
    throw new EasRouteError(`EAS not configured for chain ${chainId}`, 500);
  }

  const provider = new JsonRpcProvider(chainConfig.rpc);
  const easContract = new Contract(easAddress, EAS_READ_ABI, provider);

  try {
    const nonce = await easContract.getNonce(attester);
    
    return {
      nonce: nonce.toString(),
      chain: chainConfig.name,
      chainId,
      easAddress,
    };
  } catch (error: any) {
    throw new EasRouteError(
      error?.reason || error?.message || 'Failed to fetch nonce from RPC',
      500
    );
  }
}

// ============================================================================
// Delegated Attestation
// ============================================================================

// Simple in-memory idempotency cache.
// In serverless environments each instance has its own cache.
// Acceptable because EAS itself rejects duplicate signatures.
const processedSignatures = new Map<string, number>();

function cleanIdempotencyCache() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [key, timestamp] of processedSignatures) {
    if (timestamp < oneHourAgo) {
      processedSignatures.delete(key);
    }
  }
}

/**
 * Submit a delegated attestation to EAS.
 *
 * Accepts the SDK's PrepareDelegatedAttestationResult (via `prepared`),
 * verifies the signature, checks schema eligibility, and submits
 * the attestation on-chain on behalf of the attester.
 *
 * @throws EasRouteError on validation or submission failure
 */
export async function submitDelegatedAttestation(
  params: DelegatedAttestationParams
): Promise<DelegatedAttestationResult> {
  const { prepared, signature, attester } = params;

  // Get chain configuration
  const chainConfig = getActiveChain();
  const chainId = chainConfig.id;
  const easAddress = getContractAddress('eas', chainId);
  const maxGas = Number(process.env.MAX_GAS_PER_TX || 800000);

  console.log(`[delegated-attest] Active chain: ${chainConfig.name} (${chainId})`);

  if (!easAddress) {
    throw new EasRouteError(`EAS not configured for chain ${chainId}`, 500);
  }

  // 1. Validate request payload
  if (!prepared || !signature || !attester) {
    throw new EasRouteError('Missing required fields: prepared, signature, attester', 400);
  }

  const req = prepared.delegatedRequest;
  const schemaUid = (req.schema ?? req.schemaUid) as string;

  if (!schemaUid) {
    throw new EasRouteError('Missing schema in prepared.delegatedRequest', 400);
  }

  // 2. Check schema allowlist
  if (!isSubsidizedSchema(chainId, schemaUid)) {
    throw new EasRouteError('Schema not eligible for gas subsidy', 403, 'SCHEMA_NOT_SUBSIDIZED');
  }

  // 3. Check deadline
  const now = Math.floor(Date.now() / 1000);
  const deadline = Number(req.deadline ?? 0);
  if (deadline < now) {
    throw new EasRouteError('Signature expired', 400, 'SIGNATURE_EXPIRED');
  }

  // 4. Fetch nonce for attester from EAS contract (authoritative, not from client)
  const provider = new JsonRpcProvider(chainConfig.rpc);
  const easReadOnly = new Contract(easAddress, EAS_READ_ABI, provider);
  
  let nonce: bigint;
  try {
    nonce = await easReadOnly.getNonce(attester);
    console.log(`[delegated-attest] Fetched nonce for attester ${attester}: ${nonce}`);
  } catch (error: any) {
    throw new EasRouteError(
      `Failed to fetch nonce: ${error?.message || 'RPC error'}`,
      500
    );
  }

  // Debug: Check schema registry
  try {
    const schemaRegistryAddr = await easReadOnly.getSchemaRegistry();
    console.log(`[delegated-attest] Schema Registry: ${schemaRegistryAddr}`);
    
    const schemaRegistry = new Contract(
      schemaRegistryAddr,
      ['function getSchema(bytes32 uid) view returns (tuple(bytes32 uid, address resolver, bool revocable, string schema))'],
      provider
    );
    const schemaRecord = await schemaRegistry.getSchema(schemaUid);
    console.log(`[delegated-attest] Schema record:`, {
      uid: schemaRecord.uid,
      resolver: schemaRecord.resolver,
      revocable: schemaRecord.revocable,
      schema: schemaRecord.schema
    });
  } catch (schemaError: any) {
    console.error(`[delegated-attest] Schema lookup failed:`, schemaError?.message);
  }

  // 5. Verify signature by independently rebuilding typed data server-side.
  //    Uses buildDelegatedTypedDataFromEncoded with the server-fetched nonce
  //    so we don't trust the client's nonce or typed data.
  const msg = prepared.typedData.message as Record<string, unknown>;
  const typedData = buildDelegatedTypedDataFromEncoded({
    chainId,
    easContractAddress: easAddress as Hex,
    schemaUid: schemaUid as Hex,
    encodedData: msg.data as Hex,
    recipient: msg.recipient as Hex,
    attester: attester as Hex,
    nonce,
    revocable: msg.revocable as boolean,
    expirationTime: msg.expirationTime != null ? BigInt(msg.expirationTime as string | number) : undefined,
    refUid: msg.refUID as Hex | undefined,
    value: msg.value != null ? BigInt(msg.value as string | number) : undefined,
    deadline: BigInt(deadline),
  });

  let recovered: string;
  try {
    recovered = verifyTypedData(
      typedData.domain as Record<string, unknown>,
      typedData.types as Record<string, Array<{ name: string; type: string }>>,
      typedData.message,
      signature
    );
  } catch (error) {
    console.error('[delegated-attest] Signature verification failed:', error);
    throw new EasRouteError('Invalid signature format', 400, 'INVALID_SIGNATURE');
  }

  if (recovered.toLowerCase() !== attester.toLowerCase()) {
    throw new EasRouteError('Invalid signature - attester mismatch', 400, 'ATTESTER_MISMATCH');
  }

  // 6. Idempotency check (prevent replay)
  cleanIdempotencyCache();
  const sigHash = keccak256(toUtf8Bytes(signature));
  if (processedSignatures.has(sigHash)) {
    throw new EasRouteError('Duplicate submission', 409, 'DUPLICATE');
  }
  processedSignatures.set(sigHash, Date.now());

  // 7. Submit to EAS
  if (isMainnet()) {
    throw new EasRouteError('Mainnet delegated attestations not yet available', 501, 'MAINNET_NOT_SUPPORTED');
  }

  const { v, r, s } = splitSignature(signature);

  // Build the on-chain DelegatedAttestationRequest struct from server-rebuilt typed data
  const builtMsg = typedData.message as Record<string, unknown>;
  const delegatedRequest = {
    schema: schemaUid,
    data: {
      recipient: builtMsg.recipient as string,
      expirationTime: BigInt(builtMsg.expirationTime as string | number | bigint ?? 0),
      revocable: builtMsg.revocable as boolean,
      refUID: builtMsg.refUID as string,
      data: builtMsg.data as string,
      value: BigInt(builtMsg.value as string | number | bigint ?? 0),
    },
    signature: { v, r, s },
    attester,
    deadline: BigInt(deadline),
  };

  console.log(`[delegated-attest] Submitting attestation on ${chainConfig.name}`);
  console.log(`[delegated-attest] EAS Contract address: ${easAddress}`);
  console.log(`[delegated-attest] Attester: ${attester}`);
  console.log(`[delegated-attest] Schema: ${schemaUid}`);

  // Submit via Thirdweb server wallet if configured, otherwise fall back to private key
  let txHash: string;
  let blockNumber: number;
  let logs: Array<{ topics: readonly string[]; data: string }>;

  const managedWallet = getThirdwebManagedWallet();

  if (managedWallet) {
    // Thirdweb server wallet path — private key never leaves Vault
    console.log(`[delegated-attest] Using Thirdweb server wallet: ${managedWallet.walletAddress}`);

    const client = createThirdwebClient({ secretKey: managedWallet.secretKey });
    const chain = defineChain({ id: chainConfig.id, rpc: chainConfig.rpc });

    const easContract = getContract({ client, chain, address: easAddress });
    const serverWallet = Engine.serverWallet({
      client,
      address: managedWallet.walletAddress,
      executionOptions: { type: 'EOA', from: managedWallet.walletAddress },
    });

    const transaction = prepareContractCall({
      contract: easContract,
      method: 'function attestByDelegation((bytes32 schema, (address recipient, uint64 expirationTime, bool revocable, bytes32 refUID, bytes data, uint256 value) data, (uint8 v, bytes32 r, bytes32 s) signature, address attester, uint64 deadline) delegatedRequest) payable returns (bytes32)',
      params: [delegatedRequest as any],
      gas: BigInt(maxGas),
    });

    const { transactionId } = await serverWallet.enqueueTransaction({ transaction });
    console.log(`[delegated-attest] Enqueued transaction: ${transactionId}`);

    const txResult = await Engine.waitForTransactionHash({ client, transactionId });
    console.log(`[delegated-attest] Transaction sent: ${txResult.transactionHash}`);

    const receipt = await waitForReceipt({ client, chain, transactionHash: txResult.transactionHash });
    console.log(`[delegated-attest] Transaction confirmed in block ${receipt.blockNumber}`);

    txHash = receipt.transactionHash;
    blockNumber = Number(receipt.blockNumber);
    logs = receipt.logs as Array<{ topics: readonly string[]; data: string }>;
  } else {
    // Fallback: direct private key signing via ethers
    console.log('[delegated-attest] Using private key fallback');

    let delegateKey: `0x${string}`;
    try {
      delegateKey = loadEasDelegatePrivateKey();
    } catch (error) {
      console.error('[delegated-attest] Failed to load EAS delegate key:', error);
      throw new EasRouteError('Server misconfigured - no server wallet or delegate key available', 500, 'NO_DELEGATE_KEY');
    }

    const easDelegate = new Wallet(delegateKey, provider);
    const eas = new Contract(easAddress, EAS_WRITE_ABI, easDelegate);
    console.log(`[delegated-attest] EAS Delegate address: ${easDelegate.address}`);

    let gasLimit = maxGas;
    try {
      const gasEstimate = await eas.attestByDelegation.estimateGas(delegatedRequest);
      console.log(`[delegated-attest] Gas estimate: ${gasEstimate}`);
      const estimateWithBuffer = (BigInt(gasEstimate) * BigInt(120)) / BigInt(100);
      const maxLimit = BigInt(1000000);
      gasLimit = Number(estimateWithBuffer < maxLimit ? estimateWithBuffer : maxLimit);
    } catch (estimateError: any) {
      console.error(`[delegated-attest] Gas estimation failed:`, estimateError?.reason || estimateError?.message);
    }

    const tx = await eas.attestByDelegation(delegatedRequest, { gasLimit });
    console.log(`[delegated-attest] Transaction sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[delegated-attest] Transaction confirmed in block ${receipt.blockNumber}`);

    txHash = receipt.hash;
    blockNumber = receipt.blockNumber;
    logs = receipt.logs;
  }

  // Parse attestation UID from logs (shared by both paths)
  // Attested event: Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaUID)
  // uid is non-indexed → first 32 bytes of log data (not in topics)
  // topics[0] = event sig, topics[1] = recipient, topics[2] = attester, topics[3] = schemaUID
  const ATTESTED_EVENT_TOPIC = '0x8bf46bf4cfd674fa735a3d63ec1c9ad4153f033c290341f3a588b75685141b35';
  let uid: string | null = null;
  for (const log of logs) {
    if (log.topics[0] === ATTESTED_EVENT_TOPIC) {
      // uid is the only non-indexed param → first 32 bytes of data
      uid = log.data.slice(0, 66) ?? null; // 0x + 64 hex chars
      break;
    }
  }

  return {
    success: true,
    txHash,
    uid,
    blockNumber,
    chain: chainConfig.name,
  };
}
