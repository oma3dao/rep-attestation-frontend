/**
 * Delegated Attestation API Route
 * 
 * Accepts signed EIP-712 attestation data and relays it to EAS,
 * paying gas on behalf of the attester for subsidized schemas.
 */

import { NextRequest, NextResponse } from 'next/server';
import { keccak256, toUtf8Bytes, verifyTypedData, JsonRpcProvider, Wallet, Contract } from 'ethers';
import { getContractAddress } from '@/config/attestation-services';
import { omachainTestnet, omachainMainnet } from '@/config/chains';
import { isSubsidizedSchema } from '@/config/subsidized-schemas';
import { buildDelegatedAttestationTypedData, splitSignature } from '@/lib/eas';
import { loadEasDelegatePrivateKey } from '@/lib/server/eas-delegate-key';

// Force Node.js runtime (required for fs access in relayer-key.ts)
export const runtime = 'nodejs';

// EAS ABI - only the attestByDelegation function we need
// Note: This takes a single DelegatedAttestationRequest struct containing all fields
const EAS_ABI = [
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

// Simple in-memory idempotency cache
// Note: In serverless environments, each instance has its own cache.
// This is acceptable because EAS itself rejects duplicate signatures.
// The cache just saves gas by catching duplicates before hitting the chain.
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
 * Get active chain from environment
 */
function getActiveChain() {
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
 * Check if we're on mainnet (requires Thirdweb Server Wallet)
 */
function isMainnet(): boolean {
  return process.env.NEXT_PUBLIC_ACTIVE_CHAIN === 'omachain-mainnet';
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log('[delegated-attest] ========== REQUEST RECEIVED ==========');
  console.log('[delegated-attest] Method:', req.method);
  console.log('[delegated-attest] URL:', req.url);
  
  try {
    console.log('[delegated-attest] Parsing request body...');
    const body = await req.json();
    console.log('[delegated-attest] Body parsed successfully');
    console.log('[delegated-attest] Keys in body:', Object.keys(body));
    const { delegated, signature, attester } = body;

    // Get chain from environment (not from request)
    const chainConfig = getActiveChain();
    const chainId = chainConfig.id;
    const easAddress = getContractAddress('eas', chainId);
    const maxGas = Number(process.env.MAX_GAS_PER_TX || 800000);

    console.log(`[delegated-attest] Active chain: ${chainConfig.name} (${chainId})`);

    if (!easAddress) {
      return NextResponse.json(
        { error: `EAS not configured for chain ${chainId}` },
        { status: 500 }
      );
    }

    // 1. Validate request payload
    if (!delegated || !signature || !attester) {
      return NextResponse.json(
        { error: 'Missing required fields: delegated, signature, attester' },
        { status: 400 }
      );
    }

    // 2. Check schema allowlist
    if (!isSubsidizedSchema(chainId, delegated.schema)) {
      return NextResponse.json(
        { error: 'Schema not eligible for gas subsidy' },
        { status: 403 }
      );
    }

    // 3. Check deadline
    const now = Math.floor(Date.now() / 1000);
    if (Number(delegated.deadline) < now) {
      return NextResponse.json(
        { error: 'Signature expired' },
        { status: 400 }
      );
    }

    // 4. Fetch nonce for attester from EAS contract
    const provider = new JsonRpcProvider(chainConfig.rpc);
    const easReadOnly = new Contract(
      easAddress,
      [
        'function getNonce(address account) view returns (uint256)',
        'function getSchemaRegistry() view returns (address)'
      ],
      provider
    );
    const nonce = await easReadOnly.getNonce(attester);
    console.log(`[delegated-attest] Fetched nonce for attester ${attester}: ${nonce}`);

    // Debug: Check schema registry
    try {
      const schemaRegistryAddr = await easReadOnly.getSchemaRegistry();
      console.log(`[delegated-attest] Schema Registry: ${schemaRegistryAddr}`);
      
      const schemaRegistry = new Contract(
        schemaRegistryAddr,
        ['function getSchema(bytes32 uid) view returns (tuple(bytes32 uid, address resolver, bool revocable, string schema))'],
        provider
      );
      const schemaRecord = await schemaRegistry.getSchema(delegated.schema);
      console.log(`[delegated-attest] Schema record:`, {
        uid: schemaRecord.uid,
        resolver: schemaRecord.resolver,
        revocable: schemaRecord.revocable,
        schema: schemaRecord.schema
      });
    } catch (schemaError: any) {
      console.error(`[delegated-attest] Schema lookup failed:`, schemaError?.message);
    }

    // 5. Verify signature and recover attester (with nonce)
    const typedData = buildDelegatedAttestationTypedData(
      chainId,
      easAddress as `0x${string}`,
      delegated,
      attester as `0x${string}`,
      BigInt(nonce)
    );

    let recovered: string;
    try {
      recovered = verifyTypedData(
        typedData.domain,
        typedData.types,
        typedData.message,
        signature
      );
    } catch (error) {
      console.error('[delegated-attest] Signature verification failed:', error);
      return NextResponse.json(
        { error: 'Invalid signature format' },
        { status: 400 }
      );
    }

    if (recovered.toLowerCase() !== attester.toLowerCase()) {
      return NextResponse.json(
        { error: 'Invalid signature - attester mismatch' },
        { status: 400 }
      );
    }

    // 5. Idempotency check (prevent replay)
    cleanIdempotencyCache();
    const sigHash = keccak256(toUtf8Bytes(signature));
    if (processedSignatures.has(sigHash)) {
      return NextResponse.json(
        { error: 'Duplicate submission' },
        { status: 409 }
      );
    }
    processedSignatures.set(sigHash, Date.now());

    // 6. Submit to EAS via relayer
    let txHash: string;
    let receipt: any;

    if (isMainnet()) {
      // MAINNET: Use Thirdweb Server Wallet (placeholder)
      // TODO: Implement Thirdweb Server Wallet integration
      console.log('[delegated-attest] Mainnet requires Thirdweb Server Wallet - not yet implemented');
      return NextResponse.json(
        { error: 'Mainnet delegated attestations not yet available' },
        { status: 501 }
      );
    } else {
      // TESTNET: Use private key from environment
      let delegateKey: `0x${string}`;
      try {
        delegateKey = loadEasDelegatePrivateKey();
      } catch (error) {
        console.error('[delegated-attest] Failed to load EAS delegate key:', error);
        return NextResponse.json(
          { error: 'Server misconfigured - EAS delegate key not available' },
          { status: 500 }
        );
      }

      const provider = new JsonRpcProvider(chainConfig.rpc);
      const easDelegate = new Wallet(delegateKey, provider);
      const eas = new Contract(easAddress, EAS_ABI, easDelegate);

      console.log(`[delegated-attest] Submitting attestation on ${chainConfig.name}`);
      console.log(`[delegated-attest] EAS Contract address: ${easAddress}`);
      console.log(`[delegated-attest] EAS Delegate address: ${easDelegate.address}`);
      console.log(`[delegated-attest] Attester: ${attester}`);
      console.log(`[delegated-attest] Schema: ${delegated.schema}`);
      console.log(`[delegated-attest] Recipient: ${delegated.recipient}`);
      console.log(`[delegated-attest] Expiration: ${delegated.expirationTime}`);
      console.log(`[delegated-attest] Revocable: ${delegated.revocable}`);
      console.log(`[delegated-attest] RefUID: ${delegated.refUID}`);
      console.log(`[delegated-attest] Data length: ${delegated.data?.length || 0}`);
      console.log(`[delegated-attest] Deadline: ${delegated.deadline}`);

      const { v, r, s } = splitSignature(signature);
      console.log(`[delegated-attest] Signature v=${v}, r=${r.slice(0,10)}..., s=${s.slice(0,10)}...`);

      // Build the DelegatedAttestationRequest struct (single parameter)
      const delegatedRequest = {
        schema: delegated.schema,
        data: {
          recipient: delegated.recipient,
          expirationTime: BigInt(delegated.expirationTime || 0),
          revocable: delegated.revocable,
          refUID: delegated.refUID,
          data: delegated.data,
          value: BigInt(0),
        },
        signature: { v, r, s },
        attester: attester,
        deadline: BigInt(delegated.deadline),
      };

      console.log(`[delegated-attest] DelegatedRequest:`, JSON.stringify(delegatedRequest, (_, v) => typeof v === 'bigint' ? v.toString() : v));

      // Debug: Log the typed data that was used for signing
      console.log(`[delegated-attest] TypedData domain:`, JSON.stringify(typedData.domain));
      console.log(`[delegated-attest] TypedData message:`, JSON.stringify(typedData.message, (_, v) => typeof v === 'bigint' ? v.toString() : v));
      
      // Debug: Verify signature matches before sending tx
      console.log(`[delegated-attest] Signature verification passed - recovered: ${recovered}`);

      // Try to estimate gas first to catch revert reason
      let gasLimit = maxGas;
      try {
        const gasEstimate = await eas.attestByDelegation.estimateGas(delegatedRequest);
        console.log(`[delegated-attest] Gas estimate: ${gasEstimate}`);
        // Use estimate + 20% buffer, but cap at a reasonable max
        const estimateWithBuffer = (BigInt(gasEstimate) * BigInt(120)) / BigInt(100);
        const maxLimit = BigInt(1000000);
        gasLimit = Number(estimateWithBuffer < maxLimit ? estimateWithBuffer : maxLimit);
        console.log(`[delegated-attest] Using gas limit: ${gasLimit}`);
      } catch (estimateError: any) {
        console.error(`[delegated-attest] Gas estimation failed:`, estimateError?.reason || estimateError?.message);
        // Continue with default gas limit
      }

      const tx = await eas.attestByDelegation(delegatedRequest, { gasLimit });

      console.log(`[delegated-attest] Transaction sent: ${tx.hash}`);
      receipt = await tx.wait();
      txHash = receipt.hash;
      console.log(`[delegated-attest] Transaction confirmed in block ${receipt.blockNumber}`);
    }

    // Parse attestation UID from logs (Attested event)
    let uid = null;
    for (const log of receipt.logs) {
      // Attested event topic: keccak256("Attested(address,address,bytes32,bytes32)")
      if (log.topics[0] === '0x8bf46bf4cfd674fa735a3d63ec1c9ad4153f033c290341f3a588b75685141b35') {
        uid = log.topics[1]; // First indexed param is the UID
        break;
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[delegated-attest] Success in ${elapsed}ms - UID: ${uid}`);

    return NextResponse.json({
      success: true,
      txHash,
      uid,
      blockNumber: receipt.blockNumber,
      chain: chainConfig.name,
      elapsed: `${elapsed}ms`,
    });

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[delegated-attest] Error after ${elapsed}ms:`, error);
    
    // Extract useful error message
    const errorMessage = error?.reason || error?.message || 'Internal error';
    
    return NextResponse.json(
      { error: errorMessage, elapsed: `${elapsed}ms` },
      { status: 500 }
    );
  }
}
