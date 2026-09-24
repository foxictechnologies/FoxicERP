/**
 * taxEngine.js
 * -------------------------------------------------------------------------
 * The one function that knows how Indian GST is calculated for an invoice.
 * Everything about invoice totals flows through here — the invoice form,
 * the invoice view/print, the sales list, reports, and analytics all call
 * this instead of recalculating tax themselves, so there's exactly one
 * place to fix if a tax rule ever needs to change.
 *
 * taxType controls how CGST+SGST vs IGST is decided:
 *   "auto"      (default, recommended) — compares the company's state to
 *               the customer's state. Same state = CGST+SGST (intra-state).
 *               Different state = IGST (inter-state). This matches how GST
 *               actually works in India.
 *   "cgst_sgst" — force CGST+SGST regardless of state (manual override).
 *   "igst"      — force IGST regardless of state (manual override).
 * Overrides exist so a business can correct a data-entry mistake or handle
 * an edge case, but the UI shows a warning when one is used — the override
 * doesn't change the actual legal place-of-supply rule, only what the
 * invoice displays and charges.
 * -------------------------------------------------------------------------
 */

export function computeInvoiceTotals(items, products, companyState, customerState, taxType = "auto") {
  let interState;
  if (taxType === "igst") interState = true;
  else if (taxType === "cgst_sgst") interState = false;
  else interState = Boolean(companyState && customerState && companyState !== customerState);
  let taxable = 0, cgst = 0, sgst = 0, igst = 0, discount = 0;
  const lines = items.map((it) => {
    const prod = products.find((p) => p.id === it.productId);
    if (!prod) return null;
    const gross = (Number(it.qty) || 0) * (Number(it.rate) || 0);
    // Discount accepts both forms: "250" = flat rupees, "7.5%" = percent of
    // the line's gross. Anything unparsable counts as no discount, and the
    // result is clamped so taxable can never go negative.
    const rawDisc = String(it.discount ?? "").trim();
    let lineDiscount = 0;
    if (rawDisc.endsWith("%")) {
      const pct = Number(rawDisc.slice(0, -1));
      if (Number.isFinite(pct) && pct > 0) lineDiscount = (gross * pct) / 100;
    } else {
      const flat = Number(rawDisc);
      if (Number.isFinite(flat) && flat > 0) lineDiscount = flat;
    }
    lineDiscount = Math.min(lineDiscount, gross);
    const lineTaxable = gross - lineDiscount;
    const gstRate = (it.gstRate !== undefined && it.gstRate !== null && it.gstRate !== "")
      ? Number(it.gstRate)
      : (prod.gstRate || 0);
    let lc = 0, ls = 0, li = 0;
    if (interState) li = (lineTaxable * gstRate) / 100;
    else { lc = (lineTaxable * gstRate) / 200; ls = (lineTaxable * gstRate) / 200; }
    taxable += lineTaxable; cgst += lc; sgst += ls; igst += li; discount += lineDiscount;
    return { ...it, product: prod, gross, discount: lineDiscount, lineTaxable, rate: Number(it.rate) || 0, gstRate, cgst: lc, sgst: ls, igst: li, lineTotal: lineTaxable + lc + ls + li };
  }).filter(Boolean);
  const preRound = taxable + cgst + sgst + igst;
  const grandTotal = Math.round(preRound);
  const roundOff = +(grandTotal - preRound).toFixed(2);
  return { lines, taxable, discount, cgst, sgst, igst, interState, preRound, roundOff, grandTotal };
}
