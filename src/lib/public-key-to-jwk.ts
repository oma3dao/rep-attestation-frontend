/**
 * Public Key → did:jwk Converter
 *
 * Client-side utility that converts a public key in any of several formats
 * into a JWK and then into a did:jwk identifier.
 *
 * Supported input formats (auto-detected):
 * - PEM SPKI (-----BEGIN PUBLIC KEY-----)
 * - PEM X.509 certificate (-----BEGIN CERTIFICATE-----)
 * - JWK JSON object with "kty" field
 * - did:jwk (passthrough)
 * - did:key (Ed25519/X25519 only — converted via SDK)
 * - Raw hex (secp256k1 compressed/uncompressed public key)
 * - Base64url-encoded JWK (raw did:jwk payload)
 *
 * Private key material is REJECTED with a thrown error.
 */

import { importSPKI, importX509, exportJWK } from "jose"
import { secp256k1 } from "@noble/curves/secp256k1"
import {
  jwkToDidJwk,
  didKeyToDidJwk,
  didJwkToJwk,
  validatePublicJwk,
} from "@oma3/omatrust/identity"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DetectedFormat =
  | "pem-spki"
  | "pem-x509"
  | "pem-pkcs1-rsa"
  | "jwk-json"
  | "did-jwk"
  | "did-key"
  | "hex-secp256k1"
  | "base64url-jwk"
  | "ssh-pubkey"
  | "unknown"

export type ConversionResult = {
  jwk: Record<string, unknown>
  did: string
  detectedFormat: DetectedFormat
  keyDescription: string
}

export class PublicKeyConversionError extends Error {
  constructor(message: string, public code: string = "CONVERSION_ERROR") {
    super(message)
    this.name = "PublicKeyConversionError"
  }
}

// ---------------------------------------------------------------------------
// Private key detection
// ---------------------------------------------------------------------------

const PRIVATE_PEM_HEADERS = [
  "PRIVATE KEY",
  "RSA PRIVATE KEY",
  "EC PRIVATE KEY",
  "OPENSSH PRIVATE KEY",
  "BEGIN PGP PRIVATE KEY",
]

const PRIVATE_JWK_FIELDS = ["d", "p", "q", "dp", "dq", "qi", "k"]

function assertNotPrivateKey(input: string): void {
  const upper = input.toUpperCase()
  for (const header of PRIVATE_PEM_HEADERS) {
    if (upper.includes(header)) {
      throw new PublicKeyConversionError(
        "Input contains private key material. Only public keys are accepted.",
        "PRIVATE_KEY_REJECTED"
      )
    }
  }
}

