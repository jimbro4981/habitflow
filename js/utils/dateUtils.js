/**
 * HabitFlow - Date Utilities
 * Pure date helper functions used throughout the app.
 */

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Format a Date object as YYYY-MM-DD.
 * @param {Date} date
 * @returns {string}
 */
export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse a YYYY-MM-DD string into a local Date (midnight).
 * @param {string} dateStr
 * @returns {Date}
 */
export function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Get today's date as a YYYY-MM-DD string.
 * @returns {string}
 */
export function getToday() {
  return formatDate(new Date());
}

/**
 * Check whether a YYYY-MM-DD string represents today.
 * @param {string} dateStr
 * @returns {boolean}
 */
export function isToday(dateStr) {
  return dateStr === getToday();
}

/**
 * Get the abbreviated day-of-week name (Mon, Tue, …).
 * @param {Date} date
 * @returns {string}
 */
export function getDayName(date) {
  return DAY_NAMES[date.getDay()];
}

/**
 * Get the abbreviated month name (Jan, Feb, …).
 * @param {Date} date
 * @returns {string}
 */
export function getMonthName(date) {
  return MONTH_NAMES_SHORT[date.getMonth()];
}

/**
 * Get the full month name (January, February, …).
 * @param {Date} date
 * @returns {string}
 */
export function getFullMonthName(date) {
  return MONTH_NAMES_FULL[date.getMonth()];
}

/**
 * Return an inclusive array of YYYY-MM-DD strings between two dates.
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {string[]}
 */
export function getDateRange(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Get the Monday that starts the ISO week containing `date`.
 * @param {Date} date
 * @returns {Date}
 */
export function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? 6 : day - 1; // distance back to Monday
  d.setDate(d.getDate() - diff);
  return d;
}

/**
 * Get an array of the last N days as YYYY-MM-DD strings (most recent last).
 * @param {number} n
 * @returns {string[]}
 */
export function getLastNDays(n) {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(formatDate(d));
  }
  return days;
}

/**
 * Return a human-readable relative date string.
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {string}
 */
export function getRelativeDate(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseDate(dateStr);
  const diffMs = today.getTime() - target.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays === -1) return 'Tomorrow';
  if (diffDays > 1 && diffDays <= 7) return `${diffDays} days ago`;
  if (diffDays < -1 && diffDays >= -7) return `in ${Math.abs(diffDays)} days`;

  return formatDisplayDate(parseDate(dateStr));
}

/**
 * Format a Date for display, e.g. "Jun 11, 2026".
 * @param {Date} date
 * @returns {string}
 */
export function formatDisplayDate(date) {
  const month = getMonthName(date);
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}, ${year}`;
}
