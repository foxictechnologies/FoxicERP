/**
 * pages/ExpensesModule.jsx
 * -------------------------------------------------------------------------
 * The "Expenses" tab — CRUD list of business expenses by category.
 *  - Owner can edit any expense directly.
 *  - Manager can request an expense edit (requires Owner approval).
 *  - Only Owner can delete an expense.
 * -------------------------------------------------------------------------
 */

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Receipt, Save, Edit2, Clock, ShieldAlert, CheckCircle2 } from "lucide-react";
import { T, EXPENSE_CATEGORIES } from "../lib/constants";
import { INR, fmtDate, uid, todayISO } from "../lib/format";
import { Card, Badge, Btn, Field, Input, Select, Modal, EmptyState, SectionHeader, AcceptBtn, CancelBtn } from "../components/ui";
import FileInput from "../components/FileInput";
import AttachmentLink from "../components/AttachmentLink";
import { insertRow, updateRow, deleteRow, uploadAttachment } from "../lib/db";

const PENDING_EXPENSE_EDITS_KEY = (companyId) => `erp_pending_expense_edits_${companyId || "default"}`;

const getPendingExpenseEdits = (companyId) => {
  try {
    const raw = localStorage.getItem(PENDING_EXPENSE_EDITS_KEY(companyId));
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

const savePendingExpenseEdits = (companyId, obj) => {
  try {
    localStorage.setItem(PENDING_EXPENSE_EDITS_KEY(companyId), JSON.stringify(obj));
  } catch (e) {}
};

export default function ExpensesModule({ ctx }) {
  const { expenses, setExpenses, company, currentUser } = ctx;
  const role = ctx.role || currentUser?.role;
  const isViewer = role === "Viewer";
  const isOwner = role === "Owner";
  const isManager = role === "Manager";
  const canEdit = isOwner || isManager;

  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [file, setFile] = useState(null);
  const [pendingEdits, setPendingEdits] = useState({});

  const blank = () => ({
    id: uid(),
    date: todayISO(),
    category: EXPENSE_CATEGORIES[0],
    amount: 0,
    vendor: "",
    method: "Cash",
    description: "",
    attachmentUrl: null
  });
  const [form, setForm] = useState(blank());

  useEffect(() => {
    if (company?.id) {
      setPendingEdits(getPendingExpenseEdits(company.id));
    }
  }, [company?.id]);

  const openNewForm = () => {
    setEditingExpense(null);
    setForm(blank());
    setFile(null);
    setShowForm(true);
  };

  const openEditForm = (exp) => {
    if (!canEdit) {
      alert("Only Business Owner and Operations Manager can edit expenses.");
      return;
    }
    const pending = pendingEdits[exp.id];
    const targetData = pending ? pending.updated : exp;
    setEditingExpense(exp);
    setForm({ ...targetData });
    setFile(null);
    setShowForm(true);
  };

  const submit = async () => {
    if (!(Number(form.amount) > 0)) {
      alert("Enter an amount greater than 0.");
      return;
    }

    try {
      let attachmentUrl = form.attachmentUrl || null;
      if (file) {
        try {
          attachmentUrl = await uploadAttachment(file, company?.id);
        } catch (e) {
          console.warn(e);
        }
      }

      const payload = {
        ...form,
        amount: Number(form.amount),
        attachmentUrl,
        companyId: company?.id || "test-company-id",
        updatedAt: new Date().toISOString()
      };

      if (editingExpense) {
        if (isOwner) {
          // Owner updates expense directly
          let updatedRow = payload;
          try {
            const res = await updateRow("expenses", editingExpense.id, payload);
            if (res?.id) updatedRow = res;
          } catch (err) {
            console.warn("Supabase updateRow failed, updating locally:", err);
          }
          setExpenses((prev) => prev.map((e) => (e.id === editingExpense.id ? updatedRow : e)));

          // Clear any pending edit request for this expense
          const updatedPending = { ...pendingEdits };
          delete updatedPending[editingExpense.id];
          savePendingExpenseEdits(company.id, updatedPending);
          setPendingEdits(updatedPending);

          ctx.logAudit("Expense updated", `${form.category} — ${INR(form.amount)}`);
          alert("Expense updated successfully!");
        } else if (isManager) {
          // Manager submits edit request to Owner for approval
          const pendingItem = {
            expenseId: editingExpense.id,
            original: editingExpense,
            updated: payload,
            requestedBy: currentUser?.name || "Manager",
            requestedById: currentUser?.id,
            createdAt: new Date().toISOString()
          };

          const updatedPending = {
            ...pendingEdits,
            [editingExpense.id]: pendingItem
          };
          savePendingExpenseEdits(company.id, updatedPending);
          setPendingEdits(updatedPending);

          ctx.logAudit("Expense edit requested", `${form.category} — ${INR(form.amount)} by ${currentUser?.name || "Manager"}`);
          alert("Expense edit request submitted to Owner for approval! Changes will take effect once approved by the Owner.");
        }
      } else {
        // Create New Expense
        let row = { ...payload, createdBy: currentUser?.id || "test-user-id" };
        try {
          const inserted = await insertRow("expenses", row);
          if (inserted?.id) row = inserted;
        } catch (err) {
          console.warn("Supabase insertRow failed, saving locally:", err);
        }
        setExpenses((prev) => [row, ...prev]);
        ctx.logAudit("Expense created", `${form.category} — ${INR(form.amount)}`);
      }

      setShowForm(false);
      setEditingExpense(null);
    } catch (e) {
      alert("Could not save expense: " + e.message);
    }
  };

  const approveEditRequest = async (expenseId) => {
    if (!isOwner) return;
    const pending = pendingEdits[expenseId];
    if (!pending) return;

    try {
      const payload = pending.updated;
      let updatedRow = payload;
      try {
        const res = await updateRow("expenses", expenseId, payload);
        if (res?.id) updatedRow = res;
      } catch (err) {
        console.warn("Supabase updateRow fallback:", err);
      }

      setExpenses((prev) => prev.map((e) => (e.id === expenseId ? updatedRow : e)));

      const updatedPending = { ...pendingEdits };
      delete updatedPending[expenseId];
      savePendingExpenseEdits(company.id, updatedPending);
      setPendingEdits(updatedPending);

      ctx.logAudit("Expense edit approved", `Approved edit by ${pending.requestedBy} for ${payload.category} (${INR(payload.amount)})`);
      alert(`Approved expense edit request by ${pending.requestedBy}.`);
    } catch (e) {
      alert("Could not approve expense edit: " + e.message);
    }
  };

  const rejectEditRequest = (expenseId) => {
    if (!isOwner) return;
    const pending = pendingEdits[expenseId];
    if (!pending) return;

    const updatedPending = { ...pendingEdits };
    delete updatedPending[expenseId];
    savePendingExpenseEdits(company.id, updatedPending);
    setPendingEdits(updatedPending);

    ctx.logAudit("Expense edit rejected", `Rejected edit request by ${pending.requestedBy}`);
    alert(`Rejected expense edit request by ${pending.requestedBy}.`);
  };

  const cancelEditRequest = (expenseId) => {
    const pending = pendingEdits[expenseId];
    if (!pending) return;

    const updatedPending = { ...pendingEdits };
    delete updatedPending[expenseId];
    savePendingExpenseEdits(company.id, updatedPending);
    setPendingEdits(updatedPending);

    ctx.logAudit("Expense edit request cancelled", `Cancelled edit request for ${pending.updated.category}`);
    alert(`Expense edit request for ${pending.updated.category} cancelled.`);
  };

  const remove = async (id) => {
    if (!isOwner) {
      alert("Only Business Owner can delete expenses.");
      return;
    }
    if (!confirm("Delete this expense?")) return;
    try {
      const e = expenses.find((x) => x.id === id);
      await deleteRow("expenses", id);
      setExpenses((prev) => prev.filter((x) => x.id !== id));

      const updatedPending = { ...pendingEdits };
      delete updatedPending[id];
      savePendingExpenseEdits(company.id, updatedPending);
      setPendingEdits(updatedPending);

      ctx.logAudit("Expense deleted", e ? `${e.category} — ${INR(e.amount)}` : id);
    } catch (err) {
      alert("Could not delete expense: " + err.message);
    }
  };

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const pendingCount = Object.keys(pendingEdits).length;

  return (
    <div>
      <SectionHeader
        title="Expenses"
        subtitle={`Total recorded: ${INR(total)}`}
        action={!isViewer ? <Btn icon={Plus} onClick={openNewForm}>New Expense</Btn> : null}
      />

      {/* Owner Pending Edit Approvals Banner */}
      {isOwner && pendingCount > 0 && (
        <div className="text-xs px-4 py-3 rounded-2xl mb-4 flex items-center justify-between gap-3 shadow-sm animate-pulse" style={{ background: T.amberWash, color: T.amber, border: "1px solid rgba(176,109,0,0.20)" }}>
          <div className="flex items-center gap-2 font-medium">
            <Clock size={16} />
            <span><b>{pendingCount} Pending Expense Edit Request{pendingCount > 1 ? "s" : ""}</b> waiting for your approval.</span>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider bg-amber-500/10 px-2 py-1 rounded-md">Owner Action Required</span>
        </div>
      )}

      {/* Manager Hint Banner */}
      {isManager && (
        <div className="text-xs px-3.5 py-2.5 rounded-xl mb-4 flex items-center gap-2" style={{ background: T.navyWash, color: T.navy, border: "1px solid rgba(0,113,227,0.15)" }}>
          <ShieldAlert size={14} />
          <span>Aap expenses edit kar sakte hain. Aapka edit request Owner ke paas approval ke liye jayega aur confirmation ke baad active hoga.</span>
        </div>
      )}

      <Card>
        {expenses.length === 0 ? (
          <EmptyState icon={Receipt} title="No expenses recorded" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {["Date", "Category", "Description", "Vendor", "Method", "Amount", "Proof", canEdit ? "Actions" : null].filter(Boolean).map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: T.inkFaint }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => {
                  const pending = pendingEdits[e.id];

                  return (
                    <tr key={e.id} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                      <td className="px-4 py-2.5" style={{ color: T.inkSoft }}>
                        {fmtDate(pending ? pending.updated.date : e.date)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col gap-1 items-start">
                          <Badge tone="navy">{pending ? pending.updated.category : e.category}</Badge>
                          {pending && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                              Edit Req by {pending.requestedBy}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5" style={{ color: T.inkFaint }}>
                        {pending ? pending.updated.description : e.description}
                      </td>
                      <td className="px-4 py-2.5">{pending ? pending.updated.vendor : e.vendor}</td>
                      <td className="px-4 py-2.5" style={{ color: T.inkFaint }}>
                        {pending ? pending.updated.method : e.method}
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        {pending ? (
                          <div className="flex flex-col">
                            <span className="text-amber-700 font-bold">{INR(pending.updated.amount)}</span>
                            <span className="text-[10px] text-gray-400 line-through">{INR(e.amount)}</span>
                          </div>
                        ) : (
                          INR(e.amount)
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <AttachmentLink path={pending ? pending.updated.attachmentUrl : e.attachmentUrl} label="Proof" />
                      </td>

                      {/* Action Buttons */}
                      {canEdit && (
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex justify-end gap-1.5 items-center flex-wrap">
                            {pending ? (
                              <div className="flex items-center gap-1.5 justify-end">
                                {isOwner && (
                                  <AcceptBtn onClick={() => approveEditRequest(e.id)}>
                                    Approve
                                  </AcceptBtn>
                                )}
                                {!isOwner && (
                                  <span className="text-xs text-amber-600 font-medium italic">Awaiting Owner Approval</span>
                                )}
                                <CancelBtn onClick={() => cancelEditRequest(e.id)} title="Cancel Edit Request">
                                  Cancel Request
                                </CancelBtn>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => openEditForm(e)}
                                  title={isManager ? "Request Edit (Owner Approval Required)" : "Edit Expense"}
                                  className="p-1.5 rounded-md hover:bg-gray-100"
                                >
                                  <Edit2 size={14} color={T.inkSoft} />
                                </button>
                                {isOwner && (
                                  <button
                                    onClick={() => remove(e.id)}
                                    title="Delete expense (Owner only)"
                                    className="p-1.5 rounded-md hover:bg-gray-100"
                                  >
                                    <Trash2 size={14} color={T.red} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add / Edit Expense Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingExpense ? (isOwner ? "Edit Expense" : "Request Expense Edit") : "New Expense"}>
        {isManager && editingExpense && (
          <div className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: T.navyWash, color: T.navy }}>
            Manager expense edits will be submitted as a request to the Owner for approval.
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Amount" required>
            <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} placeholder="Amount in ₹" />
          </Field>
          <Field label="Date">
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Payment method">
            <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              {["Cash", "Bank Transfer", "UPI", "Cheque", "Card"].map((m) => <option key={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Vendor / paid to">
            <Input value={form.vendor || ""} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Who was paid" />
          </Field>
        </div>
        <Field label="Description">
          <Input value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What was this expense for" />
        </Field>
        <FileInput label="Attach receipt / bill" fileName={file?.name || (form.attachmentUrl ? "Current Receipt Attached" : null)} onFileSelected={setFile} />
        <div className="flex justify-end gap-2 mt-4">
          <Btn variant="secondary" onClick={() => setShowForm(false)}>Cancel</Btn>
          <Btn icon={Save} onClick={submit}>
            {editingExpense ? (isOwner ? "Save Changes" : "Submit Edit Request to Owner") : "Save Expense"}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
