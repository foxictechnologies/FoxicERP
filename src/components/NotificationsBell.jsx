/**
 * components/NotificationsBell.jsx
 * -------------------------------------------------------------------------
 * The bell icon in the header. Not a separate database table — it's
 * computed live from data already loaded (low stock, overdue invoices,
 * recent payments), scoped to what the current role is allowed to see.
 * To add a new notification type, add another `items.push(...)` guarded by
 * the appropriate `canSeeX` check.
 * -------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { Bell } from "lucide-react";
import { T } from "../lib/constants";
import { INR } from "../lib/format";
import { Badge } from "./ui";

export default function NotificationsBell({ ctx }) {
  const [open, setOpen] = useState(false);
  const { role, products, invoices, invoiceBalance, payments } = ctx;
  const canSeeFinance = role === "Owner" || role === "Accountant";
  const canSeeSales = canSeeFinance || role === "Sales";
  const canSeeInventory = role === "Owner" || role === "Inventory";

  const items = [];
  if (canSeeInventory) products.filter((p) => p.currentStock <= p.reorderLevel).forEach((p) => items.push({ type: "Low stock", tone: "amber", text: `${p.name} — only ${p.currentStock} ${p.unit} left`, time: null }));
  if (canSeeSales) invoices.filter((i) => (i.status === "Sent" || i.status === "Overdue") && invoiceBalance(i) > 0 && new Date(i.dueDate) < new Date()).forEach((i) => items.push({ type: "Overdue", tone: "red", text: `${i.number} is overdue — ${INR(invoiceBalance(i))} due`, time: i.dueDate }));
  if (canSeeFinance) payments.slice(0, 5).forEach((p) => items.push({ type: "Payment received", tone: "green", text: `${INR(p.amount)} received against ${p.refNumber}`, time: p.date }));

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative p-1.5 rounded-lg hover:bg-gray-100">
        <Bell size={16} color={T.inkSoft} />
        {items.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-semibold text-white" style={{ background: T.red }}>{items.length > 9 ? "9+" : items.length}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl shadow-lg z-40 max-h-96 overflow-y-auto" style={{ background: T.surface, border: `1px solid ${T.border}` }} onMouseLeave={() => setOpen(false)}>
          <div className="px-3 py-2 text-xs font-semibold" style={{ borderBottom: `1px solid ${T.border}`, color: T.ink }}>Notifications</div>
          {items.length === 0 ? <div className="px-3 py-6 text-xs text-center" style={{ color: T.inkFaint }}>You're all caught up.</div> : items.map((n, i) => (
            <div key={i} className="px-3 py-2.5 text-xs" style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
              <Badge tone={n.tone}>{n.type}</Badge>
              <div className="mt-1" style={{ color: T.ink }}>{n.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
