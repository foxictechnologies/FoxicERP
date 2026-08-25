/**
 * dateRange.js
 * -------------------------------------------------------------------------
 * Turns a human date-range label ("This month", "Last month", "Custom", ...)
 * into an actual { start, end } Date pair, and a helper to test whether a
 * date string falls inside that range.
 * Used by Dashboard.jsx and AnalyticsModule.jsx for their date filters.
 * -------------------------------------------------------------------------
 */

export function getRangeDates(label, customFrom, customTo) {
  const now = new Date();
  const start = new Date(now); const end = new Date(now);
  start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
  switch (label) {
    case "Today": break;
    case "This week": start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); break;
    case "This month": start.setDate(1); break;
    case "Last month": start.setMonth(now.getMonth() - 1, 1); end.setMonth(now.getMonth(), 0); break;
    case "This quarter": { const q = Math.floor(now.getMonth() / 3); start.setMonth(q * 3, 1); break; }
    case "This year": start.setMonth(0, 1); break;
    case "All time": start.setFullYear(2000, 0, 1); break;
    case "Custom": return { start: customFrom ? new Date(customFrom) : new Date(2000, 0, 1), end: customTo ? new Date(customTo + "T23:59:59") : end };
    default: start.setDate(1);
  }
  return { start, end };
}

export function inRange(dateStr, range) {
  const d = new Date(dateStr);
  return d >= range.start && d <= range.end;
}
