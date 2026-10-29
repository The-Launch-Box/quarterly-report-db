import fs from "node:fs"
import http from "node:http"
import path from "node:path"

import { handleApi } from "./api"
import { loadEnvFile } from "./env"

loadEnvFile()

const port = Number(process.env.PORT || 8787)
const dist = path.resolve(process.cwd(), "dist")

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".ico": "image/x-icon",
}

const server = http.createServer((req, res) => {
  void handleApi(req, res)
    .then((handled) => {
      if (!handled) serveStatic(req, res)
    })
    .catch(() => {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" })
      res.end("The request could not be completed.")
    })
})

server.listen(port, "0.0.0.0", () => {
  console.log(`Quarterly report listening on ${port}`)
})

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): void {
  const pathname = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/")
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "")
  const file = path.resolve(dist, relative)
  const root = dist.endsWith(path.sep) ? dist : dist + path.sep
  if (file !== dist && !file.startsWith(root)) {
    res.writeHead(403)
    res.end()
    return
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405)
    res.end()
    return
  }
  const existingFile = fs.existsSync(file) && fs.statSync(file).isFile()
  const target = existingFile ? file : path.extname(relative) ? "" : path.join(dist, "index.html")
  if (!target || !fs.existsSync(target)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
    res.end("Not found.")
    return
  }
  const type = TYPES[path.extname(target)] ?? "application/octet-stream"
  res.writeHead(200, { "Content-Type": type, "Cache-Control": target.endsWith("index.html") ? "no-store" : "public, max-age=3600" })
  if (req.method === "HEAD") {
    res.end()
    return
  }
  fs.createReadStream(target).pipe(res)
}
