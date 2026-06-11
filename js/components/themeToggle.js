import { getSetting, setSetting } from '../db.js';

export async function initTheme() {
  const saved = await getSetting('theme', 'system');
  applyTheme(saved);
}

export function applyTheme(theme) {
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  // Update meta theme-color
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    meta.setAttribute('content', isDark ? '#0f0b1a' : '#f8f7ff');
  }
}

export async function renderSettingsPage(container) {
  const currentTheme = await getSetting('theme', 'system');
  
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Settings</h1>
        <p class="page-subtitle">Customize your experience</p>
      </div>
    </div>
    
    <div class="settings-group">
      <div class="settings-group-title">Appearance</div>
      <div class="settings-item">
        <div>
          <div class="settings-item-label">Theme</div>
          <div class="settings-item-desc">Choose your preferred color scheme</div>
        </div>
      </div>
      <div class="theme-selector" id="theme-selector" style="margin-top: 8px; margin-bottom: 16px">
        <button class="theme-option ${currentTheme === 'light' ? 'active' : ''}" data-theme="light">☀️ Light</button>
        <button class="theme-option ${currentTheme === 'dark' ? 'active' : ''}" data-theme="dark">🌙 Dark</button>
        <button class="theme-option ${currentTheme === 'system' ? 'active' : ''}" data-theme="system">🔄 System</button>
      </div>
    </div>
    
    <div class="settings-group">
      <div class="settings-group-title">Data</div>
      <div class="settings-item" id="export-data" style="cursor: pointer">
        <div>
          <div class="settings-item-label">Export Data</div>
          <div class="settings-item-desc">Download all your data as JSON</div>
        </div>
        <span style="color: var(--text-muted)">📥</span>
      </div>
      <div class="settings-item" id="import-data" style="cursor: pointer">
        <div>
          <div class="settings-item-label">Import Data</div>
          <div class="settings-item-desc">Restore from a backup file</div>
        </div>
        <span style="color: var(--text-muted)">📤</span>
      </div>
    </div>
    
    <div class="settings-group">
      <div class="settings-group-title">About</div>
      <div class="settings-item">
        <div>
          <div class="settings-item-label">HabitFlow</div>
          <div class="settings-item-desc">Version 1.0 · Made with 💜</div>
        </div>
      </div>
      <div class="settings-item">
        <div>
          <div class="settings-item-label">Privacy</div>
          <div class="settings-item-desc">All data stored locally. No cloud. No tracking.</div>
        </div>
        <span style="color: var(--success)">🔒</span>
      </div>
    </div>
  `;
  
  // Theme toggle
  document.getElementById('theme-selector')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.theme-option');
    if (!btn) return;
    const theme = btn.dataset.theme;
    await setSetting('theme', theme);
    applyTheme(theme);
    document.querySelectorAll('.theme-option').forEach(b => 
      b.classList.toggle('active', b.dataset.theme === theme)
    );
  });
  
  // Export
  document.getElementById('export-data')?.addEventListener('click', async () => {
    const { getDB } = await import('../db.js');
    const db = await getDB();
    
    const tx = db.transaction(['habits', 'completions', 'settings'], 'readonly');
    const habits = await getAllFromStore(tx.objectStore('habits'));
    const completions = await getAllFromStore(tx.objectStore('completions'));
    const settings = await getAllFromStore(tx.objectStore('settings'));
    
    const data = JSON.stringify({ habits, completions, settings, exportDate: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `habitflow-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
  
  // Import
  document.getElementById('import-data')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const { getDB } = await import('../db.js');
        const db = await getDB();
        
        if (data.habits && data.completions) {
          const tx = db.transaction(['habits', 'completions', 'settings'], 'readwrite');
          // Clear existing
          tx.objectStore('habits').clear();
          tx.objectStore('completions').clear();
          // Import
          for (const h of data.habits) tx.objectStore('habits').put(h);
          for (const c of data.completions) tx.objectStore('completions').put(c);
          if (data.settings) {
            for (const s of data.settings) tx.objectStore('settings').put(s);
          }
          await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = reject;
          });
          alert('Data imported successfully! Refreshing...');
          window.location.reload();
        }
      } catch (err) {
        alert('Error importing data: ' + err.message);
      }
    });
    input.click();
  });
}

function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
