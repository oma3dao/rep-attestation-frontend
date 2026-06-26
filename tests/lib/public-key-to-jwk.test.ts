/**
 * Tests for the public-key-to-jwk converter.
 *
 * Each test generates a fresh key, converts it to various formats,
 * and verifies that all formats resolve to the same did:jwk.
 */

import { describe, it, expect } from "vitest"
import { convertToDidJwk, detectFormat } from "@/lib/public-key-to-jwk"
import { exportSPKI, exportJWK, generateKeyPair } from "jose"
import { secp256k1 } from "@noble/curves/secp256k1"
import { ed25519 } from "@noble/curves/ed25519"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/** Build an SSH public key line from an Ed25519 32-byte public key */
function buildSshEd25519(pubkey: Uint8Array): string {
  const keyType = "ssh-ed25519"
  const typeBytes = new TextEncoder().encode(keyType)

  // SSH wire format: [uint32 len][type string][uint32 len][pubkey bytes]
  const totalLen = 4 + typeBytes.length + 4 + pubkey.length
  const buf = new Uint8Array(totalLen)
  let offset = 0

  // Write type string
  new DataView(buf.buffer).setUint32(offset, typeBytes.length)
  offset += 4
  buf.set(typeBytes, offset)
  offset += typeBytes.length

  // Write public key
  new DataView(buf.buffer).setUint32(offset, pubkey.length)
  offset += 4
  buf.set(pubkey, offset)

  const b64 = btoa(String.fromCharCode(...buf))
  return `ssh-ed25519 ${b64} test@test`
}

/** Build an SSH public key line from an ECDSA P-256 uncompressed point */
function buildSshEcdsaP256(uncompressedPoint: Uint8Array): string {
  const keyType = "ecdsa-sha2-nistp256"
  const curveId = "nistp256"
  const typeBytes = new TextEncoder().encode(keyType)
  const curveBytes = new TextEncoder().encode(curveId)

  // SSH wire format: [len][type][len][curve][len][point]
  const totalLen =
    4 + typeBytes.length + 4 + curveBytes.length + 4 + uncompressedPoint.length
  const buf = new Uint8Array(totalLen)
  const view = new DataView(buf.buffer)
  let offset = 0

  view.setUint32(offset, typeBytes.length); offset += 4
  buf.set(typeBytes, offset); offset += typeBytes.length
  view.setUint32(offset, curveBytes.length); offset += 4
  buf.set(curveBytes, offset); offset += curveBytes.length
  view.setUint32(offset, uncompressedPoint.length); offset += 4
  buf.set(uncompressedPoint, offset)

  const b64 = btoa(String.fromCharCode(...buf))
  return `ecdsa-sha2-nistp256 ${b64} test@test`
}

// ---------------------------------------------------------------------------
// Tests: Ed25519
// ---------------------------------------------------------------------------

describe("convertToDidJwk — Ed25519 round-trip", () => {
  it("JWK JSON and SSH public key produce the same did:jwk", async () => {
    // Generate a fresh Ed25519 key
    const privateKey = ed25519.utils.randomPrivateKey()
    const publicKey = ed25519.getPublicKey(privateKey)

    // Format 1: JWK JSON
    const jwk = { kty: "OKP", crv: "Ed25519", x: bytesToBase64url(publicKey) }
    const jwkResult = await convertToDidJwk(JSON.stringify(jwk))

    // Format 2: SSH public key
    const sshKey = buildSshEd25519(publicKey)
    const sshResult = await convertToDidJwk(sshKey)

    expect(jwkResult.did).toBe(sshResult.did)
    expect(jwkResult.detectedFormat).toBe("jwk-json")
    expect(sshResult.detectedFormat).toBe("ssh-pubkey")
    expect(jwkResult.keyDescription).toBe("Ed25519 key")
  })

  it("did:jwk passthrough produces the same did", async () => {
    const privateKey = ed25519.utils.randomPrivateKey()
    const publicKey = ed25519.getPublicKey(privateKey)

    const jwk = { kty: "OKP", crv: "Ed25519", x: bytesToBase64url(publicKey) }
    const jwkResult = await convertToDidJwk(JSON.stringify(jwk))

    // Pass the resulting did:jwk back through the converter
    const passthroughResult = await convertToDidJwk(jwkResult.did)

    expect(passthroughResult.did).toBe(jwkResult.did)
    expect(passthroughResult.detectedFormat).toBe("did-jwk")
  })

  it("base64url-encoded JWK produces the same did:jwk", async () => {
    const privateKey = ed25519.utils.randomPrivateKey()
    const publicKey = ed25519.getPublicKey(privateKey)

    const jwk = { kty: "OKP", crv: "Ed25519", x: bytesToBase64url(publicKey) }
    const jwkResult = await convertToDidJwk(JSON.stringify(jwk))

    // Format: base64url-encoded JWK (the payload portion of did:jwk)
    const base64urlPayload = btoa(JSON.stringify(jwk))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
    const b64Result = await convertToDidJwk(base64urlPayload)

    expect(b64Result.did).toBe(jwkResult.did)
    expect(b64Result.detectedFormat).toBe("base64url-jwk")
  })
})

