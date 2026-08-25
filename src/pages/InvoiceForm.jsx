/**
 * pages/InvoiceForm.jsx
 * -------------------------------------------------------------------------
 * The "New/Edit Sales Invoice" modal, opened from SalesModule.jsx.
 * Handles: line items, the optional due date, the GST calculation
 * override (auto/CGST+SGST/IGST — see lib/taxEngine.js for the actual
 * logic), the optional attachment, and status.
 *
 * On submit, calls the onSave(form, isNew, file) prop passed down from
 * SalesModule — this component doesn't talk to Supabase directly, it just
 * builds the form data. SalesModule owns the actual insert/update call so
 * that stock adjustment + invoice-number increment stay in one place.
 * -------------------------------------------------------------------------
 */

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Save, AlertTriangle } from "lucide-react";
import { T } from "../lib/constants";
import { INR, INR2, uid, todayISO } from "../lib/format";
import { computeInvoiceTotals } from "../lib/taxEngine";
import { Modal, Field, Input, Select, Btn, EmptyState } from "../components/ui";
import FileInput from "../components/FileInput";

export default function InvoiceForm({ open, onClose, onSave, editing, ctx, busy }) {
  const { customers, products, company } = ctx;
  const blank = () => ({ id: uid(), number: `${company.invoicePrefix}${company.nextInvoiceNumber}`, date: todayISO(), dueDate: null, customerId: customers[0]?.id || "", items: [{ productId: products[0]?.id || "", qty: "", rate: products[0]?.sellingPrice || 0, discount: "" }], status: "Draft", paidAmount: 0, attachmentUrl: null, taxType: "auto" });
  const [form, setForm] = useState(blank());
  const [file, setFile] = useState(null);
  const [wantsDueDate, setWantsDueDate] = useState(false);
  useEffect(() => {
    if (open) {
      const initial = editing ? { ...editing } : blank();
      setForm(initial);
      setWantsDueDate(Boolean(initial.dueDate));
      setFile(null);
    }
  }, [open, editing]); // eslint-disable-line
  if (!open) return null;
  const cust = customers.find((c) => c.id === form.customerId);
  const totals = computeInvoiceTotals(form.items, products, company.state, cust?.state, form.taxType);
  const wouldBeInterState = Boolean(company.state && cust?.state && company.state !== cust.state);
  const updateItem = (idx, patch) => setForm((f) => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, ...patch } : it) }));
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { productId: products[0]?.id || "", qty: "", rate: products[0]?.sellingPrice || 0, discount: "" }] }));
  const removeItem = (idx) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const toggleDueDate = (checked) => { setWantsDueDate(checked); setForm((f) => ({ ...f, dueDate: checked ? todayISO() : null })); };
  const submit = () => {
    if (!form.customerId || form.items.length === 0 || products.length === 0) return;
    const validItems = form.items
      .filter((it) => Number(it.qty) > 0)
      .map((it) => ({ ...it, qty: Number(it.qty), rate: Number(it.rate) || 0, discount: String(it.discount ?? "").trim() }));
    if (validItems.length === 0) { alert("Enter a quantity greater than 0 for at least one line item."); return; }
    onSave({ ...form, items: validItems }, !editing, file);
  };

  const canSetPayment = ctx.role !== "Sales";
  const statusOptions = ["Draft", "Sent", "Partially Paid", "Paid", "Overdue", "Cancelled"];
  const allowedStatuses = canSetPayment ? statusOptions : Array.from(new Set(["Draft", "Sent", form.status].filter(Boolean)));
  const paidAmountVisible = canSetPayment && form.status === "Partially Paid";

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${form.number}` : "New Sales Invoice"} width="max-w-3xl">
      {products.length === 0 || customers.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="Add products and a customer first" subtitle="You need at least one product and one customer before creating an invoice." />
      ) : (<>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <Field label="Customer" required><Select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}><option value="">Select customer</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.state})</option>)}</Select></Field>
          <Field label="Invoice date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <div>
            <label className="flex items-center gap-1.5 mb-1 cursor-pointer">
              <input type="checkbox" checked={wantsDueDate} onChange={(e) => toggleDueDate(e.target.checked)} />
              <span className="text-xs font-medium" style={{ color: T.inkSoft }}>Set a due date</span>
            </label>
            {wantsDueDate ? <Input type="date" value={form.dueDate || ""} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /> : <div className="text-xs py-2" style={{ color: T.inkFaint }}>No due date — payable on receipt</div>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <Field label="GST calculation" hint={cust ? (wouldBeInterState ? "Customer's state differs from yours — Auto would use IGST" : "Same state as yours — Auto would use CGST + SGST") : "Select a customer to see the automatic detection"}>
            <Select value={form.taxType} onChange={(e) => setForm({ ...form, taxType: e.target.value })}>
              <option value="auto">Auto — based on customer's state (recommended)</option>
              <option value="cgst_sgst">Force CGST + SGST (intra-state)</option>
              <option value="igst">Force IGST (inter-state)</option>
            </Select>
          </Field>
          {cust && (
            <div className="text-xs px-3 py-2 rounded-lg self-end" style={{ background: totals.interState ? T.amberWash : T.navyWash, color: totals.interState ? T.amber : T.navy }}>
              This invoice will charge <b>{totals.interState ? "IGST" : "CGST + SGST"}</b> · Place of supply: {cust.state}
              {form.taxType !== "auto" && <div className="mt-1">⚠ Manual override — confirm this matches the actual place of supply before filing GST returns.</div>}
            </div>
          )}
        </div>

        <div className="text-xs font-medium mb-2" style={{ color: T.inkSoft }}>Line items</div>
        <div className="space-y-2 mb-2">
          {form.items.map((it, idx) => (
            <div key={idx} className="grid gap-2 items-end" style={{ gridTemplateColumns: "2fr 0.7fr 0.9fr 0.9fr 0.4fr" }}>
              <Select value={it.productId} onChange={(e) => { const p = products.find((pp) => pp.id === e.target.value); updateItem(idx, { productId: e.target.value, rate: p?.sellingPrice || 0 }); }}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
              <Input type="number" min="1" value={it.qty} onChange={(e) => updateItem(idx, { qty: e.target.value })} placeholder="Enter qty" />
              <Input type="number" value={it.rate} onChange={(e) => updateItem(idx, { rate: Number(e.target.value) })} placeholder="Rate (₹)" />
              <Input type="text" value={it.discount} onChange={(e) => updateItem(idx, { discount: e.target.value })} placeholder="Discount (₹ or % e.g. 5%)" />
              <button onClick={() => removeItem(idx)} className="p-2 rounded-lg hover:bg-gray-100 justify-self-center"><Trash2 size={14} color={T.red} /></button>
            </div>
          ))}
        </div>
        <Btn variant="secondary" size="sm" icon={Plus} onClick={addItem} className="mb-4">Add item</Btn>
        <FileInput label="Attach proof of billing (signed copy, e-way bill, etc.)" fileName={file?.name} existingPath={form.attachmentUrl} onFileSelected={setFile} />
        <div className="rounded-lg p-3 mb-4" style={{ background: T.borderSoft }}>
          {totals.discount > 0 && <div className="flex justify-between text-sm py-0.5"><span style={{ color: T.inkSoft }}>Gross</span><span>{INR2(totals.taxable + totals.discount)}</span></div>}
          {totals.discount > 0 && <div className="flex justify-between text-sm py-0.5"><span style={{ color: T.emerald }}>Discount</span><span style={{ color: T.emerald }}>− {INR2(totals.discount)}</span></div>}
          <div className="flex justify-between text-sm py-0.5"><span style={{ color: T.inkSoft }}>Taxable value</span><span>{INR2(totals.taxable)}</span></div>
          {totals.interState ? <div className="flex justify-between text-sm py-0.5"><span style={{ color: T.inkSoft }}>IGST</span><span>{INR2(totals.igst)}</span></div> : (<><div className="flex justify-between text-sm py-0.5"><span style={{ color: T.inkSoft }}>CGST</span><span>{INR2(totals.cgst)}</span></div><div className="flex justify-between text-sm py-0.5"><span style={{ color: T.inkSoft }}>SGST</span><span>{INR2(totals.sgst)}</span></div></>)}
          <div className="flex justify-between text-sm py-0.5"><span style={{ color: T.inkSoft }}>Round off</span><span>{INR2(totals.roundOff)}</span></div>
          <div className="flex justify-between text-base font-semibold pt-1.5 mt-1.5" style={{ borderTop: `1px solid ${T.border}`, color: T.ink }}><span>Grand total</span><span>{INR(totals.grandTotal)}</span></div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Field label="Status"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{allowedStatuses.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          {paidAmountVisible && <Field label="Amount paid so far"><Input type="number" value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: Number(e.target.value) })} placeholder="Amount already received in ₹" /></Field>}
        </div>
        <div className="flex justify-end gap-2"><Btn variant="secondary" onClick={onClose}>Cancel</Btn><Btn icon={Save} onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save invoice"}</Btn></div>
      </>)}
    </Modal>
  );
}
