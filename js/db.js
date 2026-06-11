/**
 * HabitFlow - IndexedDB Data Layer
 *
 * Database: habitflow-db  (version 1)
 * Stores:   habits, completions, settings
 *
 * All public functions return Promises. The DB connection is cached after
 * the first open so callers never need to worry about re-opening.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a v4 UUID. */
function generateId() {
  return crypto.randomUUID();
}

/** Cached database instance. */
let dbInstance = null;

/**
 * Open (or return the cached) IndexedDB connection.
 * @returns {Promise<IDBDatabase>}
 */
export async function getDB() {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open('habitflow-db', 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // --- habits ---
      if (!db.objectStoreNames.contains('habits')) {
        const habitsStore = db.createObjectStore('habits', { keyPath: 'id' });
        habitsStore.createIndex('category', 'category', { unique: false });
        habitsStore.createIndex('archived', 'archived', { unique: false });
        habitsStore.createIndex('order', 'order', { unique: false });
      }

      // --- completions ---
      if (!db.objectStoreNames.contains('completions')) {
        const completionsStore = db.createObjectStore('completions', { keyPath: 'id' });
        completionsStore.createIndex('habitId', 'habitId', { unique: false });
        completionsStore.createIndex('date', 'date', { unique: false });
        completionsStore.createIndex('habitId_date', ['habitId', 'date'], { unique: true });
      }

      // --- settings ---
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// ---------------------------------------------------------------------------
// HABITS
// ---------------------------------------------------------------------------

/**
 * Add a new habit.
 *
 * @param {Object}  params
 * @param {string}  params.name
 * @param {string}  params.icon
 * @param {string}  params.color
 * @param {string}  params.category
 * @param {string}  [params.reminderTime] - HH:MM (optional)
 * @returns {Promise<Object>} The created habit record.
 */
export async function addHabit({ name, icon, color, category, reminderTime }) {
  const db = await getDB();

  // Determine the next order value
  const count = await new Promise((resolve, reject) => {
    const tx = db.transaction('habits', 'readonly');
    const store = tx.objectStore('habits');
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const habit = {
    id: generateId(),
    name,
    icon,
    color,
    category,
    reminderTime: reminderTime || null,
    createdAt: new Date().toISOString(),
    archived: false,
    order: count,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('habits', 'readwrite');
    const store = tx.objectStore('habits');
    const req = store.add(habit);
    req.onsuccess = () => resolve(habit);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get all habits, sorted by their `order` field.
 *
 * @param {boolean} [includeArchived=false]
 * @returns {Promise<Object[]>}
 */
export async function getHabits(includeArchived = false) {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('habits', 'readonly');
    const store = tx.objectStore('habits');
    const req = store.getAll();

    req.onsuccess = () => {
      let habits = req.result;
      if (!includeArchived) {
        habits = habits.filter((h) => !h.archived);
      }
      habits.sort((a, b) => a.order - b.order);
      resolve(habits);
    };

    req.onerror = () => reject(req.error);
  });
}

/**
 * Get a single habit by ID.
 *
 * @param {string} id
 * @returns {Promise<Object|undefined>}
 */
export async function getHabit(id) {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('habits', 'readonly');
    const store = tx.objectStore('habits');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Partially update a habit (merge `updates` into the existing record).
 *
 * @param {string} id
 * @param {Object} updates - Fields to merge.
 * @returns {Promise<Object>} The updated habit.
 */
export async function updateHabit(id, updates) {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('habits', 'readwrite');
    const store = tx.objectStore('habits');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (!existing) {
        reject(new Error(`Habit ${id} not found`));
        return;
      }
      const updated = { ...existing, ...updates, id }; // id is immutable
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve(updated);
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Delete a habit and **all** its completion records.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteHabit(id) {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['habits', 'completions'], 'readwrite');

    // Delete the habit record
    tx.objectStore('habits').delete(id);

    // Delete all completions for this habit
    const completionsStore = tx.objectStore('completions');
    const index = completionsStore.index('habitId');
    const cursorReq = index.openCursor(IDBKeyRange.only(id));

    cursorReq.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------------------------------------------------------------------
// COMPLETIONS
// ---------------------------------------------------------------------------

/**
 * Toggle a habit's completion for a given date.
 *
 * If a completion record already exists it is removed; otherwise one is
 * created. Returns the **new** state.
 *
 * @param {string} habitId
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<{ completed: boolean }>}
 */
export async function toggleCompletion(habitId, date) {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('completions', 'readwrite');
    const store = tx.objectStore('completions');
    const index = store.index('habitId_date');
    const req = index.openCursor(IDBKeyRange.only([habitId, date]));

    req.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        // Already completed → remove
        cursor.delete();
        resolve({ completed: false });
      } else {
        // Not completed → add
        store.add({
          id: generateId(),
          habitId,
          date,
          completedAt: new Date().toISOString(),
        });
        resolve({ completed: true });
      }
    };

    req.onerror = () => reject(req.error);
  });
}

/**
 * Get all completion dates for a habit.
 *
 * @param {string} habitId
 * @returns {Promise<string[]>} Array of YYYY-MM-DD strings.
 */
export async function getCompletionsForHabit(habitId) {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('completions', 'readonly');
    const store = tx.objectStore('completions');
    const index = store.index('habitId');
    const req = index.getAll(IDBKeyRange.only(habitId));

    req.onsuccess = () => {
      resolve(req.result.map((r) => r.date));
    };

    req.onerror = () => reject(req.error);
  });
}

