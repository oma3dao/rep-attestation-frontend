"use client"

import React, { useEffect, useCallback, useRef } from "react"
import { useActiveAccount } from "thirdweb/react"
import { ethers6Adapter } from "thirdweb/adapters/ethers6"
import { client } from "@/app/client"
import { getActiveThirdwebChain } from "@/lib/blockchain"
import { createSigningBridge } from "@oma3/omatrust/widgets"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

const WIDGET_BASE = process.env.NEXT_PUBLIC_WIDGET_BASE_URL || "https://reputation.omatrust.org"
const WIDGET_SRC = `${WIDGET_BASE}/widgets/reviews/embed?url=reputation.omatrust.org&contract=0x8835AF90f1537777F52E482C8630cE4e947eCa32&chainId=66238&name=OMATrust+Reputation+Portal&explorer=https%3A%2F%2Fexplorer.testnet.chain.oma3.org%2Fapi`

const DEV_ORIGIN_OVERRIDE = process.env.NEXT_PUBLIC_WIDGET_BASE_URL || undefined

const WIDGET_IFRAME_ID = "omatrust-widget"

type ReviewWidgetModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReviewWidgetModal({ open, onOpenChange }: ReviewWidgetModalProps) {
  const account = useActiveAccount()
  const bridgeRef = useRef<{ destroy: () => void } | null>(null)
  const activeChain = getActiveThirdwebChain()

  const iframeSrc = React.useMemo(() => {
    const url = new URL(WIDGET_SRC)
    if (account?.address) {
      url.searchParams.set("wallet", account.address)
    }
    return url.toString()
  }, [account?.address])

  const handleClose = useCallback(
    (event: MessageEvent) => {
      if (event.data?.type === "omatrust:close") {
        onOpenChange(false)
      }
    },
    [onOpenChange]
  )

  // Create the bridge when the modal opens.
  // The bridge resolves the iframe by ID lazily, so it works even though
  // the iframe hasn't mounted yet when this effect runs.
  useEffect(() => {
    if (!open || !account) return

    let cancelled = false
    window.addEventListener("message", handleClose)

    createSigningBridge({
      iframeId: WIDGET_IFRAME_ID,
      devOriginOverride: DEV_ORIGIN_OVERRIDE,
      signTypedData: async (
        domain: Record<string, unknown>,
        types: Record<string, unknown>,
        message: Record<string, unknown>
      ) => {
        const signer = ethers6Adapter.signer.toEthers({
          client,
          chain: activeChain,
          account,
        })
        return await signer.signTypedData(
          domain,
          types as Record<string, Array<{ name: string; type: string }>>,
          message
        )
      },
    }).then((b) => {
      if (!cancelled) bridgeRef.current = b
    }).catch((err) => {
      console.error("[ReviewWidgetModal] Bridge creation failed:", err)
    })

    return () => {
      cancelled = true
      window.removeEventListener("message", handleClose)
      bridgeRef.current?.destroy()
      bridgeRef.current = null
    }
  }, [open, account, activeChain, handleClose])

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[440px] max-w-[95vw] p-0 gap-0 overflow-visible rounded-2xl border-0 bg-transparent shadow-none outline-none focus:outline-none [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">Review OMATrust Reputation</DialogTitle>
        <DialogDescription className="sr-only">
          Write a review for reputation.omatrust.org
        </DialogDescription>
        <iframe
          id={WIDGET_IFRAME_ID}
          src={iframeSrc}
          width={440}
          height={760}
          style={{ border: 0, width: "100%", maxWidth: 440, height: 760, background: "transparent" }}
          loading="lazy"
          title="OMATrust Review Widget"
        />
      </DialogContent>
    </Dialog>
  )
}
