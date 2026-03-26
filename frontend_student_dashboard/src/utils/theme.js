/**
 * Theme utilities for the student dashboard.
 * Uses the existing defensive localStorage helpers for persistence.
 */

import { loadFromStorage, saveToStorage } from "./storage";

const THEME_KEY = "theme_preference"; // stored under the storage prefix in storage.js

/**
 * PUBLIC_INTERFACE
 * Return true if the OS prefers dark mode.
 *
 * @returns {boolean}
 */
export function prefersDark() {
  /** Checks system-level preference for dark mode (if supported). */
  if (typeof window === "undefined" || typeof window.matchMedia === "undefined") return false;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

/**
 * PUBLIC_INTERFACE
 * Load the initial theme choice.
 *
 * Order:
 * 1) persisted preference ("light" | "dark")
 * 2) system preference
 *
 * @returns {"light" | "dark"}
 */
export function loadInitialTheme() {
  /** Load theme from storage, defaulting to OS preference. */
  const saved = loadFromStorage(THEME_KEY, null);
  if (saved === "light" || saved === "dark") return saved;
  return prefersDark() ? "dark" : "light";
}

/**
 * PUBLIC_INTERFACE
 * Persist and apply a theme to the document.
 *
 * Applies:
 * - document.documentElement.dataset.theme = "light" | "dark"
 * - meta[name="theme-color"] content (so browser UI matches)
 *
 * @param {"light" | "dark"} theme
 * @param {Object} [opts]
 * @param {boolean} [opts.persist=true]
 * @returns {void}
 */
export function applyTheme(theme, { persist = true } = {}) {
  /** Apply theme attributes to the DOM and optionally persist. */
  if (typeof document === "undefined") return;

  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = next;

  // Update browser UI theme color if meta tag exists.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", next === "dark" ? "#0b1220" : "#1A1A1A");
  }

  if (persist) saveToStorage(THEME_KEY, next);
}

/**
 * PUBLIC_INTERFACE
 * Toggle theme and return the next theme.
 *
 * @param {"light" | "dark"} current
 * @returns {"light" | "dark"}
 */
export function toggleTheme(current) {
  /** Toggle theme string. */
  return current === "dark" ? "light" : "dark";
}

export const THEME_STORAGE_KEY = THEME_KEY;
