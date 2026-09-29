// server.ts
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
app.use(express.json());
app.get(["/healthz", "/_health", "/health", "/_ready"], (_req, res) => {
  res.status(200).send("OK");
});
var possibleDirs = [
  path.join(process.cwd(), "dist"),
  path.join(process.cwd(), "build"),
  path.join(__dirname, "dist"),
  path.join(__dirname, "build"),
  "/dist",
  "/build"
];
var distDir = possibleDirs.find((dir) => fs.existsSync(dir)) || path.join(__dirname, "dist");
var indexHtmlPath = path.join(distDir, "index.html");
console.log(`Resolved static directory: ${distDir} (exists: ${fs.existsSync(distDir)})`);
console.log(`Resolved index.html path: ${indexHtmlPath} (exists: ${fs.existsSync(indexHtmlPath)})`);
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}
app.use((req, res, next) => {
  if (req.method !== "GET") {
    return next();
  }
  if (fs.existsSync(indexHtmlPath)) {
    res.sendFile(indexHtmlPath);
  } else {
    res.status(200).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Database Query &amp; UI Performance Optimizer</title>
  </head>
  <body>
    <div id="root">
      <div style="font-family: system-ui, sans-serif; padding: 2rem; text-align: center; color: #444;">
        <h2>Initializing Application...</h2>
        <p>The service is preparing. Please refresh in a few moments.</p>
      </div>
    </div>
  </body>
</html>`);
  }
});
var portsToListen = /* @__PURE__ */ new Set();
if (process.env.PORT) {
  const envPort = parseInt(process.env.PORT, 10);
  if (!isNaN(envPort)) portsToListen.add(envPort);
}
portsToListen.add(8080);
portsToListen.add(3e3);
var activeServers = [];
for (const port of portsToListen) {
  try {
    const s = app.listen(port, "0.0.0.0", () => {
      console.log(`Server successfully listening on http://0.0.0.0:${port}`);
    });
    s.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.log(`Port ${port} is already in use (e.g. by Nginx proxy bridge), skipping.`);
      } else {
        console.error(`Server error on port ${port}:`, err);
      }
    });
    activeServers.push(s);
  } catch (err) {
    console.log(`Could not bind to port ${port}:`, err);
  }
}
var gracefulShutdown = (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  for (const s of activeServers) {
    try {
      s.close();
    } catch (_) {
    }
  }
  setTimeout(() => {
    process.exit(0);
  }, 1e3);
};
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
