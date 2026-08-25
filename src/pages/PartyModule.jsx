/**
 * pages/PartyModule.jsx
 * -------------------------------------------------------------------------
 * Powers BOTH the "Customers" and "Vendors" tabs — they're the same page
 * component with a `kind` prop ("customer" | "vendor") that switches which
 * data/table/fields it uses. If you need to change something for customers
 * specifically without affecting vendors (or vice versa), search for
 * `isCust` checks in this file — that's the branch point.
 * -------------------------------------------------------------------------
 */

import React, { useState, useEffect } from "react";
import { Plus, Search, Edit2, Trash2, Users, Truck, History, Save } from "lucide-react";
import { T, INDIAN_STATES } from "../lib/constants";
import { INR, uid } from "../lib/format";
import { Card, Badge, Btn, Field, Input, Select, Modal, EmptyState, SectionHeader } from "../components/ui";
import { insertRow, updateRow, deleteRow } from "../lib/db";
import PartyStatement from "./PartyStatement";

export default function PartyModule({ ctx, kind }) {
  const isCust = kind === "customer";
  const list = isCust ? ctx.customers : ctx.vendors;
  const setList = isCust ? ctx.setCustomers : ctx.setVendors;
  const table = isCust ? "customers" : "vendors";
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [statementFor, setStatementFor] = useState(null);
  const [q, setQ] = useState("");
  useEffect(() => { if (ctx.globalFocus?.tab === table) { setQ(ctx.globalFocus.value); ctx.setGlobalFocus(null); } }, [ctx.globalFocus]); // eslint-disable-line
  const blank = () => ({ id: uid(), name: "", contact: "", phone: "", email: "", gstin: "", state: INDIAN_STATES[0], address: "", pin: "", paymentTerms: "Net 15", creditLimit: 0, bankName: "", bankAccount: "" });
  const [form, setForm] = useState(blank());
  const filtered = list.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  const openNew = () => { setForm(blank()); setEditing(null); setShowForm(true); };
  const openEdit = (c) => { setForm(c); setEditing(c); setShowForm(true); };

  const submit = async () => {
    if (!form.name.trim()) { alert("Name is required."); return; }
    try {
      if (editing) { const row = await updateRow(table, form.id, form); setList((prev) => prev.map((c) => c.id === row.id ? row : c)); ctx.logAudit(`${isCust ? "Customer" : "Vendor"} modified`, form.name); }
      else { const row = await insertRow(table, { ...form, companyId: ctx.company.id }); setList((prev) => [row, ...prev]); ctx.logAudit(`${isCust ? "Customer" : "Vendor"} created`, form.name); }
      setShowForm(false);
    } catch (e) { alert(`Could not save ${isCust ? "customer" : "vendor"}: ` + e.message); }
  };
  const remove = async (id) => {
    const hasTxns = isCust
      ? ctx.invoices.some((i) => i.customerId === id)
      : ctx.purchases.some((p) => p.vendorId === id);
    if (hasTxns) { alert(`This ${isCust ? "customer" : "vendor"} has existing ${isCust ? "invoices" : "purchase bills"} and can't be deleted — past records would break.`); return; }
    if (!confirm(`Delete this ${isCust ? "customer" : "vendor"}?`)) return;
    try {
      const c = list.find((x) => x.id === id);
      await deleteRow(table, id);
      setList((prev) => prev.filter((c) => c.id !== id));
      ctx.logAudit(`${isCust ? "Customer" : "Vendor"} deleted`, c?.name);
    } catch (e) { alert(`Could not delete: ` + e.message); }
  };

  const outstanding = (id) => isCust ? ctx.customerOutstanding(id) : ctx.vendorOutstanding(id);
  const totalTxn = (id) => isCust
    ? ctx.invoices.filter((i) => i.customerId === id && i.status !== "Draft" && i.status !== "Cancelled").reduce((s, i) => s + ctx.invoiceTotals(i).grandTotal, 0)
    : ctx.purchases.filter((p) => p.vendorId === id).reduce((s, p) => s + ctx.purchaseTotal(p), 0);

  return (
    <div>
      <SectionHeader title={isCust ? "Customers" : "Vendors"} subtitle={isCust ? "Customer relationships, credit and ledgers" : "Vendor relationships, purchases and payables"} action={<Btn icon={Plus} onClick={openNew}>New {isCust ? "Customer" : "Vendor"}</Btn>} />
      <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-4 max-w-sm" style={{ background: T.surface, border: `1px solid ${T.border}` }}><Search size={14} color={T.inkFaint} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${isCust ? "customers" : "vendors"}…`} className="outline-none text-sm flex-1" /></div>
      {filtered.length === 0 ? <Card><EmptyState icon={isCust ? Users : Truck} title={`No ${isCust ? "customers" : "vendors"} yet`} /></Card> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex justify-between items-start">
                <div><div className="font-semibold text-sm" style={{ color: T.ink }}>{c.name}</div><div className="text-xs mt-0.5" style={{ color: T.inkFaint }}>{c.contact} · {c.state}</div></div>
                <div className="flex gap-1"><button onClick={() => setStatementFor(c)} title="Statement" className="p-1.5 rounded-md hover:bg-gray-100"><History size={13} color={T.inkSoft} /></button><button onClick={() => openEdit(c)} className="p-1.5 rounded-md hover:bg-gray-100"><Edit2 size={13} color={T.inkSoft} /></button><button onClick={() => remove(c.id)} className="p-1.5 rounded-md hover:bg-gray-100"><Trash2 size={13} color={T.red} /></button></div>
              </div>
              <div className="text-xs mt-2" style={{ color: T.inkFaint }}>{c.phone} · {c.email}</div>
              <div className="text-xs mt-1" style={{ color: T.inkFaint }}>GSTIN: {c.gstin || "—"}</div>
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
                <div><div className="text-[11px]" style={{ color: T.inkFaint }}>Total {isCust ? "purchased" : "supplied"}</div><div className="text-sm font-semibold" style={{ color: T.ink }}>{INR(totalTxn(c.id))}</div></div>
                <div><div className="text-[11px]" style={{ color: T.inkFaint }}>Outstanding</div><div className="text-sm font-semibold" style={{ color: outstanding(c.id) > 0 ? T.red : T.emerald }}>{INR(outstanding(c.id))}</div></div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? `Edit ${isCust ? "customer" : "vendor"}` : `New ${isCust ? "customer" : "vendor"}`}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={isCust ? "e.g. Nimbus Retail Pvt Ltd" : "e.g. Prime Electronics Distributors"} /></Field>
          <Field label="Contact person"><Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="Full name" /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 XXXXX XXXXX" /></Field>
          <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@company.in" /></Field>
          <Field label="GSTIN"><Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} placeholder="15-digit GSTIN (leave blank if unregistered)" /></Field>
          <Field label="State"><Select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>{INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Address"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, area, city" /></Field>
          {isCust && <Field label="PIN code"><Input value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} placeholder="6-digit PIN" /></Field>}
          <Field label="Payment terms"><Input value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} placeholder="e.g. Net 15, Net 30" /></Field>
          {isCust ? <Field label="Credit limit"><Input type="number" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: Number(e.target.value) })} placeholder="Maximum credit in ₹" /></Field> : (<>
            <Field label="Bank name"><Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="e.g. HDFC Bank" /></Field>
            <Field label="Bank account"><Input value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} placeholder="Account number" /></Field>
          </>)}
        </div>
        <div className="flex justify-end gap-2 mt-4"><Btn variant="secondary" onClick={() => setShowForm(false)}>Cancel</Btn><Btn icon={Save} onClick={submit}>Save</Btn></div>
      </Modal>
      <PartyStatement party={statementFor} isCust={isCust} ctx={ctx} onClose={() => setStatementFor(null)} />
    </div>
  );
}
