import React, { useState, useMemo } from "react";
import {
  CheckSquare,
  Plus,
  Search,
  Calendar,
  User,
  AlertCircle,
  Clock,
  CheckCircle2,
  List,
  Kanban,
  Trash2,
  Edit3,
  Tag,
  ArrowRight,
  Filter,
  MoreVertical,
  Check,
  AlertTriangle,
  Flame,
  FileText,
  Paperclip,
  Eye,
  UploadCloud,
  X,
  Download,
  RefreshCw
} from "lucide-react";
import { T } from "../lib/constants";
import { uid, todayISO } from "../lib/format";
import { fetchTable, insertRow, updateRow, deleteRow } from "../lib/db";
import { Card, Badge, Btn, Modal, Field, Input, Select, EmptyState } from "../components/ui";

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

const TASK_CATEGORIES = [
  "General",
  "Sales",
  "Purchases",
  "Inventory",
  "Accounts & GST",
  "Follow-up",
  "Customer Support"
];

const STATUS_COLUMNS = [
  { id: "todo", label: "To Do", tone: "neutral", icon: Clock },
  { id: "in_progress", label: "In Progress", tone: "navy", icon: Clock },
  { id: "review", label: "Under Review", tone: "amber", icon: AlertCircle },
  { id: "completed", label: "Completed", tone: "green", icon: CheckCircle2 }
];

const PRIORITY_LEVELS = [
  { id: "low", label: "Low", tone: "neutral", color: "#6E6E73", bg: "rgba(0,0,0,0.05)" },
  { id: "medium", label: "Medium", tone: "amber", color: "#B06D00", bg: "#FFF4DF" },
  { id: "high", label: "High", tone: "red", color: "#E05300", bg: "#FFF0E6" },
  { id: "urgent", label: "Urgent", tone: "red", color: "#D70015", bg: "#FFF0F1" }
];

