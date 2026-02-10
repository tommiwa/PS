import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Car, Key, ChevronDown, ChevronRight } from "lucide-react"

interface FAQItem {
  question: string
  answer: string
}

interface FAQCategory {
  title: string
  items: FAQItem[]
}

const renterFAQs: FAQCategory[] = [
  {
    title: "Getting Started",
    items: [
      {
        question: "How do I find and book a parking spot?",
        answer: "Navigate to \"Find Parking\" from the sidebar. You'll see available parking spots displayed as cards. Use the search bar to filter by spot number, location, owner name, price, date, or labels like \"free\" or \"charity\". Click \"Book This Spot\" on any available card to start the booking process."
      },
      {
        question: "What information do I need to book a spot?",
        answer: "You'll need to provide your phone number and vehicle license plate number. If you've previously saved this information in your profile, it will be auto-filled for you."
      },
      {
        question: "What happens after I book a spot?",
        answer: "Once you book a spot, it will appear under \"Current Bookings\" in your My Bookings page with a \"Confirmed\" status. You'll also receive an email confirmation if you have email notifications enabled."
      },
    ]
  },
  {
    title: "Searching & Filtering",
    items: [
      {
        question: "What can I search for when looking for spots?",
        answer: "The search supports multiple fields: spot number, location name, owner name, price, spot type (e.g., \"accessible\", \"EV\"), dates (e.g., \"Feb 20\" or \"March\"), and special labels like \"free\", \"charity\", \"top deal\", or \"weekend\"."
      },
      {
        question: "What do the colored labels on spot cards mean?",
        answer: "Labels help you quickly identify special spots. A pink \"Charity\" badge means the owner will donate all proceeds to charity. A green \"Free\" badge means no cost. A blue \"Top Deal\" badge indicates spots priced at $5 or less. An orange \"Weekend\" badge appears for Saturday or Sunday availability."
      },
      {
        question: "What does the \"PENDING\" badge on a spot mean?",
        answer: "A yellow \"PENDING\" badge means another user is currently in the process of booking that spot for a specific date. The lock expires after a short period, so the spot may become available again if the other user doesn't complete their booking."
      },
    ]
  },
  {
    title: "Bookings & Payments",
    items: [
      {
        question: "Where can I see all my bookings?",
        answer: "Go to \"My Bookings\" from the sidebar. Your bookings are organized into three tabs: \"Current Bookings\" for active and confirmed reservations, \"Settle Payment\" for past bookings that need payment, and \"Completed\" for fully settled bookings."
      },
      {
        question: "How do I pay for a parking spot?",
        answer: "Payment is handled directly between you and the spot owner. Check the payment instructions shown on the spot card or in your booking details. Once you've paid, click \"Mark as Paid\" on the booking to notify the owner. The owner then confirms receipt."
      },
      {
        question: "Can I cancel a booking?",
        answer: "Yes, you can cancel a booking by clicking the \"Cancel\" button on any active booking in your My Bookings page. You'll be asked to provide a reason for cancellation."
      },
      {
        question: "What is the difference between BCI-managed spots and peer-to-peer spots?",
        answer: "BCI-managed spots are administered by Workplace Services. Peer-to-peer spots are listed by individual spot owners who share their assigned parking. For peer-to-peer spots, you'll see the owner's payment instructions on the card."
      },
      {
        question: "Can I download a receipt for my booking?",
        answer: "Yes, completed bookings have a \"Download Receipt\" option that generates a PDF with all booking details including spot number, date, amount, and payment status."
      },
    ]
  },
  {
    title: "Spot Types & Locations",
    items: [
      {
        question: "What are the different spot types?",
        answer: "Spots can be categorized by type such as Regular, Accessible, EV Charging, or other types configured by your workplace. Spot type badges appear on each card so you can quickly identify what's available."
      },
      {
        question: "How do I find spots at a specific location?",
        answer: "Use the search bar and type the location name (e.g., office name, building, or level). You can also filter by location using the available filters on the Find Parking page."
      },
      {
        question: "What does the map icon next to a location mean?",
        answer: "The map icon links to a visual floor plan showing where the parking spot is physically located. Click it to see the exact position of your booked spot."
      },
      {
        question: "What does \"Indoor\" mean on a spot listing?",
        answer: "Spots marked as \"Indoor\" are located in a covered or enclosed parking area, offering protection from weather."
      },
    ]
  },
  {
    title: "My Statistics",
    items: [
      {
        question: "Where can I see my parking statistics?",
        answer: "Go to \"Statistics\" from the sidebar. You'll find stat cards showing your active bookings, monthly spending, favorite locations, and booking history. There's also a monthly spending trends chart and a breakdown of your top locations."
      },
      {
        question: "What does \"Total Spent\" mean on My Bookings?",
        answer: "Total Spent shows the all-time total of your parking expenses across all completed and active bookings."
      },
    ]
  },
  {
    title: "Account & Notifications",
    items: [
      {
        question: "How do I update my profile information?",
        answer: "Go to \"Profile\" under the Account section in the sidebar. You can update your phone number, vehicle license plate, and department information."
      },
      {
        question: "How do I manage my email notifications?",
        answer: "In your Profile page, scroll to the email notification preferences section. You can toggle notifications on or off by category including booking confirmations, cancellations, payment reminders, and system updates. There's also a master toggle to enable or disable all email notifications at once."
      },
      {
        question: "What are the Terms & Conditions?",
        answer: "When you first log in, you'll be asked to accept the Terms & Conditions. This is a one-time step. You can review the terms at any time from the link in the page footer."
      },
    ]
  },
]

