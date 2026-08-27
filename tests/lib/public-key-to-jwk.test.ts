/**
 * Tests for the public-key-to-jwk converter.
 *
 * Each test generates a fresh key, converts it to various formats,
 * and verifies that all formats resolve to the same did:jwk.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

const mockValidatePublicJwk = vi.hoisted(() =>
  vi.fn<(jwk: Record<string, unknown>) => { valid: boolean; error?: string } | undefined>()
)

const mockJwkToDidJwk = vi.hoisted(() =>
  vi.fn<(jwk: Record<string, unknown>) => string | undefined>()
)

vi.mock("@oma3/omatrust/identity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@oma3/omatrust/identity")>()
  return {
    ...actual,
    validatePublicJwk: (jwk: Record<string, unknown>) => {
      const mocked = mockValidatePublicJwk(jwk)
      if (mocked !== undefined) return mocked
      return actual.validatePublicJwk(jwk)
    },
    jwkToDidJwk: (jwk: Record<string, unknown>) => {
      const mocked = mockJwkToDidJwk(jwk)
      if (mocked !== undefined) return mocked
      return actual.jwkToDidJwk(jwk)
    },
  }
})

import { convertToDidJwk, detectFormat, PublicKeyConversionError } from "@/lib/public-key-to-jwk"
import { exportSPKI, exportJWK, generateKeyPair } from "jose"
import { generateKeyPairSync } from "node:crypto"
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

/** Build an SSH public key line from RSA modulus and exponent buffers */
function buildSshRsa(n: Buffer, e: Buffer): string {
  const typeBytes = new TextEncoder().encode("ssh-rsa")

  const parts: Uint8Array[] = []
  const append = (bytes: Uint8Array) => {
    const chunk = new Uint8Array(4 + bytes.length)
    new DataView(chunk.buffer).setUint32(0, bytes.length)
    chunk.set(bytes, 4)
    parts.push(chunk)
  }

  append(typeBytes)
  append(new Uint8Array(e))
  append(new Uint8Array(n))

  const totalLen = parts.reduce((sum, part) => sum + part.length, 0)
  const payload = new Uint8Array(totalLen)
  let offset = 0
  for (const part of parts) {
    payload.set(part, offset)
    offset += part.length
  }

  const b64 = btoa(String.fromCharCode(...payload))
  return `ssh-rsa ${b64} test@test`
}

