import { format, formatDistanceToNow, isToday, isYesterday, isThisWeek, parseISO } from "date-fns";

/**
 * Formats a date into a human-readable relative format
 * - "Today at 4:39 PM"
 * - "Yesterday at 2:15 AM"
 * - "Saturday at 11:53 PM"
 * - Older dates: "Mar 12, 2026"
 */
export function formatRelativeDate(date: string | Date): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date;

  if (isToday(dateObj)) {
    return `Today at ${format(dateObj, "h:mm a")}`;
  }

  if (isYesterday(dateObj)) {
    return `Yesterday at ${format(dateObj, "h:mm a")}`;
  }

  if (isThisWeek(dateObj, { weekStartsOn: 0 })) {
    return `${format(dateObj, "EEEE")} at ${format(dateObj, "h:mm a")}`;
  }

  return format(dateObj, "MMM d, yyyy");
}

/**
 * Formats a date for filter display (short format)
 */
export function formatDateShort(date: Date): string {
  return format(date, "MMM d, yyyy");
}

/**
 * Gets the date X days ago from now
 */
export function getDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Gets the start of today
 */
export function getStartOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Checks if a date is within a date range
 */
export function isWithinDateRange(date: string | Date, startDate?: Date, endDate?: Date): boolean {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  
  if (startDate && dateObj < startDate) {
    return false;
  }
  
  if (endDate && dateObj > endDate) {
    return false;
  }
  
  return true;
}
