/**
 * components/GlobalSearch.jsx
 * -------------------------------------------------------------------------
 * The search box in the top header. Searches products/customers/vendors/
 * invoices (each gated by the current role, matching what that role is
 * allowed to see elsewhere in the app) and shows a live dropdown.
 *
 * Clicking a result calls onNavigate(tab, focusValue) — App.jsx switches to
 * that tab and stores focusValue in `globalFocus`, which the target page
 * (e.g. SalesModule, PartyModule, InventoryModule) picks up in a useEffect
 * to pre-fill its own local search box. See any of those pages for the
 * "consume ctx.globalFocus" pattern.
 * -------------------------------------------------------------------------
 */

import React, { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { T } from "../lib/constants";
import { Badge } from "./ui";

export default function GlobalSearch({ ctx, onNavigate }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { role, products, customers, vendors, invoices } = ctx;
  const canSeeSales = role === "Owner" || role === "Accountant" || role === "Sales";
  const canSeeFinance = role === "Owner" || role === "Accountant";

  const results = useMemo(() => {
    if (q.trim().length < 2) return [];
    const query = q.trim().toLowerCase();
    const out = [];
    products.forEach((p) => { if (p.name.toLowerCase().includes(query) || (p.sku || "").toLowerCase().includes(query)) out.push({ type: "product", tab: "inventory", label: p.name, sub: p.sku || p.category, focus: p.name }); });
    if (canSeeSales) customers.forEach((c) => { if (c.name.toLowerCase().includes(query)) out.push({ type: "customer", tab: "customers", label: c.name, sub: c.state, focus: c.name }); });
    if (canSeeFinance) vendors.forEach((v) => { if (v.name.toLowerCase().includes(query)) out.push({ type: "vendor", tab: "vendors", label: v.name, sub: v.state, focus: v.name }); });
    if (canSeeSales) invoices.forEach((i) => { const cust = ctx.getCustomer(i.customerId); if (i.number.toLowerCase().includes(query) || (cust && cust.name.toLowerCase().includes(query))) out.push({ type: "invoice", tab: "sales", label: i.number, sub: cust?.name, focus: i.number }); });
    return out.slice(0, 8);
  }, [q, products, customers, vendors, invoices, role]); // eslint-disable-line

  const pick = (r) => { onNavigate(r.tab, r.focus); setQ(""); setOpen(false); };

  return (
    <div className="relative hidden md:block" style={{ width: 320 }}>
      <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: T.borderSoft }}>
        <Search size={14} color={T.inkFaint} />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search customers, invoices, products…"
          className="bg-transparent outline-none text-sm flex-1"
          style={{ color: T.ink }}
        />
      </div>
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 mt-1 rounded-lg shadow-lg overflow-hidden z-40" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          {results.length === 0 ? (
            <div className="px-3 py-3 text-xs" style={{ color: T.inkFaint }}>No matches for "{q}"</div>
          ) : results.map((r, i) => (
            <button key={i} onClick={() => pick(r)} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center justify-between" style={{ borderTop: i > 0 ? `1px solid ${T.borderSoft}` : "none" }}>
              <span><span className="font-medium" style={{ color: T.ink }}>{r.label}</span>{r.sub && <span style={{ color: T.inkFaint }}> · {r.sub}</span>}</span>
              <Badge tone="neutral">{r.type}</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
