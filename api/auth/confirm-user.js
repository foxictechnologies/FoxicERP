import { handleConfirmUser } from "../../src/server/supabaseAuthService.js";

function getRequestBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const payload = getRequestBody(req);
    const result = await handleConfirmUser({ email: payload.email });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message || "User confirmation failed"
    });
  }
}
