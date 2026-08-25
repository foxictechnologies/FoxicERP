/**
 * pages/ExpensesModule.jsx
 * -------------------------------------------------------------------------
 * The "Expenses" tab — simple CRUD list of business expenses by category,
 * with an optional receipt/bill attachment. EXPENSE_CATEGORIES (the
 * dropdown list) lives in lib/constants.js if you need to add a category.
 * -------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { Plus, Trash2, Receipt, Save } from "lucide-react";
import { T, EXPENSE_CATEGORIES } from "../lib/constants";
import { INR, fmtDate, uid, todayISO } from "../lib/format";
import { Card, Badge, Btn, Field, Input, Select, Modal, EmptyState, SectionHeader } from "../components/ui";
import FileInput from "../components/FileInput";
import AttachmentLink from "../components/AttachmentLink";
import { insertRow, deleteRow, uploadAttachment } from "../lib/db";

export default function ExpensesModule({ ctx }) {
  const { expenses, setExpenses } = ctx;
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState(null);
  const blank = () => ({ id: uid(), date: todayISO(), category: EXPENSE_CATEGORIES[0], amount: 0, vendor: "", method: "Cash", description: "" });
  const [form, setForm] = useState(blank());
  const submit = async () => {
    if (!(Number(form.amount) > 0)) { alert("Enter an amount greater than 0."); return; }
    try {
      let attachmentUrl = null;
      if (file) attachmentUrl = await uploadAttachment(file, ctx.company.id);
      const row = await insertRow("expenses", { ...form, amount: Number(form.amount), attachmentUrl, companyId: ctx.company.id, createdBy: ctx.currentUser.id });
      setExpenses((prev) => [row, ...prev]);
      ctx.logAudit("Expense created", `${form.category} — ${INR(form.amount)}`);
      setShowForm(false);
    } catch (e) { alert("Could not save expense: " + e.message); }
  };
  const remove = async (id) => {
    if (!confirm("Delete this expense?")) return;
    try {
      const e = expenses.find((x) => x.id === id);
      await deleteRow("expenses", id);
      setExpenses((prev) => prev.filter((x) => x.id !== id));
      ctx.logAudit("Expense deleted", e ? `${e.category} — ${INR(e.amount)}` : id);
    } catch (err) { alert("Could not delete expense: " + err.message); }
  };
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <SectionHeader title="Expenses" subtitle={`Total recorded: ${INR(total)}`} action={<Btn icon={Plus} onClick={() => { setForm(blank()); setShowForm(true); }}>New Expense</Btn>} />
      <Card>
        {expenses.length === 0 ? <EmptyState icon={Receipt} title="No expenses recorded" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{["Date", "Category", "Description", "Vendor", "Method", "Amount", "Proof", ""].map((h) => <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: T.inkFaint }}>{h}</th>)}</tr></thead>
              <tbody>{expenses.map((e) => (
                <tr key={e.id} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                  <td className="px-4 py-2.5" style={{ color: T.inkSoft }}>{fmtDate(e.date)}</td>
                  <td className="px-4 py-2.5"><Badge tone="navy">{e.category}</Badge></td>
                  <td className="px-4 py-2.5" style={{ color: T.inkFaint }}>{e.description}</td>
                  <td className="px-4 py-2.5">{e.vendor}</td>
                  <td className="px-4 py-2.5" style={{ color: T.inkFaint }}>{e.method}</td>
                  <td className="px-4 py-2.5 font-medium">{INR(e.amount)}</td>
                  <td className="px-4 py-2.5"><AttachmentLink path={e.attachmentUrl} label="Proof" /></td>
                  <td className="px-4 py-2.5 text-right"><button onClick={() => remove(e.id)} className="p-1.5 rounded-md hover:bg-gray-100"><Trash2 size={14} color={T.red} /></button></td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Expense">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category"><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Amount" required><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} placeholder="Amount in ₹" /></Field>
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Payment method"><Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>{["Cash", "Bank Transfer", "UPI", "Cheque", "Card"].map((m) => <option key={m}>{m}</option>)}</Select></Field>
          <Field label="Vendor / paid to"><Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Who was paid" /></Field>
        </div>
        <Field label="Description"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What was this expense for" /></Field>
        <FileInput label="Attach receipt / bill" fileName={file?.name} onFileSelected={setFile} />
        <div className="flex justify-end gap-2 mt-4"><Btn variant="secondary" onClick={() => setShowForm(false)}>Cancel</Btn><Btn icon={Save} onClick={submit}>Save expense</Btn></div>
      </Modal>
    </div>
  );
}
