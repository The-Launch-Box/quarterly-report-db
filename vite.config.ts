import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin } from "vite"

import { handleApi } from "./server/api"
import { loadEnvFile } from "./server/env"

function workspaceApi(): Plugin {
  return {
    name: "workspace-api",
    configureServer(server) {
      loadEnvFile()
      server.middlewares.use((req, res, next) => {
        void handleApi(req, res)
          .then((handled) => {
            if (!handled) next()
          })
          .catch(next)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname), "")
  for (const key of ["VITE_AZURE_CLIENT_ID", "VITE_AZURE_TENANT_ID", "BOARD_DATA_DIR"] as const) {
    if (env[key] && process.env[key] === undefined) process.env[key] = env[key]
  }
  return {
    plugins: [workspaceApi(), react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5174,
      strictPort: false,
    },
  }
})
