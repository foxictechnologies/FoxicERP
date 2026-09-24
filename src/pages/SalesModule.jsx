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
import { Plus, Search, Edit2, XCircle, Trash2, ShieldCheck, FileText, Paperclip, Clock, ShieldAlert } from "lucide-react";
import { T } from "../lib/constants";
import { INR, fmtDate, uid } from "../lib/format";
import { Card, Badge, Btn, EmptyState, SectionHeader, statusTone, AcceptBtn, RejectBtn, CancelBtn } from "../components/ui";
import { insertRow, updateRow, deleteRow, uploadAttachment } from "../lib/db";
import InvoiceForm from "./InvoiceForm";
import InvoiceView from "./InvoiceView";

const PENDING_INVOICE_EDITS_KEY = (companyId) => `erp_pending_invoice_edits_${companyId || "default"}`;

const getPendingInvoiceEdits = (companyId) => {
  try {
    const raw = localStorage.getItem(PENDING_INVOICE_EDITS_KEY(companyId));
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

const savePendingInvoiceEdits = (companyId, requests) => {
  try { localStorage.setItem(PENDING_INVOICE_EDITS_KEY(companyId), JSON.stringify(requests)); } catch (e) {}
};

const displayValue = (value, ctx) => {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.map((item) => `${ctx?.getProduct(item.productId)?.name || item.productId || "item"} x ${item.qty} @ ₹${item.rate}`).join(", ");
  return String(value);
};

const invoiceChanges = (original, updated, ctx) => {
  const changes = [];
  const fields = [
    ["Customer", ctx.getCustomer(original.customerId)?.name, ctx.getCustomer(updated.customerId)?.name],
    ["Invoice date", original.date, updated.date],
    ["Due date", original.dueDate, updated.dueDate],
    ["Status", original.status, updated.status],
    ["Paid amount", original.paidAmount, updated.paidAmount],
    ["Tax calculation", original.taxType, updated.taxType],
    ["Attachment", original.attachmentUrl ? "Attached" : "None", updated.attachmentUrl ? "Attached" : "None"]
  ];
  fields.forEach(([label, before, after]) => {
    if (displayValue(before, ctx) !== displayValue(after, ctx)) changes.push({ label, before: displayValue(before, ctx), after: displayValue(after, ctx) });
  });
  if (JSON.stringify(original.items || []) !== JSON.stringify(updated.items || [])) {
    changes.push({ label: "Line items", before: displayValue(original.items, ctx), after: displayValue(updated.items, ctx) });
  }
  return changes;
};

export default function SalesModule({ ctx }) {
  const { invoices, setInvoices, invoiceTotals, invoiceBalance, adjustStock, company, setCompany } = ctx;
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [filter, setFilter] = useState("All");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingEdits, setPendingEdits] = useState({});
  const role = ctx.role || ctx.currentUser?.role;
  const isOwner = role === "Owner";
  const isManager = role === "Manager";
  const isApprover = isOwner || isManager;

  useEffect(() => {
    if (ctx.globalFocus?.tab === "sales") { setQ(ctx.globalFocus.value); ctx.setGlobalFocus(null); }
  }, [ctx.globalFocus]); // eslint-disable-line

  useEffect(() => {
    if (!company?.id) return;
    const persisted = invoices.reduce((requests, invoice) => {
      if (invoice.pendingEdit) requests[invoice.id] = invoice.pendingEdit;
      return requests;
    }, {});
    setPendingEdits(Object.keys(persisted).length ? persisted : getPendingInvoiceEdits(company.id));
  }, [company?.id, invoices]);

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
      if (file) {
        try { attachmentUrl = await uploadAttachment(file, company.id); } catch (e) { console.warn(e); }
      }
      const payload = { ...inv, attachmentUrl };
      if (!isNew && !isApprover) {
        const original = invoices.find((item) => item.id === inv.id);
        if (!original) throw new Error("The original invoice could not be found.");
        const pendingItem = {
          invoiceId: inv.id,
          original,
          updated: payload,
          requestedBy: ctx.currentUser?.name || "Sales Employee",
          requestedById: ctx.currentUser?.id,
          createdAt: new Date().toISOString()
        };
        const nextPending = { ...pendingEdits, [inv.id]: pendingItem };
        try {
          await updateRow("invoices", inv.id, { pendingEdit: pendingItem });
        } catch (err) {
          console.warn("Supabase invoice edit request fallback:", err);
          savePendingInvoiceEdits(company.id, nextPending);
        }
        setInvoices((prev) => prev.map((item) => item.id === inv.id ? { ...item, pendingEdit: pendingItem } : item));
        setPendingEdits(nextPending);
        ctx.logAudit("Invoice edit requested", `${inv.number} by ${pendingItem.requestedBy}`);
        alert("Invoice edit request submitted. It will take effect after Owner or Manager approval.");
        setShowForm(false); setEditing(null);
        return;
      }
      if (isNew) {
        let row = { ...payload, id: uid(), companyId: company?.id || "test-company-id", createdBy: ctx.currentUser?.id || "test-user-id" };
        try {
          const inserted = await insertRow("invoices", row);
          if (inserted?.id) row = inserted;
        } catch (err) {
          console.warn("Supabase insert invoice fallback:", err);
        }
        setInvoices((prev) => [row, ...prev]);
        // Stock is only consumed once the invoice leaves Draft/Cancelled
        if (row.status !== "Draft" && row.status !== "Cancelled") {
          for (const it of inv.items) await adjustStock(it.productId, -Number(it.qty), "Sales", row.id);
        }
        if (company?.id) {
          try {
            const updatedCompany = await updateRow("companies", company.id, { nextInvoiceNumber: (company.nextInvoiceNumber || 101) + 1 });
            if (updatedCompany) setCompany(updatedCompany);
          } catch (e) {
            setCompany((prev) => ({ ...prev, nextInvoiceNumber: (prev.nextInvoiceNumber || 101) + 1 }));
          }
        }
        ctx.logAudit("Invoice created", `${row.number} for ${ctx.getCustomer(row.customerId)?.name}`);
      } else {
        const prev = invoices.find((i) => i.id === inv.id);
        const wasCounted = prev && prev.status !== "Draft" && prev.status !== "Cancelled";
        const nowCounted = inv.status !== "Draft" && inv.status !== "Cancelled";
        let row = { ...payload, id: inv.id };
        try {
          const updated = await updateRow("invoices", inv.id, payload);
          if (updated?.id) row = updated;
        } catch (err) {
          console.warn("Supabase update invoice fallback:", err);
        }
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

  const applyApprovedEdit = async (invoiceId) => {
    const pending = pendingEdits[invoiceId];
    if (!pending || !isApprover) return;
    setBusy(true);
    try {
      const previous = invoices.find((item) => item.id === invoiceId) || pending.original;
      const next = { ...pending.updated, pendingEdit: null };
      let row = next;
      try {
        const updated = await updateRow("invoices", invoiceId, next);
        if (updated?.id) row = updated;
      } catch (err) {
        console.warn("Supabase invoice approval fallback:", err);
      }
      setInvoices((prev) => prev.map((item) => item.id === invoiceId ? row : item));
      const wasCounted = previous.status !== "Draft" && previous.status !== "Cancelled";
      const nowCounted = row.status !== "Draft" && row.status !== "Cancelled";
      if (wasCounted !== nowCounted) {
        const sourceItems = nowCounted ? row.items : (previous.items || []);
        for (const item of sourceItems) await adjustStock(item.productId, nowCounted ? -Number(item.qty) : Number(item.qty), "Approved sales edit", invoiceId);
      } else if (nowCounted) {
        const oldQty = {}; (previous.items || []).forEach((item) => { oldQty[item.productId] = (oldQty[item.productId] || 0) + Number(item.qty); });
        const newQty = {}; (row.items || []).forEach((item) => { newQty[item.productId] = (newQty[item.productId] || 0) + Number(item.qty); });
        for (const productId of new Set([...Object.keys(oldQty), ...Object.keys(newQty)])) {
          const delta = (oldQty[productId] || 0) - (newQty[productId] || 0);
          if (delta) await adjustStock(productId, delta, "Approved sales edit", invoiceId);
        }
      }
      const nextPending = { ...pendingEdits }; delete nextPending[invoiceId];
      savePendingInvoiceEdits(company.id, nextPending); setPendingEdits(nextPending);
      ctx.logAudit("Invoice edit approved", `${row.number} requested by ${pending.requestedBy}`);
      alert(`Invoice edit approved for ${row.number}.`);
    } catch (e) {
      alert("Could not approve invoice edit: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const rejectEditRequest = (invoiceId) => {
    const pending = pendingEdits[invoiceId];
    if (!pending || !isApprover) return;
    const nextPending = { ...pendingEdits }; delete nextPending[invoiceId];
    updateRow("invoices", invoiceId, { pendingEdit: null }).catch((err) => console.warn("Could not clear invoice request in Supabase:", err));
    savePendingInvoiceEdits(company.id, nextPending); setPendingEdits(nextPending);
    ctx.logAudit("Invoice edit rejected", `${pending.updated.number} requested by ${pending.requestedBy}`);
    alert(`Invoice edit rejected for ${pending.updated.number}.`);
  };

  const cancelEditRequest = (invoiceId) => {
    const pending = pendingEdits[invoiceId];
    if (!pending || isApprover) return;
    const nextPending = { ...pendingEdits }; delete nextPending[invoiceId];
    updateRow("invoices", invoiceId, { pendingEdit: null }).catch((err) => console.warn("Could not clear invoice request in Supabase:", err));
    savePendingInvoiceEdits(company.id, nextPending); setPendingEdits(nextPending);
    ctx.logAudit("Invoice edit request cancelled", `${pending.updated.number}`);
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

  const deleteInvoice = async (inv) => {
    const canDelete = isOwner || isManager || (role === "Sales" && inv.deletePermission === true);
    if (!canDelete) {
      alert("Owner or Manager permission is required before Sales can delete this invoice.");
      return;
    }
    if (inv.status !== "Cancelled") {
      alert("Only cancelled invoices can be deleted.");
      return;
    }
    if (!confirm(`Delete cancelled invoice ${inv.number}? This cannot be undone.`)) return;
    try {
      await deleteRow("invoices", inv.id);
      setInvoices((prev) => prev.filter((item) => item.id !== inv.id));
      const nextPending = { ...pendingEdits }; delete nextPending[inv.id];
      savePendingInvoiceEdits(company.id, nextPending); setPendingEdits(nextPending);
      ctx.logAudit("Invoice deleted", `${inv.number} (cancelled)`);
    } catch (e) {
      alert("Could not delete invoice: " + e.message);
    }
  };

  const toggleDeletePermission = async (inv) => {
    if (!isApprover || inv.status !== "Cancelled") return;
    const nextPermission = !inv.deletePermission;
    try {
      const updated = await updateRow("invoices", inv.id, { deletePermission: nextPermission });
      const row = updated?.id ? updated : { ...inv, deletePermission: nextPermission };
      setInvoices((prev) => prev.map((item) => item.id === inv.id ? row : item));
      ctx.logAudit(nextPermission ? "Invoice delete permission granted" : "Invoice delete permission revoked", `${inv.number} for Sales`);
    } catch (e) {
      alert("Could not update delete permission: " + e.message);
    }
  };

  const isViewer = role === "Viewer";
  const pendingCount = Object.keys(pendingEdits).length;

  return (
    <div>
      <SectionHeader title="Sales & Invoices" subtitle="Quotations → Sales Orders → GST Invoices → Payments" action={!isViewer && <Btn icon={Plus} onClick={() => { setEditing(null); setShowForm(true); }}>New Invoice</Btn>} />
      {pendingCount > 0 && (isApprover || role === "Sales") && (
        <div className="text-xs px-4 py-3 rounded-2xl mb-4 flex items-center gap-2" style={{ background: T.amberWash, color: T.amber, border: "1px solid rgba(176,109,0,0.20)" }}>
          {isApprover ? <><Clock size={16} /><b>{pendingCount} invoice edit request{pendingCount > 1 ? "s" : ""} waiting for approval.</b></> : <><ShieldAlert size={15} /><span>Your invoice edit request is waiting for Owner or Manager approval.</span></>}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 flex-1 min-w-[200px]" style={{ background: T.surface, border: `1px solid ${T.border}` }}><Search size={14} color={T.inkFaint} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice # or customer…" className="outline-none text-sm flex-1" style={{ color: T.ink }} /></div>
        <div className="flex gap-1 flex-wrap">{["All", "Draft", "Sent", "Partially Paid", "Paid", "Overdue", "Cancelled"].map((s) => <button key={s} onClick={() => setFilter(s)} className="px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ background: filter === s ? T.navy : T.surface, color: filter === s ? "#fff" : T.inkSoft, border: `1px solid ${filter === s ? T.navy : T.border}` }}>{s}</button>)}</div>
      </div>
      <Card>
        {filtered.length === 0 ? <EmptyState icon={FileText} title="No invoices found" subtitle="Create your first GST invoice to get started." action={!isViewer && <Btn className="mt-3" icon={Plus} onClick={() => setShowForm(true)}>New Invoice</Btn>} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{["Invoice #", "Date", "Customer", "Amount", "Balance", "Status", ""].map((h) => <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: T.inkFaint }}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((inv) => {
                  const tot = invoiceTotals(inv); const bal = invoiceBalance(inv); const cust = ctx.getCustomer(inv.customerId);
                  const pending = pendingEdits[inv.id];
                  const changes = pending ? invoiceChanges(pending.original, pending.updated, ctx) : [];
                  return (
                    <React.Fragment key={inv.id}><tr className="hover:bg-gray-50 cursor-pointer" style={{ borderBottom: `1px solid ${T.borderSoft}` }} onClick={() => setViewing(inv)}>
                      <td className="px-4 py-2.5 font-medium" style={{ color: T.navy }}>{inv.number}{inv.attachmentUrl && <Paperclip size={11} className="inline ml-1" style={{ color: T.inkFaint }} />}</td>
                      <td className="px-4 py-2.5" style={{ color: T.inkSoft }}>{fmtDate(inv.date)}</td>
                      <td className="px-4 py-2.5" style={{ color: T.ink }}>{cust?.name || "—"}</td>
                      <td className="px-4 py-2.5 font-medium" style={{ color: T.ink }}>{INR(tot.grandTotal)}</td>
                      <td className="px-4 py-2.5" style={{ color: bal > 0 ? T.red : T.inkFaint }}>{bal > 0 ? INR(bal) : "—"}</td>
                      <td className="px-4 py-2.5"><Badge tone={statusTone(inv.status)}>{inv.status}</Badge></td>
                      <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        {!isViewer && (
                          <div className="flex justify-end gap-1">
                            {!pending && <button title={isApprover ? "Edit invoice" : "Request invoice edit"} onClick={() => { setEditing(inv); setShowForm(true); }} className="p-1.5 rounded-md hover:bg-gray-100"><Edit2 size={14} color={T.inkSoft} /></button>}
                            {pending && isApprover && <><AcceptBtn onClick={() => applyApprovedEdit(inv.id)}>Accept</AcceptBtn><RejectBtn onClick={() => rejectEditRequest(inv.id)}>Reject</RejectBtn></>}
                            {pending && !isApprover && <CancelBtn onClick={() => cancelEditRequest(inv.id)} title="Cancel edit request" />}
                            {inv.status !== "Cancelled" && <button title="Cancel invoice" onClick={() => cancelInvoice(inv)} className="p-1.5 rounded-md hover:bg-gray-100"><XCircle size={14} color={T.red} /></button>}
                            {inv.status === "Cancelled" && isApprover && <button title={inv.deletePermission ? "Revoke Sales delete permission" : "Allow Sales to delete"} onClick={() => toggleDeletePermission(inv)} className="p-1.5 rounded-md hover:bg-gray-100"><ShieldCheck size={14} color={inv.deletePermission ? T.emerald : T.inkSoft} /></button>}
                            {inv.status === "Cancelled" && (isOwner || isManager || (role === "Sales" && inv.deletePermission === true)) && <button title="Delete cancelled invoice" onClick={() => deleteInvoice(inv)} className="p-1.5 rounded-md hover:bg-gray-100"><Trash2 size={14} color={T.red} /></button>}
                          </div>
                        )}
                      </td>
                    </tr>{pending && <tr style={{ background: T.amberWash }}><td colSpan="7" className="px-4 py-3" onClick={(e) => e.stopPropagation()}><div className="text-xs font-semibold mb-2" style={{ color: T.amber }}>Edit request by {pending.requestedBy} · {new Date(pending.createdAt).toLocaleString()}</div><div className="grid gap-1">{changes.length ? changes.map((change) => <div key={change.label} className="text-xs" style={{ color: T.ink }}><b>{change.label}:</b> <span style={{ color: T.red }}>{change.before}</span> <span style={{ color: T.inkFaint }}>→</span> <span style={{ color: T.emerald }}>{change.after}</span></div>) : <span className="text-xs" style={{ color: T.inkSoft }}>No field changes detected.</span>}</div></td></tr>}</React.Fragment>
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
