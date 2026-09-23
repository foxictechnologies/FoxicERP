/**
 * pages/Dashboard.jsx
 * -------------------------------------------------------------------------
 * The "dashboard" tab — KPI cards + charts, filtered by the date range
 * dropdown at the top. Everything here is derived/computed from `ctx`
 * (products, invoices, purchases, expenses, ...) — nothing is fetched
 * directly by this page, App.jsx owns all the data loading.
 *
 * ROLE SCOPING: this is the one page every role sees, so it's the most
 * important place the role-based visibility rules live:
 *   canSeeFinance    Owner, Accountant  -> profit/loss, payables, expenses
 *   canSeeSales      + Sales            -> sales figures, customer count
 *   canSeeInventory  Owner, Inventory   -> stock value, low-stock alerts
 * Each KPI card / chart below is wrapped in one of these checks. This is a
 * UI convenience for a good experience per role — the actual security
 * boundary is Postgres Row-Level Security (see supabase-schema.sql), which
 * means even if this scoping logic had a bug, the underlying data queries
 * would still refuse to return rows a role isn't allowed to see.
 * -------------------------------------------------------------------------
 */

import React, { useState, useMemo } from "react";
import {
  TrendingUp, TrendingDown, IndianRupee, ShoppingCart, Wallet, Receipt,
  Boxes, AlertTriangle, Users, Truck, CheckCircle2, Lock, Mail, ArrowRight,
  Sparkles, ShieldAlert
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { T, PIE_COLORS, DATE_RANGE_OPTIONS } from "../lib/constants";
import { INR, todayISO } from "../lib/format";
import { getRangeDates, inRange } from "../lib/dateRange";
import { Card, Badge, Btn, Select, EmptyState, KpiCard, SectionHeader, CustomTooltip } from "../components/ui";
import { FOXIC_EMAIL } from "../lib/hostingerMail";

export default function Dashboard({ ctx }) {
  const { invoices, purchases, expenses, products, customers, vendors, invoiceTotals, invoiceBalance, role, emails = [], setActiveTab } = ctx;

  const unreadEmails = useMemo(() => {
    return (emails || []).filter(e => !e.is_read && e.folder !== "trash");
  }, [emails]);

  const latestEmail = unreadEmails.length > 0 ? unreadEmails[0] : (emails && emails.length > 0 ? emails[0] : null);
  const canSeeFinance = role === "Owner" || role === "Accountant" || role === "Manager" || role === "Viewer";
  const canSeeProfits = role === "Owner" || role === "Accountant" || role === "Viewer";
  const canSeeSales = role === "Owner" || role === "Accountant" || role === "Sales" || role === "Manager" || role === "Viewer";
  const canSeeInventory = role === "Owner" || role === "Inventory" || role === "Manager" || role === "Viewer";
  const [rangeLabel, setRangeLabel] = useState("This month");
  const range = useMemo(() => getRangeDates(rangeLabel), [rangeLabel]);

  const activeInvoicesAll = invoices.filter((i) => i.status !== "Draft" && i.status !== "Cancelled");
  const activeInvoices = activeInvoicesAll.filter((i) => inRange(i.date, range));
  const purchasesInRange = purchases.filter((p) => inRange(p.date, range));
  const expensesInRange = expenses.filter((e) => inRange(e.date, range));
  const totalSales = activeInvoices.reduce((s, i) => s + invoiceTotals(i).grandTotal, 0);
  const todaySales = activeInvoicesAll.filter((i) => i.date === todayISO()).reduce((s, i) => s + invoiceTotals(i).grandTotal, 0);
  const totalPurchases = purchasesInRange.reduce((s, p) => s + ctx.purchaseTotal(p), 0);
  const receivables = activeInvoicesAll.reduce((s, i) => s + invoiceBalance(i), 0); // always current, not range-limited
  const payables = vendors.reduce((s, v) => s + ctx.vendorOutstanding(v.id), 0);
  const totalExpenses = expensesInRange.reduce((s, e) => s + e.amount, 0);
  const cogs = activeInvoices.reduce((s, i) => s + i.items.reduce((s2, it) => { const prod = ctx.getProduct(it.productId); return s2 + (prod ? prod.purchasePrice * it.qty : 0); }, 0), 0);
  const grossProfit = totalSales - cogs;
  const netProfit = grossProfit - totalExpenses;
  const inventoryValue = products.reduce((s, p) => s + p.currentStock * p.purchasePrice, 0);
  const lowStock = products.filter((p) => p.currentStock <= p.reorderLevel);

  const spanDays = Math.min(60, Math.max(1, Math.round((range.end - range.start) / 86400000) + 1));
  const days = Array.from({ length: spanDays }).map((_, i) => new Date(range.start.getTime() + i * 86400000).toISOString().slice(0, 10));
  const salesTrend = days.map((d) => {
    const dayInv = activeInvoicesAll.filter((i) => i.date === d);
    const purch = purchases.filter((p) => p.date === d);
    return { date: new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), Sales: dayInv.reduce((s, i) => s + invoiceTotals(i).grandTotal, 0), Purchases: purch.reduce((s, p) => s + ctx.purchaseTotal(p), 0) };
  });

  const salesByProduct = {};
  activeInvoices.forEach((inv) => inv.items.forEach((it) => { const prod = ctx.getProduct(it.productId); if (!prod) return; salesByProduct[prod.name] = (salesByProduct[prod.name] || 0) + it.qty * it.rate; }));
  const topProducts = Object.entries(salesByProduct).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));

  const expenseBreakdown = {};
  expensesInRange.forEach((e) => { expenseBreakdown[e.category] = (expenseBreakdown[e.category] || 0) + e.amount; });
  const expensePie = Object.entries(expenseBreakdown).map(([name, value]) => ({ name, value }));

  const agingBuckets = { "Current": 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  activeInvoicesAll.forEach((inv) => {
    const bal = invoiceBalance(inv);
    if (bal <= 0) return;
    const dd = Math.floor((Date.now() - new Date(inv.dueDate || inv.date)) / 86400000);
    if (dd <= 0) agingBuckets.Current += bal; else if (dd <= 30) agingBuckets["1-30"] += bal; else if (dd <= 60) agingBuckets["31-60"] += bal; else if (dd <= 90) agingBuckets["61-90"] += bal; else agingBuckets["90+"] += bal;
  });
  const agingData = Object.entries(agingBuckets).map(([name, value]) => ({ name, value }));

  const ownerPendingCount = useMemo(() => {
    if (!ctx.company?.id) return 0;
    const compId = ctx.company.id;
    let count = 0;
    try {
      const rawUsers = localStorage.getItem(`erp_pending_user_requests_${compId}`);
      const pUsers = rawUsers ? JSON.parse(rawUsers) : [];
      if (Array.isArray(pUsers)) count += pUsers.length;
    } catch (e) {}

    try {
      const rawRoles = localStorage.getItem(`erp_pending_role_requests_${compId}`);
      const pRoles = rawRoles ? JSON.parse(rawRoles) : {};
      count += Object.keys(pRoles).length;
    } catch (e) {}

    try {
      const rawActions = localStorage.getItem(`erp_pending_member_actions_${compId}`);
      const pActions = rawActions ? JSON.parse(rawActions) : {};
      count += Object.keys(pActions).length;
    } catch (e) {}

    return count;
  }, [ctx.company?.id]);

  const noDataYet = products.length === 0 && customers.length === 0 && invoices.length === 0;

  return (
    <div>
      <SectionHeader title="Dashboard" subtitle={`Overview for ${ctx.company.name}${ctx.company.financialYear ? " · " + ctx.company.financialYear : ""}`} action={
        <Select value={rangeLabel} onChange={(e) => setRangeLabel(e.target.value)} style={{ width: 150 }}>
          {DATE_RANGE_OPTIONS.filter((o) => o !== "Custom").map((r) => <option key={r}>{r}</option>)}
        </Select>
      } />

      {noDataYet && role === "Owner" && (
        <Card className="p-4 mb-4 flex items-center justify-between flex-wrap gap-3">
          <div><div className="text-sm font-medium" style={{ color: T.ink }}>Your database is empty</div><div className="text-xs" style={{ color: T.inkFaint }}>Add your first products and customers under Inventory/Customers, or load demo data to explore the app.</div></div>
          <Btn variant="secondary" onClick={ctx.loadSampleData}>Load sample data</Btn>
        </Card>
      )}

      {/* ── OWNER ACTION REQUIRED NOTIFICATION CARD ── */}
      {role === "Owner" && ownerPendingCount > 0 && (
        <div
          onClick={() => setActiveTab && setActiveTab("users")}
          style={{
            marginBottom: 16,
            padding: "14px 18px",
            borderRadius: 14,
            background: "linear-gradient(135deg, #FFF9E6 0%, #FFFFFF 100%)",
            border: "1px solid rgba(176, 109, 0, 0.30)",
            boxShadow: "0 4px 16px rgba(176, 109, 0, 0.10)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 260, flex: 1 }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: "linear-gradient(135deg, #B06D00 0%, #FF9F0A 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              boxShadow: "0 3px 10px rgba(176, 109, 0, 0.3)"
            }}>
              <ShieldAlert size={20} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>
                  Pending Approval Request{ownerPendingCount > 1 ? "s" : ""}
                </span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "1px 8px",
                  borderRadius: 12,
                  background: T.amberWash,
                  color: T.amber,
                  border: "1px solid rgba(176,109,0,0.2)"
                }}>
                  {ownerPendingCount} Action Required
                </span>
              </div>
              <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 3 }}>
                You have manager or team member requests (New User, Role Change, or Deactivate/Delete) waiting for your approval.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.amber, fontWeight: 600, fontSize: 13 }}>
            <span>Review Requests</span>
            <ArrowRight size={16} />
          </div>
        </div>
      )}

      {/* ── NEW EMAIL RECEIVED NOTIFICATION CARD ── */}
      {unreadEmails.length > 0 && (
        <div
          onClick={() => setActiveTab && setActiveTab("inbox")}
          style={{
            marginBottom: 16,
            padding: "14px 18px",
            borderRadius: 14,
            background: "linear-gradient(135deg, #F0F6FF 0%, #FFFFFF 100%)",
            border: "1px solid rgba(0, 113, 227, 0.22)",
            boxShadow: "0 4px 16px rgba(0, 113, 227, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 260, flex: 1 }}>
            <div style={{
              position: "relative",
              width: 42,
              height: 42,
              borderRadius: 12,
              background: "linear-gradient(135deg, #0071E3 0%, #3a98ff 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              boxShadow: "0 3px 10px rgba(0, 113, 227, 0.3)"
            }}>
              <Mail size={20} />
              <span style={{
                position: "absolute",
                top: -2,
                right: -2,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#FF3B30",
                border: "2px solid #fff"
              }} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>
                  New Email Received
                </span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "1px 8px",
                  borderRadius: 12,
                  background: T.navyWash,
                  color: T.navy,
                  border: "1px solid rgba(0,113,227,0.18)"
                }}>
                  {FOXIC_EMAIL}
                </span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "1px 8px",
                  borderRadius: 12,
                  background: T.redWash,
                  color: T.red
                }}>
                  {unreadEmails.length} unread
                </span>
              </div>

              {latestEmail && (
                <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 3 }}>
                  <b style={{ color: T.ink }}>{latestEmail.sender_name || latestEmail.sender_email}:</b> {latestEmail.subject}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.navy, fontWeight: 600, fontSize: 13 }}>
            <span>Go to Inbox</span>
            <ArrowRight size={16} />
          </div>
        </div>
      )}

      {!canSeeFinance && (
        <div className="text-xs mb-4 px-3 py-2 rounded-lg inline-flex items-center gap-2" style={{ background: T.navyWash, color: T.navy }}>
          <Lock size={13} /> Showing {role === "Sales" ? "sales" : "inventory"}-scoped data for your role — enforced by the database, not just this screen.
        </div>
      )}

      {canSeeSales && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <KpiCard label="Total Sales" value={INR(totalSales)} icon={TrendingUp} iconBg={T.emeraldWash} iconColor={T.emerald} />
          <KpiCard label="Today's Sales" value={INR(todaySales)} icon={IndianRupee} iconBg={T.navyWash} iconColor={T.navy} />
          {canSeeFinance && <KpiCard label="Total Purchases" value={INR(totalPurchases)} icon={ShoppingCart} iconBg={T.navyWash} iconColor={T.navy} />}
          <KpiCard label="Outstanding Receivables" value={INR(receivables)} icon={Wallet} iconBg={T.amberWash} iconColor={T.amber} />
          {canSeeFinance && <KpiCard label="Outstanding Payables" value={INR(payables)} icon={Wallet} iconBg={T.redWash} iconColor={T.red} />}
          {canSeeFinance && <KpiCard label="Total Expenses" value={INR(totalExpenses)} icon={Receipt} iconBg={T.redWash} iconColor={T.red} />}
          {canSeeProfits && <KpiCard label="Gross Profit" value={INR(grossProfit)} deltaTone={grossProfit >= 0 ? "up" : "down"} delta={grossProfit >= 0 ? "Healthy margin" : "Negative"} icon={TrendingUp} iconBg={T.emeraldWash} iconColor={T.emerald} />}
          {canSeeProfits && <KpiCard label="Net Profit" value={INR(netProfit)} deltaTone={netProfit >= 0 ? "up" : "down"} icon={netProfit >= 0 ? TrendingUp : TrendingDown} iconBg={netProfit >= 0 ? T.emeraldWash : T.redWash} iconColor={netProfit >= 0 ? T.emerald : T.red} />}
        </div>
      )}

      {(canSeeInventory || canSeeSales) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {canSeeInventory && <KpiCard label="Inventory Value" value={INR(inventoryValue)} icon={Boxes} iconBg={T.navyWash} iconColor={T.navy} />}
          {canSeeInventory && <KpiCard label="Low Stock Products" value={lowStock.length} deltaTone="down" icon={AlertTriangle} iconBg={T.amberWash} iconColor={T.amber} />}
          {canSeeSales && <KpiCard label="Customers" value={customers.length} icon={Users} iconBg={T.navyWash} iconColor={T.navy} />}
          {canSeeFinance && <KpiCard label="Vendors" value={vendors.length} icon={Truck} iconBg={T.navyWash} iconColor={T.navy} />}
        </div>
      )}

      {(canSeeSales || canSeeFinance) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <Card className="p-4 lg:col-span-2">
            <div className="text-sm font-semibold mb-3" style={{ color: T.ink }}>{canSeeFinance ? "Sales vs purchases trend (14 days)" : "Sales trend (14 days)"}</div>
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={salesTrend}>
                <defs><linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.navy} stopOpacity={0.28} /><stop offset="95%" stopColor={T.navy} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: T.inkFaint }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: T.inkFaint }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Sales" stroke={T.navy} fill="url(#salesGrad)" strokeWidth={2} />
                {canSeeFinance && <Line type="monotone" dataKey="Purchases" stroke={T.amber} strokeWidth={2} dot={false} />}
              </AreaChart>
            </ResponsiveContainer>
          </Card>
          {canSeeFinance && (
            <Card className="p-4">
              <div className="text-sm font-semibold mb-3" style={{ color: T.ink }}>Expense breakdown</div>
              {expensePie.length === 0 ? <EmptyState icon={Receipt} title="No expenses yet" /> : (
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart><Pie data={expensePie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>{expensePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip content={<CustomTooltip />} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart>
                </ResponsiveContainer>
              )}
            </Card>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {canSeeSales && (
          <Card className="p-4">
            <div className="text-sm font-semibold mb-3" style={{ color: T.ink }}>Top-selling products</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topProducts} layout="vertical" margin={{ left: 8 }}><CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} horizontal={false} /><XAxis type="number" tick={{ fontSize: 10, fill: T.inkFaint }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} /><YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: T.inkSoft }} axisLine={false} tickLine={false} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="value" fill={T.emerald} radius={[0, 4, 4, 0]} /></BarChart>
            </ResponsiveContainer>
          </Card>
        )}
        {canSeeFinance && (
          <Card className="p-4">
            <div className="text-sm font-semibold mb-3" style={{ color: T.ink }}>Receivables aging</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agingData}><CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10, fill: T.inkFaint }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10, fill: T.inkFaint }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="value" fill={T.amber} radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </Card>
        )}
        {canSeeInventory && (
          <Card className="p-4">
            <div className="text-sm font-semibold mb-3 flex items-center justify-between"><span style={{ color: T.ink }}>Low stock alerts</span><Badge tone="amber">{lowStock.length}</Badge></div>
            {lowStock.length === 0 ? <EmptyState icon={CheckCircle2} title="All stock levels healthy" /> : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {lowStock.map((p) => <div key={p.id} className="flex items-center justify-between text-xs py-1.5" style={{ borderBottom: `1px solid ${T.borderSoft}` }}><div><div className="font-medium" style={{ color: T.ink }}>{p.name}</div><div style={{ color: T.inkFaint }}>Reorder at {p.reorderLevel} {p.unit}</div></div><Badge tone="red">{p.currentStock} left</Badge></div>)}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
