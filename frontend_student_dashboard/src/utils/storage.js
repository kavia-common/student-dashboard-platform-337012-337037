/**
 * Small, defensive localStorage helpers.
 * Keeps the dashboard resilient in environments where storage is blocked.
 */

const PREFIX = "student_dashboard:";

// PUBLIC_INTERFACE
export function loadFromStorage(key, fallbackValue) {
  /** Load JSON value from localStorage, returning fallbackValue on any error. */
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${key}`);
    if (raw == null) return fallbackValue;
    return JSON.parse(raw);
  } catch {
    return fallbackValue;
  }
}

// PUBLIC_INTERFACE
export function saveToStorage(key, value) {
  /** Save JSON value to localStorage. No-op on any error. */
  try {
    window.localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // ignore
  }
}
