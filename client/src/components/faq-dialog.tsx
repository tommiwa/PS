import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Car, Key, ChevronDown, ChevronRight, Info, Mail, Phone } from "lucide-react"

interface FAQItem {
  question: string
  answer: string
}

interface FAQCategory {
  title: string
  items: FAQItem[]
}

// ── General / Getting Started ──────────────────────────────────────────────
const generalFAQs: FAQCategory[] = [
  {
    title: "About ParkShare",
    items: [
      {
        question: "What is ParkShare?",
        answer:
          "ParkShare is BCI's internal parking coordination app that allows employees to share their assigned parking spots in Victoria with colleagues for a fee when they are not using them. If you have a parking spot you will not be using on certain days, you can make it available to others. If you need parking, you can rent available spots from your colleagues.",
      },
      {
        question: "Who can use ParkShare?",
        answer:
          "All BCI employees can use ParkShare. You do not need to have an assigned parking spot to use the app — you can rent spots from others even if you do not have one to share.",
      },
      {
        question: "How do I determine \"24 hours notice\" for cancellations?",
        answer:
          "The 24-hour period runs from 12:00 am to 11:59 pm on the day before your reservation. For example, to cancel a Wednesday booking, you must cancel by 11:59 pm on Monday.",
      },
    ],
  },
  {
    title: "Getting Started",
    items: [
      {
        question: "How do I access ParkShare?",
        answer:
          "The ParkShare app can be accessed from your Okta dashboard. You can also download the mobile app — review the \"How To\" video guides for step-by-step instructions.",
      },
      {
        question: "What if I have a technical issue with the app?",
        answer:
          "If you can access the Feedback button in the app, submit your concern there. For other technical inquiries, submit a concern through Service Now.",
      },
      {
        question: "What if I have a physical issue with the parking spot?",
        answer: "Contact Workplace Services at workplaceservices@bci.ca or 778-410-3232.",
      },
    ],
  },
  {
    title: "Searching & Finding Spots",
    items: [
      {
        question: "What can I search for when looking for spots?",
        answer:
          "The search supports multiple fields: spot number, location name, owner name, price, spot type (e.g. \"accessible\", \"EV\"), dates (e.g. \"Feb 20\" or \"March\"), and special labels like \"free\", \"charity\", \"top deal\", or \"weekend\".",
      },
      {
        question: "What do the colored labels on spot cards mean?",
        answer:
          "Labels help you quickly identify special spots. A pink \"Charity\" badge means the owner will donate all proceeds to charity. A green \"Free\" badge means no cost. A blue \"Top Deal\" badge indicates spots priced at $5 or less. An orange \"Weekend\" badge appears for Saturday or Sunday availability.",
      },
      {
        question: "What does the \"PENDING\" badge on a spot mean?",
        answer:
          "A yellow \"PENDING\" badge means another user is currently in the process of booking that spot for a specific date. The lock expires after a short period, so the spot may become available again if the other user doesn't complete their booking.",
      },
    ],
  },
  {
    title: "Electric Vehicle Charging",
    items: [
      {
        question: "Which stalls have EV chargers?",
        answer:
          "Three types of EV chargers are available in the parkade. Tesla chargers are located in stalls 32–34. Single-outlet non-Tesla chargers are in stalls 37–40. Dual-outlet non-Tesla chargers are in stalls 41–42, 51–54, and 91–94.",
      },
      {
        question: "Is EV charging included in the cost?",
        answer:
          "Yes. Use of the EV charger is included in the cost of the parking stall — there is no additional charge for charging your vehicle.",
      },
    ],
  },
]

