import { handleCreateUser } from "../../src/server/supabaseAuthService.js";

function getRequestBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

function getRequestOrigin(req) {
  if (req.headers && req.headers.origin) return req.headers.origin;
  if (req.headers && req.headers.referer) {
    try { return new URL(req.headers.referer).origin; } catch (e) {}
  }
  const host = (req.headers && req.headers.host) || "erp.foxic.in";
  const protocol = (req.headers && req.headers["x-forwarded-proto"]) || "https";
  return `${protocol}://${host}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const payload = getRequestBody(req);
    const origin = getRequestOrigin(req);
    const result = await handleCreateUser({
      email: payload.email,
      password: payload.password,
      name: payload.name,
      requestOrigin: origin
    });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message || "User creation failed"
    });
  }
}
