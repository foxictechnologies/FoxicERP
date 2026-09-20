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
import { Loader2, AlertTriangle, LogOut, KeyRound, Database } from "lucide-react";
import foxicLogo from "./assets/foxic-logo.png";

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
import TicketsModule from "./pages/TicketsModule";
import TasksModule from "./pages/TasksModule";
import InboxModule from "./pages/InboxModule";

// Fires a "Login" audit entry exactly once per browser session (not on
// every re-render, which happens constantly while React is loading data).
let __loginLoggedFor = null;
function logAuditOnce(profile, logAudit) {
  if (profile && __loginLoggedFor !== profile.id) {
    __loginLoggedFor = profile.id;
    logAudit("Login", `${profile.name} (${profile.role}) signed in`);
  }
}

// ⚠️  TESTING MODE — set to false to re-enable real Supabase login
const TESTING_MODE = false;

const FAKE_SESSION = { user: { id: "test-user-id", email: "test@demo.com" } };
const FAKE_PROFILE = {
  id: "test-user-id",
  name: "Demo User",
  role: "Owner",
  status: "Active",
  companyId: "test-company-id",
  email: "test@demo.com",
};
const FAKE_COMPANY = {
  id: "test-company-id",
  name: "Demo Company Pvt Ltd",
  state: "Maharashtra",
  gstin: "27AABCU9603R1ZX",
  address: "123 Test Street, Mumbai",
  phone: "9999999999",
  email: "demo@company.com",
};

