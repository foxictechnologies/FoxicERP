/**
 * pages/InventoryModule.jsx
 * -------------------------------------------------------------------------
 * The "Inventory" tab — product catalogue, stock levels, and two charts:
 * a date-wise stock-in/out bar chart and a recent stock-ledger table. The
 * stock ledger itself is written by ctx.adjustStock() (called from
 * invoices/purchases), not from this page — this page only displays it.
 * -------------------------------------------------------------------------
 */

import React, { useState, useEffect } from "react";
import { Plus, Search, Edit2, Trash2, Package, Boxes, Save } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { T } from "../lib/constants";
import { INR, fmtDate, uid } from "../lib/format";
import { Card, Badge, Btn, Field, Input, Select, Modal, EmptyState, SectionHeader, CustomTooltip } from "../components/ui";
import { insertRow, updateRow, deleteRow } from "../lib/db";

export default function InventoryModule({ ctx }) {
  const { products, setProducts, stockLedger, company } = ctx;
  const isViewer = ctx.role === "Viewer";
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState("");
  useEffect(() => { if (ctx.globalFocus?.tab === "inventory") { setQ(ctx.globalFocus.value); ctx.setGlobalFocus(null); } }, [ctx.globalFocus]); // eslint-disable-line
  const blank = () => ({ id: uid(), name: "", sku: "", hsn: "", category: "General", unit: "PCS", purchasePrice: 0, sellingPrice: 0, mrp: 0, gstRate: 18, currentStock: 0, reorderLevel: 10 });
  const [form, setForm] = useState(blank());
  const filtered = products.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.sku || "").toLowerCase().includes(q.toLowerCase()));
  const openNew = () => { setForm(blank()); setEditing(null); setShowForm(true); };
  const openEdit = (p) => { setForm(p); setEditing(p); setShowForm(true); };

  const submit = async () => {
    if (!form.name.trim()) { alert("Product name is required."); return; }
    try {
      if (editing) {
        let row = form;
        try { row = await updateRow("products", form.id, form); } catch (err) { console.warn(err); }
        setProducts((prev) => prev.map((p) => p.id === row.id ? row : p));
        ctx.logAudit("Product modified", form.name);
      } else {
        let row = { ...form, id: form.id || uid(), companyId: company?.id || "test-company-id" };
        try { const res = await insertRow("products", row); if (res?.id) row = res; } catch (err) { console.warn(err); }
        setProducts((prev) => [row, ...prev]);
        ctx.logAudit("Product created", form.name);
      }
      setShowForm(false);
    } catch (e) { alert("Could not save product: " + e.message); }
  };
  const remove = async (id) => {
    const usedInInvoices = ctx.invoices.some((i) => i.items.some((it) => it.productId === id));
    const usedInPurchases = ctx.purchases.some((p) => p.items.some((it) => it.productId === id));
    const usedInLedger = ctx.stockLedger.some((l) => l.productId === id);
    if (usedInInvoices || usedInPurchases || usedInLedger) {
      alert("This product is referenced by invoices, purchases or stock history and can't be deleted — deleting it would corrupt past records. Set its stock to 0 instead.");
      return;
    }
    if (!confirm("Delete this product?")) return;
    try {
      const p = products.find((pp) => pp.id === id);
      try { await deleteRow("products", id); } catch (err) { console.warn(err); }
      setProducts((prev) => prev.filter((p) => p.id !== id));
      ctx.logAudit("Product deleted", p?.name);
    } catch (e) { alert("Could not delete product: " + e.message); }
  };

  return (
    <div>
      <SectionHeader title="Inventory & Products" subtitle="Products, stock levels and the stock movement ledger" action={!isViewer ? <Btn icon={Plus} onClick={openNew}>New Product</Btn> : null} />
      <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-4 max-w-sm" style={{ background: T.surface, border: `1px solid ${T.border}` }}><Search size={14} color={T.inkFaint} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product or SKU…" className="outline-none text-sm flex-1" /></div>
      <Card>
        {filtered.length === 0 ? <EmptyState icon={Package} title="No products found" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{["Product", "SKU / HSN", "Category", "Stock", "GST", "Selling Price", !isViewer ? "" : null].filter(Boolean).map((h) => <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: T.inkFaint }}>{h}</th>)}</tr></thead>
              <tbody>{filtered.map((p) => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: T.ink }}>{p.name}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: T.inkFaint }}>{p.sku} · {p.hsn}</td>
                  <td className="px-4 py-2.5">{p.category}</td>
                  <td className="px-4 py-2.5"><span style={{ color: p.currentStock <= p.reorderLevel ? T.red : T.ink }}>{p.currentStock} {p.unit}</span>{p.currentStock <= p.reorderLevel && <Badge tone="red">Low</Badge>}</td>
                  <td className="px-4 py-2.5">{p.gstRate}%</td>
                  <td className="px-4 py-2.5 font-medium">{INR(p.sellingPrice)}</td>
                  {!isViewer && (
                    <td className="px-4 py-2.5 text-right"><div className="flex justify-end gap-1"><button onClick={() => openEdit(p)} className="p-1.5 rounded-md hover:bg-gray-100"><Edit2 size={14} color={T.inkSoft} /></button><button onClick={() => remove(p.id)} className="p-1.5 rounded-md hover:bg-gray-100"><Trash2 size={14} color={T.red} /></button></div></td>
                  )}
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-5">
        <div className="text-sm font-semibold mb-2" style={{ color: T.ink }}>Stock movement by date</div>
        <Card className="p-4 mb-4">
          {stockLedger.length === 0 ? <EmptyState icon={Boxes} title="No stock movements yet" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={Object.values(stockLedger.reduce((acc, l) => {
                acc[l.date] = acc[l.date] || { date: new Date(l.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), In: 0, Out: 0 };
                if (l.qty >= 0) acc[l.date].In += l.qty; else acc[l.date].Out += Math.abs(l.qty);
                return acc;
              }, {})).slice(-14)}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: T.inkFaint }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: T.inkFaint }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="In" fill={T.emerald} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Out" fill={T.red} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <div className="text-sm font-semibold mb-2" style={{ color: T.ink }}>Recent stock ledger</div>
        <Card>
          {stockLedger.length === 0 ? <EmptyState icon={Boxes} title="No stock movements yet" /> : (
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{["Date", "Product", "Type", "Qty change"].map((h) => <th key={h} className="text-left px-4 py-2 text-xs font-medium" style={{ color: T.inkFaint }}>{h}</th>)}</tr></thead>
                <tbody>{stockLedger.slice(0, 40).map((l) => (
                  <tr key={l.id} style={{ borderBottom: `1px solid ${T.borderSoft}` }}><td className="px-4 py-2 text-xs" style={{ color: T.inkSoft }}>{fmtDate(l.date)}</td><td className="px-4 py-2">{ctx.getProduct(l.productId)?.name || "—"}</td><td className="px-4 py-2 text-xs" style={{ color: T.inkFaint }}>{l.type}</td><td className="px-4 py-2 font-medium" style={{ color: l.qty >= 0 ? T.emerald : T.red }}>{l.qty >= 0 ? "+" : ""}{l.qty}</td></tr>))}</tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit product" : "New product"}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Product name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Wireless Optical Mouse" /></Field>
          <Field label="SKU"><Input allow="uppercase" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="e.g. ELE-MOU-001" /></Field>
          <Field label="HSN/SAC code"><Input allow="numeric" value={form.hsn} onChange={(e) => setForm({ ...form, hsn: e.target.value })} placeholder="e.g. 8471 (digits only)" /></Field>
          <Field label="Category"><Input allow="alpha" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Electronics (letters only)" /></Field>
          <Field label="Unit"><Input allow="alpha" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="e.g. PCS, KG, BOX" /></Field>
          <Field label="GST rate (%)"><Select value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: Number(e.target.value) })}>{[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}</Select></Field>
          <Field label="Purchase price"><Input type="number" min="0" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} placeholder="Cost price in ₹" /></Field>
          <Field label="Selling price"><Input type="number" min="0" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })} placeholder="Price you charge in ₹" /></Field>
          <Field label="MRP"><Input type="number" min="0" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: Number(e.target.value) })} placeholder="Maximum retail price in ₹" /></Field>
          <Field label={editing ? "Current stock" : "Opening stock"}><Input type="number" min="0" value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: Number(e.target.value) })} placeholder="Units in stock" /></Field>
          <Field label="Reorder level"><Input type="number" min="0" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })} placeholder="Alert when stock falls below this" /></Field>
        </div>
        <div className="flex justify-end gap-2 mt-4"><Btn variant="secondary" onClick={() => setShowForm(false)}>Cancel</Btn><Btn icon={Save} onClick={submit}>Save product</Btn></div>
      </Modal>
    </div>
  );
}
