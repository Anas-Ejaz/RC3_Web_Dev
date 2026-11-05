import { clsx, type ClassValue } from "clsx";
import { format, formatDistanceToNow } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string): string {
  return format(new Date(iso), "MMM d, yyyy");
}

export function formatDateTime(iso: string): string {
  return format(new Date(iso), "MMM d, yyyy 'at' h:mm a");
}

export function timeAgo(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatSalary(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (min == null && max == null) return "Salary not disclosed";
  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });
  if (min != null && max != null) return `${fmt.format(min)} – ${fmt.format(max)}`;
  return fmt.format((min ?? max) as number);
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}