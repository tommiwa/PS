import { App } from "@modelcontextprotocol/ext-apps";
import { applyHostContext } from "./shared.js";

const contentEl = document.getElementById("content")!;
const roleTabsEl = document.getElementById("role-tabs")!;

const app = new App({ name: "ParkShare Stats", version: "1.0.0" });

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let currentRole = "renter";

function renderRenterStats(data: any) {
  const totalBookings = data.totalBookings ?? 0;
  const totalSpending = data.totalSpending ?? '$0.00';
  const stats = [
    { label: "Total Bookings", value: totalBookings, color: "color-blue" },
    { label: "Active Bookings", value: data.activeBookings ?? 0, color: "color-green" },
    { label: "Total Spent", value: totalSpending, color: "color-purple" },
    { label: "Completed", value: data.completedBookings ?? 0, color: "color-amber" },
    { label: "Cancelled", value: data.cancelledBookings ?? 0, color: "color-rose" },
    { label: "Favorite Location", value: data.favoriteLocation ?? "N/A", color: "color-cyan", isText: true },
  ];

  const html = `<div class="stats-grid">${stats.map(s => `
    <div class="stat-card ${s.color}">
      <div class="stat-value" ${(s as any).isText ? 'style="font-size:14px"' : ''}>${escapeHtml(s.value)}</div>
      <div class="stat-label">${s.label}</div>
    </div>`).join("")}</div>`;

  contentEl.innerHTML = html;
}

function renderOwnerStats(data: any) {
  const stats = [
    { label: "Total Listings", value: data.totalListings ?? 0, color: "color-blue" },
    { label: "Active Listings", value: data.activeListings ?? 0, color: "color-green" },
    { label: "Total Revenue", value: data.totalRevenue ?? '$0.00', color: "color-purple" },
    { label: "Bookings Received", value: data.totalBookingsReceived ?? 0, color: "color-amber" },
    { label: "Booked Listings", value: data.bookedListings ?? 0, color: "color-cyan" },
    { label: "Confirmed", value: data.confirmedBookings ?? 0, color: "color-rose" },
    { label: "Completed", value: data.completedBookings ?? 0, color: "color-blue" },
  ];

  const html = `<div class="stats-grid">${stats.map(s => `
    <div class="stat-card ${s.color}">
      <div class="stat-value">${escapeHtml(s.value)}</div>
      <div class="stat-label">${s.label}</div>
    </div>`).join("")}</div>`;

  contentEl.innerHTML = html;
}

async function loadStats(role: string) {
  contentEl.innerHTML = `<div class="loading">Loading ${escapeHtml(role)} statistics...</div>`;
  try {
    const toolName = role === "renter" ? "get_renter_stats" : "get_owner_stats";
    const result = await app.callServerTool({ name: toolName, arguments: {} });
    const text = result.content?.find((c: any) => c.type === "text")?.text ?? "{}";
    let data: any;
    try { data = JSON.parse(text); } catch { data = {}; }
    if (role === "renter") {
      renderRenterStats(data);
    } else {
      renderOwnerStats(data);
    }
  } catch (err: any) {
    const errDiv = document.createElement("div");
    errDiv.className = "empty-state";
    const errP = document.createElement("p");
    errP.textContent = `Error: ${err.message}`;
    errDiv.appendChild(errP);
    contentEl.replaceChildren(errDiv);
  }
}

app.ontoolresult = (result) => {
  const text = result.content?.find((c: any) => c.type === "text")?.text ?? "";
  try {
    const data = JSON.parse(text);
    if (currentRole === "renter") renderRenterStats(data);
    else renderOwnerStats(data);
  } catch { /* ignore */ }
};

roleTabsEl.addEventListener("click", (e) => {
  const tab = (e.target as HTMLElement).closest(".tab") as HTMLElement | null;
  if (!tab) return;
  roleTabsEl.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  tab.classList.add("active");
  currentRole = tab.getAttribute("data-role") || "renter";
  loadStats(currentRole);
});

app.onhostcontextchanged = applyHostContext;
app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) applyHostContext(ctx);
  loadStats(currentRole);
});
