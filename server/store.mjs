import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export class StoreError extends Error {
  constructor(message, code = 'store_error', status = 400) {
    super(message);
    this.name = 'StoreError';
    this.code = code;
    this.status = status;
  }
}

export class QuotaExceededError extends StoreError {
  constructor(message = 'Dữ liệu đã vượt quá giới hạn dung lượng.') {
    super(message, 'quota_exceeded', 507);
    this.name = 'QuotaExceededError';
  }
}

export class PayloadTooLargeError extends StoreError {
  constructor(message = 'Dữ liệu gửi lên quá lớn.') {
    super(message, 'payload_too_large', 413);
    this.name = 'PayloadTooLargeError';
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function fileSize(file) {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
}

function dirSize(dir) {
  let total = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += dirSize(full);
    } else if (entry.isFile()) {
      total += fileSize(full);
    }
  }
  return total;
}

function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function normalizeSegment(value, label) {
  const text = String(value || '').trim();
  if (!text || text.length > 120 || !/^[A-Za-z0-9_.-]+$/.test(text)) {
    throw new StoreError(`${label} không hợp lệ.`, 'invalid_segment', 400);
  }
  return text;
}

export class Store {
  constructor({ dataDir, maxDataBytes = 10 * 1024 ** 3, backupKeep = 14, payloadLimitBytes = 100 * 1024 ** 2 }) {
    if (!dataDir) throw new Error('Thiếu dataDir.');
    this.dataDir = path.resolve(dataDir);
    this.maxDataBytes = Math.max(1024 * 1024, Number(maxDataBytes) || 10 * 1024 ** 3);
    this.backupKeep = Math.max(1, Number(backupKeep) || 14);
    this.payloadLimitBytes = Math.max(1024 * 1024, Number(payloadLimitBytes) || 100 * 1024 ** 2);
    this.dbPath = path.join(this.dataDir, 'thi-dua.sqlite');
    this.backupsDir = path.join(this.dataDir, 'backups');
    this.db = null;
  }

