import { addHabit, getHabit, updateHabit, deleteHabit, getCategories } from '../db.js';
import { scheduleReminder, cancelReminder, isNotificationSupported, requestPermission } from '../utils/notifications.js';
import { navigate } from '../router.js';

const EMOJI_OPTIONS = ['💪', '🏃', '📚', '💧', '🧘', '🎯', '✍️', '🎨', '🎵', '💤', '🥗', '🍎', '🚴', '🏋️', '🧠', '💊', '🌅', '🙏', '📱', '🚫', '🌿', '☀️', '🎓', '💰'];
const COLOR_OPTIONS = ['#7c3aed', '#4f46e5', '#2563eb', '#0891b2', '#059669', '#16a34a', '#ca8a04', '#ea580c', '#dc2626', '#db2777', '#9333ea', '#6366f1'];

export async function openHabitForm(editHabitId = null) {
  const categories = await getCategories();
  let habit = null;
  if (editHabitId) {
    habit = await getHabit(editHabitId);
  }
  
  const isEdit = !!habit;
  const selectedEmoji = habit?.icon || EMOJI_OPTIONS[0];
  const selectedColor = habit?.color || COLOR_OPTIONS[0];
  const selectedCategory = habit?.category || categories[0];
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'habit-form-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">${isEdit ? 'Edit Habit' : 'New Habit'}</h2>
        <button class="modal-close" id="modal-close">×</button>
      </div>
      
      <div class="form-group">
        <label class="form-label">Habit Name</label>
        <input class="form-input" id="habit-name" type="text" 
               placeholder="e.g., Drink 8 glasses of water" 
               value="${habit?.name || ''}" autocomplete="off">
      </div>
      
      <div class="form-group">
        <label class="form-label">Icon</label>
        <div class="emoji-grid" id="emoji-grid">
          ${EMOJI_OPTIONS.map(e => `
            <button class="emoji-option ${e === selectedEmoji ? 'selected' : ''}" 
                    data-emoji="${e}">${e}</button>
          `).join('')}
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">Color</label>
        <div class="color-grid" id="color-grid">
          ${COLOR_OPTIONS.map(c => `
            <button class="color-option ${c === selectedColor ? 'selected' : ''}" 
                    data-color="${c}" 
                    style="background: ${c}"></button>
          `).join('')}
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-input" id="habit-category">
          ${categories.map(c => `
            <option value="${c}" ${c === selectedCategory ? 'selected' : ''}>${c}</option>
          `).join('')}
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">Daily Reminder (optional)</label>
        <input class="form-input" id="habit-reminder" type="time" 
               value="${habit?.reminderTime || ''}">
      </div>
      
      <button class="btn btn-primary btn-block" id="habit-save">
        ${isEdit ? 'Save Changes' : 'Create Habit'}
      </button>
      
      ${isEdit ? `
        <button class="btn btn-danger btn-block" id="habit-delete" style="margin-top: 8px">
          Delete Habit
        </button>
      ` : ''}
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Focus name input
  setTimeout(() => document.getElementById('habit-name')?.focus(), 300);
  
  let currentEmoji = selectedEmoji;
  let currentColor = selectedColor;
  
  // Emoji selection
  document.getElementById('emoji-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('.emoji-option');
    if (!btn) return;
    document.querySelectorAll('.emoji-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    currentEmoji = btn.dataset.emoji;
  });
  
  // Color selection
  document.getElementById('color-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('.color-option');
    if (!btn) return;
    document.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    currentColor = btn.dataset.color;
  });
  
  // Close modal
  const closeModal = () => overlay.remove();
  document.getElementById('modal-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  
  // Save
  document.getElementById('habit-save').addEventListener('click', async () => {
    const name = document.getElementById('habit-name').value.trim();
    if (!name) {
      document.getElementById('habit-name').style.borderColor = 'var(--danger)';
      return;
    }
    
    const reminderTime = document.getElementById('habit-reminder').value || null;
    const category = document.getElementById('habit-category').value;
    
    if (isEdit) {
      await updateHabit(editHabitId, { name, icon: currentEmoji, color: currentColor, category, reminderTime });
      if (reminderTime) {
        if (isNotificationSupported()) {
          const perm = await requestPermission();
          if (perm === 'granted') scheduleReminder(editHabitId, name, currentEmoji, reminderTime);
        }
      } else {
        cancelReminder(editHabitId);
      }
    } else {
      const newHabit = await addHabit({ name, icon: currentEmoji, color: currentColor, category, reminderTime });
      if (reminderTime && isNotificationSupported()) {
        const perm = await requestPermission();
        if (perm === 'granted') scheduleReminder(newHabit.id, name, currentEmoji, reminderTime);
      }
    }
    
    closeModal();
    // Trigger re-render of current page
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  
  // Delete
  if (isEdit) {
    document.getElementById('habit-delete')?.addEventListener('click', async () => {
      if (confirm('Delete this habit and all its data? This cannot be undone.')) {
        cancelReminder(editHabitId);
        await deleteHabit(editHabitId);
        closeModal();
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
    });
  }
}
