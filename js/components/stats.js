import { getHabits, getCompletionsForHabit } from '../db.js';
import { calculateStreak, getCompletionRate, getWeeklyData } from '../utils/streak.js';
import { getToday, getLastNDays } from '../utils/dateUtils.js';

export async function renderStatsPage(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Statistics</h1>
        <p class="page-subtitle">Your progress at a glance</p>
      </div>
    </div>
    <div id="stats-content">Loading...</div>
  `;
  
  const habits = await getHabits(false);
  const statsContent = document.getElementById('stats-content');
  
  if (habits.length === 0) {
    statsContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <h3 class="empty-title">No data yet</h3>
        <p class="empty-text">Start tracking habits to see your statistics</p>
      </div>
    `;
    return;
  }
  
  // Aggregate stats
  let totalCurrentStreak = 0;
  let longestStreak = 0;
  let totalCompletions = 0;
  let overallRate = 0;
  const habitStats = [];
  
  for (const habit of habits) {
    const completions = await getCompletionsForHabit(habit.id);
    const streak = calculateStreak(completions);
    const rate = getCompletionRate(completions, 30);
    
    totalCurrentStreak = Math.max(totalCurrentStreak, streak.current);
    longestStreak = Math.max(longestStreak, streak.longest);
    totalCompletions += streak.total;
    overallRate += rate;
    
    habitStats.push({ habit, streak, rate, completions });
  }
  
  overallRate = Math.round(overallRate / habits.length);
  
  // Render
  statsContent.innerHTML = `
    <div class="stats-grid" style="margin-bottom: 20px">
      <div class="stat-card">
        <div class="stat-value">${overallRate}%</div>
        <div class="stat-label">30-Day Rate</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">🔥 ${totalCurrentStreak}</div>
        <div class="stat-label">Best Active Streak</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${longestStreak}</div>
        <div class="stat-label">All-Time Best</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalCompletions}</div>
        <div class="stat-label">Total Check-ins</div>
      </div>
    </div>
    
    <div class="chart-container" style="margin-bottom: 16px">
      <h3 class="chart-title">Weekly Completions</h3>
      <canvas id="weekly-chart" width="400" height="200" style="width: 100%; height: 200px"></canvas>
    </div>
    
    <div class="chart-container">
      <h3 class="chart-title">Per-Habit Breakdown</h3>
      ${habitStats.sort((a, b) => b.rate - a.rate).map(({ habit, streak, rate }) => `
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border-color)">
          <span style="font-size: 24px">${habit.icon}</span>
          <div style="flex: 1; min-width: 0">
            <div style="font-size: 14px; font-weight: 600; color: var(--text-primary)">${habit.name}</div>
            <div style="font-size: 12px; color: var(--text-secondary)">
              🔥 ${streak.current} day streak · Best: ${streak.longest}
            </div>
          </div>
          <div style="text-align: right">
            <div style="font-size: 16px; font-weight: 700; color: var(--accent-primary)">${rate}%</div>
            <div style="font-size: 11px; color: var(--text-muted)">30d</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  
  // Draw weekly chart
  drawWeeklyChart(habitStats);
}

function drawWeeklyChart(habitStats) {
  const canvas = document.getElementById('weekly-chart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.offsetWidth * dpr;
  canvas.height = 200 * dpr;
  ctx.scale(dpr, dpr);
  
  const width = canvas.offsetWidth;
  const height = 200;
  const padding = { top: 10, right: 10, bottom: 30, left: 35 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // Aggregate weekly data: count total completions per week across all habits
  const weeklyMap = new Map();
  const today = new Date();
  
  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay() + 1);
    const key = weekStart.toISOString().split('T')[0];
    weeklyMap.set(key, 0);
  }
  
  for (const { completions } of habitStats) {
    for (const dateStr of completions) {
      const d = new Date(dateStr + 'T00:00:00');
      const weekStartD = new Date(d);
      weekStartD.setDate(weekStartD.getDate() - weekStartD.getDay() + 1);
      const key = weekStartD.toISOString().split('T')[0];
      if (weeklyMap.has(key)) {
        weeklyMap.set(key, weeklyMap.get(key) + 1);
      }
    }
  }
  
  const data = Array.from(weeklyMap.values());
  const maxVal = Math.max(...data, 1);
  const barWidth = chartWidth / data.length - 4;
  
  // Get computed styles for theming
  const styles = getComputedStyle(document.documentElement);
  const textColor = styles.getPropertyValue('--text-muted').trim() || '#9ca3af';
  const accentColor = styles.getPropertyValue('--accent-primary').trim() || '#7c3aed';
  
  // Y axis
  ctx.fillStyle = textColor;
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const val = Math.round(maxVal * i / 4);
    const y = padding.top + chartHeight - (chartHeight * i / 4);
    ctx.fillText(val.toString(), padding.left - 8, y + 4);
    
    // Grid line
    ctx.strokeStyle = textColor;
    ctx.globalAlpha = 0.1;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  
  // Bars
  const weeks = Array.from(weeklyMap.keys());
  data.forEach((val, i) => {
    const barHeight = (val / maxVal) * chartHeight;
    const x = padding.left + i * (chartWidth / data.length) + 2;
    const y = padding.top + chartHeight - barHeight;
    
    // Gradient bar
    const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
    gradient.addColorStop(0, accentColor);
    gradient.addColorStop(1, accentColor + '60');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    // Rounded top
    const r = Math.min(4, barWidth / 2);
    ctx.roundRect(x, y, barWidth, barHeight, [r, r, 0, 0]);
    ctx.fill();
    
    // Week label
    if (i % 2 === 0) {
      ctx.fillStyle = textColor;
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      const d = new Date(weeks[i] + 'T00:00:00');
      ctx.fillText(`${d.getMonth() + 1}/${d.getDate()}`, x + barWidth / 2, height - 8);
    }
  });
}
