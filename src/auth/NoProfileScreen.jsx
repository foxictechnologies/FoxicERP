/**
 * auth/NoProfileScreen.jsx
 * -------------------------------------------------------------------------
 * Shown when someone has valid Supabase Auth credentials (they ARE who
 * they say they are) but there's no matching, Active row for them in the
 * `profiles` table — e.g. the Owner hasn't added them yet, or their
 * account was deactivated. This is the "authenticated but not authorized"
 * state. See App.jsx's data-loading effect for where this is triggered.
 * -------------------------------------------------------------------------
 */

import React from "react";
import { AlertTriangle } from "lucide-react";
import { T } from "../lib/constants";
import { Card, Btn } from "../components/ui";

export default function NoProfileScreen({ email, onSignOut }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: T.bg }}>
      <Card className="p-6 max-w-sm text-center">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: T.amberWash }}><AlertTriangle size={20} color={T.amber} /></div>
        <div className="font-semibold text-sm mb-1" style={{ color: T.ink }}>Account not set up yet</div>
        <div className="text-xs mb-4" style={{ color: T.inkFaint }}>
          <b>{email}</b> is a valid login but isn't linked to a business profile, or the account has been deactivated. Ask your business Owner to add you under <b>Users &amp; Access Log</b>, or check your Supabase <code>profiles</code> table.
        </div>
        <Btn variant="secondary" onClick={onSignOut}>Sign out</Btn>
      </Card>
    </div>
  );
}