/**
 * Get all habit IDs completed on a specific date.
 *
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<string[]>} Array of habitId strings.
 */
export async function getCompletionsForDate(date) {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('completions', 'readonly');
    const store = tx.objectStore('completions');
    const index = store.index('date');
    const req = index.getAll(IDBKeyRange.only(date));

    req.onsuccess = () => {
      resolve(req.result.map((r) => r.habitId));
    };

    req.onerror = () => reject(req.error);
  });
}

/**
 * Get completion counts per day within a date range (for heatmaps).
 *
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate   - YYYY-MM-DD
 * @returns {Promise<Map<string, number>>} dateStr → count
 */
export async function getCompletionCounts(startDate, endDate) {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('completions', 'readonly');
    const store = tx.objectStore('completions');
    const index = store.index('date');
    const range = IDBKeyRange.bound(startDate, endDate);
    const req = index.openCursor(range);

    const counts = new Map();

    req.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const d = cursor.value.date;
        counts.set(d, (counts.get(d) || 0) + 1);
        cursor.continue();
      } else {
        resolve(counts);
      }
    };

    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// SETTINGS
// ---------------------------------------------------------------------------

/**
 * Retrieve a setting value.
 *
 * @param {string} key
 * @param {*} [defaultValue=null]
 * @returns {Promise<*>}
 */
export async function getSetting(key, defaultValue = null) {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const req = store.get(key);

    req.onsuccess = () => {
      resolve(req.result ? req.result.value : defaultValue);
    };

    req.onerror = () => reject(req.error);
  });
}

/**
 * Store a setting value.
 *
 * @param {string} key
 * @param {*} value
 * @returns {Promise<void>}
 */
export async function setSetting(key, value) {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const req = store.put({ key, value });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// CATEGORIES
// ---------------------------------------------------------------------------

/**
 * Get all available categories (defaults + custom from settings + any
 * category already used by existing habits).
 *
 * @returns {Promise<string[]>}
 */
export async function getCategories() {
  const defaults = ['Health', 'Productivity', 'Mindfulness', 'Fitness', 'Learning', 'Social'];

  const customCategories = (await getSetting('customCategories', [])) || [];

  const habits = await getHabits(true);
  const habitCategories = habits.map((h) => h.category).filter(Boolean);

  const all = new Set([...defaults, ...customCategories, ...habitCategories]);
  return [...all].sort();
}
