/**
 * pages/SalesModule.jsx
 * -------------------------------------------------------------------------
 * The "Sales & Invoices" tab — list/search/filter invoices, and owns the
 * actual save/cancel logic (calling Supabase, adjusting stock, bumping the
 * invoice number counter, writing the audit log). The modals themselves
 * (the form and the read-only view) live in InvoiceForm.jsx / InvoiceView.jsx
 * to keep this file focused on the list + orchestration.
 *
 * Consumes ctx.globalFocus so the header's GlobalSearch can deep-link here
 * with a specific invoice number pre-filled into the search box.
 * -------------------------------------------------------------------------
 */

import React, { useState, useEffect } from "react";
import { Plus, Search, Edit2, XCircle, FileText, Paperclip } from "lucide-react";
import { T } from "../lib/constants";
import { INR, fmtDate } from "../lib/format";
import { Card, Badge, Btn, EmptyState, SectionHeader, statusTone } from "../components/ui";
import { insertRow, updateRow, uploadAttachment } from "../lib/db";
import InvoiceForm from "./InvoiceForm";
import InvoiceView from "./InvoiceView";

export default function SalesModule({ ctx }) {
  const { invoices, setInvoices, invoiceTotals, invoiceBalance, adjustStock, company, setCompany } = ctx;
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [filter, setFilter] = useState("All");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ctx.globalFocus?.tab === "sales") { setQ(ctx.globalFocus.value); ctx.setGlobalFocus(null); }
  }, [ctx.globalFocus]); // eslint-disable-line

  const filtered = invoices.filter((i) => {
    const cust = ctx.getCustomer(i.customerId);
    const matchQ = !q || i.number.toLowerCase().includes(q.toLowerCase()) || (cust && cust.name.toLowerCase().includes(q.toLowerCase()));
    const matchF = filter === "All" || i.status === filter;
    return matchQ && matchF;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const saveInvoice = async (inv, isNew, file) => {
    setBusy(true);
    try {
      let attachmentUrl = inv.attachmentUrl || null;
      if (file) attachmentUrl = await uploadAttachment(file, company.id);
      const payload = { ...inv, attachmentUrl };
      if (isNew) {
        const row = await insertRow("invoices", { ...payload, companyId: company.id, createdBy: ctx.currentUser.id });
        setInvoices((prev) => [row, ...prev]);
        // Stock is only consumed once the invoice leaves Draft/Cancelled —
        // drafts aren't final sales yet.
        if (row.status !== "Draft" && row.status !== "Cancelled") {
          for (const it of inv.items) await adjustStock(it.productId, -Number(it.qty), "Sales", row.id);
        }
        const updatedCompany = await updateRow("companies", company.id, { nextInvoiceNumber: company.nextInvoiceNumber + 1 });
        setCompany(updatedCompany);
        ctx.logAudit("Invoice created", `${row.number} for ${ctx.getCustomer(row.customerId)?.name}`);
      } else {
        const prev = invoices.find((i) => i.id === inv.id);
        const wasCounted = prev && prev.status !== "Draft" && prev.status !== "Cancelled";
        const nowCounted = inv.status !== "Draft" && inv.status !== "Cancelled";
        const row = await updateRow("invoices", inv.id, payload);
        setInvoices((prev2) => prev2.map((i) => (i.id === row.id ? row : i)));
        // Reconcile stock between what the invoice used to consume and what
        // it consumes now: net per-product delta on a normal edit, full
        // restore/re-consume when the status crosses into/out of Cancelled.
        if (wasCounted !== nowCounted) {
          const sourceItems = nowCounted ? inv.items : (prev?.items || []);
          for (const it of sourceItems) await adjustStock(it.productId, nowCounted ? -Number(it.qty) : Number(it.qty), "Sales status change", row.id);
        } else if (nowCounted && prev) {
          const oldQty = {}; prev.items.forEach((it) => { oldQty[it.productId] = (oldQty[it.productId] || 0) + Number(it.qty); });
          const newQty = {}; inv.items.forEach((it) => { newQty[it.productId] = (newQty[it.productId] || 0) + Number(it.qty); });
          const ids = new Set([...Object.keys(oldQty), ...Object.keys(newQty)]);
          for (const pid of ids) {
            const d = (oldQty[pid] || 0) - (newQty[pid] || 0);
            if (d) await adjustStock(pid, d, "Sales edit", row.id);
          }
        }
        ctx.logAudit("Invoice modified", `${row.number} (status: ${row.status})`);
      }
      setShowForm(false); setEditing(null);
    } catch (e) {
      if (e.code === "23505" || /duplicate key/i.test(e.message || "")) alert("An invoice with this number already exists. Bump 'Next invoice #' in Settings and retry.");
      else alert("Could not save invoice: " + e.message);
    }
    setBusy(false);
  };

  const cancelInvoice = async (inv) => {
    if (inv.status === "Cancelled") return;
    if (!confirm(`Cancel invoice ${inv.number}? Stock will be returned and this cannot be undone.`)) return;
    try {
      if (inv.status !== "Draft") {
        for (const it of inv.items) await adjustStock(it.productId, Number(it.qty), "Sales Cancellation", inv.id);
      }
      const row = await updateRow("invoices", inv.id, { status: "Cancelled" });
      setInvoices((prev) => prev.map((i) => (i.id === row.id ? row : i)));
      ctx.logAudit("Invoice cancelled", `${inv.number}`);
    } catch (e) { alert("Could not cancel invoice: " + e.message); }
  };

  return (
    <div>
      <SectionHeader title="Sales & Invoices" subtitle="Quotations → Sales Orders → GST Invoices → Payments" action={<Btn icon={Plus} onClick={() => { setEditing(null); setShowForm(true); }}>New Invoice</Btn>} />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 flex-1 min-w-[200px]" style={{ background: T.surface, border: `1px solid ${T.border}` }}><Search size={14} color={T.inkFaint} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice # or customer…" className="outline-none text-sm flex-1" style={{ color: T.ink }} /></div>
        <div className="flex gap-1 flex-wrap">{["All", "Draft", "Sent", "Partially Paid", "Paid", "Overdue", "Cancelled"].map((s) => <button key={s} onClick={() => setFilter(s)} className="px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ background: filter === s ? T.navy : T.surface, color: filter === s ? "#fff" : T.inkSoft, border: `1px solid ${filter === s ? T.navy : T.border}` }}>{s}</button>)}</div>
      </div>
      <Card>
        {filtered.length === 0 ? <EmptyState icon={FileText} title="No invoices found" subtitle="Create your first GST invoice to get started." action={<Btn className="mt-3" icon={Plus} onClick={() => setShowForm(true)}>New Invoice</Btn>} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{["Invoice #", "Date", "Customer", "Amount", "Balance", "Status", ""].map((h) => <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: T.inkFaint }}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((inv) => {
                  const tot = invoiceTotals(inv); const bal = invoiceBalance(inv); const cust = ctx.getCustomer(inv.customerId);
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50 cursor-pointer" style={{ borderBottom: `1px solid ${T.borderSoft}` }} onClick={() => setViewing(inv)}>
                      <td className="px-4 py-2.5 font-medium" style={{ color: T.navy }}>{inv.number}{inv.attachmentUrl && <Paperclip size={11} className="inline ml-1" style={{ color: T.inkFaint }} />}</td>
                      <td className="px-4 py-2.5" style={{ color: T.inkSoft }}>{fmtDate(inv.date)}</td>
                      <td className="px-4 py-2.5" style={{ color: T.ink }}>{cust?.name || "—"}</td>
                      <td className="px-4 py-2.5 font-medium" style={{ color: T.ink }}>{INR(tot.grandTotal)}</td>
                      <td className="px-4 py-2.5" style={{ color: bal > 0 ? T.red : T.inkFaint }}>{bal > 0 ? INR(bal) : "—"}</td>
                      <td className="px-4 py-2.5"><Badge tone={statusTone(inv.status)}>{inv.status}</Badge></td>
                      <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <button title="Edit" onClick={() => { setEditing(inv); setShowForm(true); }} className="p-1.5 rounded-md hover:bg-gray-100"><Edit2 size={14} color={T.inkSoft} /></button>
                          {inv.status !== "Cancelled" && <button title="Cancel" onClick={() => cancelInvoice(inv)} className="p-1.5 rounded-md hover:bg-gray-100"><XCircle size={14} color={T.red} /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <InvoiceForm open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} onSave={saveInvoice} editing={editing} ctx={ctx} busy={busy} />
      <InvoiceView inv={viewing} onClose={() => setViewing(null)} ctx={ctx} />
    </div>
  );
}
