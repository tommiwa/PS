import { App } from "@modelcontextprotocol/ext-apps";
import { applyHostContext } from "./shared.js";

const contentEl = document.getElementById("content")!;
const roleTabsEl = document.getElementById("role-tabs")!;

const app = new App({ name: "ParkShare Stats", version: "1.0.0" });

let currentRole = "renter";

type StatEntry = { label: string; value: unknown; color: string; isText?: boolean };

function buildStatsGrid(stats: StatEntry[]): HTMLElement {
  const grid = document.createElement("div");
  grid.className = "stats-grid";
  for (const s of stats) {
    const card = document.createElement("div");
    card.className = `stat-card ${s.color}`;

    const valueEl = document.createElement("div");
    valueEl.className = "stat-value";
    if (s.isText) valueEl.style.fontSize = "14px";
    valueEl.textContent = String(s.value ?? "");

    const labelEl = document.createElement("div");
    labelEl.className = "stat-label";
    labelEl.textContent = s.label;

    card.appendChild(valueEl);
    card.appendChild(labelEl);
    grid.appendChild(card);
  }
  return grid;
}

function renderRenterStats(data: any) {
  const stats: StatEntry[] = [
    { label: "Total Bookings", value: data.totalBookings ?? 0, color: "color-blue" },
    { label: "Active Bookings", value: data.activeBookings ?? 0, color: "color-green" },
    { label: "Total Spent", value: data.totalSpending ?? '$0.00', color: "color-purple" },
    { label: "Completed", value: data.completedBookings ?? 0, color: "color-amber" },
    { label: "Cancelled", value: data.cancelledBookings ?? 0, color: "color-rose" },
    { label: "Favorite Location", value: data.favoriteLocation ?? "N/A", color: "color-cyan", isText: true },
  ];
  contentEl.replaceChildren(buildStatsGrid(stats));
}

function renderOwnerStats(data: any) {
  const stats: StatEntry[] = [
    { label: "Total Listings", value: data.totalListings ?? 0, color: "color-blue" },
    { label: "Active Listings", value: data.activeListings ?? 0, color: "color-green" },
    { label: "Total Revenue", value: data.totalRevenue ?? '$0.00', color: "color-purple" },
    { label: "Bookings Received", value: data.totalBookingsReceived ?? 0, color: "color-amber" },
    { label: "Booked Listings", value: data.bookedListings ?? 0, color: "color-cyan" },
    { label: "Confirmed", value: data.confirmedBookings ?? 0, color: "color-rose" },
    { label: "Completed", value: data.completedBookings ?? 0, color: "color-blue" },
  ];
  contentEl.replaceChildren(buildStatsGrid(stats));
}

async function loadStats(role: string) {
  const loadingDiv = document.createElement("div");
  loadingDiv.className = "loading";
  loadingDiv.textContent = `Loading ${role} statistics...`;
  contentEl.replaceChildren(loadingDiv);
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