function assertNotPrivateJwk(jwk: Record<string, unknown>): void {
  for (const field of PRIVATE_JWK_FIELDS) {
    if (field in jwk) {
      throw new PublicKeyConversionError(
        `JWK contains private key field "${field}". Only public keys are accepted.`,
        "PRIVATE_KEY_REJECTED"
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

export function detectFormat(input: string): DetectedFormat {
  const trimmed = input.trim()

  // PEM formats
  if (trimmed.includes("-----BEGIN PUBLIC KEY-----")) return "pem-spki"
  if (trimmed.includes("-----BEGIN CERTIFICATE-----")) return "pem-x509"
  if (trimmed.includes("-----BEGIN RSA PUBLIC KEY-----")) return "pem-pkcs1-rsa"

  // DID formats
  if (trimmed.startsWith("did:jwk:")) return "did-jwk"
  if (trimmed.startsWith("did:key:")) return "did-key"

  // SSH public key formats
  if (trimmed.startsWith("ssh-ed25519 ") ||
      trimmed.startsWith("ssh-rsa ") ||
      trimmed.startsWith("ecdsa-sha2-")) return "ssh-pubkey"

  // JWK JSON (try to parse)
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed === "object" && "kty" in parsed) return "jwk-json"
    } catch {
      // not valid JSON
    }
  }

  // Hex (secp256k1 compressed 33 bytes or uncompressed 65 bytes)
  const hexClean = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed
  if (/^[0-9a-fA-F]+$/.test(hexClean)) {
    if (hexClean.length === 66 && (hexClean.startsWith("02") || hexClean.startsWith("03"))) {
      return "hex-secp256k1"
    }
    if (hexClean.length === 130 && hexClean.startsWith("04")) {
      return "hex-secp256k1"
    }
  }

  // Base64url that decodes to a JWK
  if (/^[A-Za-z0-9_-]+$/.test(trimmed) && trimmed.length > 20) {
    try {
      const decoded = atob(trimmed.replace(/-/g, "+").replace(/_/g, "/"))
      const parsed = JSON.parse(decoded)
      if (parsed && typeof parsed === "object" && "kty" in parsed) return "base64url-jwk"
    } catch {
      // not base64url JWK
    }
  }

  return "unknown"
}

// ---------------------------------------------------------------------------
// Key description helpers
// ---------------------------------------------------------------------------

function describeJwk(jwk: Record<string, unknown>): string {
  const kty = jwk.kty as string
  if (kty === "EC") {
    const crv = (jwk.crv as string) ?? "unknown curve"
    return `EC ${crv} key`
  }
  if (kty === "OKP") {
    const crv = (jwk.crv as string) ?? "unknown curve"
    return `${crv} key`
  }
  if (kty === "RSA") {
    const n = jwk.n as string | undefined
    if (n) {
      // Estimate bit length from base64url-encoded modulus
      const bits = Math.ceil((n.length * 6) / 8) * 8
      return `RSA ${bits}-bit key`
    }
    return "RSA key"
  }
  return `${kty} key`
}

// ---------------------------------------------------------------------------
// Conversion logic per format
// ---------------------------------------------------------------------------

async function convertPemSpki(pem: string): Promise<Record<string, unknown>> {
  const cryptoKey = await importSPKI(pem.trim(), "ES256", { extractable: true })
  return await exportJWK(cryptoKey) as Record<string, unknown>
}

async function convertPemX509(pem: string): Promise<Record<string, unknown>> {
  const cryptoKey = await importX509(pem.trim(), "ES256", { extractable: true })
  return await exportJWK(cryptoKey) as Record<string, unknown>
}

function convertJwkJson(input: string): Record<string, unknown> {
  const jwk = JSON.parse(input.trim()) as Record<string, unknown>
  assertNotPrivateJwk(jwk)
  const validation = validatePublicJwk(jwk)
  if (!validation.valid) {
    throw new PublicKeyConversionError(
      validation.error ?? "Invalid public JWK",
      "INVALID_JWK"
    )
  }
  // Strip non-public fields for canonical output
  return stripToPublic(jwk)
}

function convertDidJwk(input: string): Record<string, unknown> {
  const jwk = didJwkToJwk(input.trim()) as Record<string, unknown>
  assertNotPrivateJwk(jwk)
  return jwk
}

function convertDidKey(input: string): { jwk: Record<string, unknown>; did: string } {
  // SDK converts did:key → did:jwk, then we extract the JWK
  const didJwk = didKeyToDidJwk(input.trim())
  const jwk = didJwkToJwk(didJwk) as Record<string, unknown>
  return { jwk, did: didJwk }
}

function convertHexSecp256k1(input: string): Record<string, unknown> {
  const hexClean = input.trim().startsWith("0x") ? input.trim().slice(2) : input.trim()
  const bytes = hexToBytes(hexClean)

  // Validate point on curve by getting the affine coordinates
  const point = secp256k1.ProjectivePoint.fromHex(bytes)
  const affine = point.toAffine()

  // Build JWK manually (secp256k1 uses 32-byte coordinates)
  const x = bigIntToBase64url(affine.x, 32)
  const y = bigIntToBase64url(affine.y, 32)

  return {
    kty: "EC",
    crv: "secp256k1",
    x,
    y,
  }
}

function convertBase64urlJwk(input: string): Record<string, unknown> {
  const decoded = atob(input.trim().replace(/-/g, "+").replace(/_/g, "/"))
  const jwk = JSON.parse(decoded) as Record<string, unknown>
  assertNotPrivateJwk(jwk)
  const validation = validatePublicJwk(jwk)
  if (!validation.valid) {
    throw new PublicKeyConversionError(
      validation.error ?? "Invalid public JWK in base64url payload",
      "INVALID_JWK"
    )
  }
  return stripToPublic(jwk)
}

// ---------------------------------------------------------------------------
// SSH public key conversion
// ---------------------------------------------------------------------------

const SSH_CURVE_MAP: Record<string, { crv: string; byteLen: number }> = {
  "nistp256": { crv: "P-256", byteLen: 32 },
  "nistp384": { crv: "P-384", byteLen: 48 },
  "nistp521": { crv: "P-521", byteLen: 66 },
}

function convertSshPubkey(input: string): Record<string, unknown> {
  const parts = input.trim().split(/\s+/)
  if (parts.length < 2) {
    throw new PublicKeyConversionError("Invalid SSH public key format", "INVALID_SSH_KEY")
  }

  const keyType = parts[0]!
  const b64Data = parts[1]!

  // Decode the base64 payload
  const raw = Uint8Array.from(atob(b64Data), (c) => c.charCodeAt(0))

  // SSH wire format: repeated [uint32 length][data] fields
  let offset = 0

  function readString(): Uint8Array {
    if (offset + 4 > raw.length) throw new PublicKeyConversionError("Truncated SSH key data", "INVALID_SSH_KEY")
    const len = (raw[offset]! << 24) | (raw[offset + 1]! << 16) | (raw[offset + 2]! << 8) | raw[offset + 3]!
    offset += 4
    if (offset + len > raw.length) throw new PublicKeyConversionError("Truncated SSH key data", "INVALID_SSH_KEY")
    const data = raw.slice(offset, offset + len)
    offset += len
    return data
  }

  // First field: key type string (must match the prefix)
  const typeField = new TextDecoder().decode(readString())
  if (typeField !== keyType) {
    throw new PublicKeyConversionError(
      `SSH key type mismatch: header says "${keyType}" but payload says "${typeField}"`,
      "INVALID_SSH_KEY"
    )
  }

  if (keyType === "ssh-ed25519") {
    // Second field: 32-byte Ed25519 public key
    const pubkey = readString()
    if (pubkey.length !== 32) {
      throw new PublicKeyConversionError(
        `Expected 32-byte Ed25519 key, got ${pubkey.length} bytes`,
        "INVALID_SSH_KEY"
      )
    }
    return {
      kty: "OKP",
      crv: "Ed25519",
      x: bytesToBase64url(pubkey),
    }
  }

  if (keyType.startsWith("ecdsa-sha2-")) {
    // Second field: curve identifier (e.g., "nistp256")
    const curveId = new TextDecoder().decode(readString())
    const curveInfo = SSH_CURVE_MAP[curveId]
    if (!curveInfo) {
      throw new PublicKeyConversionError(
        `Unsupported SSH ECDSA curve: ${curveId}`,
        "UNSUPPORTED_FORMAT"
      )
    }
    // Third field: uncompressed EC point (0x04 || x || y)
    const point = readString()
    if (point[0] !== 0x04) {
      throw new PublicKeyConversionError("Expected uncompressed EC point (0x04 prefix)", "INVALID_SSH_KEY")
    }
    const coordLen = curveInfo.byteLen
    if (point.length !== 1 + coordLen * 2) {
      throw new PublicKeyConversionError(
        `Expected ${1 + coordLen * 2} byte EC point for ${curveInfo.crv}, got ${point.length}`,
        "INVALID_SSH_KEY"
      )
    }
    const x = point.slice(1, 1 + coordLen)
    const y = point.slice(1 + coordLen)
    return {
      kty: "EC",
      crv: curveInfo.crv,
      x: bytesToBase64url(x),
      y: bytesToBase64url(y),
    }
  }

  if (keyType === "ssh-rsa") {
    // Second field: public exponent (e)
    const eBuf = readString()
    // Third field: modulus (n)
    const nBuf = readString()
    return {
      kty: "RSA",
      e: bytesToBase64url(eBuf),
      n: bytesToBase64url(nBuf),
    }
  }

  throw new PublicKeyConversionError(
    `Unsupported SSH key type: ${keyType}. Supported: ssh-ed25519, ecdsa-sha2-*, ssh-rsa.`,
    "UNSUPPORTED_FORMAT"
  )
}

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

function bigIntToBase64url(value: bigint, byteLength: number): string {
  let hex = value.toString(16)
  hex = hex.padStart(byteLength * 2, "0")
  const bytes = hexToBytes(hex)
  // Convert to base64url
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

const PUBLIC_FIELDS: Record<string, string[]> = {
  EC: ["kty", "crv", "x", "y"],
  OKP: ["kty", "crv", "x"],
  RSA: ["kty", "n", "e"],
}

function stripToPublic(jwk: Record<string, unknown>): Record<string, unknown> {
  const kty = jwk.kty as string
  const allowed = PUBLIC_FIELDS[kty]
  if (!allowed) return jwk
  const result: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in jwk) result[key] = jwk[key]
  }
  return result
}

