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

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

  statsEl.innerHTML = `
    <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Total Bookings</div></div>
    <div class="stat-card"><div class="stat-value">${confirmed}</div><div class="stat-label">Confirmed</div></div>
    <div class="stat-card"><div class="stat-value">${pending}</div><div class="stat-label">Pending</div></div>
    <div class="stat-card"><div class="stat-value">$${totalSpent.toFixed(0)}</div><div class="stat-label">Total Spent</div></div>
  `;
}

function renderBookings(bookings: BookingResult[]) {
  const filtered = currentFilter === "all"
    ? bookings
    : bookings.filter(b => b.status.toLowerCase() === currentFilter);

  countEl.textContent = `${filtered.length} booking${filtered.length !== 1 ? "s" : ""}`;

  if (filtered.length === 0) {
    contentEl.innerHTML = `<div class="empty-state"><p>No ${currentFilter === "all" ? "" : esc(currentFilter) + " "}bookings found</p></div>`;
    return;
  }

  contentEl.innerHTML = `<div class="booking-list">${filtered.map(renderBookingCard).join("")}</div>`;

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

function renderBookingCard(booking: BookingResult): string {
  const canCancel = ["confirmed", "pending"].includes(booking.status.toLowerCase());
  return `
    <div class="booking-card">
      <div class="booking-info">
        <div class="booking-spot">Spot ${esc(booking.spotNumber)}</div>
        <div class="booking-detail">Date: ${esc(booking.bookingDate)}</div>
        <div class="booking-detail">Cost: $${esc(booking.totalAmount)} | Payment: ${esc(booking.paymentStatus)}</div>
      </div>
      <div class="booking-actions">
        <span class="badge ${getStatusBadgeClass(booking.status)}">${esc(booking.status)}</span>
        ${canCancel ? `<button class="btn btn-danger btn-cancel" data-id="${booking.bookingId}">Cancel</button>` : ""}
      </div>
    </div>`;
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
      contentEl.innerHTML = `<div class="empty-state"><p>${esc(text)}</p></div>`;
      return;
    }
    renderStats(allBookings);
    renderBookings(allBookings);
  } catch (err: any) {
    contentEl.innerHTML = `<div class="empty-state"><p>Error: ${esc(err.message)}</p></div>`;
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
