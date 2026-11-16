import { DEFAULT_META, PLATOONS_PRESET } from '../constants';
import {
  APP_ID,
  APP_VERSION,
  type CourseRecord,
  type CourseSummary,
  getCurrentCourseId,
  loadCourseRecord,
  makeDefaultRecord,
  newCourseId,
  readCourseIndex,
  saveCourseIndex,
  saveCourseRecord,
  setCurrentCourseId,
  summarizeRecord
} from '../courseStore';
import {
  normalizeStudents,
  normalizeStudentTombstones,
  sortStudents,
  type Student
} from '../students';
import { clampInt, normalizeQuanSo, round1, slugify, toNumber } from '../utils';
import { daiDoiFromTrungDoi, effectiveDaiDoi } from './units';

export interface PlatoonItem {
  id: number;
  building: string;
  rooms: string;
  daiDoi?: string;
  quanSo: string;
  hocTap: number;
  renLuyen: number;
  nvvs: number;
  leTiet: number;
  note: string;
  totalScore: number;
  rank: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ParsedPlatoonConfig {
  items: Array<Pick<PlatoonItem, 'id' | 'building' | 'rooms' | 'daiDoi' | 'quanSo'>>;
  errors: string[];
}

export const SCORE_FIELDS = ['hocTap', 'renLuyen', 'nvvs', 'leTiet'] as const;
export type ScoreField = typeof SCORE_FIELDS[number];

export const SCORE_LABELS: Record<ScoreField, string> = {
  hocTap: 'Học tập',
  renLuyen: 'Rèn luyện',
  nvvs: 'NVVS',
  leTiet: 'Lễ tiết'
};

export const SCORE_SHORT_LABELS: Record<ScoreField, string> = {
  hocTap: 'HT',
  renLuyen: 'RL',
  nvvs: 'NVVS',
  leTiet: 'LT'
};

function pageStorageName(): string {
  if (typeof window === 'undefined') return '337';
  const parts = window.location.pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1] || 'index';
  const fileName = last.replace(/\.html?$/i, '');
  const pageName = fileName.toLowerCase() === 'index' && parts.length > 1
    ? parts[parts.length - 2]
    : fileName;
  return slugify(pageName).slice(0, 60);
}

const STORAGE_PAGE = pageStorageName();
const IS_ORIGINAL_PAGE = /^337$/i.test(STORAGE_PAGE);
const STORAGE_KEY = `THI_DUA_GDQPAN_V2:${STORAGE_PAGE}`;
const PREVIOUS_STORAGE_KEY = 'THI_DUA_GDQPAN_V2';
const LEGACY_STORAGE_KEY = 'THI_DUA_K337_DATA';
const LEGACY_PAGE_STORAGE_KEYS = ['THI_DUA_GDQPAN_V2:index'];

export function createDefaultItems(): PlatoonItem[] {
  return PLATOONS_PRESET.map(preset => ({
    id: preset.id,
    building: preset.building,
    rooms: preset.rooms,
    daiDoi: daiDoiFromTrungDoi(preset.id),
    quanSo: preset.defaultQuanSo,
    hocTap: 0,
    renLuyen: 0,
    nvvs: 0,
    leTiet: 0,
    note: '',
    totalScore: DEFAULT_META.baseScore,
    rank: 1
  }));
}

