/**
 * DateTime Utilities - AUTHORITATIVE DOCUMENTATION
 * 
 * This is the single source of truth for datetime handling in this application.
 * All other documentation (CONTRIBUTING.md) references this file.
 * 
 * Strategy: UTC Storage + Consistent Display
 * 
 * Architecture:
 * - 🗄️ Database/Backend: Stores everything in UTC (PostgreSQL/Prisma requirement - not optional)
 *   - PostgreSQL DateTime columns store in UTC by default (not configurable)
 *   - Prisma/Wasp expect UTC and handle conversion automatically
 *   - JavaScript Date objects are UTC internally
 * - 🌐 Frontend: LOCKED to configured timezone (Africa/Kinshasa) for ALL user-facing operations
 *   - Display: All formatting uses timeZone: TIMEZONE (configured in constants.ts)
 *   - Input: All date strings interpreted as if in configured timezone
 *   - Comparisons: All day comparisons use timezone-aware functions
 * - 🚫 Browser timezone: NEVER used for business logic
 * 
 * Why UTC storage?
 * - PostgreSQL DateTime columns store in UTC by default (not configurable)
 * - Prisma/Wasp expect UTC and handle conversion automatically
 * - JavaScript Date objects are UTC internally
 * - Industry standard: avoids server timezone issues, DST problems, deployment region differences
 * 
 * The frontend "thinks" in the configured timezone - UTC is just an implementation detail
 * handled automatically by the database and framework layers.
 * 
 * Enforcement:
 * - ESLint rules in eslint.config.js automatically prevent violations
 * - TypeScript provides type safety
 * - All Date operations MUST use utilities from this file
 * 
 * Rules (Enforced by ESLint):
 * ✅ ONLY use: Utilities from this file
 *   - format(), parse(), fromDate(), fromDateTime(), now(), isPast(), isAfter(), isSameDay()
 *   - formatDateOnly(), toTimeInput(), startOfDay(), endOfDay(), formatRelative(), getYear()
 *   - addDays(), addMinutes()
 * ❌ NEVER use directly:
 *   - new Date('...') with arguments (use parse() or fromDate())
 *   - .toISOString(), .toLocaleString(), .toLocaleDateString(), .toLocaleTimeString() (use format())
 *   - .getFullYear(), .getMonth(), .getDate(), .getHours(), .getMinutes(), .getSeconds() (use timezone-aware utilities)
 *   - .setHours(), .setMinutes(), .setDate(), etc. (use startOfDay(), endOfDay(), addDays(), etc.)
 *   - Timestamp constants (86400000, 3600000, etc.) or *Ms properties
 *   - Deprecated functions: formatDateTime(), formatTime(), formatDate()
 */

import { TIMEZONE } from '../constants';
import { i18nInstance } from '../translations/i18n';
import { fromZonedTime } from 'date-fns-tz';

/**
 * Format a Date object for display in configured timezone (Africa/Kinshasa)
 * @param date - Date object (stored in UTC)
 * @param options - Intl.DateTimeFormatOptions (timeZone is automatically set to configured timezone)
 * @returns Formatted date string in configured timezone
 * @example
 * format(now()) // "10 Nov 2025, 14:30"
 * format(date, { dateStyle: 'short' }) // "10/11/25"
 * format(date, { timeStyle: 'short' }) // "14:30"
 */
export const format = (date: Date, options: Intl.DateTimeFormatOptions = {}) => {
  // If dateStyle or timeStyle are provided, use them directly (can't mix with explicit options)
  if ('dateStyle' in options || 'timeStyle' in options) {
    return date.toLocaleString(undefined, { ...options, timeZone: options.timeZone ?? TIMEZONE });
  }
  // Otherwise use explicit defaults
  const defaults: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TIMEZONE };
  return date.toLocaleString(undefined, { ...defaults, ...options, timeZone: options.timeZone ?? TIMEZONE });
};

/**
 * Parse date string (YYYY-MM-DD) and time string (HH:MM) into UTC Date object
 * Interprets input as wall-clock time in configured timezone (Africa/Kinshasa)
 * @param date - Date string in YYYY-MM-DD format
 * @param time - Time string in HH:MM format
 * @returns Date object in UTC
 * @example
 * fromDateTime('2025-11-10', '14:30') // Returns UTC Date for 14:30 in Africa/Kinshasa
 */
export const fromDateTime = (date: string, time: string) => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return fromZonedTime(new Date(y ?? 0, (m ?? 1) - 1, d ?? 1, h ?? 0, min ?? 0), TIMEZONE);
};

