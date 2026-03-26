/**
 * Dependency-free CSV helpers for exporting dashboard tables.
 * Keeps implementation small and browser-compatible (Blob + download).
 */

/**
 * PUBLIC_INTERFACE
 * Convert rows into a CSV string.
 *
 * @param {Object} params
 * @param {string[]} params.headers - Column header titles (first row).
 * @param {Array<Array<any>>} params.rows - Rows of cell values (will be stringified).
 * @returns {string} CSV contents (UTF-8).
 */
export function toCsvString({ headers, rows }) {
  const safeHeaders = Array.isArray(headers) ? headers : [];
  const safeRows = Array.isArray(rows) ? rows : [];

  const escapeCell = (value) => {
    // Normalize nullish and preserve numbers/booleans as strings.
    const s = value == null ? "" : String(value);

    // If it contains special chars, wrap in quotes and escape quotes as "".
    // RFC4180-ish behavior.
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [];
  lines.push(safeHeaders.map(escapeCell).join(","));
  for (const r of safeRows) {
    const row = Array.isArray(r) ? r : [];
    lines.push(row.map(escapeCell).join(","));
  }

  // Use CRLF for broad compatibility (Excel, etc.).
  return `${lines.join("\r\n")}\r\n`;
}

/**
 * PUBLIC_INTERFACE
 * Trigger a browser download for a text blob (CSV).
 *
 * @param {Object} params
 * @param {string} params.filename - Download filename (e.g. "grades.csv").
 * @param {string} params.content - File contents as string.
 * @param {string} [params.mimeType] - MIME type; defaults to text/csv.
 * @returns {void}
 */
export function downloadTextFile({ filename, content, mimeType = "text/csv;charset=utf-8" }) {
  // In case this is called in non-browser contexts (tests), fail gracefully.
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const safeName = String(filename || "export.csv");
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = safeName;

  // Append so it works in Firefox.
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Release the blob URL.
  URL.revokeObjectURL(url);
}

/**
 * PUBLIC_INTERFACE
 * Convenience: build CSV + download.
 *
 * @param {Object} params
 * @param {string} params.filename
 * @param {string[]} params.headers
 * @param {Array<Array<any>>} params.rows
 * @returns {void}
 */
export function downloadCsv({ filename, headers, rows }) {
  const csv = toCsvString({ headers, rows });
  downloadTextFile({ filename, content: csv, mimeType: "text/csv;charset=utf-8" });
}
