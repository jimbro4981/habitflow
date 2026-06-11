import { registerRoute, initRouter, navigate } from './router.js';
import { renderTodayPage } from './components/habitCard.js';
import { renderCalendarPage } from './components/heatmap.js';
import { renderStatsPage } from './components/stats.js';
import { renderSettingsPage, initTheme } from './components/themeToggle.js';
import { openHabitForm } from './components/habitForm.js';
import { getHabits } from './db.js';
import { scheduleReminder, isNotificationSupported } from './utils/notifications.js';

async function init() {
  // Initialize theme
  await initTheme();
  
  // Register routes
  registerRoute('/', renderTodayPage);
  registerRoute('/calendar', renderCalendarPage);
  registerRoute('/stats', renderStatsPage);
  registerRoute('/settings', renderSettingsPage);
  
  // Initialize router
  initRouter();
  
  // Setup navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      navigate(item.dataset.route);
    });
  });
  
  // FAB button
  document.getElementById('fab-add')?.addEventListener('click', () => {
    openHabitForm();
  });
  
  // Reschedule reminders for all habits
  if (isNotificationSupported()) {
    const habits = await getHabits(false);
    for (const habit of habits) {
      if (habit.reminderTime) {
        scheduleReminder(habit.id, habit.name, habit.icon, habit.reminderTime);
      }
    }
  }
  
  // Register service worker
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
      console.log('Service Worker registered');
    } catch (err) {
      console.log('Service Worker registration failed:', err);
    }
  }
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
    const { getSetting } = await import('./db.js');
    const theme = await getSetting('theme', 'system');
    if (theme === 'system') {
      const { applyTheme } = await import('./components/themeToggle.js');
      applyTheme('system');
    }
  });
}

// Toast utility
export function showToast(message, duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'fadeIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
