/**
 * src/server/supabaseAuthService.js
 * -------------------------------------------------------------------------
 * Backend service & middleware for auto-creating Supabase Auth users & returning their UIDs.
 * Endpoints:
 *  - POST /api/auth/create-user
 *  - POST /api/auth/confirm-user
 *  - POST /api/auth/delete-user
 * -------------------------------------------------------------------------
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

export function getEnvVars() {
  let url = process.env.VITE_SUPABASE_URL || "";
  let anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !anonKey || !serviceKey) {
    try {
      const envPath = path.resolve(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, "utf8");
        const urlMatch = envContent.match(/VITE_SUPABASE_URL\s*=\s*([^\r\n]+)/);
        const anonMatch = envContent.match(/VITE_SUPABASE_ANON_KEY\s*=\s*([^\r\n]+)/);
        const serviceMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/) || envContent.match(/VITE_SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);
        if (urlMatch && urlMatch[1]) url = urlMatch[1].trim().replace(/^["']|["']$/g, "");
        if (anonMatch && anonMatch[1]) anonKey = anonMatch[1].trim().replace(/^["']|["']$/g, "");
        if (serviceMatch && serviceMatch[1]) serviceKey = serviceMatch[1].trim().replace(/^["']|["']$/g, "");
      }
    } catch (e) {
      // ignore
    }
  }

  return { url: (url || "").trim(), anonKey: (anonKey || "").trim(), serviceKey: (serviceKey || "").trim() };
}

export function getRequestOrigin(req) {
  if (req.headers && req.headers.origin) return req.headers.origin;
  if (req.headers && req.headers.referer) {
    try {
      return new URL(req.headers.referer).origin;
    } catch (e) {}
  }
  const host = (req.headers && req.headers.host) || "localhost:5173";
  const protocol = (req.headers && req.headers["x-forwarded-proto"]) || "http";
  return `${protocol}://${host}`;
}

export async function handleCreateUser({ email, password, name, requestOrigin }) {
  if (!email || !password) {
    throw new Error("Email and password are required to create a user");
  }

  const { url, anonKey, serviceKey } = getEnvVars();
  if (!url || (!anonKey && !serviceKey)) {
    throw new Error("Supabase URL and API keys are missing in backend environment variables");
  }

  let createdUser = null;

  // If service role key is available, use admin API for instant auto-confirmation
  if (serviceKey) {
    const adminClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data, error } = await adminClient.auth.admin.createUser({
      email: email.trim(),
      password: password.trim(),
      user_metadata: { name: name || "" },
      email_confirm: true
    });

    if (error) {
      if (error.message?.includes("already registered") || error.message?.includes("exists")) {
        const { data: listData } = await adminClient.auth.admin.listUsers();
        const existing = listData?.users?.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());
        if (existing) {
          // Update existing user & force email_confirm to true
          await adminClient.auth.admin.updateUserById(existing.id, {
            email_confirm: true,
            user_metadata: { name: name || existing.user_metadata?.name || "" }
          });
          createdUser = existing;
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    } else {
      createdUser = data.user;
    }
  } else {
    // Fallback to standard client signUp with explicit emailRedirectTo
    const client = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password: password.trim(),
      options: {
        data: { name: name || "" },
        emailRedirectTo: `${requestOrigin || "http://localhost:5173"}/`
      }
    });

    if (error) {
      throw error;
    }
    if (!data.user?.id) {
      throw new Error("User creation failed or user already exists.");
    }
    createdUser = data.user;
  }

  return {
    success: true,
    user: {
      id: createdUser.id,
      email: createdUser.email,
      name: name || createdUser.user_metadata?.name || ""
    }
  };
}

export async function handleConfirmUser({ email }) {
  if (!email) throw new Error("Email is required to confirm user.");

  const { url, serviceKey } = getEnvVars();
  if (!serviceKey) throw new Error("Service role key is required for auto-confirming email.");

  const adminClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: listData } = await adminClient.auth.admin.listUsers();
  const target = listData?.users?.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());
  if (!target) throw new Error("User not found in Supabase Auth.");

  await adminClient.auth.admin.updateUserById(target.id, { email_confirm: true });

  return { success: true, message: `Email for ${email} has been confirmed.` };
}

export async function handleDeleteUser({ userId, email }) {
  if (!userId && !email) throw new Error("userId or email is required to delete user.");

  const { url, anonKey, serviceKey } = getEnvVars();
  const effectiveKey = serviceKey || anonKey;
  if (!url || !effectiveKey) {
    throw new Error("Supabase URL or API keys missing in backend environment variables");
  }

  const adminClient = createClient(url, effectiveKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  let targetUserId = userId;
  if (!targetUserId && email && serviceKey) {
    try {
      const { data: listData } = await adminClient.auth.admin.listUsers();
      const target = listData?.users?.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());
      if (target) targetUserId = target.id;
    } catch (e) {}
  }

  if (targetUserId) {
    // 1. Unlink FK references in child tables so Postgres FK constraint doesn't block profile delete
    const unlinkTables = [
      { table: "tasks", col: "assigned_to" },
      { table: "tasks", col: "created_by" },
      { table: "tickets", col: "assigned_to" },
      { table: "invoices", col: "created_by" },
      { table: "purchases", col: "created_by" },
      { table: "payments", col: "created_by" },
      { table: "expenses", col: "created_by" }
    ];

    for (const item of unlinkTables) {
      try {
        await adminClient.from(item.table).update({ [item.col]: null }).eq(item.col, targetUserId);
      } catch (e) {}
    }

    try {
      await adminClient.from("audit_log").delete().eq("user_id", targetUserId);
    } catch (e) {}

    // 2. Delete profile row via Admin client
    try {
      const { error: pErr } = await adminClient.from("profiles").delete().eq("id", targetUserId);
      if (pErr) console.warn("[Backend Delete User] Profiles table delete warning:", pErr.message);
    } catch (pErr) {
      console.warn("[Backend Delete User] Profiles table delete catch:", pErr.message);
    }

    // 3. Delete Auth user via Admin API if serviceKey is available
    if (serviceKey) {
      try {
        const { error: deleteAuthErr } = await adminClient.auth.admin.deleteUser(targetUserId);
        if (deleteAuthErr) console.warn("[Backend Delete User] Auth admin delete warning:", deleteAuthErr.message);
      } catch (aErr) {
        console.warn("[Backend Delete User] Auth admin delete catch:", aErr.message);
      }
    }
  }

  return { success: true, message: `User ${targetUserId || email} deleted from backend Auth and DB.` };
}

export function createSupabaseAuthMiddleware() {
  return async (req, res, next) => {
    const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = urlObj.pathname;

    // Endpoint: Create User
    if (pathname === "/api/auth/create-user" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const requestOrigin = getRequestOrigin(req);
          const result = await handleCreateUser({
            email: parsed.email,
            password: parsed.password,
            name: parsed.name,
            requestOrigin
          });

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (err) {
          console.error("[Supabase Auth Backend] Error creating user:", err.message);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // Endpoint: Confirm User
    if (pathname === "/api/auth/confirm-user" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const result = await handleConfirmUser({ email: parsed.email });

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (err) {
          console.error("[Supabase Auth Backend] Error confirming user:", err.message);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // Endpoint: Delete User
    if (pathname === "/api/auth/delete-user" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const result = await handleDeleteUser({ userId: parsed.userId, email: parsed.email });

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (err) {
          console.error("[Supabase Auth Backend] Error deleting user:", err.message);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    next();
  };
}
