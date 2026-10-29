import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { App } from "@/App"
import { AuthGate } from "@/auth/gate"
import "@/styles/app.css"

const root = document.getElementById("root")
if (!root) throw new Error("Missing root")

createRoot(root).render(
  <StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </StrictMode>,
)
