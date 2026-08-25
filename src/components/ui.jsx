/**
 * components/ui.jsx
 * -------------------------------------------------------------------------
 * The shared "design system" primitives used by every page in this app —
 * cards, buttons, form fields, modals, badges, the KPI card, etc.
 *
 * These are intentionally dumb/generic (no business logic, no Supabase
 * calls). If you want to restyle the whole app (colors, spacing, fonts),
 * this is the file to edit — the visual tokens live in lib/constants.js
 * (the `T` object), and these components just apply them consistently.
 *
 * Contents:
 *   Card, Badge, statusTone, Btn, Field, Input, Select, Modal,
 *   EmptyState, KpiCard, SectionHeader, CustomTooltip
 * -------------------------------------------------------------------------
 */

import React, { useEffect } from "react";
import { X, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { T } from "../lib/constants";
import { INR } from "../lib/format";

export function Card({ children, className = "", style = {} }) {
  return <div className={`rounded-xl ${className}`} style={{ background: T.surface, border: `1px solid ${T.border}`, ...style }}>{children}</div>;
}

export function Badge({ children, tone = "neutral" }) {
  const tones = { neutral: { bg: T.borderSoft, fg: T.inkSoft }, green: { bg: T.emeraldWash, fg: T.emerald }, amber: { bg: T.amberWash, fg: T.amber }, red: { bg: T.redWash, fg: T.red }, navy: { bg: T.navyWash, fg: T.navy } };
  const c = tones[tone] || tones.neutral;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: c.bg, color: c.fg }}>{children}</span>;
}

// Maps a status string (used across invoices, purchases, payments...) to a Badge tone
export function statusTone(status) {
  return { Paid: "green", "Partially Paid": "amber", Sent: "navy", Draft: "neutral", Overdue: "red", Cancelled: "red", Pending: "amber", Completed: "green" }[status] || "neutral";
}

export function Btn({ children, onClick, variant = "primary", size = "md", icon: Icon, type = "button", className = "", disabled }) {
  const base = "inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "px-2.5 py-1.5 text-xs", md: "px-3.5 py-2 text-sm", lg: "px-4 py-2.5 text-sm" };
  const variants = { primary: { background: T.navy, color: "#fff" }, secondary: { background: T.surface, color: T.ink, border: `1px solid ${T.border}` }, ghost: { background: "transparent", color: T.inkSoft }, danger: { background: T.redWash, color: T.red }, emerald: { background: T.emerald, color: "#fff" } };
  return <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${sizes[size]} ${className}`} style={variants[variant]}>{Icon && <Icon size={size === "sm" ? 14 : 16} />}{children}</button>;
}

export function Field({ label, children, required, hint }) {
  return <label className="block"><span className="text-xs font-medium mb-1 block" style={{ color: T.inkSoft }}>{label}{required && <span style={{ color: T.red }}> *</span>}</span>{children}{hint && <span className="text-[11px] block mt-0.5" style={{ color: T.inkFaint }}>{hint}</span>}</label>;
}

// Shared style object so every text input/select looks consistent.
// Exported because a few one-off inputs outside this file (e.g. inline
// selects in tables) reuse it directly instead of the <Input>/<Select>
// wrapper components.
export const inputStyle = { border: `1px solid ${T.border}`, background: T.surface, color: T.ink };

export function Input(props) {
  return <input {...props} className={`w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ${props.className || ""}`} style={{ ...inputStyle, ...(props.style || {}) }} onFocus={(e) => (e.target.style.borderColor = T.navy)} onBlur={(e) => (e.target.style.borderColor = T.border)} />;
}

export function Select(props) {
  const { style, ...rest } = props;
  return <select {...rest} className={`w-full rounded-lg px-3 py-2 text-sm outline-none ${props.className || ""}`} style={{ ...inputStyle, ...(style || {}) }}>{props.children}</select>;
}

export function Modal({ open, onClose, title, children, width = "max-w-xl" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4" style={{ background: "rgba(15,18,26,0.5)" }} onClick={onClose}>
      <div className={`w-full ${width} rounded-2xl shadow-2xl`} style={{ background: T.surface }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${T.border}` }}>
          <h3 className="font-semibold text-base" style={{ color: T.ink, fontFamily: "Lexend, sans-serif" }}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={18} color={T.inkSoft} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: T.navyWash }}><Icon size={24} color={T.navy} /></div>
      <div className="font-medium text-sm" style={{ color: T.ink }}>{title}</div>
      {subtitle && <div className="text-xs mt-1 max-w-xs" style={{ color: T.inkFaint }}>{subtitle}</div>}
      {action}
    </div>
  );
}

export function KpiCard({ label, value, delta, deltaTone, icon: Icon, iconBg, iconColor }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium" style={{ color: T.inkSoft }}>{label}</div>
          <div className="text-2xl font-semibold mt-1.5" style={{ color: T.ink, fontFamily: "Lexend, sans-serif", fontVariantNumeric: "tabular-nums" }}>{value}</div>
          {delta && <div className="flex items-center gap-1 mt-1.5 text-xs font-medium" style={{ color: deltaTone === "down" ? T.red : T.emerald }}>{deltaTone === "down" ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />} {delta}</div>}
        </div>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: iconBg }}><Icon size={17} color={iconColor} /></div>
      </div>
    </Card>
  );
}

export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div><h2 className="text-lg font-semibold" style={{ color: T.ink, fontFamily: "Lexend, sans-serif" }}>{title}</h2>{subtitle && <p className="text-xs mt-0.5" style={{ color: T.inkFaint }}>{subtitle}</p>}</div>
      {action}
    </div>
  );
}

export const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs shadow-lg" style={{ background: T.ink, color: "#fff" }}>
      <div className="font-medium mb-1">{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === "number" ? INR(p.value) : p.value}</div>)}
    </div>
  );
};
