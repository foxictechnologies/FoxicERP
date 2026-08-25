/**
 * pages/PurchasesModule.jsx
 * -------------------------------------------------------------------------
 * The "Purchases" tab — purchase bills from vendors. Similar shape to
 * SalesModule.jsx but simpler (no separate view modal — the form doubles
 * as create-only here). Creating a purchase increases stock via
 * ctx.adjustStock(), which also writes a stock_ledger row.
 * -------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { Plus, ShoppingCart, AlertTriangle, Paperclip, Save } from "lucide-react";
import { T } from "../lib/constants";
import { INR, INR2, fmtDate, uid, todayISO } from "../lib/format";
import { Card, Badge, Btn, Field, Input, Select, Modal, EmptyState, SectionHeader, statusTone } from "../components/ui";
import FileInput from "../components/FileInput";
import AttachmentLink from "../components/AttachmentLink";
import { insertRow, updateRow, uploadAttachment } from "../lib/db";

export default function PurchasesModule({ ctx }) {
  const { purchases, setPurchases, vendors, products, adjustStock, purchaseTotal, company, setCompany } = ctx;
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState(null);
  const blank = () => ({ id: uid(), number: `${company.purchasePrefix}${company.nextPurchaseNumber}`, date: todayISO(), vendorId: vendors[0]?.id || "", items: [{ productId: products[0]?.id || "", qty: 1, rate: products[0]?.purchasePrice || 0 }], status: "Pending", attachmentUrl: null });
  const [form, setForm] = useState(blank());
  const openForm = () => { setForm(blank()); setFile(null); setShowForm(true); };
  const updateItem = (idx, patch) => setForm((f) => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, ...patch } : it) }));
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { productId: products[0]?.id || "", qty: 1, rate: products[0]?.purchasePrice || 0 }] }));

  const submit = async () => {
    if (vendors.length === 0 || products.length === 0) return;
    try {
      let attachmentUrl = null;
      if (file) attachmentUrl = await uploadAttachment(file, company.id);
      const row = await insertRow("purchases", { ...form, attachmentUrl, companyId: company.id, createdBy: ctx.currentUser.id });
      setPurchases((prev) => [row, ...prev]);
      for (const it of form.items) await adjustStock(it.productId, Number(it.qty), "Purchase", row.id);
      const updatedCompany = await updateRow("companies", company.id, { nextPurchaseNumber: company.nextPurchaseNumber + 1 });
      setCompany(updatedCompany);
      ctx.logAudit("Purchase bill created", `${row.number} from ${ctx.getVendor(row.vendorId)?.name}`);
      setShowForm(false);
    } catch (e) {
      if (e.code === "23505" || /duplicate key/i.test(e.message || "")) alert("A purchase with this number already exists. Bump 'Next purchase #' in Settings and retry.");
      else alert("Could not save purchase: " + e.message);
    }
  };
  const markPaid = async (pur) => {
    try {
      const row = await updateRow("purchases", pur.id, { status: "Paid" });
      setPurchases((prev) => prev.map((p) => p.id === row.id ? row : p));
      ctx.logAudit("Purchase marked paid", row.number);
    } catch (e) { alert("Could not mark as paid: " + e.message); }
  };

  return (
    <div>
      <SectionHeader title="Purchases" subtitle="Purchase orders, goods received and vendor bills" action={<Btn icon={Plus} onClick={openForm}>New Purchase</Btn>} />
      <Card>
        {purchases.length === 0 ? <EmptyState icon={ShoppingCart} title="No purchases recorded" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{["Purchase #", "Date", "Vendor", "Items", "Amount", "Status", ""].map((h) => <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: T.inkFaint }}>{h}</th>)}</tr></thead>
              <tbody>{purchases.map((p) => { const vendor = ctx.getVendor(p.vendorId); return (
                <tr key={p.id} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: T.navy }}>{p.number}{p.attachmentUrl && <Paperclip size={11} className="inline ml-1" style={{ color: T.inkFaint }} />}</td>
                  <td className="px-4 py-2.5" style={{ color: T.inkSoft }}>{fmtDate(p.date)}</td>
                  <td className="px-4 py-2.5">{vendor?.name}</td>
                  <td className="px-4 py-2.5 text-xs max-w-[240px] truncate" style={{ color: T.inkSoft }} title={p.items.map((it) => `${ctx.getProduct(it.productId)?.name || "Unknown"} × ${it.qty}`).join("\n")}>{p.items.map((it) => `${ctx.getProduct(it.productId)?.name || "Unknown"} × ${it.qty}`).join(", ")}</td>
                  <td className="px-4 py-2.5 font-medium">{INR(purchaseTotal(p))}</td>
                  <td className="px-4 py-2.5"><Badge tone={statusTone(p.status)}>{p.status}</Badge></td>
                  <td className="px-4 py-2.5 text-right"><div className="flex justify-end gap-2 items-center"><AttachmentLink path={p.attachmentUrl} label="Proof" />{p.status !== "Paid" && <Btn size="sm" variant="secondary" onClick={() => markPaid(p)}>Mark Paid</Btn>}</div></td>
                </tr>); })}</tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Purchase Bill" width="max-w-2xl">
        {vendors.length === 0 || products.length === 0 ? <EmptyState icon={AlertTriangle} title="Add a vendor and a product first" /> : (<>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Field label="Vendor"><Select value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })}>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></Field>
            <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          </div>
          <div className="text-xs font-medium mb-2" style={{ color: T.inkSoft }}>Items</div>
          <div className="space-y-2 mb-2">{form.items.map((it, idx) => (
            <div key={idx} className="grid gap-2" style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
              <Select value={it.productId} onChange={(e) => { const p = products.find((pp) => pp.id === e.target.value); updateItem(idx, { productId: e.target.value, rate: p?.purchasePrice || 0 }); }}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
              <Input type="number" value={it.qty} onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })} placeholder="Qty" />
              <Input type="number" value={it.rate} onChange={(e) => updateItem(idx, { rate: Number(e.target.value) })} placeholder="Rate (₹)" />
            </div>))}</div>
          <Btn variant="secondary" size="sm" icon={Plus} onClick={addItem} className="mb-4">Add item</Btn>
          <div className="rounded-lg p-3 mb-4" style={{ background: T.borderSoft }}>
            {(() => {
              let taxable = 0, gst = 0;
              form.items.forEach((it) => {
                const prod = products.find((pp) => pp.id === it.productId);
                const gross = (Number(it.qty) || 0) * (Number(it.rate) || 0);
                taxable += gross;
                if (prod) gst += (gross * (prod.gstRate || 0)) / 100;
              });
              return (<>
                <div className="flex justify-between text-sm py-0.5"><span style={{ color: T.inkSoft }}>Taxable value</span><span>{INR2(taxable)}</span></div>
                <div className="flex justify-between text-sm py-0.5"><span style={{ color: T.inkSoft }}>GST</span><span>{INR2(gst)}</span></div>
                <div className="flex justify-between text-base font-semibold pt-1.5 mt-1.5" style={{ borderTop: `1px solid ${T.border}`, color: T.ink }}><span>Total amount</span><span>{INR(Math.round(taxable + gst))}</span></div>
              </>);
            })()}
          </div>
          <FileInput label="Attach vendor bill / delivery proof" fileName={file?.name} onFileSelected={setFile} />
          <div className="flex justify-end gap-2 mt-4"><Btn variant="secondary" onClick={() => setShowForm(false)}>Cancel</Btn><Btn icon={Save} onClick={submit}>Save purchase</Btn></div>
        </>)}
      </Modal>
    </div>
  );
}