// ---------------------------------------------------------------------------
// Main conversion function
// ---------------------------------------------------------------------------

/**
 * Convert a public key in any supported format to a did:jwk identifier.
 *
 * @param input - The public key as a string (PEM, JWK JSON, hex, DID, or base64url)
 * @returns The JWK, the did:jwk string, the detected format, and a human-readable description
 * @throws PublicKeyConversionError if input is invalid, private, or unsupported
 */
export async function convertToDidJwk(input: string): Promise<ConversionResult> {
  if (!input || !input.trim()) {
    throw new PublicKeyConversionError("Input is empty", "INVALID_INPUT")
  }

  const trimmed = input.trim()

  // Reject private key material early
  assertNotPrivateKey(trimmed)

  // Detect PGP
  if (trimmed.includes("-----BEGIN PGP")) {
    throw new PublicKeyConversionError("PGP keys are not supported", "UNSUPPORTED_FORMAT")
  }

  const format = detectFormat(trimmed)

  let jwk: Record<string, unknown>
  let did: string | undefined

  switch (format) {
    case "pem-spki":
      jwk = await convertPemSpki(trimmed)
      break

    case "pem-x509":
      jwk = await convertPemX509(trimmed)
      break

    case "pem-pkcs1-rsa":
      throw new PublicKeyConversionError(
        "PKCS#1 RSA format is not directly supported. Convert to SPKI (BEGIN PUBLIC KEY) first.",
        "UNSUPPORTED_FORMAT"
      )

    case "jwk-json":
      jwk = convertJwkJson(trimmed)
      break

    case "did-jwk":
      jwk = convertDidJwk(trimmed)
      did = trimmed
      break

    case "did-key": {
      const result = convertDidKey(trimmed)
      jwk = result.jwk
      did = result.did
      break
    }

    case "hex-secp256k1":
      jwk = convertHexSecp256k1(trimmed)
      break

    case "base64url-jwk":
      jwk = convertBase64urlJwk(trimmed)
      break

    case "ssh-pubkey":
      jwk = convertSshPubkey(trimmed)
      break

    case "unknown":
      throw new PublicKeyConversionError(
        "Could not detect key format. Supported: PEM (SPKI/X.509), JWK JSON, SSH public key, did:jwk, did:key, hex (secp256k1), or base64url-encoded JWK.",
        "UNRECOGNIZED_FORMAT"
      )
  }

  // If we don't already have a did:jwk, produce one
  if (!did) {
    did = jwkToDidJwk(jwk)
  }

  return {
    jwk,
    did,
    detectedFormat: format,
    keyDescription: describeJwk(jwk),
  }
}
