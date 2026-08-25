/**
 * auth/ChangePasswordModal.jsx
 * -------------------------------------------------------------------------
 * Self-service password change, opened from the header (key icon) once
 * signed in. Uses supabase.auth.updateUser() — works because the user
 * already has a valid session; no old-password re-entry is required by
 * Supabase for this flow (that's a Supabase Auth design choice, not ours).
 * Logs a "Password changed" audit entry on success.
 * -------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { CheckCircle2, KeyRound } from "lucide-react";
import { T } from "../lib/constants";
import { Modal, Field, Input, Btn } from "../components/ui";
import { supabase } from "../supabaseClient";

export default function ChangePasswordModal({ open, onClose, logAudit, email }) {
  const [pw0, setPw0] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError("");
    if (!pw0) { setError("Enter your current password."); return; }
    if (pw1.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (pw1 !== pw2) { setError("Passwords don't match."); return; }
    setBusy(true);
    try {
      // Re-verify the current password before allowing a change — otherwise
      // anyone with an unlocked/unattended session could take over the account.
      const check = await supabase.auth.signInWithPassword({ email, password: pw0 });
      if (check.error) { setError("Current password is incorrect."); return; }
      const { error: err } = await supabase.auth.updateUser({ password: pw1 });
      if (err) { setError(err.message); return; }
      setDone(true);
      logAudit("Password changed", "");
      setPw0(""); setPw1(""); setPw2("");
      setTimeout(() => { setDone(false); onClose(); }, 1200);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Change password" width="max-w-sm">
      {done ? (
        <div className="text-sm flex items-center gap-2" style={{ color: T.emerald }}><CheckCircle2 size={16} /> Password updated.</div>
      ) : (
        <div className="space-y-3">
          <Field label="Current password" required><Input type="password" value={pw0} onChange={(e) => setPw0(e.target.value)} autoComplete="current-password" /></Field>
          <Field label="New password" required><Input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" /></Field>
          <Field label="Confirm new password" required><Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Re-enter new password" autoComplete="new-password" /></Field>
          {error && <div className="text-xs px-3 py-2 rounded-lg" style={{ background: T.redWash, color: T.red }}>{error}</div>}
          <div className="flex justify-end gap-2"><Btn variant="secondary" onClick={onClose}>Cancel</Btn><Btn icon={KeyRound} onClick={submit} disabled={busy}>{busy ? "Updating…" : "Update password"}</Btn></div>
        </div>
      )}
    </Modal>
  );
}
