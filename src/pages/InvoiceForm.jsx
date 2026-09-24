/**
 * pages/InvoiceForm.jsx
 * -------------------------------------------------------------------------
 * The "New/Edit Sales Invoice" modal, opened from SalesModule.jsx.
 * Handles: line items, item-level GST selection, optional due date,
 * tax calculation mode overrides, optional attachment, and status.
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
  const blank = () => {
    const defaultProd = products[0];
    return {
      id: uid(),
      number: `${company.invoicePrefix}${company.nextInvoiceNumber}`,
      date: todayISO(),
      dueDate: null,
      customerId: customers[0]?.id || "",
      items: [{
        productId: defaultProd?.id || "",
        qty: "",
        rate: defaultProd?.sellingPrice || 0,
        discount: "",
        gstRate: defaultProd?.gstRate ?? 18
      }],
      status: "Draft",
      paidAmount: 0,
      attachmentUrl: null,
      taxType: "auto"
    };
  };

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
  const totalGstAmount = totals.igst + totals.cgst + totals.sgst;
  const wouldBeInterState = Boolean(company.state && cust?.state && company.state !== cust.state);

  const updateItem = (idx, patch) => setForm((f) => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, ...patch } : it) }));
  const addItem = () => {
    const defaultProd = products[0];
    setForm((f) => ({
      ...f,
      items: [...f.items, {
        productId: defaultProd?.id || "",
        qty: "",
        rate: defaultProd?.sellingPrice || 0,
        discount: "",
        gstRate: defaultProd?.gstRate ?? 18
      }]
    }));
  };
  const removeItem = (idx) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const toggleDueDate = (checked) => { setWantsDueDate(checked); setForm((f) => ({ ...f, dueDate: checked ? todayISO() : null })); };

  const submit = () => {
    if (!form.customerId || form.items.length === 0 || products.length === 0) return;
    const validItems = form.items
      .filter((it) => Number(it.qty) > 0)
      .map((it) => ({
        ...it,
        qty: Number(it.qty),
        rate: Number(it.rate) || 0,
        discount: String(it.discount ?? "").trim(),
        gstRate: it.gstRate !== undefined ? Number(it.gstRate) : 18
      }));
    if (validItems.length === 0) { alert("Enter a quantity greater than 0 for at least one line item."); return; }
    onSave({ ...form, items: validItems }, !editing, file);
  };

  const statusOptions = ["Draft", "Sent", "Partially Paid", "Paid", "Overdue", "Cancelled"];
  const paidAmountVisible = form.status === "Partially Paid";

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
          <Field label="GST calculation" hint={cust ? (wouldBeInterState ? "Customer's state differs from yours — Auto applies inter-state GST" : "Same state as yours — Auto applies intra-state GST") : "Select a customer to see state detection"}>
            <Select value={form.taxType} onChange={(e) => setForm({ ...form, taxType: e.target.value })}>
              <option value="auto">Auto — based on customer's state (recommended)</option>
              <option value="cgst_sgst">Force Intra-state GST</option>
              <option value="igst">Force Inter-state GST</option>
            </Select>
          </Field>
          {cust && (
            <div className="text-xs px-3 py-2 rounded-lg self-end" style={{ background: totals.interState ? T.amberWash : T.navyWash, color: totals.interState ? T.amber : T.navy }}>
              This invoice will charge <b>GST</b> · Place of supply: {cust.state}
              {form.taxType !== "auto" && <div className="mt-1">⚠ Manual override active</div>}
            </div>
          )}
        </div>

        <div className="text-xs font-medium mb-2 flex justify-between items-center" style={{ color: T.inkSoft }}>
          <span>Line items</span>
          <span className="text-[11px] text-gray-500 font-normal">Set Qty, Rate, Discount & GST % per item</span>
        </div>
        <div className="space-y-2 mb-2">
          {form.items.map((it, idx) => {
            const prod = products.find((pp) => pp.id === it.productId);
            const currentGst = it.gstRate !== undefined ? it.gstRate : (prod?.gstRate || 0);
            const rateOptions = Array.from(new Set([0, 5, 12, 18, 28, Number(currentGst)].filter((v) => !isNaN(v) && v !== null))).sort((a, b) => a - b);
            return (
              <div key={idx} className="grid gap-2 items-center" style={{ gridTemplateColumns: "1.8fr 0.7fr 0.8fr 0.8fr 0.9fr 0.4fr" }}>
                <Select value={it.productId} onChange={(e) => { const p = products.find((pp) => pp.id === e.target.value); updateItem(idx, { productId: e.target.value, rate: p?.sellingPrice || 0, gstRate: p?.gstRate ?? 18 }); }}>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
                <Input type="number" min="1" value={it.qty} onChange={(e) => updateItem(idx, { qty: e.target.value })} placeholder="Qty" />
                <Input type="number" value={it.rate} onChange={(e) => updateItem(idx, { rate: Number(e.target.value) })} placeholder="Rate (₹)" />
                <Input type="text" value={it.discount} onChange={(e) => updateItem(idx, { discount: e.target.value })} placeholder="Disc (₹ or %)" />
                <Select value={currentGst} onChange={(e) => updateItem(idx, { gstRate: Number(e.target.value) })}>
                  {rateOptions.map((r) => <option key={r} value={r}>{r}% GST</option>)}
                </Select>
                <button onClick={() => removeItem(idx)} className="p-2 rounded-lg hover:bg-gray-100 justify-self-center"><Trash2 size={14} color={T.red} /></button>
              </div>
            );
          })}
        </div>
        <Btn variant="secondary" size="sm" icon={Plus} onClick={addItem} className="mb-4">Add item</Btn>
        <FileInput label="Attach proof of billing (signed copy, e-way bill, etc.)" fileName={file?.name} existingPath={form.attachmentUrl} onFileSelected={setFile} />
        <div className="rounded-lg p-3 mb-4" style={{ background: T.borderSoft }}>
          {totals.discount > 0 && <div className="flex justify-between text-sm py-0.5"><span style={{ color: T.inkSoft }}>Gross</span><span>{INR2(totals.taxable + totals.discount)}</span></div>}
          {totals.discount > 0 && <div className="flex justify-between text-sm py-0.5"><span style={{ color: T.emerald }}>Discount</span><span style={{ color: T.emerald }}>− {INR2(totals.discount)}</span></div>}
          <div className="flex justify-between text-sm py-0.5"><span style={{ color: T.inkSoft }}>Taxable value</span><span>{INR2(totals.taxable)}</span></div>
          <div className="flex justify-between text-sm py-0.5"><span style={{ color: T.inkSoft }}>GST</span><span>{INR2(totalGstAmount)}</span></div>
          <div className="flex justify-between text-sm py-0.5"><span style={{ color: T.inkSoft }}>Round off</span><span>{INR2(totals.roundOff)}</span></div>
          <div className="flex justify-between text-base font-semibold pt-1.5 mt-1.5" style={{ borderTop: `1px solid ${T.border}`, color: T.ink }}><span>Grand total</span><span>{INR(totals.grandTotal)}</span></div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Field label="Status"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{statusOptions.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          {paidAmountVisible && <Field label="Amount paid so far"><Input type="number" value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: Number(e.target.value) })} placeholder="Amount already received in ₹" /></Field>}
        </div>
        <div className="flex justify-end gap-2"><Btn variant="secondary" onClick={onClose}>Cancel</Btn><Btn icon={Save} onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save invoice"}</Btn></div>
      </>)}
    </Modal>
  );
}
