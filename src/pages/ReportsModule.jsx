/**
 * pages/ReportsModule.jsx
 * -------------------------------------------------------------------------
 * The "Reports" tab — a set of pre-built tabular reports (Sales, GST
 * Summary, Purchases, Stock Valuation, Expenses), all computed on the fly
 * from data already in `ctx`. To add a new report, add an entry to the
 * `reports` object with an icon and a `rows` array of plain objects — the
 * table renders whatever keys the first row has.
 * -------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { FileText, Receipt, ShoppingCart, Boxes } from "lucide-react";
import { T } from "../lib/constants";
import { INR, INR2, fmtDate } from "../lib/format";
import { Card, EmptyState, SectionHeader } from "../components/ui";

export default function ReportsModule({ ctx }) {
  const { invoices, purchases, expenses, products, invoiceTotals, purchaseTotal } = ctx;
  const [report, setReport] = useState("Sales");
  const activeInvoices = invoices.filter((i) => i.status !== "Draft" && i.status !== "Cancelled");
  const reports = {
    "Sales": { icon: FileText, rows: activeInvoices.map((i) => ({ Date: fmtDate(i.date), Invoice: i.number, Customer: ctx.getCustomer(i.customerId)?.name, Status: i.status, Amount: INR(invoiceTotals(i).grandTotal) })) },
    "GST Summary": { icon: Receipt, rows: (() => { const byRate = {}; activeInvoices.forEach((i) => invoiceTotals(i).lines.forEach((l) => { const key = l.gstRate + "%"; byRate[key] = byRate[key] || { Rate: key, Taxable: 0, CGST: 0, SGST: 0, GST: 0 }; byRate[key].Taxable += l.lineTaxable; byRate[key].CGST += l.cgst; byRate[key].SGST += l.sgst; byRate[key].GST += l.igst; })); return Object.values(byRate).map((r) => ({ ...r, Taxable: INR2(r.Taxable), CGST: INR2(r.CGST), SGST: INR2(r.SGST), GST: INR2(r.GST) })); })() },
    "Purchases": { icon: ShoppingCart, rows: purchases.map((p) => ({ Date: fmtDate(p.date), "Purchase #": p.number, Vendor: ctx.getVendor(p.vendorId)?.name, Status: p.status, Amount: INR(purchaseTotal(p)) })) },
    "Stock Valuation": { icon: Boxes, rows: products.map((p) => ({ Product: p.name, SKU: p.sku, Stock: p.currentStock + " " + p.unit, "Purchase Price": INR(p.purchasePrice), Value: INR(p.currentStock * p.purchasePrice) })) },
    "Expenses": { icon: Receipt, rows: expenses.map((e) => ({ Date: fmtDate(e.date), Category: e.category, Description: e.description, Amount: INR(e.amount) })) },
  };
  const current = reports[report];
  const cols = current.rows.length ? Object.keys(current.rows[0]) : [];
  return (
    <div>
      <SectionHeader title="Reports" subtitle="Sales, purchase, inventory and financial reports" />
      <div className="flex gap-1 mb-4 flex-wrap">{Object.keys(reports).map((r) => <button key={r} onClick={() => setReport(r)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: report === r ? T.navy : T.surface, color: report === r ? "#fff" : T.inkSoft, border: `1px solid ${report === r ? T.navy : T.border}` }}>{r}</button>)}</div>
      <Card>
        {current.rows.length === 0 ? <EmptyState icon={current.icon} title="No data for this report yet" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{cols.map((c) => <th key={c} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: T.inkFaint }}>{c}</th>)}</tr></thead>
              <tbody>{current.rows.map((row, i) => <tr key={i} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>{cols.map((c) => <td key={c} className="px-4 py-2.5" style={{ color: T.ink }}>{row[c]}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
