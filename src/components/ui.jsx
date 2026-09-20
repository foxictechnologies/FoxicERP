/**
 * components/ui.jsx
 * -------------------------------------------------------------------------
 * Premium Apple-inspired shared design system.
 *
 * IMPORTANT:
 * Component APIs are intentionally preserved so existing pages do not
 * need to change. This file controls the visual language of the ERP.
 * -------------------------------------------------------------------------
 */

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ArrowUpRight, ArrowDownRight, AlertCircle, Search, ChevronDown, Check, Globe } from "lucide-react";
import { T } from "../lib/constants";
import { INR } from "../lib/format";


/* =========================================================
   CARD
   ========================================================= */

export function Card({
  children,
  className = "",
  style = {},
}) {
  return (
    <div
      className={`
        group
        relative
        overflow-hidden
        rounded-2xl
        transition-all
        duration-300
        ease-out
        hover:-translate-y-[1px]
        hover:shadow-[0_12px_40px_rgba(0,0,0,0.07)]
        ${className}
      `}
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.035)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}


/* =========================================================
   BADGE
   ========================================================= */

export function Badge({
  children,
  tone = "neutral",
}) {
  const tones = {
    neutral: {
      bg: "rgba(0,0,0,0.045)",
      fg: T.inkSoft,
    },

    green: {
      bg: T.emeraldWash,
      fg: T.emerald,
    },

    amber: {
      bg: T.amberWash,
      fg: T.amber,
    },

    red: {
      bg: T.redWash,
      fg: T.red,
    },

    navy: {
      bg: T.navyWash,
      fg: T.navy,
    },
  };

  const c = tones[tone] || tones.neutral;

  return (
    <span
      className="
        inline-flex
        items-center
        gap-1.5
        px-2.5
        py-1
        rounded-full
        text-[11px]
        font-medium
        tracking-[-0.01em]
        whitespace-nowrap
      "
      style={{
        background: c.bg,
        color: c.fg,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{
          background: c.fg,
          opacity: 0.8,
        }}
      />

      {children}
    </span>
  );
}


/* =========================================================
   STATUS → BADGE TONE
   ========================================================= */

export function statusTone(status) {
  return {
    Paid: "green",
    "Partially Paid": "amber",
    Sent: "navy",
    Draft: "neutral",
    Overdue: "red",
    Cancelled: "red",
    Pending: "amber",
    Completed: "green",
  }[status] || "neutral";
}


/* =========================================================
   BUTTON
   ========================================================= */

export function Btn({
  children,
  onClick,
  variant = "primary",
  size = "md",
  icon: Icon,
  type = "button",
  className = "",
  disabled,
}) {
  const base = `
    group
    inline-flex
    items-center
    justify-center
    gap-2
    font-medium
    rounded-xl
    select-none
    whitespace-nowrap
    transition-all
    duration-200
    ease-out
    disabled:opacity-45
    disabled:cursor-not-allowed
    disabled:hover:transform-none
    focus:outline-none
    focus-visible:ring-4
    focus-visible:ring-blue-500/10
  `;

  const sizes = {
    sm: "px-3 py-1.5 text-xs min-h-[32px]",
    md: "px-4 py-2 text-sm min-h-[38px]",
    lg: "px-5 py-2.5 text-sm min-h-[42px]",
  };

  const variants = {
    primary: {
      background: T.navy,
      color: "#FFFFFF",
      boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
    },

    secondary: {
      background: T.surface,
      color: T.ink,
      border: `1px solid ${T.border}`,
      boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
    },

    ghost: {
      background: "transparent",
      color: T.inkSoft,
    },

    danger: {
      background: T.redWash,
      color: T.red,
    },

    emerald: {
      background: T.emerald,
      color: "#FFFFFF",
      boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
    },
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`
        ${base}
        ${sizes[size]}
        ${className}
        hover:brightness-[0.97]
        active:scale-[0.985]
      `}
      style={variants[variant]}
    >
      {Icon && (
        <Icon
          size={size === "sm" ? 14 : 16}
          strokeWidth={1.8}
          className="
            transition-transform
            duration-200
            group-hover:translate-x-[1px]
          "
        />
      )}

      {children}
    </button>
  );
}

export const Button = Btn;


/* =========================================================
   FIELD
   ========================================================= */

