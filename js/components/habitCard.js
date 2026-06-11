import { getHabits, getCompletionsForDate, toggleCompletion, getCompletionsForHabit } from '../db.js';
import { getToday } from '../utils/dateUtils.js';
import { calculateStreak } from '../utils/streak.js';

export async function renderTodayPage(container) {
  const today = getToday();
  const now = new Date();
  // Format: "Wednesday, Jun 11"
  const dateDisplay = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Today</h1>
        <p class="page-subtitle">${dateDisplay}</p>
      </div>
    </div>
    <div id="category-filter-container"></div>
    <div id="habits-list"></div>
  `;
  
  // Import and render category filter
  const { renderCategoryFilter } = await import('./categoryFilter.js');
  await renderCategoryFilter(
    document.getElementById('category-filter-container'),
    (category) => renderHabitsList(category)
  );
  
  await renderHabitsList(null);
}

async function renderHabitsList(filterCategory) {
  const habitsContainer = document.getElementById('habits-list');
  if (!habitsContainer) return;
  
  const today = getToday();
  const habits = await getHabits(false); // exclude archived
  const todayCompletions = await getCompletionsForDate(today);
  
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
    const isCompleted = todayCompletions.includes(habit.id);
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
      const result = await toggleCompletion(habitId, today);
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
