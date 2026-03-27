import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const NEW_FEATURE_DAYS = 30;

export function isNewFeature(introducedOn: Date): boolean {
  const now = new Date();
  const diffMs = now.getTime() - introducedOn.getTime();
  if (diffMs < 0) return false;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays < NEW_FEATURE_DAYS;
}