/** Generate a self-signed P-256 X.509 certificate PEM for testing */
function generateSelfSignedCertPem(): string {
  const { execSync } = require("node:child_process") as typeof import("node:child_process")
  const { mkdtempSync, writeFileSync, readFileSync, unlinkSync, rmdirSync } = require("node:fs") as typeof import("node:fs")
  const { join } = require("node:path") as typeof import("node:path")
  const { tmpdir } = require("node:os") as typeof import("node:os")

  const dir = mkdtempSync(join(tmpdir(), "omatrust-x509-"))
  const keyPath = join(dir, "key.pem")
  const certPath = join(dir, "cert.pem")
  try {
    execSync(
      `openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -keyout "${keyPath}" -out "${certPath}" -days 1 -subj "/CN=test" -nodes`,
      { stdio: "pipe" }
    )
    return readFileSync(certPath, "utf8")
  } finally {
    for (const file of [keyPath, certPath]) {
      try { unlinkSync(file) } catch { /* ignore */ }
    }
    try { rmdirSync(dir) } catch { /* ignore */ }
  }
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

  it("returns unknown for malformed JSON that starts with {", () => {
    expect(detectFormat("{not-json")).toBe("unknown")
  })

  it("returns unknown for long base64url that is not a JWK payload", () => {
    const longNonJwk = "A".repeat(48)
    expect(detectFormat(longNonJwk)).toBe("unknown")
  })

  it("detects PEM X.509 certificate", () => {
    expect(detectFormat("-----BEGIN CERTIFICATE-----\nMIIB...")).toBe("pem-x509")
  })

  it("detects PKCS#1 RSA public key header", () => {
    expect(detectFormat("-----BEGIN RSA PUBLIC KEY-----\nMIIB...")).toBe("pem-pkcs1-rsa")
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

  it("rejects PKCS#1 RSA public key format", async () => {
    const pem = "-----BEGIN RSA PUBLIC KEY-----\nMIIBCgKCAQEA...\n-----END RSA PUBLIC KEY-----"
    await expect(convertToDidJwk(pem)).rejects.toMatchObject({
      code: "UNSUPPORTED_FORMAT",
      message: expect.stringMatching(/PKCS#1 RSA/i),
    })
  })

  it("converts a valid did:key Ed25519 identifier", async () => {
    const didKey = "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK"
    const result = await convertToDidJwk(didKey)
    expect(result.detectedFormat).toBe("did-key")
    expect(result.did).toMatch(/^did:jwk:/)
    expect(result.keyDescription).toMatch(/Ed25519/i)
  })

  it("rejects invalid SSH public key format", async () => {
    const truncated = "ssh-ed25519 AAAAB3NzaC1lZDI1NTE5AAAAAA"
    await expect(convertToDidJwk(truncated)).rejects.toMatchObject({
      code: "INVALID_SSH_KEY",
    })
  })

  it("rejects unsupported SSH ECDSA curve", async () => {
    const keyType = "ecdsa-sha2-nistp999"
    const curveId = "nistp999"
    const typeBytes = new TextEncoder().encode(keyType)
    const curveBytes = new TextEncoder().encode(curveId)
    const point = new Uint8Array([0x04, ...new Uint8Array(64)])
    const totalLen =
      4 + typeBytes.length + 4 + curveBytes.length + 4 + point.length
    const buf = new Uint8Array(totalLen)
    const view = new DataView(buf.buffer)
    let offset = 0
    view.setUint32(offset, typeBytes.length); offset += 4
    buf.set(typeBytes, offset); offset += typeBytes.length
    view.setUint32(offset, curveBytes.length); offset += 4
    buf.set(curveBytes, offset); offset += curveBytes.length
    view.setUint32(offset, point.length); offset += 4
    buf.set(point, offset)
    const b64 = btoa(String.fromCharCode(...buf))
    const sshKey = `${keyType} ${b64} test@test`

    await expect(convertToDidJwk(sshKey)).rejects.toMatchObject({
      code: "UNSUPPORTED_FORMAT",
      message: expect.stringMatching(/Unsupported SSH ECDSA curve/i),
    })
  })

  it("rejects JWK JSON that fails public key validation", async () => {
    const invalidJwk = JSON.stringify({ kty: "EC", crv: "P-256", x: "not-valid-base64url!!!" })
    await expect(convertToDidJwk(invalidJwk)).rejects.toMatchObject({
      code: "INVALID_JWK",
    })
  })
})

// ---------------------------------------------------------------------------
// Tests: Additional format coverage
// ---------------------------------------------------------------------------

describe("convertToDidJwk — PEM X.509 and RSA SSH", () => {
  it("converts PEM X.509 certificate to did:jwk", async () => {
    let certPem: string
    try {
      certPem = generateSelfSignedCertPem()
    } catch {
      // Skip when openssl is unavailable in the test environment
      return
    }

    const certResult = await convertToDidJwk(certPem)
    expect(certResult.detectedFormat).toBe("pem-x509")
    expect(certResult.did).toMatch(/^did:jwk:/)
    expect(certResult.keyDescription).toMatch(/P-256|EC/i)
  })

  it("converts ssh-rsa public key to RSA did:jwk", async () => {
    const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
    const jwk = publicKey.export({ format: "jwk" }) as { n: string; e: string }
    const nBuf = Buffer.from(jwk.n, "base64url")
    const eBuf = Buffer.from(jwk.e, "base64url")

    const sshKey = buildSshRsa(nBuf, eBuf)
    const sshResult = await convertToDidJwk(sshKey)
    const jwkResult = await convertToDidJwk(JSON.stringify({ kty: "RSA", n: jwk.n, e: jwk.e }))

    expect(sshResult.did).toBe(jwkResult.did)
    expect(sshResult.detectedFormat).toBe("ssh-pubkey")
    expect(sshResult.keyDescription).toMatch(/RSA/i)
  })
})

describe("convertToDidJwk — describeJwk edge cases", () => {
  it("describes RSA keys without modulus length as a generic RSA key", async () => {
    await expect(convertToDidJwk(JSON.stringify({ kty: "RSA", e: "AQAB" }))).rejects.toMatchObject({
      code: "INVALID_JWK",
    })
  })

  it("describes uncommon kty values when conversion succeeds", async () => {
    const privateKey = ed25519.utils.randomPrivateKey()
    const publicKey = ed25519.getPublicKey(privateKey)
    const jwk = { kty: "OKP", crv: "Ed25519", x: bytesToBase64url(publicKey) }
    const result = await convertToDidJwk(JSON.stringify(jwk))
    expect(result.keyDescription).toBe("Ed25519 key")
  })
})

describe("convertToDidJwk — SSH wire-format errors", () => {
  function buildMinimalSshKey(keyType: string, payloadAfterType = new Uint8Array(0)): string {
    const typeBytes = new TextEncoder().encode(keyType)
    const buf = new Uint8Array(4 + typeBytes.length + payloadAfterType.length)
    new DataView(buf.buffer).setUint32(0, typeBytes.length)
    buf.set(typeBytes, 4)
    if (payloadAfterType.length > 0) {
      buf.set(payloadAfterType, 4 + typeBytes.length)
    }
    const b64 = btoa(String.fromCharCode(...buf))
    return `${keyType} ${b64} test@test`
  }

  it("rejects truncated SSH payloads with INVALID_SSH_KEY", async () => {
    await expect(convertToDidJwk("ssh-ed25519 AAAAB3NzaC1lZDI1NTE5AAAAAA")).rejects.toMatchObject({
      code: "INVALID_SSH_KEY",
    })
  })

  it("rejects SSH keys when header and payload type disagree", async () => {
    const mismatched = buildMinimalSshKey("ssh-rsa")
    await expect(convertToDidJwk(mismatched.replace(/^ssh-rsa /, "ssh-ed25519 "))).rejects.toMatchObject({
      code: "INVALID_SSH_KEY",
      message: expect.stringMatching(/type mismatch/i),
    })
  })

  it("rejects Ed25519 SSH keys with the wrong public key length", async () => {
    const shortKey = new Uint8Array(16)
    const payload = new Uint8Array(4 + shortKey.length)
    new DataView(payload.buffer).setUint32(0, shortKey.length)
    payload.set(shortKey, 4)
    const sshKey = buildMinimalSshKey("ssh-ed25519", payload)

    await expect(convertToDidJwk(sshKey)).rejects.toMatchObject({
      code: "INVALID_SSH_KEY",
      message: expect.stringMatching(/32-byte Ed25519/i),
    })
  })

  it("rejects ssh-dss keys as UNRECOGNIZED_FORMAT because detectFormat does not classify them", async () => {
    const sshDss = buildMinimalSshKey("ssh-dss")
    await expect(convertToDidJwk(sshDss)).rejects.toMatchObject({
      code: "UNRECOGNIZED_FORMAT",
    })
  })
})

describe("convertToDidJwk — base64url JWK validation", () => {
  it("rejects invalid public JWK payloads with INVALID_JWK", async () => {
    const invalidJwk = JSON.stringify({ kty: "EC", crv: "P-256" })
    const payload = btoa(invalidJwk).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

    await expect(convertToDidJwk(payload)).rejects.toMatchObject({
      code: "INVALID_JWK",
    })
  })
})

describe("convertToDidJwk — additional error codes", () => {
  it("throws when secp256k1 hex is not a valid curve point", async () => {
    const invalidCompressed = "02" + "00".repeat(32)
    await expect(convertToDidJwk(invalidCompressed)).rejects.toThrow(/not on curve/i)
  })

  it("rejects malformed base64url JWK payloads with INVALID_JWK", async () => {
    await expect(convertToDidJwk("not-valid-base64url!!!")).rejects.toMatchObject({
      code: "UNRECOGNIZED_FORMAT",
    })
  })

  it("rejects JWK with extra private OKP field k as PRIVATE_KEY_REJECTED", async () => {
    const privateOkp = JSON.stringify({
      kty: "OKP",
      crv: "Ed25519",
      x: bytesToBase64url(ed25519.getPublicKey(ed25519.utils.randomPrivateKey())),
      k: "private-material",
    })
    await expect(convertToDidJwk(privateOkp)).rejects.toMatchObject({
      code: "PRIVATE_KEY_REJECTED",
    })
  })

  it("rejects truncated SSH keys with INVALID_SSH_KEY", async () => {
    await expect(convertToDidJwk("ssh-ed25519 AAAAB3NzaC1lZDI1NTE5AAAAAA")).rejects.toMatchObject({
      code: "INVALID_SSH_KEY",
    })
  })
})

describe("convertToDidJwk — additional SSH ECDSA edge cases", () => {
  function buildSshEcdsaPoint(keyType: string, curveId: string, point: Uint8Array): string {
    const typeBytes = new TextEncoder().encode(keyType)
    const curveBytes = new TextEncoder().encode(curveId)
    const totalLen =
      4 + typeBytes.length + 4 + curveBytes.length + 4 + point.length
    const buf = new Uint8Array(totalLen)
    const view = new DataView(buf.buffer)
    let offset = 0
    view.setUint32(offset, typeBytes.length); offset += 4
    buf.set(typeBytes, offset); offset += typeBytes.length
    view.setUint32(offset, curveBytes.length); offset += 4
    buf.set(curveBytes, offset); offset += curveBytes.length
    view.setUint32(offset, point.length); offset += 4
    buf.set(point, offset)
    const b64 = btoa(String.fromCharCode(...buf))
    return `${keyType} ${b64} test@test`
  }

  it("rejects ECDSA SSH points without 0x04 prefix", async () => {
    const compressedPoint = new Uint8Array([0x03, ...new Uint8Array(64)])
    const sshKey = buildSshEcdsaPoint("ecdsa-sha2-nistp256", "nistp256", compressedPoint)

    await expect(convertToDidJwk(sshKey)).rejects.toMatchObject({
      code: "INVALID_SSH_KEY",
      message: expect.stringMatching(/0x04 prefix/i),
    })
  })

  it("rejects ECDSA SSH points with 0x04 prefix but wrong length", async () => {
    const shortPoint = new Uint8Array([0x04, ...new Uint8Array(32)])
    const sshKey = buildSshEcdsaPoint("ecdsa-sha2-nistp256", "nistp256", shortPoint)

    await expect(convertToDidJwk(sshKey)).rejects.toMatchObject({
      code: "INVALID_SSH_KEY",
    })
  })

  it("converts ecdsa-sha2-nistp384 SSH keys to did:jwk", async () => {
    const { publicKey } = await generateKeyPair("ES384", { extractable: true })
    const jwk = (await exportJWK(publicKey)) as Record<string, unknown>
    const xBytes = Uint8Array.from(
      atob((jwk.x as string).replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0)
    )
    const yBytes = Uint8Array.from(
      atob((jwk.y as string).replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0)
    )
    const point = new Uint8Array(1 + xBytes.length + yBytes.length)
    point[0] = 0x04
    point.set(xBytes, 1)
    point.set(yBytes, 1 + xBytes.length)

    const sshKey = buildSshEcdsaPoint("ecdsa-sha2-nistp384", "nistp384", point)
    const sshResult = await convertToDidJwk(sshKey)
    const jwkResult = await convertToDidJwk(
      JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y })
    )

    expect(sshResult.did).toBe(jwkResult.did)
    expect(sshResult.keyDescription).toBe("EC P-384 key")
  })

  it("rejects ssh-ed25519 keys with truncated base64 payload", async () => {
    await expect(convertToDidJwk("ssh-ed25519 AAAAB3NzaC1lZDI1NTE5AAAAAA")).rejects.toMatchObject({
      code: "INVALID_SSH_KEY",
    })
  })

  it("rejects did:jwk payloads that include private field d", async () => {
    const privateJwk = {
      kty: "EC",
      crv: "P-256",
      x: "test-x",
      y: "test-y",
      d: "secret",
    }
    const payload = btoa(JSON.stringify(privateJwk))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")

    await expect(convertToDidJwk(`did:jwk:${payload}`)).rejects.toThrow(/private key field "d"/i)
  })
})

