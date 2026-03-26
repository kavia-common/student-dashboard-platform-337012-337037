/**
 * Dashboard helper functions (pure).
 */

// PUBLIC_INTERFACE
export function formatDateTime(isoString) {
  /** Formats an ISO date string into a readable date/time for UI. */
  try {
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

// PUBLIC_INTERFACE
export function formatShortDate(isoString) {
  /** Formats an ISO date string into a short date for UI. */
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return isoString;
  }
}

// PUBLIC_INTERFACE
export function includesQuery(text, query) {
  /** Case-insensitive substring match. */
  if (!query) return true;
  return String(text ?? "").toLowerCase().includes(query.toLowerCase());
}

// PUBLIC_INTERFACE
export function assignmentStatusPill(status) {
  /** Maps assignment status to pill style. */
  const s = String(status || "").toLowerCase();
  if (s.includes("submitted")) return "pillGreen";
  if (s.includes("progress")) return "pillBlue";
  if (s.includes("late")) return "pillRed";
  return "pillAmber";
}

// PUBLIC_INTERFACE
export function calcGradePercent(score, outOf) {
  /** Computes score percentage (0-100). */
  if (!outOf || outOf <= 0) return 0;
  return Math.round((score / outOf) * 100);
}