export function normalizeItem(raw: any, preset: any = null): PlatoonItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = Number(raw.id);
  if (!Number.isInteger(id) || id <= 0) return null;

  const building = String(raw.building !== undefined ? raw.building : (preset ? preset.building : '')).trim();
  const rooms = String(raw.rooms !== undefined ? raw.rooms : (preset ? preset.rooms : '')).trim();
  const quanSoRaw = String(raw.quanSo !== undefined ? raw.quanSo : (preset ? preset.defaultQuanSo : '')).trim();
  const normalizedQuanSo = normalizeQuanSo(quanSoRaw);
  const daiDoiRaw = String(raw.daiDoi !== undefined && raw.daiDoi !== null ? raw.daiDoi : (raw.dai_doi || '')).trim();

  return {
    id,
    building,
    rooms,
    daiDoi: effectiveDaiDoi(daiDoiRaw, id),
    quanSo: normalizedQuanSo === null ? '' : normalizedQuanSo,
    hocTap: round1(toNumber(raw.hocTap)),
    renLuyen: round1(toNumber(raw.renLuyen)),
    nvvs: round1(toNumber(raw.nvvs)),
    leTiet: round1(toNumber(raw.leTiet)),
    note: String(raw.note !== undefined && raw.note !== null ? raw.note : '').trim(),
    totalScore: round1(toNumber(raw.totalScore)),
    rank: Math.max(1, Number(raw.rank) || 1),
    updatedAt: String(raw.updatedAt || ''),
    updatedBy: String(raw.updatedBy || '')
  };
}

export function normalizeItems(rawItems: any[]): PlatoonItem[] {
  const items: PlatoonItem[] = [];
  const seenIds = new Set<number>();

  (Array.isArray(rawItems) ? rawItems : []).forEach(raw => {
    const item = normalizeItem(raw);
    if (item && !seenIds.has(item.id)) {
      seenIds.add(item.id);
      items.push(item);
    }
  });

  return items.sort((a, b) => a.id - b.id);
}

export function normalizeRecord(record: CourseRecord): CourseRecord {
  const now = new Date().toISOString();
  const meta = record && record.meta && typeof record.meta === 'object' ? record.meta : ({} as any);
  const baseScore = Number(meta.baseScore);
  const items = normalizeItems(record && record.items);
  const students = sortStudents(normalizeStudents(record && record.students));

  return {
    app: APP_ID,
    version: APP_VERSION,
    savedAt: record && record.savedAt ? record.savedAt : now,
    meta: {
      ...meta,
      id: String(meta.id || newCourseId()),
      courseName: String(meta.courseName || DEFAULT_META.courseName).trim() || DEFAULT_META.courseName,
      unitName: String(meta.unitName || DEFAULT_META.unitName).trim() || DEFAULT_META.unitName,
      baseScore: Number.isFinite(baseScore) && baseScore > 0 ? round1(baseScore) : DEFAULT_META.baseScore,
      ngay: clampInt(meta.ngay, 1, 31, DEFAULT_META.ngay),
      thang: clampInt(meta.thang, 1, 12, DEFAULT_META.thang),
      nam: clampInt(meta.nam, 2000, 2100, DEFAULT_META.nam),
      autoNegative: typeof meta.autoNegative === 'boolean' ? meta.autoNegative : true,
      viewMode: meta.viewMode === 'table' ? 'table' : 'cards',
      activeBuilding: typeof meta.activeBuilding === 'string' && meta.activeBuilding ? meta.activeBuilding : 'ALL',
      locked: Boolean(meta.locked),
      lockedAt: String(meta.lockedAt || ''),
      lockedBy: String(meta.lockedBy || ''),
      graderName: String(meta.graderName || 'Giảng viên').trim() || 'Giảng viên',
      createdAt: String(meta.createdAt || record.savedAt || now),
      updatedAt: String(meta.updatedAt || record.savedAt || now),
      settingsUpdatedAt: String(meta.settingsUpdatedAt || meta.updatedAt || record.savedAt || now),
      itemsUpdatedAt: String(meta.itemsUpdatedAt || meta.updatedAt || record.savedAt || now),
      studentsUpdatedAt: String(meta.studentsUpdatedAt || meta.updatedAt || record.savedAt || now),
      studentTombstones: normalizeStudentTombstones(meta.studentTombstones),
      revision: Math.max(1, Number(meta.revision) || 1)
    },
    items: items.length ? items : createDefaultItems(),
    students,
    audit: Array.isArray(record.audit) ? record.audit.slice(-1000) : []
  };
}

