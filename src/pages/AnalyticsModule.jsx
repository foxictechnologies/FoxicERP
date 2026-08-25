/**
 * pages/AnalyticsModule.jsx
 * -------------------------------------------------------------------------
 * The "Date-wise Analytics" tab — sales/purchases broken down by day for
 * any date range (including a custom from/to range), as both a chart and
 * a table. Purchases are hidden for the Sales role (canSeeFinance guard),
 * matching the same role rules as everywhere else.
 * -------------------------------------------------------------------------
 */

import React, { useState, useMemo } from "react";
import { TrendingUp, ShoppingCart, FileText, CalendarRange } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { T, DATE_RANGE_OPTIONS } from "../lib/constants";
import { INR, todayISO, fmtDate } from "../lib/format";
import { getRangeDates, inRange } from "../lib/dateRange";
import { Card, Select, Input, EmptyState, KpiCard, SectionHeader, CustomTooltip } from "../components/ui";

export default function AnalyticsModule({ ctx }) {
  const { invoices, purchases, invoiceTotals, role } = ctx;
  const canSeeFinance = role === "Owner" || role === "Accountant";
  const [rangeLabel, setRangeLabel] = useState("This month");
  const [customFrom, setCustomFrom] = useState(todayISO());
  const [customTo, setCustomTo] = useState(todayISO());
  const range = useMemo(() => getRangeDates(rangeLabel, customFrom, customTo), [rangeLabel, customFrom, customTo]);

  const activeInvoices = invoices.filter((i) => i.status !== "Draft" && i.status !== "Cancelled" && inRange(i.date, range));
  const purchasesInRange = canSeeFinance ? purchases.filter((p) => inRange(p.date, range)) : [];

  const byDate = {};
  activeInvoices.forEach((i) => {
    byDate[i.date] = byDate[i.date] || { date: i.date, salesCount: 0, salesAmount: 0, purchaseCount: 0, purchaseAmount: 0 };
    byDate[i.date].salesCount += 1;
    byDate[i.date].salesAmount += invoiceTotals(i).grandTotal;
  });
  purchasesInRange.forEach((p) => {
    byDate[p.date] = byDate[p.date] || { date: p.date, salesCount: 0, salesAmount: 0, purchaseCount: 0, purchaseAmount: 0 };
    byDate[p.date].purchaseCount += 1;
    byDate[p.date].purchaseAmount += ctx.purchaseTotal(p);
  });
  const rows = Object.values(byDate).sort((a, b) => new Date(b.date) - new Date(a.date));
  const chartData = [...rows].sort((a, b) => new Date(a.date) - new Date(b.date)).map((r) => ({ date: new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), Sales: r.salesAmount, Purchases: r.purchaseAmount }));

  const totalSales = activeInvoices.reduce((s, i) => s + invoiceTotals(i).grandTotal, 0);
  const totalPurchases = purchasesInRange.reduce((s, p) => s + ctx.purchaseTotal(p), 0);
  const daysCovered = rows.length || 1;

  return (
    <div>
      <SectionHeader title="Date-wise Analytics" subtitle="Sales and purchase activity by day, for any date range" action={
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={rangeLabel} onChange={(e) => setRangeLabel(e.target.value)} style={{ width: 140 }}>{DATE_RANGE_OPTIONS.map((r) => <option key={r}>{r}</option>)}</Select>
          {rangeLabel === "Custom" && (<><Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ width: 145 }} /><Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ width: 145 }} /></>)}
        </div>
      } />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Sales (range)" value={INR(totalSales)} icon={TrendingUp} iconBg={T.emeraldWash} iconColor={T.emerald} />
        {canSeeFinance && <KpiCard label="Purchases (range)" value={INR(totalPurchases)} icon={ShoppingCart} iconBg={T.navyWash} iconColor={T.navy} />}
        <KpiCard label="Invoices raised" value={activeInvoices.length} icon={FileText} iconBg={T.navyWash} iconColor={T.navy} />
        <KpiCard label="Avg. sales / active day" value={INR(totalSales / daysCovered)} icon={CalendarRange} iconBg={T.amberWash} iconColor={T.amber} />
      </div>

      <Card className="p-4 mb-4">
        <div className="text-sm font-semibold mb-3" style={{ color: T.ink }}>Sales{canSeeFinance ? " vs purchases" : ""} by day</div>
        {chartData.length === 0 ? <EmptyState icon={CalendarRange} title="No activity in this range" /> : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: T.inkFaint }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: T.inkFaint }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Sales" fill={T.navy} radius={[4, 4, 0, 0]} />
              {canSeeFinance && <Bar dataKey="Purchases" fill={T.amber} radius={[4, 4, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="text-sm font-semibold mb-2" style={{ color: T.ink }}>Day-by-day breakdown</div>
      <Card>
        {rows.length === 0 ? <EmptyState icon={CalendarRange} title="No data for this range" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{["Date", "Invoices", "Sales amount", ...(canSeeFinance ? ["Purchases", "Purchase amount"] : [])].map((h) => <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: T.inkFaint }}>{h}</th>)}</tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.date} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                  <td className="px-4 py-2.5" style={{ color: T.ink }}>{fmtDate(r.date)}</td>
                  <td className="px-4 py-2.5">{r.salesCount}</td>
                  <td className="px-4 py-2.5 font-medium">{INR(r.salesAmount)}</td>
                  {canSeeFinance && <td className="px-4 py-2.5">{r.purchaseCount}</td>}
                  {canSeeFinance && <td className="px-4 py-2.5 font-medium">{INR(r.purchaseAmount)}</td>}
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
