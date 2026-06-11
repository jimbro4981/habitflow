import { getCategories, getHabits } from '../db.js';

let activeCategory = null;

export async function renderCategoryFilter(container, onFilterChange) {
  const categories = await getCategories();
  const habits = await getHabits(false);
  
  // Only show categories that have habits
  const usedCategories = [...new Set(habits.map(h => h.category))];
  
  if (usedCategories.length <= 1) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = `
    <div class="category-filter" style="margin-bottom: 16px">
      <button class="category-pill ${!activeCategory ? 'active' : ''}" data-category="">All</button>
      ${usedCategories.map(c => `
        <button class="category-pill ${activeCategory === c ? 'active' : ''}" 
                data-category="${c}">${c}</button>
      `).join('')}
    </div>
  `;
  
  container.querySelectorAll('.category-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      activeCategory = pill.dataset.category || null;
      container.querySelectorAll('.category-pill').forEach(p => 
        p.classList.toggle('active', p.dataset.category === (activeCategory || ''))
      );
      onFilterChange(activeCategory);
    });
  });
}

export function resetCategoryFilter() {
  activeCategory = null;
}
