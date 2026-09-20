/**
 * src/server/supabaseAuthService.js
 * -------------------------------------------------------------------------
 * Backend middleware for auto-creating Supabase Auth users & returning their UIDs.
 * Endpoint: POST /api/auth/create-user
 * -------------------------------------------------------------------------
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function getEnvVars() {
  let url = process.env.VITE_SUPABASE_URL || "";
  let anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !anonKey) {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, "utf8");
        const urlMatch = envContent.match(/VITE_SUPABASE_URL\s*=\s*([^\r\n]+)/);
        const anonMatch = envContent.match(/VITE_SUPABASE_ANON_KEY\s*=\s*([^\r\n]+)/);
        const serviceMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/) || envContent.match(/VITE_SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);
        if (urlMatch && urlMatch[1]) url = urlMatch[1].trim().replace(/^["']|["']$/g, "");
        if (anonMatch && anonMatch[1]) anonKey = anonMatch[1].trim().replace(/^["']|["']$/g, "");
        if (serviceMatch && serviceMatch[1]) serviceKey = serviceMatch[1].trim().replace(/^["']|["']$/g, "");
      } catch (e) {
        // ignore
      }
    }
  }

  return { url: url.trim(), anonKey: anonKey.trim(), serviceKey: serviceKey.trim() };
}

export function createSupabaseAuthMiddleware() {
  return async (req, res, next) => {
    const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = urlObj.pathname;

    if (pathname === "/api/auth/create-user" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const { email, password, name } = JSON.parse(body || "{}");
          if (!email || !password) {
            throw new Error("Email and password are required to create a user");
          }

          const { url, anonKey, serviceKey } = getEnvVars();
          if (!url || (!anonKey && !serviceKey)) {
            throw new Error("Supabase URL and API keys are missing in backend .env");
          }

          let createdUser = null;

          // If service role key is available, use admin API
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
              // If user already exists in auth, try fetching existing user by email
              if (error.message?.includes("already registered") || error.message?.includes("exists")) {
                const { data: listData } = await adminClient.auth.admin.listUsers();
                const existing = listData?.users?.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());
                if (existing) {
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
            // Fallback to standard client signUp
            const client = createClient(url, anonKey, {
              auth: { autoRefreshToken: false, persistSession: false }
            });
            const { data, error } = await client.auth.signUp({
              email: email.trim(),
              password: password.trim(),
              options: { data: { name: name || "" } }
            });

            if (error) {
              throw error;
            }
            if (!data.user?.id) {
              throw new Error("User creation failed or user already exists.");
            }
            createdUser = data.user;
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: true,
            user: {
              id: createdUser.id,
              email: createdUser.email,
              name: name || createdUser.user_metadata?.name || ""
            }
          }));
        } catch (err) {
          console.error("[Supabase Auth Backend] Error creating user:", err.message);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    next();
  };
}
