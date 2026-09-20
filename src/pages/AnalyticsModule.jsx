/**
 * pages/AnalyticsModule.jsx
 * -------------------------------------------------------------------------
 * Comprehensive Date-wise Sales & Business Analytics Engine.
 * Multi-dimensional filtering (Date presets, Custom ranges, Customers,
 * Payment Status, Categories, Grouping granularity), Visual Chart Dashboards,
 * Day-of-Week patterns, Top Performers, and Drill-down expandable table.
 * -------------------------------------------------------------------------
 */

import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  ShoppingCart,
  FileText,
  CalendarRange,
  DollarSign,
  PieChart as PieIcon,
  BarChart3,
  LineChart as LineIcon,
  Download,
  Printer,
  ChevronDown,
  ChevronRight,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  Package,
  Layers,
  Sparkles,
  Eye,
  RefreshCw,
  Search,
  RotateCcw
} from "lucide-react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { T, DATE_RANGE_OPTIONS } from "../lib/constants";
import { INR, todayISO, fmtDate } from "../lib/format";
import { getRangeDates, inRange } from "../lib/dateRange";
import { Card, Select, Input, EmptyState, KpiCard, SectionHeader, Btn, Badge } from "../components/ui";

const PIE_COLORS = ["#34C759", "#FF9F0A", "#FF3B30", "#007AFF", "#AF52DE", "#5856D6"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AnalyticsModule({ ctx }) {
  const {
    invoices = [],
    purchases = [],
    customers = [],
    products = [],
    invoiceTotals,
    purchaseTotal,
    role
  } = ctx;

  const canSeeFinance = role === "Owner" || role === "Accountant";

  // Filter States
  const [rangeLabel, setRangeLabel] = useState("This month");
  const [customFrom, setCustomFrom] = useState(todayISO());
  const [customTo, setCustomTo] = useState(todayISO());
  const [granularity, setGranularity] = useState("daily"); // "daily" | "weekly" | "monthly"
  const [selectedCustomerId, setSelectedCustomerId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all"); // "all" | "Paid" | "Partial" | "Unpaid"
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [chartType, setChartType] = useState("bar"); // "bar" | "area" | "cumulative"
  const [tableSearch, setTableSearch] = useState("");
  const [sortBy, setSortBy] = useState("date_desc"); // "date_desc" | "date_asc" | "sales_desc" | "invoices_desc" | "unpaid_desc"
  const [expandedDate, setExpandedDate] = useState(null);

  // Compute Active Date Range
  const range = useMemo(() => {
    return getRangeDates(rangeLabel, customFrom, customTo);
  }, [rangeLabel, customFrom, customTo]);

  // Product categories list
  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category).filter(Boolean));
    return Array.from(cats);
  }, [products]);

  // Filter Active Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (inv.status === "Draft" || inv.status === "Cancelled") return false;
      if (!inRange(inv.date, range)) return false;

      // Customer filter
      if (selectedCustomerId !== "all" && inv.customerId !== selectedCustomerId) {
        return false;
      }

      // Payment Status filter
      if (selectedStatus !== "all") {
        const total = invoiceTotals(inv).grandTotal;
        const paid = Number(inv.paidAmount || 0);
        if (selectedStatus === "Paid" && (paid < total - 1 && inv.status !== "Paid")) return false;
        if (selectedStatus === "Partial" && (paid <= 0 || paid >= total - 1)) return false;
        if (selectedStatus === "Unpaid" && paid > 0) return false;
      }

      // Category filter (check if any item belongs to selected category)
      if (selectedCategory !== "all") {
        const hasCategory = (inv.items || []).some((item) => {
          const prod = products.find((p) => p.id === item.productId);
          return prod && prod.category === selectedCategory;
        });
        if (!hasCategory) return false;
      }

      return true;
    });
  }, [invoices, range, selectedCustomerId, selectedStatus, selectedCategory, invoiceTotals, products]);

  // Filter Purchases (if user has finance permissions)
  const filteredPurchases = useMemo(() => {
    if (!canSeeFinance) return [];
    return purchases.filter((p) => {
      if (!inRange(p.date, range)) return false;
      if (selectedCategory !== "all") {
        const hasCategory = (p.items || []).some((item) => {
          const prod = products.find((pr) => pr.id === item.productId);
          return prod && prod.category === selectedCategory;
        });
        if (!hasCategory) return false;
      }
      return true;
    });
  }, [purchases, range, canSeeFinance, selectedCategory, products]);

  // Calculate Metrics & Aggregations
  const metrics = useMemo(() => {
    let totalSales = 0;
    let totalPaid = 0;
    let totalTax = 0;
    let totalTaxable = 0;
    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;

    filteredInvoices.forEach((inv) => {
      const totals = invoiceTotals(inv);
      const grand = totals.grandTotal;
      const paid = Math.min(grand, Number(inv.paidAmount || 0));

      totalSales += grand;
      totalPaid += paid;
      totalTax += (totals.cgst || 0) + (totals.sgst || 0) + (totals.igst || 0);
      totalTaxable += totals.taxableAmount || 0;

      if (paid >= grand - 1 || inv.status === "Paid") {
        paidCount++;
      } else if (paid > 0) {
        partialCount++;
      } else {
        unpaidCount++;
      }
    });

    const totalUnpaid = Math.max(0, totalSales - totalPaid);
    const totalPurchases = filteredPurchases.reduce((acc, p) => acc + purchaseTotal(p), 0);
    const grossProfit = totalSales - totalPurchases;
    const profitMargin = totalSales > 0 ? ((grossProfit / totalSales) * 100).toFixed(1) : 0;
    const collectionRate = totalSales > 0 ? ((totalPaid / totalSales) * 100).toFixed(1) : 0;
    const aov = filteredInvoices.length > 0 ? Math.round(totalSales / filteredInvoices.length) : 0;

    return {
      totalSales,
      totalPaid,
      totalUnpaid,
      totalTax,
      totalTaxable,
      totalPurchases,
      grossProfit,
      profitMargin,
      collectionRate,
      aov,
      invoiceCount: filteredInvoices.length,
      paidCount,
      partialCount,
      unpaidCount
    };
  }, [filteredInvoices, filteredPurchases, invoiceTotals, purchaseTotal]);

  // Helper for Grouping Key based on Granularity
  const getGroupKey = (dateStr) => {
    const d = new Date(dateStr);
    if (granularity === "monthly") {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    if (granularity === "weekly") {
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return startOfWeek.toISOString().split("T")[0];
    }
    return dateStr; // daily
  };

  const formatGroupLabel = (key) => {
    if (granularity === "monthly") {
      const [year, month] = key.split("-");
      const d = new Date(year, month - 1, 1);
      return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    }
    if (granularity === "weekly") {
      const d = new Date(key);
      return `Wk of ${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`;
    }
    return new Date(key).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  };

  // Build Aggregated Breakdown by Period
  const { periodRows, chartData, peakDay, dayOfWeekData } = useMemo(() => {
    const map = {};
    const dayOfWeekSums = [0, 0, 0, 0, 0, 0, 0]; // Sun to Sat

    filteredInvoices.forEach((inv) => {
      const key = getGroupKey(inv.date);
      const totals = invoiceTotals(inv);
      const grand = totals.grandTotal;
      const paid = Math.min(grand, Number(inv.paidAmount || 0));
      const unpaid = Math.max(0, grand - paid);

      if (!map[key]) {
        map[key] = {
          key,
          label: formatGroupLabel(key),
          date: inv.date,
          salesCount: 0,
          salesAmount: 0,
          paidAmount: 0,
          unpaidAmount: 0,
          purchaseCount: 0,
          purchaseAmount: 0,
          invoices: []
        };
      }

      map[key].salesCount += 1;
      map[key].salesAmount += grand;
      map[key].paidAmount += paid;
      map[key].unpaidAmount += unpaid;
      map[key].invoices.push(inv);

      // Day of week analytics
      const dayIdx = new Date(inv.date).getDay();
      dayOfWeekSums[dayIdx] += grand;
    });

    if (canSeeFinance) {
      filteredPurchases.forEach((p) => {
        const key = getGroupKey(p.date);
        const pTotal = purchaseTotal(p);

        if (!map[key]) {
          map[key] = {
            key,
            label: formatGroupLabel(key),
            date: p.date,
            salesCount: 0,
            salesAmount: 0,
            paidAmount: 0,
            unpaidAmount: 0,
            purchaseCount: 0,
            purchaseAmount: 0,
            invoices: []
          };
        }

        map[key].purchaseCount += 1;
        map[key].purchaseAmount += pTotal;
      });
    }

    const rowsList = Object.values(map);

    // Find Peak Day
    let peak = { date: "—", amount: 0 };
    rowsList.forEach((r) => {
      if (r.salesAmount > peak.amount) {
        peak = { date: r.label, amount: r.salesAmount };
      }
    });

    // Sort Chart Chronologically (Oldest to Newest)
    const sortedForChart = [...rowsList].sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningCumulative = 0;
    const cData = sortedForChart.map((r) => {
      runningCumulative += r.salesAmount;
      return {
        key: r.key,
        date: r.label,
        Sales: Math.round(r.salesAmount),
        Collected: Math.round(r.paidAmount),
        Pending: Math.round(r.unpaidAmount),
        Purchases: Math.round(r.purchaseAmount),
        NetProfit: Math.round(r.salesAmount - r.purchaseAmount),
        Cumulative: Math.round(runningCumulative)
      };
    });

    // Day of week formatted data
    const dowFormatted = DAY_NAMES.map((name, idx) => ({
      day: name.slice(0, 3),
      fullName: name,
      amount: Math.round(dayOfWeekSums[idx])
    }));

    return {
      periodRows: rowsList,
      chartData: cData,
      peakDay: peak,
      dayOfWeekData: dowFormatted
    };
  }, [filteredInvoices, filteredPurchases, granularity, canSeeFinance, invoiceTotals, purchaseTotal]);

  // Product & Customer Rankings in current range
  const { topProducts, topCustomers, statusPieData } = useMemo(() => {
    // Top Products
    const prodMap = {};
    filteredInvoices.forEach((inv) => {
      (inv.items || []).forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const name = prod ? prod.name : "Other Item";
        const amt = (Number(item.qty) || 1) * (Number(item.rate) || 0) - (Number(item.discount) || 0);
        prodMap[name] = (prodMap[name] || 0) + amt;
      });
    });
    const tProds = Object.entries(prodMap)
      .map(([name, amount]) => ({ name, amount: Math.round(amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Top Customers
    const custMap = {};
    filteredInvoices.forEach((inv) => {
      const cust = customers.find((c) => c.id === inv.customerId);
      const name = cust ? cust.name : "Direct Customer";
      const amt = invoiceTotals(inv).grandTotal;
      custMap[name] = (custMap[name] || 0) + amt;
    });
    const tCusts = Object.entries(custMap)
      .map(([name, amount]) => ({ name, amount: Math.round(amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Payment Status Pie
    const pie = [
      { name: "Paid", value: Math.round(metrics.totalPaid), count: metrics.paidCount, color: "#34C759" },
      { name: "Outstanding", value: Math.round(metrics.totalUnpaid), count: metrics.unpaidCount + metrics.partialCount, color: "#FF3B30" }
    ].filter((p) => p.value > 0);

    return { topProducts: tProds, topCustomers: tCusts, statusPieData: pie };
  }, [filteredInvoices, products, customers, invoiceTotals, metrics]);

  // Sort & Filter Table Rows
  const sortedTableRows = useMemo(() => {
    let list = [...periodRows];

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      list = list.filter((r) => {
        if (r.label.toLowerCase().includes(q) || r.date.toLowerCase().includes(q)) return true;
        return r.invoices.some((inv) => {
          const cust = customers.find((c) => c.id === inv.customerId);
          return (
            inv.number.toLowerCase().includes(q) ||
            (cust && cust.name.toLowerCase().includes(q))
          );
        });
      });
    }

    list.sort((a, b) => {
      if (sortBy === "date_asc") return new Date(a.date) - new Date(b.date);
      if (sortBy === "sales_desc") return b.salesAmount - a.salesAmount;
      if (sortBy === "invoices_desc") return b.salesCount - a.salesCount;
      if (sortBy === "unpaid_desc") return b.unpaidAmount - a.unpaidAmount;
      return new Date(b.date) - new Date(a.date); // default "date_desc"
    });

    return list;
  }, [periodRows, tableSearch, sortBy, customers]);

  // Reset all filters
  const resetFilters = () => {
    setRangeLabel("This month");
    setGranularity("daily");
    setSelectedCustomerId("all");
    setSelectedStatus("all");
    setSelectedCategory("all");
    setTableSearch("");
    setSortBy("date_desc");
  };

  // Export to CSV
  const exportCSV = () => {
    const headers = [
      "Period",
      "Date",
      "Invoices Count",
      "Gross Sales (INR)",
      "Collections Paid (INR)",
      "Outstanding Pending (INR)",
      ...(canSeeFinance ? ["Purchases (INR)", "Estimated Profit (INR)"] : [])
    ];

    const rowsData = sortedTableRows.map((r) => [
      `"${r.label}"`,
      r.date,
      r.salesCount,
      r.salesAmount.toFixed(2),
      r.paidAmount.toFixed(2),
      r.unpaidAmount.toFixed(2),
      ...(canSeeFinance ? [r.purchaseAmount.toFixed(2), (r.salesAmount - r.purchaseAmount).toFixed(2)] : [])
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rowsData.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Datewise_Sales_Analytics_${rangeLabel.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Custom Tooltip for Recharts
  const CustomAnalyticsTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="p-3 rounded-xl shadow-2xl text-xs space-y-1.5 border border-white/20 backdrop-blur-md"
          style={{ background: "rgba(20, 24, 38, 0.95)", color: "#FFFFFF" }}
        >
          <div className="font-semibold text-gray-200 border-b border-white/10 pb-1 flex items-center justify-between gap-3">
            <span>{label}</span>
            <span className="text-[10px] text-gray-400">Date Analytics</span>
          </div>
          {payload.map((p, idx) => (
            <div key={idx} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5" style={{ color: p.color || p.fill }}>
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color || p.fill }} />
                {p.name}:
              </span>
              <span className="font-mono font-medium">{INR(p.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const isFiltered =
    rangeLabel !== "This month" ||
    selectedCustomerId !== "all" ||
    selectedStatus !== "all" ||
    selectedCategory !== "all" ||
    granularity !== "daily";

  return (
    <div className="space-y-4 pb-12">
      {/* 1. Header & Actions */}
      <SectionHeader
        title="Business Analytics"
        subtitle="Comprehensive sales analysis, collection velocity, day-of-week patterns, and revenue metrics"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {isFiltered && (
              <Btn variant="secondary" icon={RotateCcw} onClick={resetFilters} className="text-xs">
                Reset Filters
              </Btn>
            )}
            <Btn variant="secondary" icon={Download} onClick={exportCSV} className="text-xs">
              Export CSV
            </Btn>
            <Btn icon={Printer} onClick={() => window.print()} className="text-xs">
              Print Report
            </Btn>
          </div>
        }
      />

      {/* 2. Interactive Filter Bar */}
      <Card className="p-4 bg-gradient-to-r from-gray-50/80 to-white dark:from-white/[0.02] dark:to-transparent border border-gray-200/80 dark:border-white/10 shadow-sm">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider shrink-0">
              <Filter size={13} className="text-blue-500" />
              <span>Filters:</span>
            </div>

            {/* Preset Date Range */}
            <div className="w-40 shrink-0">
              <Select value={rangeLabel} onChange={(e) => setRangeLabel(e.target.value)}>
                {DATE_RANGE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </div>

            {/* Custom Dates (if selected) */}
            {rangeLabel === "Custom" && (
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-36 text-xs"
                />
                <span className="text-xs text-gray-400">to</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-36 text-xs"
                />
              </div>
            )}

            {/* Customer Filter */}
            <div className="w-44 shrink-0">
              <Select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
                <option value="all">All Customers ({customers.length})</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Status Filter */}
            <div className="w-36 shrink-0">
              <Select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                <option value="all">All Statuses</option>
                <option value="Paid">Paid Only</option>
                <option value="Partial">Partially Paid</option>
                <option value="Unpaid">Unpaid / Due</option>
              </Select>
            </div>

            {/* Category Filter */}
            {categories.length > 0 && (
              <div className="w-36 shrink-0">
                <Select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                  <option value="all">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          {/* Granularity Tabs (Daily / Weekly / Monthly) */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-200/60 dark:bg-white/10 shrink-0 self-start lg:self-auto">
            <button
              type="button"
              onClick={() => setGranularity("daily")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                granularity === "daily"
                  ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Daily
            </button>
            <button
              type="button"
              onClick={() => setGranularity("weekly")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                granularity === "weekly"
                  ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Weekly
            </button>
            <button
              type="button"
              onClick={() => setGranularity("monthly")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                granularity === "monthly"
                  ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Monthly
            </button>
          </div>
        </div>
      </Card>

      {/* 3. Executive KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Gross Revenue"
          value={INR(metrics.totalSales)}
          hint={`${metrics.invoiceCount} invoices · AOV: ${INR(metrics.aov)}`}
          icon={TrendingUp}
          iconBg={T.emeraldWash}
          iconColor={T.emerald}
        />
        <KpiCard
          label="Collections (Paid)"
          value={INR(metrics.totalPaid)}
          hint={`${metrics.collectionRate}% collection rate`}
          icon={CheckCircle2}
          iconBg="rgba(52, 199, 89, 0.12)"
          iconColor="#34C759"
        />
        <KpiCard
          label="Receivables (Due)"
          value={INR(metrics.totalUnpaid)}
          hint={`${metrics.unpaidCount + metrics.partialCount} pending invoices`}
          icon={Clock}
          iconBg="rgba(255, 59, 48, 0.12)"
          iconColor="#FF3B30"
        />
        {canSeeFinance && (
          <KpiCard
            label="Gross Profit"
            value={INR(metrics.grossProfit)}
            hint={`${metrics.profitMargin}% margin vs purchases`}
            icon={Sparkles}
            iconBg={T.goldWash}
            iconColor={T.gold}
          />
        )}
        <KpiCard
          label="Peak Sales Period"
          value={INR(peakDay.amount)}
          hint={peakDay.date !== "—" ? `Peak: ${peakDay.date}` : "No peak date"}
          icon={CalendarRange}
          iconBg={T.navyWash}
          iconColor={T.navy}
        />
        <KpiCard
          label="GST / Tax Billed"
          value={INR(metrics.totalTax)}
          hint={`Taxable: ${INR(metrics.totalTaxable)}`}
          icon={FileText}
          iconBg="rgba(175, 82, 222, 0.12)"
          iconColor="#AF52DE"
        />
      </div>

      {/* 4. Chart Visualization Section */}
      <Card className="p-5 border border-gray-200/80 dark:border-white/10 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-white/5">
          <div>
            <div className="text-base font-semibold" style={{ color: T.ink }}>
              Sales & Revenue Performance ({rangeLabel})
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Aggregated by {granularity} breakdown for {filteredInvoices.length} transactions
            </div>
          </div>

          {/* Chart Type Selector */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-gray-100 dark:bg-white/5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setChartType("bar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                chartType === "bar"
                  ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <BarChart3 size={13} />
              <span>Bar Breakdown</span>
            </button>
            <button
              type="button"
              onClick={() => setChartType("area")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                chartType === "area"
                  ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <TrendingUp size={13} />
              <span>Trend Velocity</span>
            </button>
            <button
              type="button"
              onClick={() => setChartType("cumulative")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                chartType === "cumulative"
                  ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <LineIcon size={13} />
              <span>Cumulative</span>
            </button>
          </div>
        </div>

        {chartData.length === 0 ? (
          <EmptyState icon={CalendarRange} title="No transaction activity found for this filter range" />
        ) : (
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "bar" ? (
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: T.inkFaint }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: T.inkFaint }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => (v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                  />
                  <Tooltip content={<CustomAnalyticsTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  <Bar dataKey="Sales" fill="#0A84FF" radius={[5, 5, 0, 0]} maxBarSize={45} />
                  <Bar dataKey="Collected" fill="#34C759" radius={[5, 5, 0, 0]} maxBarSize={45} />
                  {canSeeFinance && <Bar dataKey="Purchases" fill="#FF9F0A" radius={[5, 5, 0, 0]} maxBarSize={45} />}
                </BarChart>
              ) : chartType === "area" ? (
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0A84FF" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#0A84FF" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34C759" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#34C759" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: T.inkFaint }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: T.inkFaint }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => (v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                  />
                  <Tooltip content={<CustomAnalyticsTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  <Area type="monotone" dataKey="Sales" stroke="#0A84FF" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)" />
                  <Area type="monotone" dataKey="Collected" stroke="#34C759" strokeWidth={2} fillOpacity={1} fill="url(#colorCollected)" />
                </AreaChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: T.inkFaint }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: T.inkFaint }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => (v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                  />
                  <Tooltip content={<CustomAnalyticsTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  <Line type="monotone" dataKey="Cumulative" stroke="#AF52DE" strokeWidth={3} dot={{ r: 4, fill: "#AF52DE" }} />
                  <Line type="monotone" dataKey="Sales" stroke="#0A84FF" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* 5. Secondary Insights Grid (Top Products, Customers, Day of Week, Payment Status) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Top 5 Products */}
        <Card className="p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">
                <Package size={14} className="text-blue-500" />
                <span>Top Products</span>
              </div>
              <span className="text-[11px] text-gray-400">By Revenue</span>
            </div>
            {topProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">No product sales in range</div>
            ) : (
              <div className="space-y-2.5">
                {topProducts.map((p, idx) => {
                  const percent = metrics.totalSales > 0 ? ((p.amount / metrics.totalSales) * 100).toFixed(0) : 0;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-medium truncate max-w-[140px]" style={{ color: T.ink }}>
                          {idx + 1}. {p.name}
                        </span>
                        <span className="font-mono font-semibold" style={{ color: T.ink }}>
                          {INR(p.amount)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {/* Top 5 Customers */}
        <Card className="p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">
                <Users size={14} className="text-emerald-500" />
                <span>Top Clients</span>
              </div>
              <span className="text-[11px] text-gray-400">By Volume</span>
            </div>
            {topCustomers.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">No client sales in range</div>
            ) : (
              <div className="space-y-2.5">
                {topCustomers.map((c, idx) => {
                  const percent = metrics.totalSales > 0 ? ((c.amount / metrics.totalSales) * 100).toFixed(0) : 0;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-medium truncate max-w-[140px]" style={{ color: T.ink }}>
                          {idx + 1}. {c.name}
                        </span>
                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {INR(c.amount)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {/* Day-of-Week Distribution */}
        <Card className="p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">
                <CalendarRange size={14} className="text-amber-500" />
                <span>Day-of-Week Pattern</span>
              </div>
              <span className="text-[11px] text-gray-400">Peak Days</span>
            </div>
            <div className="space-y-1.5">
              {dayOfWeekData.map((d, idx) => {
                const maxAmt = Math.max(...dayOfWeekData.map((x) => x.amount)) || 1;
                const percent = ((d.amount / maxAmt) * 100).toFixed(0);
                return (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <span className="w-7 font-mono text-[11px] text-gray-500">{d.day}</span>
                    <div className="flex-1 bg-gray-100 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full transition-all" style={{ width: `${percent}%` }} />
                    </div>
                    <span className="w-16 text-right font-mono text-[11px]" style={{ color: T.ink }}>
                      {d.amount > 0 ? INR(d.amount) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Payment Status Donut */}
        <Card className="p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">
                <PieIcon size={14} className="text-purple-500" />
                <span>Payment Status</span>
              </div>
              <span className="text-[11px] text-gray-400">Collections</span>
            </div>
            {statusPieData.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">No data</div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-full h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        innerRadius={36}
                        outerRadius={56}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {statusPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => INR(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-4 text-xs mt-2 w-full">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#34C759]" />
                    <span>Paid: {metrics.collectionRate}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF3B30]" />
                    <span>Due: {(100 - Number(metrics.collectionRate)).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* 6. Detailed Date-wise Breakdown Table */}
      <div className="space-y-2 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold" style={{ color: T.ink }}>
              Detailed {granularity === "monthly" ? "Month" : granularity === "weekly" ? "Week" : "Day"}-by-Day Breakdown
            </div>
            <div className="text-xs text-gray-500">
              Showing {sortedTableRows.length} active periods. Click any row to expand individual invoice list.
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Table Search */}
            <div className="relative w-48 sm:w-60">
              <Search size={13} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search date or invoice..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 outline-none"
                style={{ color: T.ink }}
              />
            </div>

            {/* Sort Selector */}
            <div className="w-36">
              <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="date_desc">Newest First</option>
                <option value="date_asc">Oldest First</option>
                <option value="sales_desc">Highest Sales</option>
                <option value="invoices_desc">Most Invoices</option>
                <option value="unpaid_desc">Highest Due</option>
              </Select>
            </div>
          </div>
        </div>

        <Card className="overflow-hidden border border-gray-200/80 dark:border-white/10">
          {sortedTableRows.length === 0 ? (
            <EmptyState icon={CalendarRange} title="No date rows matching current search/filters" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr
                    className="border-b bg-gray-50/70 dark:bg-white/[0.02]"
                    style={{ borderColor: T.border }}
                  >
                    <th className="px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider">
                      Period / Date
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider text-center">
                      Invoices
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider text-right">
                      Gross Sales
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider text-right text-emerald-600 dark:text-emerald-400">
                      Collections (Paid)
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider text-right text-rose-500">
                      Outstanding (Due)
                    </th>
                    {canSeeFinance && (
                      <>
                        <th className="px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider text-right text-amber-500">
                          Purchases
                        </th>
                        <th className="px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider text-right">
                          Net Profit
                        </th>
                      </>
                    )}
                    <th className="px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider text-center">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {sortedTableRows.map((r) => {
                    const isExpanded = expandedDate === r.key;
                    const netMargin = r.salesAmount - r.purchaseAmount;
                    return (
                      <React.Fragment key={r.key}>
                        <tr
                          onClick={() => setExpandedDate(isExpanded ? null : r.key)}
                          className={`cursor-pointer transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-900/10 ${
                            isExpanded ? "bg-blue-50/60 dark:bg-blue-900/20" : ""
                          }`}
                        >
                          <td className="px-4 py-3 font-medium flex items-center gap-2" style={{ color: T.ink }}>
                            <span className="text-gray-400">
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </span>
                            <span>{r.label}</span>
                            {granularity === "daily" && (
                              <span className="text-[10px] text-gray-400 font-mono">
                                ({new Date(r.date).toLocaleDateString("en-IN", { weekday: "short" })})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={r.salesCount > 0 ? "blue" : "neutral"} className="px-2 py-0.5 text-[11px]">
                              {r.salesCount} {r.salesCount === 1 ? "inv" : "invs"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold" style={{ color: T.ink }}>
                            {INR(r.salesAmount)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                            {INR(r.paidAmount)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium text-rose-500">
                            {r.unpaidAmount > 0 ? INR(r.unpaidAmount) : "—"}
                          </td>
                          {canSeeFinance && (
                            <>
                              <td className="px-4 py-3 text-right font-mono font-medium text-amber-500">
                                {r.purchaseAmount > 0 ? INR(r.purchaseAmount) : "—"}
                              </td>
                              <td
                                className={`px-4 py-3 text-right font-mono font-bold ${
                                  netMargin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
                                }`}
                              >
                                {INR(netMargin)}
                              </td>
                            </>
                          )}
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                              {isExpanded ? "Collapse ▲" : "View Invoices ▼"}
                            </span>
                          </td>
                        </tr>

                        {/* Expanded Drill-Down of Invoices for this date */}
                        {isExpanded && (
                          <tr className="bg-gray-50/80 dark:bg-white/[0.03]">
                            <td colSpan={canSeeFinance ? 8 : 6} className="p-4">
                              <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 p-3 shadow-inner">
                                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center justify-between">
                                  <span>Invoices raised on {r.label} ({r.invoices.length}):</span>
                                  <span className="text-[11px] text-gray-400">Click invoice to inspect</span>
                                </div>
                                {r.invoices.length === 0 ? (
                                  <div className="py-3 text-center text-xs text-gray-400">
                                    No sales invoices recorded on this date (purchases only)
                                  </div>
                                ) : (
                                  <div className="divide-y divide-gray-100 dark:divide-white/5">
                                    {r.invoices.map((inv) => {
                                      const cust = customers.find((c) => c.id === inv.customerId);
                                      const invTot = invoiceTotals(inv);
                                      const paid = Number(inv.paidAmount || 0);
                                      const due = Math.max(0, invTot.grandTotal - paid);
                                      return (
                                        <div
                                          key={inv.id}
                                          className="py-2 flex items-center justify-between gap-3 text-xs hover:bg-gray-50 dark:hover:bg-white/[0.02] px-2 rounded-lg"
                                        >
                                          <div className="flex items-center gap-3">
                                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                                              {inv.number}
                                            </span>
                                            <span className="font-medium" style={{ color: T.ink }}>
                                              {cust ? cust.name : "Direct Customer"}
                                            </span>
                                            <Badge
                                              variant={
                                                paid >= invTot.grandTotal - 1 || inv.status === "Paid"
                                                  ? "green"
                                                  : paid > 0
                                                  ? "amber"
                                                  : "red"
                                              }
                                              className="text-[10px] px-2 py-0.2"
                                            >
                                              {paid >= invTot.grandTotal - 1 || inv.status === "Paid"
                                                ? "Paid"
                                                : paid > 0
                                                ? "Partial"
                                                : "Unpaid"}
                                            </Badge>
                                          </div>
                                          <div className="flex items-center gap-4">
                                            <span className="text-gray-500 font-mono">
                                              Items: {(inv.items || []).length}
                                            </span>
                                            <span className="font-mono font-bold" style={{ color: T.ink }}>
                                              {INR(invTot.grandTotal)}
                                            </span>
                                            {due > 0 && (
                                              <span className="font-mono text-rose-500 text-[11px]">
                                                Due: {INR(due)}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>

                {/* Summary Footer */}
                <tfoot>
                  <tr
                    className="border-t-2 bg-gray-100/80 dark:bg-white/10 font-bold"
                    style={{ borderColor: T.border }}
                  >
                    <td className="px-4 py-3 text-xs" style={{ color: T.ink }}>
                      TOTALS ({sortedTableRows.length} periods)
                    </td>
                    <td className="px-4 py-3 text-center text-xs" style={{ color: T.ink }}>
                      {metrics.invoiceCount} invoices
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs" style={{ color: T.ink }}>
                      {INR(metrics.totalSales)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                      {INR(metrics.totalPaid)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-rose-500">
                      {INR(metrics.totalUnpaid)}
                    </td>
                    {canSeeFinance && (
                      <>
                        <td className="px-4 py-3 text-right font-mono text-xs text-amber-500">
                          {INR(metrics.totalPurchases)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                          {INR(metrics.grossProfit)}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
