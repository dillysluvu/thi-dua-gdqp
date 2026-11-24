import { create } from 'zustand';
import { PHOTO_SAMPLE_DATA } from '../constants';
import { createAuditEntry, appendAuditEntry } from '../audit';
import {
  cancelScheduledCloudPush,
  cloudProviderName,
  isCloudConfigured,
  loadCloudConfig,
  pullCourse,
  pushCourse,
  saveCloudConfig,
  scheduleCloudPush,
  testCloudConnection,
  type CloudConfig,
  type CloudStatus
} from '../cloudSync';
import {
  CollabSession,
  loadCollabSettings,
  saveCollabSettings,
  type CollabSettings,
  type CollabStatus
} from '../collab';
import {
  APP_ID,
  APP_VERSION,
  cloneRecord,
  deleteCourseRecord,
  getCurrentCourseId,
  loadCourseRecord,
  makeDefaultRecord,
  newCourseId,
  readCourseIndex,
  saveCourseIndex,
  saveCourseRecord,
  setCurrentCourseId,
  summarizeRecord,
  type CourseRecord,
  type CourseSummary
} from '../courseStore';
import {
  createSnapshot,
  deleteSnapshot,
  getSnapshot,
  listSnapshots,
  maybeAutoSnapshot,
  type CourseSnapshot
} from '../backup';
import { mergeCourseRecords } from '../merge';
import { parseSheetFile } from '../parsers';
import { effectiveDaiDoi, unitCode } from '../lib/units';
import { calculateScoreStats, recalculateScores } from '../scoring';
import {
  isLeaderPosition,
  mergeStudentLists,
  normalizePosition,
  normalizeStudent,
  normalizeStudents,
  parseStudentRows,
  sortStudents,
  type Student,
  type StudentMissingFilter
} from '../students';
import { clampInt, formatNum, normalizeQuanSo, normalizeText, readFileAsText, round1 } from '../utils';
import {
  createDefaultItems,
  isRecordPristine,
  loadInitialRecord,
  normalizeItems,
  normalizeRecord,
  parsePlatoonConfig,
  type PlatoonItem,
  type ScoreField
} from '../lib/record';
import type { SheetEntry } from '../lib/sheetImport';

export type Page = 'overview' | 'list' | 'table' | 'students' | 'report' | 'settings';
export type Theme = 'light' | 'dark';
export type ModalName = 'courses' | 'importSheet' | 'backups' | 'cloud' | 'collab' | 'audit' | 'help';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastState {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
  action?: ToastAction;
}

export interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (value: boolean) => void;
}

export interface StudentEditorState {
  open: boolean;
  studentId: string | null;
  presetPosition: string;
  key: number;
}

export interface SettingsInput {
  courseName: string;
  unitName: string;
  baseScore: number;
  ngay: number;
  thang: number;
  nam: number;
  graderName: string;
  platoonsText: string;
}

export interface GradingDraft {
  quanSo: string;
  hocTap: number;
  renLuyen: number;
  nvvs: number;
  leTiet: number;
  note: string;
}

export interface SaveStudentInput {
  id?: string;
  name: string;
  code: string;
  building: string;
  room: string;
  tieuDoi: string;
  trungDoi: string;
  daiDoi: string;
  position: string;
  phone: string;
  note: string;
  className: string;
  school: string;
  birthDate: string;
  hometown: string;
  gender: string;
  ethnicity: string;
  cccd: string;
}

interface AppState {
  initialized: boolean;
  record: CourseRecord;
  courses: CourseSummary[];
  page: Page;
  theme: Theme;
  toolsOpen: boolean;
  modal: ModalName | null;
  search: string;
  building: string;
  selectedItemId: number | null;
  studentSearch: string;
  studentBuilding: string;
  studentRoom: string;
  studentPlatoon: string;
  studentTieuDoi: string;
  studentDaiDoi: string;
  studentMissing: StudentMissingFilter;
  studentGroupMode: 'room' | 'platoon';
  studentTab: 'students' | 'leaders';
  studentSelectedIds: string[];
  studentEditor: StudentEditorState;
  backups: CourseSnapshot[];
  cloudConfig: CloudConfig;
  cloudStatus: CloudStatus | null;
  cloudBusy: boolean;
  collabSettings: CollabSettings;
  collabStatus: CollabStatus | null;
  toast: ToastState | null;
  confirm: ConfirmState | null;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: string;
  online: boolean;
  importBusy: boolean;

  init: () => void;
  setPage: (page: Page) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setToolsOpen: (open: boolean) => void;
  openModal: (modal: ModalName) => void;
  closeModal: () => void;
  setSearch: (value: string) => void;
  setBuilding: (value: string) => void;
  setAutoNegative: (value: boolean) => void;
  openGrading: (id: number) => void;
  closeGrading: () => void;
  goPrev: () => void;
  goNext: () => void;
  applyGrading: (id: number, draft: GradingDraft) => { ok: boolean; error?: string };
  updateQuanSo: (id: number, value: string) => boolean;
  updateCategory: (id: number, field: ScoreField, value: string | number) => void;
  updateSettings: (input: SettingsInput) => { ok: boolean; errors: string[] };
  createCourse: (name: string, cloneSourceId?: string) => { ok: boolean; error?: string };
  switchCourse: (id: string) => void;
  renameCourse: (id: string, name: string) => { ok: boolean; error?: string };
  deleteCourse: (id: string) => void;
  openBackups: () => void;
  refreshBackups: () => void;
  createBackupNow: () => void;
  restoreBackup: (id: string) => void;
  removeBackup: (id: string) => void;
  importBackupFile: (file: File) => Promise<void>;
  applySheetImport: (entries: SheetEntry[], mode: 'merge' | 'replace', sourceLabel: string) => { updated: number; skipped: number };
  loadSample: () => void;
  resetScores: () => void;
  openStudentEditor: (studentId?: string | null, presetPosition?: string) => void;
  closeStudentEditor: () => void;
  saveStudent: (input: SaveStudentInput, continueAdding?: boolean) => { ok: boolean; error?: string };
  deleteStudents: (ids: string[]) => void;
  restoreStudents: (students: Student[]) => void;
  setStudentPosition: (id: string, position: string) => void;
  bulkAssignPosition: (ids: string[], position: string) => void;
  importStudents: (files: File[], mode: 'merge' | 'replace') => Promise<void>;
  setStudentSearch: (value: string) => void;
  setStudentBuilding: (value: string) => void;
  setStudentRoom: (value: string) => void;
  setStudentPlatoon: (value: string) => void;
  setStudentTieuDoi: (value: string) => void;
  setStudentDaiDoi: (value: string) => void;
  setStudentMissing: (value: StudentMissingFilter) => void;
  setStudentGroupMode: (value: 'room' | 'platoon') => void;
  setStudentTab: (value: 'students' | 'leaders') => void;
  toggleStudentSelected: (id: string) => void;
  selectVisibleStudents: (ids: string[]) => void;
  clearStudentSelection: () => void;
  resetStudentFilters: () => void;
  saveGraderName: (name: string) => void;
  toggleLock: () => void;
  saveCloud: (config: CloudConfig) => void;
  testCloud: (config: CloudConfig) => Promise<void>;
  pushCloud: (config: CloudConfig) => Promise<void>;
  pullCloud: (config: CloudConfig) => Promise<void>;
  toggleCollab: (displayName?: string) => void;
  startCollab: () => void;
  stopCollab: () => void;
  saveCollabName: (name: string) => void;
  pullCollabNow: () => Promise<void>;
  pushCollabNow: () => Promise<void>;
  notify: (message: string, tone?: ToastState['tone'], action?: ToastAction) => void;
  dismissToast: () => void;
  confirmAction: (options: { title: string; message: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
  resolveConfirm: (value: boolean) => void;
  flush: () => void;
}

const THEME_STORAGE_KEY = 'THI_DUA_GDQPAN_V3:theme';
const MAX_SEARCH = 120;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingRecord: CourseRecord | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let collabSession: CollabSession | null = null;
let remoteApplying = false;
let toastSequence = 0;

function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function applyTheme(theme: Theme, persist: boolean): void {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#07110f' : '#0b2f2a');
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Giao diện vẫn đổi trong phiên hiện tại.
    }
  }
}

function recalcRecord(record: CourseRecord): CourseRecord {
  return {
    ...record,
    items: recalculateScores(record.items, record.meta.baseScore) as PlatoonItem[]
  };
}

