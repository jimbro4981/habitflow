/**
 * HabitFlow - Browser Notification Reminders
 * Schedule, cancel, and display native browser notifications.
 */

/** Map of habitId → timeoutId for active reminders. */
const scheduledReminders = new Map();

/**
 * Check whether the Notification API is available.
 * @returns {boolean}
 */
export function isNotificationSupported() {
  return 'Notification' in window;
}

/**
 * Request notification permission from the user.
 * @returns {Promise<'granted'|'denied'|'default'>}
 */
export async function requestPermission() {
  if (!isNotificationSupported()) return 'denied';
  const result = await Notification.requestPermission();
  return result;
}

/**
 * Schedule a daily reminder for a habit.
 *
 * If the target time has already passed today the reminder is scheduled
 * for the same time tomorrow. After firing, it automatically reschedules
 * itself for the next day.
 *
 * @param {string} habitId
 * @param {string} habitName
 * @param {string} habitIcon - Emoji or icon character.
 * @param {string} timeStr  - Time in HH:MM (24-hour) format.
 */
export function scheduleReminder(habitId, habitName, habitIcon, timeStr) {
  // Cancel any existing reminder for this habit first
  cancelReminder(habitId);

  const [hours, minutes] = timeStr.split(':').map(Number);

  const now = new Date();
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);

  // If the target time has already passed today, schedule for tomorrow
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  const delay = target.getTime() - now.getTime();

  const timeoutId = setTimeout(() => {
    showNotification(
      `${habitIcon} ${habitName}`,
      `Time for your "${habitName}" habit!`,
      habitIcon
    );
    // Reschedule for the next day
    scheduleReminder(habitId, habitName, habitIcon, timeStr);
  }, delay);

  scheduledReminders.set(habitId, timeoutId);
}

/**
 * Cancel a scheduled reminder for a habit.
 * @param {string} habitId
 */
export function cancelReminder(habitId) {
  if (scheduledReminders.has(habitId)) {
    clearTimeout(scheduledReminders.get(habitId));
    scheduledReminders.delete(habitId);
  }
}

/**
 * Cancel all scheduled reminders.
 */
export function cancelAllReminders() {
  for (const [habitId] of scheduledReminders) {
    cancelReminder(habitId);
  }
}

/**
 * Show a browser notification immediately.
 *
 * @param {string} title
 * @param {string} body
 * @param {string} [icon='✅']
 */
export function showNotification(title, body, icon = '✅') {
  if (!isNotificationSupported()) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon });
  }
}
