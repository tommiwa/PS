import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: unknown): string {
  const n = Number(value);
  const safe = isFinite(n) ? n : 0;
  return safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function isNewFeature(introducedOn: Date, newBadgeDays = 30): boolean {
  const now = new Date();
  const diffMs = now.getTime() - introducedOn.getTime();
  if (diffMs < 0) return false;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays < newBadgeDays;
}
