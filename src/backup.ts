import {
  type CourseRecord,
  readJson,
  writeJson,
  snapshotKey
} from './courseStore';

export interface CourseSnapshot {
  id: string;
  createdAt: string;
  reason: string;
  record: CourseRecord;
  signature?: string;
}

export const MAX_SNAPSHOTS = 15;
const AUTO_SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;
const LAST_AUTO_PREFIX = 'THI_DUA_GDQPAN_V3:lastAuto:';

function makeSnapshotId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function listSnapshots(courseId: string): CourseSnapshot[] {
  if (!courseId) return [];
  const list = readJson<CourseSnapshot[]>(snapshotKey(courseId), []);
  return Array.isArray(list)
    ? list.filter(snapshot => snapshot && snapshot.id && snapshot.record && snapshot.record.meta)
    : [];
}

function saveSnapshots(courseId: string, list: CourseSnapshot[]): boolean {
  return writeJson(snapshotKey(courseId), list);
}

function snapshotSignature(record: CourseRecord): string {
  return JSON.stringify({
    courseName: record.meta.courseName,
    unitName: record.meta.unitName,
    baseScore: record.meta.baseScore,
    ngay: record.meta.ngay,
    thang: record.meta.thang,
    nam: record.meta.nam,
    autoNegative: record.meta.autoNegative,
    activeBuilding: record.meta.activeBuilding,
    locked: record.meta.locked,
    items: (record.items || []).map(item => [
      item.id,
      item.building,
      item.rooms,
      item.quanSo,
      item.hocTap,
      item.renLuyen,
      item.nvvs,
      item.leTiet,
      item.note
    ])
  });
}

export function createSnapshot(
  record: CourseRecord,
  reason: string,
  force = false
): CourseSnapshot | null {
  if (!record || !record.meta || !record.meta.id) return null;

  const list = listSnapshots(record.meta.id);
  const signature = snapshotSignature(record);

  if (!force && list.length && list[0].signature === signature) {
    return null;
  }

  const snapshot: CourseSnapshot = {
    id: makeSnapshotId(),
    createdAt: new Date().toISOString(),
    reason: String(reason || 'Sao lưu').trim() || 'Sao lưu',
    record: JSON.parse(JSON.stringify(record)),
    signature
  };

  const next = [snapshot, ...list].slice(0, MAX_SNAPSHOTS);
  if (!saveSnapshots(record.meta.id, next)) return null;
  return snapshot;
}

function readLastAuto(courseId: string): number {
  try {
    const raw = localStorage.getItem(LAST_AUTO_PREFIX + courseId);
    const value = Number(raw);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function writeLastAuto(courseId: string, timestamp: number): void {
  try {
    localStorage.setItem(LAST_AUTO_PREFIX + courseId, String(timestamp));
  } catch {
    // Không lưu được mốc thời gian cũng không ảnh hưởng dữ liệu chính.
  }
}

export function maybeAutoSnapshot(record: CourseRecord): CourseSnapshot | null {
  if (!record || !record.meta || !record.meta.id) return null;

  const list = listSnapshots(record.meta.id);
  if (!list.length) {
    const first = createSnapshot(record, 'Bản sao lưu đầu tiên', true);
    if (first) writeLastAuto(record.meta.id, Date.now());
    return first;
  }

  if (list[0].signature === snapshotSignature(record)) return null;

  const now = Date.now();
  if (now - readLastAuto(record.meta.id) < AUTO_SNAPSHOT_INTERVAL_MS) return null;

  const snapshot = createSnapshot(record, 'Tự động sao lưu');
  if (snapshot) writeLastAuto(record.meta.id, now);
  return snapshot;
}

export function getSnapshot(courseId: string, snapshotId: string): CourseSnapshot | null {
  return listSnapshots(courseId).find(snapshot => snapshot.id === snapshotId) || null;
}

export function deleteSnapshot(courseId: string, snapshotId: string): boolean {
  const list = listSnapshots(courseId);
  const next = list.filter(snapshot => snapshot.id !== snapshotId);
  if (next.length === list.length) return false;
  return saveSnapshots(courseId, next);
}
