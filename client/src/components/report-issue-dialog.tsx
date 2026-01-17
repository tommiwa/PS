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
import { AlertCircle, Loader2 } from "lucide-react"

interface ReportIssueDialogProps {
  children: React.ReactNode
}

export function ReportIssueDialog({ children }: ReportIssueDialogProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState("medium")
  const { toast } = useToast()

  const createIssueMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; priority: string }) => {
      const response = await apiRequest("/api/issues", { method: "POST", body: data })
      return response.json()
    },
    onSuccess: () => {
      toast({
        title: "Issue Reported",
        description: "Thank you! Your issue has been submitted and will be reviewed by our team.",
      })
      setOpen(false)
      resetForm()
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Report Issue",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      })
    },
  })

  const resetForm = () => {
    setTitle("")
    setDescription("")
    setPriority("medium")
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      toast({
        title: "Title Required",
        description: "Please provide a title for your issue.",
        variant: "destructive",
      })
      return
    }
    
    if (!description.trim()) {
      toast({
        title: "Description Required",
        description: "Please describe the issue you're experiencing.",
        variant: "destructive",
      })
      return
    }

    createIssueMutation.mutate({ title, description, priority })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            Report an Issue
          </DialogTitle>
          <DialogDescription>
            Let us know about any problems or suggestions. We'll review your submission and work to resolve it as early as possible.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Brief summary of the issue"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={createIssueMutation.isPending}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Please describe the issue in detail. Include any steps to reproduce if applicable."
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
                <SelectItem value="low">Low - Minor inconvenience</SelectItem>
                <SelectItem value="medium">Medium - Affects the functionality</SelectItem>
                <SelectItem value="high">High - Significant impact</SelectItem>
                <SelectItem value="urgent">Urgent - Critical blocker</SelectItem>
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
                "Submit Issue"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
