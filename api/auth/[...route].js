import {
  handleConfirmUser,
  handleCreateUser,
  handleDeleteUser
} from "../../src/server/supabaseAuthService.js";

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

function getRequestOrigin(req) {
  if (req.headers && req.headers.origin) return req.headers.origin;
  if (req.headers && req.headers.referer) {
    try {
      return new URL(req.headers.referer).origin;
    } catch (e) {}
  }
  const host = (req.headers && req.headers.host) || "erp.foxic.in";
  const protocol = (req.headers && req.headers["x-forwarded-proto"]) || "https";
  return `${protocol}://${host}`;
}

export default async function handler(req, res) {
  const url = new URL(req.url || "/", "https://erp.foxic.in");
  const pathname = url.pathname;
  const method = req.method || "GET";
  const route = pathname.replace(/\/+$|^\/+/, "") || "api/auth";

  try {
    if (method === "POST" && (route === "api/auth/create-user" || route.endsWith("/create-user"))) {
      const payload = getRequestBody(req);
      const origin = getRequestOrigin(req);
      const result = await handleCreateUser({
        email: payload.email,
        password: payload.password,
        name: payload.name,
        requestOrigin: origin
      });
      return res.status(200).json(result);
    }

    if (method === "POST" && (route === "api/auth/confirm-user" || route.endsWith("/confirm-user"))) {
      const payload = getRequestBody(req);
      const result = await handleConfirmUser({ email: payload.email });
      return res.status(200).json(result);
    }

    if (method === "POST" && (route === "api/auth/delete-user" || route.endsWith("/delete-user"))) {
      const payload = getRequestBody(req);
      const result = await handleDeleteUser({ userId: payload.userId, email: payload.email });
      return res.status(200).json(result);
    }

    return res.status(404).json({ success: false, error: `Auth API Route ${route} not found` });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message || "Auth API request failed"
    });
  }
}
