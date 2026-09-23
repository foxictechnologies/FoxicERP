import React, { useState, useMemo } from "react";
import {
    Search,
    Inbox,
    Clock3,
    CheckCircle2,
    AlertCircle,
    Mail,
    Phone,
    User,
    X,
    ChevronDown,
    RefreshCw,
    Plus,
    Check,
    FileText,
    Eye,
    UploadCloud,
    Download,
  } from "lucide-react";

import { T } from "../lib/constants";
import { uid, todayISO } from "../lib/format";
import { fetchTable, updateRow, insertRow } from "../lib/db";
import { Card, Badge, Btn, Modal, Field, Input, Select } from "../components/ui";

function formatFileSize(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function openPdfViewer(attachment) {
  if (!attachment?.data) return;
  const newWindow = window.open();
  if (newWindow) {
    newWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${attachment.name || "PDF Document"}</title>
          <style>
            body { margin: 0; padding: 0; background: #222; height: 100vh; overflow: hidden; font-family: system-ui, -apple-system, sans-serif; }
            iframe { width: 100%; height: 100%; border: none; }
          </style>
        </head>
        <body>
          <iframe src="${attachment.data}"></iframe>
        </body>
      </html>
    `);
  } else {
    const a = document.createElement("a");
    a.href = attachment.data;
    a.download = attachment.name || "document.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
];

const PRIORITY_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }) {
  const map = {
    new: {
      label: "New",
      tone: "blue",
    },
    in_progress: {
      label: "In Progress",
      tone: "amber",
    },
    resolved: {
      label: "Resolved",
      tone: "green",
    },
  };

  const item = map[status] || {
    label: status || "Unknown",
    tone: "gray",
  };

  return <Badge tone={item.tone}>{item.label}</Badge>;
}

function PriorityBadge({ priority }) {
  const map = {
    normal: {
      label: "Normal",
      tone: "gray",
    },
    high: {
      label: "High",
      tone: "amber",
    },
    urgent: {
      label: "Urgent",
      tone: "red",
    },
  };

  const item = map[priority] || {
    label: priority || "Normal",
    tone: "gray",
  };

  return <Badge tone={item.tone}>{item.label}</Badge>;
}

function normalizeTicket(t) {
  if (!t) return t;
  const status = (t.status || "new").toLowerCase();
  const priority = (t.priority || "normal").toLowerCase();
  const name = t.name || t.customerName || t.clientName || t.contactName || "Customer";
  const email = t.email || t.customerEmail || "";
  const phone = t.phone || t.customerPhone || t.mobile || "";
  const subject = t.subject || t.title || t.query || t.topic || "Enquiry";
  const message = t.message || t.description || t.details || t.notes || "";
  const ticketNumber = t.ticketNumber || t.ticketNo || (t.id ? `TCK-${String(t.id).slice(-4)}` : "TCK-1001");
  const source = t.source || "Website";
  const createdAt = t.createdAt || t.created_at || new Date().toISOString();
  const assignedTo = t.assignedTo || t.assigned_to || null;

  return {
    ...t,
    status: status === "open" ? "new" : status,
    priority,
    name,
    email,
    phone,
    subject,
    message,
    ticketNumber,
    source,
    createdAt,
    assignedTo
  };
}

export default function TicketsModule({ ctx }) {
  const {
    tickets = [],
    setTickets,
    tasks = [],
    setTasks,
    company,
    users = [],
    currentUser,
    role,
    logAudit,
  } = ctx;
  const isViewer = ctx.role === "Viewer";
  const canAssign = role === "Owner" || role === "Manager";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [savingNewTicket, setSavingNewTicket] = useState(false);
  const [newTicketForm, setNewTicketForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
    source: "Manual",
    priority: "normal",
    assignedTo: "",
    attachment: null,
  });

  const handleTicketFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      alert("Please select a valid PDF file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("PDF file size must be under 10MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      setNewTicketForm((prev) => ({
        ...prev,
        attachment: {
          name: file.name,
          size: file.size,
          type: file.type || "application/pdf",
          data: loadEvt.target.result,
          uploadedAt: new Date().toISOString(),
        },
      }));
    };
    reader.readAsDataURL(file);
  };

  const refreshTickets = async () => {
    setRefreshing(true);
  
    try {
      const latestTickets = await fetchTable(
        "tickets",
        "created_at",
        false
      );
      console.log("Fetched tickets from Supabase:", latestTickets);
      setTickets(latestTickets);
      if (latestTickets.length === 0) {
        console.info("Supabase returned 0 tickets. Make sure schema-patch-tickets.sql is run in Supabase SQL editor.");
      }
    } catch (error) {
      console.error("Ticket refresh failed:", error);
      alert("Could not refresh tickets: " + error.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!newTicketForm.name.trim() || !newTicketForm.subject.trim() || !newTicketForm.message.trim()) {
      alert("Name, Subject, and Message are required.");
      return;
    }

    setSavingNewTicket(true);
    const companyId = ctx.company?.id || ctx.currentUser?.companyId || null;
    const ticketPayload = {
      ...newTicketForm,
      assignedTo: newTicketForm.assignedTo || null,
      assigned_to: newTicketForm.assignedTo || null,
      companyId,
      status: "new",
      attachment: newTicketForm.attachment || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const created = await insertRow("tickets", ticketPayload);
      const finalTicket = created || { ...ticketPayload, id: uid(), ticketNumber: `TCK-${Date.now().toString().slice(-4)}` };
      setTickets((prev) => [finalTicket, ...prev]);

      // If assigned to a team member, create a To-Do task automatically
      if (ticketPayload.assignedTo) {
        const assignedUser = users.find((u) => u.id === ticketPayload.assignedTo);
        const taskData = {
          id: uid(),
          title: `[Enquiry #${finalTicket.ticketNumber}] ${ticketPayload.subject || ticketPayload.name}`,
          description: `Customer: ${ticketPayload.name} (${ticketPayload.phone || ticketPayload.email || "No contact info"})\nMessage: ${ticketPayload.message || ""}\nSource: ${ticketPayload.source || "Website"}\nAssigned by: ${currentUser?.name || role}`,
          status: "todo",
          priority: ticketPayload.priority === "urgent" ? "urgent" : ticketPayload.priority === "high" ? "high" : "medium",
          category: "Customer Support",
          assignedTo: ticketPayload.assignedTo,
          createdBy: currentUser?.id || null,
          dueDate: todayISO(),
          companyId: companyId || "demo-company-id",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        try {
          const insTask = await insertRow("tasks", taskData);
          if (insTask?.id) taskData.id = insTask.id;
        } catch (err) {
          console.warn("Supabase insert task for ticket assignment fallback:", err);
        }

        if (setTasks) {
          setTasks((prev) => [taskData, ...(prev || [])]);
        }
      }

      setCreateModalOpen(false);
      setNewTicketForm({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
        source: "Manual",
        priority: "normal",
        assignedTo: "",
      });
      if (logAudit) {
        logAudit("Ticket created", `New ticket created for ${newTicketForm.name}`);
      }
    } catch (err) {
      console.error("Failed to create ticket:", err);
      // Local fallback
      const fallbackTicket = {
        ...ticketPayload,
        id: uid(),
        ticketNumber: `TCK-${Date.now().toString().slice(-4)}`
      };
      setTickets((prev) => [fallbackTicket, ...prev]);
      setCreateModalOpen(false);
    } finally {
      setSavingNewTicket(false);
    }
  };

  const normalizedTickets = useMemo(() => {
    return (tickets || []).map(normalizeTicket);
  }, [tickets]);

  const stats = useMemo(() => {
    return {
      total: normalizedTickets.length,

      new: normalizedTickets.filter(
        (t) => t.status === "new"
      ).length,

      inProgress: normalizedTickets.filter(
        (t) => t.status === "in_progress"
      ).length,

      resolved: normalizedTickets.filter(
        (t) => t.status === "resolved"
      ).length,

      urgent: normalizedTickets.filter(
        (t) =>
          t.priority === "urgent" &&
          t.status !== "resolved" &&
          t.status !== "closed"
      ).length,
    };
  }, [normalizedTickets]);

  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();

    return [...normalizedTickets]
      .filter((ticket) => {
        if (
          statusFilter !== "all" &&
          ticket.status !== statusFilter
        ) {
          return false;
        }

        if (
          priorityFilter !== "all" &&
          ticket.priority !== priorityFilter
        ) {
          return false;
        }

        if (assigneeFilter !== "all") {
          if (assigneeFilter === "unassigned" && ticket.assignedTo) {
            return false;
          }
          if (assigneeFilter !== "unassigned" && ticket.assignedTo !== assigneeFilter) {
            return false;
          }
        }

        if (!q) return true;

        return [
          ticket.ticketNumber,
          ticket.name,
          ticket.email,
          ticket.phone,
          ticket.subject,
          ticket.message,
          ticket.source,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(q)
          );
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0) -
          new Date(a.createdAt || 0)
      );
  }, [
    tickets,
    search,
    statusFilter,
    priorityFilter,
  ]);

  const updateTicket = async (ticket, patch) => {
    setUpdating(true);

    try {
      const updated = await updateRow(
        "tickets",
        ticket.id,
        patch
      );

      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticket.id ? updated : t
        )
      );

      setSelectedTicket(updated);

      if (logAudit) {
        await logAudit(
          "Ticket updated",
          `Ticket #${ticket.ticketNumber}: ${Object.entries(
            patch
          )
            .map(([key, value]) => `${key} → ${value}`)
            .join(", ")}`
        );
      }
    } catch (error) {
      console.error("Ticket update failed:", error);
      alert(
        "Could not update ticket: " +
          error.message
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignTicket = async (ticket, userId) => {
    const assignedUser = users.find((u) => u.id === userId);
    const userName = assignedUser ? assignedUser.name : "Unassigned";

    await updateTicket(ticket, {
      assignedTo: userId || null,
      assigned_to: userId || null,
    });

    if (userId) {
      // Automatically create a Task in the assigned user's To-Do list
      const taskData = {
        id: uid(),
        title: `[Enquiry #${ticket.ticketNumber}] ${ticket.subject || ticket.name}`,
        description: `Customer: ${ticket.name} (${ticket.phone || ticket.email || "No contact info"})\nMessage: ${ticket.message || ""}\nSource: ${ticket.source || "Website"}\nAssigned by: ${currentUser?.name || role}`,
        status: "todo",
        priority: ticket.priority === "urgent" ? "urgent" : ticket.priority === "high" ? "high" : "medium",
        category: "Customer Support",
        assignedTo: userId,
        createdBy: currentUser?.id || null,
        dueDate: todayISO(),
        companyId: company?.id || ctx.currentUser?.companyId || "demo-company-id",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        const inserted = await insertRow("tasks", taskData);
        if (inserted?.id) taskData.id = inserted.id;
      } catch (err) {
        console.warn("Supabase insert task for ticket assignment fallback:", err);
      }

      if (setTasks) {
        setTasks((prev) => [taskData, ...(prev || [])]);
      }
    }

    if (logAudit) {
      logAudit(
        "Ticket Assigned & Task Created",
        `Ticket #${ticket.ticketNumber} forwarded to ${userName} (Auto-created To-Do task)`
      );
    }
  };

  return (
    <div className="space-y-6">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

        <div>
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: T.navy }}
          >
            Customer support
          </div>

          <h1
            className="text-3xl md:text-4xl font-semibold tracking-[-0.04em] mt-1"
            style={{ color: T.ink }}
          >
            Enquiries & Tickets
          </h1>

          <p
            className="text-sm mt-2"
            style={{ color: T.inkSoft }}
          >
            Manage customer requests coming from your
            websites and external forms.
          </p>
        </div>

        <div className="flex items-center gap-2">

{/* Refresh tickets */}

<button
  onClick={refreshTickets}
  disabled={refreshing}
  title="Refresh tickets"
  className="
    w-9
    h-9
    rounded-full
    flex
    items-center
    justify-center
    transition-all
    hover:bg-black/[0.05]
    active:scale-90
    disabled:opacity-50
  "
  style={{
    background: T.surface,
    border: `1px solid ${T.border}`,
    color: T.inkSoft,
  }}
>
  <RefreshCw
    size={15}
    className={refreshing ? "animate-spin" : ""}
  />
</button>

{!isViewer && (
  <Btn
    icon={Plus}
    variant="primary"
    onClick={() => setCreateModalOpen(true)}
  >
    New Ticket
  </Btn>
)}

{/* New ticket status */}

<div
  className="flex items-center gap-2 rounded-full px-3 py-2"
  style={{
    background: T.surface,
    border: `1px solid ${T.border}`,
  }}
>
  <span
    className="w-2 h-2 rounded-full"
    style={{
      background:
        stats.new > 0
          ? T.red
          : T.emerald,
    }}
  />

  <span
    className="text-xs font-medium"
    style={{ color: T.inkSoft }}
  >
    {stats.new > 0
      ? `${stats.new} new ticket${
          stats.new === 1 ? "" : "s"
        }`
      : "All caught up"}
  </span>
</div>

</div>

</div>


{/* =====================================================
KPI CARDS
===================================================== */}


      {/* =====================================================
          KPI CARDS
          ===================================================== */}

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">

        <Card className="p-4 apple-lift">
          <div className="flex items-center justify-between">
            <div
              className="text-xs font-medium"
              style={{ color: T.inkSoft }}
            >
              Total
            </div>

            <Inbox size={17} color={T.navy} />
          </div>

          <div
            className="text-2xl font-semibold tracking-tight mt-3"
            style={{ color: T.ink }}
          >
            {stats.total}
          </div>
        </Card>


        <Card className="p-4 apple-lift">
          <div className="flex items-center justify-between">
            <div
              className="text-xs font-medium"
              style={{ color: T.inkSoft }}
            >
              New
            </div>

            <AlertCircle size={17} color={T.red} />
          </div>

          <div
            className="text-2xl font-semibold tracking-tight mt-3"
            style={{ color: T.red }}
          >
            {stats.new}
          </div>
        </Card>


        <Card className="p-4 apple-lift">
          <div className="flex items-center justify-between">
            <div
              className="text-xs font-medium"
              style={{ color: T.inkSoft }}
            >
              In Progress
            </div>

            <Clock3 size={17} color={T.amber} />
          </div>

          <div
            className="text-2xl font-semibold tracking-tight mt-3"
            style={{ color: T.amber }}
          >
            {stats.inProgress}
          </div>
        </Card>


        <Card className="p-4 apple-lift">
          <div className="flex items-center justify-between">
            <div
              className="text-xs font-medium"
              style={{ color: T.inkSoft }}
            >
              Resolved
            </div>

            <CheckCircle2
              size={17}
              color={T.emerald}
            />
          </div>

          <div
            className="text-2xl font-semibold tracking-tight mt-3"
            style={{ color: T.emerald }}
          >
            {stats.resolved}
          </div>
        </Card>


        <Card className="p-4 apple-lift">
          <div className="flex items-center justify-between">
            <div
              className="text-xs font-medium"
              style={{ color: T.inkSoft }}
            >
              Urgent
            </div>

            <AlertCircle
              size={17}
              color={T.red}
            />
          </div>

          <div
            className="text-2xl font-semibold tracking-tight mt-3"
            style={{ color: T.red }}
          >
            {stats.urgent}
          </div>
        </Card>

      </div>


      {/* =====================================================
          FILTER BAR
          ===================================================== */}

      <Card className="p-3">

        <div className="flex flex-col lg:flex-row gap-3">

          {/* Search */}

          <div className="relative flex-1">

            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              color={T.inkFaint}
            />

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search tickets, customers, email or subject..."
              className="
                w-full
                h-11
                rounded-xl
                pl-10
                pr-4
                text-sm
                outline-none
              "
              style={{
                background: T.bg,
                border: `1px solid ${T.border}`,
                color: T.ink,
              }}
            />

          </div>


          {/* Status */}

          <div className="relative">

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value)
              }
              className="
                appearance-none
                h-11
                min-w-[150px]
                rounded-xl
                pl-3
                pr-9
                text-sm
                outline-none
              "
              style={{
                background: T.bg,
                border: `1px solid ${T.border}`,
                color: T.ink,
              }}
            >
              <option value="all">
                All statuses
              </option>

              {STATUS_OPTIONS.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>

            <ChevronDown
              size={15}
              className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              color={T.inkFaint}
            />

          </div>


          {/* Priority */}

          <div className="relative">

            <select
              value={priorityFilter}
              onChange={(e) =>
                setPriorityFilter(e.target.value)
              }
              className="
                appearance-none
                h-11
                min-w-[150px]
                rounded-xl
                pl-3
                pr-9
                text-sm
                outline-none
              "
              style={{
                background: T.bg,
                border: `1px solid ${T.border}`,
                color: T.ink,
              }}
            >
              <option value="all">
                All priorities
              </option>

              {PRIORITY_OPTIONS.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>

            <ChevronDown
              size={15}
              className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              color={T.inkFaint}
            />

          </div>

          {/* Assignee Filter */}
          <div className="relative">
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="
                appearance-none
                h-11
                min-w-[150px]
                rounded-xl
                pl-3
                pr-9
                text-sm
                outline-none
              "
              style={{
                background: T.bg,
                border: `1px solid ${T.border}`,
                color: T.ink,
              }}
            >
              <option value="all">All Assignees</option>
              <option value="unassigned">Unassigned Only</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>

            <ChevronDown
              size={15}
              className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              color={T.inkFaint}
            />
          </div>

        </div>

      </Card>


      {/* =====================================================
          TICKET LIST
          ===================================================== */}

      <Card className="overflow-hidden">

        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{
            borderBottom:
              `1px solid ${T.border}`,
          }}
        >
          <div>
            <div
              className="font-semibold text-sm"
              style={{ color: T.ink }}
            >
              Tickets
            </div>

            <div
              className="text-xs mt-0.5"
              style={{ color: T.inkFaint }}
            >
              {filteredTickets.length} result
              {filteredTickets.length === 1
                ? ""
                : "s"}
            </div>
          </div>
        </div>


        {filteredTickets.length === 0 ? (

          <div className="py-20 text-center">

            <div
              className="
                w-14
                h-14
                rounded-2xl
                mx-auto
                flex
                items-center
                justify-center
              "
              style={{
                background: T.navyWash,
              }}
            >
              <Inbox
                size={24}
                color={T.navy}
              />
            </div>

            <div
              className="font-semibold text-sm mt-4"
              style={{ color: T.ink }}
            >
              No tickets found
            </div>

            <div
              className="text-xs mt-1"
              style={{ color: T.inkFaint }}
            >
              New enquiries will appear here automatically.
            </div>

          </div>

        ) : (

          <div className="divide-y" style={{ borderColor: T.border }}>

            {filteredTickets.map((ticket) => (

              <button
                key={ticket.id}
                onClick={() =>
                  setSelectedTicket(ticket)
                }
                className="
                  w-full
                  text-left
                  px-5
                  py-4
                  hover:bg-black/[0.02]
                  transition-colors
                "
              >

                <div className="flex items-start gap-4">

                  {/* Number */}

                  <div
                    className="
                      hidden
                      sm:flex
                      w-11
                      h-11
                      rounded-xl
                      items-center
                      justify-center
                      shrink-0
                      text-xs
                      font-semibold
                    "
                    style={{
                      background:
                        ticket.status === "new"
                          ? T.navyWash
                          : T.bg,
                      color:
                        ticket.status === "new"
                          ? T.navy
                          : T.inkSoft,
                    }}
                  >
                    #{ticket.ticketNumber}
                  </div>


                  {/* Main */}

                  <div className="min-w-0 flex-1">

                    <div className="flex flex-wrap items-center gap-2">

                      <span
                        className="font-semibold text-sm truncate"
                        style={{
                          color: T.ink,
                        }}
                      >
                        {ticket.subject ||
                          "Untitled request"}
                      </span>

                      <StatusBadge
                        status={ticket.status}
                      />

                      <PriorityBadge
                        priority={ticket.priority}
                      />

                      {ticket.assignedTo ? (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                          style={{
                            background: T.navyWash,
                            color: T.navy,
                          }}
                        >
                          <User size={10} />
                          {users.find((u) => u.id === ticket.assignedTo)?.name || "Assigned"}
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                          style={{
                            background: "rgba(0,0,0,0.04)",
                            color: T.inkFaint,
                          }}
                        >
                          Unassigned
                        </span>
                      )}

                    </div>

                    <div
                      className="text-xs mt-1"
                      style={{
                        color: T.inkSoft,
                      }}
                    >
                      {ticket.name || "Unknown customer"}
                      {" · "}
                      {ticket.email || "No email"}
                    </div>


                    <div
                      className="
                        text-xs
                        mt-2
                        line-clamp-2
                      "
                      style={{
                        color: T.inkFaint,
                      }}
                    >
                      {ticket.message}
                    </div>

                  </div>


                  {/* Date */}

                  <div
                    className="
                      hidden
                      md:block
                      text-[11px]
                      shrink-0
                      text-right
                    "
                    style={{
                      color: T.inkFaint,
                    }}
                  >
                    {formatDate(
                      ticket.createdAt
                    )}
                  </div>

                </div>

              </button>

            ))}

          </div>

        )}

      </Card>


      {/* =====================================================
          DETAIL MODAL (Matches Vendor & Customer popup style)
          ===================================================== */}

      {selectedTicket && (
        <Modal
          open={Boolean(selectedTicket)}
          onClose={() => setSelectedTicket(null)}
          title={`Ticket #${selectedTicket.ticketNumber} — ${selectedTicket.subject || "Enquiry"}`}
          width="max-w-2xl"
        >
          <div className="space-y-5">
            {/* Top badges bar */}
            <div
              className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b"
              style={{ borderColor: T.border }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={selectedTicket.status} />
                <PriorityBadge priority={selectedTicket.priority} />
                <span
                  className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                  style={{ background: T.bg, color: T.inkSoft }}
                >
                  Source: {selectedTicket.source || "Manual"}
                </span>
              </div>

              <span
                className="text-xs font-medium"
                style={{ color: T.inkFaint }}
              >
                {formatDate(selectedTicket.createdAt)}
              </span>
            </div>

            {/* Customer info card */}
            <div>
              <div
                className="text-[11px] font-bold uppercase tracking-wider mb-2"
                style={{ color: T.inkFaint }}
              >
                Customer Details
              </div>

              <div
                className="rounded-2xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
                style={{
                  background: T.bg,
                  borderColor: T.border,
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
                    style={{
                      background: T.navyWash,
                      color: T.navy,
                    }}
                  >
                    <User size={18} />
                  </div>

                  <div className="min-w-0">
                    <div
                      className="font-semibold text-sm truncate"
                      style={{ color: T.ink }}
                    >
                      {selectedTicket.name || "Unknown Customer"}
                    </div>
                    <div
                      className="text-xs flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5"
                      style={{ color: T.inkSoft }}
                    >
                      {selectedTicket.email && <span>{selectedTicket.email}</span>}
                      {selectedTicket.email && selectedTicket.phone && <span>•</span>}
                      {selectedTicket.phone && <span>{selectedTicket.phone}</span>}
                      {!selectedTicket.email && !selectedTicket.phone && (
                        <span>No contact info</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {selectedTicket.email && (
                    <a
                      href={`mailto:${selectedTicket.email}`}
                      className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm border transition-all hover:opacity-90"
                      style={{
                        background: T.surface,
                        borderColor: T.border,
                        color: T.ink,
                      }}
                    >
                      <Mail size={13} />
                      Email
                    </a>
                  )}

                  {selectedTicket.phone && (
                    <a
                      href={`tel:${selectedTicket.phone}`}
                      className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm border transition-all hover:opacity-90"
                      style={{
                        background: T.surface,
                        borderColor: T.border,
                        color: T.ink,
                      }}
                    >
                      <Phone size={13} />
                      Call
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Message Details */}
            <div>
              <div
                className="text-[11px] font-bold uppercase tracking-wider mb-2"
                style={{ color: T.inkFaint }}
              >
                Enquiry Message
              </div>

              <div
                className="rounded-2xl p-4 border text-sm leading-relaxed whitespace-pre-wrap font-normal max-h-48 overflow-y-auto"
                style={{
                  background: T.bg,
                  borderColor: T.border,
                  color: T.ink,
                }}
              >
                {selectedTicket.message || "No message content"}
              </div>

              {/* PDF Attachment in Ticket */}
              {selectedTicket.attachment && (
                <div
                  onClick={() => openPdfViewer(selectedTicket.attachment)}
                  className="mt-2.5 flex items-center justify-between gap-3 p-3 rounded-2xl border cursor-pointer transition-all hover:opacity-90 shadow-sm"
                  style={{
                    background: "rgba(220, 38, 38, 0.04)",
                    borderColor: "rgba(220, 38, 38, 0.2)",
                  }}
                  title="Click to view attached PDF"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "#FEE2E2", color: "#DC2626" }}
                    >
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate" style={{ color: T.ink }}>
                        {selectedTicket.attachment.name}
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color: T.inkSoft }}>
                        {formatFileSize(selectedTicket.attachment.size)} • PDF Document
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border shadow-sm"
                      style={{ background: T.surface, borderColor: T.border, color: T.ink }}
                    >
                      <Eye size={13} />
                      View PDF
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Status Selector */}
            <div>
              <div
                className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center justify-between"
                style={{ color: T.inkFaint }}
              >
                <span>Update Status</span>
                <span className="text-[10px] lowercase font-normal opacity-80">
                  (Click to switch)
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {STATUS_OPTIONS.map((option) => {
                  const active = selectedTicket.status === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={updating || isViewer}
                      onClick={() =>
                        !isViewer &&
                        updateTicket(selectedTicket, {
                          status: option.value,
                        })
                      }
                      className="rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                      style={{
                        background: active ? T.ink : T.bg,
                        color: active ? "#ffffff" : T.inkSoft,
                        border: active
                          ? "1px solid transparent"
                          : `1px solid ${T.border}`,
                        transform: active ? "scale(1.02)" : "none",
                      }}
                    >
                      {active && <Check size={14} />}
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Priority Selector */}
            <div>
              <div
                className="text-[11px] font-bold uppercase tracking-wider mb-2"
                style={{ color: T.inkFaint }}
              >
                Set Priority
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {PRIORITY_OPTIONS.map((option) => {
                  const active = selectedTicket.priority === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={updating || isViewer}
                      onClick={() =>
                        !isViewer &&
                        updateTicket(selectedTicket, {
                          priority: option.value,
                        })
                      }
                      className="rounded-xl px-3.5 py-2 text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                      style={{
                        background: active ? T.ink : T.bg,
                        color: active ? "#ffffff" : T.inkSoft,
                        border: active
                          ? "1px solid transparent"
                          : `1px solid ${T.border}`,
                        transform: active ? "scale(1.02)" : "none",
                      }}
                    >
                      {active && <Check size={14} />}
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Assigned Team Member */}
            <div>
              <div
                className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center justify-between"
                style={{ color: T.inkFaint }}
              >
                <span>Assigned Team Member</span>
                {canAssign && (
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: T.navyWash,
                      color: T.navy,
                    }}
                  >
                    Manager & Owner Action
                  </span>
                )}
              </div>

              {(() => {
                const assignedUser = users.find(
                  (u) => u.id === selectedTicket.assignedTo
                );

                return (
                  <div
                    className="rounded-2xl p-3.5 border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    style={{
                      background: T.bg,
                      borderColor: T.border,
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
                        style={{
                          background: assignedUser
                            ? T.navyWash
                            : "rgba(0,0,0,0.06)",
                          color: assignedUser ? T.navy : T.inkFaint,
                        }}
                      >
                        {assignedUser ? (
                          assignedUser.name[0].toUpperCase()
                        ) : (
                          <User size={15} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div
                          className="text-sm font-semibold truncate"
                          style={{ color: T.ink }}
                        >
                          {assignedUser
                            ? assignedUser.name
                            : "Unassigned Enquiry"}
                        </div>
                        <div
                          className="text-xs mt-0.5 truncate"
                          style={{ color: T.inkSoft }}
                        >
                          {assignedUser
                            ? `${assignedUser.role || "Team Member"} ${
                                assignedUser.email
                                  ? `• ${assignedUser.email}`
                                  : ""
                              }`
                            : "Forward to any team member to handle"}
                        </div>
                      </div>
                    </div>

                    {canAssign ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={selectedTicket.assignedTo || ""}
                          disabled={updating}
                          onChange={(e) =>
                            handleAssignTicket(
                              selectedTicket,
                              e.target.value
                            )
                          }
                          className="text-xs font-semibold px-3 py-2 rounded-xl outline-none cursor-pointer"
                          style={{
                            background: T.surface,
                            border: `1px solid ${T.border}`,
                            color: T.ink,
                          }}
                        >
                          <option value="">— Unassigned (General) —</option>
                          {users
                            .filter((u) => u.role !== "Owner" && u.role !== "Business Owner" && u.role?.toLowerCase() !== "owner")
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                Forward to: {u.name} ({u.role})
                              </option>
                            ))}
                        </select>
                      </div>
                    ) : (
                      <div
                        className="text-xs font-medium px-3 py-1 rounded-lg shrink-0"
                        style={{
                          background: T.surface,
                          border: `1px solid ${T.border}`,
                          color: T.inkSoft,
                        }}
                      >
                        {assignedUser
                          ? `Assigned to ${assignedUser.name}`
                          : "Unassigned"}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Bottom Actions */}
            <div
              className="pt-3 border-t flex items-center justify-between gap-3 mt-4"
              style={{ borderColor: T.border }}
            >
              <div
                className="text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1.5"
                style={{
                  background: T.bg,
                  border: `1px solid ${T.border}`,
                  color: T.inkSoft,
                }}
              >
                <span>Current Status:</span>
                <span
                  className="font-bold capitalize"
                  style={{ color: T.ink }}
                >
                  {selectedTicket.status?.replace("_", " ")}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Btn
                  variant="secondary"
                  onClick={() => setSelectedTicket(null)}
                >
                  Close
                </Btn>
                <Btn
                  variant="primary"
                  icon={Check}
                  onClick={() => setSelectedTicket(null)}
                >
                  Done
                </Btn>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Create Ticket */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New Ticket / Enquiry"
      >
        <form onSubmit={handleCreateTicket} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Customer Name *">
              <Input
                required
                allow="alpha"
                value={newTicketForm.name}
                onChange={(e) => setNewTicketForm({ ...newTicketForm, name: e.target.value })}
                placeholder="e.g. Rahul Sharma (letters only)"
              />
            </Field>

            <Field label="Phone">
              <Input
                allow="phone"
                value={newTicketForm.phone}
                onChange={(e) => setNewTicketForm({ ...newTicketForm, phone: e.target.value })}
                placeholder="e.g. +91 98765 43210 (digits only)"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Email">
              <Input
                type="email"
                value={newTicketForm.email}
                onChange={(e) => setNewTicketForm({ ...newTicketForm, email: e.target.value })}
                placeholder="e.g. rahul@example.com"
              />
            </Field>

            <Field label="Source">
              <Select
                value={newTicketForm.source}
                onChange={(e) => setNewTicketForm({ ...newTicketForm, source: e.target.value })}
              >
                <option value="Website">Website</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Email">Email</option>
                <option value="Phone">Phone</option>
                <option value="Manual">Manual</option>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Subject *">
              <Input
                required
                value={newTicketForm.subject}
                onChange={(e) => setNewTicketForm({ ...newTicketForm, subject: e.target.value })}
                placeholder="e.g. Bulk enquiry for LED Monitors"
              />
            </Field>

            <Field label="Priority">
              <Select
                value={newTicketForm.priority}
                onChange={(e) => setNewTicketForm({ ...newTicketForm, priority: e.target.value })}
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </Field>

            {canAssign && (
              <Field label="Assign To (Optional)">
                <Select
                  value={newTicketForm.assignedTo}
                  onChange={(e) => setNewTicketForm({ ...newTicketForm, assignedTo: e.target.value })}
                >
                  <option value="">— Unassigned —</option>
                  {users
                    .filter((u) => u.role !== "Owner" && u.role !== "Business Owner" && u.role?.toLowerCase() !== "owner")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                </Select>
              </Field>
            )}
          </div>

          <Field label="Message / Enquiry Details *">
            <textarea
              required
              rows={4}
              value={newTicketForm.message}
              onChange={(e) => setNewTicketForm({ ...newTicketForm, message: e.target.value })}
              placeholder="Customer's requirement or issue details..."
              className="w-full text-sm p-3 rounded-xl outline-none resize-none"
              style={{
                background: T.bg,
                border: `1px solid ${T.border}`,
                color: T.ink,
              }}
            />
          </Field>

          {/* PDF Attachment Field */}
          <Field label="Attach PDF Document" hint="Optional • Max 10MB">
            {!newTicketForm.attachment ? (
              <label
                className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-black/[0.02] transition-colors"
                style={{ borderColor: T.border }}
              >
                <UploadCloud size={22} style={{ color: T.navy }} className="mb-1" />
                <span className="text-xs font-semibold" style={{ color: T.ink }}>
                  Click to browse or drag & drop PDF
                </span>
                <span className="text-[11px] mt-0.5" style={{ color: T.inkSoft }}>
                  Attach enquiry document, spec sheet, or invoice (PDF only)
                </span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={handleTicketFileUpload}
                />
              </label>
            ) : (
              <div
                className="rounded-2xl p-3 border flex items-center justify-between gap-3"
                style={{
                  background: "rgba(220, 38, 38, 0.04)",
                  borderColor: "rgba(220, 38, 38, 0.2)",
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "#FEE2E2", color: "#DC2626" }}
                  >
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate" style={{ color: T.ink }}>
                      {newTicketForm.attachment.name}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: T.inkSoft }}>
                      {formatFileSize(newTicketForm.attachment.size)} • PDF Document
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => openPdfViewer(newTicketForm.attachment)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border shadow-sm transition-all hover:bg-white"
                    style={{ background: T.surface, borderColor: T.border, color: T.ink }}
                    title="View PDF"
                  >
                    <Eye size={13} />
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTicketForm((prev) => ({ ...prev, attachment: null }))}
                    className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                    title="Remove PDF"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}
          </Field>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Btn
              variant="secondary"
              onClick={() => setCreateModalOpen(false)}
              disabled={savingNewTicket}
            >
              Cancel
            </Btn>
            <Btn
              type="submit"
              variant="primary"
              disabled={savingNewTicket}
            >
              {savingNewTicket ? "Saving..." : "Create Ticket"}
            </Btn>
          </div>
        </form>
      </Modal>

    </div>
  );
}