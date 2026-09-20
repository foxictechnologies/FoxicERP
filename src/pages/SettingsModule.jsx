/**
 * pages/SettingsModule.jsx
 * -------------------------------------------------------------------------
 * The "Settings" tab — company profile, GST registration, invoice number
 * prefix/counter, and bank details (including the UPI ID used for the
 * payment QR code on invoices — see components/UpiQr.jsx).
 * -------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { Save, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { T, INDIAN_STATES } from "../lib/constants";
import { Card, Field, Input, Select, Btn, SectionHeader } from "../components/ui";
import { updateRow } from "../lib/db";
import { lookupPincode } from "../lib/pincode";

export default function SettingsModule({ ctx }) {
  const { company, setCompany, role } = ctx;

  if (role !== "Owner") {
    return (
      <Card className="p-8 text-center max-w-md mx-auto my-12">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
          style={{ background: T.redWash, color: T.red }}
        >
          <AlertTriangle size={24} />
        </div>
        <h3 className="text-base font-bold mb-1" style={{ color: T.ink }}>
          Access Restricted
        </h3>
        <p className="text-xs" style={{ color: T.inkFaint }}>
          Settings page sirf Owner hi access kar sakte hain. Aapke paas permissions nahi hain.
        </p>
      </Card>
    );
  }

  const [form, setForm] = useState(company);
  const [saved, setSaved] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinSuccessMsg, setPinSuccessMsg] = useState("");

  const set = (k, v) => setForm({ ...form, [k]: v });

  const handlePinChange = async (pinVal) => {
    const clean = pinVal.replace(/\D/g, "").slice(0, 6);
    set("pin", clean);
    setPinSuccessMsg("");

    if (clean.length === 6) {
      setPinLoading(true);
      try {
        const res = await lookupPincode(clean);
        if (res.success) {
          setForm((prev) => ({
            ...prev,
            pin: clean,
            city: res.city || prev.city,
            state: res.state || prev.state
          }));
          setPinSuccessMsg(`Auto-detected: ${res.city ? res.city + ", " : ""}${res.state}`);
          setTimeout(() => setPinSuccessMsg(""), 3500);
        }
      } catch (err) {
        console.warn("Pincode lookup error:", err);
      } finally {
        setPinLoading(false);
      }
    }
  };

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
            <Field label="Owner name"><Input allow="alpha" value={form.ownerName || ""} onChange={(e) => set("ownerName", e.target.value)} placeholder="Proprietor / director name (letters only)" /></Field>
            <Field label="Address"><Input value={form.address || ""} onChange={(e) => set("address", e.target.value)} placeholder="Building, street, area" /></Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="PIN code" hint={pinLoading ? "Fetching location..." : pinSuccessMsg || "Auto-fills City & State"}>
                <div className="relative">
                  <Input allow="pincode" value={form.pin || ""} onChange={(e) => handlePinChange(e.target.value)} placeholder="6-digit PIN" />
                  {pinLoading && <Loader2 size={14} className="animate-spin absolute right-3 top-3 text-blue-500 pointer-events-none" />}
                </div>
              </Field>
              <Field label="City"><Input allow="alpha" value={form.city || ""} onChange={(e) => set("city", e.target.value)} placeholder="City (letters only)" /></Field>
              <Field label="State"><Select value={form.state || INDIAN_STATES[0]} onChange={(e) => set("state", e.target.value)}>{INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
            </div>
            {pinSuccessMsg && (
              <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 size={13} className="shrink-0" />
                <span>{pinSuccessMsg}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2"><Field label="Phone"><Input allow="phone" value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} placeholder="+91 XXXXX XXXXX" /></Field><Field label="Email"><Input type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} placeholder="accounts@yourbusiness.in" /></Field></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3" style={{ color: T.ink }}>GST & tax registration</div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2"><Field label="GSTIN"><Input allow="gstin" value={form.gstin || ""} onChange={(e) => set("gstin", e.target.value)} placeholder="15-digit GSTIN" /></Field><Field label="PAN"><Input allow="pan" value={form.pan || ""} onChange={(e) => set("pan", e.target.value)} placeholder="10-character PAN" /></Field></div>
            <Field label="Default GST rate"><Select value={form.defaultGstRate || 18} onChange={(e) => set("defaultGstRate", Number(e.target.value))}>{[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}</Select></Field>
            <Field label="Financial year"><Input value={form.financialYear || ""} onChange={(e) => set("financialYear", e.target.value)} placeholder="e.g. 2025-26" /></Field>
            <div className="text-xs px-3 py-2 rounded-lg flex items-start gap-2" style={{ background: T.amberWash, color: T.amber }}><AlertTriangle size={14} className="shrink-0 mt-0.5" />e-Invoice/IRN and e-Way Bill generation require a licensed GSP integration and are not connected here. Always confirm current GST rules with your CA before filing.</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3" style={{ color: T.ink }}>Invoice configuration</div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2"><Field label="Invoice prefix"><Input value={form.invoicePrefix || ""} onChange={(e) => set("invoicePrefix", e.target.value)} placeholder="e.g. INV/24-25/" /></Field><Field label="Next invoice #"><Input type="number" min="1" value={form.nextInvoiceNumber || 1} onChange={(e) => set("nextInvoiceNumber", Math.max(1, Number(e.target.value)))} placeholder="e.g. 1" /></Field></div>
            <Field label="Payment terms"><Input value={form.paymentTerms || ""} onChange={(e) => set("paymentTerms", e.target.value)} placeholder="e.g. Payment due within 15 days" /></Field>
            <Field label="Terms & conditions"><Input value={form.termsAndConditions || ""} onChange={(e) => set("termsAndConditions", e.target.value)} placeholder="Shown at the bottom of invoices" /></Field>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3" style={{ color: T.ink }}>Bank details</div>
          <div className="space-y-3">
            <Field label="Bank name"><Input allow="alpha" value={form.bankName || ""} onChange={(e) => set("bankName", e.target.value)} placeholder="e.g. HDFC Bank" /></Field>
            <div className="grid grid-cols-2 gap-2"><Field label="Account number"><Input allow="numeric" value={form.bankAccount || ""} onChange={(e) => set("bankAccount", e.target.value)} placeholder="Account number (digits only)" /></Field><Field label="IFSC code"><Input allow="ifsc" value={form.bankIfsc || ""} onChange={(e) => set("bankIfsc", e.target.value)} placeholder="e.g. HDFC0001234" /></Field></div>
            <Field label="UPI ID (VPA)" hint="Used to generate the payment QR code shown on invoices"><Input value={form.upiId || ""} onChange={(e) => set("upiId", e.target.value)} placeholder="e.g. yourbusiness@okhdfcbank" /></Field>
          </div>
        </Card>
      </div>
    </div>
  );
}
