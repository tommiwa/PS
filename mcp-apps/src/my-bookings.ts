import { App } from "@modelcontextprotocol/ext-apps";
import { applyHostContext } from "./shared.js";

interface BookingResult {
  bookingId: number;
  spotNumber: string;
  bookingDate: string;
  status: string;
  dailyRate: string;
  totalAmount: string;
  paymentStatus: string;
  createdAt: string;
}

const contentEl = document.getElementById("content")!;
const countEl = document.getElementById("count")!;
const statsEl = document.getElementById("stats")!;
const tabsEl = document.getElementById("tabs")!;

const app = new App({ name: "ParkShare My Bookings", version: "1.0.0" });

let allBookings: BookingResult[] = [];
let currentFilter = "all";

function setEmptyState(message: string): void {
  const div = document.createElement("div");
  div.className = "empty-state";
  const p = document.createElement("p");
  p.textContent = message;
  div.appendChild(p);
  contentEl.replaceChildren(div);
}

function getStatusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case "confirmed": return "badge-confirmed";
    case "pending": return "badge-pending";
    case "cancelled": return "badge-cancelled";
    case "completed": return "badge-completed";
    default: return "";
  }
}

function renderStats(bookings: BookingResult[]) {
  const total = bookings.length;
  const confirmed = bookings.filter(b => b.status.toLowerCase() === "confirmed").length;
  const pending = bookings.filter(b => b.status.toLowerCase() === "pending").length;
  const totalSpent = bookings
    .filter(b => b.status.toLowerCase() !== "cancelled")
    .reduce((sum, b) => sum + parseFloat(b.totalAmount || "0"), 0);

  const statItems = [
    { value: String(total), label: "Total Bookings" },
    { value: String(confirmed), label: "Confirmed" },
    { value: String(pending), label: "Pending" },
    { value: `$${totalSpent.toFixed(0)}`, label: "Total Spent" },
  ];
  statsEl.replaceChildren(
    ...statItems.map(({ value, label }) => {
      const card = document.createElement("div");
      card.className = "stat-card";
      const valEl = document.createElement("div");
      valEl.className = "stat-value";
      valEl.textContent = value;
      const labelEl = document.createElement("div");
      labelEl.className = "stat-label";
      labelEl.textContent = label;
      card.appendChild(valEl);
      card.appendChild(labelEl);
      return card;
    })
  );
}

function renderBookings(bookings: BookingResult[]) {
  const filtered = currentFilter === "all"
    ? bookings
    : bookings.filter(b => b.status.toLowerCase() === currentFilter);

  countEl.textContent = `${filtered.length} booking${filtered.length !== 1 ? "s" : ""}`;

  if (filtered.length === 0) {
    setEmptyState(`No ${currentFilter === "all" ? "" : currentFilter + " "}bookings found`);
    return;
  }

  const list = document.createElement("div");
  list.className = "booking-list";
  filtered.forEach(booking => list.appendChild(renderBookingCard(booking)));
  contentEl.replaceChildren(list);

  contentEl.querySelectorAll(".btn-cancel").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = (e.target as HTMLElement).getAttribute("data-id");
      if (!id) return;
      (e.target as HTMLButtonElement).disabled = true;
      (e.target as HTMLButtonElement).textContent = "Cancelling...";
      try {
        await app.callServerTool({ name: "cancel_booking", arguments: { bookingId: parseInt(id) } });
        await loadBookings();
      } catch (err: any) {
        alert("Failed to cancel: " + err.message);
        (e.target as HTMLButtonElement).disabled = false;
        (e.target as HTMLButtonElement).textContent = "Cancel";
      }
    });
  });
}

function renderBookingCard(booking: BookingResult): HTMLElement {
  const canCancel = ["confirmed", "pending"].includes(booking.status.toLowerCase());

  const card = document.createElement("div");
  card.className = "booking-card";

  const info = document.createElement("div");
  info.className = "booking-info";

  const spot = document.createElement("div");
  spot.className = "booking-spot";
  spot.textContent = `Spot ${booking.spotNumber}`;

  const dateEl = document.createElement("div");
  dateEl.className = "booking-detail";
  dateEl.textContent = `Date: ${booking.bookingDate}`;

  const cost = document.createElement("div");
  cost.className = "booking-detail";
  cost.textContent = `Cost: $${booking.totalAmount} | Payment: ${booking.paymentStatus}`;

  info.append(spot, dateEl, cost);

  const actions = document.createElement("div");
  actions.className = "booking-actions";

  const badge = document.createElement("span");
  badge.className = `badge ${getStatusBadgeClass(booking.status)}`;
  badge.textContent = booking.status;
  actions.appendChild(badge);

  if (canCancel) {
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-danger btn-cancel";
    cancelBtn.dataset.id = String(booking.bookingId);
    cancelBtn.textContent = "Cancel";
    actions.appendChild(cancelBtn);
  }

  card.append(info, actions);
  return card;
}

async function loadBookings() {
  contentEl.innerHTML = `<div class="loading">Loading your bookings...</div>`;
  try {
    const result = await app.callServerTool({ name: "get_my_bookings", arguments: {} });
    const text = result.content?.find((c: any) => c.type === "text")?.text ?? "[]";
    try {
      allBookings = JSON.parse(text);
    } catch {
      allBookings = [];
      setEmptyState(text);
      return;
    }
    renderStats(allBookings);
    renderBookings(allBookings);
  } catch (err: any) {
    setEmptyState(`Error: ${err.message}`);
  }
}

app.ontoolresult = (result) => {
  const text = result.content?.find((c: any) => c.type === "text")?.text ?? "";
  try { allBookings = JSON.parse(text); } catch { allBookings = []; }
  renderStats(allBookings);
  renderBookings(allBookings);
};

tabsEl.addEventListener("click", (e) => {
  const tab = (e.target as HTMLElement).closest(".tab") as HTMLElement | null;
  if (!tab) return;
  tabsEl.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  tab.classList.add("active");
  currentFilter = tab.getAttribute("data-filter") || "all";
  renderBookings(allBookings);
});

app.onhostcontextchanged = applyHostContext;
app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) applyHostContext(ctx);
  loadBookings();
});