/**
 * Parse date string (YYYY-MM-DD) as midnight in configured timezone
 * @param date - Date string in YYYY-MM-DD format
 * @returns Date object in UTC representing midnight in configured timezone
 * @example
 * fromDate('2025-11-10') // Returns UTC Date for 00:00 on Nov 10 in Africa/Kinshasa
 */
export const fromDate = (date: string) => fromDateTime(date, '00:00');

/**
 * Parse a date string into a Date object
 * - Date-only strings (YYYY-MM-DD): Interpreted as midnight in configured timezone
 * - ISO strings or other formats: Already in UTC, parsed directly
 * @param dateString - Date string to parse
 * @returns Date object in UTC
 * @example
 * parse('2025-11-10') // Returns UTC Date for midnight Nov 10 in Africa/Kinshasa
 * parse('2025-11-10T14:30:00Z') // Returns UTC Date from ISO string
 */
export const parse = (dateString: string) => {
  // Date-only strings (YYYY-MM-DD) should be interpreted in configured timezone
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return fromDate(dateString);
  }
  // ISO strings or other formats are already in UTC, so use new Date() directly
  return new Date(dateString);
};

/** Get current date/time in UTC */
export const now = () => new Date();

/** Check if date A is after date B (UTC comparison) */
export const isAfter = (a: Date, b: Date) => a > b;

/** Check if date is in the past (UTC comparison) */
export const isPast = (date: Date) => {
  // Compare dates in UTC (both are Date objects, so this is correct)
  // But we need to ensure we're comparing the actual time, not timezone-adjusted display time
  return date < now();
};

/** Add days to a date (UTC arithmetic) */
export const addDays = (date: Date, days: number) => new Date(date.valueOf() + days * 24 * 60 * 60 * 1000);

/** Add minutes to a date (UTC arithmetic) */
export const addMinutes = (date: Date, minutes: number) => new Date(date.valueOf() + minutes * 60 * 1000);

/**
 * Format date as YYYY-MM-DD for input fields in configured timezone
 * @param date - Date object (stored in UTC)
 * @returns Date string in YYYY-MM-DD format (as displayed in configured timezone)
 */
export const formatDateOnly = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TIMEZONE }).formatToParts(date);
  return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
};

/**
 * Check if two dates are on the same day in configured timezone
 * @param date1 - First date
 * @param date2 - Second date
 * @returns true if both dates fall on the same day in configured timezone
 */
export const isSameDay = (date1: Date, date2: Date) => formatDateOnly(date1) === formatDateOnly(date2);

/**
 * Format time as HH:MM for input fields in configured timezone
 * @param date - Date object (stored in UTC)
 * @returns Time string in HH:MM format (24-hour, as displayed in configured timezone)
 */
export const toTimeInput = (date: Date) => {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TIMEZONE }).format(date);
};

/**
 * Get start of day (00:00:00) in UTC for a given date in configured timezone
 * @param date - Date object (stored in UTC)
 * @returns Date object representing midnight in configured timezone for that date
 */
export const startOfDay = (date: Date) => fromDateTime(formatDateOnly(date), '00:00');

/**
 * Get end of day (23:59:59.999) in UTC for a given date in configured timezone
 * @param date - Date object (stored in UTC)
 * @returns Date object representing end of day in configured timezone for that date
 */
export const endOfDay = (date: Date) => {
  const dayEnd = fromDateTime(formatDateOnly(date), '23:59');
  return new Date(dayEnd.valueOf() + 59 * 1000 + 999);
};

/**
 * Format date with relative text (Today/Yesterday/Tomorrow) and time
 * @param date - Date object (stored in UTC)
 * @returns Formatted string like "Today 14:30" or "10 Nov 2025, 14:30"
 */
export const formatRelative = (date: Date) => {
  const dayDiff = Math.round((startOfDay(date).valueOf() - startOfDay(now()).valueOf()) / (24 * 60 * 60 * 1000));
  const timeString = format(date, { hour: '2-digit', minute: '2-digit', hour12: false });
  
  if (dayDiff === 0) return `${i18nInstance.t('date.today')} ${timeString}`;
  if (dayDiff === -1) return `${i18nInstance.t('date.yesterday')} ${timeString}`;
  if (dayDiff === 1) return `${i18nInstance.t('date.tomorrow')} ${timeString}`;
  
  return `${format(date, { day: '2-digit', month: '2-digit', year: 'numeric' })} ${timeString}`;
};

/**
 * Get year in configured timezone (for date pickers, etc.)
 * @param date - Date object (stored in UTC)
 * @returns Year number as displayed in configured timezone
 */
export const getYear = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-GB', { year: 'numeric', timeZone: TIMEZONE }).formatToParts(date);
  return parseInt(parts.find(p => p.type === 'year')?.value ?? '0', 10);
};
