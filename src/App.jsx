/**
 * App.jsx
 * -------------------------------------------------------------------------
 * The application shell. This file owns:
 *   1. Auth session bootstrap (is anyone logged in?)
 *   2. Loading the current user's `profiles` row (are they allowed in, and
 *      what role/company do they belong to?)
 *   3. Loading all of that company's data ONCE after login (products,
 *      customers, invoices, ...) into React state
 *   4. The layout — sidebar, header, tab switching
 *   5. A handful of small "derived data" helpers (invoiceTotals,
 *      customerOutstanding, etc.) that every page needs, computed here so
 *      each page doesn't reimplement the same math
 *   6. Cross-cutting concerns: the audit-log writer (logAudit), the
 *      idle-timeout auto sign-out, and the sample-data loader
 *
 * It does NOT contain any page's actual UI or business logic — that all
 * lives in src/pages/*.jsx. Every page receives one `ctx` object (built
 * near the bottom of this file) containing all the shared state and
 * helper functions, so pages don't need individual prop drilling.
 *
 * FOLDER MAP — where to find things:
 *   src/lib/constants.js   design tokens (T), dropdown lists, ROLES, NAV
 *   src/lib/format.js      INR formatting, dates, uid(), amount-in-words
 *   src/lib/dateRange.js   date-range dropdown -> {start,end} helper
 *   src/lib/taxEngine.js   the GST calculation (computeInvoiceTotals)
 *   src/lib/db.js          all Supabase CRUD + file upload helpers
 *   src/components/*       shared, reusable UI (buttons, modals, cards...)
 *   src/auth/*             login screen, change-password, "no profile" screen
 *   src/pages/*            one file per sidebar tab
 *
 * To add a brand-new page/tab:
 *   1. Create src/pages/YourModule.jsx (copy the shape of an existing one)
 *   2. Add its nav entry to NAV in lib/constants.js
 *   3. Add its id to whichever roles' `tabs` array should see it
 *   4. Import it below and add `{tab === "yourTab" && <YourModule ctx={ctx} />}`
 * -------------------------------------------------------------------------
 */
import React, { useState, useEffect, useCallback } from "react";
import { Loader2, Building2, AlertTriangle, LogOut, KeyRound, Database } from "lucide-react";

import { T, ROLES, NAV } from "./lib/constants";
import { uid, todayISO } from "./lib/format";
import { computeInvoiceTotals } from "./lib/taxEngine";
import { fetchTable, fetchOne, insertRow, updateRow, adjustStockRpc } from "./lib/db";
import { supabase } from "./supabaseClient";

import { Card, Btn } from "./components/ui";
import GlobalSearch from "./components/GlobalSearch";
import NotificationsBell from "./components/NotificationsBell";

import LoginScreen from "./auth/LoginScreen";
import NoProfileScreen from "./auth/NoProfileScreen";
import ChangePasswordModal from "./auth/ChangePasswordModal";

import Dashboard from "./pages/Dashboard";
import AnalyticsModule from "./pages/AnalyticsModule";
import SalesModule from "./pages/SalesModule";
import PurchasesModule from "./pages/PurchasesModule";
import InventoryModule from "./pages/InventoryModule";
import PartyModule from "./pages/PartyModule";
import PaymentsModule from "./pages/PaymentsModule";
import ExpensesModule from "./pages/ExpensesModule";
import ReportsModule from "./pages/ReportsModule";
import SettingsModule from "./pages/SettingsModule";
import UsersAuditModule from "./pages/UsersAuditModule";

// Fires a "Login" audit entry exactly once per browser session (not on
// every re-render, which happens constantly while React is loading data).
let __loginLoggedFor = null;
function logAuditOnce(profile, logAudit) {
  if (profile && __loginLoggedFor !== profile.id) {
    __loginLoggedFor = profile.id;
    logAudit("Login", `${profile.name} (${profile.role}) signed in`);
  }
}

