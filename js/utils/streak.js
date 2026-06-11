/**
 * HabitFlow - Streak & Completion Analytics
 * Calculates streaks, completion rates, and weekly chart data.
 */

import { formatDate, getToday, getLastNDays, getWeekStart } from './dateUtils.js';

/**
 * Calculate streak data for a habit given its completion dates.
 *
 * @param {string[]} completionDates - Array of YYYY-MM-DD strings.
 * @returns {{ current: number, longest: number, total: number }}
 */
export function calculateStreak(completionDates) {
  if (!completionDates || completionDates.length === 0) {
    return { current: 0, longest: 0, total: 0 };
  }

  // Deduplicate and sort ascending
  const sorted = [...new Set(completionDates)].sort();
  const dateSet = new Set(sorted);

  // --- Current streak (walk backwards from today) ---
  const today = getToday();
  let current = 0;

  if (dateSet.has(today)) {
    // Today is completed — count backwards from today
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (dateSet.has(formatDate(cursor))) {
      current++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }
  // If today is NOT completed the current streak is 0,
  // even if yesterday was completed.

  // --- Longest streak (scan all sorted dates) ---
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T00:00:00');
    const curr = new Date(sorted[i] + 'T00:00:00');
    const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  return {
    current,
    longest,
    total: sorted.length,
  };
}

/**
 * Get completion rate for the last N days.
 *
 * @param {string[]} completionDates - Array of YYYY-MM-DD strings.
 * @param {number} [days=30]
 * @returns {number} 0–100
 */
export function getCompletionRate(completionDates, days = 30) {
  if (days <= 0) return 0;

  const dateSet = new Set(completionDates);
  const lastN = getLastNDays(days);
  let count = 0;

  for (const d of lastN) {
    if (dateSet.has(d)) count++;
  }

  return Math.round((count / days) * 100);
}

/**
 * Get weekly completion data for charting.
 *
 * Each entry represents one ISO week (Mon–Sun).
 *
 * @param {string[]} completionDates - Array of YYYY-MM-DD strings.
 * @param {number} [weeks=12]
 * @returns {{ week: string, completed: number, total: number }[]}
 */
export function getWeeklyData(completionDates, weeks = 12) {
  const dateSet = new Set(completionDates);
  const result = [];

  // Start from the Monday of the current week and go back
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentWeekStart = getWeekStart(today);

  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() - w * 7);

    let completed = 0;
    let total = 0;
    for (let d = 0; d < 7; d++) {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + d);

      // Don't count future days
      if (day > today) break;

      total++;
      if (dateSet.has(formatDate(day))) completed++;
    }

    // Label: "Jun 2" (month + day of Monday)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const label = `${monthNames[weekStart.getMonth()]} ${weekStart.getDate()}`;

    result.push({ week: label, completed, total });
  }

  return result;
}
