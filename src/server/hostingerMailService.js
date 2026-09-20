/**
 * src/server/hostingerMailService.js
 * -------------------------------------------------------------------------
 * Backend Middleware & Service for Hostinger Agentic Mail API
 * Mailbox: info@foxic.in
 * Base URL: https://api.mail.hostinger.com
 *
 * Security:
 *  - Token is strictly stored on backend (env/secure local file).
 *  - No token or credentials exposed to frontend clients.
 * -------------------------------------------------------------------------
 */

import fs from "fs";
import path from "path";

const HOSTINGER_API_BASE = "https://api.mail.hostinger.com";
const FOXIC_EMAIL = "info@foxic.in";
const CONFIG_FILE = path.resolve(process.cwd(), ".hostinger_mail.json");

// Helper: Sanitize email addresses for Hostinger API
export function sanitizeEmails(input) {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : String(input).split(/[,;\n]+/);
  const cleaned = [];
  for (const item of arr) {
    if (!item) continue;
    const str = String(item).trim();
    // Extract email from "Name <email@domain.com>" or clean string
    const match = str.match(/<([^>]+)>/) || str.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const email = match ? match[1].trim() : str.trim();
    if (email && email.includes("@")) {
      cleaned.push(email);
    }
  }
  return cleaned;
}

// Helper: Get token from env or config file
export function getHostingerToken() {
  let token = process.env.HOSTINGER_MAIL_API_TOKEN || "";
  
  // Check .hostinger_mail.json
  if (!token && fs.existsSync(CONFIG_FILE)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
      if (cfg.token) token = cfg.token;
    } catch (e) {
      // ignore
    }
  }

  // Check .env file directly
  if (!token) {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, "utf8");
        const match = envContent.match(/HOSTINGER_MAIL_API_TOKEN\s*=\s*([^\r\n]+)/);
        if (match && match[1]) {
          token = match[1].trim().replace(/^["']|["']$/g, "");
        }
      } catch (e) {
        // ignore
      }
    }
  }

  return token.trim();
}

// Helper: Save token to config file
export function saveHostingerToken(token) {
  try {
    const cleanToken = String(token || "").trim();
    if (!cleanToken) {
      throw new Error("Hostinger Mail API token is required.");
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ token: cleanToken, updatedAt: new Date().toISOString() }, null, 2), "utf8");
    process.env.HOSTINGER_MAIL_API_TOKEN = cleanToken;
    return true;
  } catch (e) {
    console.error("[Hostinger Mail Backend] Failed to save token:", e);
    throw e;
  }
}

export async function validateHostingerToken(token) {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) {
    throw new Error("Hostinger Mail API token is required.");
  }

  const previousToken = process.env.HOSTINGER_MAIL_API_TOKEN;
  process.env.HOSTINGER_MAIL_API_TOKEN = cleanToken;

  try {
    await hostingerFetch("/api/v1/me");
    return true;
  } catch (err) {
    throw new Error(
      err?.message?.includes("NOT_FOUND") || err?.message?.includes("The page could not be found")
        ? "The Hostinger Mail token is invalid or expired. Please generate a fresh bearer token and try again."
        : err.message
    );
  } finally {
    if (previousToken) {
      process.env.HOSTINGER_MAIL_API_TOKEN = previousToken;
    } else {
      delete process.env.HOSTINGER_MAIL_API_TOKEN;
    }
  }
}

// Helper: Authenticated fetch wrapper
async function hostingerFetch(endpoint, options = {}) {
  const token = getHostingerToken();
  if (!token) {
    throw new Error("Hostinger Mail API token is not configured on the backend.");
  }

  const url = `${HOSTINGER_API_BASE}${endpoint}`;
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/json",
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const resp = await fetch(url, { ...options, headers });
  
  if (resp.status === 401 || resp.status === 403) {
    throw new Error("Invalid or expired Hostinger Mail API Bearer token. Please verify the token.");
  }

  if (!resp.ok) {
    let errMsg = `Hostinger API error (${resp.status})`;
    try {
      const errJson = await resp.json();
      if (errJson.error) errMsg = errJson.error;
      else if (errJson.message) errMsg = errJson.message;
      if (errJson.params) {
        const details = Object.entries(errJson.params).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("; ");
        errMsg += ` (${details})`;
      }
    } catch (e) {
      const errTxt = await resp.text();
      if (errTxt) errMsg = errTxt.slice(0, 200);
    }

    if (/NOT_FOUND|The page could not be found/i.test(errMsg)) {
      throw new Error("The Hostinger Mail token is invalid or expired. Please generate a fresh bearer token and try again.");
    }

    throw new Error(errMsg);
  }

  if (resp.status === 204) return null;
  return await resp.json();
}

