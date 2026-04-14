import { App } from "@modelcontextprotocol/ext-apps";
import { applyHostContext } from "./shared.js";

interface SpotResult {
  listingId: number;
  spotId: number;
  spotNumber: string;
  location: string;
  spotType: string;
  listingType: string;
  dailyRate: string;
  singleDate?: string;
  periodStartDate?: string;
  periodEndDate?: string;
  recurringDays?: string[];
  recurringStartDate?: string;
  recurringEndDate?: string;
  donateToCharity?: boolean;
}

function getSpotDateDisplay(spot: SpotResult): string {
  if (spot.listingType === 'single' && spot.singleDate) {
    return spot.singleDate;
  }
  if (spot.listingType === 'period' && spot.periodStartDate && spot.periodEndDate) {
    return `${spot.periodStartDate} to ${spot.periodEndDate}`;
  }
  if (spot.listingType === 'recurring' && spot.recurringStartDate && spot.recurringEndDate) {
    const days = spot.recurringDays?.join(', ') || '';
    return `${spot.recurringStartDate} to ${spot.recurringEndDate} (${days})`;
  }
  return 'N/A';
}

const contentEl = document.getElementById("content")!;
const countEl = document.getElementById("count")!;
const filterLocationEl = document.getElementById("filter-location") as HTMLInputElement;
const filterDateEl = document.getElementById("filter-date") as HTMLInputElement;
const btnRefresh = document.getElementById("btn-refresh")!;

const app = new App({ name: "ParkShare Spots Search", version: "1.0.0" });

let allSpots: SpotResult[] = [];

function renderSpots(spots: SpotResult[]) {
  if (spots.length === 0) {
    contentEl.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        <p>No available spots found</p>
      </div>`;
    countEl.textContent = "";
    return;
  }
  countEl.textContent = `${spots.length} spot${spots.length !== 1 ? "s" : ""} available`;
  const grid = document.createElement("div");
  grid.className = "spots-grid";
  spots.forEach(spot => grid.appendChild(renderSpotCard(spot)));
  contentEl.replaceChildren(grid);
}

function makeSvg(paths: { tag: string; attrs: Record<string, string> }[]): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "12");
  svg.setAttribute("height", "12");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  for (const { tag, attrs } of paths) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.appendChild(el);
  }
  return svg;
}

function renderSpotCard(spot: SpotResult): HTMLElement {
  const card = document.createElement("div");
  card.className = "spot-card";

  const header = document.createElement("div");
  header.className = "spot-header";

  const nameDiv = document.createElement("div");
  nameDiv.className = "spot-name";
  nameDiv.appendChild(document.createTextNode(`Spot ${spot.spotNumber} `));
  if (spot.donateToCharity) {
    const badge = document.createElement("span");
    badge.className = "badge badge-charity";
    badge.textContent = "Charity";
    nameDiv.appendChild(badge);
  }

  const priceDiv = document.createElement("div");
  priceDiv.className = "spot-price";
  priceDiv.textContent = `$${spot.dailyRate}/day`;

  header.appendChild(nameDiv);
  header.appendChild(priceDiv);

  const locationMeta = document.createElement("div");
  locationMeta.className = "spot-meta";
  locationMeta.appendChild(makeSvg([
    { tag: "path", attrs: { d: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" } },
    { tag: "circle", attrs: { cx: "12", cy: "10", r: "3" } },
  ]));
  locationMeta.appendChild(document.createTextNode(` ${spot.location}`));

  const dateMeta = document.createElement("div");
  dateMeta.className = "spot-meta";
  dateMeta.appendChild(makeSvg([
    { tag: "rect", attrs: { x: "3", y: "4", width: "18", height: "18", rx: "2" } },
    { tag: "line", attrs: { x1: "16", y1: "2", x2: "16", y2: "6" } },
    { tag: "line", attrs: { x1: "8", y1: "2", x2: "8", y2: "6" } },
    { tag: "line", attrs: { x1: "3", y1: "10", x2: "21", y2: "10" } },
  ]));
  dateMeta.appendChild(document.createTextNode(` ${getSpotDateDisplay(spot)}`));

  const badgesDiv = document.createElement("div");
  badgesDiv.className = "spot-badges";

  const typeBadge = document.createElement("span");
  typeBadge.className = "badge badge-type";
  typeBadge.textContent = spot.spotType;

  const listingBadge = document.createElement("span");
  listingBadge.className = "badge badge-listing";
  listingBadge.textContent =
    spot.listingType === 'single' ? 'Single day' :
    spot.listingType === 'period' ? 'Period' :
    spot.listingType === 'recurring' ? 'Recurring' :
    spot.listingType;

  badgesDiv.appendChild(typeBadge);
  badgesDiv.appendChild(listingBadge);

  card.appendChild(header);
  card.appendChild(locationMeta);
  card.appendChild(dateMeta);
  card.appendChild(badgesDiv);
  return card;
}

function filterSpots() {
  const locFilter = filterLocationEl.value.toLowerCase();
  const dateFilter = filterDateEl.value;
  let filtered = allSpots;
  if (locFilter) {
    filtered = filtered.filter(s => s.location.toLowerCase().includes(locFilter));
  }
  if (dateFilter) {
    filtered = filtered.filter(s => {
      if (s.listingType === 'single') return s.singleDate === dateFilter;
      if (s.listingType === 'period') return s.periodStartDate && s.periodEndDate && dateFilter >= s.periodStartDate && dateFilter <= s.periodEndDate;
      if (s.listingType === 'recurring') {
        if (!s.recurringStartDate || !s.recurringEndDate) return false;
        if (dateFilter < s.recurringStartDate || dateFilter > s.recurringEndDate) return false;
        const dow = new Date(dateFilter).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        return s.recurringDays?.map(d => d.toLowerCase()).includes(dow) ?? false;
      }
      return true;
    });
  }
  renderSpots(filtered);
}

async function loadSpots(location?: string, date?: string) {
  contentEl.innerHTML = `<div class="loading">Loading available spots...</div>`;
  try {
    const args: Record<string, string> = {};
    if (location) args.location = location;
    if (date) args.date = date;
    const result = await app.callServerTool({ name: "search_available_spots", arguments: args });
    const text = result.content?.find((c: any) => c.type === "text")?.text ?? "[]";
    try {
      allSpots = JSON.parse(text);
    } catch {
      allSpots = [];
      const parseErrDiv = document.createElement("div");
      parseErrDiv.className = "empty-state";
      const parseErrP = document.createElement("p");
      parseErrP.textContent = text;
      parseErrDiv.appendChild(parseErrP);
      contentEl.replaceChildren(parseErrDiv);
      return;
    }
    renderSpots(allSpots);
  } catch (err: any) {
    const errDiv = document.createElement("div");
    errDiv.className = "empty-state";
    const errP = document.createElement("p");
    errP.textContent = `Error loading spots: ${err.message}`;
    errDiv.appendChild(errP);
    contentEl.replaceChildren(errDiv);
  }
}

app.ontoolresult = (result) => {
  const text = result.content?.find((c: any) => c.type === "text")?.text ?? "";
  try {
    allSpots = JSON.parse(text);
  } catch {
    allSpots = [];
  }
  renderSpots(allSpots);
};

filterLocationEl.addEventListener("input", filterSpots);
filterDateEl.addEventListener("change", filterSpots);
btnRefresh.addEventListener("click", () => loadSpots());

app.onhostcontextchanged = applyHostContext;
app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) applyHostContext(ctx);
  loadSpots();
});
