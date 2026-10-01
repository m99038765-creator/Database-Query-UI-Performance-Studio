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

// Resolve potential build / dist directories
const candidateDirs = [
  path.join(process.cwd(), 'dist'),
  path.join(process.cwd(), 'build'),
  path.join(__dirname, 'dist'),
  path.join(__dirname, 'build'),
];

// Mount static file serving for all existing candidate directories
for (const dir of candidateDirs) {
  if (fs.existsSync(dir)) {
    app.use(express.static(dir));
  }
}

// Find the first index.html file that actually exists
const findIndexHtml = () => {
  for (const dir of candidateDirs) {
    const candidate = path.join(dir, 'index.html');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
};

// Fallback route for SPA client-side routing
app.use((req, res, next) => {
  if (req.method !== 'GET') {
    return next();
  }
  const indexHtmlPath = findIndexHtml();
  if (indexHtmlPath) {
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

// Determine single listening port:
// In AI Studio Cloud Run containers, NGINX runs on NGINX_PORT (8080) and proxies to DEFAULT_APP_PORT (3000).
// In standalone Cloud Run environments without NGINX, the app listens directly on PORT (8080).
const isNginxProxyPresent = Boolean(process.env.NGINX_PORT || process.env.DEFAULT_APP_PORT);
const targetPort = isNginxProxyPresent
  ? parseInt(process.env.DEFAULT_APP_PORT || '3000', 10)
  : parseInt(process.env.PORT || '8080', 10);

const PORT = isNaN(targetPort) ? 3000 : targetPort;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server successfully listening on http://0.0.0.0:${PORT}`);
});

server.on('error', (err) => {
  console.error(`Server error on port ${PORT}:`, err);
  if (err && (err as any).code === 'EADDRINUSE') {
    const fallbackPort = PORT === 3000 ? 8080 : 3000;
    console.log(`Port ${PORT} in use, trying fallback port ${fallbackPort}...`);
    const fallbackServer = app.listen(fallbackPort, '0.0.0.0', () => {
      console.log(`Server successfully listening on fallback http://0.0.0.0:${fallbackPort}`);
    });
    fallbackServer.on('error', (fallbackErr) => {
      console.error(`Fatal error on fallback port ${fallbackPort}:`, fallbackErr);
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// Graceful shutdown handling for Cloud Run revision rollout
const gracefulShutdown = (signal: string) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
  setTimeout(() => {
    process.exit(0);
  }, 2000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