/**
 * Get the mailbox resource ID for info@foxic.in
 */
export async function getMailboxResourceId() {
  const data = await hostingerFetch("/api/v1/me");
  const mailboxes = data?.data?.mailboxes || [];
  const found = mailboxes.find(m => (m.address || "").toLowerCase() === FOXIC_EMAIL.toLowerCase()) || mailboxes[0];
  if (!found || !found.resourceId) {
    throw new Error(`No mailbox found for ${FOXIC_EMAIL} on Hostinger account.`);
  }
  return found.resourceId;
}

/**
 * Categorize email based on keywords
 */
function determineCategory(subject = "", body = "") {
  const combined = (subject + " " + body).toLowerCase();
  if (combined.includes("quote") || combined.includes("quotation") || combined.includes("rfq") || combined.includes("inquiry") || combined.includes("enquiry") || combined.includes("price") || combined.includes("order")) {
    return "Inquiry";
  }
  if (combined.includes("purchase order") || combined.includes(" po ") || combined.includes("po-") || combined.includes("invoice") || combined.includes("bill") || combined.includes("payment")) {
    return "Billing";
  }
  if (combined.includes("support") || combined.includes("help") || combined.includes("issue") || combined.includes("ticket") || combined.includes("service") || combined.includes("code") || combined.includes("verification")) {
    return "Support";
  }
  return "General";
}

/**
 * Fetch all real messages from Hostinger Mailbox
 */
export async function fetchAllHostingerEmails() {
  const mailboxId = await getMailboxResourceId();

  // 1. Fetch folders
  const foldersData = await hostingerFetch(`/api/v1/mailboxes/${mailboxId}/folders`);
  const folders = foldersData?.data || [];

  const allEmails = [];

  // Fetch messages from INBOX, Sent, and Trash if available
  const targetFolders = folders.filter(f => ["INBOX", "INBOX.Sent", "INBOX.Trash", "Sent", "Trash"].includes(f.name || f.path));
  const foldersToFetch = targetFolders.length > 0 ? targetFolders : [{ path: "INBOX", name: "INBOX" }];

  for (const folder of foldersToFetch) {
    const folderPath = encodeURIComponent(folder.path || folder.name || "INBOX");
    const folderName = (folder.name || folder.path || "inbox").toLowerCase().replace(/^inbox\./i, "");

    try {
      const msgsData = await hostingerFetch(`/api/v1/mailboxes/${mailboxId}/folders/${folderPath}/messages?perPage=50`);
      const messages = msgsData?.data || [];

      // Fetch message body text for each message
      const detailed = await Promise.all(messages.map(async (msg) => {
        let bodyText = "";
        let bodyHtml = "";
        try {
          const textRes = await hostingerFetch(`/api/v1/mailboxes/${mailboxId}/folders/${folderPath}/messages/${msg.uid}/text`);
          bodyText = textRes?.data?.text || "";
          bodyHtml = textRes?.data?.html || "";
        } catch (e) {
          // ignore individual body fetch fail
        }

        const senderName = msg.from?.name || (msg.from?.address?.split("@")[0]) || "Unknown Sender";
        const senderEmail = msg.from?.address || "";
        const toAddress = (msg.to && msg.to[0]?.address) || FOXIC_EMAIL;
        const subject = msg.subject || "(No Subject)";
        const snippet = (bodyText || bodyHtml || "").replace(/<[^>]+>/g, "").slice(0, 160).trim();
        const isRead = !msg.unseen && (msg.flags || []).includes("\\Seen");
        const isStarred = (msg.flags || []).includes("\\Flagged");

        // Format attachments
        const attachments = (msg.attachments || []).map((att, idx) => ({
          name: att.filename || att.name || `attachment_${idx + 1}`,
          size: att.size || 0,
          type: att.mimeType || att.type || "application/octet-stream",
          attachmentId: att.attachmentId || att.id || null,
          folderPath: folder.path || folder.name,
          uid: msg.uid
        }));

        return {
          id: `hostinger_${folderName}_${msg.uid}`,
          account_email: FOXIC_EMAIL,
          uid: msg.uid,
          message_id: msg.messageId || `msg_${msg.uid}`,
          sender_name: senderName,
          sender_email: senderEmail,
          recipient_email: toAddress,
          subject: subject,
          snippet: snippet,
          body_text: bodyText,
          body_html: bodyHtml || (bodyText ? `<div style="white-space: pre-wrap; font-family: inherit;">${bodyText}</div>` : ""),
          is_read: isRead,
          is_starred: isStarred,
          folder: folderName === "inbox" ? "inbox" : (folderName.includes("sent") ? "sent" : folderName.includes("trash") ? "trash" : "inbox"),
          raw_folder: folder.path || folder.name,
          category: determineCategory(subject, bodyText || snippet),
          attachments: attachments,
          received_at: msg.date ? new Date(msg.date).toISOString() : new Date().toISOString(),
          created_at: new Date().toISOString()
        };
      }));

      allEmails.push(...detailed);
    } catch (err) {
      console.warn(`[Hostinger Mail Backend] Error fetching folder ${folder.name}:`, err.message);
    }
  }

  // Sort descending by received_at
  return allEmails.sort((a, b) => new Date(b.received_at) - new Date(a.received_at));
}

