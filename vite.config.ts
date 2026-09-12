import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")

  return {
    server: {
      port: 5173,
      strictPort: true,
      allowedHosts: (env.DEV_ALLOWED_HOSTS || "").split(",").map(host => host.trim()).filter(Boolean),
      proxy: {
        "/api": {
          target: env.API_PROXY_TARGET || "http://127.0.0.1:4004",
          changeOrigin: true,
          ws: true,
        },
      },
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        {
          find: /^es-toolkit\/compat\/(.+)$/,
          replacement: path.resolve(__dirname, "./src/lib/es-toolkit-compat/$1.ts"),
        },
        {
          find: "@",
          replacement: path.resolve(__dirname, "./src"),
        },
      ],
    },
  }
})
