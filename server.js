// server.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var desiredPort = process.env.PORT ? Number(process.env.PORT) : 3e3;
app.use(express.json());
app.use(express.static(path.join(__dirname, "dist")));
app.get("/healthz", (_req, res) => {
  res.status(200).send("OK");
});
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});
function startServer(port) {
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && port !== 3e3) {
      console.warn(`Port ${port} is in use (e.g. Nginx proxy). Falling back to port 3000.`);
      startServer(3e3);
    } else {
      console.error("Server error:", err);
    }
  });
}
startServer(desiredPort);
