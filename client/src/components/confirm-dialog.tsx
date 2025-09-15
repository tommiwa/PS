import { useEffect, useRef } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export interface ConfirmDialogState {
  isOpen: boolean
  title: string
  description: string
  confirmText: string
  cancelText: string
  variant: "default" | "destructive"
  onConfirm: () => void
  onCancel: () => void
}

interface ConfirmDialogProps {
  state: ConfirmDialogState
}

export function ConfirmDialog({ state }: ConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const confirmedRef = useRef<boolean>(false)

  // Focus the cancel button when dialog opens (safer default)
  useEffect(() => {
    if (state.isOpen && cancelButtonRef.current) {
      // Reset confirmed ref when dialog opens
      confirmedRef.current = false
      // Small delay to ensure dialog is fully mounted
      setTimeout(() => {
        cancelButtonRef.current?.focus()
      }, 100)
    }
  }, [state.isOpen])

  const handleConfirm = () => {
    confirmedRef.current = true
    state.onConfirm()
  }

  const handleCancel = () => {
    confirmedRef.current = false
    state.onCancel()
  }

  const handleOpenChange = (open: boolean) => {
    // Only call onCancel if dialog is closing and wasn't confirmed
    if (!open && !confirmedRef.current) {
      state.onCancel()
    }
  }

  return (
    <AlertDialog open={state.isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent data-testid="dialog-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle data-testid="text-confirm-title">
            {state.title}
          </AlertDialogTitle>
          <AlertDialogDescription data-testid="text-confirm-description">
            {state.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            ref={cancelButtonRef}
            onClick={handleCancel}
            data-testid="button-confirm-cancel"
          >
            {state.cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={state.variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            data-testid="button-confirm-action"
          >
            {state.confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}