export function Field({
  label,
  children,
  required,
  hint,
}) {
  return (
    <label className="block">
      <span
        className="
          text-[11px]
          font-medium
          mb-1.5
          block
          tracking-wide
        "
        style={{
          color: T.inkSoft,
        }}
      >
        {label}

        {required && (
          <span
            style={{
              color: T.red,
            }}
          >
            {" "}*
          </span>
        )}
      </span>

      {children}

      {hint && (
        <span
          className="text-[11px] block mt-1"
          style={{
            color: T.inkFaint,
          }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}


/* =========================================================
   INPUT
   ========================================================= */

export const inputStyle = {
  border: `1px solid ${T.border}`,
  background: T.surface,
  color: T.ink,
  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
};

/* =========================================================
   COUNTRY DIAL CODES & FLAGS DATA
   ========================================================= */

export const COUNTRY_DIAL_CODES = [
  { code: "+91", country: "India", flag: "🇮🇳", iso: "IN", maxLen: 10 },
  { code: "+1", country: "United States", flag: "🇺🇸", iso: "US", maxLen: 10 },
  { code: "+44", country: "United Kingdom", flag: "🇬🇧", iso: "GB", maxLen: 10 },
  { code: "+971", country: "United Arab Emirates", flag: "🇦🇪", iso: "AE", maxLen: 9 },
  { code: "+966", country: "Saudi Arabia", flag: "🇸🇦", iso: "SA", maxLen: 9 },
  { code: "+1", country: "Canada", flag: "🇨🇦", iso: "CA", maxLen: 10 },
  { code: "+61", country: "Australia", flag: "🇦🇺", iso: "AU", maxLen: 9 },
  { code: "+65", country: "Singapore", flag: "🇸🇬", iso: "SG", maxLen: 8 },
  { code: "+974", country: "Qatar", flag: "🇶🇦", iso: "QA", maxLen: 8 },
  { code: "+965", country: "Kuwait", flag: "🇰🇼", iso: "KW", maxLen: 8 },
  { code: "+968", country: "Oman", flag: "🇴🇲", iso: "OM", maxLen: 8 },
  { code: "+973", country: "Bahrain", flag: "🇧🇭", iso: "BH", maxLen: 8 },
  { code: "+49", country: "Germany", flag: "🇩🇪", iso: "DE", maxLen: 11 },
  { code: "+33", country: "France", flag: "🇫🇷", iso: "FR", maxLen: 9 },
  { code: "+39", country: "Italy", flag: "🇮🇹", iso: "IT", maxLen: 10 },
  { code: "+34", country: "Spain", flag: "🇪🇸", iso: "ES", maxLen: 9 },
  { code: "+31", country: "Netherlands", flag: "🇳🇱", iso: "NL", maxLen: 9 },
  { code: "+41", country: "Switzerland", flag: "🇨🇭", iso: "CH", maxLen: 9 },
  { code: "+81", country: "Japan", flag: "🇯🇵", iso: "JP", maxLen: 10 },
  { code: "+86", country: "China", flag: "🇨🇳", iso: "CN", maxLen: 11 },
  { code: "+82", country: "South Korea", flag: "🇰🇷", iso: "KR", maxLen: 10 },
  { code: "+852", country: "Hong Kong", flag: "🇭🇰", iso: "HK", maxLen: 8 },
  { code: "+886", country: "Taiwan", flag: "🇹🇼", iso: "TW", maxLen: 9 },
  { code: "+880", country: "Bangladesh", flag: "🇧🇩", iso: "BD", maxLen: 10 },
  { code: "+92", country: "Pakistan", flag: "🇵🇰", iso: "PK", maxLen: 10 },
  { code: "+94", country: "Sri Lanka", flag: "🇱🇰", iso: "LK", maxLen: 9 },
  { code: "+977", country: "Nepal", flag: "🇳🇵", iso: "NP", maxLen: 10 },
  { code: "+60", country: "Malaysia", flag: "🇲🇾", iso: "MY", maxLen: 10 },
  { code: "+62", country: "Indonesia", flag: "🇮🇩", iso: "ID", maxLen: 11 },
  { code: "+66", country: "Thailand", flag: "🇹🇭", iso: "TH", maxLen: 9 },
  { code: "+84", country: "Vietnam", flag: "🇻🇳", iso: "VN", maxLen: 10 },
  { code: "+63", country: "Philippines", flag: "🇵🇭", iso: "PH", maxLen: 10 },
  { code: "+64", country: "New Zealand", flag: "🇳🇿", iso: "NZ", maxLen: 9 },
  { code: "+27", country: "South Africa", flag: "🇿🇦", iso: "ZA", maxLen: 9 },
  { code: "+234", country: "Nigeria", flag: "🇳🇬", iso: "NG", maxLen: 10 },
  { code: "+254", country: "Kenya", flag: "🇰🇪", iso: "KE", maxLen: 9 },
  { code: "+20", country: "Egypt", flag: "🇪🇬", iso: "EG", maxLen: 10 },
  { code: "+90", country: "Turkey", flag: "🇹🇷", iso: "TR", maxLen: 10 },
  { code: "+7", country: "Russia", flag: "🇷🇺", iso: "RU", maxLen: 10 },
  { code: "+55", country: "Brazil", flag: "🇧🇷", iso: "BR", maxLen: 11 },
  { code: "+52", country: "Mexico", flag: "🇲🇽", iso: "MX", maxLen: 10 },
  { code: "+54", country: "Argentina", flag: "🇦🇷", iso: "AR", maxLen: 10 },
  { code: "+353", country: "Ireland", flag: "🇮🇪", iso: "IE", maxLen: 9 },
  { code: "+46", country: "Sweden", flag: "🇸🇪", iso: "SE", maxLen: 9 },
  { code: "+47", country: "Norway", flag: "🇳🇴", iso: "NO", maxLen: 8 },
  { code: "+45", country: "Denmark", flag: "🇩🇰", iso: "DK", maxLen: 8 },
  { code: "+358", country: "Finland", flag: "🇫🇮", iso: "FI", maxLen: 9 },
  { code: "+351", country: "Portugal", flag: "🇵🇹", iso: "PT", maxLen: 9 },
  { code: "+30", country: "Greece", flag: "🇬🇷", iso: "GR", maxLen: 10 },
  { code: "+48", country: "Poland", flag: "🇵🇱", iso: "PL", maxLen: 9 },
  { code: "+43", country: "Austria", flag: "🇦🇹", iso: "AT", maxLen: 10 },
  { code: "+32", country: "Belgium", flag: "🇧🇪", iso: "BE", maxLen: 9 },
  { code: "+972", country: "Israel", flag: "🇮🇱", iso: "IL", maxLen: 9 },
  { code: "+230", country: "Mauritius", flag: "🇲🇺", iso: "MU", maxLen: 8 },
  { code: "+960", country: "Maldives", flag: "🇲🇻", iso: "MV", maxLen: 7 },
  { code: "+975", country: "Bhutan", flag: "🇧🇹", iso: "BT", maxLen: 8 },
  { code: "+95", country: "Myanmar", flag: "🇲🇲", iso: "MM", maxLen: 9 }
];

function extractCountryAndDigits(val) {
  if (!val) return { country: COUNTRY_DIAL_CODES[0], digits: "" };
  const str = String(val).trim();
  if (str.startsWith("+")) {
    const sorted = [...COUNTRY_DIAL_CODES].sort((a, b) => b.code.length - a.code.length);
    for (const c of sorted) {
      if (str.startsWith(c.code)) {
        const digits = str.slice(c.code.length).replace(/\D/g, "");
        return { country: c, digits };
      }
    }
  }
  return { country: COUNTRY_DIAL_CODES[0], digits: str.replace(/\D/g, "") };
}

/* =========================================================
   PHONE INPUT WITH COUNTRY SELECTOR & FLAGS
   ========================================================= */

export function PhoneInput(props) {
  const {
    value = "",
    onChange,
    onFocus,
    onBlur,
    className = "",
    style = {},
    placeholder,
    disabled = false,
    ...rest
  } = props;

  const parsed = extractCountryAndDigits(value);
  const [selectedCountry, setSelectedCountry] = useState(parsed.country);
  const [digits, setDigits] = useState(parsed.digits);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [alertMsg, setAlertMsg] = useState("");
  const [shaking, setShaking] = useState(false);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const current = extractCountryAndDigits(value);
    setSelectedCountry(current.country);
    setDigits(current.digits);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      if (searchInputRef.current) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const triggerAlert = (msg) => {
    setAlertMsg(msg);
    setShaking(true);
    setTimeout(() => setShaking(false), 350);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setAlertMsg("");
    }, 2800);
  };

  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
    setIsOpen(false);
    setSearch("");
    const max = country.maxLen || 10;
    const trimmedDigits = digits.slice(0, max);
    setDigits(trimmedDigits);
    if (onChange) {
      const fullValue = trimmedDigits ? `${country.code} ${trimmedDigits}` : "";
      onChange({ target: { value: fullValue, name: rest.name } });
    }
  };

  const handleKeyDown = (e) => {
    if (
      e.key === "Backspace" ||
      e.key === "Delete" ||
      e.key === "Tab" ||
      e.key === "Escape" ||
      e.key === "Enter" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight" ||
      e.key === "ArrowUp" ||
      e.key === "ArrowDown" ||
      e.key === "Home" ||
      e.key === "End" ||
      e.ctrlKey ||
      e.metaKey
    ) {
      return;
    }

    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
      triggerAlert("Only numbers (0-9) are allowed for phone numbers.");
      return;
    }

    const max = selectedCountry.maxLen || 10;
    if (digits.length >= max) {
      e.preventDefault();
      triggerAlert(`Phone number cannot exceed ${max} digits for ${selectedCountry.country}.`);
    }
  };

  const handleDigitsChange = (e) => {
    const raw = e.target.value;
    const max = selectedCountry.maxLen || 10;
    const sanitized = raw.replace(/\D/g, "").slice(0, max);

    if (sanitized !== raw) {
      triggerAlert("Symbols and letters removed. Only digits are allowed.");
    }
    setDigits(sanitized);
    if (onChange) {
      const fullValue = sanitized ? `${selectedCountry.code} ${sanitized}` : "";
      onChange({ target: { value: fullValue, name: rest.name } });
    }
  };

  const filteredCountries = COUNTRY_DIAL_CODES.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      c.country.toLowerCase().includes(q) ||
      c.code.includes(q) ||
      c.iso.toLowerCase().includes(q)
    );
  });

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div
        className={`
          flex items-center w-full rounded-xl transition-all duration-200
          ${shaking ? "animate-shake ring-2 ring-red-500/20" : ""}
        `}
        style={{
          border: `1px solid ${alertMsg ? T.red : T.border}`,
          background: T.surface,
          boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
          ...style,
        }}
      >
        {/* Country Code Picker Trigger Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-50/70 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors rounded-l-xl border-r border-gray-200 dark:border-white/10 select-none shrink-0"
          title={`${selectedCountry.country} (${selectedCountry.code})`}
        >
          <span className="text-lg leading-none">{selectedCountry.flag}</span>
          <span className="text-xs font-semibold" style={{ color: T.ink }}>
            {selectedCountry.code}
          </span>
          <ChevronDown size={13} className={`transition-transform duration-200 opacity-60 ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {/* Digits Input */}
        <input
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={digits}
          onKeyDown={handleKeyDown}
          onChange={handleDigitsChange}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder || `e.g. 9876543210 (${selectedCountry.maxLen || 10} digits)`}
          className="w-full bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-gray-400 font-medium"
          style={{ color: T.ink }}
          {...rest}
        />
      </div>

      {/* Floating Dropdown */}
      {isOpen && (
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-50 w-72 max-h-72 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-fadeIn border border-gray-200 dark:border-white/15"
          style={{
            background: T.surface,
            backdropFilter: "blur(20px)",
            boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
          }}
        >
          {/* Search Header */}
          <div className="p-2 border-b border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10">
              <Search size={13} className="text-gray-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country or code..."
                className="w-full bg-transparent text-xs outline-none placeholder:text-gray-400"
                style={{ color: T.ink }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setIsOpen(false);
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-gray-400 hover:text-gray-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Country List */}
          <div className="overflow-y-auto max-h-56 divide-y divide-gray-100 dark:divide-white/5 py-1">
            {filteredCountries.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400">
                No matching countries found
              </div>
            ) : (
              filteredCountries.map((c) => {
                const isSelected = selectedCountry.iso === c.iso && selectedCountry.code === c.code;
                return (
                  <button
                    key={`${c.iso}-${c.code}-${c.country}`}
                    type="button"
                    onClick={() => handleCountrySelect(c)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-blue-50/70 dark:hover:bg-blue-900/20 ${
                      isSelected ? "bg-blue-50 dark:bg-blue-900/30 font-semibold text-blue-600 dark:text-blue-400" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="text-base leading-none shrink-0">{c.flag}</span>
                      <span className="truncate" style={{ color: isSelected ? undefined : T.ink }}>
                        {c.country}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pl-2 font-mono">
                      <span className="text-gray-400">{c.code}</span>
                      {isSelected && <Check size={13} className="text-blue-600 shrink-0" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Alert Tooltip */}
      {alertMsg && (
        <div
          className="absolute left-0 -bottom-6 z-20 flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md shadow-md animate-fadeIn"
          style={{
            background: "#FFF0F1",
            color: T.red,
            border: `1px solid rgba(215, 0, 21, 0.25)`,
          }}
        >
          <AlertCircle size={11} className="shrink-0" />
          <span>{alertMsg}</span>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   INPUT
   ========================================================= */

export function Input(props) {
  if (props.allow === "phone" || props.phoneWithCountry) {
    return <PhoneInput {...props} />;
  }

  const {
    className = "",
    style,
    onFocus,
    onBlur,
    onChange,
    onKeyDown,
    allow,
    type = "text",
    ...rest
  } = props;

  const [alertMsg, setAlertMsg] = useState("");
  const [shaking, setShaking] = useState(false);
  const timerRef = useRef(null);

  const triggerAlert = (msg) => {
    setAlertMsg(msg);
    setShaking(true);
    setTimeout(() => setShaking(false), 350);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setAlertMsg("");
    }, 2800);
  };

  const handleKeyDown = (e) => {
    // Always allow navigation and control keys
    if (
      e.key === "Backspace" ||
      e.key === "Delete" ||
      e.key === "Tab" ||
      e.key === "Escape" ||
      e.key === "Enter" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight" ||
      e.key === "ArrowUp" ||
      e.key === "ArrowDown" ||
      e.key === "Home" ||
      e.key === "End" ||
      e.ctrlKey ||
      e.metaKey
    ) {
      if (onKeyDown) onKeyDown(e);
      return;
    }

    if (allow === "alpha" || allow === "alphabetic") {
      if (!/^[a-zA-Z\s]$/.test(e.key)) {
        e.preventDefault();
        triggerAlert("Only letters (A-Z) and spaces are allowed.");
      }
    } else if (allow === "numeric" || allow === "digits") {
      if (!/^\d$/.test(e.key)) {
        e.preventDefault();
        triggerAlert("Only numbers (0-9) are allowed.");
      }
    } else if (allow === "decimal") {
      if (!/[\d.]/.test(e.key) || (e.key === "." && e.currentTarget.value.includes("."))) {
        e.preventDefault();
        triggerAlert("Only valid numeric values are allowed.");
      }
    } else if (allow === "pincode") {
      if (!/^\d$/.test(e.key)) {
        e.preventDefault();
        triggerAlert("Only numbers are allowed for PIN code.");
      } else if (e.currentTarget.value.length >= 6) {
        e.preventDefault();
        triggerAlert("PIN code must be maximum 6 digits.");
      }
    } else if (allow === "pan") {
      if (!/^[a-zA-Z0-9]$/.test(e.key)) {
        e.preventDefault();
        triggerAlert("Special characters and symbols are not allowed in PAN.");
      } else if (e.currentTarget.value.length >= 10) {
        e.preventDefault();
        triggerAlert("PAN number must be 10 characters.");
      }
    } else if (allow === "gstin") {
      if (!/^[a-zA-Z0-9]$/.test(e.key)) {
        e.preventDefault();
        triggerAlert("Special characters and symbols are not allowed in GSTIN.");
      } else if (e.currentTarget.value.length >= 15) {
        e.preventDefault();
        triggerAlert("GSTIN must be 15 characters.");
      }
    } else if (allow === "ifsc") {
      if (!/^[a-zA-Z0-9]$/.test(e.key)) {
        e.preventDefault();
        triggerAlert("Special characters and symbols are not allowed in IFSC.");
      } else if (e.currentTarget.value.length >= 11) {
        e.preventDefault();
        triggerAlert("IFSC code must be 11 characters.");
      }
    } else if (type === "number") {
      if (["e", "E", "+", "-", " "].includes(e.key)) {
        e.preventDefault();
        triggerAlert("Symbols, +, - and special characters are not allowed.");
      }
    }

    if (onKeyDown) onKeyDown(e);
  };

  const handleChange = (e) => {
    let val = e.target.value;
    let modified = false;

    if (allow === "alpha" || allow === "alphabetic") {
      const sanitized = val.replace(/[^a-zA-Z\s]/g, "");
      if (sanitized !== val) {
        modified = true;
        triggerAlert("Invalid characters removed. Only letters are allowed.");
      }
      val = sanitized;
    } else if (allow === "numeric" || allow === "digits") {
      const sanitized = val.replace(/\D/g, "");
      if (sanitized !== val) {
        modified = true;
        triggerAlert("Invalid characters removed. Only numbers (0-9) are allowed.");
      }
      val = sanitized;
    } else if (allow === "decimal") {
      val = val.replace(/[^\d.]/g, "");
      const parts = val.split(".");
      if (parts.length > 2) val = parts[0] + "." + parts.slice(1).join("");
    } else if (allow === "pincode") {
      val = val.replace(/\D/g, "").slice(0, 6);
    } else if (allow === "pan") {
      val = val.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10);
    } else if (allow === "gstin") {
      val = val.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 15);
    } else if (allow === "ifsc") {
      val = val.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 11);
    } else if (allow === "alphanumeric") {
      val = val.replace(/[^a-zA-Z0-9\s]/g, "");
    } else if (allow === "uppercase") {
      val = val.toUpperCase();
    }

    e.target.value = val;
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <div className="relative w-full">
      <input
        type={type}
        {...rest}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        className={`
          w-full
          rounded-xl
          px-3.5
          py-2.5
          text-sm
          outline-none
          transition-all
          duration-200
          placeholder:text-gray-400
          focus:ring-4
          focus:ring-blue-500/10
          ${shaking ? "animate-shake border-red-500 ring-2 ring-red-500/20" : ""}
          ${className}
        `}
        style={{
          ...inputStyle,
          borderColor: alertMsg ? T.red : undefined,
          ...style,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = alertMsg ? T.red : T.navy;

          if (onFocus) {
            onFocus(e);
          }
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = alertMsg ? T.red : T.border;

          if (onBlur) {
            onBlur(e);
          }
        }}
      />

      {alertMsg && (
        <div
          className="absolute left-0 -bottom-6 z-20 flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md shadow-md animate-fadeIn"
          style={{
            background: "#FFF0F1",
            color: T.red,
            border: `1px solid rgba(215, 0, 21, 0.25)`,
          }}
        >
          <AlertCircle size={11} className="shrink-0" />
          <span>{alertMsg}</span>
        </div>
      )}
    </div>
  );
}


/* =========================================================
   SELECT
   ========================================================= */

export function Select(props) {
  const {
    style,
    className = "",
    ...rest
  } = props;

  return (
    <select
      {...rest}
      className={`
        w-full
        rounded-xl
        px-3.5
        py-2.5
        text-sm
        outline-none
        transition-all
        duration-200
        focus:ring-4
        focus:ring-blue-500/10
        ${className}
      `}
      style={{
        ...inputStyle,
        ...style,
      }}
    >
      {props.children}
    </select>
  );
}


/* =========================================================
   MODAL
   ========================================================= */

export function Modal({
  open,
  onClose,
  title,
  children,
  width = "max-w-xl",
}) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const modalNode = (
    <div
      className="
        print-modal-overlay
        fixed
        inset-0
        z-[99999]
        flex
        items-center
        justify-center
        overflow-y-auto
        p-4
        sm:p-6
      "
      style={{
        background: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <div
        className={`
          print-modal-card
          relative
          w-full
          ${width}
          max-h-[90vh]
          flex
          flex-col
          rounded-2xl
          overflow-hidden
          shadow-2xl
        `}
        style={{
          background: "#FFFFFF",
          border: `1px solid ${T.border}`,
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="
            flex
            items-center
            justify-between
            px-6
            py-4
            shrink-0
          "
          style={{
            borderBottom: `1px solid ${T.border}`,
            background: "#FFFFFF",
          }}
        >
          <h3
            className="
              font-semibold
              text-base
              tracking-tight
            "
            style={{
              color: T.ink,
            }}
          >
            {title}
          </h3>

          <button
            type="button"
            onClick={onClose}
            className="
              w-8
              h-8
              rounded-full
              flex
              items-center
              justify-center
              transition-colors
              hover:bg-black/5
              active:scale-95
            "
            aria-label="Close"
          >
            <X
              size={17}
              color={T.inkSoft}
              strokeWidth={2}
            />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1" style={{ background: "#FFFFFF" }}>
          {children}
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalNode, document.body)
    : modalNode;
}


/* =========================================================
   EMPTY STATE
   ========================================================= */

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
}) {
  return (
    <div
      className="
        flex
        flex-col
        items-center
        justify-center
        py-20
        px-6
        text-center
        animate-[apple-fade-up_400ms_cubic-bezier(.22,1,.36,1)]
      "
    >
      <div
        className="
          w-16
          h-16
          rounded-2xl
          flex
          items-center
          justify-center
          mb-4
        "
        style={{
          background: T.navyWash,
          boxShadow: "inset 0 0 0 1px rgba(0,113,227,0.06)",
        }}
      >
        {Icon && (
          <Icon
            size={25}
            color={T.navy}
            strokeWidth={1.7}
          />
        )}
      </div>

      <div
        className="
          font-semibold
          text-sm
          tracking-[-0.015em]
        "
        style={{
          color: T.ink,
        }}
      >
        {title}
      </div>

      {subtitle && (
        <div
          className="
            text-xs
            mt-1.5
            max-w-sm
            leading-relaxed
          "
          style={{
            color: T.inkFaint,
          }}
        >
          {subtitle}
        </div>
      )}

      {action && (
        <div className="mt-5">
          {action}
        </div>
      )}
    </div>
  );
}


/* =========================================================
   KPI CARD
   ========================================================= */

export function KpiCard({
  label,
  value,
  delta,
  deltaTone,
  icon: Icon,
  iconBg,
  iconColor,
}) {
  return (
    <Card
      className="
        p-5
        min-h-[140px]
      "
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div
            className="
              text-[11px]
              font-medium
              uppercase
              tracking-[0.04em]
            "
            style={{
              color: T.inkSoft,
            }}
          >
            {label}
          </div>

          <div
            className="
              text-[26px]
              leading-tight
              font-semibold
              mt-2
              tracking-[-0.04em]
            "
            style={{
              color: T.ink,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {value}
          </div>

          {delta && (
            <div
              className="
                flex
                items-center
                gap-1
                mt-2
                text-xs
                font-medium
              "
              style={{
                color:
                  deltaTone === "down"
                    ? T.red
                    : T.emerald,
              }}
            >
              {deltaTone === "down" ? (
                <ArrowDownRight size={13} />
              ) : (
                <ArrowUpRight size={13} />
              )}

              {delta}
            </div>
          )}
        </div>

        {Icon && (
          <div
            className="
              w-10
              h-10
              rounded-xl
              flex
              items-center
              justify-center
              shrink-0
              transition-transform
              duration-300
              group-hover:scale-105
            "
            style={{
              background: iconBg,
            }}
          >
            <Icon
              size={18}
              color={iconColor}
              strokeWidth={1.8}
            />
          </div>
        )}
      </div>
    </Card>
  );
}


/* =========================================================
   SECTION HEADER
   ========================================================= */

export function SectionHeader({
  title,
  subtitle,
  action,
}) {
  return (
    <div
      className="
        flex
        items-center
        justify-between
        mb-5
        flex-wrap
        gap-3
      "
    >
      <div>
        <h2
          className="
            text-lg
            font-semibold
            tracking-[-0.03em]
          "
          style={{
            color: T.ink,
          }}
        >
          {title}
        </h2>

        {subtitle && (
          <p
            className="
              text-xs
              mt-1
            "
            style={{
              color: T.inkFaint,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {action}
    </div>
  );
}


/* =========================================================
   CHART TOOLTIP
   ========================================================= */

export const CustomTooltip = ({
  active,
  payload,
  label,
}) => {
  if (
    !active ||
    !payload ||
    !payload.length
  ) {
    return null;
  }

  return (
    <div
      className="
        rounded-xl
        px-3.5
        py-3
        text-xs
        shadow-xl
        border
      "
      style={{
        background: "rgba(29,29,31,0.94)",
        borderColor: "rgba(255,255,255,0.08)",
        color: "#fff",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      <div
        className="
          font-medium
          mb-1.5
          opacity-80
        "
      >
        {label}
      </div>

      {payload.map((p, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5"
          style={{
            color: p.color || "#fff",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: p.color || "#fff",
            }}
          />

          {p.name}:{" "}

          {typeof p.value === "number"
            ? INR(p.value)
            : p.value}
        </div>
      ))}
    </div>
  );
};