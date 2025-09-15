import { createContext, useContext, useState, useCallback, ReactNode } from "react"
import { ConfirmDialog, type ConfirmDialogState } from "@/components/confirm-dialog"

interface ConfirmOptions {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive"
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType | null>(null)

interface ConfirmProviderProps {
  children: ReactNode
}

export function ConfirmProvider({ children }: ConfirmProviderProps) {
  const [dialogState, setDialogState] = useState<ConfirmDialogState>({
    isOpen: false,
    title: "",
    description: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    variant: "default",
    onConfirm: () => {},
    onCancel: () => {},
  })

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        title: options.title,
        description: options.description,
        confirmText: options.confirmText || "Confirm",
        cancelText: options.cancelText || "Cancel",
        variant: options.variant || "destructive", // Default to destructive for delete operations
        onConfirm: () => {
          setDialogState(prev => ({ ...prev, isOpen: false }))
          resolve(true)
        },
        onCancel: () => {
          setDialogState(prev => ({ ...prev, isOpen: false }))
          resolve(false)
        },
      })
    })
  }, [])

  const contextValue: ConfirmContextType = {
    confirm,
  }

  return (
    <ConfirmContext.Provider value={contextValue}>
      {children}
      <ConfirmDialog state={dialogState} />
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmContextType {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider")
  }
  return context
}

// Predefined confirmation messages for common operations
export const confirmations = {
  deleteSpot: (spotNumber: string) => ({
    title: "Delete Parking Spot",
    description: `Are you sure you want to delete parking spot ${spotNumber}? This action cannot be undone and will remove all associated booking history.`,
    confirmText: "Delete Spot",
    cancelText: "Cancel",
    variant: "destructive" as const,
  }),

  deleteListing: (spotNumber?: string) => ({
    title: "Cancel Listing",
    description: `Are you sure you want to cancel this ${spotNumber ? `listing for spot ${spotNumber}` : "listing"}? This will make the spot unavailable for booking and notify any current renters.`,
    confirmText: "Cancel Listing", 
    cancelText: "Keep Active",
    variant: "destructive" as const,
  }),

  deleteUser: (userName: string) => ({
    title: "Remove User",
    description: `Are you sure you want to remove ${userName} from the system? This will permanently delete their account, remove them from any waiting lists, and cancel their active bookings.`,
    confirmText: "Remove User",
    cancelText: "Cancel",
    variant: "destructive" as const,
  }),

  deleteNotification: () => ({
    title: "Delete Notification",
    description: "Are you sure you want to delete this notification? Once deleted, it cannot be recovered.",
    confirmText: "Delete",
    cancelText: "Cancel", 
    variant: "destructive" as const,
  }),

  removeFromWaitingList: (userName?: string) => ({
    title: "Remove from Waiting List",
    description: `Are you sure you want to remove ${userName || "this user"} from the waiting list? They will lose their position and need to re-register if they want to join again.`,
    confirmText: "Remove",
    cancelText: "Cancel",
    variant: "destructive" as const,
  }),

  cancelBooking: (spotNumber?: string, date?: string) => ({
    title: "Cancel Booking",
    description: `Are you sure you want to cancel this booking${spotNumber ? ` for spot ${spotNumber}` : ""}${date ? ` on ${date}` : ""}? Depending on the cancellation policy, fees may apply.`,
    confirmText: "Cancel Booking",
    cancelText: "Keep Booking",
    variant: "destructive" as const,
  }),

  deleteAccount: (userName?: string) => ({
    title: "Delete Account",
    description: `Are you sure you want to permanently delete your account${userName ? ` (${userName})` : ""}? This action cannot be undone and will remove all your data, bookings, spots, and cancel any active listings. You will lose access to the parking system permanently.`,
    confirmText: "Delete Account",
    cancelText: "Keep Account",
    variant: "destructive" as const,
  }),
}