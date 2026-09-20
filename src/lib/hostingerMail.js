/**
 * lib/hostingerMail.js
 * -------------------------------------------------------------------------
 * Client SDK for Hostinger Agentic Mail API integration for info@foxic.in.
 * Calls secure backend endpoints provided by src/server/hostingerMailService.js.
 * -------------------------------------------------------------------------
 */

export const FOXIC_EMAIL = "info@foxic.in";

/**
 * Safe fetch helper that reads response as text first, checks status,
 * and handles HTML/non-JSON error pages gracefully without crashing with JSON parse errors.
 */
async function safeFetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();

  if (!response.ok) {
    console.error(`[Hostinger Mail Client] Server response error (${response.status}):`, text);
    let errorMessage = `Server error (${response.status})`;
    try {
      const parsed = JSON.parse(text);
      if (parsed.error || parsed.message) {
        errorMessage = parsed.error || parsed.message;
      }
    } catch {
      // Strip HTML tags if the server returned an HTML error page (e.g., 404 / 500)
      const cleanText = text.replace(/<[^>]*>?/gm, "").trim();
      if (cleanText) {
        errorMessage = cleanText.length > 120 ? cleanText.slice(0, 120) + "..." : cleanText;
      }
    }
    throw new Error(errorMessage);
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("[Hostinger Mail Client] Failed to parse JSON response:", text);
    throw new Error("Invalid response format received from server.");
  }
}

/**
 * Fetch real mailbox connection status from Hostinger backend
 */
export async function getMailStatus() {
  try {
    const res = await fetch("/api/mail/status");
    const text = await res.text();
    if (!res.ok) return { isConnected: false, accountEmail: FOXIC_EMAIL };
    try {
      return JSON.parse(text);
    } catch {
      return { isConnected: false, accountEmail: FOXIC_EMAIL };
    }
  } catch (e) {
    console.warn("[Hostinger Mail Client] Status check failed:", e);
    return { isConnected: false, accountEmail: FOXIC_EMAIL, error: e.message };
  }
}

/**
 * Sync real emails from Hostinger Mail API
 */
export async function syncHostingerEmails() {
  const data = await safeFetchJson("/api/mail/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  if (!data.success) {
    throw new Error(data.error || "Failed to sync emails from Hostinger Mailbox");
  }
  return data;
}

/**
 * Update Hostinger Agentic Mail API Token on backend
 */
export async function saveMailToken(token) {
  const data = await safeFetchJson("/api/mail/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });
  if (!data.success) {
    throw new Error(data.error || "Failed to save Hostinger Mail token");
  }
  return data;
}

/**
 * Mark email as Read/Unread on Hostinger server
 */
export async function markEmailReadStatus(folder, uid, isRead) {
  try {
    return await safeFetchJson("/api/mail/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: folder || "INBOX", uid, isRead })
    });
  } catch (e) {
    console.warn("[Hostinger Mail Client] Read status update failed:", e);
  }
}

/**
 * Star / Unstar email on Hostinger server
 */
export async function markEmailStarStatus(folder, uid, isStarred) {
  try {
    return await safeFetchJson("/api/mail/star", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: folder || "INBOX", uid, isStarred })
    });
  } catch (e) {
    console.warn("[Hostinger Mail Client] Star status update failed:", e);
  }
}

/**
 * Move email to Trash on Hostinger server
 */
export async function trashEmailMessage(folder, uid) {
  const data = await safeFetchJson("/api/mail/trash", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder: folder || "INBOX", uid })
  });
  if (!data.success) {
    throw new Error(data.error || "Failed to move email to trash on Hostinger");
  }
  return data;
}

/**
 * Permanently Delete email from Hostinger server
 */
export async function deleteEmailMessage(folder, uid) {
  const data = await safeFetchJson("/api/mail/delete", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder: folder || "INBOX.Trash", uid })
  });
  if (!data.success) {
    throw new Error(data.error || "Failed to permanently delete email on Hostinger");
  }
  return data;
}

/**
 * Send an email from info@foxic.in via Hostinger Mail API
 */
export async function sendEmailMessage({ to, subject, text, html, displayName = "Foxic Admin" }) {
  const data = await safeFetchJson("/api/mail/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, subject, text, html, displayName })
  });
  if (!data.success) {
    throw new Error(data.error || "Failed to send email via Hostinger Mail API");
  }
  return data;
}
