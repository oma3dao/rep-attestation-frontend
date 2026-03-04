"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import * as reputation from "@oma3/omatrust/reputation"
import type { Hex } from "@oma3/omatrust/reputation"
import { useActiveAccount } from "thirdweb/react"
import { ethers6Adapter } from "thirdweb/adapters/ethers6"
import { ExternalLink, RefreshCw } from "lucide-react"
import { client } from "@/app/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AttestationDetailModal } from "@/components/attestation-detail-modal"
import { RevokeConfirmationDialog } from "@/components/revoke-confirmation-dialog"
import { getAttestationsByAttesterWithMetadata, type EnrichedAttestationResult } from "@/lib/attestation-queries"
import { getActiveThirdwebChain, useWallet } from "@/lib/blockchain"
import { getContractAddress } from "@/config/attestation-services"
import { getChainById } from "@/config/chains"

const activeThirdwebChain = getActiveThirdwebChain()

function truncateMiddle(value: string, head: number = 12, tail: number = 8): string {
  if (value.length <= head + tail + 3) {
    return value
  }
  return `${value.slice(0, head)}...${value.slice(-tail)}`
}

function getRecipientLabel(attestation: EnrichedAttestationResult): string {
  const subject = attestation.decodedData?.subject
  if (typeof subject === "string" && subject.length > 0) {
    return subject
  }
  return attestation.recipient
}

function canRevoke(attestation: EnrichedAttestationResult, connectedAddress: string | null): boolean {
  if (!connectedAddress) {
    return false
  }
  return (
    attestation.revocable &&
    attestation.revocationTime === 0 &&
    attestation.attester.toLowerCase() === connectedAddress.toLowerCase()
  )
}

export default function DashboardPage() {
  const { isConnected, address, chainId } = useWallet()
  const account = useActiveAccount()
  const [attestations, setAttestations] = useState<EnrichedAttestationResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revokingUid, setRevokingUid] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<EnrichedAttestationResult | null>(null)
  const [selectedAttestation, setSelectedAttestation] = useState<EnrichedAttestationResult | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const chain = useMemo(() => getChainById(chainId), [chainId])
  const easContractAddress = useMemo(() => getContractAddress("eas", chainId), [chainId])

  const loadAttestations = useCallback(async () => {
    if (!isConnected || !address) {
      setAttestations([])
      return
    }
    if (!easContractAddress) {
      setAttestations([])
      setError("My Attestations is currently available only on EAS-enabled chains.")
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      const results = await getAttestationsByAttesterWithMetadata(address, chainId, 100)
      setAttestations(results)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attestations.")
    } finally {
      setIsLoading(false)
    }
  }, [address, chainId, easContractAddress, isConnected])

  useEffect(() => {
    void loadAttestations()
  }, [loadAttestations])

  const handleRevoke = useCallback(async (attestation: EnrichedAttestationResult) => {
    if (!address || !account || !easContractAddress) {
      setError("Wallet account or EAS contract not available.")
      return
    }
    if (!canRevoke(attestation, address)) {
      return
    }

    try {
      setRevokingUid(attestation.uid)
      setError(null)

      const signer = await ethers6Adapter.signer.toEthers({
        client,
        chain: activeThirdwebChain,
        account,
      })
      if (!signer) {
        throw new Error("Failed to obtain signer.")
      }

      await reputation.revokeAttestation({
        signer,
        easContractAddress: easContractAddress as Hex,
        schemaUid: attestation.schema as Hex,
        uid: attestation.uid as Hex,
      })

      await loadAttestations()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke attestation.")
    } finally {
      setRevokingUid(null)
      setRevokeTarget(null)
    }
  }, [account, address, easContractAddress, loadAttestations])

  const openDetailModal = useCallback((attestation: EnrichedAttestationResult) => {
    setSelectedAttestation(attestation)
    setIsModalOpen(true)
  }, [])

  const closeDetailModal = useCallback(() => {
    setIsModalOpen(false)
    setSelectedAttestation(null)
  }, [])

  if (!isConnected) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card>
          <CardHeader>
            <CardTitle>My Attestations</CardTitle>
            <CardDescription>Connect your wallet to view and revoke your attestations.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Attestations</h1>
          <p className="text-gray-600 mt-1">
            Wallet {truncateMiddle(address || "")} on {chain?.name || `Chain ${chainId}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadAttestations()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link href="/attest">
            <Button>Create Attestation</Button>
          </Link>
        </div>
      </div>

      {error && (
        <Card className="mb-4 border-red-200">
          <CardContent className="pt-6 text-red-700">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your Attestations</CardTitle>
          <CardDescription>
            View all attestations created by your connected wallet and revoke revocable attestations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-gray-600">Loading attestations...</div>
          ) : attestations.length === 0 ? (
            <div className="py-12 text-center text-gray-600">No attestations found for this wallet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-3 pr-4 font-medium">Schema</th>
                    <th className="py-3 pr-4 font-medium">Recipient</th>
                    <th className="py-3 pr-4 font-medium">Date</th>
                    <th className="py-3 pr-4 font-medium">Status</th>
                    <th className="py-3 pr-4 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {attestations.map((attestation) => {
                    const recipientLabel = getRecipientLabel(attestation)
                    const revoked = attestation.revocationTime > 0
                    const revokeAllowed = canRevoke(attestation, address)
                    return (
                      <tr
                        key={attestation.uid}
                        className="border-b align-top cursor-pointer hover:bg-gray-50"
                        onClick={() => openDetailModal(attestation)}
                      >
                        <td className="py-4 pr-4">
                          <div className="font-medium text-gray-900">{attestation.schemaTitle || attestation.schemaId || "Unknown schema"}</div>
                          <div className="text-xs text-gray-500 mt-1 font-mono">{truncateMiddle(attestation.uid, 10, 6)}</div>
                        </td>
                        <td className="py-4 pr-4">
                          <div className="font-mono text-gray-700" title={recipientLabel}>
                            {truncateMiddle(recipientLabel, 20, 10)}
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-gray-700">{new Date(attestation.time * 1000).toLocaleString()}</td>
                        <td className="py-4 pr-4">
                          {revoked ? (
                            <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Revoked</Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
                          )}
                        </td>
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-2">
                            {revokeAllowed ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={revokingUid === attestation.uid}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setRevokeTarget(attestation)
                                }}
                              >
                                {revokingUid === attestation.uid ? "Revoking..." : "Revoke"}
                              </Button>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                            {attestation.txHash && chain?.blockExplorers?.[0]?.url && (
                              <a
                                href={`${chain.blockExplorers[0].url}/tx/${attestation.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                                title="View transaction"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AttestationDetailModal
        isOpen={isModalOpen}
        onClose={closeDetailModal}
        attestation={selectedAttestation}
      />

      <RevokeConfirmationDialog
        isOpen={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => { if (revokeTarget) void handleRevoke(revokeTarget) }}
        attestationUid={revokeTarget?.uid ?? ""}
        isRevoking={revokingUid !== null}
      />
    </div>
  )
}
