import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { ReviewWidgetModal } from "@/components/review-widget-modal"

const mocks = vi.hoisted(() => {
  return {
    account: { address: "0xabc123" } as { address: string } | null,
    createSigningBridge: vi.fn(),
    signTypedData: vi.fn().mockResolvedValue("0xsigned"),
    destroy: vi.fn(),
  }
})

vi.mock("thirdweb/react", () => ({
  useActiveAccount: () => mocks.account,
}))

vi.mock("thirdweb/adapters/ethers6", () => ({
  ethers6Adapter: {
    signer: {
      toEthers: () => ({
        signTypedData: mocks.signTypedData,
      }),
    },
  },
}))

vi.mock("@/app/client", () => ({
  client: {},
}))

vi.mock("@/lib/blockchain", () => ({
  getActiveThirdwebChain: () => ({ id: 66238 }),
}))

vi.mock(
  "@oma3/omatrust/widgets",
  () => ({
    createSigningBridge: (...args: unknown[]) => mocks.createSigningBridge(...args),
  }),
  { virtual: true }
)

describe("ReviewWidgetModal", () => {
  beforeEach(() => {
    mocks.account = { address: "0xabc123" }
    mocks.createSigningBridge.mockReset()
    mocks.signTypedData.mockClear()
    mocks.destroy.mockReset()
    mocks.createSigningBridge.mockResolvedValue({ destroy: mocks.destroy })
  })

  it("renders nothing when modal is closed", () => {
    const { container } = render(
      <ReviewWidgetModal open={false} onOpenChange={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders iframe with connected wallet query param", () => {
    render(<ReviewWidgetModal open onOpenChange={() => {}} />)
    const iframe = screen.getByTitle("OMATrust Review Widget")
    expect(iframe).toBeInTheDocument()
    expect(iframe).toHaveAttribute("src", expect.stringContaining("wallet=0xabc123"))
  })

  it("uses NEXT_PUBLIC_WIDGET_BASE_URL override for iframe src", async () => {
    vi.stubEnv("NEXT_PUBLIC_WIDGET_BASE_URL", "https://preview.widgets.omatrust.org")
    try {
      vi.resetModules()
      const { ReviewWidgetModal: EnvOverrideWidget } = await import("@/components/review-widget-modal")
      render(<EnvOverrideWidget open onOpenChange={() => {}} />)
      const iframe = screen.getByTitle("OMATrust Review Widget")
      expect(iframe).toHaveAttribute(
        "src",
        expect.stringContaining("https://preview.widgets.omatrust.org/widgets/reviews/embed")
      )
    } finally {
      vi.unstubAllEnvs()
      vi.resetModules()
    }
  })

  it("passes env-based devOriginOverride into createSigningBridge", async () => {
    vi.stubEnv("NEXT_PUBLIC_WIDGET_BASE_URL", "https://preview.widgets.omatrust.org")
    try {
      vi.resetModules()
      const { ReviewWidgetModal: EnvOverrideWidget } = await import("@/components/review-widget-modal")
      render(<EnvOverrideWidget open onOpenChange={() => {}} />)

      await waitFor(() => {
        expect(mocks.createSigningBridge).toHaveBeenCalledWith(
          expect.objectContaining({
            devOriginOverride: "https://preview.widgets.omatrust.org",
          })
        )
      })
    } finally {
      vi.unstubAllEnvs()
      vi.resetModules()
    }
  })

  it("creates signing bridge on open and destroys it on unmount", async () => {
    const { unmount } = render(<ReviewWidgetModal open onOpenChange={() => {}} />)

    await waitFor(() => {
      expect(mocks.createSigningBridge).toHaveBeenCalledWith(
        expect.objectContaining({
          iframeId: "omatrust-widget",
          signTypedData: expect.any(Function),
        })
      )
    })

    unmount()

    expect(mocks.destroy).toHaveBeenCalledTimes(1)
  })

  it("closes modal when widget sends omatrust:close message", async () => {
    const onOpenChange = vi.fn()
    render(<ReviewWidgetModal open onOpenChange={onOpenChange} />)

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "omatrust:close" },
      })
    )

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it("does not create bridge when no active account", () => {
    mocks.account = null
    render(<ReviewWidgetModal open onOpenChange={() => {}} />)
    expect(mocks.createSigningBridge).not.toHaveBeenCalled()
  })

  it("omits wallet query param when account has no address", () => {
    mocks.account = {} as { address?: string }
    render(<ReviewWidgetModal open onOpenChange={() => {}} />)
    const iframe = screen.getByTitle("OMATrust Review Widget")
    const src = iframe.getAttribute("src") ?? ""
    expect(src).not.toContain("wallet=")
  })

  it("destroys bridge when modal closes", async () => {
    const onOpenChange = vi.fn()
    const { rerender } = render(
      <ReviewWidgetModal open onOpenChange={onOpenChange} />
    )

    await waitFor(() => {
      expect(mocks.createSigningBridge).toHaveBeenCalled()
    })

    rerender(<ReviewWidgetModal open={false} onOpenChange={onOpenChange} />)

    await waitFor(() => {
      expect(mocks.destroy).toHaveBeenCalledTimes(1)
    })
  })

  it("recreates bridge on reopen and cleans up prior instance", async () => {
    const onOpenChange = vi.fn()
    const { rerender } = render(
      <ReviewWidgetModal open onOpenChange={onOpenChange} />
    )

    await waitFor(() => {
      expect(mocks.createSigningBridge).toHaveBeenCalledTimes(1)
    })

    rerender(<ReviewWidgetModal open={false} onOpenChange={onOpenChange} />)
    await waitFor(() => {
      expect(mocks.destroy).toHaveBeenCalledTimes(1)
    })

    rerender(<ReviewWidgetModal open onOpenChange={onOpenChange} />)
    await waitFor(() => {
      expect(mocks.createSigningBridge).toHaveBeenCalledTimes(2)
    })
  })

  it("forwards typed-data signing to the ethers signer from the bridge", async () => {
    render(<ReviewWidgetModal open onOpenChange={() => {}} />)

    await waitFor(() => {
      expect(mocks.createSigningBridge).toHaveBeenCalled()
    })

    const bridgeConfig = mocks.createSigningBridge.mock.calls[0][0] as {
      signTypedData: (
        domain: Record<string, unknown>,
        types: Record<string, unknown>,
        message: Record<string, unknown>
      ) => Promise<string>
    }

    const domain = { name: "Test", version: "1" }
    const types = { Mail: [{ name: "contents", type: "string" }] }
    const message = { contents: "hello" }

    await bridgeConfig.signTypedData(domain, types, message)

    expect(mocks.signTypedData).toHaveBeenCalledWith(domain, types, message)
  })

  it("does not close on unrelated postMessage payloads", () => {
    const onOpenChange = vi.fn()
    render(<ReviewWidgetModal open onOpenChange={onOpenChange} />)

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "something-else" },
      })
    )

    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("exposes an accessible dialog title for screen readers", () => {
    render(<ReviewWidgetModal open onOpenChange={() => {}} />)
    expect(
      screen.getByText("Review OMATrust Reputation")
    ).toBeInTheDocument()
  })

  it("logs bridge creation failures", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const error = new Error("bridge failure")
    mocks.createSigningBridge.mockRejectedValueOnce(error)

    render(<ReviewWidgetModal open onOpenChange={() => {}} />)

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "[ReviewWidgetModal] Bridge creation failed:",
        error
      )
    })

    consoleError.mockRestore()
  })
})