function findLegacyPayload(): { payload: any; key: string } | null {
  const keys = [
    STORAGE_KEY,
    ...(IS_ORIGINAL_PAGE ? [PREVIOUS_STORAGE_KEY, LEGACY_STORAGE_KEY] : []),
    ...LEGACY_PAGE_STORAGE_KEYS
  ];

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const candidate = JSON.parse(raw);
      const hasItems = Array.isArray(candidate)
        ? candidate.length > 0
        : Boolean(candidate && Array.isArray(candidate.items) && candidate.items.length);
      if (hasItems) return { payload: candidate, key };
    } catch (error) {
      console.warn(`Không đọc được dữ liệu cũ (${key}):`, error);
    }
  }

  return null;
}

export function createRecordFromLegacy(payload: any): CourseRecord {
  const meta = (!Array.isArray(payload) && payload && payload.meta && typeof payload.meta === 'object')
    ? payload.meta
    : {};
  const rawItems = Array.isArray(payload) ? payload : (payload && payload.items);
  const items = normalizeItems(rawItems);
  const now = new Date().toISOString();
  const baseScore = Number(meta.baseScore);

  return normalizeRecord({
    app: APP_ID,
    version: APP_VERSION,
    savedAt: now,
    meta: {
      id: newCourseId(),
      courseName: String(meta.courseName || DEFAULT_META.courseName).trim() || DEFAULT_META.courseName,
      unitName: String(meta.unitName || DEFAULT_META.unitName).trim() || DEFAULT_META.unitName,
      baseScore: Number.isFinite(baseScore) && baseScore > 0 ? round1(baseScore) : DEFAULT_META.baseScore,
      ngay: clampInt(meta.ngay, 1, 31, DEFAULT_META.ngay),
      thang: clampInt(meta.thang, 1, 12, DEFAULT_META.thang),
      nam: clampInt(meta.nam, 2000, 2100, DEFAULT_META.nam),
      autoNegative: typeof meta.autoNegative === 'boolean' ? meta.autoNegative : true,
      viewMode: meta.viewMode === 'table' ? 'table' : 'cards',
      activeBuilding: typeof meta.activeBuilding === 'string' && meta.activeBuilding ? meta.activeBuilding : 'ALL',
      locked: false,
      lockedAt: '',
      lockedBy: '',
      graderName: 'Giảng viên',
      createdAt: now,
      updatedAt: now,
      settingsUpdatedAt: now,
      itemsUpdatedAt: now,
      studentsUpdatedAt: now,
      studentTombstones: {},
      revision: 1
    },
    items: items.length ? items : createDefaultItems(),
    students: normalizeStudents(payload && payload.students),
    audit: []
  });
}

export function loadInitialRecord(): { record: CourseRecord; courses: CourseSummary[] } {
  const index = readCourseIndex();

  if (index.length) {
    const currentId = getCurrentCourseId();
    const target = index.find(course => course.id === currentId) || index[0];
    const record = loadCourseRecord(target.id);
    if (record) {
      const normalized = normalizeRecord(record);
      setCurrentCourseId(normalized.meta.id);
      return { record: normalized, courses: index };
    }

    const valid = index.filter(course => Boolean(loadCourseRecord(course.id)));
    if (valid.length) {
      saveCourseIndex(valid);
      const first = loadCourseRecord(valid[0].id);
      if (first) {
        const normalized = normalizeRecord(first);
        setCurrentCourseId(normalized.meta.id);
        return { record: normalized, courses: valid };
      }
    }
  }

  const legacy = findLegacyPayload();
  const record = legacy ? createRecordFromLegacy(legacy.payload) : makeDefaultRecord();
  const normalized = normalizeRecord(record);
  saveCourseRecord(normalized);
  const courses = [summarizeRecord(normalized)];
  saveCourseIndex(courses);
  setCurrentCourseId(normalized.meta.id);
  return { record: normalized, courses };
}

