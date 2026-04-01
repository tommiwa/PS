import { addDays, nextFriday, nextMonday, startOfMonth, endOfMonth, format } from "date-fns";

type DiscountType = "percentage" | "fixed_price";
type LabelColor = "fuchsia" | "violet" | "blue" | "green" | "orange" | "red" | "amber" | "rose";

export type PromotionTemplate = {
  name: string;
  calendarLabel: string;
  labelColor: LabelColor;
  startDate: string;
  endDate: string;
  discountType: DiscountType;
  discountValue: number;
  rationale?: string;
  category: "holiday" | "smart" | "creative";
};

function fmt(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function nextWeekday(dayIndex: number): Date {
  const today = new Date();
  const todayIndex = today.getDay();
  const diff = (dayIndex - todayIndex + 7) % 7 || 7;
  return addDays(today, diff);
}

function getNextMonday(): Date {
  const today = new Date();
  if (today.getDay() === 1) return addDays(today, 7);
  return nextMonday(today);
}

function getNextFriday(): Date {
  const today = new Date();
  if (today.getDay() === 5) return addDays(today, 7);
  return nextFriday(today);
}

function getLastFiveDaysOfCurrentMonth(): { start: Date; end: Date } {
  const today = new Date();
  const end = endOfMonth(today);
  const start = addDays(end, -4);
  return { start, end };
}

function getFirstFiveDaysOfNextMonth(): { start: Date; end: Date } {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const start = startOfMonth(nextMonth);
  const end = addDays(start, 4);
  return { start, end };
}

export const HOLIDAY_TEMPLATES: PromotionTemplate[] = [
  {
    name: "Good Friday Long Weekend",
    calendarLabel: "Good Friday Deal",
    labelColor: "green",
    startDate: "2026-04-03",
    endDate: "2026-04-06",
    discountType: "fixed_price",
    discountValue: 9.00,
    category: "holiday",
  },
  {
    name: "Easter Weekend",
    calendarLabel: "Easter Special",
    labelColor: "violet",
    startDate: "2026-04-04",
    endDate: "2026-04-06",
    discountType: "percentage",
    discountValue: 10,
    category: "holiday",
  },
  {
    name: "Mother's Day Weekend",
    calendarLabel: "Mother's Day Deal",
    labelColor: "rose",
    startDate: "2026-05-09",
    endDate: "2026-05-11",
    discountType: "percentage",
    discountValue: 10,
    category: "holiday",
  },
  {
    name: "Victoria Day Long Weekend",
    calendarLabel: "Victoria Day Sale",
    labelColor: "violet",
    startDate: "2026-05-15",
    endDate: "2026-05-18",
    discountType: "percentage",
    discountValue: 15,
    category: "holiday",
  },
  {
    name: "Father's Day Weekend",
    calendarLabel: "Father's Day Deal",
    labelColor: "blue",
    startDate: "2026-06-20",
    endDate: "2026-06-21",
    discountType: "percentage",
    discountValue: 10,
    category: "holiday",
  },
  {
    name: "Canada Day Week",
    calendarLabel: "Canada Day!",
    labelColor: "red",
    startDate: "2026-06-29",
    endDate: "2026-07-03",
    discountType: "fixed_price",
    discountValue: 10.00,
    category: "holiday",
  },
  {
    name: "BC Day Long Weekend",
    calendarLabel: "BC Day Deal",
    labelColor: "blue",
    startDate: "2026-07-31",
    endDate: "2026-08-03",
    discountType: "percentage",
    discountValue: 15,
    category: "holiday",
  },
  {
    name: "Labour Day Long Weekend",
    calendarLabel: "Labour Day Sale",
    labelColor: "amber",
    startDate: "2026-09-04",
    endDate: "2026-09-07",
    discountType: "fixed_price",
    discountValue: 9.00,
    category: "holiday",
  },
  {
    name: "National Day for Truth & Reconciliation",
    calendarLabel: "Orange Shirt Day",
    labelColor: "orange",
    startDate: "2026-09-28",
    endDate: "2026-09-30",
    discountType: "percentage",
    discountValue: 10,
    category: "holiday",
  },
  {
    name: "Thanksgiving Long Weekend",
    calendarLabel: "Thanksgiving Sale",
    labelColor: "amber",
    startDate: "2026-10-09",
    endDate: "2026-10-12",
    discountType: "percentage",
    discountValue: 10,
    category: "holiday",
  },
  {
    name: "Remembrance Day",
    calendarLabel: "Remembrance Week",
    labelColor: "blue",
    startDate: "2026-11-09",
    endDate: "2026-11-11",
    discountType: "fixed_price",
    discountValue: 8.00,
    category: "holiday",
  },
  {
    name: "Christmas Holiday Week",
    calendarLabel: "Holiday Deal",
    labelColor: "green",
    startDate: "2026-12-22",
    endDate: "2026-12-26",
    discountType: "percentage",
    discountValue: 20,
    category: "holiday",
  },
  {
    name: "New Year's Week",
    calendarLabel: "New Year's Special",
    labelColor: "violet",
    startDate: "2026-12-28",
    endDate: "2027-01-02",
    discountType: "fixed_price",
    discountValue: 8.00,
    category: "holiday",
  },
];

export function buildSmartTemplates(): PromotionTemplate[] {
  const nextFri = getNextFriday();
  const nextMon = getNextMonday();
  const nextMonFri = addDays(nextMon, 4);
  const twoWeekEnd = addDays(nextMon, 13);
  const { start: monthEndStart, end: monthEndEnd } = getLastFiveDaysOfCurrentMonth();
  const { start: nextMonthStart, end: nextMonthEnd } = getFirstFiveDaysOfNextMonth();

  return [
    {
      name: "Friday Boost",
      calendarLabel: "Friday Flash",
      labelColor: "rose",
      startDate: fmt(nextFri),
      endDate: fmt(nextFri),
      discountType: "percentage",
      discountValue: 15,
      rationale: "Fridays have 40% fewer bookings than Wednesdays and the lowest avg rate ($10.27) — a discount converts fence-sitters.",
      category: "smart",
    },
    {
      name: "Monday Momentum",
      calendarLabel: "Monday Boost",
      labelColor: "green",
      startDate: fmt(nextMon),
      endDate: fmt(nextMon),
      discountType: "percentage",
      discountValue: 10,
      rationale: "Mondays are the 2nd weakest day — WFH culture suppresses demand; a small nudge moves bookings.",
      category: "smart",
    },
    {
      name: "Full Week Drive",
      calendarLabel: "Full Week Deal",
      labelColor: "fuchsia",
      startDate: fmt(nextMon),
      endDate: fmt(nextMonFri),
      discountType: "percentage",
      discountValue: 12,
      rationale: "5-day block discount to boost weekly occupancy across all spots.",
      category: "smart",
    },
    {
      name: "Two-Week Running Promo",
      calendarLabel: "Promo Period",
      labelColor: "violet",
      startDate: fmt(nextMon),
      endDate: fmt(twoWeekEnd),
      discountType: "percentage",
      discountValue: 10,
      rationale: "Standard 2-week promotional window — a plug-and-play template for any general campaign.",
      category: "smart",
    },
    {
      name: "End of Month Push",
      calendarLabel: "Month-End Deal",
      labelColor: "amber",
      startDate: fmt(monthEndStart),
      endDate: fmt(monthEndEnd),
      discountType: "percentage",
      discountValue: 15,
      rationale: "Fill remaining inventory in the final stretch before month resets.",
      category: "smart",
    },
    {
      name: "Start of Month Launch",
      calendarLabel: "Month Kickoff",
      labelColor: "blue",
      startDate: fmt(nextMonthStart),
      endDate: fmt(nextMonthEnd),
      discountType: "percentage",
      discountValue: 10,
      rationale: "Drive early bookings to establish momentum at the start of a new month.",
      category: "smart",
    },
  ];
}

export function buildCreativeTemplates(): PromotionTemplate[] {
  const nextWed = nextWeekday(3);
  const nextFri = getNextFriday();

  return [
    {
      name: "Back to Office September",
      calendarLabel: "Back to Office!",
      labelColor: "green",
      startDate: "2026-09-01",
      endDate: "2026-09-05",
      discountType: "percentage",
      discountValue: 15,
      rationale: "Post-summer return — employees resume commuting; a welcome-back discount re-establishes parking habits.",
      category: "creative",
    },
    {
      name: "Winter Warmer",
      calendarLabel: "Winter Deal",
      labelColor: "blue",
      startDate: "2027-01-05",
      endDate: "2027-01-16",
      discountType: "fixed_price",
      discountValue: 9.00,
      rationale: "January is historically a slow occupancy month globally; flat low rate encourages bookings over transit alternatives in cold weather.",
      category: "creative",
    },
    {
      name: "Spring Commuter Kickoff",
      calendarLabel: "Spring Special",
      labelColor: "green",
      startDate: "2026-03-16",
      endDate: "2026-03-27",
      discountType: "percentage",
      discountValue: 12,
      rationale: "Seasonal transition — daylight saving + warmer weather brings commuters back; capture the uptick early.",
      category: "creative",
    },
    {
      name: "Beat the Rain",
      calendarLabel: "Rainy Day Deal",
      labelColor: "violet",
      startDate: "2026-10-19",
      endDate: "2026-10-30",
      discountType: "percentage",
      discountValue: 10,
      rationale: "October/November rain drives transit avoidance; lean into it with a parking incentive.",
      category: "creative",
    },
    {
      name: "Midweek Triple Play",
      calendarLabel: "Wed-Thu-Fri Deal",
      labelColor: "fuchsia",
      startDate: fmt(nextWed),
      endDate: fmt(addDays(nextWed, 2)),
      discountType: "percentage",
      discountValue: 10,
      rationale: "Wednesday is peak demand ($14 avg) — bundling it with the weaker Thu/Fri days lifts fill rate on lower days without discounting the peak.",
      category: "creative",
    },
    {
      name: "Office All-Hands Day",
      calendarLabel: "Team Parking Day",
      labelColor: "amber",
      startDate: fmt(nextWed),
      endDate: fmt(nextWed),
      discountType: "fixed_price",
      discountValue: 8.00,
      rationale: "For planned company-wide in-office days — make parking a non-issue and maximize spot fill rate in one shot.",
      category: "creative",
    },
    {
      name: "Early December Blitz",
      calendarLabel: "December Blitz",
      labelColor: "red",
      startDate: "2026-12-01",
      endDate: "2026-12-12",
      discountType: "percentage",
      discountValue: 15,
      rationale: "Capture bookings before the holiday exodus; Dec 15+ traditionally sees sharp drop-off as people take vacation.",
      category: "creative",
    },
    {
      name: "Flash 48",
      calendarLabel: "48hr Flash Sale",
      labelColor: "rose",
      startDate: fmt(nextFri),
      endDate: fmt(addDays(nextFri, 1)),
      discountType: "fixed_price",
      discountValue: 7.00,
      rationale: "Ultra-short flash sale on the weakest days creates urgency; $7 flat rate on a $10-12 Friday spot is a compelling impulse decision.",
      category: "creative",
    },
  ];
}

export const SMART_TEMPLATES: PromotionTemplate[] = buildSmartTemplates();

export const CREATIVE_TEMPLATES: PromotionTemplate[] = buildCreativeTemplates();
