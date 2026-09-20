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
import { Plus, ShoppingCart, AlertTriangle, Paperclip, Save, Printer } from "lucide-react";
import { T } from "../lib/constants";
import { INR, INR2, fmtDate, uid, todayISO, numToWordsIndian } from "../lib/format";
import { Card, Badge, Btn, Field, Input, Select, Modal, EmptyState, SectionHeader, statusTone } from "../components/ui";
import FileInput from "../components/FileInput";
import AttachmentLink from "../components/AttachmentLink";
import { insertRow, updateRow, uploadAttachment } from "../lib/db";
import { computeInvoiceTotals } from "../lib/taxEngine";

export default function PurchasesModule({ ctx }) {
  const { purchases, setPurchases, vendors, products, adjustStock, purchaseTotal, company, setCompany } = ctx;
  const isViewer = ctx.role === "Viewer";
  const [showForm, setShowForm] = useState(false);
  const [viewing, setViewing] = useState(null);
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
      if (file) {
        try { attachmentUrl = await uploadAttachment(file, company.id); } catch (e) { console.warn(e); }
      }
      let row = { ...form, attachmentUrl, companyId: company?.id || "test-company-id", createdBy: ctx.currentUser?.id || "test-user-id" };
      try {
        const inserted = await insertRow("purchases", row);
        if (inserted?.id) row = inserted;
      } catch (err) {
        console.warn("Supabase insert purchase fallback:", err);
      }
      setPurchases((prev) => [row, ...prev]);
      for (const it of form.items) await adjustStock(it.productId, Number(it.qty), "Purchase", row.id);
      if (company?.id) {
        try {
          const updatedCompany = await updateRow("companies", company.id, { nextPurchaseNumber: (company.nextPurchaseNumber || 201) + 1 });
          if (updatedCompany) setCompany(updatedCompany);
        } catch (e) {
          setCompany((prev) => ({ ...prev, nextPurchaseNumber: (prev.nextPurchaseNumber || 201) + 1 }));
        }
      }
      ctx.logAudit("Purchase bill created", `${row.number} from ${ctx.getVendor(row.vendorId)?.name}`);
      setShowForm(false);
    } catch (e) {
      if (e.code === "23505" || /duplicate key/i.test(e.message || "")) alert("A purchase with this number already exists. Bump 'Next purchase #' in Settings and retry.");
      else alert("Could not save purchase: " + e.message);
    }
  };
  const markPaid = async (pur) => {
    try {
      let row = { ...pur, status: "Paid" };
      try {
        const updated = await updateRow("purchases", pur.id, { status: "Paid" });
        if (updated?.id) row = updated;
      } catch (err) {
        console.warn("Supabase update purchase fallback:", err);
      }
      setPurchases((prev) => prev.map((p) => p.id === row.id ? row : p));
      ctx.logAudit("Purchase marked paid", row.number);
    } catch (e) { alert("Could not mark as paid: " + e.message); }
  };

  return (
    <div>
      <SectionHeader title="Purchases" subtitle="Purchase orders, goods received and vendor bills" action={!isViewer ? <Btn icon={Plus} onClick={openForm}>New Purchase</Btn> : null} />
      <Card>
        {purchases.length === 0 ? <EmptyState icon={ShoppingCart} title="No purchases recorded" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{["Purchase #", "Date", "Vendor", "Items", "Amount", "Status", ""].map((h) => <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: T.inkFaint }}>{h}</th>)}</tr></thead>
              <tbody>{purchases.map((p) => { const vendor = ctx.getVendor(p.vendorId); const itemNames = p.items.map((it) => ctx.getProduct(it.productId)?.name || "Unknown").join(", "); return (
                <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" style={{ borderBottom: `1px solid ${T.borderSoft}` }} onClick={() => setViewing(p)}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: T.navy }}>{p.number}{p.attachmentUrl && <Paperclip size={11} className="inline ml-1" style={{ color: T.inkFaint }} />}</td>
                  <td className="px-4 py-2.5" style={{ color: T.inkSoft }}>{fmtDate(p.date)}</td>
                  <td className="px-4 py-2.5">{vendor?.name}</td>
                  <td className="px-4 py-2.5 text-xs max-w-[240px] truncate" style={{ color: T.inkSoft }} title={itemNames}>{itemNames}</td>
                  <td className="px-4 py-2.5 font-medium">{INR(purchaseTotal(p))}</td>
                  <td className="px-4 py-2.5"><Badge tone={statusTone(p.status)}>{p.status}</Badge></td>
                  <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}><div className="flex justify-end gap-2 items-center"><AttachmentLink path={p.attachmentUrl} label="Proof" />{!isViewer && p.status !== "Paid" && <Btn size="sm" variant="secondary" onClick={() => markPaid(p)}>Mark Paid</Btn>}</div></td>
                </tr>); })}</tbody>
            </table>
          </div>
        )}
      </Card>
      <PurchaseView pur={viewing} onClose={() => setViewing(null)} ctx={ctx} />
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