const ownerFAQs: FAQCategory[] = [
  {
    title: "Listing Your Spot",
    items: [
      {
        question: "How do I list my parking spot for others to book?",
        answer: "Go to \"My Bookings\" and click \"Create Listing\" or use the listing creation feature. You can list your spot as a single day, a date range (period), or a recurring schedule."
      },
      {
        question: "What listing types are available?",
        answer: "There are three listing types: \"Single Day\" for one specific date, \"Period\" for a continuous date range (e.g., vacation days), and \"Recurring\" for a repeating schedule on selected days of the week within a date range."
      },
      {
        question: "Can I set different prices for different dates?",
        answer: "Yes, each listing you create can have its own daily rate. If you create multiple single-day listings for the same spot, each can have a different price."
      },
      {
        question: "What does the \"Donate to Charity\" option do?",
        answer: "When creating a listing, you can check the donate option to commit to donating all booking proceeds to charity. Your spot will display a pink \"Charity\" badge, letting renters know their payment supports a good cause."
      },
      {
        question: "Can I list my spot for free?",
        answer: "Yes, set the daily rate to $0.00 when creating your listing. The spot will display a green \"Free\" badge to attract renters."
      },
    ]
  },
  {
    title: "Managing Bookings",
    items: [
      {
        question: "How do I see who booked my spot?",
        answer: "Go to \"My Bookings\" and switch to the owner view. The \"Confirm Payment\" tab shows all booked listings with renter details including their name."
      },
      {
        question: "What are the tabs in My Bookings for owners?",
        answer: "As an owner, you have three tabs: \"Active\" shows your available listings that are open for booking, \"Confirm Payment\" shows booked listings awaiting your payment confirmation, and \"Completed\" shows fully settled bookings."
      },
      {
        question: "How does the payment workflow work?",
        answer: "It's a two-step process: First, the renter marks payment as sent (\"Mark as Paid\"). Then, you confirm you've received the payment (\"Confirm Payment\"). Once both steps are done, the booking moves to Completed."
      },
      {
        question: "Can I cancel a listing that hasn't been booked yet?",
        answer: "Yes, active listings that haven't been booked can be managed from the Active tab in My Bookings."
      },
      {
        question: "What happens to expired listings?",
        answer: "Listings for dates that have passed without being booked are automatically marked as \"unused\" and removed from the active listings view."
      },
    ]
  },
  {
    title: "Payment Setup",
    items: [
      {
        question: "How do I set up my payment instructions?",
        answer: "Go to \"Profile\" and fill in your payment preferences. You can specify your preferred payment method (e.g., e-Transfer) and provide instructions for renters. These instructions appear on your spot cards so renters know how to pay you."
      },
      {
        question: "Will renters see my payment instructions?",
        answer: "Yes, your payment instructions are displayed on the spot card in the Find Parking view and in the booking details. This helps renters pay you quickly and correctly."
      },
    ]
  },
  {
    title: "Spot Information",
    items: [
      {
        question: "How is my spot assigned to me?",
        answer: "Parking spots are assigned by your workplace administrator. Once assigned, you can list your spot for others to book on days you won't be using it."
      },
      {
        question: "Can I see my spot on a floor plan?",
        answer: "If your administrator has set up floor plan links for your location, a map icon will appear next to your spot's location. Click it to see where your spot is on the floor plan."
      },
      {
        question: "What does \"Department Reserved\" mean?",
        answer: "Some spots are reserved for specific departments. These spots can only be assigned to employees within that department."
      },
    ]
  },
  {
    title: "Notifications & Preferences",
    items: [
      {
        question: "What email notifications will I receive as an owner?",
        answer: "You can receive notifications for booking confirmations (when someone books your spot), cancellations, payment updates, spot availability changes, and spot assignments. All of these can be individually toggled on or off in your Profile settings."
      },
      {
        question: "Can I turn off all email notifications?",
        answer: "Yes, use the master toggle in your Profile's notification preferences section to disable all email notifications at once. In-app notifications will still appear regardless of your email settings."
      },
    ]
  },
]

function FAQAccordionItem({ item }: { item: FAQItem }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-start gap-2 w-full text-left py-3 px-1 hover-elevate rounded-md transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
        ) : (
          <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
        )}
        <span className={`text-sm font-medium ${isOpen ? 'text-primary' : 'text-foreground'}`}>
          {item.question}
        </span>
      </button>
      {isOpen && (
        <div className="pl-7 pr-2 pb-3">
          <p className="text-sm text-muted-foreground leading-relaxed">{item.answer}</p>
        </div>
      )}
    </div>
  )
}

function FAQCategorySection({ category }: { category: FAQCategory }) {
  return (
    <div className="mb-5">
      <h3 className="text-sm font-semibold text-foreground mb-2 px-1">{category.title}</h3>
      <div className="bg-card border rounded-md px-3">
        {category.items.map((item, index) => (
          <FAQAccordionItem key={index} item={item} />
        ))}
      </div>
    </div>
  )
}

interface FAQDialogProps {
  children: React.ReactNode
}

export function FAQDialog({ children }: FAQDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Frequently Asked Questions</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="renter" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="grid w-full grid-cols-2 mb-3 flex-shrink-0">
            <TabsTrigger value="renter" className="gap-1.5">
              <Car className="h-4 w-4" />
              Renter
            </TabsTrigger>
            <TabsTrigger value="owner" className="gap-1.5">
              <Key className="h-4 w-4" />
              Spot Owner
            </TabsTrigger>
          </TabsList>
          <TabsContent value="renter" className="mt-0 flex-1 min-h-0 overflow-y-auto pr-2">
            {renterFAQs.map((category, index) => (
              <FAQCategorySection key={index} category={category} />
            ))}
          </TabsContent>
          <TabsContent value="owner" className="mt-0 flex-1 min-h-0 overflow-y-auto pr-2">
            {ownerFAQs.map((category, index) => (
              <FAQCategorySection key={index} category={category} />
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
