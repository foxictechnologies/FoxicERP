/**
 * pages/SettingsModule.jsx
 * -------------------------------------------------------------------------
 * The "Settings" tab — company profile, GST registration, invoice number
 * prefix/counter, and bank details (including the UPI ID used for the
 * payment QR code on invoices — see components/UpiQr.jsx).
 * -------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { Save, AlertTriangle } from "lucide-react";
import { T, INDIAN_STATES } from "../lib/constants";
import { Card, Field, Input, Select, Btn, SectionHeader } from "../components/ui";
import { updateRow } from "../lib/db";

export default function SettingsModule({ ctx }) {
  const { company, setCompany } = ctx;
  const [form, setForm] = useState(company);
  const [saved, setSaved] = useState(false);
  const set = (k, v) => setForm({ ...form, [k]: v });
  const save = async () => {
    try {
      const row = await updateRow("companies", company.id, form);
      setCompany(row);
      ctx.logAudit("Company settings updated", "");
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) { alert("Could not save settings: " + e.message); }
  };

  return (
    <div>
      <SectionHeader title="Business Settings" subtitle="Company profile, GST registration and invoice configuration" action={<Btn icon={Save} onClick={save}>{saved ? "Saved ✓" : "Save changes"}</Btn>} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3" style={{ color: T.ink }}>Company profile</div>
          <div className="space-y-3">
            <Field label="Business name"><Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Shree Enterprises" /></Field>
            <Field label="Legal name"><Input value={form.legalName || ""} onChange={(e) => set("legalName", e.target.value)} placeholder="As per registration certificate" /></Field>
            <Field label="Owner name"><Input value={form.ownerName || ""} onChange={(e) => set("ownerName", e.target.value)} placeholder="Proprietor / director name" /></Field>
            <Field label="Address"><Input value={form.address || ""} onChange={(e) => set("address", e.target.value)} placeholder="Building, street, area" /></Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="City"><Input value={form.city || ""} onChange={(e) => set("city", e.target.value)} placeholder="City" /></Field>
              <Field label="State"><Select value={form.state || INDIAN_STATES[0]} onChange={(e) => set("state", e.target.value)}>{INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
              <Field label="PIN code"><Input value={form.pin || ""} onChange={(e) => set("pin", e.target.value)} placeholder="6-digit" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-2"><Field label="Phone"><Input value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} placeholder="+91 XXXXX XXXXX" /></Field><Field label="Email"><Input value={form.email || ""} onChange={(e) => set("email", e.target.value)} placeholder="accounts@yourbusiness.in" /></Field></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3" style={{ color: T.ink }}>GST & tax registration</div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2"><Field label="GSTIN"><Input value={form.gstin || ""} onChange={(e) => set("gstin", e.target.value)} placeholder="15-digit GSTIN" /></Field><Field label="PAN"><Input value={form.pan || ""} onChange={(e) => set("pan", e.target.value)} placeholder="10-character PAN" /></Field></div>
            <Field label="Default GST rate"><Select value={form.defaultGstRate || 18} onChange={(e) => set("defaultGstRate", Number(e.target.value))}>{[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}</Select></Field>
            <Field label="Financial year"><Input value={form.financialYear || ""} onChange={(e) => set("financialYear", e.target.value)} placeholder="e.g. 2025-26" /></Field>
            <div className="text-xs px-3 py-2 rounded-lg flex items-start gap-2" style={{ background: T.amberWash, color: T.amber }}><AlertTriangle size={14} className="shrink-0 mt-0.5" />e-Invoice/IRN and e-Way Bill generation require a licensed GSP integration and are not connected here. Always confirm current GST rules with your CA before filing.</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3" style={{ color: T.ink }}>Invoice configuration</div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2"><Field label="Invoice prefix"><Input value={form.invoicePrefix || ""} onChange={(e) => set("invoicePrefix", e.target.value)} placeholder="e.g. INV/24-25/" /></Field><Field label="Next invoice #"><Input type="number" value={form.nextInvoiceNumber || 1} onChange={(e) => set("nextInvoiceNumber", Number(e.target.value))} placeholder="e.g. 1" /></Field></div>
            <Field label="Payment terms"><Input value={form.paymentTerms || ""} onChange={(e) => set("paymentTerms", e.target.value)} placeholder="e.g. Payment due within 15 days" /></Field>
            <Field label="Terms & conditions"><Input value={form.termsAndConditions || ""} onChange={(e) => set("termsAndConditions", e.target.value)} placeholder="Shown at the bottom of invoices" /></Field>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3" style={{ color: T.ink }}>Bank details</div>
          <div className="space-y-3">
            <Field label="Bank name"><Input value={form.bankName || ""} onChange={(e) => set("bankName", e.target.value)} placeholder="e.g. HDFC Bank" /></Field>
            <div className="grid grid-cols-2 gap-2"><Field label="Account number"><Input value={form.bankAccount || ""} onChange={(e) => set("bankAccount", e.target.value)} placeholder="Account number" /></Field><Field label="IFSC code"><Input value={form.bankIfsc || ""} onChange={(e) => set("bankIfsc", e.target.value)} placeholder="e.g. HDFC0001234" /></Field></div>
            <Field label="UPI ID (VPA)" hint="Used to generate the payment QR code shown on invoices"><Input value={form.upiId || ""} onChange={(e) => set("upiId", e.target.value)} placeholder="e.g. yourbusiness@okhdfcbank" /></Field>
          </div>
        </Card>
      </div>
    </div>
  );
}
