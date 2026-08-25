/**
 * constants.js
 * -------------------------------------------------------------------------
 * All the "fixed" values used across the app in one place:
 *  - T            design tokens (colors) used via inline styles everywhere
 *  - PIE_COLORS   palette for pie/donut charts
 *  - INDIAN_STATES / EXPENSE_CATEGORIES / DATE_RANGE_OPTIONS  dropdown lists
 *  - ROLES        which tabs each role (Owner/Accountant/Sales/Inventory)
 *                 is allowed to see. NOTE: this only controls what the UI
 *                 shows — the real security is the Postgres Row-Level
 *                 Security policies in supabase-schema.sql. Never rely on
 *                 this file alone to hide sensitive data.
 *  - NAV          the sidebar navigation list (id, label, icon)
 *
 * To add a new sidebar tab: add an entry to NAV, then add its id to the
 * `tabs` array of whichever roles should see it in ROLES.
 * -------------------------------------------------------------------------
 */

import {
  LayoutDashboard, FileText, Package, Users, Truck, CreditCard, Receipt,
  ShoppingCart, BarChart3, Settings as SettingsIcon, UserCog, CalendarRange
} from "lucide-react";

export const T = {
  ink: "#12161F", inkSoft: "#5B6472", inkFaint: "#8B93A1",
  bg: "#F5F6F8", surface: "#FFFFFF", border: "#E4E7EC", borderSoft: "#EEF0F3",
  navy: "#1D2B53", navyWash: "#EBEEF6",
  emerald: "#0F9D6D", emeraldWash: "#E4F6EF",
  amber: "#C4770A", amberWash: "#FBF0DD",
  red: "#C13B3B", redWash: "#FBEAEA",
};

export const PIE_COLORS = ["#1D2B53", "#0F9D6D", "#C4770A", "#6B4CA6", "#C13B3B", "#2E7D9A"];

export const INDIAN_STATES = ["Maharashtra", "Karnataka", "Delhi", "Gujarat", "Tamil Nadu", "Telangana",
  "West Bengal", "Uttar Pradesh", "Rajasthan", "Haryana", "Punjab", "Kerala"];

export const EXPENSE_CATEGORIES = ["Rent", "Electricity", "Internet", "Transport", "Salary", "Marketing", "Office Expenses", "Maintenance", "Travel", "Software", "Professional Fees", "Bank Charges", "Miscellaneous"];

export const DATE_RANGE_OPTIONS = ["Today", "This week", "This month", "Last month", "This quarter", "This year", "All time", "Custom"];

// Which sidebar tabs each role can see. "*" = all tabs (Owner only).
// This is a UI convenience, NOT the security boundary — see the note above.
export const ROLES = {
  Owner: { label: "Business Owner", tabs: "*" },
  Accountant: { label: "Accountant", tabs: ["dashboard", "sales", "purchases", "payments", "expenses", "reports", "analytics", "settings"] },
  Sales: { label: "Sales Employee", tabs: ["dashboard", "sales", "customers", "analytics"] },
  Inventory: { label: "Inventory Manager", tabs: ["dashboard", "inventory"] },
};

// The sidebar's full list of pages. Order here = order shown in the sidebar.
export const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "sales", label: "Sales & Invoices", icon: FileText },
  { id: "purchases", label: "Purchases", icon: ShoppingCart },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "customers", label: "Customers", icon: Users },
  { id: "vendors", label: "Vendors", icon: Truck },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "expenses", label: "Expenses", icon: Receipt },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "analytics", label: "Date-wise Analytics", icon: CalendarRange },
  { id: "settings", label: "Settings", icon: SettingsIcon },
  { id: "users", label: "Users & Access Log", icon: UserCog },
];
