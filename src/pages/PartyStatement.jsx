/**
 * pages/PartyStatement.jsx
 * -------------------------------------------------------------------------
 * A simple running-balance account statement for one customer or vendor —
 * every invoice/purchase and payment, oldest first, with a cumulative
 * balance column. Opened from the history icon on a customer/vendor card
 * in PartyModule.jsx.
 * -------------------------------------------------------------------------
 */

import React from "react";
import { Printer } from "lucide-react";
import { History } from "lucide-react";
import { T } from "../lib/constants";
import { INR, fmtDate } from "../lib/format";
import { Modal, Btn, EmptyState } from "../components/ui";

export default function PartyStatement({ party, isCust, ctx, onClose }) {
  if (!party) return null;
  const txns = isCust
    ? ctx.invoices.filter((i) => i.customerId === party.id && i.status !== "Draft" && i.status !== "Cancelled").map((i) => ({ date: i.date, ref: i.number, debit: ctx.invoiceTotals(i).grandTotal, credit: 0 }))
      .concat(ctx.payments.filter((p) => p.partyId === party.id).map((p) => ({ date: p.date, ref: `Payment — ${p.refNumber}`, debit: 0, credit: p.amount })))
    : ctx.purchases.filter((p) => p.vendorId === party.id).map((p) => ({ date: p.date, ref: p.number, debit: 0, credit: ctx.purchaseTotal(p) }));
  const sorted = txns.sort((a, b) => new Date(a.date) - new Date(b.date));
  let running = 0;
  const withBalance = sorted.map((t) => { running += t.debit - t.credit; return { ...t, balance: running }; });

  return (
    <Modal open={!!party} onClose={onClose} title={`Statement — ${party.name}`} width="max-w-2xl">
      <div className="text-xs mb-3" style={{ color: T.inkFaint }}>{isCust ? "Debit = invoiced, Credit = received" : "Credit = billed by vendor"} · Running balance shown in the last column</div>
      {withBalance.length === 0 ? <EmptyState icon={History} title="No transactions yet" /> : (
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{["Date", "Reference", "Debit", "Credit", "Balance"].map((h) => <th key={h} className="text-left px-3 py-2 text-xs font-medium sticky top-0" style={{ color: T.inkFaint, background: T.surface }}>{h}</th>)}</tr></thead>
            <tbody>{withBalance.map((t, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                <td className="px-3 py-2 text-xs" style={{ color: T.inkSoft }}>{fmtDate(t.date)}</td>
                <td className="px-3 py-2 text-xs">{t.ref}</td>
                <td className="px-3 py-2 text-xs">{t.debit ? INR(t.debit) : "—"}</td>
                <td className="px-3 py-2 text-xs">{t.credit ? INR(t.credit) : "—"}</td>
                <td className="px-3 py-2 text-xs font-medium" style={{ color: t.balance > 0 ? T.red : T.emerald }}>{INR(t.balance)}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      <div className="flex justify-end mt-4"><Btn variant="secondary" icon={Printer} onClick={() => window.print()}>Print statement</Btn></div>
    </Modal>
  );
}
