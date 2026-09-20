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
  LayoutDashboard,
  FileText,
  Package,
  Users,
  Truck,
  CreditCard,
  Receipt,
  ShoppingCart,
  BarChart3,
  Settings as SettingsIcon,
  UserCog,
  CalendarRange,
  Inbox,
  CheckSquare,
  Mail
} from "lucide-react";

export const T = {
  // ─────────────────────────────────────────
  // Core typography
  // ─────────────────────────────────────────

  ink: "#1D1D1F",
  inkSoft: "#6E6E73",
  inkFaint: "#86868B",

  // ─────────────────────────────────────────
  // Surfaces
  // ─────────────────────────────────────────

  bg: "#F5F5F7",
  surface: "#FFFFFF",

  border: "rgba(0, 0, 0, 0.08)",
  borderSoft: "rgba(0, 0, 0, 0.05)",

  // ─────────────────────────────────────────
  // Primary accent
  // Apple-inspired blue
  // ─────────────────────────────────────────

  navy: "#0071E3",
  navyWash: "#EAF3FF",

  // ─────────────────────────────────────────
  // Success
  // ─────────────────────────────────────────

  emerald: "#248A3D",
  emeraldWash: "#EAF6ED",

  // ─────────────────────────────────────────
  // Warning
  // ─────────────────────────────────────────

  amber: "#B06D00",
  amberWash: "#FFF4DF",

  // ─────────────────────────────────────────
  // Danger
  // ─────────────────────────────────────────

  red: "#D70015",
  redWash: "#FFF0F1",
};


// Chart palette
export const PIE_COLORS = [
  "#0071E3",
  "#34C759",
  "#FF9F0A",
  "#AF52DE",
  "#FF375F",
  "#5E5CE6",
];

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

export const EXPENSE_CATEGORIES = ["Rent", "Electricity", "Internet", "Transport", "Salary", "Marketing", "Office Expenses", "Maintenance", "Travel", "Software", "Professional Fees", "Bank Charges", "Miscellaneous"];

export const DATE_RANGE_OPTIONS = [
  "Today",
  "Yesterday",
  "This week",
  "Last 7 days",
  "This month",
  "Last month",
  "Last 30 days",
  "This quarter",
  "Last quarter",
  "This year",
  "FY 2024-25",
  "FY 2025-26",
  "All time",
  "Custom"
];

// Which sidebar tabs each role can see. "*" = all tabs (Owner only).
// This is a UI convenience, NOT the security boundary — see the note above.
export const ROLES = {
  Owner: {
    label: "Business Owner",
    tabs: "*"
  },

  Accountant: {
    label: "Accountant",
    tabs: [
      "dashboard",
      "sales",
      "purchases",
      "payments",
      "expenses",
      "reports",
      "analytics",
      "tasks"
    ]
  },

  Manager: {
    label: "Operations Manager",
    tabs: [
      "dashboard",
      "inbox",
      "sales",
      "purchases",
      "inventory",
      "customers",
      "vendors",
      "payments",
      "expenses",
      "users",
      "tickets",
      "tasks"
    ]
  },

  Sales: {
    label: "Sales Employee",
    tabs: [
      "dashboard",
      "sales",
      "customers",
      "analytics",
      "tasks"
    ]
  },

  Inventory: {
    label: "Inventory Manager",
    tabs: [
      "dashboard",
      "purchases",
      "inventory",
      "vendors",
      "tasks"
    ]
  },

  Viewer: {
    label: "Viewer (Read Only)",
    tabs: [
      "dashboard",
      "inbox",
      "sales",
      "purchases",
      "inventory",
      "customers",
      "vendors",
      "payments",
      "expenses",
      "reports",
      "analytics",
      "users",
      "tickets",
      "tasks"
    ]
  },
};

// The sidebar's full list of pages. Order here = order shown in the sidebar.
export const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "inbox", label: "Email / Inbox", icon: Mail },
  { id: "sales", label: "Sales & Invoices", icon: FileText },
  { id: "purchases", label: "Purchases", icon: ShoppingCart },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "customers", label: "Customers", icon: Users },
  { id: "vendors", label: "Vendors", icon: Truck },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "expenses", label: "Expenses", icon: Receipt },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "analytics", label: "Business Analytics", icon: CalendarRange },
  { id: "settings", label: "Settings", icon: SettingsIcon },
  { id: "users", label: "Users & Access Log", icon: UserCog },
  {
    id: "tickets",
    label: "Enquiries & Tickets",
    icon: Inbox
  },
  {
    id: "tasks",
    label: "Tasks & To-Dos",
    icon: CheckSquare
  },
];