function stampRecord(record: CourseRecord): CourseRecord {
  const now = new Date().toISOString();
  return {
    ...record,
    savedAt: now,
    meta: { ...record.meta, updatedAt: now }
  };
}

function withAudit(record: CourseRecord, action: string, detail: string): CourseRecord {
  return {
    ...record,
    audit: appendAuditEntry(
      record.audit,
      createAuditEntry(action, detail, record.meta.graderName || 'Giảng viên')
    )
  };
}

function sortCourses(courses: CourseSummary[]): CourseSummary[] {
  return courses.slice().sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function upsertCourse(courses: CourseSummary[], summary: CourseSummary): CourseSummary[] {
  const next = courses.slice();
  const index = next.findIndex(course => course.id === summary.id);
  if (index >= 0) next[index] = summary;
  else next.push(summary);
  return sortCourses(next);
}

function persistNow(record: CourseRecord, set: any, get: () => AppState, options: { skipCloud?: boolean } = {}): boolean {
  const stamped = stampRecord(record);
  if (!saveCourseRecord(stamped)) {
    set({ saveState: 'error' });
    return false;
  }

  const courses = upsertCourse(get().courses, summarizeRecord(stamped));
  saveCourseIndex(courses);
  setCurrentCourseId(stamped.meta.id);
  maybeAutoSnapshot(stamped);
  set({
    record: stamped,
    courses,
    saveState: 'saved',
    lastSavedAt: stamped.savedAt
  });

  if (!options.skipCloud && !remoteApplying) {
    const state = get();
    if (state.collabSettings.enabled && collabSession) {
      collabSession.schedulePush(stamped);
    } else if (state.cloudConfig && state.cloudConfig.autoPush && isCloudConfigured(state.cloudConfig)) {
      scheduleCloudPush(stamped, state.cloudConfig, status => {
        if (!status.ok) state.notify(status.message, 'error');
      });
    }
  }
  return true;
}

function scheduleSave(record: CourseRecord, set: any, get: () => AppState): void {
  pendingRecord = record;
  set({ saveState: 'saving' });
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const current = pendingRecord;
    pendingRecord = null;
    if (current) persistNow(current, set, get);
  }, 320);
}

export function flushSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  const current = pendingRecord;
  pendingRecord = null;
  if (!current) return;
  const state = useAppStore.getState();
  persistNow(current, useAppStore.setState, () => useAppStore.getState());
  if (state.saveState === 'saving') {
    // persistNow đã cập nhật trạng thái lưu.
  }
}

function filteredItems(record: CourseRecord, search: string, building: string): PlatoonItem[] {
  const query = normalizeText(search);
  return (record.items as PlatoonItem[]).filter(item => {
    if (building !== 'ALL' && item.building !== building) return false;
    if (!query) return true;
    return normalizeText(`${unitCode('trungDoi', item.id)} ${unitCode('daiDoi', item.daiDoi)} ${item.id} ${item.building} ${item.rooms} ${item.quanSo} ${item.note}`).includes(query);
  });
}

function parseScoreValue(value: string | number, autoNegative: boolean): number {
  const number = parseFloat(String(value === undefined || value === null ? '' : value).replace(',', '.'));
  if (!Number.isFinite(number)) return 0;
  return round1(autoNegative && number > 0 ? -number : number);
}

function sameGrading(item: PlatoonItem, draft: GradingDraft): boolean {
  return String(item.quanSo || '') === String(draft.quanSo || '')
    && Number(item.hocTap) === Number(draft.hocTap)
    && Number(item.renLuyen) === Number(draft.renLuyen)
    && Number(item.nvvs) === Number(draft.nvvs)
    && Number(item.leTiet) === Number(draft.leTiet)
    && String(item.note || '') === String(draft.note || '');
}

function gradingChanges(item: PlatoonItem, draft: GradingDraft): string[] {
  const changes: string[] = [];
  const fields: Array<[ScoreField, string]> = [
    ['hocTap', 'Học tập'],
    ['renLuyen', 'Rèn luyện'],
    ['nvvs', 'NVVS'],
    ['leTiet', 'Lễ tiết']
  ];
  fields.forEach(([field, label]) => {
    if (Number(item[field]) !== Number(draft[field])) {
      changes.push(`${label}: ${formatNum(item[field])} → ${formatNum(draft[field])}`);
    }
  });
  if (String(item.quanSo || '') !== String(draft.quanSo || '')) {
    changes.push(`Quân số: ${item.quanSo || '—'} → ${draft.quanSo || '—'}`);
  }
  if (String(item.note || '') !== String(draft.note || '')) changes.push('Ghi chú đã thay đổi');
  return changes;
}

function resetFiltersState(): Partial<AppState> {
  return {
    search: '',
    building: 'ALL',
    selectedItemId: null,
    studentSearch: '',
    studentBuilding: 'ALL',
    studentRoom: 'ALL',
    studentPlatoon: 'ALL',
    studentTieuDoi: 'ALL',
    studentDaiDoi: 'ALL',
    studentMissing: 'ALL',
    studentSelectedIds: [],
    studentTab: 'students',
    toolsOpen: false
  };
}

function tombstonesAfter(previous: Student[], next: Student[], current: Record<string, string>, at: string): Record<string, string> {
  const tombstones = { ...current };
  const nextIds = new Set(next.map(student => student.id));
  previous.forEach(student => {
    if (!nextIds.has(student.id)) tombstones[student.id] = at;
  });
  next.forEach(student => {
    delete tombstones[student.id];
  });
  return tombstones;
}

