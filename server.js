// server.ts
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
app.use(express.json());
app.get(["/healthz", "/_health", "/health", "/_ready"], (_req, res) => {
  res.status(200).send("OK");
});
var distDir = path.join(__dirname, "dist");
var indexHtmlPath = path.join(distDir, "index.html");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}
app.get("*", (_req, res) => {
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
var server = app.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on http://0.0.0.0:${port}`);
});
server.on("error", (err) => {
  console.error("Server error:", err);
  process.exit(1);
});
var gracefulShutdown = (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });
  setTimeout(() => {
    console.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 1e4);
};
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
