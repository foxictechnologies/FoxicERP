/**
 * components/FileInput.jsx
 * -------------------------------------------------------------------------
 * The "attach proof of billing/payment" file picker used on the Invoice,
 * Purchase, Payment and Expense forms. Validates the file client-side
 * (type + 10MB size limit) before handing it back to the parent form via
 * onFileSelected — the parent is responsible for actually uploading it
 * with uploadAttachment() from lib/db.js once the rest of the form is saved.
 *
 * The same limits are ALSO enforced on the Supabase Storage bucket itself
 * (see supabase-schema.sql) — client-side validation is just a nicer UX,
 * it is not the security boundary, since a client check can be bypassed.
 * -------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { Paperclip } from "lucide-react";
import { T } from "../lib/constants";
import { Field, inputStyle } from "./ui";

export default function FileInput({ label, onFileSelected, fileName, existingPath }) {
  const [error, setError] = useState("");
  const handleChange = (e) => {
    const f = e.target.files[0];
    if (!f) { setError(""); onFileSelected(null); return; }
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];
    if (!allowedTypes.includes(f.type) && !/\.(pdf|jpg|jpeg|png|webp|heic)$/i.test(f.name)) {
      setError("Only PDF, JPG, PNG or WEBP files are allowed.");
      e.target.value = ""; onFileSelected(null); return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("File is too large — max 10MB.");
      e.target.value = ""; onFileSelected(null); return;
    }
    setError("");
    onFileSelected(f);
  };
  return (
    <Field label={label} hint="PDF, JPG or PNG — optional, max 10MB">
      <input type="file" accept=".pdf,image/*" onChange={handleChange} className="w-full text-xs rounded-lg px-3 py-2" style={{ ...inputStyle }} />
      {error && <div className="text-xs mt-1" style={{ color: T.red }}>{error}</div>}
      {fileName && !error && <div className="text-xs mt-1 flex items-center gap-1" style={{ color: T.emerald }}><Paperclip size={11} /> {fileName} selected</div>}
      {!fileName && existingPath && <div className="text-xs mt-1 flex items-center gap-1" style={{ color: T.inkFaint }}><Paperclip size={11} /> Existing file attached (uploading a new one will replace the link)</div>}
    </Field>
  );
}
