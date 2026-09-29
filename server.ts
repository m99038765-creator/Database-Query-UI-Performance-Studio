import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());

// Cloud Run health check endpoints
app.get(['/healthz', '/_health', '/health', '/_ready'], (_req, res) => {
  res.status(200).send('OK');
});

// Resolve the static files directory (supports dist, build, relative to cwd or __dirname)
const possibleDirs = [
  path.join(process.cwd(), 'dist'),
  path.join(process.cwd(), 'build'),
  path.join(__dirname, 'dist'),
  path.join(__dirname, 'build'),
  '/dist',
  '/build'
];
const distDir = possibleDirs.find((dir) => fs.existsSync(dir)) || path.join(__dirname, 'dist');
const indexHtmlPath = path.join(distDir, 'index.html');

console.log(`Resolved static directory: ${distDir} (exists: ${fs.existsSync(distDir)})`);
console.log(`Resolved index.html path: ${indexHtmlPath} (exists: ${fs.existsSync(indexHtmlPath)})`);

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}

// Fallback route for SPA client-side routing
app.use((req, res, next) => {
  if (req.method !== 'GET') {
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

// Listen on all relevant ports:
// 1. process.env.PORT (Cloud Run default, e.g. 8080)
// 2. 8080 (standard Cloud Run HTTP port)
// 3. 3000 (AI Studio Nginx reverse proxy target and container standard)
const portsToListen = new Set<number>();
if (process.env.PORT) {
  const envPort = parseInt(process.env.PORT, 10);
  if (!isNaN(envPort)) portsToListen.add(envPort);
}
portsToListen.add(8080);
portsToListen.add(3000);

const activeServers: any[] = [];

for (const port of portsToListen) {
  try {
    const s = app.listen(port, '0.0.0.0', () => {
      console.log(`Server successfully listening on http://0.0.0.0:${port}`);
    });
    s.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
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

// Graceful shutdown handling for Cloud Run revision rollout
const gracefulShutdown = (signal: string) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  for (const s of activeServers) {
    try {
      s.close();
    } catch (_) {}
  }
  setTimeout(() => {
    process.exit(0);
  }, 1000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

