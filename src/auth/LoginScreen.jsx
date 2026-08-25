/**
 * auth/LoginScreen.jsx
 * -------------------------------------------------------------------------
 * Redesigned sign-in screen — split-screen "Trust & Authority" layout:
 * left = branded value panel (hidden on mobile), right = focused auth card.
 * Authentication itself is unchanged: supabase.auth.signInWithPassword(),
 * real hashed passwords handled entirely by Supabase.
 * -------------------------------------------------------------------------
 */

import React, { useState } from "react";
import {
  Building2, Lock, Eye, EyeOff, Mail, AlertCircle, Loader2,
  ReceiptText, Boxes, Wallet, BarChart3, ShieldCheck, ArrowRight
} from "lucide-react";
import { T } from "../lib/constants";
import { supabase } from "../supabaseClient";

const FEATURES = [
  { icon: ReceiptText, title: "GST-ready invoicing", sub: "CGST, SGST & IGST handled automatically" },
  { icon: Boxes, title: "Live inventory control", sub: "Stock levels and low-stock alerts in real time" },
  { icon: Wallet, title: "Payments & receivables", sub: "UPI QR codes, part-payments and aging" },
  { icon: BarChart3, title: "Reports your CA will love", sub: "Sales, GST summary and profit insights" },
];

export default function LoginScreen({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError("Enter your email and password."); return; }
    setBusy(true); setError("");
    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (authErr) { setError(authErr.message || "Sign in failed."); return; }
    onLoggedIn(data.session);
  };

  const inputBase = {
    border: `1px solid ${T.border}`,
    background: T.bg,
    color: T.ink,
    transition: "border-color 180ms ease, box-shadow 180ms ease",
  };
  const focusInput = (e) => { e.target.style.borderColor = T.navy; e.target.style.boxShadow = `0 0 0 3px ${T.navyWash}`; };
  const blurInput = (e) => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lexend:wght@500;600;700&display=swap');`}</style>

      {/* ---------- left: branded value panel ---------- */}
      <aside className="hidden lg:flex flex-col justify-between w-[46%] xl:w-[50%] p-10 xl:p-14 relative overflow-hidden" style={{ background: "linear-gradient(165deg, #141F42 0%, #1D2B53 48%, #2A4079 100%)" }}>
        {/* decorative layers */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)", backgroundSize: "26px 26px" }} />
        <div aria-hidden="true" className="absolute pointer-events-none rounded-full" style={{ width: 420, height: 420, top: -140, right: -120, background: "radial-gradient(circle, rgba(96,140,255,0.28) 0%, rgba(96,140,255,0) 70%)" }} />
        <div aria-hidden="true" className="absolute pointer-events-none rounded-full" style={{ width: 360, height: 360, bottom: -120, left: -100, background: "radial-gradient(circle, rgba(15,157,109,0.22) 0%, rgba(15,157,109,0) 70%)" }} />

        <div className="relative flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)" }}><Building2 size={20} color="#fff" /></div>
          <div>
            <div className="text-white font-semibold text-base leading-tight" style={{ fontFamily: "Lexend, sans-serif" }}>Business ERP</div>
            <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>Built for Indian businesses</div>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-white font-semibold text-3xl xl:text-4xl leading-snug" style={{ fontFamily: "Lexend, sans-serif" }}>
            Your entire business,<br />one clear picture.
          </h1>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
            Invoices, stock, payments and reports — everything accounted for, from the first bill of the day to the year-end GST filing.
          </p>
          <ul className="mt-8 space-y-4">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-3">
                <span className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.16)" }}>
                  <f.icon size={16} color="#BFD0FF" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-white">{f.title}</span>
                  <span className="block text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>{f.sub}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2.5 rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", maxWidth: 420 }}>
          <ShieldCheck size={18} color="#6EE7B7" />
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>
            Bank-grade security — encrypted sessions via Supabase Auth, auto sign-out after inactivity, role-based access for your team.
          </p>
        </div>
      </aside>

      {/* ---------- right: auth card ---------- */}
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-10" style={{ background: T.bg }}>
        <div className="w-full max-w-[400px]">
          {/* compact brand for mobile / tablet */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ background: T.navy }}><Building2 size={20} color="#fff" /></div>
            <div className="font-semibold text-lg" style={{ color: T.ink, fontFamily: "Lexend, sans-serif" }}>Business ERP</div>
            <div className="text-xs mt-0.5" style={{ color: T.inkFaint }}>Sign in to your business account</div>
          </div>

          <div className="rounded-2xl p-7 sm:p-8" style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: "0 8px 30px rgba(29,43,83,0.08)" }}>
            <div className="hidden lg:block mb-7">
              <h2 className="font-semibold text-xl" style={{ color: T.ink, fontFamily: "Lexend, sans-serif" }}>Welcome back</h2>
              <p className="text-xs mt-1" style={{ color: T.inkFaint }}>Sign in to continue to your workspace.</p>
            </div>

            <form onSubmit={submit} className="space-y-4" noValidate>
              <label className="block">
                <span className="text-xs font-medium mb-1.5 block" style={{ color: T.inkSoft }}>Email address</span>
                <div className="relative">
                  <Mail size={15} color={T.inkFaint} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={focusInput}
                    onBlur={blurInput}
                    placeholder="you@business.in"
                    autoComplete="username"
                    required
                    className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none cursor-text"
                    style={inputBase}
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-medium mb-1.5 block" style={{ color: T.inkSoft }}>Password</span>
                <div className="relative">
                  <Lock size={15} color={T.inkFaint} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={focusInput}
                    onBlur={blurInput}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="w-full rounded-lg pl-9 pr-10 py-2.5 text-sm outline-none cursor-text"
                    style={inputBase}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
                  >
                    {showPw ? <EyeOff size={15} color={T.inkFaint} /> : <Eye size={15} color={T.inkFaint} />}
                  </button>
                </div>
              </label>

              {error && (
                <div role="alert" className="flex items-start gap-2 text-xs px-3 py-2.5 rounded-lg" style={{ background: T.redWash, color: T.red }}>
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="group w-full inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer hover:opacity-90"
                style={{ background: T.navy, color: "#fff" }}
              >
                {busy ? (<><Loader2 size={15} className="animate-spin" /> Signing in…</>) : (<>Sign in <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" /></>)}
              </button>
            </form>

            <div className="mt-5 pt-4 text-center" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
              <p className="text-[11px] leading-relaxed" style={{ color: T.inkFaint }}>
                Forgot your password? Ask your business owner to reset it from the Supabase dashboard, or use Supabase's password-reset email flow.
              </p>
            </div>
          </div>

          <p className="text-center text-[11px] mt-6" style={{ color: T.inkFaint }}>© {new Date().getFullYear()} Business ERP · India</p>
        </div>
      </main>
    </div>
  );
}
