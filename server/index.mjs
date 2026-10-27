import { createServer } from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { PayloadTooLargeError, QuotaExceededError, Store, StoreError } from './store.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, '.env'));

function intEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

const PORT = intEnv('PORT', 8787);
const HOST = String(process.env.HOST || '127.0.0.1').trim() || '127.0.0.1';
const DATA_DIR = path.resolve(String(process.env.DATA_DIR || path.join(os.homedir(), '.local/share/thi-dua-gdqp')));
const DIST_DIR = path.resolve(String(process.env.DIST_DIR || path.join(ROOT_DIR, 'dist')));
const MAX_DATA_BYTES = intEnv('MAX_DATA_BYTES', 10 * 1024 ** 3);
const MAX_PAYLOAD_BYTES = intEnv('MAX_PAYLOAD_BYTES', 100 * 1024 ** 2);
const BACKUP_INTERVAL_HOURS = Number(process.env.BACKUP_INTERVAL_HOURS || 24);
const BACKUP_KEEP = intEnv('BACKUP_KEEP', 14);
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readAccessCode() {
  const configured = String(process.env.ACCESS_CODE || '').trim();
  if (configured) return configured;

  ensureDir(DATA_DIR);
  const file = path.join(DATA_DIR, 'access-code.txt');
  if (fs.existsSync(file)) {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing) return existing;
  }
  const code = `GDQP-${randomBytes(6).toString('hex').toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
  fs.writeFileSync(file, `${code}\n`, { mode: 0o600 });
  return code;
}

const ACCESS_CODE = readAccessCode();
const store = new Store({
  dataDir: DATA_DIR,
  maxDataBytes: MAX_DATA_BYTES,
  backupKeep: BACKUP_KEEP,
  payloadLimitBytes: MAX_PAYLOAD_BYTES
}).init();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

function nowIso() {
  return new Date().toISOString();
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function tokenFromRequest(req) {
  const auth = String(req.headers.authorization || '').trim();
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim();
  return String(req.headers.apikey || req.headers['x-access-code'] || '').trim();
}

function isAuthorized(req) {
  return safeEqual(tokenFromRequest(req), ACCESS_CODE);
}

function corsHeaders(req) {
  const origin = String(req.headers.origin || '');
  if (!origin) return {};
  if (ALLOWED_ORIGINS.includes('*')) return { 'Access-Control-Allow-Origin': '*' };
  if (ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin'
    };
  }
  return {};
}

function isOriginAllowed(req) {
  const origin = String(req.headers.origin || '');
  if (!origin) return true;
  return ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin);
}

function commonHeaders(req) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    ...corsHeaders(req)
  };
}

function sendJson(req, res, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    ...commonHeaders(req),
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

function sendError(req, res, error) {
  if (error instanceof StoreError) {
    sendJson(req, res, error.status, { ok: false, code: error.code, message: error.message });
    return;
  }
  if (error instanceof PayloadTooLargeError || error instanceof QuotaExceededError) {
    sendJson(req, res, error.status, { ok: false, code: error.code, message: error.message });
    return;
  }
  console.error('[thi-dua] Lỗi xử lý:', error);
  sendJson(req, res, 500, { ok: false, code: 'internal_error', message: 'Máy chủ gặp lỗi xử lý.' });
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', chunk => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > limit) {
        tooLarge = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) {
        reject(new PayloadTooLargeError(`Dữ liệu gửi lên quá lớn (giới hạn ${(limit / 1024 / 1024).toFixed(0)} MB).`));
        return;
      }
      resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

async function readJsonBody(req) {
  const body = await readBody(req, MAX_PAYLOAD_BYTES + 1024 * 1024);
  if (!body.length) throw new StoreError('Thiếu nội dung JSON.', 'invalid_json', 400);
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    throw new StoreError('Nội dung JSON không hợp lệ.', 'invalid_json', 400);
  }
}

function decodeSegment(value, label) {
  let decoded;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new StoreError(`${label} không hợp lệ.`, 'invalid_segment', 400);
  }
  if (!/^[A-Za-z0-9_.-]{1,120}$/.test(decoded)) {
    throw new StoreError(`${label} chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.`, 'invalid_segment', 400);
  }
  return decoded;
}

function courseKey(syncId, courseId) {
  return `${syncId}::${courseId}`;
}

function colorFor(id) {
  const palette = ['#0f766e', '#d4a017', '#3b82f6', '#c2415a', '#7c3aed', '#0e7490', '#b45309', '#15803d'];
  const hash = createHash('sha1').update(String(id)).digest();
  return palette[hash[0] % palette.length];
}

function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(req, res, 405, { ok: false, message: 'Phương thức không được hỗ trợ.' });
    return;
  }
  if (!fs.existsSync(DIST_DIR)) {
    sendJson(req, res, 503, {
      ok: false,
      message: 'Chưa có thư mục dist. Hãy chạy npm run build trước khi chạy server.'
    });
    return;
  }

  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    sendJson(req, res, 400, { ok: false, message: 'Đường dẫn không hợp lệ.' });
    return;
  }

  let relative = decoded === '/' ? '/index.html' : decoded;
  let filePath = path.resolve(DIST_DIR, `.${relative}`);
  if (!filePath.startsWith(`${DIST_DIR}${path.sep}`) && filePath !== DIST_DIR) {
    sendJson(req, res, 403, { ok: false, message: 'Không có quyền truy cập.' });
    return;
  }

  let stat = null;
  try { stat = fs.statSync(filePath); } catch { /* not found */ }
  if (stat?.isDirectory()) {
    filePath = path.join(filePath, 'index.html');
    try { stat = fs.statSync(filePath); } catch { stat = null; }
  }

  if (!stat?.isFile()) {
    const isAssetPath = relative.startsWith('/assets/') || relative.startsWith('/icons/');
    if (!isAssetPath && !path.extname(relative)) {
      filePath = path.join(DIST_DIR, 'index.html');
      try { stat = fs.statSync(filePath); } catch { stat = null; }
    }
  }

  if (!stat?.isFile()) {
    sendJson(req, res, 404, { ok: false, message: 'Không tìm thấy file.' });
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const cacheControl = relative.startsWith('/assets/')
    ? 'public, max-age=31536000, immutable'
    : relative === '/index.html' || relative === '/sw.js' || relative === '/manifest.webmanifest'
      ? 'no-cache'
      : 'public, max-age=3600';

  const headers = {
    ...commonHeaders(req),
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': cacheControl
  };
  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
}

// ---------------------------------------------------------------------------
// Realtime WebSocket
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({ noServer: true });
const rooms = new Map();

function roomClients(key) {
  if (!rooms.has(key)) rooms.set(key, new Set());
  return rooms.get(key);
}

function presenceFor(key) {
  return [...roomClients(key)].map(client => ({
    id: client.clientId,
    name: client.name,
    color: client.color,
    joinedAt: client.joinedAt
  }));
}

function sendSocket(client, data) {
  if (client.ws.readyState !== 1) return;
  try { client.ws.send(JSON.stringify(data)); } catch { /* ignore */ }
}

function broadcastPresence(key) {
  const users = presenceFor(key);
  for (const client of roomClients(key)) {
    sendSocket(client, { type: 'presence', users });
  }
}

function broadcastChanged(key, data) {
  for (const client of roomClients(key)) {
    sendSocket(client, { type: 'changed', ...data });
  }
}

function removeClient(key, client) {
  const set = rooms.get(key);
  if (!set) return;
  set.delete(client);
  if (!set.size) rooms.delete(key);
  else broadcastPresence(key);
}

wss.on('connection', (ws, req, info) => {
  const key = courseKey(info.syncId, info.courseId);
  const client = {
    ws,
    clientId: info.clientId,
    name: info.name || 'Giảng viên',
    color: colorFor(info.clientId),
    joinedAt: nowIso(),
    syncId: info.syncId,
    courseId: info.courseId,
    alive: true
  };
  roomClients(key).add(client);
  ws.on('pong', () => { client.alive = true; });
  ws.on('message', raw => {
    let message;
    try { message = JSON.parse(String(raw)); } catch { return; }
    if (!message || typeof message !== 'object') return;
    if (message.type === 'presence') {
      const name = String(message.name || '').trim().slice(0, 60);
      if (name) {
        client.name = name;
        broadcastPresence(key);
      }
      return;
    }
    if (message.type === 'ping') {
      sendSocket(client, { type: 'pong', time: nowIso() });
    }
  });
  ws.on('close', () => removeClient(key, client));
  ws.on('error', () => removeClient(key, client));

  sendSocket(client, {
    type: 'hello',
    clientId: client.clientId,
    courseId: client.courseId,
    syncId: client.syncId,
    users: presenceFor(key),
    time: nowIso()
  });
  broadcastPresence(key);
});

const heartbeat = setInterval(() => {
  for (const set of rooms.values()) {
    for (const client of set) {
      if (!client.alive) {
        try { client.ws.terminate(); } catch { /* ignore */ }
        continue;
      }
      client.alive = false;
      try { client.ws.ping(); } catch { /* ignore */ }
    }
  }
}, 30000);
heartbeat.unref?.();

// ---------------------------------------------------------------------------
// HTTP API
// ---------------------------------------------------------------------------

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    if (!isOriginAllowed(req)) {
      res.writeHead(403, commonHeaders(req));
      res.end();
      return;
    }
    res.writeHead(204, {
      ...commonHeaders(req),
      'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, X-Client-Id, X-Client-Name',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  try {
    if (pathname.startsWith('/api/')) {
      if (!isOriginAllowed(req)) {
        sendJson(req, res, 403, { ok: false, message: 'Origin không được phép.' });
        return;
      }
      if (!isAuthorized(req)) {
        sendJson(req, res, 401, { ok: false, code: 'unauthorized', message: 'Mã truy cập không đúng hoặc còn thiếu.' });
        return;
      }

      if (pathname === '/api/health' && req.method === 'GET') {
        sendJson(req, res, 200, {
          ok: true,
          app: 'thi-dua-gdqp-server',
          version: '1.0.0',
          time: nowIso(),
          realtime: true,
          usage: store.getUsage()
        });
        return;
      }

      if (pathname === '/api/usage' && req.method === 'GET') {
        sendJson(req, res, 200, { ok: true, usage: store.getUsage() });
        return;
      }

      if (pathname === '/api/backups' && req.method === 'GET') {
        sendJson(req, res, 200, { ok: true, backups: store.listBackups(), usage: store.getUsage() });
        return;
      }

      if (pathname === '/api/backup' && req.method === 'POST') {
        const backup = store.backupNow();
        sendJson(req, res, 200, { ok: true, backup, usage: store.getUsage() });
        return;
      }

      if (pathname === '/api/export' && req.method === 'GET') {
        const data = {
          app: 'thi-dua-gdqp-server',
          exportedAt: nowIso(),
          courses: store.exportAll()
        };
        const body = JSON.stringify(data, null, 2);
        res.writeHead(200, {
          ...commonHeaders(req),
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="thi-dua-export-${Date.now()}.json"`,
          'Content-Length': Buffer.byteLength(body),
          'Cache-Control': 'no-store'
        });
        res.end(body);
        return;
      }

      const courseMatch = pathname.match(/^\/api\/sync\/([^/]+)\/courses\/([^/]+)$/);
      if (courseMatch) {
        const syncId = decodeSegment(courseMatch[1], 'Mã nhóm');
        const courseId = decodeSegment(courseMatch[2], 'Mã khóa');
        if (req.method === 'GET') {
          const course = store.getCourse(syncId, courseId);
          if (!course) {
            sendJson(req, res, 404, { ok: false, code: 'not_found', message: 'Chưa có bản đồng bộ nào cho khóa này.' });
            return;
          }
          sendJson(req, res, 200, { ok: true, ...course });
          return;
        }
        if (req.method === 'PUT') {
          const body = await readJsonBody(req);
          const payload = body.payload || body.record;
          const clientId = String(body.clientId || req.headers['x-client-id'] || '').slice(0, 80);
          const clientName = String(body.clientName || req.headers['x-client-name'] || '').slice(0, 80);
          const result = store.putCourse(syncId, courseId, payload, {
            clientId,
            updatedBy: clientName || clientId
          });
          broadcastChanged(courseKey(syncId, courseId), {
            clientId,
            name: clientName,
            syncId,
            courseId,
            updatedAt: result.updatedAt,
            revision: result.revision
          });
          sendJson(req, res, 200, { ok: true, ...result });
          return;
        }
        sendJson(req, res, 405, { ok: false, message: 'Phương thức không được hỗ trợ.' });
        return;
      }

      const listMatch = pathname.match(/^\/api\/sync\/([^/]+)\/courses$/);
      if (listMatch && req.method === 'GET') {
        const syncId = decodeSegment(listMatch[1], 'Mã nhóm');
        sendJson(req, res, 200, { ok: true, courses: store.listCourses(syncId) });
        return;
      }

      sendJson(req, res, 404, { ok: false, message: 'API không tồn tại.' });
      return;
    }

    serveStatic(req, res, pathname);
  } catch (error) {
    sendError(req, res, error);
  }
});

