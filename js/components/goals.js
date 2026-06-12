import { getDB } from '../db.js';
import { getToday, formatDate } from '../utils/dateUtils.js';

let selectedDate = getToday();

// ---------------------------------------------------------------------------
// Goals DB helpers (stored in 'goals' object store)
// ---------------------------------------------------------------------------

async function addGoal(text, date) {
  const db = await getDB();
  const goal = {
    id: crypto.randomUUID(),
    text,
    date,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction('goals', 'readwrite');
    tx.objectStore('goals').add(goal);
    tx.oncomplete = () => resolve(goal);
    tx.onerror = () => reject(tx.error);
  });
}

async function getGoalsForDate(date) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('goals', 'readonly');
    const store = tx.objectStore('goals');
    const index = store.index('date');
    const req = index.getAll(IDBKeyRange.only(date));
    req.onsuccess = () => {
      const goals = req.result;
      goals.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
      resolve(goals);
    };
    req.onerror = () => reject(req.error);
  });
}

async function toggleGoalComplete(id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('goals', 'readwrite');
    const store = tx.objectStore('goals');
    const req = store.get(id);
    req.onsuccess = () => {
      const goal = req.result;
      if (!goal) { resolve(); return; }
      goal.completed = !goal.completed;
      store.put(goal);
      tx.oncomplete = () => resolve(goal);
    };
    req.onerror = () => reject(req.error);
  });
}

async function deleteGoal(id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('goals', 'readwrite');
    tx.objectStore('goals').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function updateGoalText(id, text) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('goals', 'readwrite');
    const store = tx.objectStore('goals');
    const req = store.get(id);
    req.onsuccess = () => {
      const goal = req.result;
      if (!goal) { resolve(); return; }
      goal.text = text;
      store.put(goal);
      tx.oncomplete = () => resolve(goal);
    };
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

function formatDateHeading(dateStr) {
  const today = getToday();
  const date = new Date(dateStr + 'T00:00:00');
  const display = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const todayDate = new Date(today + 'T00:00:00');
  const diffDays = Math.round((todayDate - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return { title: "Today's Goals", subtitle: display };
  if (diffDays === 1) return { title: "Yesterday's Goals", subtitle: display };
  if (diffDays === -1) return { title: "Tomorrow's Goals", subtitle: display };
  return { title: 'Goals', subtitle: display };
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

export async function renderGoalsPage(container) {
  selectedDate = getToday();

  container.innerHTML = `
    <div class="page-header" style="flex-direction: column; align-items: stretch;">
      <div class="date-navigator">
        <button class="date-nav-btn" id="goals-date-prev" aria-label="Previous day">‹</button>
        <div class="date-nav-center">
          <h1 class="page-title" id="goals-title">Today's Goals</h1>
          <p class="page-subtitle" id="goals-subtitle"></p>
        </div>
        <button class="date-nav-btn" id="goals-date-next" aria-label="Next day">›</button>
      </div>
      <button class="date-today-btn hidden" id="goals-today-btn">↩ Back to Today</button>
    </div>

    <div class="goals-input-row" id="goals-input-row">
      <input type="text" class="form-input goals-input" id="goal-input"
             placeholder="What do you want to achieve today?" maxlength="200"
             autocomplete="off">
      <button class="btn btn-primary goals-add-btn" id="goal-add-btn">+</button>
    </div>

    <div id="goals-progress"></div>
    <div id="goals-list"></div>
  `;

  updateGoalsHeader();

  // Date nav
  document.getElementById('goals-date-prev').addEventListener('click', () => {
    selectedDate = shiftDate(selectedDate, -1);
    updateGoalsHeader();
    renderGoalsList();
  });

  document.getElementById('goals-date-next').addEventListener('click', () => {
    selectedDate = shiftDate(selectedDate, 1);
    updateGoalsHeader();
    renderGoalsList();
  });

  document.getElementById('goals-today-btn').addEventListener('click', () => {
    selectedDate = getToday();
    updateGoalsHeader();
    renderGoalsList();
  });

  // Add goal
  const input = document.getElementById('goal-input');
  const addBtn = document.getElementById('goal-add-btn');

  const handleAdd = async () => {
    const text = input.value.trim();
    if (!text) return;
    await addGoal(text, selectedDate);
    input.value = '';
    await renderGoalsList();
  };

  addBtn.addEventListener('click', handleAdd);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAdd();
  });

  await renderGoalsList();
}

function updateGoalsHeader() {
  const { title, subtitle } = formatDateHeading(selectedDate);
  const titleEl = document.getElementById('goals-title');
  const subtitleEl = document.getElementById('goals-subtitle');
  const todayBtn = document.getElementById('goals-today-btn');

  if (titleEl) titleEl.textContent = title;
  if (subtitleEl) subtitleEl.textContent = subtitle;

  const isToday = selectedDate === getToday();
  if (todayBtn) todayBtn.classList.toggle('hidden', isToday);
}

async function renderGoalsList() {
  const listEl = document.getElementById('goals-list');
  const progressEl = document.getElementById('goals-progress');
  if (!listEl) return;

  const goals = await getGoalsForDate(selectedDate);

  // Progress bar
  if (goals.length > 0 && progressEl) {
    const done = goals.filter(g => g.completed).length;
    const pct = Math.round((done / goals.length) * 100);
    progressEl.innerHTML = `
      <div class="goals-progress-bar">
        <div class="goals-progress-fill" style="width: ${pct}%"></div>
      </div>
      <div class="goals-progress-text">${done}/${goals.length} completed</div>
    `;
  } else if (progressEl) {
    progressEl.innerHTML = '';
  }

  if (goals.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state" style="padding: 40px 20px">
        <div class="empty-icon">🎯</div>
        <h3 class="empty-title">No goals set</h3>
        <p class="empty-text">Type a goal above and hit + to get started</p>
      </div>
    `;
    return;
  }

  let html = '';
  goals.forEach((goal, i) => {
    html += `
      <div class="goal-item ${goal.completed ? 'goal-done' : ''}"
           style="animation: slideIn 0.3s ease ${i * 0.04}s both"
           data-id="${goal.id}">
        <button class="goal-check ${goal.completed ? 'checked' : ''}"
                data-id="${goal.id}" aria-label="Toggle goal">
          ${goal.completed ? '✓' : ''}
        </button>
        <span class="goal-text">${escapeHtml(goal.text)}</span>
        <button class="goal-delete" data-id="${goal.id}" aria-label="Delete goal">✕</button>
      </div>
    `;
  });

  listEl.innerHTML = html;

  // Toggle complete
  listEl.querySelectorAll('.goal-check').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleGoalComplete(btn.dataset.id);
      await renderGoalsList();
    });
  });

  // Delete
  listEl.querySelectorAll('.goal-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteGoal(btn.dataset.id);
      await renderGoalsList();
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
