import { DEFAULT_META, PLATOONS_PRESET } from './constants';
import { normalizeStudents, type Student } from './students';

export interface CourseMeta {
  id: string;
  courseName: string;
  unitName: string;
  baseScore: number;
  ngay: number;
  thang: number;
  nam: number;
  autoNegative: boolean;
  viewMode: 'cards' | 'table';
  activeBuilding: string;
  locked: boolean;
  lockedAt: string;
  lockedBy: string;
  graderName: string;
  createdAt: string;
  updatedAt: string;
  settingsUpdatedAt?: string;
  itemsUpdatedAt?: string;
  studentsUpdatedAt?: string;
  studentTombstones?: Record<string, string>;
  revision?: number;
}

export interface CourseRecord {
  app: string;
  version: number;
  savedAt: string;
  meta: CourseMeta;
  items: any[];
  students?: Student[];
  audit: any[];
}

export interface CourseSummary {
  id: string;
  courseName: string;
  unitName: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  locked: boolean;
}

export const APP_ID = 'THI_DUA_GDQPAN';
export const APP_VERSION = 3;
export const COURSE_INDEX_KEY = 'THI_DUA_GDQPAN_V3:courses';
export const CURRENT_COURSE_KEY = 'THI_DUA_GDQPAN_V3:current';
export const COURSE_KEY_PREFIX = 'THI_DUA_GDQPAN_V3:course:';
export const SNAPSHOT_KEY_PREFIX = 'THI_DUA_GDQPAN_V3:snapshots:';
export const MAPPING_KEY = 'THI_DUA_GDQPAN_V3:mappings';
export const SETTINGS_KEY = 'THI_DUA_GDQPAN_V3:settings';

export function courseKey(id: string): string {
  return `${COURSE_KEY_PREFIX}${id}`;
}

export function snapshotKey(id: string): string {
  return `${SNAPSHOT_KEY_PREFIX}${id}`;
}

export function newCourseId(): string {
  const random = Math.random().toString(36).slice(2, 7);
  return `c_${Date.now().toString(36)}_${random}`;
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Không đọc được dữ liệu (${key}):`, error);
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Không ghi được dữ liệu (${key}):`, error);
    return false;
  }
}

export function readCourseIndex(): CourseSummary[] {
  const list = readJson<CourseSummary[]>(COURSE_INDEX_KEY, []);
  return Array.isArray(list) ? list.filter(item => item && item.id) : [];
}

export function saveCourseIndex(list: CourseSummary[]): boolean {
  return writeJson(COURSE_INDEX_KEY, list);
}

export function loadCourseRecord(id: string): CourseRecord | null {
  if (!id) return null;
  const record = readJson<CourseRecord | null>(courseKey(id), null);
  if (!record || !record.meta || !Array.isArray(record.items)) return null;
  return record;
}

export function saveCourseRecord(record: CourseRecord): boolean {
  return writeJson(courseKey(record.meta.id), record);
}

export function deleteCourseRecord(id: string): void {
  try {
    localStorage.removeItem(courseKey(id));
    localStorage.removeItem(snapshotKey(id));
  } catch (error) {
    console.warn('Không xóa được dữ liệu khóa:', error);
  }
}

export function getCurrentCourseId(): string {
  try {
    return localStorage.getItem(CURRENT_COURSE_KEY) || '';
  } catch {
    return '';
  }
}

export function setCurrentCourseId(id: string): void {
  try {
    localStorage.setItem(CURRENT_COURSE_KEY, id);
  } catch (error) {
    console.warn('Không lưu được khóa hiện tại:', error);
  }
}

export function summarizeRecord(record: CourseRecord): CourseSummary {
  return {
    id: record.meta.id,
    courseName: record.meta.courseName || 'Khóa chưa đặt tên',
    unitName: record.meta.unitName || '',
    itemCount: Array.isArray(record.items) ? record.items.length : 0,
    createdAt: record.meta.createdAt || record.savedAt || new Date().toISOString(),
    updatedAt: record.savedAt || record.meta.updatedAt || new Date().toISOString(),
    locked: Boolean(record.meta.locked)
  };
}

export function makeDefaultRecord(courseName = DEFAULT_META.courseName): CourseRecord {
  const now = new Date().toISOString();
  const id = newCourseId();
  return {
    app: APP_ID,
    version: APP_VERSION,
    savedAt: now,
    meta: {
      id,
      courseName: courseName || DEFAULT_META.courseName,
      unitName: DEFAULT_META.unitName,
      baseScore: DEFAULT_META.baseScore,
      ngay: DEFAULT_META.ngay,
      thang: DEFAULT_META.thang,
      nam: DEFAULT_META.nam,
      autoNegative: true,
      viewMode: 'cards',
      activeBuilding: 'ALL',
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
    items: PLATOONS_PRESET.map(preset => ({
      id: preset.id,
      building: preset.building,
      rooms: preset.rooms,
      quanSo: preset.defaultQuanSo,
      hocTap: 0,
      renLuyen: 0,
      nvvs: 0,
      leTiet: 0,
      note: '',
      totalScore: DEFAULT_META.baseScore,
      rank: 1
    })),
    students: [],
    audit: []
  };
}

export function cloneRecord(source: CourseRecord, courseName: string): CourseRecord {
  const now = new Date().toISOString();
  const copy: CourseRecord = JSON.parse(JSON.stringify(source));
  copy.meta.id = newCourseId();
  copy.meta.courseName = courseName;
  copy.meta.createdAt = now;
  copy.meta.updatedAt = now;
  copy.meta.locked = false;
  copy.meta.lockedAt = '';
  copy.meta.lockedBy = '';
  copy.savedAt = now;
  copy.audit = [];
  copy.meta.settingsUpdatedAt = now;
  copy.meta.itemsUpdatedAt = now;
  copy.meta.studentsUpdatedAt = now;
  copy.meta.studentTombstones = {};
  copy.meta.revision = 1;
  copy.items = copy.items.map(item => ({
    ...item,
    hocTap: 0,
    renLuyen: 0,
    nvvs: 0,
    leTiet: 0,
    note: '',
    totalScore: copy.meta.baseScore,
    rank: 1,
    updatedAt: now,
    updatedBy: 'Nhân bản khóa'
  }));
  copy.students = normalizeStudents(copy.students).map(student => ({
    ...student,
    updatedAt: now,
    updatedBy: 'Nhân bản khóa'
  }));
  return copy;
}