// ---------------------------------------------------------------------------
// Tests: P-256 (EC)
// ---------------------------------------------------------------------------

describe("convertToDidJwk — P-256 round-trip", () => {
  it("PEM SPKI and JWK JSON produce the same did:jwk", async () => {
    // Generate a fresh P-256 key pair using jose
    const { publicKey } = await generateKeyPair("ES256", { extractable: true })
    const jwk = (await exportJWK(publicKey)) as Record<string, unknown>
    const pem = await exportSPKI(publicKey)

    // Convert from JWK JSON
    const jwkResult = await convertToDidJwk(JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }))

    // Convert from PEM
    const pemResult = await convertToDidJwk(pem)

    expect(pemResult.did).toBe(jwkResult.did)
    expect(pemResult.detectedFormat).toBe("pem-spki")
    expect(jwkResult.detectedFormat).toBe("jwk-json")
    expect(jwkResult.keyDescription).toBe("EC P-256 key")
  })

  it("SSH ECDSA P-256 and JWK JSON produce the same did:jwk", async () => {
    const { publicKey } = await generateKeyPair("ES256", { extractable: true })
    const jwk = (await exportJWK(publicKey)) as Record<string, unknown>

    // Build uncompressed point from x, y
    const xBytes = Uint8Array.from(atob((jwk.x as string).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))
    const yBytes = Uint8Array.from(atob((jwk.y as string).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))
    const uncompressed = new Uint8Array(1 + 32 + 32)
    uncompressed[0] = 0x04
    uncompressed.set(xBytes, 1)
    uncompressed.set(yBytes, 33)

    const sshKey = buildSshEcdsaP256(uncompressed)
    const sshResult = await convertToDidJwk(sshKey)

    const jwkResult = await convertToDidJwk(JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }))

    expect(sshResult.did).toBe(jwkResult.did)
    expect(sshResult.detectedFormat).toBe("ssh-pubkey")
  })
})

// ---------------------------------------------------------------------------
// Tests: secp256k1
// ---------------------------------------------------------------------------

describe("convertToDidJwk — secp256k1 round-trip", () => {
  it("compressed hex and uncompressed hex produce the same did:jwk", async () => {
    // Generate a fresh secp256k1 key
    const privateKey = secp256k1.utils.randomPrivateKey()
    const publicKeyUncompressed = secp256k1.getPublicKey(privateKey, false) // 65 bytes, 04||x||y
    const publicKeyCompressed = secp256k1.getPublicKey(privateKey, true) // 33 bytes, 02/03||x

    const compressedHex = bytesToHex(publicKeyCompressed)
    const uncompressedHex = bytesToHex(publicKeyUncompressed)

    const compResult = await convertToDidJwk(compressedHex)
    const uncompResult = await convertToDidJwk(uncompressedHex)

    expect(compResult.did).toBe(uncompResult.did)
    expect(compResult.detectedFormat).toBe("hex-secp256k1")
    expect(uncompResult.detectedFormat).toBe("hex-secp256k1")
    expect(compResult.keyDescription).toBe("EC secp256k1 key")
  })

  it("0x-prefixed hex produces the same did:jwk", async () => {
    const privateKey = secp256k1.utils.randomPrivateKey()
    const publicKeyCompressed = secp256k1.getPublicKey(privateKey, true)

    const withPrefix = "0x" + bytesToHex(publicKeyCompressed)
    const withoutPrefix = bytesToHex(publicKeyCompressed)

    const prefixResult = await convertToDidJwk(withPrefix)
    const noPreResult = await convertToDidJwk(withoutPrefix)

    expect(prefixResult.did).toBe(noPreResult.did)
  })

  it("JWK JSON with secp256k1 crv produces same did:jwk as hex", async () => {
    const privateKey = secp256k1.utils.randomPrivateKey()
    const publicKeyCompressed = secp256k1.getPublicKey(privateKey, true)

    const hexResult = await convertToDidJwk(bytesToHex(publicKeyCompressed))

    // Re-convert the resulting JWK back to JSON and through the converter
    const jwkJsonResult = await convertToDidJwk(JSON.stringify(hexResult.jwk))

    expect(jwkJsonResult.did).toBe(hexResult.did)
  })
})

