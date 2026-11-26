// Receives Claude Code hook events from the installed curl command.
//
//   POST http://127.0.0.1:<port>/desktop-pet/claude-hook
//   X-Pet-Token: <token from config>
//   <the hook's JSON payload>
//
// It listens on 127.0.0.1 only, needs the token, caps the body size and always answers
// with an empty body: some hooks feed their output into Claude's context, and the pet
// must never add anything there. A custom header also means a web page can't post here
// without a CORS preflight, which this server never approves.
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

export const HOOK_PATH = '/desktop-pet/claude-hook';
export const MAX_BODY_BYTES = 256 * 1024;

function tokensMatch(given, expected) {
  if (typeof given !== 'string' || typeof expected !== 'string' || expected === '') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * @param {object} options
 * @param {() => string} options.getToken  Current token (read on every request).
 * @param {(payload: object) => void} options.onHook
 * @param {string} [options.host]
 */
export function createHookServer({ getToken, onHook, host = '127.0.0.1' }) {
  const server = http.createServer((req, res) => {
    const reply = (status, headers = {}) => {
      res.writeHead(status, { 'Content-Length': '0', ...headers });
      res.end();
    };
    const url = (req.url ?? '').split('?')[0];
    if (url !== HOOK_PATH) return reply(404);
    if (req.method !== 'POST') return reply(405, { Allow: 'POST' });
    if (!tokensMatch(req.headers['x-pet-token'], getToken())) return reply(401);
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return reply(413);

    const chunks = [];
    let size = 0;
    let tooBig = false;
    req.on('data', (chunk) => {
      if (tooBig) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooBig = true;
        reply(413);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooBig) return;
      let payload;
      try {
        payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return reply(400);
      }
      if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return reply(400);
      reply(204);
      try {
        onHook(payload);
      } catch (err) {
        console.error('Desktop Pet: hook handler failed:', err);
      }
    });
    req.on('error', () => {});
  });

  let listeningPort = null;

  return {
    /** Starts listening; rejects with the system error (e.g. EADDRINUSE). */
    start(port) {
      return new Promise((resolve, reject) => {
        const onError = (err) => {
          server.off('listening', onListening);
          reject(err);
        };
        const onListening = () => {
          server.off('error', onError);
          listeningPort = server.address().port;
          resolve(listeningPort);
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, host);
      });
    },
    stop() {
      listeningPort = null;
      return new Promise((resolve) => server.close(() => resolve()));
    },
    get port() {
      return listeningPort;
    },
    get listening() {
      return server.listening;
    },
  };
}