export function parsePlatoonConfig(text: string): ParsedPlatoonConfig {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
  const items: ParsedPlatoonConfig['items'] = [];
  const errors: string[] = [];
  const seenIds = new Set<number>();

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const parts = trimmed.split(/\s*[|;\t]\s*/).map(part => part.trim());
    if (parts.length < 3) {
      errors.push(`Dòng ${index + 1}: cần ít nhất 3 cột (Số b | Tòa | Phòng).`);
      return;
    }

    const id = Number(parts[0]);
    if (!Number.isInteger(id) || id <= 0) {
      errors.push(`Dòng ${index + 1}: số b (trung đội) không hợp lệ.`);
      return;
    }
    if (seenIds.has(id)) {
      errors.push(`Dòng ${index + 1}: trùng số b ${id}.`);
      return;
    }

    const building = parts[1];
    const rooms = parts[2];
    if (!building) {
      errors.push(`Dòng ${index + 1}: chưa nhập tòa.`);
      return;
    }
    if (!rooms) {
      errors.push(`Dòng ${index + 1}: chưa nhập phòng.`);
      return;
    }

    let quanSo = '';
    if (parts[3]) {
      const normalized = normalizeQuanSo(parts[3]);
      if (normalized === null) {
        errors.push(`Dòng ${index + 1}: quân số "${parts[3]}" không hợp lệ (đúng dạng 30/31).`);
        return;
      }
      quanSo = normalized;
    }

    seenIds.add(id);
    items.push({
      id,
      building,
      rooms,
      daiDoi: parts[4] ? parts[4] : daiDoiFromTrungDoi(id),
      quanSo
    });
  });

  if (!items.length && !errors.length) errors.push('Danh sách trung đội đang trống.');
  items.sort((a, b) => a.id - b.id);
  return { items, errors };
}

export function platoonsToText(items: Array<Partial<PlatoonItem>>): string {
  return [...items]
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map(item => {
      const daiDoi = effectiveDaiDoi(item.daiDoi, item.id);
      return `${item.id} | ${item.building || ''} | ${item.rooms || ''} | ${item.quanSo || ''}${daiDoi ? ` | ${daiDoi}` : ''}`;
    })
    .join('\n');
}

export function presetPlatoonsText(): string {
  return PLATOONS_PRESET
    .map(item => `${item.id} | ${item.building} | ${item.rooms} | ${item.defaultQuanSo} | ${daiDoiFromTrungDoi(item.id)}`)
    .join('\n');
}

export function isRecordPristine(record: CourseRecord): boolean {
  const items = Array.isArray(record.items) ? record.items : [];
  const hasScores = items.some(item =>
    Number(item.hocTap) !== 0
    || Number(item.renLuyen) !== 0
    || Number(item.nvvs) !== 0
    || Number(item.leTiet) !== 0
    || Boolean(item.note)
  );
  return !hasScores
    && !(Array.isArray(record.students) && record.students.length)
    && !(Array.isArray(record.audit) && record.audit.length);
}

export function reconcileStudentTombstones(previous: Student[], next: Student[], at: string): Record<string, string> {
  const tombstones: Record<string, string> = {};
  const nextIds = new Set((next || []).map(student => student.id));
  (previous || []).forEach(student => {
    if (!nextIds.has(student.id)) tombstones[student.id] = at;
  });
  (next || []).forEach(student => {
    delete tombstones[student.id];
  });
  return tombstones;
}

export function formatCourseDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export function dateToken(record: CourseRecord): string {
  const { ngay, thang, nam } = record.meta;
  return `${nam}-${String(thang).padStart(2, '0')}-${String(ngay).padStart(2, '0')}`;
}

export function isScoreField(value: string): value is ScoreField {
  return (SCORE_FIELDS as readonly string[]).includes(value);
}