export function PurchaseView({ pur, onClose, ctx }) {
  if (!pur) return null;
  const vendor = ctx.getVendor(pur.vendorId);
  const company = ctx.company;
  const totals = computeInvoiceTotals(pur.items, ctx.products, company?.state, vendor?.state, "auto");
  const v = vendor || {};
  return (
    <Modal open={!!pur} onClose={onClose} title={pur.number} width="max-w-2xl">
      <div className="invoice-print-area" style={{ background: "#ffffff" }}>
        <div className="grid grid-cols-2 gap-4 mb-4 pb-4 text-xs" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div>
            <div className="font-medium mb-1" style={{ color: T.inkSoft }}>PURCHASE BILL FROM</div>
            <div className="font-semibold text-base" style={{ color: T.navy, fontFamily: "Lexend, sans-serif" }}>{v.name}</div>
            <div className="mt-1" style={{ color: T.inkFaint }}>{v.address}{v.state ? `, ${v.state}` : ""}</div>
            <div style={{ color: T.inkFaint }}>GSTIN: {v.gstin || "Unregistered"}</div>
          </div>
          <div className="text-right">
            <Badge tone={statusTone(pur.status)}>{pur.status}</Badge>
            <div className="font-medium mb-1 mt-2" style={{ color: T.inkSoft }}>RECEIVED BY (your business)</div>
            <div className="font-semibold text-sm" style={{ color: T.ink }}>{company?.legalName}</div>
            <div style={{ color: T.inkFaint }}>{company?.address}, {company?.city}, {company?.state} - {company?.pin}</div>
            <div style={{ color: T.inkFaint }}>GSTIN: {company?.gstin}</div>
          </div>
        </div>
        <div className="text-right text-xs mb-4">
          <div><span style={{ color: T.inkFaint }}>Purchase date: </span>{fmtDate(pur.date)}</div>
          <div><span style={{ color: T.inkFaint }}>Place of supply: </span>{v.state}</div>
        </div>
        <table className="w-full text-xs mb-4">
          <thead><tr style={{ background: T.borderSoft }}>{["Item", "HSN", "Qty", "Rate", "Taxable", totals.interState ? "IGST" : "CGST+SGST", "Total"].map((h) => <th key={h} className="text-left px-2 py-1.5 font-medium" style={{ color: T.inkSoft }}>{h}</th>)}</tr></thead>
          <tbody>{totals.lines.map((l, i) => <tr key={i} style={{ borderBottom: `1px solid ${T.borderSoft}` }}><td className="px-2 py-1.5">{l.product.name}</td><td className="px-2 py-1.5">{l.product.hsn}</td><td className="px-2 py-1.5">{l.qty} {l.product.unit}</td><td className="px-2 py-1.5">{INR2(l.rate)}</td><td className="px-2 py-1.5">{INR2(l.lineTaxable)}</td><td className="px-2 py-1.5">{INR2(totals.interState ? l.igst : l.cgst + l.sgst)} ({l.gstRate}%)</td><td className="px-2 py-1.5 font-medium">{INR2(l.lineTotal)}</td></tr>)}</tbody>
        </table>
        <div className="flex justify-end mb-4">
          <div className="w-56 text-sm">
            <div className="flex justify-between py-0.5"><span style={{ color: T.inkSoft }}>Taxable value</span><span>{INR2(totals.taxable)}</span></div>
            {totals.interState ? <div className="flex justify-between py-0.5"><span style={{ color: T.inkSoft }}>IGST</span><span>{INR2(totals.igst)}</span></div> : (<><div className="flex justify-between py-0.5"><span style={{ color: T.inkSoft }}>CGST</span><span>{INR2(totals.cgst)}</span></div><div className="flex justify-between py-0.5"><span style={{ color: T.inkSoft }}>SGST</span><span>{INR2(totals.sgst)}</span></div></>)}
            <div className="flex justify-between py-0.5"><span style={{ color: T.inkSoft }}>Round off</span><span>{INR2(totals.roundOff)}</span></div>
            <div className="flex justify-between font-semibold text-base pt-1.5 mt-1" style={{ borderTop: `1px solid ${T.border}` }}><span>Grand total</span><span>{INR(totals.grandTotal)}</span></div>
          </div>
        </div>
        <div className="text-xs mb-4" style={{ color: T.inkFaint }}>Amount in words: {numToWordsIndian(totals.grandTotal)}</div>
        <div className="text-xs px-3 py-2.5 rounded-lg mb-4" style={{ background: T.borderSoft, color: T.inkFaint }}>
          <span className="font-medium" style={{ color: T.inkSoft }}>VENDOR BANK DETAILS (for reference when paying)</span>
          <div className="mt-0.5" style={{ color: T.ink }}>{v.bankName || "—"}</div>
          <div>A/C <span className="font-semibold" style={{ color: T.ink }}>{v.bankAccount || "—"}</span></div>
          {v.bankIfsc && <div>IFSC <span className="font-semibold" style={{ color: T.ink }}>{v.bankIfsc}</span></div>}
        </div>
      </div>
      <div className="no-print flex justify-between items-center gap-2">
        <AttachmentLink path={pur.attachmentUrl} label="View attached bill" />
        <div className="flex justify-end gap-2"><Btn variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Btn><Btn variant="secondary" onClick={onClose}>Close</Btn></div>
      </div>
    </Modal>
  );
}
