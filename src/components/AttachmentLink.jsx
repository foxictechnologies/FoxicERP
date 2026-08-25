/**
 * components/AttachmentLink.jsx
 * -------------------------------------------------------------------------
 * Renders a small "View proof" / "Proof" link next to a record that has an
 * attachment. The Storage bucket is private, so we can't just link to a
 * public URL — this generates a short-lived (1 hour) signed URL on click
 * via getAttachmentUrl() and opens it in a new tab.
 * -------------------------------------------------------------------------
 */

import React, { useState } from "react";
import { Paperclip } from "lucide-react";
import { T } from "../lib/constants";
import { getAttachmentUrl } from "../lib/db";

export default function AttachmentLink({ path, label = "View proof" }) {
  const [loading, setLoading] = useState(false);
  if (!path) return null;
  const open = async () => {
    setLoading(true);
    const url = await getAttachmentUrl(path);
    setLoading(false);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else alert("Couldn't open this file — it may have been removed from storage.");
  };
  return (
    <button onClick={open} disabled={loading} className="inline-flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: T.navy }}>
      <Paperclip size={12} /> {loading ? "Opening…" : label}
    </button>
  );
}
