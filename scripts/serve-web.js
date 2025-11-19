import { createServer } from 'node:http';
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const defaultFile = path.join(rootDir, 'web', 'index.html');
const port = Number(process.env.PORT || 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function safeResolve(requestPath) {
  const resolved = path.join(rootDir, requestPath);
  if (!resolved.startsWith(rootDir)) {
    return null;
  }
  return resolved;
}

async function serveFile(filePath, res) {
  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch (error) {
    res.writeHead(404);
    res.end('Not found');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let requestPath = url.pathname;
  if (requestPath === '/' || requestPath === '') {
    await serveFile(defaultFile, res);
    return;
  }
  const safePath = safeResolve(`.${requestPath}`);
  if (!safePath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  try {
    let stats = await stat(safePath);
    let finalPath = safePath;
    if (stats.isDirectory()) {
      finalPath = path.join(safePath, 'index.html');
      stats = await stat(finalPath);
    }
    if (stats.isFile()) {
      await serveFile(finalPath, res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  } catch (error) {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(port, () => {
  console.log(`Control room ready on http://localhost:${port}`);
  console.log('Press Ctrl+C to stop.');
});
