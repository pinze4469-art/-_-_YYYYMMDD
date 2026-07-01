import http from 'node:http';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './http/router.mjs';
import { FileQuizRepository, seedDemoSessions } from './data/repository.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dataFile = process.env.DATA_FILE || join(root, 'data', 'dev-db.json');
const port = Number(process.env.PORT || 3000);
mkdirSync(dirname(dataFile), { recursive: true });
const repo = new FileQuizRepository(dataFile);
seedDemoSessions(repo);
const app = createApp(repo);
const publicDir = join(root, 'public');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    ...headers
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body, null, 2));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return { __invalidJson: raw }; }
}

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const safePath = requested.split('\\').join('/').split('..').join('');
  const filePath = join(publicDir, safePath);
  if (!existsSync(filePath)) return false;
  const type = contentTypes[extname(filePath)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  res.end(readFileSync(filePath));
  return true;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const url = new URL(req.url, 'http://localhost');
  const isApi = url.pathname.startsWith('/api/') || url.pathname === '/pay' || url.pathname === '/health';
  if (!isApi && req.method === 'GET' && serveStatic(req, res)) return;
  const body = await readBody(req);
  if (body.__invalidJson !== undefined) {
    return send(res, 400, { error: { code: 'INVALID_JSON', message: 'Body must be valid JSON' } });
  }
  const result = await app.handle(req.method, url.pathname, body);
  send(res, result.status, result.body);
});

server.listen(port, () => {
  console.log('Health quiz server running at http://localhost:' + port);
  console.log('Demo paid session: demo-paid-session');
});
