"use client"

export type WalletExecutionMode = "subscription" | "native"

export interface BackendSessionMeResponse {
  account: {
    id: string
    displayName: string | null
  }
  wallet: {
    did: string
    walletProviderId: string | null
    executionMode: WalletExecutionMode
    isManagedWallet: boolean
  } | null
  credential: {
    id: string
    kind: string
    identifier: string
  } | null
  subscription: {
    plan: string
    status: string
  }
  client: {
    clientId: string
    authMode: string
  } | null
  primarySubject: {
    canonicalDid: string
    subjectDidHash: string
  } | null
}

export interface BackendAccountMeResponse {
  account: {
    id: string
    displayName: string | null
  }
  subscription: {
    plan: string
    status: string
    annualSponsoredWriteLimit: number
    sponsoredWritesUsedCurrentYear: number
    annualPremiumReadLimit: number
    premiumReadsUsedCurrentYear: number
  }
  primarySubject: {
    id: string
    canonicalDid: string
    subjectDidHash: string
    displayName: string | null
  } | null
}

export interface BackendSubject {
  id: string
  canonicalDid: string
  subjectDidHash: string
  displayName: string | null
  isDefault: boolean
}

export interface WalletChallengeResponse {
  challengeId: string
  siweMessage: string
  nonce: string
  expiresAt: string
}

export interface WalletVerifyResponse {
  account: {
    id: string
    displayName: string | null
  }
  client: {
    clientId: string | null
  }
  session: {
    id: string
    expiresAt: string
  }
}

export type SubjectVerificationMethod = "dns" | "didDocument"

export interface SubjectOwnershipVerificationResponse {
  verified: boolean
  method: SubjectVerificationMethod | null
  error?: string | null
  details?: string | null
}

type BackendErrorShape = {
  error?: string
  code?: string
  details?: string
}

const DEFAULT_BACKEND_ORIGIN = "https://preview.backend.omatrust.org"

export class BackendApiError extends Error {
  status: number
  code?: string
  details?: string

  constructor(message: string, status: number, code?: string, details?: string) {
    super(message)
    this.name = "BackendApiError"
    this.status = status
    this.code = code
    this.details = details
  }
}

export function isBackendNetworkError(error: unknown) {
  return error instanceof BackendApiError && error.code === "BACKEND_UNREACHABLE"
}

export function getBackendOrigin() {
  const configured = process.env.NEXT_PUBLIC_OMATRUST_BACKEND_URL?.trim()
  return (configured && configured.length > 0 ? configured : DEFAULT_BACKEND_ORIGIN).replace(/\/+$/, "")
}

async function parseError(response: Response) {
  let payload: BackendErrorShape | null = null

  try {
    payload = (await response.json()) as BackendErrorShape
  } catch {
    payload = null
  }

  throw new BackendApiError(
    payload?.error || `Backend request failed with ${response.status}`,
    response.status,
    payload?.code,
    payload?.details
  )
}

async function backendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${getBackendOrigin()}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      ...init,
    })
  } catch (error) {
    throw new BackendApiError(
      "Unable to reach the OMATrust backend right now.",
      0,
      "BACKEND_UNREACHABLE",
      error instanceof Error ? error.message : undefined
    )
  }

  if (!response.ok) {
    await parseError(response)
  }

  return response.json() as Promise<T>
}

export function buildWalletDid(address: string, chainId: number) {
  return `did:pkh:eip155:${chainId}:${address}`
}

export function deriveDidWebFromInput(input: string) {
  const raw = input.trim()
  if (!raw) {
    return null
  }

  if (raw.startsWith("did:web:")) {
    return raw
  }

  try {
    const url = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`)
    return `did:web:${url.hostname.toLowerCase()}`
  } catch {
    const normalized = raw.replace(/^https?:\/\//i, "").split("/")[0]?.trim().toLowerCase()
    return normalized ? `did:web:${normalized}` : null
  }
}

export function deriveSubjectUrlHint(input?: string | null) {
  if (!input) {
    return ""
  }

  const trimmed = input.trim()
  if (!trimmed) {
    return ""
  }

  if (trimmed.startsWith("did:web:")) {
    return trimmed.replace(/^did:web:/, "")
  }

  return trimmed
}

export async function createWalletChallenge(params: {
  walletDid: string
  chainId: number
  domain: string
  uri: string
}) {
  return backendFetch<WalletChallengeResponse>("/api/private/session/wallet/challenge", {
    method: "POST",
    body: JSON.stringify(params),
  })
}

export async function verifyWalletSession(params: {
  challengeId: string
  walletDid: string
  signature: string
  siweMessage: string
  walletProviderId?: string | null
  executionMode?: WalletExecutionMode | null
}) {
  return backendFetch<WalletVerifyResponse>("/api/private/session/wallet/verify", {
    method: "POST",
    body: JSON.stringify(params),
  })
}

export async function getSessionMe() {
  return backendFetch<BackendSessionMeResponse>("/api/private/session/me")
}

export async function getAccountMe() {
  return backendFetch<BackendAccountMeResponse>("/api/private/accounts/me")
}

export async function patchAccountMe(params: { displayName: string | null }) {
  return backendFetch<{ account: { id: string; displayName: string | null } }>("/api/private/accounts/me", {
    method: "PATCH",
    body: JSON.stringify(params),
  })
}

export async function listSubjects() {
  return backendFetch<{ subjects: BackendSubject[] }>("/api/private/subjects")
}

export async function createSubject(params: { did: string; displayName?: string | null }) {
  return backendFetch<{ subject: BackendSubject }>("/api/private/subjects", {
    method: "POST",
    body: JSON.stringify(params),
  })
}

export async function verifySubjectOwnership(params: {
  subjectDid: string
  controllerDid: string
  method: SubjectVerificationMethod
}) {
  return backendFetch<SubjectOwnershipVerificationResponse>("/api/public/verify-subject-ownership", {
    method: "POST",
    body: JSON.stringify(params),
  })
}
