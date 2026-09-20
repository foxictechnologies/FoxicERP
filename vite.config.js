import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createHostingerMailMiddleware } from "./src/server/hostingerMailService.js";
import { createSupabaseAuthMiddleware } from "./src/server/supabaseAuthService.js";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    {
      name: "custom-backend-api-middleware",
      configureServer(server) {
        server.middlewares.use(createHostingerMailMiddleware());
        server.middlewares.use(createSupabaseAuthMiddleware());
      },
      configurePreviewServer(server) {
        server.middlewares.use(createHostingerMailMiddleware());
        server.middlewares.use(createSupabaseAuthMiddleware());
      }
    }
  ]
});