export default function App() {
  // ---- auth / session state ----
  const [session, setSession] = useState(undefined); // undefined = still checking, null = signed out
  const [profile, setProfile] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");

  // ---- all business data, loaded once per login (see the effect below) ----
  const [company, setCompany] = useState(null);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [stockLedger, setStockLedger] = useState([]);
  const [users, setUsers] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [globalFocus, setGlobalFocus] = useState(null); // { tab, value } — consumed by the target page's own search box
  const [showChangePw, setShowChangePw] = useState(false);

  // ---- 1. session bootstrap: is anyone logged in? ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      // Ignore duplicate events for the SAME user (re-sign-in used by the
      // change-password verifier, silent token refreshes). Swapping the
      // session object here would tear down the whole app mid-action.
      setSession((prev) => {
        if (prev && sess && prev.user?.id === sess.user?.id) return prev;
        return sess;
      });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // ---- 2 & 3. once we have a session, load the profile, then all company data ----
  useEffect(() => {
    if (session === undefined) return; // still checking
    if (session === null) { setProfile(null); setDataLoading(false); return; }
    (async () => {
      setDataLoading(true);
      const prof = await fetchOne("profiles", session.user.id);
      if (!prof || prof.status !== "Active") { setProfile(null); setDataLoading(false); return; }
      setProfile({ ...prof, email: session.user.email });

      const [comp, prod, cust, vend, inv, pur, exp, pay, ledger, usrs, logs] = await Promise.all([
        fetchOne("companies", prof.companyId),
        fetchTable("products", "name", true),
        fetchTable("customers", "name", true),
        fetchTable("vendors", "name", true),
        fetchTable("invoices"),
        fetchTable("purchases"),
        fetchTable("expenses"),
        fetchTable("payments"),
        fetchTable("stock_ledger"),
        fetchTable("profiles", "name", true),
        fetchTable("audit_log", "timestamp", false),
      ]);
      setCompany(comp); setProducts(prod); setCustomers(cust); setVendors(vend);
      setInvoices(inv); setPurchases(pur); setExpenses(exp); setPayments(pay);
      setStockLedger(ledger); setUsers(usrs); setAuditLog(logs);
      setDataLoading(false);
    })();
  }, [session]);

  // ---- 5. shared "derived data" helpers, used by many pages ----
  const logAudit = useCallback(async (action, details) => {
    if (!profile || !company) return;
    try {
      const row = await insertRow("audit_log", { id: uid(), companyId: company.id, userId: profile.id, userName: profile.name, role: profile.role, action, details, timestamp: new Date().toISOString() });
      setAuditLog((prev) => [row, ...prev]);
    } catch (e) { console.error("audit log failed", e); }
  }, [profile, company]);

  const getCustomer = useCallback((id) => customers.find((c) => c.id === id), [customers]);
  const getVendor = useCallback((id) => vendors.find((v) => v.id === id), [vendors]);
  const getProduct = useCallback((id) => products.find((p) => p.id === id), [products]);
  // Every invoice total goes through here — see lib/taxEngine.js for the actual GST math.
  const invoiceTotals = useCallback((inv) => computeInvoiceTotals(inv.items, products, company?.state, getCustomer(inv.customerId)?.state, inv.taxType || "auto"), [products, company, getCustomer]);
  const invoicePaid = useCallback((inv) => inv.status === "Paid" ? invoiceTotals(inv).grandTotal : (inv.status === "Cancelled" ? 0 : (inv.paidAmount || 0)), [invoiceTotals]);
  const invoiceBalance = useCallback((inv) => (inv.status === "Cancelled" || inv.status === "Draft") ? 0 : Math.max(0, invoiceTotals(inv).grandTotal - invoicePaid(inv)), [invoiceTotals, invoicePaid]);
  const customerOutstanding = useCallback((custId) => invoices.filter((i) => i.customerId === custId && i.status !== "Draft" && i.status !== "Cancelled").reduce((s, i) => s + invoiceBalance(i), 0), [invoices, invoiceBalance]);
  const purchaseTotal = useCallback((pur) => pur.items.reduce((s, it) => { const prod = getProduct(it.productId); const gross = it.qty * it.rate; const gst = prod ? (gross * prod.gstRate) / 100 : 0; return s + gross + gst; }, 0), [getProduct]);
  const vendorOutstanding = useCallback((vendorId) => purchases.filter((p) => p.vendorId === vendorId && p.status !== "Paid").reduce((s, p) => s + purchaseTotal(p), 0), [purchases, purchaseTotal]);

  // Writes a stock_ledger row AND updates the product's currentStock.
  // Prefers the atomic adjust_stock() RPC (one transaction, safe under
  // concurrent saves); falls back to two client-side calls if the patch
  // hasn't been applied to the database yet.
  const adjustStock = async (productId, delta, type, refId) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    try {
      const usedRpc = await adjustStockRpc(productId, delta, type, refId);
      if (!usedRpc) {
        await updateRow("products", productId, { currentStock: prod.currentStock + delta });
        await insertRow("stock_ledger", { id: uid(), companyId: company.id, productId, date: todayISO(), type, qty: delta, refId });
      }
      setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, currentStock: p.currentStock + delta } : p));
      setStockLedger((prev) => [{ id: uid(), companyId: company.id, productId, date: todayISO(), type, qty: delta, refId }, ...prev]);
    } catch (e) { console.error("adjustStock failed", e); throw e; }
  };

  // Inserts the bundled demo dataset (src/sampleData.js) into the live database.
  // Only offered to the Owner, and only when the database looks empty — see Dashboard.jsx.
  const loadSampleData = async () => {
    if (!confirm("This will insert demo products, customers, vendors and a few invoices into your live database. Continue?")) return;
    try {
      const { seedProducts, seedCustomers, seedVendors } = await import("./sampleData.js");
      for (const p of seedProducts()) { const row = await insertRow("products", { ...p, id: uid(), companyId: company.id }); setProducts((prev) => [row, ...prev]); }
      for (const c of seedCustomers()) { const row = await insertRow("customers", { ...c, id: uid(), companyId: company.id }); setCustomers((prev) => [row, ...prev]); }
      for (const v of seedVendors()) { const row = await insertRow("vendors", { ...v, id: uid(), companyId: company.id }); setVendors((prev) => [row, ...prev]); }
      logAudit("Sample data loaded", "Owner inserted demo products, customers and vendors");
    } catch (e) { alert("Could not load sample data: " + e.message); }
  };

  // Which sidebar tabs the current role can see (UI convenience — see the
  // note in lib/constants.js about ROLES; the real security is RLS).
  const role = profile?.role || "Sales";
  const visibleTabs = ROLES[role].tabs === "*" ? NAV.map((n) => n.id) : ROLES[role].tabs;
  useEffect(() => { if (!visibleTabs.includes(tab)) setTab(visibleTabs[0]); }, [role]); // eslint-disable-line

  const handleSignOut = async () => { await logAudit("Logout", `${profile.name} signed out`); await supabase.auth.signOut(); };

  // Security: automatically sign out after 20 minutes of inactivity, so an
  // unattended device doesn't stay logged into business data indefinitely.
  const IDLE_LIMIT_MS = 20 * 60 * 1000;
  useEffect(() => {
    if (!profile) return;
    let idleTimer;
    const resetTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(async () => {
        await logAudit("Auto sign-out", "Signed out automatically after 20 minutes of inactivity");
        await supabase.auth.signOut();
        alert("You were signed out due to inactivity, for security.");
      }, IDLE_LIMIT_MS);
    };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((ev) => window.addEventListener(ev, resetTimer));
    resetTimer();
    return () => { clearTimeout(idleTimer); events.forEach((ev) => window.removeEventListener(ev, resetTimer)); };
  }, [profile]); // eslint-disable-line

  // ---- render: one gate at a time (loading -> logged out -> no profile -> no company -> the app) ----
  if (session === undefined || (session && dataLoading)) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg }}><Loader2 className="animate-spin" color={T.navy} size={28} /></div>;
  }
  if (!session) {
    return <LoginScreen onLoggedIn={() => {}} />;
  }
  if (!profile) {
    return <NoProfileScreen email={session.user.email} onSignOut={() => supabase.auth.signOut()} />;
  }
  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: T.bg }}>
        <Card className="p-6 max-w-sm text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: T.redWash }}><Database size={20} color={T.red} /></div>
          <div className="font-semibold text-sm mb-1" style={{ color: T.ink }}>No company record found</div>
          <div className="text-xs mb-4" style={{ color: T.inkFaint }}>Your profile points to a company that doesn't exist in the <code>companies</code> table. Check the deployment guide's setup steps.</div>
          <Btn variant="secondary" onClick={() => supabase.auth.signOut()}>Sign out</Btn>
        </Card>
      </div>
    );
  }

  logAuditOnce(profile, logAudit);

  // 6. The ctx object every page receives — this is the "API" between
  // App.jsx and src/pages/*.jsx. If a page needs new shared data or a new
  // helper function, add it here rather than passing individual props.
  const ctx = {
    company, setCompany, products, setProducts, customers, setCustomers, vendors, setVendors,
    invoices, setInvoices, purchases, setPurchases, expenses, setExpenses, payments, setPayments,
    stockLedger, getCustomer, getVendor, getProduct, invoiceTotals, invoicePaid, invoiceBalance,
    customerOutstanding, purchaseTotal, vendorOutstanding, adjustStock, role, currentUser: profile,
    users, setUsers, auditLog, logAudit, loadSampleData, globalFocus, setGlobalFocus,
  };

  return (
    <div className="min-h-screen flex" style={{ background: T.bg, fontFamily: "Inter, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lexend:wght@500;600;700&display=swap');`}</style>

      {/* ---------- sidebar ---------- */}
      <aside className="w-60 shrink-0 hidden md:flex flex-col" style={{ background: T.navy }}>
        <div className="px-5 py-5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)" }}><Building2 size={16} color="#fff" /></div>
          <div><div className="text-white font-semibold text-sm leading-tight" style={{ fontFamily: "Lexend, sans-serif" }}>{company.name}</div><div className="text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>GST ERP · India</div></div>
        </div>
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {NAV.filter((n) => visibleTabs.includes(n.id)).map((n) => {
            const active = tab === n.id;
            return <button key={n.id} onClick={() => setTab(n.id)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors" style={{ background: active ? "rgba(255,255,255,0.14)" : "transparent", color: active ? "#fff" : "rgba(255,255,255,0.65)" }}><n.icon size={16} />{n.label}</button>;
          })}
        </nav>
        <div className="px-4 py-4 text-[11px]" style={{ color: "rgba(255,255,255,0.4)", borderTop: "1px solid rgba(255,255,255,0.1)" }}>Connected to Supabase</div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* ---------- header ---------- */}
        <header className="flex items-center justify-between px-6 py-3.5" style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
          <GlobalSearch ctx={ctx} onNavigate={(t, focus) => { setTab(t); setGlobalFocus({ tab: t, value: focus }); }} />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg" style={{ background: T.amberWash, color: T.amber }}><AlertTriangle size={13} />{products.filter((p) => p.currentStock <= p.reorderLevel).length} low stock</div>
            <NotificationsBell ctx={ctx} />
            <div className="flex items-center gap-2 pl-3" style={{ borderLeft: `1px solid ${T.border}` }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: T.navyWash, color: T.navy }}>{profile.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</div>
              <div className="hidden sm:block leading-tight"><div className="text-xs font-medium" style={{ color: T.ink }}>{profile.name}</div><div className="text-[11px]" style={{ color: T.inkFaint }}>{ROLES[role].label}</div></div>
              <button title="Change password" onClick={() => setShowChangePw(true)} className="p-1.5 rounded-lg hover:bg-gray-100"><KeyRound size={15} color={T.inkSoft} /></button>
              <button title="Log out" onClick={handleSignOut} className="p-1.5 rounded-lg hover:bg-gray-100"><LogOut size={15} color={T.inkSoft} /></button>
            </div>
          </div>
        </header>
        <ChangePasswordModal open={showChangePw} onClose={() => setShowChangePw(false)} logAudit={logAudit} email={profile.email} />

        {/* ---------- mobile tab bar ---------- */}
        <div className="md:hidden flex gap-1 overflow-x-auto px-3 py-2" style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
          {NAV.filter((n) => visibleTabs.includes(n.id)).map((n) => <button key={n.id} onClick={() => setTab(n.id)} className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: tab === n.id ? T.navy : T.borderSoft, color: tab === n.id ? "#fff" : T.inkSoft }}>{n.label}</button>)}
        </div>

        {/* ---------- page content: exactly one of these renders based on `tab` ---------- */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {tab === "dashboard" && <Dashboard ctx={ctx} />}
          {tab === "sales" && <SalesModule ctx={ctx} />}
          {tab === "purchases" && <PurchasesModule ctx={ctx} />}
          {tab === "inventory" && <InventoryModule ctx={ctx} />}
          {tab === "customers" && <PartyModule ctx={ctx} kind="customer" />}
          {tab === "vendors" && <PartyModule ctx={ctx} kind="vendor" />}
          {tab === "payments" && <PaymentsModule ctx={ctx} />}
          {tab === "expenses" && <ExpensesModule ctx={ctx} />}
          {tab === "reports" && <ReportsModule ctx={ctx} />}
          {tab === "analytics" && <AnalyticsModule ctx={ctx} />}
          {tab === "settings" && <SettingsModule ctx={ctx} />}
          {tab === "users" && <UsersAuditModule ctx={ctx} />}
        </main>
      </div>
    </div>
  );
}
