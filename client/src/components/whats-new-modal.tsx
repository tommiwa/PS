import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sparkles } from "lucide-react"
import { apiRequest, queryClient } from "@/lib/queryClient"
import type { FeatureAnnouncement } from "@shared/schema"

function SingleAnnouncementView({ announcement }: { announcement: FeatureAnnouncement }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 flex-shrink-0 mt-0.5">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="font-semibold text-base leading-tight">{announcement.title}</h3>
            {announcement.badgeLabel && (
              <Badge variant="secondary" className="text-xs">
                {announcement.badgeLabel}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{announcement.description}</p>
        </div>
      </div>
    </div>
  )
}

function AnnouncementItem({ announcement }: { announcement: FeatureAnnouncement }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 flex-shrink-0 mt-0.5">
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <h3 className="font-semibold text-sm leading-tight">{announcement.title}</h3>
          {announcement.badgeLabel && (
            <Badge variant="secondary" className="text-xs">
              {announcement.badgeLabel}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{announcement.description}</p>
      </div>
    </div>
  )
}

export function WhatsNewController() {
  const { data: announcements = [], isLoading } = useQuery<FeatureAnnouncement[]>({
    queryKey: ["/api/announcements"],
  })

  const [open, setOpen] = useState(true)

  const dismissMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/announcements/dismiss", { method: "POST" })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] })
    },
  })

  const hasAnnouncements = !isLoading && announcements.length > 0

  if (!hasAnnouncements) return null

  const isSingle = announcements.length === 1

  const handleDismiss = () => {
    setOpen(false)
    dismissMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <DialogTitle className="text-lg font-semibold">
              {isSingle ? "What's New" : `What's New (${announcements.length} updates)`}
            </DialogTitle>
          </div>
        </DialogHeader>

        {isSingle ? (
          <div className="py-2">
            <SingleAnnouncementView announcement={announcements[0]} />
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-1">
            <div className="space-y-4 py-2 pr-3">
              {announcements.map((a) => (
                <AnnouncementItem key={a.id} announcement={a} />
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="pt-2">
          <Button
            className="w-full"
            onClick={handleDismiss}
            disabled={dismissMutation.isPending}
            data-testid="button-whats-new-got-it"
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