  init() {
    ensureDir(this.dataDir);
    ensureDir(this.backupsDir);
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = NORMAL');
    this.db.exec('PRAGMA foreign_keys = ON');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS courses (
        sync_id TEXT NOT NULL,
        course_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        updated_by TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (sync_id, course_id)
      )
    `);
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_courses_sync_updated ON courses (sync_id, updated_at DESC)');

    try {
      const pageSize = Number(this.db.prepare('PRAGMA page_size').get()?.page_size) || 4096;
      // Dành khoảng 10% dung lượng cho backup và các file phụ.
      const dbLimit = Math.max(1024 * 1024, Math.floor(this.maxDataBytes * 0.9));
      const maxPages = Math.max(256, Math.floor(dbLimit / pageSize));
      this.db.exec(`PRAGMA max_page_count = ${maxPages}`);
    } catch (error) {
      console.warn('[thi-dua] Không đặt được max_page_count:', error.message);
    }

    this.pruneBackups();
    return this;
  }

  getUsage() {
    const totalBytes = dirSize(this.dataDir);
    const backupBytes = dirSize(this.backupsDir);
    const dbBytes = fileSize(this.dbPath) + fileSize(`${this.dbPath}-wal`) + fileSize(`${this.dbPath}-shm`);
    let courseCount = 0;
    try {
      courseCount = Number(this.db.prepare('SELECT COUNT(*) AS n FROM courses').get()?.n) || 0;
    } catch {
      courseCount = 0;
    }
    return {
      usedBytes: totalBytes,
      limitBytes: this.maxDataBytes,
      remainingBytes: Math.max(0, this.maxDataBytes - totalBytes),
      percent: this.maxDataBytes ? Math.min(100, Math.round((totalBytes / this.maxDataBytes) * 10000) / 100) : 0,
      dbBytes,
      backupBytes,
      courseCount,
      backupCount: this.listBackups().length
    };
  }

  getCourse(syncId, courseId) {
    const safeSyncId = normalizeSegment(syncId, 'Mã nhóm');
    const safeCourseId = normalizeSegment(courseId, 'Mã khóa');
    const row = this.db.prepare(
      'SELECT payload, updated_at, revision, updated_by FROM courses WHERE sync_id = ? AND course_id = ?'
    ).get(safeSyncId, safeCourseId);
    if (!row) return null;

    let payload;
    try {
      payload = JSON.parse(row.payload);
    } catch {
      throw new StoreError('Dữ liệu trên máy chủ không đúng định dạng JSON.', 'invalid_payload', 500);
    }
    return {
      payload,
      updatedAt: row.updated_at,
      revision: Number(row.revision) || 1,
      updatedBy: row.updated_by || '',
      sizeBytes: Buffer.byteLength(row.payload)
    };
  }

  putCourse(syncId, courseId, payload, { updatedBy = '', clientId = '' } = {}) {
    const safeSyncId = normalizeSegment(syncId, 'Mã nhóm');
    const safeCourseId = normalizeSegment(courseId, 'Mã khóa');
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new StoreError('Payload phải là một object.', 'invalid_payload', 400);
    }
    if (!payload.meta || typeof payload.meta !== 'object' || payload.meta.id !== safeCourseId) {
      throw new StoreError('Mã khóa trong payload không khớp với URL.', 'invalid_payload', 400);
    }
    if (!Array.isArray(payload.items)) {
      throw new StoreError('Payload thiếu mảng items.', 'invalid_payload', 400);
    }

    const json = JSON.stringify(payload);
    const bytes = Buffer.byteLength(json);
    if (bytes > this.payloadLimitBytes) {
      throw new PayloadTooLargeError(
        `Dữ liệu khóa quá lớn (${(bytes / 1024 / 1024).toFixed(1)} MB, giới hạn ${(this.payloadLimitBytes / 1024 / 1024).toFixed(0)} MB).`
      );
    }

    const usage = this.getUsage();
    if (usage.usedBytes + bytes > this.maxDataBytes) {
      throw new QuotaExceededError(
        `Không đủ dung lượng: đã dùng ${(usage.usedBytes / 1024 ** 3).toFixed(2)} GB / ${(this.maxDataBytes / 1024 ** 3).toFixed(2)} GB.`
      );
    }

    const existing = this.db.prepare(
      'SELECT revision FROM courses WHERE sync_id = ? AND course_id = ?'
    ).get(safeSyncId, safeCourseId);
    const revision = existing ? Number(existing.revision) + 1 : 1;
    const now = new Date().toISOString();

    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare(`
        INSERT INTO courses (sync_id, course_id, payload, updated_at, revision, updated_by)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(sync_id, course_id) DO UPDATE SET
          payload = excluded.payload,
          updated_at = excluded.updated_at,
          revision = excluded.revision,
          updated_by = excluded.updated_by
      `).run(safeSyncId, safeCourseId, json, now, revision, String(updatedBy || '').slice(0, 80));
      this.db.exec('COMMIT');
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch { /* ignore */ }
      throw error;
    }

    try { this.db.exec('PRAGMA wal_checkpoint(PASSIVE)'); } catch { /* ignore */ }

    return {
      updatedAt: now,
      revision,
      sizeBytes: bytes,
      clientId: String(clientId || '').slice(0, 80),
      usage: this.getUsage()
    };
  }

  listCourses(syncId) {
    const safeSyncId = normalizeSegment(syncId, 'Mã nhóm');
    const rows = this.db.prepare(
      'SELECT course_id, payload, updated_at, revision, updated_by FROM courses WHERE sync_id = ? ORDER BY updated_at DESC'
    ).all(safeSyncId);
    return rows.map(row => {
      let courseName = '';
      try {
        courseName = String(JSON.parse(row.payload)?.meta?.courseName || '');
      } catch { /* ignore */ }
      return {
        courseId: row.course_id,
        courseName,
        updatedAt: row.updated_at,
        revision: Number(row.revision) || 1,
        updatedBy: row.updated_by || '',
        sizeBytes: Buffer.byteLength(row.payload)
      };
    });
  }

  exportAll() {
    const rows = this.db.prepare(
      'SELECT sync_id, course_id, payload, updated_at, revision, updated_by FROM courses ORDER BY sync_id, course_id'
    ).all();
    return rows.map(row => {
      let payload = null;
      try { payload = JSON.parse(row.payload); } catch { /* ignore */ }
      return {
        syncId: row.sync_id,
        courseId: row.course_id,
        updatedAt: row.updated_at,
        revision: Number(row.revision) || 1,
        updatedBy: row.updated_by || '',
        payload
      };
    });
  }

  backupNow() {
    ensureDir(this.backupsDir);
    const stamp = timestampForFile();
    let file = path.join(this.backupsDir, `backup-${stamp}.sqlite`);
    if (fs.existsSync(file)) file = path.join(this.backupsDir, `backup-${stamp}-${Date.now()}.sqlite`);
    const sqlPath = file.replace(/'/g, "''");
    this.db.exec(`VACUUM INTO '${sqlPath}'`);
    const stat = fs.statSync(file);
    this.pruneBackups();
    return {
      file: path.basename(file),
      sizeBytes: stat.size,
      createdAt: new Date(stat.mtimeMs).toISOString()
    };
  }

  listBackups() {
    let entries;
    try {
      entries = fs.readdirSync(this.backupsDir, { withFileTypes: true });
    } catch {
      return [];
    }
    return entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.sqlite'))
      .map(entry => {
        const full = path.join(this.backupsDir, entry.name);
        const stat = fs.statSync(full);
        return {
          file: entry.name,
          sizeBytes: stat.size,
          createdAt: new Date(stat.mtimeMs).toISOString(),
          mtimeMs: stat.mtimeMs
        };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .map(({ mtimeMs, ...rest }) => rest);
  }

  pruneBackups() {
    let backups = this.listBackups()
      .map(item => ({ ...item, full: path.join(this.backupsDir, item.file) }))
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

    while (backups.length > this.backupKeep) {
      const oldest = backups.shift();
      try { fs.unlinkSync(oldest.full); } catch { /* ignore */ }
    }

    // Nếu tổng dung lượng vượt hạn mức, xóa bớt backup cũ nhất.
    while (backups.length && dirSize(this.dataDir) > this.maxDataBytes) {
      const oldest = backups.shift();
      try { fs.unlinkSync(oldest.full); } catch { /* ignore */ }
    }
  }

  close() {
    if (this.db) {
      try { this.db.close(); } catch { /* ignore */ }
      this.db = null;
    }
  }
}
