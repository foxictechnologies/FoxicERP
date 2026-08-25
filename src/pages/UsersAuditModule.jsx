/**
 * pages/UsersAuditModule.jsx
 * -------------------------------------------------------------------------
 * The "Users & Access Log" tab — Owner-only (enforced both here in the UI
 * AND by the `owner reads audit log` / `owner manages team` RLS policies
 * in supabase-schema.sql, so this isn't just a UI gate).
 *
 * Adding a team member is a two-step process by design: the Owner must
 * first create their login in the Supabase dashboard (Authentication ->
 * Users), THEN paste that user's ID here to grant them a role. This is
 * deliberate — creating passworded logins from a public frontend safely
 * requires a server-side admin key, which we don't want to expose in the
 * browser. See the in-app instructions in this file's "Add team member"
 * modal, and the README for more detail.
 * -------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { Plus, Lock, History, Save, Search } from "lucide-react";
import { T, ROLES } from "../lib/constants";
import { Card, Badge, Btn, Field, Input, Select, Modal, EmptyState, SectionHeader } from "../components/ui";
import { insertRow, updateRow } from "../lib/db";

export default function UsersAuditModule({ ctx }) {
  const { users, setUsers, auditLog, currentUser, role, company } = ctx;
  const [showForm, setShowForm] = useState(false);
  const [q, setQ] = useState("");
  const blank = () => ({ authUserId: "", name: "", role: "Sales" });
  const [form, setForm] = useState(blank());

  if (role !== "Owner") return <Card className="p-6"><EmptyState icon={Lock} title="Owner access only" subtitle="User management and the login/activity log are visible to the business owner only." /></Card>;

  const addUser = async () => {
    if (!form.authUserId || !form.name) return;
    try {
      const row = await insertRow("profiles", { id: form.authUserId.trim(), companyId: company.id, name: form.name, role: form.role, status: "Active" });
      setUsers((prev) => [...prev, row]);
      ctx.logAudit("User account created", `${form.name} as ${form.role}`);
      setShowForm(false);
    } catch (e) { alert("Couldn't add user — check the Auth User ID is correct and not already linked to a profile.\n\n" + e.message); }
  };
  const toggleStatus = async (u) => {
    if (u.id === currentUser.id) return;
    if (u.role === "Owner" && u.status === "Active" && !confirm("Deactivating the only Owner role account can lock everyone out of user management. Continue?")) return;
    try {
      const row = await updateRow("profiles", u.id, { status: u.status === "Active" ? "Deactivated" : "Active" });
      setUsers((prev) => prev.map((x) => x.id === row.id ? row : x));
      ctx.logAudit(u.status === "Active" ? "User deactivated" : "User reactivated", `${u.name}`);
    } catch (e) { alert("Could not update user status: " + e.message); }
  };
  const changeRole = async (u, newRole) => {
    try {
      const row = await updateRow("profiles", u.id, { role: newRole });
      setUsers((prev) => prev.map((x) => x.id === row.id ? row : x));
      ctx.logAudit("User role changed", `${u.name}: ${u.role} → ${newRole}`);
    } catch (e) { alert("Could not change role: " + e.message); }
  };

  const filteredLog = auditLog.filter((l) => !q || l.userName.toLowerCase().includes(q.toLowerCase()) || l.action.toLowerCase().includes(q.toLowerCase()));
  const loginEvents = auditLog.filter((l) => l.action === "Login" || l.action === "Logout");

  return (
    <div>
      <SectionHeader title="Users & Access Log" subtitle="Manage who can sign in, what they can see, and review every login and change to the business" action={<Btn icon={Plus} onClick={() => { setForm(blank()); setShowForm(true); }}>New User</Btn>} />

      <div className="text-sm font-semibold mb-2" style={{ color: T.ink }}>Team members</div>
      <Card className="mb-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{["Name", "Role", "Status", "Last login", ""].map((h) => <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: T.inkFaint }}>{h}</th>)}</tr></thead>
            <tbody>{users.map((u) => { const lastLogin = auditLog.find((l) => l.userId === u.id && l.action === "Login"); return (
              <tr key={u.id} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                <td className="px-4 py-2.5 font-medium" style={{ color: T.ink }}>{u.name}{u.id === currentUser.id && <span className="ml-1.5"><Badge tone="navy">You</Badge></span>}</td>
                <td className="px-4 py-2.5"><Select value={u.role} onChange={(e) => changeRole(u, e.target.value)} style={{ width: 150, padding: "4px 8px" }} disabled={u.id === currentUser.id}>{Object.keys(ROLES).map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}</Select></td>
                <td className="px-4 py-2.5"><Badge tone={u.status === "Active" ? "green" : "red"}>{u.status}</Badge></td>
                <td className="px-4 py-2.5 text-xs" style={{ color: T.inkFaint }}>{lastLogin ? new Date(lastLogin.timestamp).toLocaleString("en-IN") : "Never"}</td>
                <td className="px-4 py-2.5 text-right"><Btn size="sm" variant={u.status === "Active" ? "danger" : "secondary"} onClick={() => toggleStatus(u)} disabled={u.id === currentUser.id}>{u.status === "Active" ? "Deactivate" : "Reactivate"}</Btn></td>
              </tr>); })}</tbody>
          </table>
        </div>
      </Card>

      <div className="text-sm font-semibold mb-2" style={{ color: T.ink }}>Login activity</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        {loginEvents.slice(0, 9).map((l) => (
          <Card key={l.id} className="p-3"><div className="flex items-center justify-between"><span className="text-xs font-medium" style={{ color: T.ink }}>{l.userName}</span><Badge tone={l.action === "Login" ? "green" : "neutral"}>{l.action}</Badge></div><div className="text-[11px] mt-1" style={{ color: T.inkFaint }}>{l.role} · {new Date(l.timestamp).toLocaleString("en-IN")}</div></Card>
        ))}
        {loginEvents.length === 0 && <div className="col-span-3"><EmptyState icon={History} title="No login activity yet" /></div>}
      </div>

      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="text-sm font-semibold" style={{ color: T.ink }}>Full audit trail</div>
        <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: T.surface, border: `1px solid ${T.border}` }}><Search size={13} color={T.inkFaint} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by user or action…" className="outline-none text-xs" style={{ color: T.ink }} /></div>
      </div>
      <Card>
        {filteredLog.length === 0 ? <EmptyState icon={History} title="No activity recorded yet" subtitle="Every login, invoice, payment, and record change made by your team will appear here." /> : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{["Time", "User", "Role", "Action", "Details"].map((h) => <th key={h} className="text-left px-4 py-2 text-xs font-medium sticky top-0" style={{ color: T.inkFaint, background: T.surface }}>{h}</th>)}</tr></thead>
              <tbody>{filteredLog.map((l) => (
                <tr key={l.id} style={{ borderBottom: `1px solid ${T.borderSoft}` }}><td className="px-4 py-2 text-xs whitespace-nowrap" style={{ color: T.inkFaint }}>{new Date(l.timestamp).toLocaleString("en-IN")}</td><td className="px-4 py-2 text-xs font-medium" style={{ color: T.ink }}>{l.userName}</td><td className="px-4 py-2 text-xs" style={{ color: T.inkFaint }}>{l.role}</td><td className="px-4 py-2 text-xs"><Badge tone={l.action.includes("Fail") || l.action.includes("deactivat") ? "red" : "neutral"}>{l.action}</Badge></td><td className="px-4 py-2 text-xs" style={{ color: T.inkFaint }}>{l.details}</td></tr>))}</tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add team member">
        <div className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: T.navyWash, color: T.navy }}>
          First create their login in <b>Supabase Dashboard → Authentication → Users → Add user</b> (email + temporary password), then paste their User ID here to grant them a role.
        </div>
        <div className="space-y-3">
          <Field label="Full name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Team member's full name" /></Field>
          <Field label="Role"><Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{Object.keys(ROLES).filter((r) => r !== "Owner").map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}</Select></Field>
          <Field label="Supabase Auth User ID" required hint="Copy from Authentication → Users in your Supabase dashboard"><Input value={form.authUserId} onChange={(e) => setForm({ ...form, authUserId: e.target.value.trim() })} placeholder="e.g. 8b1c2e4a-..." /></Field>
        </div>
        <div className="flex justify-end gap-2 mt-4"><Btn variant="secondary" onClick={() => setShowForm(false)}>Cancel</Btn><Btn icon={Save} onClick={addUser}>Add user</Btn></div>
      </Modal>
    </div>
  );
}
