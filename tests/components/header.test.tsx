import React from "react"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { Header } from "@/components/header"
import type { AuthDialogRequest } from "@/components/backend-session-provider"

const mocks = vi.hoisted(() => ({
  pathname: "/",
  queryString: "",
  replace: vi.fn(),
  openAuthDialog: vi.fn(),
  closeAuthDialog: vi.fn(),
  authDialog: { open: false, mode: "chooser" as const } as AuthDialogRequest,
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
  AuthEntryDialog: ({
    request,
    onOpenChange,
  }: {
    request: AuthDialogRequest
    onOpenChange: (open: boolean) => void
  }) => (
    <div data-testid="auth-entry-dialog">
      Auth dialog ({request.mode})
      <button type="button" onClick={() => onOpenChange(true)}>
        Reopen dialog
      </button>
      <button type="button" onClick={() => onOpenChange(false)}>
        Close dialog
      </button>
    </div>
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

  it("does not render Review button (widget hidden until ready)", () => {
    mocks.session = { account: { displayName: "Alice" } }
    render(<Header />)
    expect(screen.queryByRole("button", { name: /review/i })).not.toBeInTheDocument()
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

  it("opens chooser auth dialog when desktop Sign In is clicked", () => {
    render(<Header />)
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }))
    expect(mocks.openAuthDialog).toHaveBeenCalledWith({ mode: "chooser" })
  })

  it("shows last 8 characters of wallet DID when session has no display name", () => {
    const walletDid = "did:pkh:eip155:1:0xabcdef1234567890"
    mocks.session = { wallet: { did: walletDid } }
    render(<Header />)

    const accountLink = screen.getByRole("link", { name: walletDid.slice(-8) })
    expect(accountLink).toHaveAttribute("href", "/account")
  })

  it('shows "Account" when session has neither display name nor wallet DID', () => {
    mocks.session = { account: {} }
    render(<Header />)
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/account")
  })

  it("reopens auth dialog with same request fields when AuthEntryDialog onOpenChange(true)", () => {
    mocks.authDialog = {
      open: true,
      mode: "signin",
      reason: "submission",
      schemaId: "key-binding",
      schemaTitle: "Key Binding",
      subjectScoped: true,
      subjectHint: "example.com",
      hintMessage: "Please sign in",
      redirectTo: "/publish/key-binding",
    }
    render(<Header />)

    fireEvent.click(screen.getByRole("button", { name: "Reopen dialog" }))

    expect(mocks.openAuthDialog).toHaveBeenCalledWith({
      mode: "signin",
      reason: "submission",
      schemaId: "key-binding",
      schemaTitle: "Key Binding",
      subjectScoped: true,
      subjectHint: "example.com",
      hintMessage: "Please sign in",
      redirectTo: "/publish/key-binding",
    })
  })

  it("closes auth dialog when AuthEntryDialog onOpenChange(false)", () => {
    mocks.authDialog = { open: true, mode: "signin" }
    render(<Header />)

    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }))
    expect(mocks.closeAuthDialog).toHaveBeenCalled()
  })

  it("forwards account-exists hint and dashboard redirectTo from ?action=signin on /dashboard", async () => {
    mocks.pathname = "/dashboard"
    mocks.queryString = "action=signin&hint=account-exists"
    render(<Header />)

    await waitFor(() => {
      expect(mocks.openAuthDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "chooser",
          hintMessage: expect.stringContaining("account already exists"),
          redirectTo: "/dashboard",
        })
      )
      expect(mocks.replace).toHaveBeenCalledWith("/dashboard", { scroll: false })
    })
  })

  it('opens chooser auth dialog from mobile Sign In and closes the menu', () => {
    render(<Header />)
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }))
    const signInButtons = screen.getAllByRole("button", { name: "Sign In" })
    fireEvent.click(signInButtons[signInButtons.length - 1]!)

    expect(mocks.openAuthDialog).toHaveBeenCalledWith({ mode: "chooser" })
    expect(screen.queryByRole("button", { name: "Close menu" })).not.toBeInTheDocument()
  })

  it("shows account link in mobile menu and closes menu on click", () => {
    mocks.session = { account: { displayName: "Alice" }, wallet: { did: "did:pkh:eip155:1:0xabc" } }
    render(<Header />)

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }))
    const accountLinks = screen.getAllByRole("link", { name: "Alice" })
    const mobileAccountLink = accountLinks[accountLinks.length - 1]!
    expect(mobileAccountLink).toHaveAttribute("href", "/account")

    fireEvent.click(mobileAccountLink)
    expect(screen.queryByRole("button", { name: "Close menu" })).not.toBeInTheDocument()
  })

  it("omits hintMessage for unknown hint values and cleans the URL", async () => {
    mocks.queryString = "action=signin&hint=foo&keep=yes"
    render(<Header />)

    await waitFor(() => {
      expect(mocks.openAuthDialog).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "chooser", hintMessage: null })
      )
      expect(mocks.replace).toHaveBeenCalledWith("/?keep=yes", { scroll: false })
    })
  })

  it("preserves non-action query params in redirectTo on /dashboard", async () => {
    mocks.pathname = "/dashboard"
    mocks.queryString = "action=signin&tab=x"
    render(<Header />)

    await waitFor(() => {
      expect(mocks.openAuthDialog).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "chooser", redirectTo: "/dashboard?tab=x" })
      )
      expect(mocks.replace).toHaveBeenCalledWith("/dashboard?tab=x", { scroll: false })
    })
  })

  it("closes the mobile drawer when a nav link is clicked", () => {
    render(<Header />)
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }))
    expect(screen.getByRole("button", { name: "Close menu" })).toBeInTheDocument()

    const dashboardLinks = screen.getAllByRole("link", { name: "Dashboard" })
    fireEvent.click(dashboardLinks[dashboardLinks.length - 1]!)
    expect(screen.queryByRole("button", { name: "Close menu" })).not.toBeInTheDocument()
  })
})