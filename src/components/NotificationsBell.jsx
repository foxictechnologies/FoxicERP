/**
 * components/NotificationsBell.jsx
 * -------------------------------------------------------------------------
 * The bell icon in the header. Not a separate database table — it's
 * computed live from data already loaded (low stock, overdue invoices,
 * recent payments), scoped to what the current role is allowed to see.
 * To add a new notification type, add another `items.push(...)` guarded by
 * the appropriate `canSeeX` check.
 * -------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { Bell } from "lucide-react";
import { T } from "../lib/constants";
import { INR } from "../lib/format";
import { Badge } from "./ui";

export default function NotificationsBell({ ctx }) {
  const [open, setOpen] = useState(false);
  const { role, currentUser, products, invoices, invoiceBalance, payments, tasks = [] } = ctx;
  const canSeeFinance = role === "Owner" || role === "Accountant";
  const canSeeSales = canSeeFinance || role === "Sales";
  const canSeeInventory = role === "Owner" || role === "Inventory";

  const items = [];

  // Task Notifications for Assigned Users (New Task Assigned & Task Updated)
  if (currentUser) {
    const uId = currentUser.id;
    const uName = currentUser.name;
    const uEmail = currentUser.email;

    const myAssignedTasks = tasks.filter((t) =>
      t.assignedTo && (
        t.assignedTo === uId ||
        (uName && t.assignedTo === uName) ||
        (uEmail && t.assignedTo === uEmail)
      )
    );

    myAssignedTasks.forEach((t) => {
      if (t.status !== "completed") {
        // 1. New Task Assigned Notification
        items.push({
          type: "New Task Assigned",
          tone: "blue",
          text: `You have been assigned task "${t.title}". Check your To-Do list for details.`,
          time: t.createdAt || t.updatedAt
        });

        // 2. Task Updated Notification (ONLY IF updated by someone else like Owner/Manager, NOT by tasker themselves)
        const isUpdatedByOthers = t.updatedById ? (t.updatedById !== uId && t.updatedById !== uName) : true;
        if (isUpdatedByOthers && t.updatedAt && t.createdAt && new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime() > 1000) {
          const updaterInfo = t.updatedBy ? `${t.updatedBy}${t.updatedByRole ? ` (${t.updatedByRole})` : ""}` : "Manager/Owner";
          items.push({
            type: "Task Updated",
            tone: "purple",
            text: `Your assigned task "${t.title}" was updated by ${updaterInfo}. Check task details for changes.`,
            time: t.updatedAt
          });
        }
      }
    });
  }

  // ── Owner Pending Request Notifications ──
  if (ctx.company?.id) {
    const compId = ctx.company.id;

    // 1. Pending User Registration Requests
    try {
      const raw = localStorage.getItem(`erp_pending_user_requests_${compId}`);
      const pUsers = raw ? JSON.parse(raw) : [];
      if (Array.isArray(pUsers)) {
        pUsers.forEach((u) => {
          if (role === "Owner") {
            items.push({
              type: "New User Request",
              tone: "amber",
              text: `${u.requestedBy || "Manager"} requested to add user "${u.name}" as ${u.role}.`,
              time: u.createdAt,
              tab: "users"
            });
          }
        });
      }
    } catch (e) {}

    // 2. Pending Role Change Requests
    try {
      const raw = localStorage.getItem(`erp_pending_role_requests_${compId}`);
      const pRoles = raw ? JSON.parse(raw) : {};
      Object.entries(pRoles).forEach(([uId, req]) => {
        if (req) {
          if (req.isOwnerToOwner) {
            if (currentUser && uId === currentUser.id) {
              items.push({
                type: "Role Change Request",
                tone: "amber",
                text: `${req.requestedBy} requested to change your role to ${req.requestedRole}.`,
                time: req.createdAt,
                tab: "users"
              });
            }
          } else if (role === "Owner") {
            items.push({
              type: "Role Change Request",
              tone: "amber",
              text: `${req.requestedBy || "Manager"} requested ${req.requestedRole} role update for a team member.`,
              time: req.createdAt,
              tab: "users"
            });
          }
        }
      });
    } catch (e) {}

    // 3. Pending Member Action Requests (Deactivate / Reactivate / Delete)
    try {
      const raw = localStorage.getItem(`erp_pending_member_actions_${compId}`);
      const pActions = raw ? JSON.parse(raw) : {};
      Object.values(pActions).forEach((act) => {
        if (act && act.action && role === "Owner") {
          items.push({
            type: `Member ${act.action.toUpperCase()} Request`,
            tone: "red",
            text: `${act.requestedBy || "Manager"} requested to ${act.action} member "${act.targetUserName}".`,
            time: act.createdAt,
            tab: "users"
          });
        }
      });
    } catch (e) {}
  }

  const unreadEmails = (ctx.emails || []).filter(e => !e.is_read && e.folder !== "trash");
  unreadEmails.forEach((e) => items.push({
    type: "New Email",
    tone: "blue",
    text: `From ${e.sender_name || e.sender_email}: ${e.subject}`,
    time: e.received_at
  }));
  if (canSeeInventory) products.filter((p) => p.currentStock <= p.reorderLevel).forEach((p) => items.push({ type: "Low stock", tone: "amber", text: `${p.name} — only ${p.currentStock} ${p.unit} left`, time: null }));
  if (canSeeSales) invoices.filter((i) => (i.status === "Sent" || i.status === "Overdue") && invoiceBalance(i) > 0 && new Date(i.dueDate) < new Date()).forEach((i) => items.push({ type: "Overdue", tone: "red", text: `${i.number} is overdue — ${INR(invoiceBalance(i))} due`, time: i.dueDate }));
  if (canSeeFinance) payments.slice(0, 5).forEach((p) => items.push({ type: "Payment received", tone: "green", text: `${INR(p.amount)} received against ${p.refNumber}`, time: p.date }));

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative p-1.5 rounded-lg hover:bg-gray-100">
        <Bell size={16} color={T.inkSoft} />
        {items.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-semibold text-white" style={{ background: T.red }}>{items.length > 9 ? "9+" : items.length}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl shadow-lg z-40 max-h-96 overflow-y-auto" style={{ background: T.surface, border: `1px solid ${T.border}` }} onMouseLeave={() => setOpen(false)}>
          <div className="px-3 py-2 text-xs font-semibold" style={{ borderBottom: `1px solid ${T.border}`, color: T.ink }}>Notifications</div>
          {items.length === 0 ? <div className="px-3 py-6 text-xs text-center" style={{ color: T.inkFaint }}>You're all caught up.</div> : items.map((n, i) => (
            <div
              key={i}
              className={`px-3 py-2.5 text-xs ${n.tab ? "cursor-pointer hover:bg-gray-50 transition-colors" : ""}`}
              style={{ borderBottom: `1px solid ${T.borderSoft}` }}
              onClick={() => {
                if (n.tab && ctx.setActiveTab) {
                  ctx.setActiveTab(n.tab);
                  setOpen(false);
                }
              }}
            >
              <Badge tone={n.tone}>{n.type}</Badge>
              <div className="mt-1 font-medium" style={{ color: T.ink }}>{n.text}</div>
              {n.time && (
                <div className="text-[10px] mt-1" style={{ color: T.inkFaint }}>
                  {new Date(n.time).toLocaleString("en-IN")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
