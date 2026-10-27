import type { CourseRecord } from './courseStore';
import { normalizeStudents, normalizeStudentTombstones, sortStudents } from './students';

export interface MergeResult {
  record: CourseRecord;
  changed: boolean;
  localNewer: boolean;
  remoteNewer: boolean;
}

interface EntityMergeResult {
  list: any[];
  localWins: boolean;
  remoteWins: boolean;
}

function time(value: unknown): number {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function recordTime(record: CourseRecord): number {
  return time(record && record.savedAt) || time(record && record.meta && record.meta.updatedAt);
}

function isoMax(...values: Array<string | undefined>): string {
  let best = '';
  let bestTime = 0;
  values.forEach(value => {
    const current = time(value);
    if (current > bestTime) {
      bestTime = current;
      best = String(value);
    }
  });
  return best;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function entityTime(entity: any, fallback: number): number {
  return time(entity && entity.updatedAt) || fallback;
}

function mergeEntityList(
  localList: any[],
  remoteList: any[],
  localListAt: string | undefined,
  remoteListAt: string | undefined,
  localFallback: number,
  remoteFallback: number,
  remoteRecordNewer: boolean,
  sort?: (list: any[]) => any[],
  forceUnion = false
): EntityMergeResult {
  const local = Array.isArray(localList) ? localList : [];
  const remote = Array.isArray(remoteList) ? remoteList : [];
  const localMap = new Map<string, any>();
  const remoteMap = new Map<string, any>();
  local.forEach(entity => localMap.set(String(entity.id), entity));
  remote.forEach(entity => remoteMap.set(String(entity.id), entity));

  const localListTime = time(localListAt) || localFallback;
  const remoteListTime = time(remoteListAt) || remoteFallback;
  let membership: 'local' | 'remote' | 'union' = 'union';
  let ids: string[];

  if (forceUnion) {
    membership = 'union';
    ids = Array.from(new Set([...localMap.keys(), ...remoteMap.keys()]));
  } else if (remoteListTime > localListTime) {
    membership = 'remote';
    ids = Array.from(remoteMap.keys());
  } else if (localListTime > remoteListTime) {
    membership = 'local';
    ids = Array.from(localMap.keys());
  } else {
    ids = Array.from(new Set([...localMap.keys(), ...remoteMap.keys()]));
  }

  const result: any[] = [];
  let localWins = false;
  let remoteWins = false;

  ids.forEach(id => {
    const localEntity = localMap.get(id);
    const remoteEntity = remoteMap.get(id);

    if (!localEntity && remoteEntity) {
      if (membership !== 'local') {
        result.push(remoteEntity);
        remoteWins = true;
      } else {
        localWins = true;
      }
      return;
    }

    if (localEntity && !remoteEntity) {
      if (membership !== 'remote') {
        result.push(localEntity);
        localWins = true;
      } else {
        remoteWins = true;
      }
      return;
    }

    if (!localEntity || !remoteEntity) return;

    const localExplicit = time(localEntity && localEntity.updatedAt);
    const remoteExplicit = time(remoteEntity && remoteEntity.updatedAt);
    let chosen = localEntity;

    if (localExplicit && remoteExplicit) {
      if (remoteExplicit > localExplicit || (remoteExplicit === localExplicit && remoteRecordNewer)) {
        chosen = remoteEntity;
      }
    } else if (remoteExplicit && !localExplicit) {
      chosen = remoteEntity;
    } else if (!remoteExplicit && !localExplicit && remoteRecordNewer) {
      chosen = remoteEntity;
    }

    if (chosen === remoteEntity && !same(localEntity, remoteEntity)) remoteWins = true;
    if (chosen === localEntity && !same(localEntity, remoteEntity)) localWins = true;
    result.push(chosen);
  });

  return {
    list: sort ? sort(result) : result,
    localWins,
    remoteWins
  };
}

export function mergeCourseRecords(local: CourseRecord, remote: CourseRecord, options: { initial?: boolean } = {}): MergeResult {
  const localRecordTime = recordTime(local);
  const remoteRecordTime = recordTime(remote);
  const remoteRecordNewer = remoteRecordTime > localRecordTime;

  const localSettingsAt = time(local.meta.settingsUpdatedAt) || localRecordTime;
  const remoteSettingsAt = time(remote.meta.settingsUpdatedAt) || remoteRecordTime;
  const useRemoteSettings = remoteSettingsAt > localSettingsAt
    || (remoteSettingsAt === localSettingsAt && remoteRecordNewer);
  const settingsSource = useRemoteSettings ? remote.meta : local.meta;

  const settingsFields = [
    'courseName', 'unitName', 'baseScore', 'ngay', 'thang', 'nam',
    'autoNegative', 'locked', 'lockedAt', 'lockedBy'
  ];
  const meta: any = { ...local.meta };
  settingsFields.forEach(field => {
    if (settingsSource[field] !== undefined) meta[field] = settingsSource[field];
  });
  meta.id = local.meta.id;
  meta.createdAt = local.meta.createdAt || remote.meta.createdAt;
  meta.viewMode = local.meta.viewMode;
  meta.activeBuilding = local.meta.activeBuilding;
  meta.savedAt = isoMax(local.savedAt, remote.savedAt, local.meta.updatedAt, remote.meta.updatedAt);
  meta.updatedAt = isoMax(local.meta.updatedAt, remote.meta.updatedAt, local.savedAt, remote.savedAt);
  meta.settingsUpdatedAt = isoMax(local.meta.settingsUpdatedAt, remote.meta.settingsUpdatedAt);
  meta.itemsUpdatedAt = isoMax(local.meta.itemsUpdatedAt, remote.meta.itemsUpdatedAt);
  meta.studentsUpdatedAt = isoMax(local.meta.studentsUpdatedAt, remote.meta.studentsUpdatedAt);
  meta.revision = Math.max(Number(local.meta.revision) || 1, Number(remote.meta.revision) || 1);

  const items = mergeEntityList(
    local.items,
    remote.items,
    local.meta.itemsUpdatedAt,
    remote.meta.itemsUpdatedAt,
    localRecordTime,
    remoteRecordTime,
    remoteRecordNewer,
    list => list.slice().sort((a, b) => Number(a.id) - Number(b.id)),
    Boolean(options.initial)
  );

  const students = mergeEntityList(
    normalizeStudents(local.students),
    normalizeStudents(remote.students),
    local.meta.studentsUpdatedAt,
    remote.meta.studentsUpdatedAt,
    localRecordTime,
    remoteRecordTime,
    remoteRecordNewer,
    list => sortStudents(list),
    true
  );

  // Danh sách sinh viên dùng tombstone cho thao tác xóa để không làm mất
  // sinh viên do người khác thêm trong cùng lúc.
  const localTombstones = normalizeStudentTombstones(local.meta.studentTombstones);
  const remoteTombstones = normalizeStudentTombstones(remote.meta.studentTombstones);
  const studentById = new Map<string, any>();
  [...normalizeStudents(local.students), ...normalizeStudents(remote.students)].forEach(student => {
    const existing = studentById.get(student.id);
    if (!existing || time(student.updatedAt) > time(existing.updatedAt)) {
      studentById.set(student.id, student);
    }
  });

  const effectiveTombstones = new Map<string, string>();
  let localTombstoneNewer = false;
  let remoteTombstoneNewer = false;
  const tombstoneIds = new Set([...Object.keys(localTombstones), ...Object.keys(remoteTombstones)]);
  tombstoneIds.forEach(id => {
    const localAt = localTombstones[id] || '';
    const remoteAt = remoteTombstones[id] || '';
    const at = isoMax(localAt, remoteAt);
    if (!at) return;
    const student = studentById.get(id);
    if (student && time(student.updatedAt) > time(at)) return;
    effectiveTombstones.set(id, at);
    if (localAt && time(localAt) > time(remoteAt)) localTombstoneNewer = true;
    else if (remoteAt && time(remoteAt) > time(localAt)) remoteTombstoneNewer = true;
  });

  const mergedStudents = students.list.filter(student => !effectiveTombstones.has(String(student.id)));
  const studentTombstones = Object.fromEntries(effectiveTombstones);
  meta.studentTombstones = studentTombstones;

  const auditMap = new Map<string, any>();
  [...(local.audit || []), ...(remote.audit || [])].forEach(entry => {
    if (!entry) return;
    const key = String(entry.id || `${entry.at}|${entry.action}|${entry.detail}|${entry.actor}`);
    if (!auditMap.has(key)) auditMap.set(key, entry);
  });
  const audit = Array.from(auditMap.values())
    .sort((a, b) => time(a.at) - time(b.at))
    .slice(-1000);

  const merged: CourseRecord = {
    ...local,
    app: local.app || remote.app,
    version: Math.max(Number(local.version) || 0, Number(remote.version) || 0),
    savedAt: isoMax(local.savedAt, remote.savedAt),
    meta,
    items: items.list,
    students: mergedStudents,
    audit
  };

  const settingsDiffer = !same(
    settingsFields.reduce((acc, field) => ({ ...acc, [field]: local.meta[field] }), {}),
    settingsFields.reduce((acc, field) => ({ ...acc, [field]: remote.meta[field] }), {})
  );
  const settingsChanged = useRemoteSettings && settingsDiffer;
  const localSettingsChanged = !useRemoteSettings && settingsDiffer;
  const localNewer = items.localWins || students.localWins || localSettingsChanged || localTombstoneNewer;
  const remoteNewer = items.remoteWins || students.remoteWins || settingsChanged || remoteTombstoneNewer;

  return {
    record: merged,
    changed: !same(merged, local),
    localNewer,
    remoteNewer
  };
}