// ── Renter ─────────────────────────────────────────────────────────────────
const renterFAQs: FAQCategory[] = [
  {
    title: "Booking a Spot",
    items: [
      {
        question: "How do I find and rent a parking spot?",
        answer:
          "Connect to ParkShare from your Okta dashboard. Navigate to \"Find Parking\" from the sidebar to browse available spots. For assistance, review the video guides available in the app.",
      },
      {
        question: "What information do I need to book a spot?",
        answer:
          "You'll need to provide your phone number and vehicle licence plate number. If you've previously saved this information in your profile, it will be auto-filled for you.",
      },
      {
        question: "What happens after I book a spot?",
        answer:
          "Once you book a spot, it will appear under \"Current Bookings\" in your My Bookings page with a \"Confirmed\" status. You'll also receive an email confirmation if you have email notifications enabled.",
      },
    ],
  },
  {
    title: "Payments",
    items: [
      {
        question: "How do I pay for a rented spot?",
        answer:
          "The owner of the spot will specify how they want to be paid (e-transfer or cash). For WPS-managed spots, payment is automatically deducted from payroll in the same calendar month as the parking date.",
      },
      {
        question: "Where can I see all my bookings?",
        answer:
          "Go to \"My Bookings\" from the sidebar. Your bookings are organized into tabs: \"Current Bookings\" for active and confirmed reservations, \"Settle Payment\" for past bookings that need payment, and \"Completed\" for fully settled bookings.",
      },
      {
        question: "Can I download a receipt for my booking?",
        answer:
          "Yes, completed bookings have a \"Download Receipt\" option that generates a PDF with all booking details including spot number, date, amount, and payment status.",
      },
    ],
  },
  {
    title: "Cancellations",
    items: [
      {
        question: "Can I cancel a reservation?",
        answer:
          "You can cancel a reservation up to 24 hours in advance. The 24-hour period runs from 12:00 am to 11:59 pm on the day before the reservation date.",
      },
      {
        question: "Why can't I cancel the spot I just booked for tomorrow?",
        answer:
          "Cancellations cannot be made within 24 hours of the booking date. The 24-hour period runs from 12:00 am to 11:59 pm on the day before the reservation.",
      },
    ],
  },
  {
    title: "Charity & Other",
    items: [
      {
        question: "What if the spot I rented isn't available when I arrive?",
        answer: "Contact Workplace Services at workplaceservices@bci.ca or 778-410-3232.",
      },
      {
        question: "Where does my money go if the spot is advertised as \"charity\"?",
        answer: "It will be independently donated to the charity of choice by the spot owner.",
      },
      {
        question: "Can I get a charity donation receipt?",
        answer: "Tax receipts are not available.",
      },
      {
        question: "What is the difference between BCI-managed spots and peer-to-peer spots?",
        answer:
          "BCI-managed spots are administered by Workplace Services. Peer-to-peer spots are listed by individual spot owners who share their assigned parking. For peer-to-peer spots, you'll see the owner's payment instructions on the card.",
      },
    ],
  },
  {
    title: "Account & Notifications",
    items: [
      {
        question: "How do I update my profile information?",
        answer:
          "Go to \"Profile\" under the Account section in the sidebar. You can update your phone number, vehicle licence plate, and department information.",
      },
      {
        question: "How do I manage my email notifications?",
        answer:
          "In your Profile page, scroll to the email notification preferences section. You can toggle notifications on or off by category including booking confirmations, cancellations, payment reminders, and system updates. There's also a master toggle to enable or disable all email notifications at once.",
      },
    ],
  },
]

