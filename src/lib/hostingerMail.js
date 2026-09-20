/**
 * lib/hostingerMail.js
 * -------------------------------------------------------------------------
 * Client SDK for Hostinger Agentic Mail API integration for info@foxic.in.
 * Calls secure backend endpoints provided by src/server/hostingerMailService.js.
 * -------------------------------------------------------------------------
 */

export const FOXIC_EMAIL = "info@foxic.in";

/**
 * Fetch real mailbox connection status from Hostinger backend
 */
export async function getMailStatus() {
  try {
    const res = await fetch("/api/mail/status");
    if (!res.ok) return { isConnected: false, accountEmail: FOXIC_EMAIL };
    return await res.json();
  } catch (e) {
    console.warn("[Hostinger Mail Client] Status check failed:", e);
    return { isConnected: false, accountEmail: FOXIC_EMAIL, error: e.message };
  }
}

/**
 * Sync real emails from Hostinger Mail API
 */
export async function syncHostingerEmails() {
  const res = await fetch("/api/mail/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to sync emails from Hostinger Mailbox");
  }
  return data;
}

/**
 * Update Hostinger Agentic Mail API Token on backend
 */
export async function saveMailToken(token) {
  const res = await fetch("/api/mail/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to save Hostinger Mail token");
  }
  return data;
}

/**
 * Mark email as Read/Unread on Hostinger server
 */
export async function markEmailReadStatus(folder, uid, isRead) {
  try {
    const res = await fetch("/api/mail/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: folder || "INBOX", uid, isRead })
    });
    return await res.json();
  } catch (e) {
    console.warn("[Hostinger Mail Client] Read status update failed:", e);
  }
}

/**
 * Star / Unstar email on Hostinger server
 */
export async function markEmailStarStatus(folder, uid, isStarred) {
  try {
    const res = await fetch("/api/mail/star", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: folder || "INBOX", uid, isStarred })
    });
    return await res.json();
  } catch (e) {
    console.warn("[Hostinger Mail Client] Star status update failed:", e);
  }
}

/**
 * Move email to Trash on Hostinger server
 */
export async function trashEmailMessage(folder, uid) {
  const res = await fetch("/api/mail/trash", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder: folder || "INBOX", uid })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to move email to trash on Hostinger");
  }
  return data;
}

/**
 * Permanently Delete email from Hostinger server
 */
export async function deleteEmailMessage(folder, uid) {
  const res = await fetch("/api/mail/delete", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder: folder || "INBOX.Trash", uid })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to permanently delete email on Hostinger");
  }
  return data;
}

/**
 * Send an email from info@foxic.in via Hostinger Mail API
 */
export async function sendEmailMessage({ to, subject, text, html, displayName = "Foxic Admin" }) {
  const res = await fetch("/api/mail/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, subject, text, html, displayName })
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to send email via Hostinger Mail API");
  }
  return data;
}
