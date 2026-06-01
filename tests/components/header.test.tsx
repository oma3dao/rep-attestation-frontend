import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { Header } from "@/components/header"

const mocks = vi.hoisted(() => ({
  pathname: "/",
  queryString: "",
  replace: vi.fn(),
  openAuthDialog: vi.fn(),
  closeAuthDialog: vi.fn(),
  authDialog: { open: false, mode: "chooser" as const },
  session: null as { account?: { displayName?: string }; wallet?: { did?: string } } | null,
}))

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(mocks.queryString),
}))

vi.mock("@/components/backend-session-provider", () => ({
  useBackendSession: () => ({
    session: mocks.session,
    authDialog: mocks.authDialog,
    closeAuthDialog: mocks.closeAuthDialog,
    openAuthDialog: mocks.openAuthDialog,
  }),
}))

vi.mock("@/components/auth-entry-dialog", () => ({
  AuthEntryDialog: ({ request }: { request: { mode: string } }) => (
    <div data-testid="auth-entry-dialog">Auth dialog ({request.mode})</div>
  ),
}))

vi.mock("@/components/review-widget-modal", () => ({
  ReviewWidgetModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="review-widget-modal">Review widget</div> : null,
}))

describe("Header", () => {
  beforeEach(() => {
    mocks.pathname = "/"
    mocks.queryString = ""
    mocks.replace.mockReset()
    mocks.openAuthDialog.mockReset()
    mocks.closeAuthDialog.mockReset()
    mocks.authDialog = { open: false, mode: "chooser" }
    mocks.session = null
  })

  it("renders OMATrust brand and current navigation links", () => {
    render(<Header />)
    expect(screen.getByText("OMATrust")).toBeInTheDocument()
    expect(screen.getByText("Activity")).toBeInTheDocument()
    expect(screen.getByText("Dashboard")).toBeInTheDocument()
    expect(screen.getByText("Docs")).toBeInTheDocument()
  })

  it("renders Docs link with external attributes", () => {
    render(<Header />)
    const docsLink = screen.getByRole("link", { name: "Docs" })
    expect(docsLink).toHaveAttribute("href", "https://docs.omatrust.org/")
    expect(docsLink).toHaveAttribute("target", "_blank")
    expect(docsLink).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("renders Review button when signed in (alongside account link)", () => {
    mocks.session = { account: { displayName: "Alice" } }
    render(<Header />)
    expect(screen.getByRole("button", { name: /review/i })).toBeInTheDocument()
  })

  it("shows Sign In when no backend session is present", () => {
    render(<Header />)
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument()
  })

  it("shows account link when session exists", () => {
    mocks.session = { account: { displayName: "Alice" }, wallet: { did: "did:pkh:eip155:1:0xabc" } }
    render(<Header />)

    const accountLink = screen.getByRole("link", { name: "Alice" })
    expect(accountLink).toHaveAttribute("href", "/account")
  })

  it("opens chooser auth dialog from ?action=signin and cleans URL", async () => {
    mocks.queryString = "action=signin&foo=bar"
    render(<Header />)

    await waitFor(() => {
      expect(mocks.openAuthDialog).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "chooser" })
      )
      expect(mocks.replace).toHaveBeenCalledWith("/?foo=bar", { scroll: false })
    })
  })

  it("opens signup auth dialog from ?action=signup", async () => {
    mocks.queryString = "action=signup"
    render(<Header />)

    await waitFor(() => {
      expect(mocks.openAuthDialog).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "signup" })
      )
      expect(mocks.replace).toHaveBeenCalledWith("/", { scroll: false })
    })
  })

  it("forwards known hint message when opening auth dialog", async () => {
    mocks.queryString = "action=signin&hint=no-account"
    render(<Header />)

    await waitFor(() => {
      expect(mocks.openAuthDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "chooser",
          hintMessage: expect.stringContaining("No account"),
        })
      )
    })
  })

  it("does not open auth dialog from ?action=signin when already signed in", async () => {
    mocks.queryString = "action=signin"
    mocks.session = { account: { displayName: "Alice" } }
    render(<Header />)

    await waitFor(() => {
      expect(mocks.openAuthDialog).not.toHaveBeenCalled()
      expect(mocks.replace).toHaveBeenCalledWith("/", { scroll: false })
    })
  })

  it("renders AuthEntryDialog when backend auth dialog is open", () => {
    mocks.authDialog = { open: true, mode: "signin" }
    render(<Header />)
    expect(screen.getByTestId("auth-entry-dialog")).toHaveTextContent("Auth dialog (signin)")
  })
})