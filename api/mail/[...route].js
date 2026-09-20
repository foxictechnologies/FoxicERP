import {
  fetchAllHostingerEmails,
  getHostingerToken,
  moveHostingerMessageToTrash,
  permanentlyDeleteHostingerMessage,
  saveHostingerToken,
  sendHostingerEmail,
  updateHostingerMessageReadStatus,
  updateHostingerMessageStarStatus,
  validateHostingerToken,
} from "../../src/server/hostingerMailService.js";

const FOXIC_EMAIL = "info@foxic.in";
const HOSTINGER_API_BASE = "https://api.mail.hostinger.com";

function getRequestBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return {};
}

async function hostingerRequest(endpoint, token, options = {}) {
  const url = `${HOSTINGER_API_BASE}${endpoint}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 || response.status === 403) {
    throw new Error("Invalid or expired Hostinger Mail API Bearer token. Please verify the token.");
  }

  if (!response.ok) {
    const text = await response.text();
    let errorMessage = `Hostinger API error (${response.status})`;

    try {
      const parsed = JSON.parse(text);
      if (parsed.error) errorMessage = parsed.error;
      else if (parsed.message) errorMessage = parsed.message;
    } catch {
      const cleanText = text.replace(/<[^>]*>?/gm, "").trim();
      if (cleanText) errorMessage = cleanText;
    }

    if (/NOT_FOUND|The page could not be found/i.test(errorMessage)) {
      throw new Error("The Hostinger Mail token is invalid or expired. Please generate a fresh bearer token and try again.");
    }

    throw new Error(errorMessage);
  }

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export default async function handler(req, res) {
  const url = new URL(req.url || "/", "https://example.com");
  const pathname = url.pathname;
  const method = req.method || "GET";
  const route = pathname.replace(/\/+$|^\/+/, "") || "api/mail";

  try {
    if (method === "GET" && route === "api/mail/status") {
      const token = getHostingerToken();
      if (!token) {
        return res.status(200).json({
          isConnected: false,
          accountEmail: FOXIC_EMAIL,
          message: "Hostinger Agentic Mail token is not configured."
        });
      }

      const account = await hostingerRequest("/api/v1/me", token);
      const mailboxes = account?.data?.mailboxes || [];
      const found = mailboxes.find((m) => (m.address || "").toLowerCase() === FOXIC_EMAIL.toLowerCase()) || mailboxes[0];

      return res.status(200).json({
        isConnected: true,
        provider: "Hostinger Agentic Mail REST API",
        accountEmail: found?.address || FOXIC_EMAIL,
        mailboxResourceId: found?.resourceId || null,
        maskedToken: `${token.slice(0, 8)}...${token.slice(-6)}`
      });
    }

    if (method === "POST" && route === "api/mail/config") {
      const payload = getRequestBody(req);
      const cleanToken = String(payload.token || "").trim();
      if (!cleanToken) {
        return res.status(400).json({ success: false, error: "Hostinger Mail API token is required" });
      }

      await validateHostingerToken(cleanToken);
      saveHostingerToken(cleanToken);

      return res.status(200).json({ success: true, isConnected: true });
    }

    if (method === "POST" && route === "api/mail/sync") {
      const emails = await fetchAllHostingerEmails();
      return res.status(200).json({
        success: true,
        count: emails.length,
        emails,
        syncedAt: new Date().toISOString()
      });
    }

    if (method === "PATCH" && route === "api/mail/read") {
      const payload = getRequestBody(req);
      const { folder, uid, isRead } = payload;
      if (!uid) {
        return res.status(400).json({ success: false, error: "Missing message uid" });
      }
      await updateHostingerMessageReadStatus(folder || "INBOX", uid, isRead !== false);
      return res.status(200).json({ success: true });
    }

    if (method === "PATCH" && route === "api/mail/star") {
      const payload = getRequestBody(req);
      const { folder, uid, isStarred } = payload;
      if (!uid) {
        return res.status(400).json({ success: false, error: "Missing message uid" });
      }
      await updateHostingerMessageStarStatus(folder || "INBOX", uid, !!isStarred);
      return res.status(200).json({ success: true });
    }

    if (method === "POST" && route === "api/mail/trash") {
      const payload = getRequestBody(req);
      const { folder, uid } = payload;
      if (!uid) {
        return res.status(400).json({ success: false, error: "Missing message uid" });
      }
      await moveHostingerMessageToTrash(folder || "INBOX", uid);
      return res.status(200).json({ success: true, action: "moved_to_trash" });
    }

    if (method === "DELETE" && route === "api/mail/delete") {
      const payload = getRequestBody(req);
      const { folder, uid } = payload;
      if (!uid) {
        return res.status(400).json({ success: false, error: "Missing message uid" });
      }
      await permanentlyDeleteHostingerMessage(folder || "INBOX.Trash", uid);
      return res.status(200).json({ success: true, action: "permanently_deleted" });
    }

    if (method === "POST" && route === "api/mail/send") {
      const payload = getRequestBody(req);
      if (!payload.to || !payload.subject) {
        return res.status(400).json({ success: false, error: "Recipient and subject are required" });
      }
      await sendHostingerEmail(payload);
      return res.status(200).json({ success: true });
    }

    return res.status(404).json({ success: false, error: "Route not found" });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message || "Hostinger Mail API request failed"
    });
  }
}