export const useAppStore = create<AppState>((set, get) => {
  const commit = (mutator: (record: CourseRecord) => CourseRecord, patch: Partial<AppState> = {}) => {
    const next = mutator(get().record);
    set({ record: next, ...patch });
    scheduleSave(next, set, get);
    return next;
  };

  const requireUnlocked = (message = 'Sổ điểm đã khóa. Hãy mở khóa trước khi chỉnh sửa.'): boolean => {
    if (!get().record.meta.locked) return true;
    get().notify(message, 'error');
    return false;
  };

  const activateRecord = (record: CourseRecord) => {
    const normalized = recalcRecord(normalizeRecord(record));
    set({
      record: normalized,
      ...resetFiltersState(),
      page: 'overview',
      studentEditor: { open: false, studentId: null, presetPosition: 'Học viên', key: 0 }
    });
    setCurrentCourseId(normalized.meta.id);
    maybeAutoSnapshot(normalized);
    if (get().collabSettings.enabled) get().startCollab();
  };

  return {
    initialized: false,
    record: makeDefaultRecord(),
    courses: [],
    page: 'overview',
    theme: 'light',
    toolsOpen: false,
    modal: null,
    search: '',
    building: 'ALL',
    selectedItemId: null,
    studentSearch: '',
    studentBuilding: 'ALL',
    studentRoom: 'ALL',
    studentPlatoon: 'ALL',
    studentTieuDoi: 'ALL',
    studentDaiDoi: 'ALL',
    studentMissing: 'ALL',
    studentGroupMode: 'room',
    studentTab: 'students',
    studentSelectedIds: [],
    studentEditor: { open: false, studentId: null, presetPosition: 'Học viên', key: 0 },
    backups: [],
    cloudConfig: loadCloudConfig(),
    cloudStatus: null,
    cloudBusy: false,
    collabSettings: loadCollabSettings(),
    collabStatus: null,
    toast: null,
    confirm: null,
    saveState: 'idle',
    lastSavedAt: '',
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    importBusy: false,

    init: () => {
      if (get().initialized) return;
      const theme = loadTheme();
      applyTheme(theme, false);
      const { record, courses } = loadInitialRecord();
      const normalized = recalcRecord(normalizeRecord(record));
      const cloudConfig = loadCloudConfig();
      const collabSettings = loadCollabSettings();

      set({
        initialized: true,
        record: normalized,
        courses,
        theme,
        cloudConfig,
        collabSettings,
        page: 'overview',
        saveState: 'saved',
        lastSavedAt: normalized.savedAt,
        online: navigator.onLine
      });
      setCurrentCourseId(normalized.meta.id);
      maybeAutoSnapshot(normalized);

      window.addEventListener('online', () => set({ online: true }));
      window.addEventListener('offline', () => set({ online: false }));
      window.addEventListener('beforeunload', flushSave);

      if (collabSettings.enabled && isCloudConfigured(cloudConfig)) {
        setTimeout(() => {
          if (get().collabSettings.enabled) get().startCollab();
        }, 250);
      }
    },

    setPage: (page) => {
      set({ page, toolsOpen: false });
      if (page === 'list' || page === 'table') {
        const viewMode = page === 'table' ? 'table' : 'cards';
        if (get().record.meta.viewMode !== viewMode) {
          commit(record => ({ ...record, meta: { ...record.meta, viewMode } }));
        }
      }
    },

    setTheme: (theme) => {
      applyTheme(theme, true);
      set({ theme });
    },

    toggleTheme: () => {
      const next = get().theme === 'dark' ? 'light' : 'dark';
      applyTheme(next, true);
      set({ theme: next });
    },

    setToolsOpen: (open) => set({ toolsOpen: open }),
    openModal: (modal) => {
      set({ modal, toolsOpen: false });
      if (modal === 'backups') get().refreshBackups();
    },
    closeModal: () => set({ modal: null }),

    setSearch: (value) => set({ search: String(value || '').slice(0, MAX_SEARCH) }),
    setBuilding: (value) => {
      const building = String(value || 'ALL');
      set({ building });
      commit(record => ({ ...record, meta: { ...record.meta, activeBuilding: building } }));
    },
    setAutoNegative: (value) => {
      commit(record => ({
        ...record,
        meta: { ...record.meta, autoNegative: Boolean(value), settingsUpdatedAt: new Date().toISOString() }
      }));
    },

    openGrading: (id) => {
      const state = get();
      let items = filteredItems(state.record, state.search, state.building);
      if (!items.some(item => item.id === id)) {
        set({ search: '', building: 'ALL' });
        commit(record => ({ ...record, meta: { ...record.meta, activeBuilding: 'ALL' } }));
        items = filteredItems(get().record, '', 'ALL');
      }
      if (items.some(item => item.id === id)) set({ selectedItemId: id });
    },
    closeGrading: () => set({ selectedItemId: null }),
    goPrev: () => {
      const state = get();
      const items = filteredItems(state.record, state.search, state.building);
      const index = items.findIndex(item => item.id === state.selectedItemId);
      if (index > 0) set({ selectedItemId: items[index - 1].id });
    },
    goNext: () => {
      const state = get();
      const items = filteredItems(state.record, state.search, state.building);
      const index = items.findIndex(item => item.id === state.selectedItemId);
      if (index >= 0 && index < items.length - 1) set({ selectedItemId: items[index + 1].id });
    },

    applyGrading: (id, draft) => {
      if (!requireUnlocked()) return { ok: false, error: 'Sổ điểm đã khóa.' };
      const record = get().record;
      const item = (record.items as PlatoonItem[]).find(entry => entry.id === id);
      if (!item) return { ok: false, error: 'Không tìm thấy trung đội.' };
      const quanSoRaw = String(draft.quanSo || '').trim();
      const normalizedQuanSo = quanSoRaw ? normalizeQuanSo(quanSoRaw) : '';
      if (normalizedQuanSo === null) return { ok: false, error: 'Quân số phải có dạng 30/31.' };

      const nextDraft: GradingDraft = {
        quanSo: normalizedQuanSo,
        hocTap: round1(draft.hocTap),
        renLuyen: round1(draft.renLuyen),
        nvvs: round1(draft.nvvs),
        leTiet: round1(draft.leTiet),
        note: String(draft.note || '').trim()
      };
      if (sameGrading(item, nextDraft)) return { ok: true };

      const changes = gradingChanges(item, nextDraft);
      const now = new Date().toISOString();
      const items = (record.items as PlatoonItem[]).map(entry => entry.id === id
        ? {
            ...entry,
            ...nextDraft,
            updatedAt: now,
            updatedBy: record.meta.graderName || 'Giảng viên'
          }
        : entry);
      let next = recalcRecord({
        ...record,
        items,
        meta: { ...record.meta, itemsUpdatedAt: now }
      });
      if (changes.length) next = withAudit(next, 'Sửa điểm', `${unitCode('trungDoi', id)} · ${changes.join('; ')}`);
      commit(() => next);
      return { ok: true };
    },

    updateQuanSo: (id, value) => {
      if (!requireUnlocked('Sổ điểm đã khóa. Hãy mở khóa trước khi sửa quân số.')) return false;
      const record = get().record;
      const item = (record.items as PlatoonItem[]).find(entry => entry.id === id);
      if (!item) return false;
      const raw = String(value || '').trim();
      const normalized = raw ? normalizeQuanSo(raw) : '';
      if (normalized === null) {
        get().notify('Quân số phải có dạng 30/31.', 'error');
        return false;
      }
      if (String(item.quanSo || '') === String(normalized || '')) return true;
      const now = new Date().toISOString();
      let next = recalcRecord({
        ...record,
        items: (record.items as PlatoonItem[]).map(entry => entry.id === id
          ? { ...entry, quanSo: normalized, updatedAt: now, updatedBy: record.meta.graderName }
          : entry),
        meta: { ...record.meta, itemsUpdatedAt: now }
      });
      next = withAudit(next, 'Sửa quân số', `${unitCode('trungDoi', id)}: ${item.quanSo || '—'} → ${normalized || '—'}`);
      commit(() => next);
      return true;
    },

    updateCategory: (id, field, value) => {
      if (!requireUnlocked()) return;
      const record = get().record;
      const item = (record.items as PlatoonItem[]).find(entry => entry.id === id);
      if (!item) return;
      const nextValue = parseScoreValue(value, record.meta.autoNegative);
      if (Number(item[field]) === nextValue) return;
      const now = new Date().toISOString();
      let next = recalcRecord({
        ...record,
        items: (record.items as PlatoonItem[]).map(entry => entry.id === id
          ? { ...entry, [field]: nextValue, updatedAt: now, updatedBy: record.meta.graderName }
          : entry),
        meta: { ...record.meta, itemsUpdatedAt: now }
      });
      next = withAudit(next, 'Sửa điểm', `${unitCode('trungDoi', id)} · ${field}: ${formatNum(item[field])} → ${formatNum(nextValue)}`);
      commit(() => next);
    },

    updateSettings: (input) => {
      if (!requireUnlocked('Sổ điểm đã khóa. Hãy mở khóa trước khi đổi cấu hình.')) {
        return { ok: false, errors: ['Sổ điểm đã khóa. Hãy mở khóa trước khi đổi cấu hình.'] };
      }
      const parsed = parsePlatoonConfig(input.platoonsText);
      const errors = parsed.errors.slice();
      const baseScore = Number(input.baseScore);
      if (!Number.isFinite(baseScore) || baseScore <= 0) errors.push('Điểm gốc phải là số lớn hơn 0.');
      if (errors.length) return { ok: false, errors };

      const record = get().record;
      const now = new Date().toISOString();
      const existingById = new Map((record.items as PlatoonItem[]).map(item => [item.id, item]));
      const items = parsed.items.map(entry => {
        const old = existingById.get(entry.id);
        const next: PlatoonItem = {
          id: entry.id,
          building: entry.building,
          rooms: entry.rooms,
          daiDoi: effectiveDaiDoi(entry.daiDoi !== undefined ? entry.daiDoi : (old ? old.daiDoi : ''), entry.id),
          quanSo: entry.quanSo || (old ? old.quanSo : ''),
          hocTap: old ? old.hocTap : 0,
          renLuyen: old ? old.renLuyen : 0,
          nvvs: old ? old.nvvs : 0,
          leTiet: old ? old.leTiet : 0,
          note: old ? old.note : '',
          totalScore: 0,
          rank: 1,
          updatedAt: old ? String(old.updatedAt || '') : now,
          updatedBy: old ? String(old.updatedBy || '') : record.meta.graderName
        };
        const changed = !old || ['building', 'rooms', 'daiDoi', 'quanSo', 'hocTap', 'renLuyen', 'nvvs', 'leTiet', 'note']
          .some(field => String((old as any)[field] ?? '') !== String((next as any)[field] ?? ''));
        if (changed) {
          next.updatedAt = now;
          next.updatedBy = record.meta.graderName;
        }
        return next;
      });

      const activeBuilding = record.meta.activeBuilding !== 'ALL' && !items.some(item => item.building === record.meta.activeBuilding)
        ? 'ALL'
        : record.meta.activeBuilding;
      const next = recalcRecord({
        ...record,
        items,
        meta: {
          ...record.meta,
          courseName: String(input.courseName || '').trim() || 'Khóa chưa đặt tên',
          unitName: String(input.unitName || '').trim() || 'Trung Tâm GDQP&AN',
          baseScore: round1(baseScore),
          ngay: clampInt(input.ngay, 1, 31, record.meta.ngay),
          thang: clampInt(input.thang, 1, 12, record.meta.thang),
          nam: clampInt(input.nam, 2000, 2100, record.meta.nam),
          graderName: String(input.graderName || '').trim() || 'Giảng viên',
          activeBuilding,
          settingsUpdatedAt: now,
          itemsUpdatedAt: now
        }
      });
      const audited = withAudit(
        next,
        'Đổi cấu hình',
        `Khóa: ${record.meta.courseName} → ${next.meta.courseName}; điểm gốc: ${formatNum(record.meta.baseScore)} → ${formatNum(next.meta.baseScore)}; số b: ${record.items.length} → ${next.items.length}`
      );
      commit(() => audited, { building: activeBuilding, selectedItemId: null });
      get().notify('Đã lưu cấu hình khóa học.', 'success');
      return { ok: true, errors: [] };
    },

    createCourse: (name, cloneSourceId = '') => {
      const courseName = String(name || '').trim();
      if (!courseName) return { ok: false, error: 'Hãy nhập tên khóa mới.' };
      if (get().courses.some(course => normalizeText(course.courseName) === normalizeText(courseName))) {
        return { ok: false, error: 'Tên khóa này đã tồn tại. Hãy chọn tên khác.' };
      }
      flushSave();
      let record: CourseRecord;
      if (cloneSourceId) {
        const source = cloneSourceId === get().record.meta.id ? get().record : loadCourseRecord(cloneSourceId);
        if (!source) return { ok: false, error: 'Không tìm thấy khóa nguồn để nhân bản.' };
        record = cloneRecord(source, courseName);
      } else {
        record = makeDefaultRecord(courseName);
        const today = new Date();
        record.meta.unitName = get().record.meta.unitName || record.meta.unitName;
        record.meta.ngay = today.getDate();
        record.meta.thang = today.getMonth() + 1;
        record.meta.nam = today.getFullYear();
        record.meta.graderName = get().record.meta.graderName || 'Giảng viên';
      }
      if (!saveCourseRecord(record)) return { ok: false, error: 'Không tạo được khóa mới trên thiết bị này.' };
      const courses = upsertCourse(get().courses, summarizeRecord(record));
      saveCourseIndex(courses);
      set({ courses });
      activateRecord(record);
      get().notify(cloneSourceId ? `Đã nhân bản thành khóa ${courseName}.` : `Đã tạo khóa ${courseName}.`, 'success');
      return { ok: true };
    },

    switchCourse: (id) => {
      if (!id || id === get().record.meta.id) return;
      flushSave();
      const record = loadCourseRecord(id);
      if (!record) {
        get().notify('Không tìm thấy dữ liệu của khóa này.', 'error');
        return;
      }
      const courses = upsertCourse(get().courses, summarizeRecord(record));
      saveCourseIndex(courses);
      set({ courses });
      activateRecord(record);
      get().notify(`Đã chuyển sang khóa ${record.meta.courseName}.`, 'success');
    },

    renameCourse: (id, name) => {
      const courseName = String(name || '').trim();
      if (!courseName) return { ok: false, error: 'Tên khóa không được để trống.' };
      if (get().courses.some(course => course.id !== id && normalizeText(course.courseName) === normalizeText(courseName))) {
        return { ok: false, error: 'Tên khóa này đã tồn tại.' };
      }
      if (id === get().record.meta.id) {
        const now = new Date().toISOString();
        commit(record => ({
          ...record,
          meta: { ...record.meta, courseName, settingsUpdatedAt: now }
        }));
      } else {
        const record = loadCourseRecord(id);
        if (!record) return { ok: false, error: 'Không tìm thấy khóa.' };
        const now = new Date().toISOString();
        const next = { ...record, savedAt: now, meta: { ...record.meta, courseName, settingsUpdatedAt: now, updatedAt: now } };
        saveCourseRecord(next);
        set({ courses: upsertCourse(get().courses, summarizeRecord(next)) });
        saveCourseIndex(upsertCourse(get().courses, summarizeRecord(next)));
      }
      get().notify('Đã đổi tên khóa.', 'success');
      return { ok: true };
    },

    deleteCourse: (id) => {
      const remaining = get().courses.filter(course => course.id !== id);
      deleteCourseRecord(id);
      saveCourseIndex(remaining);
      set({ courses: remaining });
      if (id === get().record.meta.id) {
        if (remaining.length) {
          const next = loadCourseRecord(remaining[0].id);
          if (next) activateRecord(next);
        } else {
          const record = makeDefaultRecord();
          saveCourseRecord(record);
          const courses = [summarizeRecord(record)];
          saveCourseIndex(courses);
          set({ courses });
          activateRecord(record);
        }
      }
      get().notify('Đã xóa khóa học.', 'success');
    },

    openBackups: () => {
      get().openModal('backups');
      get().refreshBackups();
    },
    refreshBackups: () => set({ backups: listSnapshots(get().record.meta.id) }),
    createBackupNow: () => {
      flushSave();
      const snapshot = createSnapshot(get().record, 'Sao lưu thủ công', true);
      get().refreshBackups();
      get().notify(snapshot ? 'Đã tạo bản sao lưu.' : 'Không tạo được bản sao lưu.', snapshot ? 'success' : 'error');
    },
    restoreBackup: (id) => {
      const snapshot = getSnapshot(get().record.meta.id, id);
      if (!snapshot) {
        get().notify('Không tìm thấy bản sao lưu.', 'error');
        return;
      }
      const currentId = get().record.meta.id;
      const record = normalizeRecord({ ...snapshot.record, meta: { ...snapshot.record.meta, id: currentId } });
      const next = withAudit(record, 'Khôi phục sao lưu', `Khôi phục bản sao lưu lúc ${new Date(snapshot.createdAt).toLocaleString('vi-VN')}`);
      set({ record: recalcRecord(next), selectedItemId: null, ...resetFiltersState() });
      persistNow(recalcRecord(next), set, get);
      get().refreshBackups();
      get().notify('Đã khôi phục bản sao lưu.', 'success');
    },
    removeBackup: (id) => {
      const ok = deleteSnapshot(get().record.meta.id, id);
      get().refreshBackups();
      get().notify(ok ? 'Đã xóa bản sao lưu.' : 'Không xóa được bản sao lưu.', ok ? 'success' : 'error');
    },

    importBackupFile: async (file) => {
      if (!requireUnlocked('Sổ điểm đã khóa. Hãy mở khóa trước khi nhập file sao lưu.')) return;
      let payload: any;
      try {
        payload = JSON.parse(await readFileAsText(file));
      } catch {
        get().notify('File JSON không hợp lệ.', 'error');
        return;
      }
      const rawItems = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.items) ? payload.items : null);
      if (!rawItems || !rawItems.length) {
        get().notify('File không có dữ liệu trung đội.', 'error');
        return;
      }
      const items = normalizeItems(rawItems);
      if (!items.length) {
        get().notify('File không có dữ liệu hợp lệ.', 'error');
        return;
      }
      const students = normalizeStudents(!Array.isArray(payload) ? payload.students : []);
      const ok = await get().confirmAction({
        title: 'Nhập dữ liệu sao lưu',
        message: `Thay thế toàn bộ dữ liệu hiện tại bằng ${items.length} trung đội và ${students.length} sinh viên từ file?\nThao tác này có thể hoàn tác bằng bản sao lưu tự động.`,
        confirmLabel: 'Nhập dữ liệu'
      });
      if (!ok) return;

      flushSave();
      createSnapshot(get().record, 'Trước khi nhập file sao lưu', true);
      const now = new Date().toISOString();
      const meta = (!Array.isArray(payload) && payload.meta && typeof payload.meta === 'object') ? payload.meta : {};
      const current = get().record;
      const next = normalizeRecord({
        ...current,
        items: items.map(item => ({ ...item, updatedAt: now, updatedBy: current.meta.graderName })),
        students: students.map(student => ({ ...student, updatedAt: now, updatedBy: current.meta.graderName })),
        meta: {
          ...current.meta,
          courseName: String(meta.courseName || current.meta.courseName),
          unitName: String(meta.unitName || current.meta.unitName),
          baseScore: Number(meta.baseScore) > 0 ? Number(meta.baseScore) : current.meta.baseScore,
          ngay: clampInt(meta.ngay, 1, 31, current.meta.ngay),
          thang: clampInt(meta.thang, 1, 12, current.meta.thang),
          nam: clampInt(meta.nam, 2000, 2100, current.meta.nam),
          autoNegative: typeof meta.autoNegative === 'boolean' ? meta.autoNegative : current.meta.autoNegative,
          itemsUpdatedAt: now,
          studentsUpdatedAt: now,
          settingsUpdatedAt: now
        }
      });
      const audited = withAudit(next, 'Nhập file sao lưu', `${items.length} trung đội, ${students.length} sinh viên từ ${file.name}`);
      set({ record: recalcRecord(audited), ...resetFiltersState() });
      persistNow(recalcRecord(audited), set, get);
      get().notify(`Đã nhập ${items.length} trung đội từ file sao lưu.`, 'success');
    },

    applySheetImport: (entries, mode, sourceLabel) => {
      if (!requireUnlocked('Sổ điểm đã khóa. Hãy mở khóa trước khi nhập Excel.')) return { updated: 0, skipped: 0 };
      const record = get().record;
      const now = new Date().toISOString();
      let updated = 0;
      let skipped = 0;
      let items: PlatoonItem[];

      if (mode === 'merge') {
        const byId = new Map(entries.map(entry => [entry.id, entry]));
        items = (record.items as PlatoonItem[]).map(item => {
          const entry = byId.get(item.id);
          if (!entry) return item;
          updated++;
          return {
            ...item,
            building: entry.building !== undefined ? entry.building : item.building,
            rooms: entry.rooms !== undefined ? entry.rooms : item.rooms,
            daiDoi: effectiveDaiDoi(entry.daiDoi !== undefined ? entry.daiDoi : item.daiDoi, item.id),
            quanSo: entry.quanSo !== undefined ? entry.quanSo : item.quanSo,
            hocTap: entry.hocTap !== undefined ? entry.hocTap : item.hocTap,
            renLuyen: entry.renLuyen !== undefined ? entry.renLuyen : item.renLuyen,
            nvvs: entry.nvvs !== undefined ? entry.nvvs : item.nvvs,
            leTiet: entry.leTiet !== undefined ? entry.leTiet : item.leTiet,
            note: entry.note !== undefined ? entry.note : item.note,
            updatedAt: now,
            updatedBy: record.meta.graderName
          };
        });
        skipped = entries.length - updated;
      } else {
        const oldById = new Map((record.items as PlatoonItem[]).map(item => [item.id, item]));
        items = entries.map(entry => {
          const old = oldById.get(entry.id);
          return {
            id: entry.id,
            building: entry.building !== undefined ? entry.building : (old ? old.building : ''),
            rooms: entry.rooms !== undefined ? entry.rooms : (old ? old.rooms : ''),
            daiDoi: effectiveDaiDoi(entry.daiDoi !== undefined ? entry.daiDoi : (old ? old.daiDoi : ''), entry.id),
            quanSo: entry.quanSo !== undefined ? entry.quanSo : (old ? old.quanSo : ''),
            hocTap: entry.hocTap !== undefined ? entry.hocTap : 0,
            renLuyen: entry.renLuyen !== undefined ? entry.renLuyen : 0,
            nvvs: entry.nvvs !== undefined ? entry.nvvs : 0,
            leTiet: entry.leTiet !== undefined ? entry.leTiet : 0,
            note: entry.note !== undefined ? entry.note : '',
            totalScore: 0,
            rank: 1,
            updatedAt: now,
            updatedBy: record.meta.graderName
          };
        }).sort((a, b) => a.id - b.id);
        updated = items.length;
      }

      const activeBuilding = record.meta.activeBuilding !== 'ALL' && !items.some(item => item.building === record.meta.activeBuilding)
        ? 'ALL'
        : record.meta.activeBuilding;
      let next = recalcRecord({
        ...record,
        items,
        meta: { ...record.meta, itemsUpdatedAt: now, activeBuilding }
      });
      next = withAudit(next, 'Nhập Excel', `${mode === 'replace' ? 'Thay thế' : 'Cập nhật'} ${updated} trung đội từ ${sourceLabel}`);
      commit(() => next, { selectedItemId: null, building: activeBuilding });
      get().notify(mode === 'merge'
        ? `Đã cập nhật ${updated} trung đội${skipped ? `, bỏ qua ${skipped} b không có trong danh sách` : ''}.`
        : `Đã thay thế bằng ${updated} trung đội.`, 'success');
      return { updated, skipped };
    },

    loadSample: () => {
      if (!requireUnlocked()) return;
      flushSave();
      createSnapshot(get().record, 'Trước khi nạp dữ liệu mẫu', true);
      const now = new Date().toISOString();
      const items = (get().record.items as PlatoonItem[]).map(item => {
        const sample = PHOTO_SAMPLE_DATA[item.id] || {};
        return {
          ...item,
          quanSo: sample.quanSo || item.quanSo,
          hocTap: sample.hocTap || 0,
          renLuyen: sample.renLuyen || 0,
          nvvs: sample.nvvs || 0,
          leTiet: sample.leTiet || 0,
          updatedAt: now,
          updatedBy: get().record.meta.graderName
        };
      });
      let next = recalcRecord({ ...get().record, items, meta: { ...get().record.meta, itemsUpdatedAt: now } });
      next = withAudit(next, 'Nạp dữ liệu mẫu', `Đã nạp điểm mẫu K337 cho ${items.length} trung đội`);
      commit(() => next);
      get().notify('Đã nạp dữ liệu mẫu K337.', 'success');
    },

    resetScores: () => {
      if (!requireUnlocked()) return;
      flushSave();
      createSnapshot(get().record, 'Trước khi đặt lại điểm', true);
      const now = new Date().toISOString();
      const items = (get().record.items as PlatoonItem[]).map(item => ({
        ...item,
        hocTap: 0,
        renLuyen: 0,
        nvvs: 0,
        leTiet: 0,
        note: '',
        updatedAt: now,
        updatedBy: get().record.meta.graderName
      }));
      let next = recalcRecord({ ...get().record, items, meta: { ...get().record.meta, itemsUpdatedAt: now } });
      next = withAudit(next, 'Đặt lại điểm', `Đã xóa điểm trừ và ghi chú của ${items.length} trung đội`);
      commit(() => next);
      get().notify('Đã đặt lại toàn bộ điểm.', 'success');
    },

    openStudentEditor: (studentId = null, presetPosition = 'Học viên') => {
      set({
        studentEditor: {
          open: true,
          studentId: studentId || null,
          presetPosition,
          key: Date.now()
        }
      });
    },
    closeStudentEditor: () => set({ studentEditor: { ...get().studentEditor, open: false } }),

    saveStudent: (input, continueAdding = false) => {
      if (!requireUnlocked('Sổ điểm đã khóa. Hãy mở khóa trước khi sửa danh sách sinh viên.')) {
        return { ok: false, error: 'Sổ điểm đã khóa.' };
      }
      const name = String(input.name || '').trim();
      if (!name) return { ok: false, error: 'Hãy nhập họ tên sinh viên.' };
      const code = String(input.code || '').trim();
      const id = String(input.id || '');
      if (code) {
        const duplicate = get().record.students.find(student => student.id !== id && normalizeText(student.code) === normalizeText(code));
        if (duplicate) {
          return { ok: false, error: `Mã SV ${code} đã thuộc về ${duplicate.name}${duplicate.room ? ` (P. ${duplicate.room})` : ''}.` };
        }
      }
      const existing = get().record.students.find(student => student.id === id);
      const now = new Date().toISOString();
      const trungDoi = String(input.trungDoi || '').trim();
      const student: Student = {
        ...(existing || {}),
        id: existing ? existing.id : `sv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        name,
        code,
        building: String(input.building || '').trim(),
        room: String(input.room || '').trim(),
        tieuDoi: String(input.tieuDoi || '').trim(),
        trungDoi,
        daiDoi: effectiveDaiDoi(input.daiDoi, trungDoi),
        position: normalizePosition(input.position),
        phone: String(input.phone || '').trim(),
        note: String(input.note || '').trim(),
        className: String(input.className || '').trim(),
        school: String(input.school || '').trim(),
        birthDate: String(input.birthDate || '').trim(),
        hometown: String(input.hometown || '').trim(),
        gender: String(input.gender || '').trim(),
        ethnicity: String(input.ethnicity || '').trim(),
        cccd: String(input.cccd || '').trim(),
        updatedAt: now,
        updatedBy: get().record.meta.graderName
      };
      const previous = get().record.students;
      const students = sortStudents(existing
        ? previous.map(entry => entry.id === existing.id ? student : entry)
        : [...previous, student]);
      const tombstones = { ...get().record.meta.studentTombstones };
      delete tombstones[student.id];
      let next: CourseRecord = {
        ...get().record,
        students,
        meta: { ...get().record.meta, studentsUpdatedAt: now, studentTombstones: tombstones }
      };
      next = withAudit(next, existing ? 'Sửa sinh viên' : 'Thêm sinh viên', `${student.name}${student.room ? ` · P. ${student.room}` : ''}${student.position !== 'Học viên' ? ` · ${student.position}` : ''}`);
      commit(() => next);
      if (continueAdding) {
        set({
          studentEditor: {
            open: true,
            studentId: null,
            presetPosition: student.position,
            key: Date.now()
          }
        });
      } else {
        set({ studentEditor: { ...get().studentEditor, open: false } });
      }
      get().notify(existing ? 'Đã cập nhật sinh viên.' : 'Đã thêm sinh viên.', 'success');
      return { ok: true };
    },

    deleteStudents: (ids) => {
      if (!requireUnlocked('Sổ điểm đã khóa. Hãy mở khóa trước khi xóa sinh viên.')) return;
      const idSet = new Set(ids);
      const deleted = get().record.students.filter(student => idSet.has(student.id));
      if (!deleted.length) return;
      const now = new Date().toISOString();
      const students = get().record.students.filter(student => !idSet.has(student.id));
      const tombstones = { ...get().record.meta.studentTombstones };
      deleted.forEach(student => { tombstones[student.id] = now; });
      let next: CourseRecord = {
        ...get().record,
        students,
        meta: { ...get().record.meta, studentsUpdatedAt: now, studentTombstones: tombstones }
      };
      next = withAudit(next, 'Xóa sinh viên', deleted.map(student => student.name).join(', ').slice(0, 500));
      commit(() => next, { studentSelectedIds: get().studentSelectedIds.filter(id => !idSet.has(id)) });
      get().notify(`Đã xóa ${deleted.length} sinh viên.`, 'success', {
        label: 'Hoàn tác',
        run: () => get().restoreStudents(deleted)
      });
    },

    restoreStudents: (students) => {
      if (!students.length) return;
      const now = new Date().toISOString();
      const existingIds = new Set(get().record.students.map(student => student.id));
      const restored = students
        .filter(student => !existingIds.has(student.id))
        .map(student => ({ ...student, updatedAt: now, updatedBy: get().record.meta.graderName }));
      if (!restored.length) return;
      const tombstones = { ...get().record.meta.studentTombstones };
      restored.forEach(student => { delete tombstones[student.id]; });
      let next: CourseRecord = {
        ...get().record,
        students: sortStudents([...get().record.students, ...restored]),
        meta: { ...get().record.meta, studentsUpdatedAt: now, studentTombstones: tombstones }
      };
      next = withAudit(next, 'Hoàn tác xóa sinh viên', restored.map(student => student.name).join(', ').slice(0, 500));
      commit(() => next);
      get().notify(`Đã khôi phục ${restored.length} sinh viên.`, 'success');
    },

    setStudentPosition: (id, position) => {
      if (!requireUnlocked('Sổ điểm đã khóa. Hãy mở khóa trước khi sửa ban cán sự.')) return;
      const student = get().record.students.find(entry => entry.id === id);
      if (!student) return;
      const normalized = normalizePosition(position);
      if (student.position === normalized) return;
      const now = new Date().toISOString();
      let next: CourseRecord = {
        ...get().record,
        students: get().record.students.map(entry => entry.id === id
          ? { ...entry, position: normalized, updatedAt: now, updatedBy: get().record.meta.graderName }
          : entry),
        meta: { ...get().record.meta, studentsUpdatedAt: now }
      };
      next = withAudit(next, 'Đổi chức vụ', `${student.name}: ${student.position} → ${normalized}`);
      commit(() => next);
      get().notify('Đã cập nhật chức vụ.', 'success');
    },

    bulkAssignPosition: (ids, position) => {
      if (!requireUnlocked('Sổ điểm đã khóa. Hãy mở khóa trước khi sửa ban cán sự.')) return;
      const idSet = new Set(ids);
      const normalized = normalizePosition(position);
      const now = new Date().toISOString();
      let next: CourseRecord = {
        ...get().record,
        students: get().record.students.map(student => idSet.has(student.id)
          ? { ...student, position: normalized, updatedAt: now, updatedBy: get().record.meta.graderName }
          : student),
        meta: { ...get().record.meta, studentsUpdatedAt: now }
      };
      next = withAudit(next, 'Gán chức vụ hàng loạt', `${ids.length} sinh viên → ${normalized}`);
      commit(() => next, { studentSelectedIds: [] });
      get().notify(`Đã gán chức vụ ${normalized} cho ${ids.length} sinh viên.`, 'success');
    },

    importStudents: async (files, mode) => {
      if (!requireUnlocked('Sổ điểm đã khóa. Hãy mở khóa trước khi nhập danh sách sinh viên.')) return;
      const fileList = Array.from(files || []).filter(Boolean);
      if (!fileList.length) return;
      set({ importBusy: true });
      try {
        const summaries: string[] = [];
        const allStudents: Student[] = [];
        const allErrors: string[] = [];
        for (const file of fileList) {
          try {
            const workbook = await parseSheetFile(file);
            let best: ReturnType<typeof parseStudentRows> | null = null;
            let bestName = '';
            workbook.sheets.forEach(sheet => {
              const result = parseStudentRows(sheet.rows, get().record.items);
              if (!best || result.students.length > best.students.length) {
                best = result;
                bestName = sheet.name;
              }
            });
            if (!best || !best.students.length) {
              const message = best && best.errors.length ? best.errors.slice(0, 2).join(' · ') : 'không đọc được sinh viên';
              summaries.push(`${file.name}: 0 sinh viên`);
              allErrors.push(`${file.name}: ${message}`);
              continue;
            }
            allStudents.push(...best.students);
            summaries.push(`${file.name}: ${best.students.length} sinh viên (trang "${bestName}")`);
            if (best.errors.length) allErrors.push(...best.errors.slice(0, 2).map(error => `${file.name}: ${error}`));
          } catch (error) {
            summaries.push(`${file.name}: lỗi đọc file`);
            allErrors.push(`${file.name}: ${(error as Error).message}`);
          }
        }

        if (!allStudents.length) {
          get().notify(allErrors.slice(0, 3).join(' · ') || 'Không đọc được sinh viên từ các file đã chọn.', 'error');
          return;
        }

        const incomingBase = mergeStudentLists([], allStudents);
        const ok = await get().confirmAction({
          title: 'Nhập danh sách sinh viên',
          message: `Tìm thấy ${incomingBase.length} sinh viên trong ${fileList.length} file:\n${summaries.join('\n')}\n\n${mode === 'replace' ? 'Thay thế toàn bộ danh sách hiện tại?' : 'Cập nhật vào danh sách hiện tại?'}${allErrors.length ? `\n${allErrors.length} lỗi/cảnh báo sẽ bị bỏ qua.` : ''}`,
          confirmLabel: mode === 'replace' ? 'Thay thế' : 'Cập nhật',
          danger: mode === 'replace'
        });
        if (!ok) return;

        const record = get().record;
        const now = new Date().toISOString();
        const previous = record.students.slice();
        const existingByCode = new Map<string, Student>();
        const existingByNameRoom = new Map<string, Student>();
        previous.forEach(student => {
          if (student.code) existingByCode.set(normalizeText(student.code), student);
          existingByNameRoom.set(`${normalizeText(student.name)}::${normalizeText(student.room)}`, student);
        });
        const incoming = incomingBase.map(student => {
          const existing = student.code
            ? existingByCode.get(normalizeText(student.code))
            : existingByNameRoom.get(`${normalizeText(student.name)}::${normalizeText(student.room)}`);
          const keepPosition = mode === 'merge' && existing && student.position === 'Học viên' && isLeaderPosition(existing.position)
            ? existing.position
            : student.position;
          return {
            ...student,
            position: keepPosition,
            phone: student.phone || (mode === 'merge' ? existing?.phone || '' : ''),
            note: student.note || (mode === 'merge' ? existing?.note || '' : ''),
            updatedAt: now,
            updatedBy: record.meta.graderName
          };
        });
        const students = mode === 'replace' ? sortStudents(incoming) : mergeStudentLists(previous, incoming);
        const tombstones = tombstonesAfter(previous, students, record.meta.studentTombstones, now);
        let next: CourseRecord = {
          ...record,
          students,
          meta: { ...record.meta, studentsUpdatedAt: now, studentTombstones: tombstones }
        };
        next = withAudit(next, 'Nhập danh sách sinh viên', `${mode === 'replace' ? 'Thay thế' : 'Cập nhật'} ${incoming.length} sinh viên từ ${fileList.map(file => file.name).join(', ')}`);
        commit(() => next, { studentSelectedIds: [] });
        get().notify(`Đã nhập ${incoming.length} sinh viên${allErrors.length ? `, bỏ qua ${allErrors.length} lỗi/cảnh báo` : ''}.`, 'success');
      } finally {
        set({ importBusy: false });
      }
    },

    setStudentSearch: (value) => set({ studentSearch: String(value || '').slice(0, MAX_SEARCH) }),
    setStudentBuilding: (value) => set({ studentBuilding: value || 'ALL' }),
    setStudentRoom: (value) => set({ studentRoom: value || 'ALL' }),
    setStudentPlatoon: (value) => set({ studentPlatoon: value || 'ALL' }),
    setStudentTieuDoi: (value) => set({ studentTieuDoi: value || 'ALL' }),
    setStudentDaiDoi: (value) => set({ studentDaiDoi: value || 'ALL' }),
    setStudentMissing: (value) => set({ studentMissing: value || 'ALL' }),
    setStudentGroupMode: (value) => set({ studentGroupMode: value }),
    setStudentTab: (value) => set({ studentTab: value, studentSelectedIds: [] }),
    toggleStudentSelected: (id) => {
      const selected = get().studentSelectedIds;
      set({ studentSelectedIds: selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id] });
    },
    selectVisibleStudents: (ids) => set({ studentSelectedIds: ids }),
    clearStudentSelection: () => set({ studentSelectedIds: [] }),
    resetStudentFilters: () => set({
      studentSearch: '',
      studentBuilding: 'ALL',
      studentRoom: 'ALL',
      studentPlatoon: 'ALL',
      studentTieuDoi: 'ALL',
      studentDaiDoi: 'ALL',
      studentMissing: 'ALL',
      studentSelectedIds: []
    }),

    saveGraderName: (name) => {
      const graderName = String(name || '').trim() || 'Giảng viên';
      const now = new Date().toISOString();
      commit(record => ({
        ...record,
        meta: { ...record.meta, graderName, settingsUpdatedAt: now }
      }));
      get().notify('Đã lưu tên người chấm.', 'success');
    },

    toggleLock: () => {
      const record = get().record;
      const nextLocked = !record.meta.locked;
      const now = new Date().toISOString();
      let next: CourseRecord = {
        ...record,
        meta: {
          ...record.meta,
          locked: nextLocked,
          lockedAt: nextLocked ? now : '',
          lockedBy: nextLocked ? record.meta.graderName : ''
        }
      };
      next = withAudit(next, nextLocked ? 'Khóa sổ điểm' : 'Mở khóa sổ điểm', nextLocked ? `Khóa bởi ${record.meta.graderName}` : `Mở khóa bởi ${record.meta.graderName}`);
      commit(() => next, { selectedItemId: nextLocked ? null : get().selectedItemId });
      get().notify(nextLocked ? 'Đã khóa sổ điểm.' : 'Đã mở khóa sổ điểm.', 'success');
    },

    saveCloud: (config) => {
      if (!saveCloudConfig(config)) {
        get().notify('Không lưu được cấu hình trên thiết bị này.', 'error');
        return;
      }
      set({ cloudConfig: config });
      if (get().collabSettings.enabled) get().startCollab();
      get().notify(`Đã lưu cấu hình ${cloudProviderName(config)}.`, 'success');
    },

    testCloud: async (config) => {
      if (!saveCloudConfig(config)) {
        get().notify('Không lưu được cấu hình trên thiết bị này.', 'error');
        return;
      }
      set({ cloudConfig: config, cloudBusy: true, cloudStatus: { ok: true, message: 'Đang kiểm tra kết nối...' } });
      try {
        const status = await testCloudConnection(config);
        set({ cloudStatus: status, cloudBusy: false });
        get().notify(status.message, status.ok ? 'success' : 'error');
      } finally {
        set({ cloudBusy: false });
      }
    },

    pushCloud: async (config) => {
      if (!saveCloudConfig(config)) {
        get().notify('Không lưu được cấu hình trên thiết bị này.', 'error');
        return;
      }
      set({ cloudConfig: config });
      if (!isCloudConfigured(config)) {
        get().notify('Chưa điền đủ địa chỉ, mã truy cập và mã nhóm dữ liệu.', 'error');
        return;
      }
      flushSave();
      set({ cloudBusy: true, cloudStatus: { ok: true, message: `Đang đẩy dữ liệu lên ${cloudProviderName(config)}...` } });
      try {
        const status = await pushCourse(get().record, config);
        set({ cloudStatus: status });
        get().notify(status.message, status.ok ? 'success' : 'error');
      } finally {
        set({ cloudBusy: false });
      }
    },

    pullCloud: async (config) => {
      if (!requireUnlocked('Sổ điểm đã khóa. Hãy mở khóa trước khi kéo dữ liệu chia sẻ.')) return;
      if (!saveCloudConfig(config)) {
        get().notify('Không lưu được cấu hình trên thiết bị này.', 'error');
        return;
      }
      set({ cloudConfig: config });
      if (!isCloudConfigured(config)) {
        get().notify('Chưa điền đủ địa chỉ, mã truy cập và mã nhóm dữ liệu.', 'error');
        return;
      }
      const ok = await get().confirmAction({
        title: `Kéo dữ liệu từ ${cloudProviderName(config)}`,
        message: 'Tải bản mới nhất của khóa hiện tại và thay thế dữ liệu trên thiết bị?\nDữ liệu hiện tại sẽ được sao lưu trước khi thay thế.',
        confirmLabel: 'Kéo dữ liệu'
      });
      if (!ok) return;

      flushSave();
      set({ cloudBusy: true, cloudStatus: { ok: true, message: `Đang kéo dữ liệu từ ${cloudProviderName(config)}...` } });
      try {
        const result = await pullCourse(get().record.meta.id, config);
        if (!result.ok || !result.record) {
          set({ cloudStatus: result });
          get().notify(result.message, 'error');
          return;
        }
        createSnapshot(get().record, 'Trước khi kéo dữ liệu chia sẻ', true);
        const current = get().record;
        const now = new Date().toISOString();
        const remote = result.record;
        remote.meta.id = current.meta.id;
        remote.meta.updatedAt = now;
        remote.meta.settingsUpdatedAt = now;
        remote.meta.itemsUpdatedAt = now;
        remote.meta.studentsUpdatedAt = now;
        remote.savedAt = now;
        remote.items = normalizeItems(remote.items).map(item => ({ ...item, updatedAt: now, updatedBy: current.meta.graderName }));
        remote.students = normalizeStudents(remote.students).map(student => ({ ...student, updatedAt: now, updatedBy: current.meta.graderName }));
        const next = withAudit(remote, 'Đồng bộ chia sẻ', `Kéo dữ liệu khóa từ ${cloudProviderName(config)}`);
        set({ record: recalcRecord(normalizeRecord(next)), ...resetFiltersState() });
        persistNow(recalcRecord(normalizeRecord(next)), set, get);
        set({ cloudStatus: { ok: true, message: `Đã kéo dữ liệu từ ${cloudProviderName(config)}.` } });
        get().notify(`Đã đồng bộ dữ liệu từ ${cloudProviderName(config)}.`, 'success');
      } finally {
        set({ cloudBusy: false });
      }
    },

    toggleCollab: (displayName = '') => {
      if (collabSession) {
        get().collabSettings.enabled = false;
        saveCollabSettings(get().collabSettings);
        get().stopCollab();
        get().notify('Đã tắt cộng tác nhóm.', 'success');
        return;
      }
      if (!isCloudConfigured(get().cloudConfig)) {
        get().closeModal();
        get().openModal('cloud');
        get().notify('Hãy cấu hình kết nối trước khi bật cộng tác.', 'error');
        return;
      }
      const name = String(displayName || '').trim();
      if (name) get().collabSettings.displayName = name;
      get().collabSettings.enabled = true;
      saveCollabSettings(get().collabSettings);
      get().startCollab();
      get().notify('Đã bật cộng tác nhóm.', 'success');
    },

    startCollab: () => {
      const config = get().cloudConfig;
      if (!isCloudConfigured(config)) {
        set({ collabStatus: null });
        return;
      }
      if (collabSession) {
        const old = collabSession;
        collabSession = null;
        old.stop();
      }
      cancelScheduledCloudPush();
      const displayName = get().collabSettings.displayName || get().record.meta.graderName || 'Giảng viên';
      set({
        collabStatus: {
          state: 'connecting',
          message: `Đang kết nối tới ${config.provider === 'local' ? 'máy chủ' : 'Supabase'}...`,
          users: [],
          lastSyncAt: '',
          realtime: false
        }
      });
      collabSession = new CollabSession({
        config,
        courseId: get().record.meta.id,
        displayName,
        getLocalRecord: () => get().record,
        onStatus: status => set({ collabStatus: status }),
        onRemoteRecord: async (remote, info) => {
          const local = get().record;
          const localPristine = isRecordPristine(local);
          if (info.initial && !localPristine && isRecordPristine(remote)) {
            collabSession?.schedulePush(local);
            return;
          }
          let target = remote;
          let localNewer = false;
          let remoteNewer = true;
          if (!(info.initial && localPristine)) {
            const merged = mergeCourseRecords(local, remote, { initial: info.initial });
            target = merged.record;
            localNewer = merged.localNewer;
            remoteNewer = merged.remoteNewer;
            if (!merged.changed) {
              if (localNewer) collabSession?.schedulePush(local);
              return;
            }
          }
          target.meta.id = local.meta.id;
          target.meta.graderName = local.meta.graderName;
          const normalized = recalcRecord(normalizeRecord(target));
          remoteApplying = true;
          try {
            set({ record: normalized });
            persistNow(normalized, set, get, { skipCloud: true });
          } finally {
            remoteApplying = false;
          }
          if (localNewer) collabSession?.schedulePush(get().record);
          if (remoteNewer) get().notify(info.initial ? 'Đã tải dữ liệu cộng tác mới nhất.' : 'Đã nhận cập nhật từ cộng tác viên.', 'info');
        }
      });
      void collabSession.start();
    },

    stopCollab: () => {
      if (collabSession) {
        collabSession.stop();
        collabSession = null;
      }
      set({ collabStatus: null });
    },

    saveCollabName: (name) => {
      const displayName = String(name || '').trim() || 'Giảng viên';
      get().collabSettings.displayName = displayName;
      saveCollabSettings(get().collabSettings);
      if (collabSession) collabSession.setDisplayName(displayName);
      get().notify('Đã lưu tên hiển thị cộng tác.', 'success');
    },

    pullCollabNow: async () => {
      if (!collabSession) {
        get().notify('Cộng tác chưa bật. Hãy bật cộng tác trước.', 'error');
        return;
      }
      const status = await collabSession.pullNow(false);
      get().notify(status.message, status.ok ? 'success' : 'error');
    },

    pushCollabNow: async () => {
      if (!collabSession) {
        get().notify('Cộng tác chưa bật. Hãy bật cộng tác trước.', 'error');
        return;
      }
      flushSave();
      const status = await collabSession.pushNow(get().record);
      get().notify(status.message, status.ok ? 'success' : 'error');
    },

    notify: (message, tone = 'info', action) => {
      const id = ++toastSequence;
      if (toastTimer) clearTimeout(toastTimer);
      set({ toast: { id, message: String(message || ''), tone, action } });
      toastTimer = setTimeout(() => {
        if (get().toast?.id === id) set({ toast: null });
        toastTimer = null;
      }, action ? 7000 : 3600);
    },
    dismissToast: () => {
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = null;
      set({ toast: null });
    },

    confirmAction: (options) => new Promise<boolean>(resolve => {
      set({
        confirm: {
          title: options.title,
          message: options.message,
          confirmLabel: options.confirmLabel || 'Xác nhận',
          danger: Boolean(options.danger),
          resolve
        }
      });
    }),
    resolveConfirm: (value) => {
      const confirm = get().confirm;
      set({ confirm: null });
      if (confirm) confirm.resolve(value);
    },

    flush: () => flushSave()
  };
});

export function selectVisibleItems(state: Pick<AppState, 'record' | 'search' | 'building'>): PlatoonItem[] {
  return filteredItems(state.record, state.search, state.building);
}

export function selectBuildings(record: CourseRecord): string[] {
  return Array.from(new Set((record.items as PlatoonItem[]).map(item => item.building).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'vi'));
}

export function selectStats(record: CourseRecord) {
  return calculateScoreStats(record.items, record.meta.baseScore);
}

export function selectSelectedItem(state: Pick<AppState, 'record' | 'selectedItemId'>): PlatoonItem | null {
  return (state.record.items as PlatoonItem[]).find(item => item.id === state.selectedItemId) || null;
}

export function selectFilteredStudents(state: Pick<AppState,
  'record' | 'studentSearch' | 'studentBuilding' | 'studentRoom' | 'studentPlatoon' | 'studentTieuDoi' | 'studentDaiDoi' | 'studentMissing'
>): Student[] {
  const query = normalizeText(state.studentSearch);
  return sortStudents(state.record.students.filter(student => {
    if (state.studentBuilding !== 'ALL' && student.building !== state.studentBuilding) return false;
    if (state.studentMissing !== 'ALL' && String(student[state.studentMissing] || '').trim()) return false;
    if (state.studentRoom === '__none__') {
      if (student.room) return false;
    } else if (state.studentRoom !== 'ALL' && student.room !== state.studentRoom) return false;
    if (state.studentDaiDoi === '__none__') {
      if (student.daiDoi) return false;
    } else if (state.studentDaiDoi !== 'ALL' && student.daiDoi !== state.studentDaiDoi) return false;
    if (state.studentPlatoon === '__none__') {
      if (student.trungDoi) return false;
    } else if (state.studentPlatoon !== 'ALL' && student.trungDoi !== state.studentPlatoon) return false;
    if (state.studentTieuDoi === '__none__') {
      if (student.tieuDoi) return false;
    } else if (state.studentTieuDoi !== 'ALL' && student.tieuDoi !== state.studentTieuDoi) return false;
    if (!query) return true;
    return normalizeText([
      student.name,
      student.code,
      student.room,
      student.building,
      unitCode('daiDoi', student.daiDoi),
      unitCode('trungDoi', student.trungDoi),
      unitCode('tieuDoi', student.tieuDoi),
      student.daiDoi,
      student.trungDoi,
      student.tieuDoi,
      student.position,
      student.phone,
      student.className,
      student.school,
      student.birthDate,
      student.hometown,
      student.gender,
      student.ethnicity,
      student.cccd,
      student.note
    ].join(' ')).includes(query);
  }));
}

export function selectStudentFacets(record: CourseRecord) {
  const students = record.students;
  const buildings = Array.from(new Set(students.map(student => student.building).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi'));
  const rooms = Array.from(new Set(students.map(student => student.room).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
  const daiDois = Array.from(new Set(students.map(student => student.daiDoi).filter(Boolean))).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b, 'vi'));
  const platoons = Array.from(new Set(students.map(student => student.trungDoi).filter(Boolean))).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b, 'vi'));
  const tieuDois = Array.from(new Set(students.map(student => student.tieuDoi).filter(Boolean))).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b, 'vi'));
  return { buildings, rooms, daiDois, platoons, tieuDois };
}

export function selectStudentStats(record: CourseRecord) {
  const students = record.students;
  return {
    total: students.length,
    leaders: students.filter(student => isLeaderPosition(student.position)).length,
    noRoom: students.filter(student => !student.room).length,
    noPlatoon: students.filter(student => !student.trungDoi).length,
    noDaiDoi: students.filter(student => !student.daiDoi).length,
    missingCccd: students.filter(student => !String(student.cccd || '').trim()).length,
    missingHometown: students.filter(student => !String(student.hometown || '').trim()).length
  };
}

export function selectCourseContext(record: CourseRecord) {
  return {
    courseName: record.meta.courseName,
    unitName: record.meta.unitName,
    baseScore: record.meta.baseScore,
    date: `${String(record.meta.ngay).padStart(2, '0')}/${String(record.meta.thang).padStart(2, '0')}/${record.meta.nam}`,
    locked: record.meta.locked,
    graderName: record.meta.graderName
  };
}

export function newStudentId(): string {
  return `sv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function newCourseRecordId(): string {
  return newCourseId();
}

export const APP_INFO = { id: APP_ID, version: APP_VERSION, currentCourseKey: getCurrentCourseId, readCourseIndex };