// ── Owner ──────────────────────────────────────────────────────────────────
const ownerFAQs: FAQCategory[] = [
  {
    title: "Listing Your Spot",
    items: [
      {
        question: "How do I list my parking spot?",
        answer:
          "Follow the step-by-step video guide in the app. You can list your spot as a single day, a date range (period), or a recurring weekly schedule.",
      },
      {
        question: "What listing types are available?",
        answer:
          "There are three listing types: \"Single Day\" for one specific date, \"Period\" for a continuous date range (e.g. vacation days), and \"Recurring\" for a repeating schedule on selected days of the week within a date range.",
      },
      {
        question: "How far in advance can I list my spot?",
        answer: "You can list your spot up to 3 months in advance.",
      },
      {
        question: "Can I set different prices for different dates?",
        answer:
          "Yes, each listing you create can have its own daily rate. If you create multiple single-day listings for the same spot, each can have a different price.",
      },
      {
        question: "What does the \"Donate to Charity\" option do?",
        answer:
          "When creating a listing, you can check the donate option to commit to donating all booking proceeds to charity. Your spot will display a pink \"Charity\" badge. You are responsible for making that donation independently.",
      },
      {
        question: "Can I list my spot for free?",
        answer:
          "Yes, set the daily rate to $0.00 when creating your listing. The spot will display a green \"Free\" badge to attract renters.",
      },
    ],
  },
  {
    title: "Managing Bookings",
    items: [
      {
        question: "What if I need my spot back after I have listed it?",
        answer:
          "You cannot cancel within 24 hours of a booking. The 24-hour period runs from 12:00 am to 11:59 pm on the day before the booking. You can cancel bookings with more than 24 hours' notice, and renters will automatically be notified.",
      },
      {
        question: "How do I see who booked my spot?",
        answer:
          "Go to \"My Bookings\" and switch to the owner view. The \"Confirm Payment\" tab shows all booked listings with renter details.",
      },
      {
        question: "How does the payment workflow work?",
        answer:
          "It's a two-step process: First, the renter marks payment as sent (\"Mark as Paid\"). Then, you confirm you've received the payment (\"Confirm Payment\"). Once both steps are done, the booking moves to Completed.",
      },
      {
        question: "What happens to expired listings?",
        answer:
          "Listings for dates that have passed without being booked are automatically marked as \"unused\" and removed from the active listings view.",
      },
    ],
  },
  {
    title: "Responsibilities",
    items: [
      {
        question: "What happens if someone damages my spot?",
        answer:
          "According to your lease agreement, you are responsible for any damage to the spot.",
      },
      {
        question: "What are my responsibilities if I list my spot as \"charity\"?",
        answer:
          "You are responsible for donating your parking earnings to the charity of your choice.",
      },
    ],
  },
  {
    title: "Payment & Notifications",
    items: [
      {
        question: "How do I set up my payment instructions?",
        answer:
          "Go to \"Profile\" and fill in your payment preferences. You can specify your preferred payment method (e.g. e-Transfer) and provide instructions for renters. These instructions appear on your spot cards.",
      },
      {
        question: "What email notifications will I receive as an owner?",
        answer:
          "You can receive notifications for booking confirmations, cancellations, payment updates, spot availability changes, and spot assignments. All of these can be individually toggled on or off in your Profile settings.",
      },
    ],
  },
]

// ── Sub-components ─────────────────────────────────────────────────────────
function FAQAccordionItem({ item }: { item: FAQItem }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-start gap-2 w-full text-left py-3 px-1 hover-elevate rounded-md"
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
        ) : (
          <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
        )}
        <span className={`text-sm font-medium ${isOpen ? "text-primary" : "text-foreground"}`}>
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

function ContactFooter() {
  return (
    <div className="mb-5 rounded-md border bg-muted/40 px-4 py-3">
      <p className="text-xs font-semibold text-foreground mb-2">Still need help?</p>
      <div className="flex flex-col gap-1.5">
        <a
          href="mailto:workplaceservices@bci.ca"
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Mail className="h-3.5 w-3.5 shrink-0" />
          workplaceservices@bci.ca
        </a>
        <a
          href="tel:7784103232"
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Phone className="h-3.5 w-3.5 shrink-0" />
          778-410-3232
        </a>
      </div>
    </div>
  )
}

// ── Main dialog ────────────────────────────────────────────────────────────
interface FAQDialogProps {
  children: React.ReactNode
}

export function FAQDialog({ children }: FAQDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[88vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="text-base sm:text-lg">Frequently Asked Questions</DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            Common questions about using BCI ParkShare
          </p>
        </DialogHeader>

        <Tabs defaultValue="general" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="grid w-full grid-cols-3 mx-0 rounded-none border-b px-4 bg-transparent h-10 shrink-0">
            <TabsTrigger value="general" className="gap-1.5 text-xs sm:text-sm rounded-md">
              <Info className="h-3.5 w-3.5" />
              General
            </TabsTrigger>
            <TabsTrigger value="renter" className="gap-1.5 text-xs sm:text-sm rounded-md">
              <Car className="h-3.5 w-3.5" />
              Renter
            </TabsTrigger>
            <TabsTrigger value="owner" className="gap-1.5 text-xs sm:text-sm rounded-md">
              <Key className="h-3.5 w-3.5" />
              Owner
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <TabsContent value="general" className="mt-0 p-4">
              {generalFAQs.map((category, index) => (
                <FAQCategorySection key={index} category={category} />
              ))}
              <ContactFooter />
            </TabsContent>
            <TabsContent value="renter" className="mt-0 p-4">
              {renterFAQs.map((category, index) => (
                <FAQCategorySection key={index} category={category} />
              ))}
              <ContactFooter />
            </TabsContent>
            <TabsContent value="owner" className="mt-0 p-4">
              {ownerFAQs.map((category, index) => (
                <FAQCategorySection key={index} category={category} />
              ))}
              <ContactFooter />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
