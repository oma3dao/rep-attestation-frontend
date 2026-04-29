"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface RevokeConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  attestationUid: string
  isRevoking: boolean
}

export function RevokeConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  attestationUid,
  isRevoking,
}: RevokeConfirmationDialogProps) {
  const uidShort = attestationUid.length > 20
    ? `${attestationUid.slice(0, 10)}...${attestationUid.slice(-6)}`
    : attestationUid

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Revoke Attestation</DialogTitle>
          <DialogDescription>
            This will permanently revoke attestation <span className="font-mono">{uidShort}</span>.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button variant="outline" disabled={isRevoking}>Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isRevoking}
          >
            {isRevoking ? "Revoking..." : "Revoke"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
