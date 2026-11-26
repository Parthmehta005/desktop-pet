// A tiny static file server for the browser preview page. No dependencies.
//
//   npm run preview                 -> http://127.0.0.1:4173/preview/
//   node scripts/preview-server.js --port 5000
//
// Only files under preview/ and src/ are served, and only to this machine.
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SERVED_DIRS = ['preview', 'src'];

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

/** Maps a URL path to a file on disk, or null if it isn't one we serve. */
export function resolveRequestPath(urlPath, root = ROOT) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  if (decoded.endsWith('/')) decoded += 'index.html';
  const segments = decoded.split('/').filter(Boolean);
  if (segments.length < 2 || !SERVED_DIRS.includes(segments[0])) return null;
  const file = path.resolve(root, ...segments);
  const base = path.resolve(root, segments[0]) + path.sep;
  if (!file.startsWith(base)) return null;
  if (!CONTENT_TYPES[path.extname(file).toLowerCase()]) return null;
  return file;
}

export function createPreviewServer({ root = ROOT } = {}) {
  return http.createServer(async (req, res) => {
    const send = (status, body, headers = {}) => {
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
      res.end(body);
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'Method not allowed', { Allow: 'GET, HEAD' });
    const urlPath = req.url ?? '/';
    if (urlPath === '/' || urlPath === '/preview') return send(302, '', { Location: '/preview/' });
    const file = resolveRequestPath(urlPath, root);
    if (!file) return send(404, 'Not found');
    try {
      const info = await stat(file);
      if (!info.isFile()) return send(404, 'Not found');
      res.writeHead(200, {
        'Content-Type': CONTENT_TYPES[path.extname(file).toLowerCase()],
        'Content-Length': info.size,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      if (req.method === 'HEAD') return res.end();
      createReadStream(file).pipe(res);
    } catch {
      send(404, 'Not found');
    }
  });
}

function parseArgs(argv) {
  const args = { port: 4173, host: '127.0.0.1' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port') args.port = Number(argv[++i]);
    else if (argv[i] === '--host') args.host = argv[++i];
  }
  if (!Number.isInteger(args.port) || args.port < 0 || args.port > 65535) {
    throw new Error(`Invalid --port: ${args.port}`);
  }
  return args;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { port, host } = parseArgs(process.argv.slice(2));
  const server = createPreviewServer();
  server.listen(port, host, () => {
    const { port: actual } = server.address();
    console.log(`Desktop Pet preview: http://${host}:${actual}/preview/`);
  });
}
