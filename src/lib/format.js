/**
 * format.js
 * -------------------------------------------------------------------------
 * Small, pure formatting/utility helpers used all over the app.
 * No React, no Supabase — safe to import from anywhere, including tests.
 *  - INR / INR2      rupee formatting (whole numbers vs 2-decimal)
 *  - fmtDate         human-readable date (21 Aug 2026)
 *  - todayISO        today's date as YYYY-MM-DD (matches <input type="date">)
 *  - uid             a random ID for new rows created client-side
 *  - numToWordsIndian  converts an amount to the Indian numbering system
 *                    words (Lakh/Crore) for the "Amount in words" line on
 *                    printed invoices
 * -------------------------------------------------------------------------
 */

export const INR = (n) => "\u20B9" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
export const INR2 = (n) => "\u20B9" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
// IST-safe: an India-focused business date must roll over at midnight IST,
// not UTC — a plain toISOString() would return the previous day between
// 00:00 and 05:30 IST.
export const todayISO = () => {
  const now = new Date();
  const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);
  return ist.toISOString().slice(0, 10);
};
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now());

export const numToWordsIndian = (num) => {
  num = Math.round(num);
  if (num === 0) return "Zero Rupees Only";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (n) => (n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : ""));
  const three = (n) => (n >= 100 ? ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + two(n % 100) : "") : two(n));
  let n = num, parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const rest = n;
  if (crore) parts.push(three(crore) + " Crore");
  if (lakh) parts.push(three(lakh) + " Lakh");
  if (thousand) parts.push(three(thousand) + " Thousand");
  if (rest) parts.push(three(rest));
  return parts.join(" ") + " Rupees Only";
};
