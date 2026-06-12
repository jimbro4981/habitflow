import { getHabits, getCompletionsForDate, toggleCompletion, getCompletionsForHabit } from '../db.js';
import { getToday, formatDate } from '../utils/dateUtils.js';
import { calculateStreak } from '../utils/streak.js';

// Track the currently selected date
let selectedDate = getToday();
let currentFilterCategory = null;

function formatDateHeading(dateStr) {
  const today = getToday();
  const date = new Date(dateStr + 'T00:00:00');
  const display = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  // Calculate difference in days
  const todayDate = new Date(today + 'T00:00:00');
  const diffDays = Math.round((todayDate - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { title: 'Today', subtitle: display };
  if (diffDays === 1) return { title: 'Yesterday', subtitle: display };
  if (diffDays === -1) return { title: 'Tomorrow', subtitle: display };
  return { title: display, subtitle: `${diffDays > 0 ? diffDays + ' days ago' : ''}` };
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

export async function renderTodayPage(container) {
  selectedDate = getToday();
  currentFilterCategory = null;
  
  container.innerHTML = `
    <div class="page-header" style="flex-direction: column; align-items: stretch;">
      <div class="date-navigator" id="date-navigator">
        <button class="date-nav-btn" id="date-prev" aria-label="Previous day">‹</button>
        <div class="date-nav-center" id="date-nav-center">
          <h1 class="page-title" id="page-title">Today</h1>
          <p class="page-subtitle" id="page-subtitle"></p>
        </div>
        <button class="date-nav-btn" id="date-next" aria-label="Next day">›</button>
      </div>
      <button class="date-today-btn hidden" id="date-today-btn">↩ Back to Today</button>
    </div>
    <div id="category-filter-container"></div>
    <div id="habits-list"></div>
  `;

  updateDateHeader();

  // Date navigation listeners
  document.getElementById('date-prev').addEventListener('click', () => {
    selectedDate = shiftDate(selectedDate, -1);
    updateDateHeader();
    renderHabitsList(currentFilterCategory);
  });

  document.getElementById('date-next').addEventListener('click', () => {
    // Don't allow navigating into the future
    if (selectedDate >= getToday()) return;
    selectedDate = shiftDate(selectedDate, 1);
    updateDateHeader();
    renderHabitsList(currentFilterCategory);
  });

  document.getElementById('date-today-btn').addEventListener('click', () => {
    selectedDate = getToday();
    updateDateHeader();
    renderHabitsList(currentFilterCategory);
  });

  // Import and render category filter
  const { renderCategoryFilter } = await import('./categoryFilter.js');
  await renderCategoryFilter(
    document.getElementById('category-filter-container'),
    (category) => {
      currentFilterCategory = category;
      renderHabitsList(category);
    }
  );

  await renderHabitsList(null);
}

function updateDateHeader() {
  const { title, subtitle } = formatDateHeading(selectedDate);
  const titleEl = document.getElementById('page-title');
  const subtitleEl = document.getElementById('page-subtitle');
  const todayBtn = document.getElementById('date-today-btn');
  const nextBtn = document.getElementById('date-next');

  if (titleEl) titleEl.textContent = title;
  if (subtitleEl) subtitleEl.textContent = subtitle;

  // Show "Back to Today" button when not on today
  const isToday = selectedDate === getToday();
  if (todayBtn) todayBtn.classList.toggle('hidden', isToday);

  // Dim the next button if already on today
  if (nextBtn) {
    nextBtn.style.opacity = isToday ? '0.3' : '1';
    nextBtn.style.pointerEvents = isToday ? 'none' : 'auto';
  }
}

async function renderHabitsList(filterCategory) {
  const habitsContainer = document.getElementById('habits-list');
  if (!habitsContainer) return;

  const habits = await getHabits(false); // exclude archived
  const dateCompletions = await getCompletionsForDate(selectedDate);

  let filteredHabits = habits;
  if (filterCategory) {
    filteredHabits = habits.filter(h => h.category === filterCategory);
  }

  if (filteredHabits.length === 0) {
    habitsContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🌱</div>
        <h3 class="empty-title">No habits yet</h3>
        <p class="empty-text">Tap the + button to start building your first habit</p>
      </div>
    `;
    return;
  }

  // Build cards with streak data
  let html = '';
  for (const habit of filteredHabits) {
    const isCompleted = dateCompletions.includes(habit.id);
    const completions = await getCompletionsForHabit(habit.id);
    const streakData = calculateStreak(completions);

    html += `
      <div class="habit-card ${isCompleted ? 'completed' : ''}" 
           data-habit-id="${habit.id}" 
           style="animation: slideIn 0.3s ease ${filteredHabits.indexOf(habit) * 0.05}s both">
        <div class="habit-icon" style="background: ${habit.color}20">
          ${habit.icon}
        </div>
        <div class="habit-info">
          <div class="habit-name">${habit.name}</div>
          <div class="habit-streak">
            ${streakData.current > 0 ? `🔥 ${streakData.current} day streak` : '✨ Start your streak!'}
          </div>
        </div>
        <button class="habit-check ${isCompleted ? 'checked' : ''}" 
                data-habit-id="${habit.id}" 
                aria-label="Toggle ${habit.name}">
          ${isCompleted ? '✓' : ''}
        </button>
      </div>
    `;
  }
  habitsContainer.innerHTML = html;

  // Attach check toggle event listeners
  habitsContainer.querySelectorAll('.habit-check').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const habitId = btn.dataset.habitId;
      await toggleCompletion(habitId, selectedDate);
      // Re-render
      await renderHabitsList(filterCategory);
    });
  });

  // Attach card click for edit
  habitsContainer.querySelectorAll('.habit-card').forEach(card => {
    card.addEventListener('click', async () => {
      const habitId = card.dataset.habitId;
      const { openHabitForm } = await import('./habitForm.js');
      await openHabitForm(habitId);
    });
  });
}
