export type SaleBadgeColor = "fuchsia" | "violet" | "blue" | "green" | "orange" | "red" | "amber" | "rose";

export const SALE_COLOR_OPTIONS: { value: SaleBadgeColor; label: string }[] = [
  { value: "fuchsia", label: "Fuchsia" },
  { value: "violet", label: "Violet" },
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "orange", label: "Orange" },
  { value: "red", label: "Red" },
  { value: "amber", label: "Amber" },
  { value: "rose", label: "Rose" },
];

// Subtle badge classes (light bg, colored text) — used in booking form, calendar, spot cards
export const SALE_BADGE_SUBTLE: Record<SaleBadgeColor, string> = {
  fuchsia: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 hover:bg-fuchsia-200 dark:bg-fuchsia-900/30 dark:text-fuchsia-300 dark:border-fuchsia-700",
  violet:  "bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700",
  blue:    "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
  green:   "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700",
  orange:  "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700",
  red:     "bg-red-100 text-red-700 border-red-200 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
  amber:   "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
  rose:    "bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700",
};

// Solid badge classes (dark bg, white text) — used on spot cards for high-contrast pop
export const SALE_BADGE_SOLID: Record<SaleBadgeColor, string> = {
  fuchsia: "bg-fuchsia-600 text-white border-fuchsia-700 hover:bg-fuchsia-700",
  violet:  "bg-violet-600 text-white border-violet-700 hover:bg-violet-700",
  blue:    "bg-blue-600 text-white border-blue-700 hover:bg-blue-700",
  green:   "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700",
  orange:  "bg-orange-500 text-white border-orange-600 hover:bg-orange-600",
  red:     "bg-red-600 text-white border-red-700 hover:bg-red-700",
  amber:   "bg-amber-500 text-white border-amber-600 hover:bg-amber-600",
  rose:    "bg-rose-600 text-white border-rose-700 hover:bg-rose-700",
};

// Dot preview color (for color picker swatches)
export const SALE_COLOR_DOT: Record<SaleBadgeColor, string> = {
  fuchsia: "bg-fuchsia-500",
  violet:  "bg-violet-500",
  blue:    "bg-blue-500",
  green:   "bg-emerald-500",
  orange:  "bg-orange-500",
  red:     "bg-red-500",
  amber:   "bg-amber-500",
  rose:    "bg-rose-500",
};

export function getSaleBadgeClasses(color: string | null | undefined, variant: "subtle" | "solid" = "subtle"): string {
  const safeColor = (color as SaleBadgeColor) || "fuchsia";
  return variant === "solid" ? (SALE_BADGE_SOLID[safeColor] ?? SALE_BADGE_SOLID.fuchsia) : (SALE_BADGE_SUBTLE[safeColor] ?? SALE_BADGE_SUBTLE.fuchsia);
}