// ---------------------------------------------------------------------------
// Tests: Format detection
// ---------------------------------------------------------------------------

describe("detectFormat", () => {
  it("detects SSH ed25519", () => {
    expect(detectFormat("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIL5OW38sjylbBvwOZhYPxO9ctqs8gurnAG/MmNZwRk3o user@host")).toBe("ssh-pubkey")
  })

  it("detects SSH ECDSA", () => {
    expect(detectFormat("ecdsa-sha2-nistp256 AAAA... user@host")).toBe("ssh-pubkey")
  })

  it("detects PEM SPKI", () => {
    expect(detectFormat("-----BEGIN PUBLIC KEY-----\nMFkw...")).toBe("pem-spki")
  })

  it("detects JWK JSON", () => {
    expect(detectFormat('{"kty":"EC","crv":"P-256","x":"a","y":"b"}')).toBe("jwk-json")
  })

  it("detects did:jwk", () => {
    expect(detectFormat("did:jwk:eyJrdHkiOiJFQyJ9")).toBe("did-jwk")
  })

  it("detects did:key", () => {
    expect(detectFormat("did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK")).toBe("did-key")
  })

  it("detects secp256k1 compressed hex", () => {
    const key = secp256k1.getPublicKey(secp256k1.utils.randomPrivateKey(), true)
    expect(detectFormat(bytesToHex(key))).toBe("hex-secp256k1")
  })

  it("returns unknown for garbage", () => {
    expect(detectFormat("hello world")).toBe("unknown")
  })
})

// ---------------------------------------------------------------------------
// Tests: Private key rejection
// ---------------------------------------------------------------------------

describe("convertToDidJwk — private key rejection", () => {
  it("rejects PEM private key", async () => {
    const pem = "-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----"
    await expect(convertToDidJwk(pem)).rejects.toThrow("private key material")
  })

  it("rejects EC private key PEM", async () => {
    const pem = "-----BEGIN EC PRIVATE KEY-----\nMHQCA...\n-----END EC PRIVATE KEY-----"
    await expect(convertToDidJwk(pem)).rejects.toThrow("private key material")
  })

  it("rejects JWK with d field", async () => {
    const jwk = JSON.stringify({ kty: "EC", crv: "P-256", x: "a", y: "b", d: "secret" })
    await expect(convertToDidJwk(jwk)).rejects.toThrow('private key field "d"')
  })

  it("rejects RSA JWK with p field", async () => {
    const jwk = JSON.stringify({ kty: "RSA", n: "modulus", e: "AQAB", p: "prime" })
    await expect(convertToDidJwk(jwk)).rejects.toThrow('private key field "p"')
  })

  it("rejects OpenSSH private key", async () => {
    const key = "-----BEGIN OPENSSH PRIVATE KEY-----\nb3Blb...\n-----END OPENSSH PRIVATE KEY-----"
    await expect(convertToDidJwk(key)).rejects.toThrow("private key material")
  })

  it("rejects PGP keys", async () => {
    const pgp = "-----BEGIN PGP PUBLIC KEY BLOCK-----\n...\n-----END PGP PUBLIC KEY BLOCK-----"
    await expect(convertToDidJwk(pgp)).rejects.toThrow("PGP keys are not supported")
  })
})

// ---------------------------------------------------------------------------
// Tests: Error cases
// ---------------------------------------------------------------------------

describe("convertToDidJwk — error cases", () => {
  it("rejects empty input", async () => {
    await expect(convertToDidJwk("")).rejects.toThrow("Input is empty")
  })

  it("rejects whitespace-only input", async () => {
    await expect(convertToDidJwk("   ")).rejects.toThrow("Input is empty")
  })

  it("rejects unrecognized format", async () => {
    await expect(convertToDidJwk("this is not a key")).rejects.toThrow("Could not detect key format")
  })
})
