import { getCompletionCounts, getHabits, getCompletionsForDate } from '../db.js';
import { formatDate, getToday, getDayName, getMonthName } from '../utils/dateUtils.js';

export async function renderCalendarPage(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Calendar</h1>
        <p class="page-subtitle">Your activity over time</p>
      </div>
    </div>
    <div id="heatmap-wrapper" class="chart-container"></div>
    <div id="day-detail" style="margin-top: 16px"></div>
  `;
  
  await renderHeatmap();
}

async function renderHeatmap() {
  const wrapper = document.getElementById('heatmap-wrapper');
  if (!wrapper) return;
  
  const today = new Date();
  const habits = await getHabits(false);
  const totalHabits = habits.length;
  
  // Calculate 52 weeks back
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (52 * 7));
  // Align to Monday
  while (startDate.getDay() !== 1) {
    startDate.setDate(startDate.getDate() - 1);
  }
  
  const counts = await getCompletionCounts(formatDate(startDate), getToday());
  
  const cellSize = 14;
  const cellGap = 3;
  const leftPadding = 32;
  const topPadding = 20;
  const weeks = 53;
  const svgWidth = leftPadding + weeks * (cellSize + cellGap);
  const svgHeight = topPadding + 7 * (cellSize + cellGap);
  
  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
  
  let svg = `<svg width="100%" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="font-family: Inter, sans-serif">`;
  
  // Day labels
  dayLabels.forEach((label, i) => {
    if (label) {
      svg += `<text x="0" y="${topPadding + i * (cellSize + cellGap) + cellSize - 2}" fill="var(--text-muted)" font-size="10">${label}</text>`;
    }
  });
  
  // Month labels
  let currentMonth = -1;
  const currentDate = new Date(startDate);
  for (let week = 0; week < weeks; week++) {
    const weekDate = new Date(startDate);
    weekDate.setDate(weekDate.getDate() + week * 7);
    const month = weekDate.getMonth();
    if (month !== currentMonth) {
      currentMonth = month;
      svg += `<text x="${leftPadding + week * (cellSize + cellGap)}" y="12" fill="var(--text-muted)" font-size="10">${getMonthName(weekDate)}</text>`;
    }
  }
  
  // Cells
  const d = new Date(startDate);
  for (let week = 0; week < weeks; week++) {
    for (let day = 0; day < 7; day++) {
      const dateStr = formatDate(d);
      if (d <= today) {
        const count = counts.get(dateStr) || 0;
        const intensity = totalHabits > 0 ? count / totalHabits : 0;
        const fill = getHeatmapColor(intensity);
        
        svg += `<rect 
          class="heatmap-cell" 
          x="${leftPadding + week * (cellSize + cellGap)}" 
          y="${topPadding + day * (cellSize + cellGap)}" 
          width="${cellSize}" 
          height="${cellSize}" 
          rx="3" 
          fill="${fill}" 
          data-date="${dateStr}" 
          data-count="${count}"
          style="cursor: pointer"
        />`;
      }
      d.setDate(d.getDate() + 1);
    }
  }
  
  svg += '</svg>';
  
  wrapper.innerHTML = `
    <h3 class="chart-title">Activity Heatmap</h3>
    <div class="heatmap-container">${svg}</div>
    <div style="display: flex; align-items: center; gap: 4px; justify-content: flex-end; margin-top: 8px; font-size: 11px; color: var(--text-muted)">
      Less
      ${[0, 0.25, 0.5, 0.75, 1].map(i => 
        `<div style="width: 12px; height: 12px; border-radius: 2px; background: ${getHeatmapColor(i)}"></div>`
      ).join('')}
      More
    </div>
  `;
  
  // Click handler for cells
  wrapper.querySelectorAll('.heatmap-cell').forEach(cell => {
    cell.addEventListener('click', async () => {
      const dateStr = cell.dataset.date;
      await showDayDetail(dateStr);
    });
  });
}

function getHeatmapColor(intensity) {
  if (intensity === 0) return 'var(--accent-light)';
  if (intensity <= 0.25) return 'rgba(124, 58, 237, 0.3)';
  if (intensity <= 0.5) return 'rgba(124, 58, 237, 0.5)';
  if (intensity <= 0.75) return 'rgba(124, 58, 237, 0.7)';
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
      <div class="chart-container">
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