export default function TasksModule({ ctx }) {
  const {
    company,
    tasks = [],
    setTasks,
    users = [],
    currentUser,
    logAudit
  } = ctx;
  const isViewer = ctx.role === "Viewer";
  const userRole = ctx.role || currentUser?.role || "Sales";
  const isOwnerOrManager = userRole === "Owner" || userRole === "Manager";

  const isSelfTask = (task) => {
    if (!currentUser || !task) return false;
    const uId = currentUser.id;
    const uName = currentUser.name;
    const uEmail = currentUser.email;

    const isAssignedToMe = task.assignedTo && (
      task.assignedTo === uId ||
      (uName && task.assignedTo === uName) ||
      (uEmail && task.assignedTo === uEmail)
    );

    const isCreatedByMe = task.createdBy && (
      task.createdBy === uId ||
      (uName && task.createdBy === uName) ||
      (uEmail && task.createdBy === uEmail)
    );

    return isAssignedToMe || isCreatedByMe;
  };

  const [viewMode, setViewMode] = useState("kanban"); // "kanban" | "list"
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formStatus, setFormStatus] = useState("todo");
  const [formPriority, setFormPriority] = useState("medium");
  const [formCategory, setFormCategory] = useState("General");
  const [formAssignedTo, setFormAssignedTo] = useState("");
  const [formDueDate, setFormDueDate] = useState(todayISO());
  const [formAttachment, setFormAttachment] = useState(null); // { name, size, type, data }
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const today = todayISO();

  // Refresh tasks from DB (merging DB rows with current state so local tasks are never lost)
  const refreshTasks = async () => {
    setRefreshing(true);
    try {
      const latest = await fetchTable("tasks", "created_at", false);
      if (latest && Array.isArray(latest)) {
        setTasks((prev) => {
          const map = new Map();
          (prev || []).forEach((t) => { if (t?.id) map.set(t.id, t); });
          latest.forEach((t) => { if (t?.id) map.set(t.id, t); });
          return Array.from(map.values());
        });
      }
    } catch (e) {
      console.warn("Tasks refresh error:", e);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle PDF file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setFormError("Please select a valid PDF file.");
      return;
    }

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      setFormError("PDF file size must be under 10MB.");
      return;
    }

    setFormError("");
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      setFormAttachment({
        name: file.name,
        size: file.size,
        type: file.type || "application/pdf",
        data: loadEvt.target.result,
        uploadedAt: new Date().toISOString()
      });
    };
    reader.onerror = () => {
      setFormError("Failed to read the PDF file.");
    };
    reader.readAsDataURL(file);
  };

  // Base task visibility filtering according to role & ownership:
  // 1. Owner & Operations Manager can see ALL tasks
  // 2. Assigned user can see tasks assigned to them
  // 3. Task Creator can see tasks created by them
  const userVisibleTasks = useMemo(() => {
    if (isOwnerOrManager) return tasks;

    if (!currentUser) return [];

    const uId = currentUser.id;
    const uName = currentUser.name;
    const uEmail = currentUser.email;

    return tasks.filter((t) => {
      const isMyAssigned = t.assignedTo && (
        t.assignedTo === uId ||
        (uName && t.assignedTo === uName) ||
        (uEmail && t.assignedTo === uEmail)
      );

      const isMyCreated = t.createdBy && (
        t.createdBy === uId ||
        (uName && t.createdBy === uName) ||
        (uEmail && t.createdBy === uEmail)
      );

      // Completed tasks: Only visible to the assigned user or creator
      if (t.status === "completed") {
        return isMyAssigned || isMyCreated;
      }

      // Active tasks (todo, in_progress, review): visible if assigned to user, created by user, or unassigned
      if (!t.assignedTo) return true;
      return isMyAssigned || isMyCreated;
    });
  }, [tasks, currentUser, isOwnerOrManager]);

  // Filter tasks further by user UI selections (priority, category, status, assignee, search)
  const filteredTasks = useMemo(() => {
    return userVisibleTasks.filter((t) => {
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;

      if (assigneeFilter !== "all") {
        if (assigneeFilter === "me") {
          if (t.assignedTo !== currentUser?.id && t.assignedTo !== currentUser?.name) return false;
        } else if (assigneeFilter === "unassigned") {
          if (t.assignedTo) return false;
        } else {
          if (t.assignedTo !== assigneeFilter) return false;
        }
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const titleMatch = (t.title || "").toLowerCase().includes(q);
        const descMatch = (t.description || "").toLowerCase().includes(q);
        const catMatch = (t.category || "").toLowerCase().includes(q);
        const assignedUser = users.find((u) => u.id === t.assignedTo || u.name === t.assignedTo);
        const userMatch = assignedUser?.name?.toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !catMatch && !userMatch) return false;
      }
      return true;
    });
  }, [userVisibleTasks, priorityFilter, categoryFilter, statusFilter, assigneeFilter, search, users, currentUser]);

  // Statistics computed against visible tasks
  const stats = useMemo(() => {
    const total = userVisibleTasks.length;
    const todo = userVisibleTasks.filter((t) => t.status === "todo").length;
    const inProgress = userVisibleTasks.filter((t) => t.status === "in_progress").length;
    const review = userVisibleTasks.filter((t) => t.status === "review").length;
    const completed = userVisibleTasks.filter((t) => t.status === "completed").length;
    const overdue = userVisibleTasks.filter((t) => t.status !== "completed" && t.dueDate && t.dueDate < today).length;

    return { total, todo, inProgress, review, completed, overdue };
  }, [userVisibleTasks, today]);

  // Open modal for new task
  const handleOpenCreate = () => {
    setEditingTask(null);
    setFormTitle("");
    setFormDesc("");
    setFormStatus("todo");
    setFormPriority("medium");
    setFormCategory("General");
    setFormAssignedTo(currentUser?.id || "");
    setFormDueDate(todayISO());
    setFormAttachment(null);
    setFormError("");
    setModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEdit = (task) => {
    if (task?.assignedTo && !isOwnerOrManager && !isSelfTask(task)) {
      alert("Once a task is assigned to someone else, only an Owner or Manager can edit its details.");
      return;
    }
    setEditingTask(task);
    setFormTitle(task.title || "");
    setFormDesc(task.description || "");
    setFormStatus(task.status || "todo");
    setFormPriority(task.priority || "medium");
    setFormCategory(task.category || "General");
    setFormAssignedTo(task.assignedTo || "");
    setFormDueDate(task.dueDate || todayISO());
    setFormAttachment(task.attachment || null);
    setFormError("");
    setModalOpen(true);
  };

  // Save task
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError("Task title is required.");
      return;
    }

    setSaving(true);
    setFormError("");

    if (!isOwnerOrManager && formAssignedTo && formAssignedTo !== currentUser?.id && formAssignedTo !== currentUser?.name) {
      setFormError("Only Owners and Managers can assign tasks to other team members. You can only create tasks for yourself.");
      setSaving(false);
      return;
    }

    if (editingTask?.assignedTo && !isOwnerOrManager && !isSelfTask(editingTask)) {
      setFormError("Once a task is assigned to someone else, only an Owner or Manager can edit its details.");
      setSaving(false);
      return;
    }

    let resolvedAssignedTo = formAssignedTo || null;
    if (resolvedAssignedTo) {
      const matchUser = users.find((u) => u.id === resolvedAssignedTo || u.name === resolvedAssignedTo);
      if (matchUser?.id) resolvedAssignedTo = matchUser.id;
    }

    const isSelfCurrent = isSelfTask(editingTask) || isSelfTask({ assignedTo: resolvedAssignedTo, createdBy: currentUser?.id });

    let finalStatus = formStatus;
    if (editingTask?.status === "completed" && !isOwnerOrManager && !isSelfCurrent) {
      if (formStatus !== "completed") {
        setFormError("Completed tasks are locked. Only Owners, Managers, or the task assignee can change the status of completed tasks.");
        setSaving(false);
        return;
      }
    } else if (formStatus === "completed" && !isOwnerOrManager && !isSelfCurrent) {
      alert("Only Owners, Managers, or the task assignee can mark tasks as Completed. Status set to 'Under Review'.");
      finalStatus = "review";
    }

    const taskData = {
      title: formTitle.trim(),
      description: formDesc.trim(),
      status: finalStatus,
      priority: formPriority,
      category: formCategory,
      assignedTo: resolvedAssignedTo,
      createdBy: editingTask ? (editingTask.createdBy || currentUser?.id) : (currentUser?.id || null),
      updatedBy: currentUser?.name || currentUser?.role || "Owner/Manager",
      updatedById: currentUser?.id || null,
      updatedByRole: ctx.role || currentUser?.role || "Team Member",
      dueDate: formDueDate || null,
      attachment: formAttachment || null,
      companyId: company?.id || currentUser?.companyId || null,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingTask) {
        // Update existing task
        try {
          const updated = await updateRow("tasks", editingTask.id, taskData);
          if (updated) Object.assign(taskData, updated);
        } catch (err) {
          console.warn("Supabase updateRow failed, updating local state:", err);
        }
        setTasks((prev) =>
          prev.map((t) => (t.id === editingTask.id ? { ...t, ...taskData } : t))
        );
        const assigneeName = getAssigneeName(resolvedAssignedTo);
        logAudit?.("Task Updated", `Updated task "${taskData.title}" (Notified assignee: ${assigneeName})`);
      } else {
        // Create new task
        const newTask = {
          ...taskData,
          id: uid(),
          createdAt: new Date().toISOString()
        };

        try {
          const inserted = await insertRow("tasks", taskData);
          if (inserted?.id) {
            newTask.id = inserted.id;
            if (inserted.createdAt) newTask.createdAt = inserted.createdAt;
          }
        } catch (err) {
          console.warn("Supabase insertRow failed, saving locally:", err);
        }

        setTasks((prev) => [newTask, ...prev.filter((t) => t.id !== newTask.id)]);
        logAudit?.("Task Created", `Created task "${taskData.title}"`);
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err.message || "Failed to save task.");
    } finally {
      setSaving(false);
    }
  };

  // Quick toggle task status: Owner/Manager or self-assignee marks Completed/Reopens
  const handleToggleComplete = async (task) => {
    let newStatus = "completed";
    const isSelf = isSelfTask(task);

    if (!isOwnerOrManager && !isSelf) {
      if (task.status === "completed") {
        alert("Completed tasks are locked. Only Owners, Managers, or the task assignee can reopen or change completed tasks.");
        return;
      }
      // Non-owner team member submitting someone else's task moves it to 'Under Review'
      newStatus = "review";
    } else {
      newStatus = task.status === "completed" ? "todo" : "completed";
    }

    const patch = {
      status: newStatus,
      updatedBy: currentUser?.name || currentUser?.role || "Team Member",
      updatedById: currentUser?.id || null,
      updatedByRole: ctx.role || currentUser?.role || "Team Member",
      updatedAt: new Date().toISOString()
    };

    try {
      await updateRow("tasks", task.id, patch);
    } catch (err) {
      console.warn("Supabase updateRow fallback:", err);
    }

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, ...patch } : t))
    );

    if (newStatus === "completed") {
      logAudit?.("Task Completed", `Completed task "${task.title}"`);
    } else if (newStatus === "review") {
      logAudit?.("Task Under Review", `Submitted task "${task.title}" for Manager review`);
    }
  };

  // Change task status (e.g. from Kanban column move or select dropdown)
  const handleChangeStatus = async (taskId, requestedStatus) => {
    const existingTask = tasks.find((t) => t.id === taskId);
    const isSelf = isSelfTask(existingTask);

    if (existingTask?.status === "completed" && !isOwnerOrManager && !isSelf) {
      alert("Completed tasks are locked. Only Owners, Managers, or the task assignee can reopen or change completed tasks.");
      return;
    }

    let newStatus = requestedStatus;

    if (requestedStatus === "completed" && !isOwnerOrManager && !isSelf) {
      alert("Only Owners, Managers, or the task assignee can mark tasks as Completed. Setting status to 'Under Review' for Manager approval.");
      newStatus = "review";
    }

    const patch = {
      status: newStatus,
      updatedBy: currentUser?.name || currentUser?.role || "Team Member",
      updatedById: currentUser?.id || null,
      updatedByRole: ctx.role || currentUser?.role || "Team Member",
      updatedAt: new Date().toISOString()
    };

    try {
      await updateRow("tasks", taskId, patch);
    } catch (err) {
      console.warn("Supabase status update fallback:", err);
    }

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t))
    );

    if (newStatus === "completed") {
      logAudit?.("Task Completed", `Completed task "${taskId}"`);
    } else if (newStatus === "review") {
      logAudit?.("Task Under Review", `Task "${taskId}" moved to Under Review`);
    }
  };

  // Delete task
  const handleDelete = async (id) => {
    const taskToDelete = tasks.find((t) => t.id === id);
    if (taskToDelete?.assignedTo && !isOwnerOrManager && !isSelfTask(taskToDelete)) {
      alert("Once a task is assigned to someone else, only an Owner, Manager, or the assignee can delete it.");
      return;
    }
    try {
      await deleteRow("tasks", id);
    } catch (err) {
      console.warn("Supabase deleteRow fallback:", err);
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setDeleteConfirmId(null);
    logAudit?.("Task Deleted", `Deleted task "${taskToDelete?.title || id}"`);
  };

  const getAssigneeName = (userId) => {
    if (!userId) return "Unassigned";
    const user = users.find((u) => u.id === userId || u.name === userId);
    return user ? user.name : userId;
  };

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: T.ink }}
          >
            Tasks & To-Dos
          </h1>
          <p className="text-sm mt-0.5" style={{ color: T.inkSoft }}>
            Organize work, assign tasks to team members, and track operational progress
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div
            className="flex items-center p-1 rounded-xl"
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`
            }}
          >
            <button
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "kanban"
                  ? "shadow-sm"
                  : "opacity-60 hover:opacity-100"
              }`}
              style={{
                background: viewMode === "kanban" ? T.navy : "transparent",
                color: viewMode === "kanban" ? "#FFFFFF" : T.ink
              }}
            >
              <Kanban size={14} />
              <span>Board</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "list"
                  ? "shadow-sm"
                  : "opacity-60 hover:opacity-100"
              }`}
              style={{
                background: viewMode === "list" ? T.navy : "transparent",
                color: viewMode === "list" ? "#FFFFFF" : T.ink
              }}
            >
              <List size={14} />
              <span>List</span>
            </button>
          </div>

          {!isViewer && (
            <Btn onClick={handleOpenCreate} icon={Plus} variant="primary">
              New Task
            </Btn>
          )}

          <Btn
            variant="secondary"
            icon={RefreshCw}
            onClick={refreshTasks}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </Btn>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: T.inkSoft }}>
              Total Tasks
            </span>
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: T.navyWash, color: T.navy }}
            >
              <CheckSquare size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2" style={{ color: T.ink }}>
            {stats.total}
          </div>
          <div className="text-[11px] mt-1" style={{ color: T.inkFaint }}>
            All active & closed
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: T.inkSoft }}>
              To Do
            </span>
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.05)", color: T.inkSoft }}
            >
              <Clock size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2" style={{ color: T.ink }}>
            {stats.todo}
          </div>
          <div className="text-[11px] mt-1" style={{ color: T.inkFaint }}>
            Pending start
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: T.inkSoft }}>
              In Progress
            </span>
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: T.navyWash, color: T.navy }}
            >
              <Flame size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2" style={{ color: T.navy }}>
            {stats.inProgress + stats.review}
          </div>
          <div className="text-[11px] mt-1" style={{ color: T.inkFaint }}>
            {stats.review > 0 ? `${stats.review} under review` : "Active tasks"}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: T.inkSoft }}>
              Completed
            </span>
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: T.emeraldWash, color: T.emerald }}
            >
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2" style={{ color: T.emerald }}>
            {stats.completed}
          </div>
          <div className="text-[11px] mt-1" style={{ color: T.inkFaint }}>
            Finished items
          </div>
        </Card>

        <Card className="p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: T.inkSoft }}>
              Overdue
            </span>
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: T.redWash, color: T.red }}
            >
              <AlertTriangle size={15} />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2" style={{ color: stats.overdue > 0 ? T.red : T.ink }}>
            {stats.overdue}
          </div>
          <div className="text-[11px] mt-1" style={{ color: stats.overdue > 0 ? T.red : T.inkFaint }}>
            {stats.overdue > 0 ? "Requires attention" : "All on schedule"}
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Search box */}
          <div
            className="flex-1 flex items-center gap-2.5 px-3 py-2 rounded-xl"
            style={{
              background: T.bg,
              border: `1px solid ${T.border}`
            }}
          >
            <Search size={16} color={T.inkFaint} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks by title, note, category or assignee..."
              className="bg-transparent text-sm w-full outline-none"
              style={{ color: T.ink }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-xs font-semibold px-1.5 py-0.5 rounded-md hover:bg-black/5"
                style={{ color: T.inkFaint }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
            {/* Assignee filter */}
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="text-xs font-medium px-3 py-2 rounded-xl outline-none cursor-pointer"
              style={{
                background: T.bg,
                border: `1px solid ${T.border}`,
                color: T.ink
              }}
            >
              <option value="all">Assignee: All</option>
              {currentUser && <option value="me">Assigned to Me</option>}
              <option value="unassigned">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>

            {/* Priority filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs font-medium px-3 py-2 rounded-xl outline-none cursor-pointer"
              style={{
                background: T.bg,
                border: `1px solid ${T.border}`,
                color: T.ink
              }}
            >
              <option value="all">Priority: All</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Category filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs font-medium px-3 py-2 rounded-xl outline-none cursor-pointer"
              style={{
                background: T.bg,
                border: `1px solid ${T.border}`,
                color: T.ink
              }}
            >
              <option value="all">Category: All</option>
              {TASK_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Status filter (useful in list view) */}
            {viewMode === "list" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs font-medium px-3 py-2 rounded-xl outline-none cursor-pointer"
                style={{
                  background: T.bg,
                  border: `1px solid ${T.border}`,
                  color: T.ink
                }}
              >
                <option value="all">Status: All</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Under Review</option>
                <option value="completed">Completed</option>
              </select>
            )}
          </div>
        </div>
      </Card>

      {/* Content: Kanban Board View or List View */}
      {filteredTasks.length === 0 ? (
        <Card className="p-12 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: T.navyWash, color: T.navy }}
          >
            <CheckSquare size={28} />
          </div>
          <div className="font-semibold text-base" style={{ color: T.ink }}>
            {search || priorityFilter !== "all" || categoryFilter !== "all"
              ? "No matching tasks found"
              : "No tasks created yet"}
          </div>
          <div className="text-xs max-w-sm mx-auto mt-1 mb-5" style={{ color: T.inkSoft }}>
            {search || priorityFilter !== "all" || categoryFilter !== "all"
              ? "Try adjusting your search criteria or resetting filters."
              : "Keep your daily business operations structured. Create your first task to start tracking work."}
          </div>
          {!isViewer && (
            <Btn onClick={handleOpenCreate} icon={Plus} variant="primary">
              Create First Task
            </Btn>
          )}
        </Card>
      ) : viewMode === "kanban" ? (
        /* ================= KANBAN BOARD VIEW ================= */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {STATUS_COLUMNS.map((col) => {
            const columnTasks = filteredTasks.filter((t) => (t.status || "todo") === col.id);
            const ColIcon = col.icon;

            return (
              <div
                key={col.id}
                className="flex flex-col rounded-2xl p-3.5"
                style={{
                  background: "rgba(0,0,0,0.02)",
                  border: `1px solid ${T.borderSoft}`,
                  minHeight: 480
                }}
              >
                {/* Column header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        background:
                          col.id === "completed"
                            ? T.emerald
                            : col.id === "in_progress"
                            ? T.navy
                            : col.id === "review"
                            ? T.amber
                            : T.inkSoft
                      }}
                    />
                    <h3 className="font-semibold text-sm" style={{ color: T.ink }}>
                      {col.label}
                    </h3>
                  </div>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.inkSoft }}
                  >
                    {columnTasks.length}
                  </span>
                </div>

                {/* Task Cards Column */}
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {columnTasks.map((task) => {
                    const isOverdue =
                      task.status !== "completed" && task.dueDate && task.dueDate < today;
                    const priorityObj =
                      PRIORITY_LEVELS.find((p) => p.id === task.priority) || PRIORITY_LEVELS[1];
                    const assignee = users.find((u) => u.id === task.assignedTo);

                    return (
                      <Card
                        key={task.id}
                        onClick={() => handleOpenEdit(task)}
                        className="p-3.5 group relative hover:shadow-md transition-all cursor-pointer"
                        style={{
                          background: T.surface,
                          border: isOverdue ? `1px solid rgba(215,0,21,0.25)` : `1px solid ${T.border}`
                        }}
                      >
                        {/* Priority and Category Tags */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                            style={{
                              background: priorityObj.bg,
                              color: priorityObj.color
                            }}
                          >
                            {priorityObj.label}
                          </span>

                          <span
                            className="text-[10px] font-medium px-2 py-0.5 rounded-md"
                            style={{
                              background: "rgba(0,0,0,0.03)",
                              color: T.inkSoft
                            }}
                          >
                            {task.category || "General"}
                          </span>
                        </div>

                        {/* Title */}
                        <div
                          className={`font-semibold text-sm leading-snug ${
                            task.status === "completed" ? "line-through opacity-60" : ""
                          }`}
                          style={{ color: T.ink }}
                        >
                          {task.title}
                        </div>

                        {/* Description snippet */}
                        {task.description && (
                          <div
                            className="text-xs line-clamp-2 mt-1.5 leading-relaxed"
                            style={{ color: T.inkSoft }}
                          >
                            {task.description}
                          </div>
                        )}

                        {/* PDF Attachment Badge */}
                        {task.attachment && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              openPdfViewer(task.attachment);
                            }}
                            className="mt-2.5 flex items-center justify-between gap-2 p-2 rounded-xl text-xs transition-all hover:opacity-90 shadow-sm cursor-pointer"
                            style={{
                              background: "rgba(220, 38, 38, 0.05)",
                              border: "1px solid rgba(220, 38, 38, 0.2)",
                              color: "#DC2626"
                            }}
                            title="Click to view attached PDF"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <FileText size={14} className="shrink-0 text-red-600" />
                              <span className="truncate font-semibold text-[11px] text-gray-800 dark:text-gray-200">
                                {task.attachment.name}
                              </span>
                            </div>
                            <span className="text-[10px] opacity-75 shrink-0 flex items-center gap-1 font-medium">
                              <Eye size={11} />
                              {formatFileSize(task.attachment.size)}
                            </span>
                          </div>
                        )}

                        {/* Metadata Footer */}
                        <div className="mt-3.5 pt-2.5 flex items-center justify-between text-xs" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
                          {/* Due Date */}
                          <div
                            className="flex items-center gap-1 font-medium"
                            style={{
                              color: isOverdue ? T.red : T.inkFaint
                            }}
                          >
                            <Calendar size={13} />
                            <span>
                              {task.dueDate
                                ? new Date(task.dueDate).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short"
                                  })
                                : "No date"}
                            </span>
                          </div>

                          {/* Assignee */}
                          <div
                            className="flex items-center gap-1.5 font-medium"
                            style={{ color: T.inkSoft }}
                            title={assignee?.name || "Unassigned"}
                          >
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                              style={{
                                background: assignee ? T.navyWash : "rgba(0,0,0,0.06)",
                                color: assignee ? T.navy : T.inkFaint
                              }}
                            >
                              {assignee?.name ? assignee.name[0].toUpperCase() : <User size={11} />}
                            </div>
                            <span className="truncate max-w-[75px]">
                              {assignee ? assignee.name.split(" ")[0] : "Unassigned"}
                            </span>
                          </div>
                        </div>

                        {/* Quick actions on card */}
                        <div className="mt-2.5 flex items-center justify-between gap-1 pt-2" style={{ borderTop: `1px dashed ${T.borderSoft}` }}>
                          {/* Column move dropdown */}
                          {isViewer || (task.status === "completed" && !isOwnerOrManager && !isSelfTask(task)) ? (
                            <span className="text-[11px] font-medium py-1 px-1.5 rounded-lg opacity-80" style={{ background: T.bg, color: T.inkSoft }}>
                              {task.status === "completed" ? "Completed (Locked)" : task.status === "in_progress" ? "In Progress" : task.status === "review" ? "Review" : "To Do"}
                            </span>
                          ) : (
                            <select
                              value={task.status || "todo"}
                              onChange={(e) => handleChangeStatus(task.id, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[11px] font-medium py-1 px-1.5 rounded-lg outline-none cursor-pointer"
                              style={{
                                background: T.bg,
                                border: `1px solid ${T.border}`,
                                color: T.ink
                              }}
                            >
                              <option value="todo">To Do</option>
                              <option value="in_progress">In Progress</option>
                              <option value="review">Under Review</option>
                              {(isOwnerOrManager || isSelfTask(task)) && <option value="completed">Done (Completed)</option>}
                            </select>
                          )}

                          {!isViewer && (isOwnerOrManager || !task.assignedTo || isSelfTask(task)) && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEdit(task);
                                }}
                                className="p-1 rounded-lg hover:bg-black/5 text-inkSoft"
                                title="Edit Task"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(task.id);
                                }}
                                className="p-1 rounded-lg hover:bg-red-50 text-red-600"
                                title="Delete Task"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}

                  {columnTasks.length === 0 && (
                    <div className="h-32 flex flex-col items-center justify-center text-center p-4 rounded-xl border border-dashed border-black/10">
                      <p className="text-xs" style={{ color: T.inkFaint }}>
                        No tasks in {col.label.toLowerCase()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ================= LIST / TABLE VIEW ================= */
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{
                    background: "rgba(0,0,0,0.02)",
                    borderBottom: `1px solid ${T.border}`,
                    color: T.inkSoft
                  }}
                >
                  <th className="py-3 px-4 w-10">Done</th>
                  <th className="py-3 px-4">Task Details</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filteredTasks.map((task) => {
                  const isCompleted = task.status === "completed";
                  const isOverdue = !isCompleted && task.dueDate && task.dueDate < today;
                  const priorityObj =
                    PRIORITY_LEVELS.find((p) => p.id === task.priority) || PRIORITY_LEVELS[1];
                  const assignee = users.find((u) => u.id === task.assignedTo);

                  return (
                    <tr
                      key={task.id}
                      onClick={() => handleOpenEdit(task)}
                      className="hover:bg-black/[0.015] transition-colors cursor-pointer"
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          disabled={isViewer || (isCompleted && !isOwnerOrManager && !isSelfTask(task))}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isViewer && (!isCompleted || isOwnerOrManager || isSelfTask(task))) handleToggleComplete(task);
                          }}
                          title={
                            isCompleted
                              ? (isOwnerOrManager || isSelfTask(task))
                                ? "Click to reopen task"
                                : "Completed task (Locked by Owner/Manager)"
                              : (isOwnerOrManager || isSelfTask(task))
                              ? "Click to mark Completed"
                              : "Click to submit for Under Review"
                          }
                          className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                            isCompleted
                              ? "bg-emerald-600 text-white"
                              : task.status === "review"
                              ? "bg-amber-500 text-white"
                              : "border border-black/20 hover:border-blue-600"
                          } ${(isViewer || (isCompleted && !isOwnerOrManager && !isSelfTask(task))) ? "cursor-not-allowed opacity-80" : ""}`}
                        >
                          {isCompleted && <Check size={13} strokeWidth={2.5} />}
                          {task.status === "review" && !isCompleted && <Clock size={12} strokeWidth={2.5} />}
                        </button>
                      </td>

                      {/* Title & Notes & Attachment */}
                      <td className="py-3 px-4">
                        <div
                          className={`font-medium ${
                            isCompleted ? "line-through opacity-50" : ""
                          }`}
                          style={{ color: T.ink }}
                        >
                          {task.title}
                        </div>
                        {task.description && (
                          <div
                            className="text-xs line-clamp-1 mt-0.5"
                            style={{ color: T.inkSoft }}
                          >
                            {task.description}
                          </div>
                        )}
                        {task.attachment && (
                          <div className="mt-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openPdfViewer(task.attachment);
                              }}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold border transition-all hover:opacity-85 shadow-sm"
                              style={{
                                background: "rgba(220, 38, 38, 0.05)",
                                borderColor: "rgba(220, 38, 38, 0.2)",
                                color: "#DC2626"
                              }}
                              title="View attached PDF"
                            >
                              <FileText size={12} />
                              <span className="truncate max-w-[160px]">{task.attachment.name}</span>
                              <span className="text-[10px] opacity-70">({formatFileSize(task.attachment.size)})</span>
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-md"
                          style={{ background: "rgba(0,0,0,0.04)", color: T.ink }}
                        >
                          {task.category || "General"}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-4">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-md"
                          style={{
                            background: priorityObj.bg,
                            color: priorityObj.color
                          }}
                        >
                          {priorityObj.label}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {isViewer || (task.status === "completed" && !isOwnerOrManager && !isSelfTask(task)) ? (
                          <span className="text-xs font-medium py-1 px-2 rounded-lg opacity-80" style={{ background: T.bg, color: T.ink }}>
                            {task.status === "completed" ? "Completed (Locked)" : task.status === "in_progress" ? "In Progress" : task.status === "review" ? "Review" : "To Do"}
                          </span>
                        ) : (
                          <select
                            value={task.status || "todo"}
                            onChange={(e) => handleChangeStatus(task.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-medium py-1 px-2 rounded-lg outline-none cursor-pointer"
                            style={{
                              background: T.bg,
                              border: `1px solid ${T.border}`,
                              color: T.ink
                            }}
                          >
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="review">Under Review</option>
                            {(isOwnerOrManager || isSelfTask(task)) && <option value="completed">Completed</option>}
                          </select>
                        )}
                      </td>

                      {/* Assignee */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                            style={{
                              background: assignee ? T.navyWash : "rgba(0,0,0,0.06)",
                              color: assignee ? T.navy : T.inkFaint
                            }}
                          >
                            {assignee?.name ? assignee.name[0].toUpperCase() : <User size={11} />}
                          </div>
                          <span className="text-xs font-medium truncate max-w-[120px]" style={{ color: T.ink }}>
                            {assignee ? assignee.name : "Unassigned"}
                          </span>
                        </div>
                      </td>

                      {/* Due Date */}
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs font-medium ${
                            isOverdue ? "text-red-600 font-semibold" : ""
                          }`}
                          style={{ color: isOverdue ? T.red : T.ink }}
                        >
                          {task.dueDate
                            ? new Date(task.dueDate).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric"
                              })
                            : "—"}
                          {isOverdue && " (Overdue)"}
                        </span>
                      </td>

                      {/* Actions */}
                      {!isViewer && (
                        <td className="py-3 px-4 text-right">
                          {(isOwnerOrManager || !task.assignedTo || isSelfTask(task)) && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEdit(task);
                                }}
                                className="p-1.5 rounded-lg hover:bg-black/5"
                                style={{ color: T.inkSoft }}
                                title="Edit task"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(task.id);
                                }}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"
                                title="Delete task"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ================= MODAL: CREATE / EDIT TASK ================= */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTask ? "Edit Task" : "Create New Task"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div
              className="p-3 rounded-xl text-xs flex items-center gap-2"
              style={{ background: T.redWash, color: T.red }}
            >
              <AlertCircle size={15} />
              <span>{formError}</span>
            </div>
          )}

          <Field label="Task Title *">
            <Input
              type="text"
              required
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. Follow up on unpaid invoice #INV-104"
            />
          </Field>

          <Field label="Description / Detailed Notes">
            <textarea
              rows={3}
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="Add relevant context, customer contact notes, or requirements..."
              className="w-full text-sm p-3 rounded-xl outline-none resize-none transition-all"
              style={{
                background: T.bg,
                border: `1px solid ${T.border}`,
                color: T.ink
              }}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Priority">
              <Select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value)}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent</option>
              </Select>
            </Field>

            <Field label="Category">
              <Select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
              >
                {TASK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Assign Team Member">
              <Select
                value={formAssignedTo}
                onChange={(e) => setFormAssignedTo(e.target.value)}
              >
                <option value="">Unassigned</option>
                {users
                  .filter((u) => {
                    const isOwnerOrManager = (ctx.role || currentUser?.role) === "Owner" || (ctx.role || currentUser?.role) === "Manager";
                    if (isOwnerOrManager) return true;
                    return u.id === currentUser?.id || u.name === currentUser?.name;
                  })
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role}) {u.id === currentUser?.id ? "(Myself)" : ""}
                    </option>
                  ))}
              </Select>
            </Field>

            <Field label="Due Date">
              <Input
                type="date"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Task Status"
            hint={editingTask?.status === "completed" && !isOwnerOrManager ? "Completed tasks can only be reopened by Owner or Manager" : undefined}
          >
            <Select
              value={formStatus}
              disabled={editingTask?.status === "completed" && !isOwnerOrManager}
              onChange={(e) => setFormStatus(e.target.value)}
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Under Review (Submit for Approval)</option>
              {isOwnerOrManager && <option value="completed">Completed</option>}
            </Select>
          </Field>

          {/* PDF Attachment Field */}
          <Field label="Attach PDF Document" hint="Optional • Max 10MB">
            {!formAttachment ? (
              <label
                className="flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-black/[0.02] transition-colors"
                style={{ borderColor: T.border }}
              >
                <UploadCloud size={24} style={{ color: T.navy }} className="mb-1.5" />
                <span className="text-xs font-semibold" style={{ color: T.ink }}>
                  Click to browse or drag & drop PDF
                </span>
                <span className="text-[11px] mt-0.5" style={{ color: T.inkSoft }}>
                  Invoices, POs, contracts, or receipt documents (PDF only)
                </span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            ) : (
              <div
                className="rounded-2xl p-3.5 border flex items-center justify-between gap-3"
                style={{
                  background: "rgba(220, 38, 38, 0.04)",
                  borderColor: "rgba(220, 38, 38, 0.2)"
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "#FEE2E2", color: "#DC2626" }}
                  >
                    <FileText size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate" style={{ color: T.ink }}>
                      {formAttachment.name}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: T.inkSoft }}>
                      {formatFileSize(formAttachment.size)} • PDF Document
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => openPdfViewer(formAttachment)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border shadow-sm transition-all hover:bg-white"
                    style={{ background: T.surface, borderColor: T.border, color: T.ink }}
                    title="View PDF"
                  >
                    <Eye size={13} />
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormAttachment(null)}
                    className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                    title="Remove PDF"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}
          </Field>

          <div className="flex items-center justify-end gap-2.5 pt-3">
            <Btn
              variant="secondary"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </Btn>
            <Btn type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving..." : editingTask ? "Update Task" : "Create Task"}
            </Btn>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: DELETE CONFIRMATION ================= */}
      <Modal
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Task"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: T.inkSoft }}>
            Are you sure you want to delete this task? This action cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Btn variant="secondary" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Btn>
            <Btn
              variant="danger"
              onClick={() => handleDelete(deleteConfirmId)}
            >
              Delete
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
