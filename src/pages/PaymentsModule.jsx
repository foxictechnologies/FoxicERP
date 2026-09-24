/**
 * pages/PaymentsModule.jsx
 * -------------------------------------------------------------------------
 * The "Payments" tab — records a receipt against an open invoice and
 * updates that invoice's status/paidAmount to match (Sent/Overdue ->
 * Partially Paid -> Paid, based on whether the new total covers the
 * invoice's grand total). Only shows invoices that still have a balance.
 * -------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { Plus, CreditCard, AlertTriangle } from "lucide-react";
import { T } from "../lib/constants";
import { INR, fmtDate, uid, todayISO } from "../lib/format";
import { Card, Badge, Btn, Field, Input, Select, Modal, EmptyState, SectionHeader } from "../components/ui";
import FileInput from "../components/FileInput";
import AttachmentLink from "../components/AttachmentLink";
import { insertRow, updateRow, uploadAttachment } from "../lib/db";
import { Save } from "lucide-react";

export default function PaymentsModule({ ctx }) {
  const { payments, setPayments, invoices, setInvoices, customers } = ctx;
  const isViewer = ctx.role === "Viewer";
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState(null);
  const openInvoices = invoices.filter((i) => i.status === "Sent" || i.status === "Partially Paid" || i.status === "Overdue");
  const blank = () => ({ id: uid(), date: todayISO(), type: "receipt", refId: openInvoices[0]?.id || "", amount: 0, method: "UPI", notes: "" });
  const [form, setForm] = useState(blank());

  const submit = async () => {
    const inv = invoices.find((i) => i.id === form.refId);
    if (!inv) return;
    const totals = ctx.invoiceTotals(inv);
    const already = inv.status === "Paid" ? totals.grandTotal : (inv.paidAmount || 0);
    const balance = Math.max(0, totals.grandTotal - already);
    const amount = Number(form.amount);
    if (!(amount > 0)) { alert("Enter an amount greater than 0."); return; }
    if (amount > balance) { alert(`Amount exceeds the outstanding balance of ${INR(balance)} for ${inv.number}.`); return; }
    try {
      const newPaid = already + amount;
      const status = newPaid >= totals.grandTotal ? "Paid" : "Partially Paid";
      let attachmentUrl = null;
      if (file) attachmentUrl = await uploadAttachment(file, ctx.company.id);
      const row = await insertRow("payments", { ...form, amount, attachmentUrl, companyId: ctx.company.id, partyId: inv.customerId, refNumber: inv.number, createdBy: ctx.currentUser.id });
      const updatedInv = await updateRow("invoices", inv.id, { status, paidAmount: newPaid });
      setInvoices((prev) => prev.map((i) => i.id === updatedInv.id ? updatedInv : i));
      setPayments((prev) => [row, ...prev]);
      ctx.logAudit("Payment recorded", `${INR(amount)} against ${inv.number} via ${form.method}`);
      setShowForm(false);
    } catch (e) { alert("Could not record payment: " + e.message); }
  };

  return (
    <div>
      <SectionHeader title="Payments" subtitle="Record and track receipts and payments" action={!isViewer && ctx.role !== "Sales" ? <Btn icon={Plus} onClick={() => { setForm(blank()); setShowForm(true); }} disabled={openInvoices.length === 0}>Record Payment</Btn> : null} />
      <Card>
        {payments.length === 0 ? <EmptyState icon={CreditCard} title="No payments recorded" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{["Date", "Type", "Party", "Reference", "Method", "Amount", "Proof"].map((h) => <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: T.inkFaint }}>{h}</th>)}</tr></thead>
              <tbody>{payments.map((p) => { const cust = customers.find((c) => c.id === p.partyId); return (
                <tr key={p.id} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                  <td className="px-4 py-2.5" style={{ color: T.inkSoft }}>{fmtDate(p.date)}</td>
                  <td className="px-4 py-2.5"><Badge tone={p.type === "receipt" ? "green" : "amber"}>{p.type === "receipt" ? "Receipt" : "Payment"}</Badge></td>
                  <td className="px-4 py-2.5">{cust?.name || "—"}</td>
                  <td className="px-4 py-2.5" style={{ color: T.navy }}>{p.refNumber}</td>
                  <td className="px-4 py-2.5" style={{ color: T.inkFaint }}>{p.method}</td>
                  <td className="px-4 py-2.5 font-medium">{INR(p.amount)}</td>
                  <td className="px-4 py-2.5"><AttachmentLink path={p.attachmentUrl} label="Proof" /></td>
                </tr>); })}</tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Record Payment">
        {openInvoices.length === 0 ? <EmptyState icon={AlertTriangle} title="No open invoices to receive payment against" /> : (<>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Invoice" required><Select value={form.refId} onChange={(e) => setForm({ ...form, refId: e.target.value })}>{openInvoices.map((i) => <option key={i.id} value={i.id}>{i.number} — {ctx.getCustomer(i.customerId)?.name}</option>)}</Select></Field>
            <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Amount received" required><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} placeholder="Amount in ₹" /></Field>
            <Field label="Method"><Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>{["Cash", "Bank Transfer", "UPI", "Cheque", "Card", "Other"].map((m) => <option key={m}>{m}</option>)}</Select></Field>
          </div>
          <Field label="Notes"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional reference note" /></Field>
          <FileInput label="Attach payment proof (screenshot, receipt, cheque copy)" fileName={file?.name} onFileSelected={setFile} />
          <div className="flex justify-end gap-2 mt-4"><Btn variant="secondary" onClick={() => setShowForm(false)}>Cancel</Btn><Btn icon={Save} onClick={submit}>Save payment</Btn></div>
        </>)}
      </Modal>
    </div>
  );
}
