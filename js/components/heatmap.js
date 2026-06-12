import { getCompletionCounts, getHabits, getCompletionsForDate } from '../db.js';
import { formatDate, getToday, getFullMonthName } from '../utils/dateUtils.js';

let currentYear;
let currentMonth; // 0-indexed

export async function renderCalendarPage(container) {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();

  container.innerHTML = `
    <div class="page-header" style="flex-direction: column; align-items: stretch;">
      <div class="date-navigator" id="month-navigator">
        <button class="date-nav-btn" id="month-prev" aria-label="Previous month">‹</button>
        <div class="date-nav-center">
          <h1 class="page-title" id="month-title"></h1>
          <p class="page-subtitle" id="month-year"></p>
        </div>
        <button class="date-nav-btn" id="month-next" aria-label="Next month">›</button>
      </div>
    </div>
    <div id="calendar-grid-wrapper"></div>
    <div id="day-detail" style="margin-top: 16px"></div>
  `;

  // Month navigation
  document.getElementById('month-prev').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderMonth();
  });

  document.getElementById('month-next').addEventListener('click', () => {
    const now = new Date();
    // Don't go past current month
    if (currentYear === now.getFullYear() && currentMonth >= now.getMonth()) return;
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderMonth();
  });

  await renderMonth();
}

async function renderMonth() {
  const wrapper = document.getElementById('calendar-grid-wrapper');
  const titleEl = document.getElementById('month-title');
  const yearEl = document.getElementById('month-year');
  const nextBtn = document.getElementById('month-next');
  if (!wrapper) return;

  const now = new Date();
  const isCurrentMonth = currentYear === now.getFullYear() && currentMonth === now.getMonth();

  // Update header
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  if (titleEl) titleEl.textContent = monthNames[currentMonth];
  if (yearEl) yearEl.textContent = currentYear.toString();

  // Dim next button if on current month
  if (nextBtn) {
    nextBtn.style.opacity = isCurrentMonth ? '0.3' : '1';
    nextBtn.style.pointerEvents = isCurrentMonth ? 'none' : 'auto';
  }

  // Get month data
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  // Monday=0 ... Sunday=6
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const startDateStr = formatDate(firstDay);
  const endDateStr = formatDate(lastDay);

  const habits = await getHabits(false);
  const totalHabits = habits.length;
  const counts = await getCompletionCounts(startDateStr, endDateStr);

  const today = getToday();
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Build calendar grid
  let html = `<div class="cal-month-grid">`;

  // Day-of-week headers
  html += `<div class="cal-dow-row">`;
  for (const d of dayNames) {
    html += `<div class="cal-dow">${d}</div>`;
  }
  html += `</div>`;

  // Day cells
  html += `<div class="cal-days">`;

  // Empty cells before first day
  for (let i = 0; i < startDow; i++) {
    html += `<div class="cal-cell cal-empty"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDate(new Date(currentYear, currentMonth, day));
    const count = counts.get(dateStr) || 0;
    const intensity = totalHabits > 0 ? count / totalHabits : 0;
    const isToday = dateStr === today;
    const isFuture = dateStr > today;

    let cellClass = 'cal-cell';
    if (isToday) cellClass += ' cal-today';
    if (isFuture) cellClass += ' cal-future';
    if (count > 0) cellClass += ' cal-has-data';

    const bg = isFuture ? '' : `background: ${getCellBg(intensity)};`;

    html += `
      <div class="${cellClass}" data-date="${dateStr}" ${isFuture ? '' : 'style="cursor:pointer"'}>
        <span class="cal-day-num">${day}</span>
        ${!isFuture && totalHabits > 0 ? `
          <span class="cal-day-dots">
            ${count > 0 ? `<span class="cal-dot cal-dot-filled">${count}/${totalHabits}</span>` : `<span class="cal-dot cal-dot-empty">—</span>`}
          </span>
        ` : ''}
        ${!isFuture && intensity >= 1 ? '<span class="cal-day-check">✓</span>' : ''}
      </div>
    `;
  }

  // Empty cells after last day
  const totalCells = startDow + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 0; i < remaining; i++) {
    html += `<div class="cal-cell cal-empty"></div>`;
  }

  html += `</div>`; // cal-days
  html += `</div>`; // cal-month-grid

  // Legend
  html += `
    <div class="cal-legend">
      <div class="cal-legend-item"><span class="cal-legend-box" style="background: var(--accent-light)"></span> None</div>
      <div class="cal-legend-item"><span class="cal-legend-box" style="background: rgba(124,58,237,0.35)"></span> Some</div>
      <div class="cal-legend-item"><span class="cal-legend-box" style="background: rgba(124,58,237,0.6)"></span> Most</div>
      <div class="cal-legend-item"><span class="cal-legend-box" style="background: var(--accent-primary)"></span> All ✓</div>
    </div>
  `;

  wrapper.innerHTML = html;

  // Clear day detail
  const detail = document.getElementById('day-detail');
  if (detail) detail.innerHTML = '';

  // Click handlers
  wrapper.querySelectorAll('.cal-cell:not(.cal-empty):not(.cal-future)').forEach(cell => {
    cell.addEventListener('click', async () => {
      // Highlight selected cell
      wrapper.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('cal-selected'));
      cell.classList.add('cal-selected');
      await showDayDetail(cell.dataset.date);
    });
  });
}

function getCellBg(intensity) {
  if (intensity === 0) return 'var(--accent-light)';
  if (intensity <= 0.25) return 'rgba(124, 58, 237, 0.25)';
  if (intensity <= 0.5) return 'rgba(124, 58, 237, 0.4)';
  if (intensity <= 0.75) return 'rgba(124, 58, 237, 0.6)';
  return 'var(--accent-primary)';
}

async function showDayDetail(dateStr) {
  const detail = document.getElementById('day-detail');
  if (!detail) return;

  const completedIds = await getCompletionsForDate(dateStr);
  const allHabits = await getHabits(false);
  const date = new Date(dateStr + 'T00:00:00');
  const displayDate = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  if (completedIds.length === 0) {
    detail.innerHTML = `
      <div class="chart-container" style="animation: slideIn 0.3s ease">
        <h3 class="chart-title">${displayDate}</h3>
        <p style="color: var(--text-secondary); font-size: 14px">No habits completed on this day</p>
      </div>
    `;
    return;
  }

  const completedHabits = allHabits.filter(h => completedIds.includes(h.id));
  detail.innerHTML = `
    <div class="chart-container" style="animation: slideIn 0.3s ease">
      <h3 class="chart-title">${displayDate}</h3>
      <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 12px">
        ${completedIds.length} of ${allHabits.length} habits completed
      </p>
      ${completedHabits.map(h => `
        <div style="display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border-color)">
          <span style="font-size: 20px">${h.icon}</span>
          <span style="color: var(--text-primary); font-size: 14px">${h.name}</span>
          <span style="margin-left: auto; color: var(--success)">✓</span>
        </div>
      `).join('')}
    </div>
  `;
}
