import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/queryClient"
import { MessageSquare, Loader2, Star, ThumbsUp, BarChart2, AlertCircle } from "lucide-react"

type FeedbackMode = "positive" | "rating" | "issue"

interface ReportIssueDialogProps {
  children: React.ReactNode
}

function StarRating({
  rating,
  hoverRating,
  onRate,
  onHover,
  onLeave,
  disabled,
  required,
}: {
  rating: number | null
  hoverRating: number | null
  onRate: (star: number) => void
  onHover: (star: number) => void
  onLeave: () => void
  disabled: boolean
  required?: boolean
}) {
  const displayRating = hoverRating !== null ? hoverRating : rating
  const label =
    rating === 5
      ? "Excellent!"
      : rating === 4
      ? "Great!"
      : rating === 3
      ? "Good"
      : rating === 2
      ? "Fair"
      : "Poor"

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded transition-transform hover:scale-110"
          onMouseEnter={() => onHover(star)}
          onMouseLeave={onLeave}
          onClick={() => onRate(star)}
          disabled={disabled}
        >
          <Star
            className={`h-7 w-7 transition-colors ${
              displayRating !== null && star <= displayRating
                ? "text-amber-400 fill-amber-400"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
      {rating !== null && (
        <span className="ml-2 text-sm text-muted-foreground">{label}</span>
      )}
      {required && rating === null && (
        <span className="ml-2 text-sm text-muted-foreground">Select a star rating</span>
      )}
    </div>
  )
}

export function ReportIssueDialog({ children }: ReportIssueDialogProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<FeedbackMode>("positive")

  const [positiveMessage, setPositiveMessage] = useState("")
  const [positiveRating, setPositiveRating] = useState<number | null>(null)
  const [positiveHoverRating, setPositiveHoverRating] = useState<number | null>(null)

  const [ratingValue, setRatingValue] = useState<number | null>(null)
  const [ratingHoverValue, setRatingHoverValue] = useState<number | null>(null)

  const [issueTitle, setIssueTitle] = useState("")
  const [issueDescription, setIssueDescription] = useState("")
  const [issuePriority, setIssuePriority] = useState("medium")

  const { toast } = useToast()

  const createIssueMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; priority: string; mode: FeedbackMode; rating?: number | null }) => {
      const response = await apiRequest("/api/issues", { method: "POST", body: data })
      return response.json()
    },
    onSuccess: () => {
      toast({
        title: "Feedback Submitted",
        description: "Thank you! Your feedback has been submitted and will be reviewed by our team.",
      })
      setOpen(false)
      resetAll()
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Submit Feedback",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      })
    },
  })

  const resetAll = () => {
    setMode("positive")
    setPositiveMessage("")
    setPositiveRating(null)
    setPositiveHoverRating(null)
    setRatingValue(null)
    setRatingHoverValue(null)
    setIssueTitle("")
    setIssueDescription("")
    setIssuePriority("medium")
  }

  const switchMode = (next: FeedbackMode) => {
    setMode(next)
    setPositiveMessage("")
    setPositiveRating(null)
    setPositiveHoverRating(null)
    setRatingValue(null)
    setRatingHoverValue(null)
    setIssueTitle("")
    setIssueDescription("")
    setIssuePriority("medium")
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (mode === "positive") {
      createIssueMutation.mutate({
        title: "Positive Feedback",
        description: positiveMessage.trim() || "No additional message.",
        priority: "low",
        mode: "positive",
        rating: positiveRating,
      })
      return
    }

    if (mode === "rating") {
      if (ratingValue === null) {
        toast({
          title: "Rating Required",
          description: "Please select at least one star to submit a rating.",
          variant: "destructive",
        })
        return
      }
      createIssueMutation.mutate({
        title: "Rating",
        description: `User submitted a ${ratingValue}-star rating.`,
        priority: "medium",
        mode: "rating",
        rating: ratingValue,
      })
      return
    }

    if (!issueTitle.trim()) {
      toast({
        title: "Title Required",
        description: "Please provide a title for your feedback.",
        variant: "destructive",
      })
      return
    }

    if (!issueDescription.trim()) {
      toast({
        title: "Description Required",
        description: "Please provide details about your feedback.",
        variant: "destructive",
      })
      return
    }

    createIssueMutation.mutate({
      title: issueTitle,
      description: issueDescription,
      priority: issuePriority,
      mode: "issue",
    })
  }

  const modes: { key: FeedbackMode; label: string; Icon: typeof ThumbsUp }[] = [
    { key: "positive", label: "Positive", Icon: ThumbsUp },
    { key: "rating", label: "Rating", Icon: BarChart2 },
    { key: "issue", label: "Issue / Suggestion", Icon: AlertCircle },
  ]

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetAll() }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Feedback
          </DialogTitle>
          <DialogDescription>
            Choose how you'd like to share your feedback below.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 flex-wrap">
          {modes.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => switchMode(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                mode === key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-border hover-elevate"
              }`}
              disabled={createIssueMutation.isPending}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "positive" && (
            <>
              <div className="space-y-2">
                <Label>Rate Your Experience (Optional)</Label>
                <StarRating
                  rating={positiveRating}
                  hoverRating={positiveHoverRating}
                  onRate={(s) => setPositiveRating(positiveRating === s ? null : s)}
                  onHover={setPositiveHoverRating}
                  onLeave={() => setPositiveHoverRating(null)}
                  disabled={createIssueMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="positive-message">What did you love? (Optional)</Label>
                <Textarea
                  id="positive-message"
                  placeholder="What did you love?"
                  value={positiveMessage}
                  onChange={(e) => setPositiveMessage(e.target.value)}
                  rows={3}
                  disabled={createIssueMutation.isPending}
                />
              </div>
            </>
          )}

          {mode === "rating" && (
            <div className="space-y-2">
              <Label>Your Rating</Label>
              <StarRating
                rating={ratingValue}
                hoverRating={ratingHoverValue}
                onRate={(s) => setRatingValue(ratingValue === s ? null : s)}
                onHover={setRatingHoverValue}
                onLeave={() => setRatingHoverValue(null)}
                disabled={createIssueMutation.isPending}
                required
              />
            </div>
          )}

          {mode === "issue" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="issue-title">Title</Label>
                <Input
                  id="issue-title"
                  placeholder="Brief summary of your feedback"
                  value={issueTitle}
                  onChange={(e) => setIssueTitle(e.target.value)}
                  disabled={createIssueMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issue-description">Description</Label>
                <Textarea
                  id="issue-description"
                  placeholder="Please describe your feedback, issue, or suggestion in detail."
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  rows={4}
                  disabled={createIssueMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issue-priority">Priority</Label>
                <Select value={issuePriority} onValueChange={setIssuePriority} disabled={createIssueMutation.isPending}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - Minor suggestion</SelectItem>
                    <SelectItem value="medium">Medium - Improvement idea</SelectItem>
                    <SelectItem value="high">High - Significant issue</SelectItem>
                    <SelectItem value="urgent">Urgent - Critical problem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setOpen(false); resetAll() }}
              disabled={createIssueMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createIssueMutation.isPending}>
              {createIssueMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Feedback"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