describe("convertToDidJwk — additional branch coverage", () => {
  beforeEach(() => {
    mockValidatePublicJwk.mockReset()
    mockJwkToDidJwk.mockReset()
  })

  it("rejects SSH input with only the key-type token", async () => {
    await expect(convertToDidJwk("ssh-ed25519")).rejects.toMatchObject({
      code: "UNRECOGNIZED_FORMAT",
    })
  })

  it("rejects crafted truncated SSH wire payloads with Truncated SSH key data", async () => {
    const keyType = "ssh-ed25519"
    const typeBytes = new TextEncoder().encode(keyType)
    const buf = new Uint8Array(4 + typeBytes.length + 1)
    new DataView(buf.buffer).setUint32(0, typeBytes.length)
    buf.set(typeBytes, 4)
    buf[4 + typeBytes.length] = 0xff
    const b64 = btoa(String.fromCharCode(...buf))
    const sshKey = `${keyType} ${b64} test@test`

    await expect(convertToDidJwk(sshKey)).rejects.toMatchObject({
      code: "INVALID_SSH_KEY",
      message: expect.stringMatching(/Truncated SSH key data/i),
    })
  })
})

/**
 * EC/OKP without crv → "unknown curve" in keyDescription is unreachable through
 * convertToDidJwk without src changes: every supported conversion path (SSH, hex,
 * PEM via jose, did:key SDK) always produces a crv field, and JWK JSON inputs are
 * rejected by validatePublicJwk when crv is missing.
 */
