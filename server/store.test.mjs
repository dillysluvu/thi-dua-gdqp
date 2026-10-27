import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PayloadTooLargeError, QuotaExceededError, Store } from './store.mjs';

function makePayload(courseId, note = '') {
  return {
    app: 'THI_DUA_GDQPAN',
    version: 3,
    savedAt: new Date().toISOString(),
    meta: { id: courseId, courseName: 'K337', revision: 1 },
    items: [{ id: 1, hocTap: 0, note }],
    students: [],
    audit: []
  };
}

function withStore(options, fn) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thi-dua-store-'));
  const store = new Store({ dataDir, ...options }).init();
  try {
    return fn(store, dataDir);
  } finally {
    store.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

test('lưu, đọc và tăng revision', () => {
  withStore({ maxDataBytes: 10 * 1024 ** 2 }, store => {
    const first = store.putCourse('gdqpan', 'gdqpan', makePayload('gdqpan'), { updatedBy: 'An' });
    assert.equal(first.revision, 1);
    const second = store.putCourse('gdqpan', 'gdqpan', makePayload('gdqpan', 'đã sửa'), { updatedBy: 'Bình' });
    assert.equal(second.revision, 2);

    const course = store.getCourse('gdqpan', 'gdqpan');
    assert.equal(course.revision, 2);
    assert.equal(course.updatedBy, 'Bình');
    assert.equal(course.payload.items[0].note, 'đã sửa');
    assert.equal(store.listCourses('gdqpan').length, 1);
    assert.equal(store.exportAll().length, 1);
  });
});

test('từ chối payload sai mã khóa', () => {
  withStore({ maxDataBytes: 10 * 1024 ** 2 }, store => {
    assert.throws(
      () => store.putCourse('gdqpan', 'gdqpan', makePayload('khac')),
      /không khớp/
    );
  });
});

test('giới hạn payload và dung lượng', () => {
  withStore({ maxDataBytes: 1.5 * 1024 ** 2, payloadLimitBytes: 1024 ** 2 }, store => {
    assert.throws(
      () => store.putCourse('gdqpan', 'gdqpan', makePayload('gdqpan', 'x'.repeat(1.2 * 1024 ** 2))),
      PayloadTooLargeError
    );

    store.putCourse('gdqpan', 'gdqpan', makePayload('gdqpan', 'x'.repeat(800 * 1024)));
    assert.throws(
      () => store.putCourse('gdqpan', 'gdqpan', makePayload('gdqpan', 'y'.repeat(800 * 1024))),
      QuotaExceededError
    );
  });
});

test('tạo backup và giữ số lượng giới hạn', () => {
  withStore({ maxDataBytes: 10 * 1024 ** 2, backupKeep: 2 }, store => {
    store.putCourse('gdqpan', 'gdqpan', makePayload('gdqpan'));
    store.backupNow();
    store.backupNow();
    store.backupNow();
    const backups = store.listBackups();
    assert.equal(backups.length, 2);
    assert.ok(backups.every(item => item.file.endsWith('.sqlite')));
  });
});
