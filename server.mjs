// Zero-dependency static file server for local development.
// Usage: node server.mjs [port]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 8080);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/** Request handler serving files under `root` (exported for the tests). */
export function makeHandler(root) {
  return (req, res) => serve(root, req, res);
}
export const handle = makeHandler(ROOT);

function serve(ROOT, req, res) {
  let rel;
  try {
    rel = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain" }).end("Bad request"); // malformed %-escape used to crash the server
    return;
  }
  if (rel === "/") rel = "/index.html";

  const filePath = path.join(ROOT, rel);
  // A bare startsWith(ROOT) also let a sibling folder such as "<ROOT>2" through.
  const inside = path.relative(ROOT, filePath);
  if (inside.startsWith("..") || path.isAbsolute(inside)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(data);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  http.createServer(handle).listen(PORT, () => {
    console.log(`Digi Chosen running at http://localhost:${PORT}/`);
  });
}
