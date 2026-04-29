/**
 * Server-side utility for loading EAS delegate private key
 * Used by API routes for signing delegated attestation transactions
 * 
 * Note: This only returns a private key for direct signing.
 * Check for Thirdweb Managed Vault separately (different signing flow).
 * 
 * Priority:
 * 1. EAS_DELEGATE_PRIVATE_KEY env var (Vercel/deployment - simple testnet approach)
 * 2. SSH file ~/.ssh/local-attestation-key (local dev - shared with app-registry-frontend)
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Check if Thirdweb Managed Vault is configured for EAS delegation
 * Returns wallet address if available, null otherwise
 */
export function getThirdwebManagedWallet(): { secretKey: string; walletAddress: string } | null {
  const secretKey = process.env.THIRDWEB_SECRET_KEY;
  const walletAddress = process.env.THIRDWEB_SERVER_WALLET_ADDRESS;

  if (secretKey && walletAddress) {
    console.log('[eas-delegate-key] Thirdweb Managed Vault configured');
    return { secretKey, walletAddress };
  }

  return null;
}

export function loadEasDelegatePrivateKey(): `0x${string}` {
  // 1. Check environment variable first (for Vercel/deployment)
  if (process.env.EAS_DELEGATE_PRIVATE_KEY) {
    const envKey = process.env.EAS_DELEGATE_PRIVATE_KEY.trim();
    const privateKey = envKey.startsWith('0x') ? envKey : `0x${envKey}`;
    
    // Validate format
    if (privateKey.length !== 66 || !/^0x[0-9a-fA-F]{64}$/i.test(privateKey)) {
      throw new Error(
        `Invalid EAS_DELEGATE_PRIVATE_KEY format. Expected 0x + 64 hex chars, got: ${privateKey.length} chars`
      );
    }
    
    console.log('[eas-delegate-key] Using EAS_DELEGATE_PRIVATE_KEY from environment');
    return privateKey as `0x${string}`;
  }
  
  // 2. Fall back to SSH file (for local dev - shared with app-registry-frontend)
  const sshKeyPath = path.join(os.homedir(), '.ssh', 'local-attestation-key');
  
  if (!fs.existsSync(sshKeyPath)) {
    throw new Error(
      `No private key found. Either:\n` +
      `1. Set EAS_DELEGATE_PRIVATE_KEY environment variable, or\n` +
      `2. Create key file: node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))" > ~/.ssh/local-attestation-key && chmod 600 ~/.ssh/local-attestation-key`
    );
  }
  
  const keyContent = fs.readFileSync(sshKeyPath, 'utf8')
    .trim()
    .replace(/\s+/g, '') // Remove all whitespace
    .toLowerCase(); // Normalize to lowercase
  
  // Ensure 0x prefix
  const privateKey = keyContent.startsWith('0x') ? keyContent : `0x${keyContent}`;
  
  // Validate: should be 0x + 64 hex chars = 66 chars total
  if (privateKey.length !== 66 || !/^0x[0-9a-f]{64}$/.test(privateKey)) {
    throw new Error(
      `Invalid private key format in ${sshKeyPath}. Expected 0x + 64 hex chars, got: ${privateKey.length} chars`
    );
  }
  
  console.log('[eas-delegate-key] Loaded private key from SSH file');
  return privateKey as `0x${string}`;
}

/**
 * Alternative key loader that returns null on error instead of throwing
 * Used for graceful fallback in server routes
 */
export async function loadEasDelegatePrivateKeyOrNull(): Promise<string | null> {
  try {
    return loadEasDelegatePrivateKey();
  } catch (error) {
    console.log('[eas-delegate-key] Could not load private key:', (error as Error).message);
    return null;
  }
}