export default function App() {
  // ---- auth / session state ----
  const [session, setSession] = useState(TESTING_MODE ? FAKE_SESSION : undefined); // undefined = still checking, null = signed out
  const [profile, setProfile] = useState(TESTING_MODE ? FAKE_PROFILE : null);
  const [dataLoading, setDataLoading] = useState(TESTING_MODE ? false : true);
  const [tab, setTab] = useState("dashboard");

  // ---- all business data, loaded once per login (see the effect below) ----
  const [company, setCompany] = useState(TESTING_MODE ? FAKE_COMPANY : null);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [stockLedger, setStockLedger] = useState([]);
  const [users, setUsers] = useState(TESTING_MODE ? [FAKE_PROFILE] : []);
  const [auditLog, setAuditLog] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [emails, setEmails] = useState([]);
  const [globalFocus, setGlobalFocus] = useState(null); // { tab, value } — consumed by the target page's own search box
  const [showChangePw, setShowChangePw] = useState(false);

  // ---- 1. session bootstrap: is anyone logged in? ----
  useEffect(() => {
    if (TESTING_MODE) return; // skip real auth in testing mode
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
    if (TESTING_MODE) return; // skip DB fetch in testing mode
    if (session === undefined) return; // still checking
    if (session === null) { setProfile(null); setDataLoading(false); return; }
    (async () => {
      setDataLoading(true);
      const prof = await fetchOne("profiles", session.user.id);
      if (!prof || prof.status !== "Active") { setProfile(null); setDataLoading(false); return; }
      setProfile({ ...prof, email: session.user.email });

      const [
        comp,
        prod,
        cust,
        vend,
        inv,
        pur,
        exp,
        pay,
        ledger,
        usrs,
        logs,
        tix,
        tsk,
        em,
      ] = await Promise.all([
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
        fetchTable("tickets", "created_at", false),
        fetchTable("tasks", "created_at", false),
        fetchTable("emails", "received_at", false),
      ]);
      setCompany(comp); setProducts(prod); setCustomers(cust); setVendors(vend);
      setInvoices(inv); setPurchases(pur); setExpenses(exp); setPayments(pay);
      setStockLedger(ledger);
      setUsers(usrs);
      setAuditLog(logs);
      setTickets(tix);
      let localTasks = [];
      try {
        const storedTasks = localStorage.getItem("erp_tasks");
        if (storedTasks) {
          const parsed = JSON.parse(storedTasks);
          if (Array.isArray(parsed)) localTasks = parsed;
        }
      } catch (e) {}

      const taskMap = new Map();
      localTasks.forEach((t) => { if (t?.id) taskMap.set(t.id, t); });
      if (tsk && Array.isArray(tsk)) {
        tsk.forEach((t) => { if (t?.id) taskMap.set(t.id, t); });
      }
      setTasks(Array.from(taskMap.values()));

      if (em && em.length > 0) {
        setEmails(em);
      } else {
        // Fetch live from Hostinger Mail API backend
        try {
          const syncRes = await fetch("/api/mail/sync", { method: "POST" });
          const syncData = await syncRes.json();
          if (syncData.success && Array.isArray(syncData.emails)) {
            setEmails(syncData.emails);
          }
        } catch (e) {
          // ignore
        }
      }
      setDataLoading(false);
    })();
  }, [session]);

  // Sync tasks to local storage for offline resilience
  useEffect(() => {
    try {
      if (tasks && tasks.length > 0) {
        localStorage.setItem("erp_tasks", JSON.stringify(tasks));
      }
    } catch (e) {
      // ignore
    }
  }, [tasks]);

  // =====================================================
// REAL-TIME TICKET UPDATES
// =====================================================

useEffect(() => {
  if (!profile?.companyId) return;

  const channel = supabase
    .channel(`tickets-${profile.companyId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "tickets",
        filter: `company_id=eq.${profile.companyId}`,
      },
      (payload) => {
        console.log("NEW TICKET:", payload.new);

        const ticket = {
          id: payload.new.id,
          companyId: payload.new.company_id,
          ticketNumber: payload.new.ticket_number,
          name: payload.new.name,
          email: payload.new.email,
          phone: payload.new.phone,
          subject: payload.new.subject,
          message: payload.new.message,
          source: payload.new.source,
          status: payload.new.status,
          priority: payload.new.priority,
          assignedTo: payload.new.assigned_to,
          attachment: payload.new.attachment,
          createdAt: payload.new.created_at,
          updatedAt: payload.new.updated_at,
        };

        setTickets((prev) => {
          if (prev.some((t) => t.id === ticket.id)) {
            return prev;
          }

          return [ticket, ...prev];
        });
      }
    )
    .subscribe((status) => {
      console.log("TICKET REALTIME:", status);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}, [profile?.companyId]);

// =====================================================
// REAL-TIME TASK UPDATES
// =====================================================

useEffect(() => {
  if (!profile?.companyId) return;

  const channel = supabase
    .channel(`tasks-${profile.companyId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "tasks",
        filter: `company_id=eq.${profile.companyId}`,
      },
      (payload) => {
        if (payload.eventType === "INSERT") {
          const task = {
            id: payload.new.id,
            companyId: payload.new.company_id,
            title: payload.new.title,
            description: payload.new.description,
            status: payload.new.status,
            priority: payload.new.priority,
            category: payload.new.category,
            assignedTo: payload.new.assigned_to,
            createdBy: payload.new.created_by,
            dueDate: payload.new.due_date,
            attachment: payload.new.attachment,
            createdAt: payload.new.created_at,
            updatedAt: payload.new.updated_at,
          };
          setTasks((prev) => {
            if (prev.some((t) => t.id === task.id)) {
              return prev.map((t) => (t.id === task.id ? task : t));
            }
            return [task, ...prev];
          });
        } else if (payload.eventType === "UPDATE") {
          const task = {
            id: payload.new.id,
            companyId: payload.new.company_id,
            title: payload.new.title,
            description: payload.new.description,
            status: payload.new.status,
            priority: payload.new.priority,
            category: payload.new.category,
            assignedTo: payload.new.assigned_to,
            createdBy: payload.new.created_by,
            dueDate: payload.new.due_date,
            attachment: payload.new.attachment,
            createdAt: payload.new.created_at,
            updatedAt: payload.new.updated_at,
          };
          setTasks((prev) =>
            prev.map((t) => (t.id === task.id ? task : t))
          );
        } else if (payload.eventType === "DELETE") {
          setTasks((prev) => prev.filter((t) => t.id !== payload.old?.id));
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [profile?.companyId]);

// =====================================================
// REAL-TIME EMAIL UPDATES (info@foxic.in)
// =====================================================
useEffect(() => {
  if (!profile?.companyId) return;

  const channel = supabase
    .channel(`emails-${profile.companyId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "emails",
        filter: `company_id=eq.${profile.companyId}`,
      },
      (payload) => {
        if (payload.eventType === "INSERT") {
          setEmails((prev) => {
            const exists = prev.some((e) => e.id === payload.new.id);
            if (exists) return prev;
            return [payload.new, ...prev];
          });
        } else if (payload.eventType === "UPDATE") {
          setEmails((prev) =>
            prev.map((e) => (e.id === payload.new.id ? { ...e, ...payload.new } : e))
          );
        } else if (payload.eventType === "DELETE") {
          setEmails((prev) => prev.filter((e) => e.id !== payload.old?.id));
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [profile?.companyId]);

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
  if (!TESTING_MODE && (session === undefined || (session && dataLoading))) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg }}><Loader2 className="animate-spin" color={T.navy} size={28} /></div>;
  }
  if (!TESTING_MODE && !session) {
    return <LoginScreen onLoggedIn={(sess) => setSession(sess)} />;
  }
  if (!TESTING_MODE && !profile) {
    return <NoProfileScreen email={session.user.email} onSignOut={() => supabase.auth.signOut()} />;
  }
  if (!TESTING_MODE && !company) {
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
  // In testing mode use fake company if no real company loaded
  const activeCompany = TESTING_MODE ? FAKE_COMPANY : company;
  const ctx = {
    company: activeCompany,
    setCompany,
  
    products,
    setProducts,
  
    customers,
    setCustomers,
  
    vendors,
    setVendors,
  
    invoices,
    setInvoices,
  
    purchases,
    setPurchases,
  
    expenses,
    setExpenses,
  
    payments,
    setPayments,
  
    stockLedger,
  
    tickets,
    setTickets,

    tasks,
    setTasks,

    emails,
    setEmails,

    setActiveTab: setTab,
    toast: {
      show: (msg, type) => {
        // Can integrate with UI notification or console
        console.log(`[Toast ${type || "info"}]: ${msg}`);
      }
    },
  
    getCustomer,
    getVendor,
    getProduct,
  
    invoiceTotals,
    invoicePaid,
    invoiceBalance,
  
    customerOutstanding,
    purchaseTotal,
    vendorOutstanding,
  
    adjustStock,
  
    role,
    currentUser: profile,
  
    users,
    setUsers,
  
    auditLog,
    logAudit,
  
    loadSampleData,
  
    globalFocus,
    setGlobalFocus,
  };
  return (
    <div
      className="min-h-screen flex"
      style={{
        background: T.bg,
        color: T.ink,
      }}
    >

      {/* =====================================================
          DESKTOP SIDEBAR
          ===================================================== */}

      <aside
        className="
          hidden
          md:flex
          w-[248px]
          shrink-0
          flex-col
          relative
          z-30
        "
        style={{
          background: "rgba(245,245,247,0.82)",
          borderRight: `1px solid ${T.border}`,
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
        }}
      >

        {/* Brand */}

        <div className="px-5 pt-6 pb-5">

          <div className="flex items-center gap-3">

            <div
              className="
                w-10
                h-10
                rounded-[12px]
                overflow-hidden
                flex
                items-center
                justify-center
                shrink-0
                bg-black
              "
              style={{
                boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
                border: "1px solid rgba(0,0,0,0.08)",
              }}
            >
              <img
                src={foxicLogo}
                alt={company?.name || "foxic"}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="min-w-0">

              <div
                className="
                  text-sm
                  font-semibold
                  truncate
                  tracking-[-0.02em]
                "
              >
                {company.name}
              </div>

              <div
                className="
                  text-[10px]
                  mt-0.5
                  font-medium
                  tracking-[0.04em]
                  uppercase
                "
                style={{
                  color: T.inkFaint,
                }}
              >
                Business OS
              </div>

            </div>

          </div>

        </div>


        {/* Navigation */}

        <nav
          className="
            flex-1
            px-3
            py-2
            overflow-y-auto
          "
        >

          <div
            className="
              px-3
              mb-2
              text-[10px]
              font-semibold
              uppercase
              tracking-[0.08em]
            "
            style={{
              color: T.inkFaint,
            }}
          >
            Workspace
          </div>


          <div className="space-y-1">

            {NAV
              .filter((n) =>
                visibleTabs.includes(n.id)
              )
              .map((n) => {

                const active = tab === n.id;

                return (
                  <button
                    key={n.id}
                    onClick={() => setTab(n.id)}
                    className="
                      group
                      relative
                      w-full
                      flex
                      items-center
                      gap-3
                      px-3
                      py-2.5
                      rounded-xl
                      text-sm
                      font-medium
                      text-left
                    "
                    style={{
                      color: active
                        ? T.ink
                        : T.inkSoft,

                      background: active
                        ? T.surface
                        : "transparent",

                      boxShadow: active
                        ? "0 1px 4px rgba(0,0,0,0.06)"
                        : "none",

                      border: active
                        ? `1px solid ${T.border}`
                        : "1px solid transparent",

                      transition:
                        "all 220ms cubic-bezier(.22,1,.36,1)",
                    }}
                  >

                    {/* Active indicator */}

                    {active && (
                      <span
                        className="
                          absolute
                          left-0
                          top-1/2
                          -translate-y-1/2
                          w-[3px]
                          h-5
                          rounded-r-full
                        "
                        style={{
                          background: T.navy,
                        }}
                      />
                    )}

                    <n.icon
                      size={17}
                      strokeWidth={active ? 2 : 1.7}
                      style={{
                        color: active
                          ? T.navy
                          : T.inkFaint,

                        transition:
                          "transform 200ms ease",
                      }}
                      className="
                        group-hover:translate-x-[1px]
                      "
                    />

                    <span className="truncate">
                      {n.label}
                    </span>

                  </button>
                );
              })}

          </div>

        </nav>


        {/* Connection status */}

        <div className="px-4 pb-4">

          <div
            className="
              rounded-xl
              px-3
              py-2.5
              flex
              items-center
              gap-2.5
            "
            style={{
              background:
                "rgba(36,138,61,0.06)",
              border:
                "1px solid rgba(36,138,61,0.10)",
            }}
          >

            <span className="relative flex h-2 w-2">

              <span
                className="
                  absolute
                  inline-flex
                  h-full
                  w-full
                  rounded-full
                  opacity-60
                  apple-pulse
                "
                style={{
                  background: T.emerald,
                }}
              />

              <span
                className="
                  relative
                  inline-flex
                  rounded-full
                  h-2
                  w-2
                "
                style={{
                  background: T.emerald,
                }}
              />

            </span>

            <span
              className="
                text-[10px]
                font-medium
              "
              style={{
                color: T.emerald,
              }}
            >
              Connected
            </span>

          </div>

        </div>

      </aside>


      {/* =====================================================
          MAIN APPLICATION
          ===================================================== */}

      <div
        className="
          flex-1
          min-w-0
          flex
          flex-col
        "
      >

        {/* ===================================================
            HEADER
            =================================================== */}

        <header
          className="
            sticky
            top-0
            z-20
            h-[68px]
            flex
            items-center
            justify-between
            px-4
            md:px-7
          "
          style={{
            background:
              "rgba(245,245,247,0.78)",
            borderBottom:
              `1px solid ${T.border}`,
            backdropFilter:
              "blur(22px) saturate(180%)",
            WebkitBackdropFilter:
              "blur(22px) saturate(180%)",
          }}
        >

          {/* Search */}

          <div className="min-w-0 flex-1">

            <GlobalSearch
              ctx={ctx}
              onNavigate={(t, focus) => {
                setTab(t);
                setGlobalFocus({
                  tab: t,
                  value: focus,
                });
              }}
            />

          </div>


          {/* Right controls */}

          <div
            className="
              flex
              items-center
              gap-2
              ml-4
            "
          >

            {/* Low stock */}

            <button
              onClick={() => setTab("inventory")}
              className="
                hidden
                sm:flex
                items-center
                gap-2
                px-3
                py-2
                rounded-xl
                text-xs
                font-medium
                hover:-translate-y-[1px]
              "
              style={{
                background:
                  T.amberWash,
                color: T.amber,
                border:
                  "1px solid rgba(176,109,0,0.10)",
              }}
            >

              <AlertTriangle
                size={13}
                strokeWidth={1.8}
              />

              <span>
                {products.filter(
                  (p) =>
                    p.currentStock <=
                    p.reorderLevel
                ).length}
              </span>

              <span className="hidden lg:inline">
                low stock
              </span>

            </button>


            {/* Notifications */}

            <NotificationsBell ctx={ctx} />


            {/* User */}

            <div
              className="
                flex
                items-center
                gap-2
                ml-1
                pl-3
              "
              style={{
                borderLeft:
                  `1px solid ${T.border}`,
              }}
            >

              {/* Avatar */}

              <div
                className="
                  w-9
                  h-9
                  rounded-full
                  flex
                  items-center
                  justify-center
                  text-xs
                  font-semibold
                  shrink-0
                "
                style={{
                  background: T.ink,
                  color: "#fff",
                  boxShadow:
                    "0 2px 8px rgba(0,0,0,0.12)",
                }}
              >
                {profile.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
              </div>


              {/* User details */}

              <div className="hidden lg:block leading-tight">

                <div
                  className="
                    text-xs
                    font-semibold
                    truncate
                    max-w-[120px]
                  "
                  style={{
                    color: T.ink,
                  }}
                >
                  {profile.name}
                </div>

                <div
                  className="
                    text-[10px]
                    mt-0.5
                  "
                  style={{
                    color: T.inkFaint,
                  }}
                >
                  {ROLES[role].label}
                </div>

              </div>


              {/* Change password */}

              <button
                title="Change password"
                onClick={() =>
                  setShowChangePw(true)
                }
                className="
                  w-8
                  h-8
                  rounded-full
                  flex
                  items-center
                  justify-center
                  hover:bg-black/[0.05]
                  active:scale-90
                "
              >
                <KeyRound
                  size={15}
                  color={T.inkSoft}
                  strokeWidth={1.8}
                />
              </button>


              {/* Logout */}

              <button
                title="Log out"
                onClick={handleSignOut}
                className="
                  w-8
                  h-8
                  rounded-full
                  flex
                  items-center
                  justify-center
                  hover:bg-red-500/[0.06]
                  active:scale-90
                "
              >
                <LogOut
                  size={15}
                  color={T.inkSoft}
                  strokeWidth={1.8}
                />
              </button>

            </div>

          </div>

        </header>


        {/* Change password */}

        <ChangePasswordModal
          open={showChangePw}
          onClose={() =>
            setShowChangePw(false)
          }
          logAudit={logAudit}
          email={profile.email}
        />


        {/* ===================================================
            MOBILE NAVIGATION
            =================================================== */}

        <div
          className="
            md:hidden
            sticky
            top-[68px]
            z-10
            flex
            gap-1.5
            overflow-x-auto
            px-3
            py-2.5
          "
          style={{
            background:
              "rgba(245,245,247,0.88)",
            borderBottom:
              `1px solid ${T.border}`,
            backdropFilter:
              "blur(20px)",
            WebkitBackdropFilter:
              "blur(20px)",
          }}
        >

          {NAV
            .filter((n) =>
              visibleTabs.includes(n.id)
            )
            .map((n) => {

              const active = tab === n.id;

              return (
                <button
                  key={n.id}
                  onClick={() => setTab(n.id)}
                  className="
                    shrink-0
                    px-3.5
                    py-2
                    rounded-full
                    text-xs
                    font-medium
                    transition-all
                  "
                  style={{
                    background: active
                      ? T.ink
                      : T.surface,

                    color: active
                      ? "#fff"
                      : T.inkSoft,

                    border: active
                      ? "1px solid transparent"
                      : `1px solid ${T.border}`,

                    boxShadow: active
                      ? "0 2px 8px rgba(0,0,0,0.10)"
                      : "none",
                  }}
                >
                  {n.label}
                </button>
              );
            })}

        </div>


        {/* ===================================================
            PAGE CONTENT
            =================================================== */}

        <main
          className="
            flex-1
            overflow-y-auto
            px-4
            py-5
            md:px-7
            md:py-7
          "
        >

          <div
            key={tab}
            className="
              max-w-[1600px]
              mx-auto
              apple-enter
            "
          >

            {tab === "dashboard" && (
              <Dashboard ctx={ctx} />
            )}

            {tab === "inbox" && (
              <InboxModule ctx={ctx} />
            )}

            {tab === "sales" && (
              <SalesModule ctx={ctx} />
            )}

            {tab === "purchases" && (
              <PurchasesModule ctx={ctx} />
            )}

            {tab === "inventory" && (
              <InventoryModule ctx={ctx} />
            )}

            {tab === "customers" && (
              <PartyModule
                ctx={ctx}
                kind="customer"
              />
            )}

            {tab === "vendors" && (
              <PartyModule
                ctx={ctx}
                kind="vendor"
              />
            )}

            {tab === "payments" && (
              <PaymentsModule ctx={ctx} />
            )}

            {tab === "expenses" && (
              <ExpensesModule ctx={ctx} />
            )}

            {tab === "reports" && (
              <ReportsModule ctx={ctx} />
            )}

            {tab === "analytics" && (
              <AnalyticsModule ctx={ctx} />
            )}

            {tab === "settings" && (
              <SettingsModule ctx={ctx} />
            )}

            {tab === "users" && (
              <UsersAuditModule ctx={ctx} />
            )}

{tab === "tickets" && (
  <TicketsModule ctx={ctx} />
)}

{tab === "tasks" && (
  <TasksModule ctx={ctx} />
)}

          </div>

        </main>

      </div>

    </div>
  );
}
