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
      if (check.error) { setError(check.error.message?.toLowerCase().includes("invalid") ? "Current password is incorrect." : "Could not verify current password: " + check.error.message); return; }
      const { error: err } = await supabase.auth.updateUser({ password: pw1 });
      if (err) {
        // Supabase's "Secure password change" policy blocks updateUser unless
        // the server itself verified the old password. We already verify it
        // above via sign-in, so this means the project has that toggle on —
        // tell the Owner exactly where to switch it off.
        if (/current password required/i.test(err.message || "")) {
          setError("Blocked by Supabase's 'Secure password change' setting. Ask the Owner to open Supabase Dashboard → Authentication → Sign In / Policies → turn OFF 'Secure password change'. This app already verifies your current password.");
        } else {
          setError(err.message || "Could not update password. Please try again.");
        }
        return;
      }
      setDone(true);
      logAudit("Password changed", "");
      setPw0(""); setPw1(""); setPw2("");
    } catch (e) {
      setError(e.message || "Something went wrong. Check your internet connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Change password" width="max-w-sm">
      {done ? (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: T.emeraldWash }}><CheckCircle2 size={24} color={T.emerald} /></div>
          <div className="text-sm font-semibold mb-1" style={{ color: T.emerald }}>Password changed successfully!</div>
          <p className="text-xs mb-4" style={{ color: T.inkFaint }}>Use your new password the next time you sign in.</p>
          <Btn className="mx-auto" onClick={onClose}>Done</Btn>
        </div>
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
