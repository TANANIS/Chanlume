import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".json": "application/json" };

http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  const route = pathname === "/feed/channels" ? "/work/channels-scan-preview.html" : pathname === "/" ? "/extension/dashboard/dashboard.html" : pathname;
  const target = path.resolve(root, `.${route}`);
  if (!target.startsWith(root)) { response.writeHead(403).end("Forbidden"); return; }
  fs.readFile(target, (error, data) => {
    if (error) { response.writeHead(404).end("Not found"); return; }
    response.writeHead(200, { "Content-Type": types[path.extname(target)] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(data);
  });
}).listen(18766, "127.0.0.1", () => process.stdout.write("Chanlume preview: http://127.0.0.1:18766\n"));
