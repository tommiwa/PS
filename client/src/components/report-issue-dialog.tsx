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
import { MessageSquare, Loader2, Star } from "lucide-react"

interface ReportIssueDialogProps {
  children: React.ReactNode
}

export function ReportIssueDialog({ children }: ReportIssueDialogProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState("medium")
  const [rating, setRating] = useState<number | null>(null)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const { toast } = useToast()

  const createIssueMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; priority: string; rating?: number | null }) => {
      const response = await apiRequest("/api/issues", { method: "POST", body: data })
      return response.json()
    },
    onSuccess: () => {
      toast({
        title: "Feedback Submitted",
        description: "Thank you! Your feedback has been submitted and will be reviewed by our team.",
      })
      setOpen(false)
      resetForm()
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Submit Feedback",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      })
    },
  })

  const resetForm = () => {
    setTitle("")
    setDescription("")
    setPriority("medium")
    setRating(null)
    setHoverRating(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      toast({
        title: "Title Required",
        description: "Please provide a title for your feedback.",
        variant: "destructive",
      })
      return
    }
    
    if (!description.trim()) {
      toast({
        title: "Description Required",
        description: "Please provide details about your feedback.",
        variant: "destructive",
      })
      return
    }

    createIssueMutation.mutate({ title, description, priority, rating })
  }

  const displayRating = hoverRating !== null ? hoverRating : rating

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            Share your thoughts, report issues, or suggest improvements. Your feedback helps us make the app better!
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Rate Your Experience (Optional)</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded transition-transform hover:scale-110"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  onClick={() => setRating(rating === star ? null : star)}
                  disabled={createIssueMutation.isPending}
                >
                  <Star
                    className={`h-7 w-7 transition-colors ${
                      displayRating !== null && star <= displayRating
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-gray-300 dark:text-gray-600'
                    }`}
                  />
                </button>
              ))}
              {rating !== null && (
                <span className="ml-2 text-sm text-muted-foreground">
                  {rating === 5 ? "Excellent!" : rating === 4 ? "Great!" : rating === 3 ? "Good" : rating === 2 ? "Fair" : "Poor"}
                </span>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Brief summary of your feedback"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={createIssueMutation.isPending}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Please describe your feedback, issue, or suggestion in detail."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              disabled={createIssueMutation.isPending}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select value={priority} onValueChange={setPriority} disabled={createIssueMutation.isPending}>
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
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
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
