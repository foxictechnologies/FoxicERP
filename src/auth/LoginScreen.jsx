/**
 * auth/LoginScreen.jsx
 * -------------------------------------------------------------------------
 * Liquid Glass (Liquid Glassmorphism) Premium Minimalist Login Screen.
 * Features:
 *  - Animated floating liquid gradient orbs in background
 *  - Ultra-premium frosted crystal glass card with specular highlights
 *  - Translucent liquid inputs with glowing focus borders
 *  - Interactive password eye toggle & CapsLock detection alert
 * -------------------------------------------------------------------------
 */

import React, { useState } from "react";
import {
  Lock, Eye, EyeOff, Mail, AlertCircle, Loader2,
  ArrowRight, ShieldCheck, Sparkles
} from "lucide-react";
import { supabase } from "../supabaseClient";
import foxicLogo from "../assets/foxic-logo.png";

export default function LoginScreen({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleKeyDown = (e) => {
    if (e.getModifierState) {
      setCapsLockOn(e.getModifierState("CapsLock"));
    }
  };

  const submitLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (authErr) {
        const errMsg = authErr.message || "";
        if (errMsg.toLowerCase().includes("email not confirmed")) {
          // Attempt auto-confirming via backend service
          try {
            const confirmRes = await fetch("/api/auth/confirm-user", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: email.trim() })
            });
            const confirmData = await confirmRes.json();
            if (confirmData.success) {
              // Retry login automatically after confirmation
              const retry = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password
              });
              if (!retry.error && retry.data?.session) {
                setBusy(false);
                onLoggedIn(retry.data.session);
                return;
              }
            }
          } catch (cErr) {
            console.warn("Auto-confirm retry fallback:", cErr);
          }

          setBusy(false);
          setError("Your email is not confirmed yet. Please check your inbox for the confirmation link, or ask your Business Owner to activate your profile.");
          return;
        }

        setBusy(false);
        setError(errMsg || "Sign in failed. Invalid email or password.");
        return;
      }

      setBusy(false);
      onLoggedIn(data.session);
    } catch (err) {
      setBusy(false);
      setError(err.message || "Sign in error occurred.");
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col justify-between items-center px-4 py-10 relative overflow-hidden select-none"
      style={{
        background: "#080C14",
        color: "#F8FAFC",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');

        /* Floating Liquid Orbs Animation */
        @keyframes liquidFloat1 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(60px, -40px) scale(1.15); }
        }
        @keyframes liquidFloat2 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(-50px, 50px) scale(1.2); }
        }
        @keyframes liquidFloat3 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(40px, 60px) scale(0.9); }
        }

        .orb-1 {
          position: absolute;
          width: 420px;
          height: 420px;
          top: 15%;
          left: 20%;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, rgba(79, 70, 229, 0) 70%);
          filter: blur(80px);
          animation: liquidFloat1 18s ease-in-out infinite;
          pointer-events: none;
        }

        .orb-2 {
          position: absolute;
          width: 480px;
          height: 480px;
          bottom: 10%;
          right: 15%;
          background: radial-gradient(circle, rgba(14, 165, 233, 0.35) 0%, rgba(6, 182, 212, 0) 70%);
          filter: blur(90px);
          animation: liquidFloat2 22s ease-in-out infinite;
          pointer-events: none;
        }

        .orb-3 {
          position: absolute;
          width: 380px;
          height: 380px;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: radial-gradient(circle, rgba(168, 85, 247, 0.25) 0%, rgba(147, 51, 234, 0) 70%);
          filter: blur(85px);
          animation: liquidFloat3 20s ease-in-out infinite;
          pointer-events: none;
        }

        /* Liquid Glass Card */
        .liquid-glass-card {
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(32px) saturate(190%);
          -webkit-backdrop-filter: blur(32px) saturate(190%);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 
            0 30px 60px -12px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 0 rgba(255, 255, 255, 0.2),
            inset 0 -1px 0 0 rgba(255, 255, 255, 0.05);
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .liquid-glass-card:hover {
          border-color: rgba(255, 255, 255, 0.18);
          box-shadow: 
            0 35px 70px -12px rgba(0, 0, 0, 0.6),
            0 0 40px rgba(99, 102, 241, 0.15),
            inset 0 1px 0 0 rgba(255, 255, 255, 0.3);
        }

        /* Translucent Liquid Inputs */
        .liquid-input-wrapper {
          background: rgba(15, 23, 42, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .liquid-input-wrapper:focus-within {
          background: rgba(15, 23, 42, 0.75);
          border-color: #38BDF8;
          box-shadow: 
            0 0 0 3px rgba(56, 189, 248, 0.25),
            inset 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        /* Liquid Glow Button */
        .btn-liquid {
          background: linear-gradient(135deg, #3B82F6 0%, #6366F1 50%, #8B5CF6 100%);
          background-size: 200% 200%;
          animation: gradientShift 8s ease infinite;
          box-shadow: 0 8px 25px -5px rgba(99, 102, 241, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3);
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .btn-liquid:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 30px -5px rgba(99, 102, 241, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.4);
        }
        .btn-liquid:active:not(:disabled) {
          transform: translateY(0);
        }
      `}</style>

      {/* Floating Liquid Background Blobs */}
      <div className="orb-1" />
      <div className="orb-2" />
      <div className="orb-3" />

      {/* Top spacing */}
      <div />

      {/* Main Container */}
      <main className="w-full max-w-[390px] relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative mb-3 group cursor-pointer">
            {/* Glowing Logo ring */}
            <div className="w-16 h-16 rounded-2xl p-[1.5px] bg-gradient-to-tr from-cyan-400 via-indigo-500 to-purple-500 shadow-xl shadow-indigo-500/25 transition-transform duration-500 group-hover:scale-105">
              <div className="w-full h-full rounded-[14px] bg-slate-950/90 backdrop-blur-md flex items-center justify-center overflow-hidden p-1">
                <img src={foxicLogo} alt="Foxic ERP" className="w-full h-full object-cover rounded-xl" />
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 bg-cyan-500 p-1 rounded-full shadow-lg text-slate-950">
              <Sparkles size={10} />
            </div>
          </div>

          <h1
            className="font-bold text-2xl tracking-tight text-white flex items-center gap-1.5"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Foxic ERP
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium tracking-wide">
            Enterprise Intelligence &amp; Analytics
          </p>
        </div>

        {/* Liquid Glass Card */}
        <div className="liquid-glass-card rounded-3xl p-7 relative">
          <form onSubmit={submitLogin} onKeyDown={handleKeyDown} className="space-y-5" noValidate>
            {/* Email Field */}
            <div>
              <label className="text-xs font-medium block text-slate-300 mb-1.5 tracking-wide">
                Email Address
              </label>
              <div className="liquid-input-wrapper rounded-2xl relative flex items-center">
                <Mail size={16} className="text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  autoComplete="username"
                  required
                  className="w-full bg-transparent pl-10 pr-3.5 py-3 text-sm text-white placeholder-slate-500 outline-none"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300 tracking-wide">
                  Password
                </label>
                {capsLockOn && (
                  <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1 animate-pulse">
                    <AlertCircle size={10} /> CAPS LOCK ON
                  </span>
                )}
              </div>
              <div className="liquid-input-wrapper rounded-2xl relative flex items-center">
                <Lock size={16} className="text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full bg-transparent pl-10 pr-10 py-3 text-sm text-white placeholder-slate-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                  title={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div role="alert" className="flex items-start gap-2 text-xs px-3.5 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={busy}
              className="btn-liquid w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white cursor-pointer active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Authenticating…</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center text-xs text-slate-400 flex items-center gap-2 font-medium">
        <ShieldCheck size={14} className="text-cyan-400" />
        <span>Encrypted &amp; Secure Session</span>
        <span>·</span>
        <span>Foxic ERP v2.4</span>
      </footer>
    </div>
  );
}