// Helper: Normalize folder path for Hostinger API
function normalizeFolderPath(folder) {
  if (!folder) return "INBOX";
  const f = String(folder).trim();
  if (f.toUpperCase() === "INBOX") return "INBOX";
  if (f.toLowerCase() === "sent" || f.toLowerCase() === "inbox.sent") return "INBOX.Sent";
  if (f.toLowerCase() === "trash" || f.toLowerCase() === "inbox.trash") return "INBOX.Trash";
  if (f.toLowerCase() === "drafts" || f.toLowerCase() === "inbox.drafts") return "INBOX.Drafts";
  if (f.toLowerCase() === "junk" || f.toLowerCase() === "inbox.junk") return "INBOX.Junk";
  return f;
}

/**
 * Mark email as Read/Unread on Hostinger Server
 */
export async function updateHostingerMessageReadStatus(folder, uid, isRead) {
  const mailboxId = await getMailboxResourceId();
  const folderPath = encodeURIComponent(normalizeFolderPath(folder));
  const payload = isRead ? { addFlags: ["\\Seen"] } : { removeFlags: ["\\Seen"] };

  return await hostingerFetch(`/api/v1/mailboxes/${mailboxId}/folders/${folderPath}/messages/${uid}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

/**
 * Star / Unstar email on Hostinger Server
 */
export async function updateHostingerMessageStarStatus(folder, uid, isStarred) {
  const mailboxId = await getMailboxResourceId();
  const folderPath = encodeURIComponent(normalizeFolderPath(folder));
  const payload = isStarred ? { addFlags: ["\\Flagged"] } : { removeFlags: ["\\Flagged"] };

  return await hostingerFetch(`/api/v1/mailboxes/${mailboxId}/folders/${folderPath}/messages/${uid}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

/**
 * Move message to Trash on Hostinger Server
 */
export async function moveHostingerMessageToTrash(folder, uid) {
  const mailboxId = await getMailboxResourceId();
  const sourceFolder = normalizeFolderPath(folder || "INBOX");
  
  if (sourceFolder === "INBOX.Trash") {
    // Already in trash, permanently delete
    return await permanentlyDeleteHostingerMessage("INBOX.Trash", uid);
  }

  const encodedSource = encodeURIComponent(sourceFolder);
  try {
    return await hostingerFetch(`/api/v1/mailboxes/${mailboxId}/folders/${encodedSource}/messages/${uid}/move`, {
      method: "POST",
      body: JSON.stringify({ targetFolder: "INBOX.Trash" })
    });
  } catch (err) {
    // If move fails with not found, try INBOX or INBOX.Sent
    if (sourceFolder !== "INBOX") {
      try {
        return await hostingerFetch(`/api/v1/mailboxes/${mailboxId}/folders/INBOX/messages/${uid}/move`, {
          method: "POST",
          body: JSON.stringify({ targetFolder: "INBOX.Trash" })
        });
      } catch (e2) {
        throw err;
      }
    }
    throw err;
  }
}

/**
 * Permanently Delete message from Hostinger Server
 */
export async function permanentlyDeleteHostingerMessage(folder, uid) {
  const mailboxId = await getMailboxResourceId();
  const sourceFolder = normalizeFolderPath(folder || "INBOX.Trash");
  const encodedSource = encodeURIComponent(sourceFolder);

  try {
    return await hostingerFetch(`/api/v1/mailboxes/${mailboxId}/folders/${encodedSource}/messages/${uid}`, {
      method: "DELETE"
    });
  } catch (err) {
    // If not found in requested folder, try INBOX.Trash or INBOX
    const fallbackFolders = ["INBOX.Trash", "INBOX", "INBOX.Sent"].filter(f => f !== sourceFolder);
    for (const fb of fallbackFolders) {
      try {
        return await hostingerFetch(`/api/v1/mailboxes/${mailboxId}/folders/${encodeURIComponent(fb)}/messages/${uid}`, {
          method: "DELETE"
        });
      } catch (e2) {
        // continue trying
      }
    }
    throw err;
  }
}

/**
 * Send an email from info@foxic.in via Hostinger Mail API
 */
export async function sendHostingerEmail({ to, subject, text, html, displayName = "Foxic Admin" }) {
  const mailboxId = await getMailboxResourceId();
  const sanitizedTo = sanitizeEmails(to);

  if (sanitizedTo.length === 0) {
    throw new Error("Please provide a valid recipient email address.");
  }

  const payload = {
    to: sanitizedTo,
    displayName: displayName || "Foxic Admin",
    subject: subject || "(No Subject)",
    text: text || "",
    html: html || (text ? `<p>${text.replace(/\n/g, "<br>")}</p>` : "")
  };

  return await hostingerFetch(`/api/v1/mailboxes/${mailboxId}/send`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/**
 * Create Vite Dev Server Backend API Middleware
 */
export function createHostingerMailMiddleware() {
  return async (req, res, next) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost:5173"}`);
    const pathname = url.pathname;

    // ── 1. GET /api/mail/status ──
    if (pathname === "/api/mail/status" && req.method === "GET") {
      const token = getHostingerToken();
      if (!token) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          isConnected: false,
          accountEmail: FOXIC_EMAIL,
          message: "Hostinger Agentic Mail token is not configured."
        }));
        return;
      }

      try {
        const account = await hostingerFetch("/api/v1/me");
        const mailboxes = account?.data?.mailboxes || [];
        const found = mailboxes.find(m => (m.address || "").toLowerCase() === FOXIC_EMAIL.toLowerCase()) || mailboxes[0];

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          isConnected: true,
          provider: "Hostinger Agentic Mail REST API",
          accountEmail: found?.address || FOXIC_EMAIL,
          mailboxResourceId: found?.resourceId || null,
          maskedToken: `${token.slice(0, 8)}...${token.slice(-6)}`
        }));
      } catch (err) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          isConnected: false,
          accountEmail: FOXIC_EMAIL,
          error: err.message
        }));
      }
      return;
    }

    // ── 2. POST /api/mail/config ──
    if (pathname === "/api/mail/config" && req.method === "POST") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", async () => {
        try {
          const payload = JSON.parse(body || "{}");
          const cleanToken = String(payload.token || "").trim();
          if (!cleanToken) {
            throw new Error("Hostinger Mail API token is required");
          }

          await validateHostingerToken(cleanToken);
          saveHostingerToken(cleanToken);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, isConnected: true }));
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // ── 3. POST /api/mail/sync ──
    if (pathname === "/api/mail/sync" && req.method === "POST") {
      try {
        console.log("[Hostinger Mail Backend] Syncing real emails for", FOXIC_EMAIL);
        const emails = await fetchAllHostingerEmails();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          count: emails.length,
          emails: emails,
          syncedAt: new Date().toISOString()
        }));
      } catch (err) {
        console.error("[Hostinger Mail Backend] Sync error:", err.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: false,
          error: err.message || "Failed to sync emails from Hostinger Mail API"
        }));
      }
      return;
    }

    // ── 4. PATCH /api/mail/read ──
    if (pathname === "/api/mail/read" && req.method === "PATCH") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", async () => {
        try {
          const { folder, uid, isRead } = JSON.parse(body || "{}");
          if (!uid) throw new Error("Missing message uid");
          await updateHostingerMessageReadStatus(folder || "INBOX", uid, isRead !== false);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // ── 5. PATCH /api/mail/star ──
    if (pathname === "/api/mail/star" && req.method === "PATCH") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", async () => {
        try {
          const { folder, uid, isStarred } = JSON.parse(body || "{}");
          if (!uid) throw new Error("Missing message uid");
          await updateHostingerMessageStarStatus(folder || "INBOX", uid, !!isStarred);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // ── 6. POST /api/mail/trash (Move to Trash) ──
    if (pathname === "/api/mail/trash" && req.method === "POST") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", async () => {
        try {
          const { folder, uid } = JSON.parse(body || "{}");
          if (!uid) throw new Error("Missing message uid");
          await moveHostingerMessageToTrash(folder || "INBOX", uid);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, action: "moved_to_trash" }));
        } catch (err) {
          console.error("[Hostinger Mail Backend] Trash error:", err.message);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // ── 7. DELETE /api/mail/delete (Permanent Delete) ──
    if (pathname === "/api/mail/delete" && req.method === "DELETE") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", async () => {
        try {
          const { folder, uid } = JSON.parse(body || "{}");
          if (!uid) throw new Error("Missing message uid");
          await permanentlyDeleteHostingerMessage(folder || "INBOX.Trash", uid);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, action: "permanently_deleted" }));
        } catch (err) {
          console.error("[Hostinger Mail Backend] Delete error:", err.message);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // ── 8. POST /api/mail/send (Compose & Reply) ──
    if (pathname === "/api/mail/send" && req.method === "POST") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", async () => {
        try {
          const payload = JSON.parse(body || "{}");
          if (!payload.to || !payload.subject) {
            throw new Error("Recipient and subject are required");
          }
          await sendHostingerEmail(payload);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          console.error("[Hostinger Mail Backend] Send error:", err.message);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // ── 9. GET /api/mail/attachment ──
    if (pathname.startsWith("/api/mail/attachment/") && req.method === "GET") {
      try {
        const parts = pathname.replace("/api/mail/attachment/", "").split("/");
        // format: :folder/:uid/:attachmentId
        const folder = decodeURIComponent(parts[0] || "INBOX");
        const uid = parts[1];
        const attachmentId = decodeURIComponent(parts[2] || "");

        const mailboxId = await getMailboxResourceId();
        const token = getHostingerToken();

        const url = `${HOSTINGER_API_BASE}/api/v1/mailboxes/${mailboxId}/folders/${encodeURIComponent(folder)}/messages/${uid}/attachments/${encodeURIComponent(attachmentId)}`;
        const attachResp = await fetch(url, {
          headers: { "Authorization": `Bearer ${token}` }
        });

        if (!attachResp.ok) throw new Error("Failed to download attachment from Hostinger API");

        const buffer = await attachResp.arrayBuffer();
        const ct = attachResp.headers.get("content-type") || "application/octet-stream";
        const cd = attachResp.headers.get("content-disposition") || 'attachment; filename="attachment"';

        res.writeHead(200, { "Content-Type": ct, "Content-Disposition": cd });
        res.end(Buffer.from(buffer));
        return;
      } catch (err) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
        return;
      }
    }

    next();
  };
}
