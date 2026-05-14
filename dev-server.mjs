import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const PORT = process.env.PORT ?? 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
  '.ttf':  'font/ttf',
};

function serveFile(res, filePath) {
  const type = MIME[extname(filePath)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  res.end(readFileSync(filePath));
}

createServer((req, res) => {
  const url = req.url.split('?')[0];

  // /minigames/* → built React app with SPA fallback
  if (url.startsWith('/minigames/')) {
    const rel = url.slice('/minigames/'.length);
    const candidate = join('minigames/dist', rel);
    if (rel && existsSync(candidate) && statSync(candidate).isFile()) {
      serveFile(res, candidate);
    } else {
      serveFile(res, 'minigames/dist/index.html');
    }
    return;
  }

  // / and /index.html → landing page
  if (url === '/' || url === '/index.html') {
    serveFile(res, 'frontend/index.html');
    return;
  }

  // /redhat.svg etc → frontend/public/
  const publicFile = join('frontend/public', url);
  if (existsSync(publicFile) && statSync(publicFile).isFile()) {
    serveFile(res, publicFile);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}).listen(PORT, () => {
  console.log(`\nDev server → http://localhost:${PORT}\n`);
});
