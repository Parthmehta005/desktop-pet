import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { networkInterfaces } from 'node:os';
import { createHookServer, HOOK_PATH, MAX_BODY_BYTES } from '../../src/main/sources/hook-server.js';

const TOKEN = 'test-token-0123456789abcdef';
const received = [];
let server;
let base;

before(async () => {
  server = createHookServer({ getToken: () => TOKEN, onHook: (p) => received.push(p) });
  const port = await server.start(0);
  base = `http://127.0.0.1:${port}`;
});

after(() => server.stop());

const post = (body, headers = {}, path = HOOK_PATH) => fetch(`${base}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Pet-Token': TOKEN, ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

test('a valid event gets 204 with an empty body and is handed on', async () => {
  received.length = 0;
  const res = await post({ hook_event_name: 'Stop', session_id: 'a' });
  assert.equal(res.status, 204);
  assert.equal(await res.text(), '');
  assert.deepEqual(received, [{ hook_event_name: 'Stop', session_id: 'a' }]);
});

test('a missing or wrong token gets 401 and nothing is handed on', async () => {
  received.length = 0;
  assert.equal((await post({ a: 1 }, { 'X-Pet-Token': 'wrong' })).status, 401);
  assert.equal((await post({ a: 1 }, { 'X-Pet-Token': TOKEN.slice(0, -1) })).status, 401);
  const noToken = await fetch(`${base}${HOOK_PATH}`, { method: 'POST', body: '{}' });
  assert.equal(noToken.status, 401);
  assert.deepEqual(received, []);
});

test('an empty configured token never matches', async () => {
  const s = createHookServer({ getToken: () => '', onHook: () => assert.fail('should not be called') });
  const port = await s.start(0);
  try {
    const res = await fetch(`http://127.0.0.1:${port}${HOOK_PATH}`, { method: 'POST', headers: { 'X-Pet-Token': '' }, body: '{}' });
    assert.equal(res.status, 401);
  } finally {
    await s.stop();
  }
});

test('bad JSON, or JSON that is not an object, gets 400', async () => {
  for (const body of ['{ nope', '', '[1,2]', 'null', '42', '"text"']) {
    assert.equal((await post(body)).status, 400, JSON.stringify(body));
  }
});

test('an oversized body is rejected with 413', async () => {
  const big = JSON.stringify({ hook_event_name: 'Stop', padding: 'x'.repeat(MAX_BODY_BYTES) });
  const res = await post(big).catch((err) => ({ status: 'reset', err }));
  assert.ok(res.status === 413 || res.status === 'reset', `got ${res.status}`);
});

test('other paths get 404 and other methods 405 (including CORS preflight)', async () => {
  assert.equal((await post({}, {}, '/')).status, 404);
  assert.equal((await post({}, {}, '/claude-hook')).status, 404);
  assert.equal((await fetch(`${base}${HOOK_PATH}`)).status, 405);
  const preflight = await fetch(`${base}${HOOK_PATH}`, {
    method: 'OPTIONS',
    headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' },
  });
  assert.equal(preflight.status, 405);
  assert.equal(preflight.headers.get('access-control-allow-origin'), null);
});

test('it listens on 127.0.0.1 only', async () => {
  const lan = Object.values(networkInterfaces()).flat()
    .find((i) => i && i.family === 'IPv4' && !i.internal);
  if (!lan) return; // no other address on this machine to try
  const connected = await new Promise((resolve) => {
    const socket = net.connect({ host: lan.address, port: server.port });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
    socket.setTimeout(1500, () => { socket.destroy(); resolve(false); });
  });
  assert.equal(connected, false, `reachable on ${lan.address}`);
});

test('a port already in use is reported, not thrown away', async () => {
  const other = createHookServer({ getToken: () => TOKEN, onHook: () => {} });
  await assert.rejects(other.start(server.port), { code: 'EADDRINUSE' });
  assert.equal(other.listening, false);
});

test('a handler that throws does not break the server', async () => {
  const s = createHookServer({ getToken: () => TOKEN, onHook: () => { throw new Error('boom'); } });
  const port = await s.start(0);
  const quiet = console.error;
  console.error = () => {};
  try {
    const res = await fetch(`http://127.0.0.1:${port}${HOOK_PATH}`, { method: 'POST', headers: { 'X-Pet-Token': TOKEN }, body: '{}' });
    assert.equal(res.status, 204);
    const again = await fetch(`http://127.0.0.1:${port}${HOOK_PATH}`, { method: 'POST', headers: { 'X-Pet-Token': TOKEN }, body: '{}' });
    assert.equal(again.status, 204);
  } finally {
    console.error = quiet;
    await s.stop();
  }
});