server.on('upgrade', (req, socket, head) => {
  let url;
  try {
    url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  } catch {
    socket.destroy();
    return;
  }
  if (url.pathname !== '/ws') {
    socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  if (!isOriginAllowed(req)) {
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  if (!safeEqual(url.searchParams.get('token') || '', ACCESS_CODE)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  let syncId;
  let courseId;
  try {
    syncId = decodeSegment(url.searchParams.get('syncId') || '', 'Mã nhóm');
    courseId = decodeSegment(url.searchParams.get('courseId') || '', 'Mã khóa');
  } catch {
    socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  const clientId = String(url.searchParams.get('clientId') || `u_${Date.now().toString(36)}`).slice(0, 80);
  const name = String(url.searchParams.get('name') || 'Giảng viên').trim().slice(0, 60) || 'Giảng viên';
  wss.handleUpgrade(req, socket, head, ws => {
    wss.emit('connection', ws, req, { syncId, courseId, clientId, name });
  });
});

// Backup định kỳ, mặc định 24 giờ một lần.
let backupTimer = null;
if (BACKUP_INTERVAL_HOURS > 0) {
  backupTimer = setInterval(() => {
    try {
      const backup = store.backupNow();
      console.log(`[thi-dua] Đã tạo backup ${backup.file} (${(backup.sizeBytes / 1024 / 1024).toFixed(1)} MB).`);
    } catch (error) {
      console.error('[thi-dua] Backup thất bại:', error.message);
    }
  }, BACKUP_INTERVAL_HOURS * 60 * 60 * 1000);
  backupTimer.unref?.();
}

function shutdown(signal) {
  console.log(`[thi-dua] Nhận ${signal}, đang dừng server...`);
  if (backupTimer) clearInterval(backupTimer);
  clearInterval(heartbeat);
  for (const ws of wss.clients) {
    try { ws.close(1001, 'Server đang dừng'); } catch { /* ignore */ }
  }
  server.close(() => {
    store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref?.();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

server.listen(PORT, HOST, () => {
  const usage = store.getUsage();
  console.log(`[thi-dua] Server chạy tại http://${HOST}:${PORT}`);
  console.log(`[thi-dua] Dữ liệu: ${DATA_DIR}`);
  console.log(`[thi-dua] Giới hạn: ${(MAX_DATA_BYTES / 1024 ** 3).toFixed(2)} GB · đã dùng ${(usage.usedBytes / 1024 ** 2).toFixed(1)} MB`);
  console.log('[thi-dua] Mã truy cập: xem ACCESS_CODE trong môi trường hoặc file access-code.txt trong thư mục dữ liệu.');
});
