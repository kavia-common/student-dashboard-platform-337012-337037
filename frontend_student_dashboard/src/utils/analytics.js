/**
 * Analytics helper utilities for the student dashboard.
 * These are pure functions to keep UI rendering simple and testable.
 */

// PUBLIC_INTERFACE
export function clampNumber(value, min, max) {
  /** Clamp a numeric value to an inclusive [min, max] range. */
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

// PUBLIC_INTERFACE
export function calcGpaFromGradePercents(percents, { scale = 4 } = {}) {
  /**
   * Calculate a simple GPA estimate (0..scale) from grade percentages.
   * This is a deterministic mock-friendly conversion, not an official GPA formula.
   *
   * Mapping (typical):
   *  93-100 => 4.0
   *  90-92  => 3.7
   *  87-89  => 3.3
   *  83-86  => 3.0
   *  80-82  => 2.7
   *  77-79  => 2.3
   *  73-76  => 2.0
   *  70-72  => 1.7
   *  67-69  => 1.3
   *  63-66  => 1.0
   *  60-62  => 0.7
   *  <60    => 0.0
   */
  const list = Array.isArray(percents) ? percents : [];
  if (list.length === 0) return 0;

  const gradeToPoints = (pct) => {
    const p = clampNumber(pct, 0, 100);
    if (p >= 93) return 4.0;
    if (p >= 90) return 3.7;
    if (p >= 87) return 3.3;
    if (p >= 83) return 3.0;
    if (p >= 80) return 2.7;
    if (p >= 77) return 2.3;
    if (p >= 73) return 2.0;
    if (p >= 70) return 1.7;
    if (p >= 67) return 1.3;
    if (p >= 63) return 1.0;
    if (p >= 60) return 0.7;
    return 0.0;
  };

  const avgPoints =
    list.map(gradeToPoints).reduce((a, b) => a + b, 0) / list.length;

  return clampNumber(avgPoints, 0, scale);
}

// PUBLIC_INTERFACE
export function buildWeeklySeriesFromDates(items, getDate, { weeks = 8 } = {}) {
  /**
   * Bucket items into the last N weeks. Returns array of { label, value } sorted oldest->newest.
   * - label: "W-7" ... "W-0"
   * - value: count of items whose date falls inside that week
   */
  const safeItems = Array.isArray(items) ? items : [];
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setDate(start.getDate() - (weeks * 7 - 1));
  start.setHours(0, 0, 0, 0);

  const toWeekIndex = (d) => {
    const msPerDay = 1000 * 60 * 60 * 24;
    const diffDays = Math.floor((d - start) / msPerDay);
    if (diffDays < 0) return null;
    const idx = Math.floor(diffDays / 7);
    if (idx < 0 || idx >= weeks) return null;
    return idx;
  };

  const buckets = Array.from({ length: weeks }).map((_, i) => ({
    label: `W-${weeks - 1 - i}`,
    value: 0,
  }));

  for (const it of safeItems) {
    const raw = getDate(it);
    const d = raw instanceof Date ? raw : new Date(raw);
    if (!Number.isFinite(d.getTime())) continue;
    const idx = toWeekIndex(d);
    if (idx == null) continue;
    buckets[idx].value += 1;
  }

  return buckets;
}

// PUBLIC_INTERFACE
export function buildNumericTrendSeries(values, labels) {
  /**
   * Creates a series from numeric values + labels, coercing invalid numbers to 0.
   * Returns array of { label, value }.
   */
  const v = Array.isArray(values) ? values : [];
  const l = Array.isArray(labels) ? labels : [];
  return v.map((n, i) => ({
    label: String(l[i] ?? `${i + 1}`),
    value: Number.isFinite(Number(n)) ? Number(n) : 0,
  }));
}

// PUBLIC_INTERFACE
export function calcTrendDelta(series) {
  /**
   * Compute delta from previous to latest value in a series.
   * Returns { delta, direction: "up"|"down"|"flat" }.
   */
  const s = Array.isArray(series) ? series : [];
  if (s.length < 2) return { delta: 0, direction: "flat" };
  const a = Number(s[s.length - 2]?.value ?? 0);
  const b = Number(s[s.length - 1]?.value ?? 0);
  const delta = b - a;
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  return { delta, direction };
}
