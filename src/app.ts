import {
  DEFAULT_META,
  PLATOONS_PRESET,
  PHOTO_SAMPLE_DATA,
  SHEET_ALIASES,
  SHEET_PREVIEW_COLUMNS
} from './constants';
import {
  clampInt,
  round1,
  toNumber,
  formatNum,
  normalizeText,
  escapeHtml,
  formatNoteHtml,
  pad2,
  slugify,
  isNumericDraft,
  normalizeQuanSo,
  readFileAsText,
  downloadFile
} from './utils';
import { parseSheetText, parseSheetFile } from './parsers';
import { recalculateScores, calculateScoreStats } from './scoring';
import { mergeCourseRecords } from './merge';
import {
    CollabSession,
    loadCollabSettings,
    saveCollabSettings,
    type CollabStatus,
    type CollabUser
} from './collab';
import {
    normalizeStudents,
    normalizeStudentTombstones,
    sortStudents,
    groupStudentsByRoom,
    groupStudentsByPlatoon,
    parseStudentRows,
    mergeStudentLists,
    studentCSV,
    normalizePosition,
    countStudentsForPlatoon,
    isLeaderPosition,
    LEADER_POSITIONS,
    STUDENT_POSITIONS,
    type Student
} from './students';
import {
  createAuditEntry,
  appendAuditEntry,
  type AuditEntry
} from './audit';
import {
  loadCloudConfig,
  saveCloudConfig,
  isCloudConfigured,
  testCloudConnection,
  pushCourse,
  pullCourse,
  scheduleCloudPush,
  type CloudConfig,
  type CloudStatus
} from './cloudSync';
import {
  createSnapshot,
  maybeAutoSnapshot,
  listSnapshots,
  getSnapshot,
  deleteSnapshot,
  type CourseSnapshot
} from './backup';
import {
  APP_ID,
  APP_VERSION,
  type CourseRecord,
  type CourseSummary,
  readCourseIndex,
  saveCourseIndex,
  loadCourseRecord,
  saveCourseRecord,
  deleteCourseRecord,
  getCurrentCourseId,
  setCurrentCourseId,
  summarizeRecord,
  makeDefaultRecord,
  cloneRecord,
  newCourseId,
  readJson,
  writeJson,
  MAPPING_KEY,
  SETTINGS_KEY,
  snapshotKey
} from './courseStore';

// ============================================================
// APP CONFIG, STORAGE & STATE
// ============================================================

// Vùng lưu riêng theo đường dẫn/tên file để nhiều bản deploy hoặc nhiều khóa không ghi đè nhau.
const STORAGE_PAGE = (() => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || 'index';
    const fileName = last.replace(/\.html?$/i, '');
    const pageName = fileName.toLowerCase() === 'index' && parts.length > 1
        ? parts[parts.length - 2]
        : fileName;
    return slugify(pageName).slice(0, 60);
})();
const IS_ORIGINAL_PAGE = /^337$/i.test(STORAGE_PAGE);
const STORAGE_KEY = `THI_DUA_GDQPAN_V2:${STORAGE_PAGE}`;
const PREVIOUS_STORAGE_KEY = 'THI_DUA_GDQPAN_V2';
const LEGACY_STORAGE_KEY = 'THI_DUA_K337_DATA';
const LEGACY_PAGE_STORAGE_KEYS = ['THI_DUA_GDQPAN_V2:index'];

const state: any = {
    baseScore: DEFAULT_META.baseScore,
    courseName: DEFAULT_META.courseName,
    unitName: DEFAULT_META.unitName,
    date: {
        ngay: DEFAULT_META.ngay,
        thang: DEFAULT_META.thang,
        nam: DEFAULT_META.nam
    },
    autoNegative: true,
    activeBuilding: 'ALL',
    searchQuery: '',
    viewMode: 'cards',
    activeItemId: null,
    activeModalIndex: -1,
    items: [],
    courseId: '',
    courseList: [] as CourseSummary[],
    createdAt: '',
    locked: false,
    lockedAt: '',
    lockedBy: '',
    graderName: 'Giảng viên',
    audit: [] as AuditEntry[],
    students: [] as Student[],
    studentsUpdatedAt: '',
    studentTombstones: {} as Record<string, string>,
    itemsUpdatedAt: '',
    settingsUpdatedAt: '',
    revision: 1,
    applyingRemote: false,
    drawerOriginal: null as any,
    cloudConfig: null as CloudConfig | null,
    collabSettings: { enabled: false, displayName: '' },
    collabSession: null as CollabSession | null,
    collabStatus: null as CollabStatus | null
};

// DOM Elements
const elements: Record<string, any> = {
    appTitle: document.getElementById('appTitle'),
    appSubtitle: document.getElementById('appSubtitle'),
    courseSelect: document.getElementById('courseSelect'),
    baseScoreLabel: document.getElementById('baseScoreLabel'),
    inputNgay: document.getElementById('inputNgay'),
    inputThang: document.getElementById('inputThang'),
    inputNam: document.getElementById('inputNam'),
    btnToday: document.getElementById('btnToday'),
    saveStatus: document.getElementById('saveStatus'),
    saveStatusText: document.getElementById('saveStatusText'),
    offlineBadge: document.getElementById('offlineBadge'),

    cardsList: document.getElementById('cardsList'),
    tableCard: document.getElementById('tableCard'),
    tableBody: document.getElementById('tableBody'),
    listCount: document.getElementById('listCount'),
    searchInput: document.getElementById('searchInput'),
    btnClearSearch: document.getElementById('btnClearSearch'),
    btnAutoNegative: document.getElementById('btnAutoNegative'),
    btnToggleView: document.getElementById('btnToggleView'),
    viewModeLabel: document.getElementById('viewModeLabel'),
    btnMenuToggle: document.getElementById('btnMenuToggle'),
    dropdownMenu: document.getElementById('dropdownMenu'),
    buildingPills: document.getElementById('buildingPills'),
    gradingDrawer: document.getElementById('gradingDrawer'),

    // Stats
    statQuanSo: document.getElementById('statQuanSo'),
    statAvgScore: document.getElementById('statAvgScore'),
    statPerfect: document.getElementById('statPerfect'),
    statDeducted: document.getElementById('statDeducted'),

    // Drawer
    drawerBody: document.querySelector('.drawer-body'),
    drawerPName: document.getElementById('drawerPName'),
    drawerPRooms: document.getElementById('drawerPRooms'),
    drawerScoreVal: document.getElementById('drawerScoreVal'),
    drawerRankVal: document.getElementById('drawerRankVal'),
    drawerQuanSo: document.getElementById('drawerQuanSo'),
    drawerHocTap: document.getElementById('drawerHocTap'),
    drawerRenLuyen: document.getElementById('drawerRenLuyen'),
    drawerNvvs: document.getElementById('drawerNvvs'),
    drawerLeTiet: document.getElementById('drawerLeTiet'),
    drawerNote: document.getElementById('drawerNote'),
    btnPrevPlatoon: document.getElementById('btnPrevPlatoon'),
    btnNextPlatoon: document.getElementById('btnNextPlatoon'),
    btnCloseDrawer: document.getElementById('btnCloseDrawer'),
    btnSaveNext: document.getElementById('btnSaveNext'),

    // Course manager
    courseModal: document.getElementById('courseModal'),
    courseListEl: document.getElementById('courseList'),
    newCourseName: document.getElementById('newCourseName'),
    btnOpenCourses: document.getElementById('btnOpenCourses'),
    btnCloseCourses: document.getElementById('btnCloseCourses'),
    btnCloseCoursesFooter: document.getElementById('btnCloseCoursesFooter'),
    btnCreateCourse: document.getElementById('btnCreateCourse'),
    btnCloneCourse: document.getElementById('btnCloneCourse'),

    // Students & leaders
    studentsModal: document.getElementById('studentsModal'),
    studentEditor: document.getElementById('studentEditor'),
    studentEditorTitle: document.getElementById('studentEditorTitle'),
    studentEditId: document.getElementById('studentEditId'),
    studentName: document.getElementById('studentName'),
    studentCode: document.getElementById('studentCode'),
    studentBuilding: document.getElementById('studentBuilding'),
    studentRoom: document.getElementById('studentRoom'),
    studentTieuDoi: document.getElementById('studentTieuDoi'),
    studentTrungDoi: document.getElementById('studentTrungDoi'),
    studentPosition: document.getElementById('studentPosition'),
    studentPhone: document.getElementById('studentPhone'),
    studentNote: document.getElementById('studentNote'),
    studentClassName: document.getElementById('studentClassName'),
    studentSchool: document.getElementById('studentSchool'),
    studentBirthDate: document.getElementById('studentBirthDate'),
    studentHometown: document.getElementById('studentHometown'),
    studentGender: document.getElementById('studentGender'),
    studentEthnicity: document.getElementById('studentEthnicity'),
    studentCccd: document.getElementById('studentCccd'),
    studentExtraFields: document.getElementById('studentExtraFields'),
    studentStatus: document.getElementById('studentStatus'),
    studentListStatus: document.getElementById('studentListStatus'),
    studentGroupRoom: document.getElementById('studentGroupRoom'),
    studentGroupPlatoon: document.getElementById('studentGroupPlatoon'),
    studentQuickAll: document.getElementById('studentQuickAll'),
    studentQuickLeaders: document.getElementById('studentQuickLeaders'),
    studentQuickNoRoom: document.getElementById('studentQuickNoRoom'),
    studentQuickNoPlatoon: document.getElementById('studentQuickNoPlatoon'),
    studentSearch: document.getElementById('studentSearch'),
    studentBuildingFilter: document.getElementById('studentBuildingFilter'),
    studentRoomFilter: document.getElementById('studentRoomFilter'),
    studentPlatoonFilter: document.getElementById('studentPlatoonFilter'),
    studentTieuDoiFilter: document.getElementById('studentTieuDoiFilter'),
    studentImportMode: document.getElementById('studentImportMode'),
    studentBulkBar: document.getElementById('studentBulkBar'),
    studentSelectedCount: document.getElementById('studentSelectedCount'),
    btnSelectVisible: document.getElementById('btnSelectVisible'),
    studentBulkPosition: document.getElementById('studentBulkPosition'),
    btnBulkAssign: document.getElementById('btnBulkAssign'),
    btnBulkDelete: document.getElementById('btnBulkDelete'),
    btnBulkClear: document.getElementById('btnBulkClear'),
    studentFileInput: document.getElementById('studentFileInput'),
    studentSummary: document.getElementById('studentSummary'),
    studentRoomList: document.getElementById('studentRoomList'),
    leaderListPanel: document.getElementById('leaderListPanel'),
    studentListPanel: document.getElementById('studentListPanel'),
    leaderSummary: document.getElementById('leaderSummary'),
    leaderList: document.getElementById('leaderList'),
    tabStudents: document.getElementById('tabStudents'),
    tabLeaders: document.getElementById('tabLeaders'),
    btnOpenStudents: document.getElementById('btnOpenStudents'),
    btnCloseStudents: document.getElementById('btnCloseStudents'),
    btnCloseStudentsFooter: document.getElementById('btnCloseStudentsFooter'),
    btnAddStudent: document.getElementById('btnAddStudent'),
    btnImportStudents: document.getElementById('btnImportStudents'),
    btnExportStudents: document.getElementById('btnExportStudents'),
    btnAddLeader: document.getElementById('btnAddLeader'),
    btnExportLeaders: document.getElementById('btnExportLeaders'),
    btnCancelStudent: document.getElementById('btnCancelStudent'),
    btnSaveStudent: document.getElementById('btnSaveStudent'),
    btnSaveStudentNext: document.getElementById('btnSaveStudentNext'),

    // Backups
    backupModal: document.getElementById('backupModal'),
    backupListEl: document.getElementById('backupList'),
    btnOpenBackups: document.getElementById('btnOpenBackups'),
    btnCloseBackups: document.getElementById('btnCloseBackups'),
    btnCloseBackupsFooter: document.getElementById('btnCloseBackupsFooter'),
    btnCreateBackup: document.getElementById('btnCreateBackup'),

    // Cloud sync
    cloudModal: document.getElementById('cloudModal'),
    cloudUrl: document.getElementById('cloudUrl'),
    cloudAnonKey: document.getElementById('cloudAnonKey'),
    cloudTable: document.getElementById('cloudTable'),
    cloudSyncId: document.getElementById('cloudSyncId'),
    cloudAutoPush: document.getElementById('cloudAutoPush'),
    cloudStatus: document.getElementById('cloudStatus'),
    btnOpenCloud: document.getElementById('btnOpenCloud'),
    btnCloseCloud: document.getElementById('btnCloseCloud'),
    btnCloseCloudFooter: document.getElementById('btnCloseCloudFooter'),
    btnCloudSave: document.getElementById('btnCloudSave'),
    btnCloudTest: document.getElementById('btnCloudTest'),
    btnCloudPush: document.getElementById('btnCloudPush'),
    btnCloudPull: document.getElementById('btnCloudPull'),

    // Collaboration
    collabModal: document.getElementById('collabModal'),
    collabStatusCard: document.getElementById('collabStatusCard'),
    collabDot: document.getElementById('collabDot'),
    collabStatusTitle: document.getElementById('collabStatusTitle'),
    collabStatusText: document.getElementById('collabStatusText'),
    collabLastSync: document.getElementById('collabLastSync'),
    collabConfigLine: document.getElementById('collabConfigLine'),
    collabDisplayName: document.getElementById('collabDisplayName'),
    collabSyncId: document.getElementById('collabSyncId'),
    collabUserCount: document.getElementById('collabUserCount'),
    collabUsers: document.getElementById('collabUsers'),
    btnOpenCollab: document.getElementById('btnOpenCollab'),
    btnCloseCollab: document.getElementById('btnCloseCollab'),
    btnCloseCollabFooter: document.getElementById('btnCloseCollabFooter'),
    btnCollabToggle: document.getElementById('btnCollabToggle'),
    btnCollabSaveName: document.getElementById('btnCollabSaveName'),
    btnCollabPull: document.getElementById('btnCollabPull'),
    btnCollabPush: document.getElementById('btnCollabPush'),
    btnCollabConfig: document.getElementById('btnCollabConfig'),
    collabIndicator: document.getElementById('collabIndicator'),
    collabIndicatorText: document.getElementById('collabIndicatorText'),

    // Audit / lock
    auditModal: document.getElementById('auditModal'),
    auditListEl: document.getElementById('auditList'),
    btnOpenAudit: document.getElementById('btnOpenAudit'),
    btnCloseAudit: document.getElementById('btnCloseAudit'),
    btnCloseAuditFooter: document.getElementById('btnCloseAuditFooter'),
    btnToggleLock: document.getElementById('btnToggleLock'),
    btnSaveGrader: document.getElementById('btnSaveGrader'),
    btnExportAudit: document.getElementById('btnExportAudit'),
    auditGraderName: document.getElementById('auditGraderName'),
    lockStatusText: document.getElementById('lockStatusText'),
    lockStatusDetail: document.getElementById('lockStatusDetail'),
    lockBadge: document.getElementById('lockBadge'),
    lockNotice: document.getElementById('lockNotice'),
    drawerLockNotice: document.getElementById('drawerLockNotice'),

    // Settings & Help
    settingsModal: document.getElementById('settingsModal'),
    setCourseName: document.getElementById('setCourseName'),
    setUnitName: document.getElementById('setUnitName'),
    setBaseScore: document.getElementById('setBaseScore'),
    setNgay: document.getElementById('setNgay'),
    setThang: document.getElementById('setThang'),
    setNam: document.getElementById('setNam'),
    setPlatoons: document.getElementById('setPlatoons'),
    settingsError: document.getElementById('settingsError'),
    btnCloseSettings: document.getElementById('btnCloseSettings'),
    btnCancelSettings: document.getElementById('btnCancelSettings'),
    btnSaveSettings: document.getElementById('btnSaveSettings'),
    btnRestorePresetList: document.getElementById('btnRestorePresetList'),
    helpModal: document.getElementById('helpModal'),
    btnCloseHelp: document.getElementById('btnCloseHelp'),
    btnCloseHelpFooter: document.getElementById('btnCloseHelpFooter'),

    // Excel / Google Sheets import
    sheetModal: document.getElementById('sheetModal'),
    btnOpenSheet: document.getElementById('btnImportSheet'),
    btnCloseSheet: document.getElementById('btnCloseSheet'),
    btnCancelSheet: document.getElementById('btnCancelSheet'),
    btnApplySheet: document.getElementById('btnApplySheet'),
    btnSheetSample: document.getElementById('btnSheetSample'),
    tabSheetFile: document.getElementById('tabSheetFile'),
    tabSheetPaste: document.getElementById('tabSheetPaste'),
    sheetFilePanel: document.getElementById('sheetFilePanel'),
    sheetPastePanel: document.getElementById('sheetPastePanel'),
    sheetFileInput: document.getElementById('sheetFileInput'),
    btnChooseSheetFile: document.getElementById('btnChooseSheetFile'),
    sheetFileName: document.getElementById('sheetFileName'),
    sheetSelectField: document.getElementById('sheetSelectField'),
    sheetSelect: document.getElementById('sheetSelect'),
    sheetPasteInput: document.getElementById('sheetPasteInput'),
    sheetMode: document.getElementById('sheetMode'),
    sheetHasHeader: document.getElementById('sheetHasHeader'),
    sheetError: document.getElementById('sheetError'),
    sheetPreviewTitle: document.getElementById('sheetPreviewTitle'),
    sheetPreviewTable: document.getElementById('sheetPreviewTable'),
    sheetSummary: document.getElementById('sheetSummary'),
    sheetMappingGrid: document.getElementById('sheetMappingGrid'),
    mappingName: document.getElementById('mappingName'),
    btnSaveMapping: document.getElementById('btnSaveMapping'),
    mappingPresetSelect: document.getElementById('mappingPresetSelect'),
    btnApplyMapping: document.getElementById('btnApplyMapping'),
    btnDeleteMapping: document.getElementById('btnDeleteMapping'),

    // Import / export / print
    importFile: document.getElementById('importFile'),
    btnImportJSON: document.getElementById('btnImportJSON'),
    btnExportJSON: document.getElementById('btnExportJSON'),
    btnExportCSV: document.getElementById('btnExportCSV'),
    btnPrintReport: document.getElementById('btnPrintReport'),
    printUnit: document.getElementById('printUnit'),
    printCourse: document.getElementById('printCourse'),
    printNgay: document.getElementById('printNgay'),
    printThang: document.getElementById('printThang'),
    printNam: document.getElementById('printNam'),
    printTableBody: document.getElementById('printTableBody'),

    // Dialog & Toast
    customDialog: document.getElementById('customDialog'),
    dialogTitle: document.getElementById('dialogTitle'),
    dialogMessage: document.getElementById('dialogMessage'),
    dialogInput: document.getElementById('dialogInput'),
    btnDialogCancel: document.getElementById('btnDialogCancel'),
    btnDialogConfirm: document.getElementById('btnDialogConfirm'),
    toastMsg: document.getElementById('toastMsg'),
    toastText: document.getElementById('toastText'),
    toastAction: document.getElementById('toastAction')
};

function dateToken() {
            return `${state.date.nam}-${pad2(state.date.thang)}-${pad2(state.date.ngay)}`;
        }

function parseScoreVal(value) {
            let num = parseFloat(String(value === undefined || value === null ? '' : value).replace(',', '.'));
            if (!Number.isFinite(num)) return 0;
            if (state.autoNegative && num > 0) num = -num;
            return round1(num);
        }

let renderTimer = null;
let sheetImportState = null;
let sheetParseTimer = null;
let sheetSource = 'file';

interface MappingPreset {
    id: string;
    name: string;
    map: Record<string, number>;
    hasHeader: boolean;
    headerIndex?: number;
    createdAt: string;
}

// ============================================================
// DATA MODEL & PERSISTENCE
// ============================================================
function createDefaultItems() {
    return PLATOONS_PRESET.map(preset => ({
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
    }));
}

function normalizeItem(raw, preset = null) {
    if (!raw || typeof raw !== 'object') return null;
    const id = Number(raw.id);
    if (!Number.isInteger(id) || id <= 0) return null;

    const building = String(raw.building !== undefined ? raw.building : (preset ? preset.building : '')).trim();
    const rooms = String(raw.rooms !== undefined ? raw.rooms : (preset ? preset.rooms : '')).trim();
    const quanSoRaw = String(raw.quanSo !== undefined ? raw.quanSo : (preset ? preset.defaultQuanSo : '')).trim();
    const normalizedQuanSo = normalizeQuanSo(quanSoRaw);

    return {
        id: id,
        building: building,
        rooms: rooms,
        quanSo: normalizedQuanSo === null ? '' : normalizedQuanSo,
        hocTap: round1(toNumber(raw.hocTap)),
        renLuyen: round1(toNumber(raw.renLuyen)),
        nvvs: round1(toNumber(raw.nvvs)),
        leTiet: round1(toNumber(raw.leTiet)),
        note: String(raw.note !== undefined && raw.note !== null ? raw.note : '').trim(),
        totalScore: 0,
        rank: 1,
        updatedAt: String(raw.updatedAt || ''),
        updatedBy: String(raw.updatedBy || '')
    };
}

function applyMetaValues(meta) {
    if (!meta || typeof meta !== 'object') return;

    if (typeof meta.courseName === 'string' && meta.courseName.trim()) {
        state.courseName = meta.courseName.trim();
    }
    if (typeof meta.unitName === 'string' && meta.unitName.trim()) {
        state.unitName = meta.unitName.trim();
    }
    const baseScore = Number(meta.baseScore);
    if (Number.isFinite(baseScore) && baseScore > 0) {
        state.baseScore = round1(baseScore);
    }

    const dateSource = (meta.date && typeof meta.date === 'object') ? meta.date : meta;
    if (dateSource.ngay !== undefined) state.date.ngay = clampInt(dateSource.ngay, 1, 31, state.date.ngay);
    if (dateSource.thang !== undefined) state.date.thang = clampInt(dateSource.thang, 1, 12, state.date.thang);
    if (dateSource.nam !== undefined) state.date.nam = clampInt(dateSource.nam, 2000, 2100, state.date.nam);

    if (typeof meta.autoNegative === 'boolean') state.autoNegative = meta.autoNegative;
    if (meta.viewMode === 'cards' || meta.viewMode === 'table') state.viewMode = meta.viewMode;
    if (typeof meta.activeBuilding === 'string' && meta.activeBuilding) state.activeBuilding = meta.activeBuilding;
}

function normalizeItems(rawItems: any[]): any[] {
    const items: any[] = [];
    const seenIds = new Set<number>();

    (Array.isArray(rawItems) ? rawItems : []).forEach(raw => {
        const item = normalizeItem(raw);
        if (item && !seenIds.has(item.id)) {
            seenIds.add(item.id);
            items.push(item);
        }
    });

    return items;
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

function createRecordFromLegacy(payload: any): CourseRecord {
    const meta = (!Array.isArray(payload) && payload && payload.meta && typeof payload.meta === 'object')
        ? payload.meta
        : {};
    const rawItems = Array.isArray(payload) ? payload : (payload && payload.items);
    const items = normalizeItems(rawItems);
    const now = new Date().toISOString();
    const baseScore = Number(meta.baseScore);

    return {
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
    };
}

function applyCourseRecord(record: CourseRecord): void {
    state.courseId = record.meta.id;
    state.createdAt = record.meta.createdAt || record.savedAt || new Date().toISOString();
    state.locked = Boolean(record.meta.locked);
    state.lockedAt = record.meta.lockedAt || '';
    state.lockedBy = record.meta.lockedBy || '';
    state.graderName = record.meta.graderName || 'Giảng viên';
    applyMetaValues(record.meta);
    state.audit = Array.isArray(record.audit) ? record.audit.slice(-1000) : [];
    state.students = sortStudents(normalizeStudents(record.students));
    state.settingsUpdatedAt = record.meta.settingsUpdatedAt || record.meta.updatedAt || record.savedAt || new Date().toISOString();
    state.itemsUpdatedAt = record.meta.itemsUpdatedAt || record.meta.updatedAt || record.savedAt || new Date().toISOString();
    state.studentsUpdatedAt = record.meta.studentsUpdatedAt || record.meta.updatedAt || record.savedAt || new Date().toISOString();
    state.studentTombstones = normalizeStudentTombstones(record.meta.studentTombstones);
    state.revision = Number(record.meta.revision) || 1;

    const items = normalizeItems(record.items);
    state.items = items.length ? items : createDefaultItems();
}

function loadSavedData() {
    const index = readCourseIndex();
    state.courseList = index;

    if (index.length) {
        const currentId = getCurrentCourseId();
        const target = index.find(course => course.id === currentId) || index[0];
        const record = loadCourseRecord(target.id);

        if (record) {
            applyCourseRecord(record);
            setCurrentCourseId(record.meta.id);
            return;
        }

        // Bỏ các mục index bị thiếu dữ liệu.
        state.courseList = index.filter(course => Boolean(loadCourseRecord(course.id)));
        if (state.courseList.length) {
            saveCourseIndex(state.courseList);
            const firstRecord = loadCourseRecord(state.courseList[0].id);
            if (firstRecord) {
                applyCourseRecord(firstRecord);
                setCurrentCourseId(firstRecord.meta.id);
                return;
            }
        }
    }

    const legacy = findLegacyPayload();
    const record = legacy ? createRecordFromLegacy(legacy.payload) : makeDefaultRecord();
    state.courseList = [summarizeRecord(record)];
    applyCourseRecord(record);
    saveCourseRecord(record);
    saveCourseIndex(state.courseList);
    setCurrentCourseId(record.meta.id);
}

function buildPayload(): CourseRecord {
    const now = new Date().toISOString();
    return {
        app: APP_ID,
        version: APP_VERSION,
        savedAt: now,
        meta: {
            id: state.courseId,
            courseName: state.courseName,
            unitName: state.unitName,
            baseScore: state.baseScore,
            ngay: state.date.ngay,
            thang: state.date.thang,
            nam: state.date.nam,
            autoNegative: state.autoNegative,
            viewMode: state.viewMode,
            activeBuilding: state.activeBuilding,
            locked: Boolean(state.locked),
            lockedAt: state.lockedAt || '',
            lockedBy: state.lockedBy || '',
            graderName: state.graderName || 'Giảng viên',
            createdAt: state.createdAt || now,
            updatedAt: now,
            settingsUpdatedAt: state.settingsUpdatedAt || now,
            itemsUpdatedAt: state.itemsUpdatedAt || now,
            studentsUpdatedAt: state.studentsUpdatedAt || now,
            studentTombstones: state.studentTombstones || {},
            revision: Number(state.revision || 1)
        },
        items: state.items,
        students: state.students,
        audit: Array.isArray(state.audit) ? state.audit.slice(-1000) : []
    };
}

function updateCourseSummary(payload: CourseRecord): void {
    const summary = summarizeRecord(payload);
    const index = state.courseList.findIndex(course => course.id === summary.id);
    if (index >= 0) {
        state.courseList[index] = summary;
    } else {
        state.courseList.push(summary);
    }
    state.courseList.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function updateSaveStatus(ok) {
    if (!elements.saveStatus || !elements.saveStatusText) return;
    const now = new Date();
    const time = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    elements.saveStatus.classList.toggle('error', !ok);
    elements.saveStatusText.textContent = ok
        ? `Đã lưu tự động lúc ${time}`
        : 'Không thể lưu dữ liệu trên thiết bị này';
}

function saveData() {
    if (!state.courseId) return false;

    const payload = buildPayload();
    if (!saveCourseRecord(payload)) {
        updateSaveStatus(false);
        return false;
    }

    updateCourseSummary(payload);
    saveCourseIndex(state.courseList);
    setCurrentCourseId(state.courseId);
    updateSaveStatus(true);
    maybeAutoSnapshot(payload);
    if (state.collabSession && state.collabSettings.enabled) {
        if (!state.applyingRemote) state.collabSession.schedulePush(payload);
    } else if (state.cloudConfig && !state.applyingRemote) {
        scheduleCloudPush(payload, state.cloudConfig, status => {
            if (!status.ok && elements.cloudModal && elements.cloudModal.classList.contains('open')) {
                setCloudStatus(status);
            }
        });
    }
    return true;
}

function updatePrintDate() {
    if (!elements.printNgay) return;
    elements.printNgay.textContent = state.date.ngay;
    elements.printThang.textContent = state.date.thang;
    elements.printNam.textContent = state.date.nam;
}

function applyMetaToUI() {
    elements.appTitle.textContent = `TỔ THI ĐUA - ${state.courseName}`;
    elements.appSubtitle.textContent = state.unitName;
    document.title = `Bảng Thi Đua ${state.courseName} - ${state.unitName}`;
    elements.baseScoreLabel.textContent = `${formatNum(state.baseScore)}đ`;

    elements.inputNgay.value = state.date.ngay;
    elements.inputThang.value = state.date.thang;
    elements.inputNam.value = state.date.nam;

    elements.btnAutoNegative.classList.toggle('active', state.autoNegative);
    elements.btnAutoNegative.querySelector('span').textContent = state.autoNegative ? 'Tự âm (-)' : 'Tự do';
    elements.viewModeLabel.textContent = state.viewMode === 'cards' ? 'Xem Bảng' : 'Xem Thẻ';

    elements.printCourse.textContent = state.courseName;
    elements.printUnit.textContent = state.unitName;
    updatePrintDate();
    renderCourseSelect();
    renderLockUI();
}

// ============================================================
// COURSE MANAGEMENT
// ============================================================
function formatCourseDate(value: string): string {
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

function renderCourseSelect() {
    if (!elements.courseSelect) return;

    const list = state.courseList.length
        ? state.courseList
        : [{ id: state.courseId, courseName: state.courseName, unitName: state.unitName, itemCount: state.items.length, createdAt: state.createdAt, updatedAt: state.createdAt, locked: state.locked }];

    elements.courseSelect.innerHTML = list.map(course =>
        `<option value="${escapeHtml(course.id)}">${escapeHtml(course.courseName)}${course.locked ? ' (đã khóa)' : ''}</option>`
    ).join('');
    elements.courseSelect.value = state.courseId;
}

function renderCourseList() {
    if (!elements.courseListEl) return;

    if (!state.courseList.length) {
        elements.courseListEl.innerHTML = '<div class="empty-state">Chưa có khóa học nào.</div>';
        return;
    }

    elements.courseListEl.innerHTML = state.courseList.map(course => {
        const current = course.id === state.courseId;
        return `
            <div class="course-row ${current ? 'active' : ''}">
                <div class="course-row-main">
                    <div class="course-row-title">
                        ${escapeHtml(course.courseName)}
                        ${course.locked ? '<span class="course-lock">Đã khóa</span>' : ''}
                        ${current ? '<span class="course-current">Đang dùng</span>' : ''}
                    </div>
                    <div class="course-row-meta">
                        ${escapeHtml(course.unitName || 'Chưa có đơn vị')} · ${course.itemCount} trung đội
                        ${course.updatedAt ? ` · Cập nhật ${escapeHtml(formatCourseDate(course.updatedAt))}` : ''}
                    </div>
                </div>
                <div class="course-row-actions">
                    ${current ? '' : `<button type="button" class="btn-course" data-course-action="open" data-course-id="${escapeHtml(course.id)}">Mở</button>`}
                    <button type="button" class="btn-course" data-course-action="rename" data-course-id="${escapeHtml(course.id)}">Đổi tên</button>
                    <button type="button" class="btn-course" data-course-action="clone" data-course-id="${escapeHtml(course.id)}">Nhân bản</button>
                    <button type="button" class="btn-course danger" data-course-action="delete" data-course-id="${escapeHtml(course.id)}">Xóa</button>
                </div>
            </div>
        `;
    }).join('');
}

function openCourseModal() {
    renderCourseList();
    if (elements.newCourseName) elements.newCourseName.value = '';
    elements.courseModal.classList.add('open');
    setTimeout(() => elements.newCourseName && elements.newCourseName.focus(), 60);
}

function closeCourseModal() {
    elements.courseModal.classList.remove('open');
}

function activateCourseRecord(record: CourseRecord) {
    if (state.collabSession) {
        const oldSession = state.collabSession;
        const oldPayload = buildPayload();
        state.collabSession = null;
        void oldSession.pushNow(oldPayload);
        oldSession.stop();
        state.collabStatus = null;
    }
    applyCourseRecord(record);
    setCurrentCourseId(record.meta.id);
    state.searchQuery = '';
    state.activeItemId = null;
    state.activeModalIndex = -1;
    if (elements.searchInput) elements.searchInput.value = '';
    if (elements.btnClearSearch) elements.btnClearSearch.style.display = 'none';
    applyMetaToUI();
    renderBuildingPills();
    updateCalculations();
    render();
}

function switchCourse(id: string) {
    if (!id || id === state.courseId) return;

    if (!saveData()) {
        renderCourseSelect();
        showToast('Không lưu được khóa hiện tại. Chưa chuyển khóa.');
        return;
    }

    const record = loadCourseRecord(id);
    if (!record) {
        renderCourseSelect();
        showToast('Không tìm thấy dữ liệu của khóa này.');
        return;
    }

    const summary = summarizeRecord(record);
    const index = state.courseList.findIndex(course => course.id === id);
    if (index >= 0) state.courseList[index] = summary;
    else state.courseList.push(summary);

    activateCourseRecord(record);
    renderCourseList();
    closeCourseModal();
    showToast(`Đã chuyển sang khóa ${state.courseName}`);
    maybeStartCollab();
}

function createCourseFromName(name: string, cloneSourceId = '') {
    const courseName = String(name || '').trim();
    if (!courseName) {
        showToast('Hãy nhập tên khóa mới.');
        return;
    }

    if (state.courseList.some(course => normalizeText(course.courseName) === normalizeText(courseName))) {
        showToast('Tên khóa này đã tồn tại. Hãy chọn tên khác.');
        return;
    }

    if (!saveData()) {
        showToast('Không lưu được dữ liệu hiện tại. Chưa tạo khóa mới.');
        return;
    }

    let record: CourseRecord;
    if (cloneSourceId) {
        const source = loadCourseRecord(cloneSourceId);
        if (!source) {
            showToast('Không tìm thấy khóa nguồn để nhân bản.');
            return;
        }
        record = cloneRecord(source, courseName);
    } else {
        record = makeDefaultRecord(courseName);
        const today = new Date();
        record.meta.unitName = state.unitName || record.meta.unitName;
        record.meta.ngay = today.getDate();
        record.meta.thang = today.getMonth() + 1;
        record.meta.nam = today.getFullYear();
        record.meta.graderName = state.graderName || 'Giảng viên';
    }

    if (!saveCourseRecord(record)) {
        showToast('Không tạo được khóa mới trên thiết bị này.');
        return;
    }

    state.courseList.push(summarizeRecord(record));
    saveCourseIndex(state.courseList);
    activateCourseRecord(record);
    if (elements.newCourseName) elements.newCourseName.value = '';
    renderCourseList();
    closeCourseModal();
    showToast(cloneSourceId ? `Đã nhân bản thành khóa ${courseName}` : `Đã tạo khóa ${courseName}`);
    maybeStartCollab();
}

async function renameCourse(id: string, name: string) {
    const newName = String(name || '').trim();
    if (!newName) return;

    if (state.courseList.some(course => course.id !== id && normalizeText(course.courseName) === normalizeText(newName))) {
        showToast('Tên khóa này đã tồn tại. Hãy chọn tên khác.');
        return;
    }

    if (id === state.courseId) {
        state.courseName = newName;
        state.settingsUpdatedAt = new Date().toISOString();
        saveData();
        applyMetaToUI();
    } else {
        const record = loadCourseRecord(id);
        if (!record) {
            showToast('Không tìm thấy khóa cần đổi tên.');
            return;
        }
        const now = new Date().toISOString();
        record.meta.courseName = newName;
        record.meta.updatedAt = now;
        record.savedAt = now;
        saveCourseRecord(record);
        const index = state.courseList.findIndex(course => course.id === id);
        if (index >= 0) state.courseList[index] = summarizeRecord(record);
        saveCourseIndex(state.courseList);
    }

    renderCourseList();
    showToast('Đã đổi tên khóa.');
}

async function deleteCourse(id: string) {
    if (state.locked && id === state.courseId) {
        showToast('Sổ điểm đã khóa. Hãy mở khóa trước khi xóa khóa hiện tại.');
        return;
    }
    if (state.courseList.length <= 1) {
        showToast('Không thể xóa khóa duy nhất. Hãy tạo khóa khác trước.');
        return;
    }

    const summary = state.courseList.find(course => course.id === id);
    if (!summary) return;

    const ok = await customConfirm(
        'Xóa Khóa Học',
        `Xóa khóa "${summary.courseName}" và toàn bộ dữ liệu của khóa này?
Thao tác không thể hoàn tác.`
    );
    if (!ok) return;

    const wasCurrent = id === state.courseId;
    deleteCourseRecord(id);
    state.courseList = state.courseList.filter(course => course.id !== id);
    saveCourseIndex(state.courseList);

    if (wasCurrent) {
        const next = state.courseList[0];
        const record = next ? loadCourseRecord(next.id) : null;
        if (record) {
            activateCourseRecord(record);
        } else {
            const fallback = makeDefaultRecord();
            saveCourseRecord(fallback);
            state.courseList = [summarizeRecord(fallback)];
            saveCourseIndex(state.courseList);
            activateCourseRecord(fallback);
        }
    }

    renderCourseList();
    showToast('Đã xóa khóa học.');
    maybeStartCollab();
}

// ============================================================
// STUDENTS & LEADERS
// ============================================================
const studentUi = {
    tab: 'students' as 'students' | 'leaders',
    query: '',
    building: 'ALL',
    room: 'ALL',
    platoon: 'ALL',
    tieuDoi: 'ALL',
    groupBy: 'room' as 'room' | 'platoon',
    quick: 'all' as 'all' | 'leaders' | 'noRoom' | 'noPlatoon',
    selected: new Set<string>()
};

function studentInitials(name: string): string {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    return words.slice(-2).map(word => word[0]).join('').toUpperCase();
}

function studentPositionClass(position: string): string {
    if (position === 'Phó đại đội trưởng') return 'deputy';
    if (position === 'Trung đội trưởng') return 'platoon';
    if (position === 'Tiểu đội trưởng') return 'squad';
    return 'member';
}

function studentFilterOptions(values: string[], current: string, allLabel: string): string {
    const unique = Array.from(new Set(values.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'vi', { numeric: true }));
    return `<option value="ALL"${current === 'ALL' ? ' selected' : ''}>${escapeHtml(allLabel)}</option>`
        + unique.map(value => `<option value="${escapeHtml(value)}"${current === value ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('');
}

function getFilteredStudents(): Student[] {
    const query = normalizeText(studentUi.query);
    return sortStudents(state.students).filter(student => {
        if (studentUi.building !== 'ALL' && student.building !== studentUi.building) return false;
        if (studentUi.room !== 'ALL' && student.room !== studentUi.room) return false;
        if (studentUi.platoon !== 'ALL' && String(student.trungDoi || '') !== studentUi.platoon) return false;
        if (studentUi.tieuDoi !== 'ALL' && String(student.tieuDoi || '') !== studentUi.tieuDoi) return false;
        if (studentUi.quick === 'leaders' && !isLeaderPosition(student.position)) return false;
        if (studentUi.quick === 'noRoom' && String(student.room || '').trim()) return false;
        if (studentUi.quick === 'noPlatoon' && String(student.trungDoi || '').trim()) return false;
        if (!query) return true;
        return [
            student.name,
            student.code,
            student.building,
            student.room,
            student.tieuDoi,
            student.trungDoi,
            student.position,
            student.phone,
            student.note,
            student.className,
            student.school,
            student.birthDate,
            student.hometown,
            student.gender,
            student.ethnicity,
            student.cccd
        ].some(value => normalizeText(value).includes(query));
    });
}

function renderStudentFilters() {
    const buildings = state.students.map((student: Student) => student.building)
        .concat(state.items.map((item: any) => item.building));
    if (studentUi.building !== 'ALL' && !buildings.includes(studentUi.building)) studentUi.building = 'ALL';

    const rooms = state.students
        .filter((student: Student) => studentUi.building === 'ALL' || student.building === studentUi.building)
        .map((student: Student) => student.room);
    if (studentUi.room !== 'ALL' && !rooms.includes(studentUi.room)) studentUi.room = 'ALL';

    const platoonIds: string[] = Array.from(new Set<string>([
        ...state.items.map((item: any) => String(item.id)),
        ...state.students.map((student: Student) => String(student.trungDoi || '')).filter(Boolean)
    ])).sort((a: string, b: string) => Number(a) - Number(b) || a.localeCompare(b, 'vi'));
    if (studentUi.platoon !== 'ALL' && !platoonIds.includes(studentUi.platoon)) studentUi.platoon = 'ALL';

    const squadIds = state.students
        .filter((student: Student) =>
            (studentUi.building === 'ALL' || student.building === studentUi.building)
            && (studentUi.room === 'ALL' || student.room === studentUi.room)
            && (studentUi.platoon === 'ALL' || String(student.trungDoi || '') === studentUi.platoon)
        )
        .map((student: Student) => String(student.tieuDoi || '').trim())
        .filter(Boolean);
    if (studentUi.tieuDoi !== 'ALL' && !squadIds.includes(studentUi.tieuDoi)) studentUi.tieuDoi = 'ALL';

    elements.studentBuildingFilter.innerHTML = studentFilterOptions(buildings, studentUi.building, 'Tất cả tòa');
    elements.studentRoomFilter.innerHTML = studentFilterOptions(rooms, studentUi.room, 'Tất cả phòng');
    elements.studentPlatoonFilter.innerHTML = studentFilterOptions(platoonIds, studentUi.platoon, 'Tất cả trung đội')
        .replace(/>(\d+)<\/option>/g, '>TĐ $1</option>');
    elements.studentTieuDoiFilter.innerHTML = studentFilterOptions(squadIds, studentUi.tieuDoi, 'Tất cả tiểu đội')
        .replace(/>(\d+)<\/option>/g, '>Tiểu đội $1</option>');

    const buildingList = document.getElementById('studentBuildingOptions');
    if (buildingList) {
        buildingList.innerHTML = Array.from(new Set(buildings.filter(Boolean))).sort().map(value => `<option value="${escapeHtml(value)}"></option>`).join('');
    }
    const platoonList = document.getElementById('studentPlatoonOptions');
    if (platoonList) {
        platoonList.innerHTML = platoonIds.sort((a, b) => Number(a) - Number(b)).map(value => `<option value="${escapeHtml(value)}"></option>`).join('');
    }
    const squadList = document.getElementById('studentTieuDoiOptions');
    if (squadList) {
        const allSquads = Array.from(new Set<string>(state.students.map((student: Student) => String(student.tieuDoi || '').trim()).filter(Boolean)))
            .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b, 'vi'));
        squadList.innerHTML = allSquads.map(value => `<option value="${escapeHtml(value)}"></option>`).join('');
    }
}

function renderStudentRows(students: Student[]): string {
    return students.map(student => {
        const chips = [
            student.code ? `<span class="student-chip code">${escapeHtml(student.code)}</span>` : '',
            student.trungDoi ? `<span class="student-chip platoon">TĐ ${escapeHtml(student.trungDoi)}</span>` : '',
            student.tieuDoi ? `<span class="student-chip squad">Tiểu đội ${escapeHtml(student.tieuDoi)}</span>` : '',
            student.room ? `<span class="student-chip room">${student.building ? `${escapeHtml(student.building)} · ` : ''}P. ${escapeHtml(student.room)}</span>` : '',
            student.className ? `<span class="student-chip class">Lớp ${escapeHtml(student.className)}</span>` : ''
        ].filter(Boolean).join('');
        const extra = [
            student.school ? `Trường ${student.school}` : '',
            student.birthDate ? `Sinh ${student.birthDate}` : '',
            student.hometown ? `Quê ${student.hometown}` : '',
            student.ethnicity ? `Dân tộc ${student.ethnicity}` : '',
            student.cccd ? `CCCD ${student.cccd}` : '',
            student.phone ? `SĐT ${student.phone}` : ''
        ].filter(Boolean).map(value => `<span>${escapeHtml(value)}</span>`).join('');

        const selected = studentUi.selected.has(student.id);
        return `
            <div class="student-row${selected ? ' selected' : ''}" data-student-id="${escapeHtml(student.id)}">
                <label class="student-select" title="Chọn sinh viên">
                    <input type="checkbox" data-student-select="${escapeHtml(student.id)}"${selected ? ' checked' : ''} aria-label="Chọn ${escapeHtml(student.name)}">
                </label>
                <div class="student-avatar ${studentPositionClass(student.position)}">${escapeHtml(studentInitials(student.name))}</div>
                <div class="student-row-main">
                    <div class="student-row-name">
                        ${escapeHtml(student.name)}
                        <span class="student-position ${studentPositionClass(student.position)}">${escapeHtml(student.position || 'Học viên')}</span>
                    </div>
                    <div class="student-chip-row">${chips || '<span class="student-chip muted">Chưa có thông tin lớp/phòng</span>'}</div>
                    ${extra ? `<div class="student-row-extra">${extra}</div>` : ''}
                    ${student.note ? `<div class="student-row-note">${escapeHtml(student.note)}</div>` : ''}
                </div>
                <div class="student-row-actions">
                    <button type="button" class="btn-student-action" data-student-action="edit" data-student-id="${escapeHtml(student.id)}">Sửa</button>
                    <button type="button" class="btn-student-action danger" data-student-action="delete" data-student-id="${escapeHtml(student.id)}">Xóa</button>
                </div>
            </div>
        `;
    }).join('');
}

function pruneStudentSelection(): void {
    const ids = new Set(state.students.map((student: Student) => student.id));
    studentUi.selected.forEach(id => {
        if (!ids.has(id)) studentUi.selected.delete(id);
    });
}

function populateBulkPositionSelect(): void {
    if (!elements.studentBulkPosition || elements.studentBulkPosition.dataset.ready === '1') return;
    elements.studentBulkPosition.innerHTML = '<option value="">— Chọn chức vụ —</option>'
        + (STUDENT_POSITIONS as readonly string[]).map(position =>
            `<option value="${escapeHtml(position)}">${escapeHtml(position)}</option>`
        ).join('');
    elements.studentBulkPosition.dataset.ready = '1';
}

function renderStudentBulkBar(visibleStudents: Student[]): void {
    pruneStudentSelection();
    populateBulkPositionSelect();
    const count = studentUi.selected.size;
    if (elements.studentBulkBar) elements.studentBulkBar.hidden = count === 0;
    if (elements.studentSelectedCount) elements.studentSelectedCount.textContent = String(count);
    if (elements.btnSelectVisible) {
        const allVisibleSelected = visibleStudents.length > 0
            && visibleStudents.every(student => studentUi.selected.has(student.id));
        elements.btnSelectVisible.textContent = allVisibleSelected ? 'Bỏ chọn đang hiện' : 'Chọn tất cả';
        elements.btnSelectVisible.disabled = visibleStudents.length === 0;
        elements.btnSelectVisible.classList.toggle('active', count > 0);
    }
}

function toggleVisibleStudentSelection(): void {
    const visible = getFilteredStudents();
    if (!visible.length) return;
    const allVisibleSelected = visible.every(student => studentUi.selected.has(student.id));
    visible.forEach(student => {
        if (allVisibleSelected) studentUi.selected.delete(student.id);
        else studentUi.selected.add(student.id);
    });
    renderStudentRoomList();
}

function clearStudentSelection(): void {
    studentUi.selected.clear();
    renderStudentRoomList();
}

function restoreDeletedStudents(deleted: Student[]): void {
    if (state.locked) {
        showToast('Sổ điểm đã khóa. Hãy mở khóa trước khi hoàn tác.');
        return;
    }
    if (!deleted.length) return;
    const now = new Date().toISOString();
    const existingIds = new Set(state.students.map((student: Student) => student.id));
    const existingCodes = new Set(state.students.map((student: Student) => normalizeText(student.code)).filter(Boolean));
    const restored: Student[] = [];
    deleted.forEach(student => {
        if (existingIds.has(student.id)) return;
        const codeKey = normalizeText(student.code);
        if (codeKey && existingCodes.has(codeKey)) return;
        state.students.push({
            ...student,
            updatedAt: now,
            updatedBy: state.graderName || 'Giảng viên'
        });
        existingIds.add(student.id);
        if (codeKey) existingCodes.add(codeKey);
        restored.push(student);
    });
    if (!restored.length) {
        showToast('Không thể hoàn tác vì sinh viên đã được thêm lại hoặc mã SV đã tồn tại.');
        return;
    }
    const tombstones = { ...(state.studentTombstones || {}) };
    restored.forEach(student => delete tombstones[student.id]);
    state.studentTombstones = tombstones;
    state.students = sortStudents(state.students);
    state.studentsUpdatedAt = now;
    logAudit('Hoàn tác xóa', `${restored.length} sinh viên`);
    saveData();
    renderStudentUI();
    render();
    showToast(`Đã hoàn tác xóa ${restored.length} sinh viên.`);
}

function applyStudentDeletion(deleted: Student[], action: string, message: string): void {
    if (!deleted.length) return;
    const ids = new Set(deleted.map(student => student.id));
    const now = new Date().toISOString();
    const previousStudents = state.students.slice();
    state.students = state.students.filter((student: Student) => !ids.has(student.id));
    reconcileStudentTombstones(previousStudents, state.students, now);
    state.studentsUpdatedAt = now;
    deleted.forEach(student => studentUi.selected.delete(student.id));
    logAudit(action, deleted.length === 1
        ? `${deleted[0].name}${deleted[0].room ? ` · P. ${deleted[0].room}` : ''}`
        : `${deleted.length} sinh viên`);
    const courseId = state.courseId;
    saveData();
    renderStudentUI();
    render();
    showToast(message, {
        label: 'Hoàn tác',
        onClick: () => {
            if (state.courseId !== courseId) {
                showToast('Đã đổi khóa nên không thể hoàn tác thao tác xóa trước đó.');
                return;
            }
            restoreDeletedStudents(deleted);
        }
    });
}

async function deleteSelectedStudents(): Promise<void> {
    if (state.locked) {
        showToast('Sổ điểm đã khóa. Hãy mở khóa trước khi xóa sinh viên.');
        return;
    }
    const deleted = state.students.filter((student: Student) => studentUi.selected.has(student.id));
    if (!deleted.length) return;
    const ok = await customConfirm(
        'Xóa Sinh Viên Đã Chọn',
        `Xóa ${deleted.length} sinh viên đang chọn khỏi danh sách của khóa này?`
    );
    if (!ok) return;
    applyStudentDeletion(deleted, 'Xóa sinh viên hàng loạt', `Đã xóa ${deleted.length} sinh viên.`);
}

function applyBulkStudentPosition(): void {
    if (state.locked) {
        showToast('Sổ điểm đã khóa. Hãy mở khóa trước khi sửa ban cán sự.');
        return;
    }
    const rawPosition = String(elements.studentBulkPosition?.value || '');
    if (!rawPosition) {
        showToast('Hãy chọn chức vụ cần gán cho các sinh viên đã chọn.');
        elements.studentBulkPosition?.focus();
        return;
    }
    const position = normalizePosition(rawPosition);
    const targets = state.students.filter((student: Student) => studentUi.selected.has(student.id));
    if (!targets.length) return;
    const now = new Date().toISOString();
    targets.forEach(student => {
        student.position = position;
        student.updatedAt = now;
        student.updatedBy = state.graderName || 'Giảng viên';
    });
    state.studentsUpdatedAt = now;
    logAudit('Gán chức vụ hàng loạt', `${targets.length} sinh viên → ${position}`);
    saveData();
    renderStudentUI();
    render();
    showToast(`Đã gán ${position} cho ${targets.length} sinh viên.`);
}

function renderStudentRoomList() {
    const students = getFilteredStudents();
    const usePlatoon = studentUi.groupBy === 'platoon';
    const groups = usePlatoon ? groupStudentsByPlatoon(students) : groupStudentsByRoom(students);
    const allPlatoonIds = new Set([
        ...state.items.map((item: any) => String(item.id)),
        ...state.students.map((student: Student) => String(student.trungDoi || '')).filter(Boolean)
    ]);
    const totalRooms = new Set(state.students.map((student: Student) => `${normalizeText(student.building)}::${normalizeText(student.room)}`).filter(key => key !== '::')).size;
    const leaderCount = state.students.filter((student: Student) => isLeaderPosition(student.position)).length;
    const noRoomCount = state.students.filter((student: Student) => !String(student.room || '').trim()).length;
    const noPlatoonCount = state.students.filter((student: Student) => !String(student.trungDoi || '').trim()).length;

    elements.studentSummary.innerHTML = `
        <div class="student-stat"><strong>${state.students.length}</strong><span>Sinh viên</span></div>
        <div class="student-stat"><strong>${totalRooms}</strong><span>Phòng</span></div>
        <div class="student-stat"><strong>${allPlatoonIds.size}</strong><span>Trung đội</span></div>
        <div class="student-stat"><strong>${leaderCount}</strong><span>Cán sự</span></div>
        <div class="student-stat ${noRoomCount ? 'warning' : ''}"><strong>${noRoomCount}</strong><span>Chưa xếp phòng</span></div>
        <div class="student-stat ${noPlatoonCount ? 'warning' : ''}"><strong>${noPlatoonCount}</strong><span>Chưa xếp TĐ</span></div>
        ${students.length !== state.students.length ? `<div class="student-stat filtered"><strong>${students.length}</strong><span>Đang hiện</span></div>` : ''}
    `;

    elements.studentGroupRoom?.classList.toggle('active', !usePlatoon);
    elements.studentGroupPlatoon?.classList.toggle('active', usePlatoon);
    elements.studentQuickAll?.classList.toggle('active', studentUi.quick === 'all');
    elements.studentQuickLeaders?.classList.toggle('active', studentUi.quick === 'leaders');
    elements.studentQuickNoRoom?.classList.toggle('active', studentUi.quick === 'noRoom');
    elements.studentQuickNoPlatoon?.classList.toggle('active', studentUi.quick === 'noPlatoon');
    renderStudentBulkBar(students);

    if (!groups.length) {
        const quickLabel = studentUi.quick === 'leaders' ? 'cán sự'
            : studentUi.quick === 'noRoom' ? 'sinh viên chưa xếp phòng'
            : studentUi.quick === 'noPlatoon' ? 'sinh viên chưa xếp trung đội'
            : 'sinh viên';
        const hint = studentUi.quick === 'leaders'
            ? 'Hãy sửa chức vụ của sinh viên trong tab Sinh viên hoặc bấm <strong>Gán cán sự</strong>.'
            : 'Bấm <strong>+ Thêm sinh viên</strong> hoặc <strong>Nhập Excel/CSV</strong> để bắt đầu.';
        elements.studentRoomList.innerHTML = `<div class="empty-state">Chưa có ${quickLabel} phù hợp. ${hint}</div>`;
        return;
    }

    elements.studentRoomList.innerHTML = groups.map(group => {
        if (usePlatoon) {
            const platoonGroup = group as ReturnType<typeof groupStudentsByPlatoon>[number];
            const unitInfo = [
                platoonGroup.tieuDois.length ? `Tiểu đội ${platoonGroup.tieuDois.join(', ')}` : '',
                platoonGroup.rooms.length ? `Phòng ${platoonGroup.rooms.slice(0, 6).join(', ')}${platoonGroup.rooms.length > 6 ? '…' : ''}` : ''
            ].filter(Boolean).join(' · ');
            return `
                <section class="student-room-group student-platoon-group">
                    <div class="student-room-head">
                        <div>
                            <div class="student-room-title">${platoonGroup.trungDoi ? `Trung đội ${escapeHtml(platoonGroup.trungDoi)}` : 'Chưa xếp trung đội'}</div>
                            <div class="student-room-sub">${platoonGroup.students.length} sinh viên${unitInfo ? ` · ${escapeHtml(unitInfo)}` : ''}</div>
                        </div>
                        <span class="student-room-count">${platoonGroup.students.length}</span>
                    </div>
                    <div class="student-rows">${renderStudentRows(platoonGroup.students)}</div>
                </section>
            `;
        }
        const roomGroup = group as ReturnType<typeof groupStudentsByRoom>[number];
        const unitInfo = [
            roomGroup.trungDois.length ? `TĐ ${roomGroup.trungDois.join(', ')}` : '',
            roomGroup.tieuDois.length ? `Tiểu đội ${roomGroup.tieuDois.join(', ')}` : ''
        ].filter(Boolean).join(' · ');
        return `
            <section class="student-room-group">
                <div class="student-room-head">
                    <div>
                        <div class="student-room-title">${roomGroup.building || roomGroup.room ? `${escapeHtml(roomGroup.building || 'Chưa xếp tòa')} · Phòng ${escapeHtml(roomGroup.room || '—')}` : 'Chưa xếp phòng'}</div>
                        <div class="student-room-sub">${roomGroup.students.length} sinh viên${unitInfo ? ` · ${escapeHtml(unitInfo)}` : ''}</div>
                    </div>
                    <span class="student-room-count">${roomGroup.students.length}</span>
                </div>
                <div class="student-rows">${renderStudentRows(roomGroup.students)}</div>
            </section>
        `;
    }).join('');
}

function renderLeaderList() {
    const leaders = sortStudents(state.students.filter((student: Student) => isLeaderPosition(student.position)));
    const counts = LEADER_POSITIONS.map(role => ({
        role,
        count: leaders.filter(student => student.position === role).length
    }));

    elements.leaderSummary.innerHTML = counts.map(entry =>
        `<span class="leader-summary-item"><strong>${entry.count}</strong> ${escapeHtml(entry.role)}</span>`
    ).join('');

    if (!leaders.length) {
        elements.leaderList.innerHTML = `<div class="empty-state">Chưa có cán sự. Bấm <strong>Gán cán sự</strong> hoặc sửa chức vụ của sinh viên trong tab Sinh viên.</div>`;
        return;
    }

    elements.leaderList.innerHTML = LEADER_POSITIONS.map(role => {
        const roleLeaders = leaders.filter(student => student.position === role);
        if (!roleLeaders.length) return '';
        return `
            <section class="leader-section">
                <div class="leader-section-title">${escapeHtml(role)} <span>${roleLeaders.length}</span></div>
                <div class="leader-rows">
                    ${roleLeaders.map(student => `
                        <div class="leader-row">
                            <div class="student-avatar">${escapeHtml(studentInitials(student.name))}</div>
                            <div class="leader-row-main">
                                <div class="student-row-name">${escapeHtml(student.name)}</div>
                                <div class="student-row-meta">
                                    ${student.code ? `${escapeHtml(student.code)} · ` : ''}
                                    ${student.trungDoi ? `TĐ ${escapeHtml(student.trungDoi)}` : 'Chưa xếp trung đội'}
                                    ${student.tieuDoi ? ` · Tiểu đội ${escapeHtml(student.tieuDoi)}` : ''}
                                    ${student.room ? ` · P. ${escapeHtml(student.room)}` : ''}
                                    ${student.phone ? ` · ${escapeHtml(student.phone)}` : ''}
                                </div>
                            </div>
                            <div class="student-row-actions">
                                <button type="button" class="btn-student-action" data-leader-action="edit" data-student-id="${escapeHtml(student.id)}">Sửa</button>
                                <button type="button" class="btn-student-action" data-leader-action="clear" data-student-id="${escapeHtml(student.id)}">Bỏ chức vụ</button>
                                <button type="button" class="btn-student-action danger" data-leader-action="delete" data-student-id="${escapeHtml(student.id)}">Xóa</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </section>
        `;
    }).join('');
}

function renderStudentUI() {
    renderStudentFilters();
    renderStudentRoomList();
    renderLeaderList();
    elements.studentListPanel.hidden = studentUi.tab !== 'students';
    elements.leaderListPanel.hidden = studentUi.tab !== 'leaders';
    elements.tabStudents.classList.toggle('active', studentUi.tab === 'students');
    elements.tabLeaders.classList.toggle('active', studentUi.tab === 'leaders');
}

function openStudentsModal(options: { platoonId?: string; tab?: 'students' | 'leaders' } = {}) {
    studentUi.selected.clear();
    if (options.platoonId) {
        studentUi.platoon = String(options.platoonId);
        studentUi.building = 'ALL';
        studentUi.room = 'ALL';
        studentUi.tieuDoi = 'ALL';
        studentUi.query = '';
        studentUi.quick = 'all';
        if (elements.studentSearch) elements.studentSearch.value = '';
    }
    if (options.tab) studentUi.tab = options.tab;
    renderStudentUI();
    elements.studentsModal.classList.add('open');
    closeStudentEditor();
}

function closeStudentsModal() {
    elements.studentsModal.classList.remove('open');
    closeStudentEditor();
}

function setStudentTab(tab: 'students' | 'leaders') {
    studentUi.tab = tab;
    renderStudentUI();
}

function openStudentsForPlatoon(id: number | string) {
    openStudentsModal({ platoonId: String(id), tab: 'students' });
}

function populateStudentPositionSelect(selected = 'Học viên') {
    const options = STUDENT_POSITIONS as readonly string[];
    elements.studentPosition.innerHTML = options.map(position =>
        `<option value="${escapeHtml(position)}"${position === selected ? ' selected' : ''}>${escapeHtml(position)}</option>`
    ).join('');
}

function openStudentEditor(student: Student | null = null, presetPosition = 'Học viên') {
    elements.studentStatus.textContent = '';
    elements.studentStatus.className = 'student-status';
    elements.studentEditor.hidden = false;
    elements.studentEditorTitle.textContent = student ? 'Sửa thông tin sinh viên' : 'Thêm sinh viên';
    if (elements.btnSaveStudentNext) {
        elements.btnSaveStudentNext.textContent = student ? 'Lưu & Thêm mới' : 'Lưu & Thêm tiếp';
    }
    elements.studentEditId.value = student ? student.id : '';
    elements.studentName.value = student ? student.name : '';
    elements.studentCode.value = student ? student.code : '';
    elements.studentBuilding.value = student ? student.building : (studentUi.building !== 'ALL' ? studentUi.building : '');
    elements.studentRoom.value = student ? student.room : (studentUi.room !== 'ALL' ? studentUi.room : '');
    elements.studentTieuDoi.value = student ? student.tieuDoi : (studentUi.tieuDoi !== 'ALL' ? studentUi.tieuDoi : '');
    elements.studentTrungDoi.value = student ? student.trungDoi : (studentUi.platoon !== 'ALL' ? studentUi.platoon : '');
    elements.studentPhone.value = student ? student.phone : '';
    elements.studentNote.value = student ? student.note : '';
    elements.studentClassName.value = student ? student.className : '';
    elements.studentSchool.value = student ? student.school : '';
    elements.studentBirthDate.value = student ? student.birthDate : '';
    elements.studentHometown.value = student ? student.hometown : '';
    elements.studentGender.value = student ? student.gender : '';
    elements.studentEthnicity.value = student ? student.ethnicity : '';
    elements.studentCccd.value = student ? student.cccd : '';
    if (elements.studentExtraFields) {
        elements.studentExtraFields.open = Boolean(student && [
            student.className,
            student.school,
            student.birthDate,
            student.hometown,
            student.gender,
            student.ethnicity,
            student.cccd
        ].some(Boolean));
    }
    populateStudentPositionSelect(student ? student.position : presetPosition);
    elements.studentEditor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => elements.studentName.focus(), 80);
}

function closeStudentEditor() {
    elements.studentEditor.hidden = true;
    elements.studentStatus.textContent = '';
}

function reconcileStudentTombstones(previous: Student[], next: Student[], at: string): void {
    const nextIds = new Set((next || []).map(student => student.id));
    const tombstones = { ...state.studentTombstones };
    (previous || []).forEach(student => {
        if (!nextIds.has(student.id)) tombstones[student.id] = at;
    });
    (next || []).forEach(student => {
        delete tombstones[student.id];
    });
    state.studentTombstones = tombstones;
}

function saveStudentFromForm(continueAdding = false) {
    if (state.locked) {
        showToast('Sổ điểm đã khóa. Hãy mở khóa trước khi sửa danh sách sinh viên.');
        return;
    }

    const name = String(elements.studentName.value || '').trim();
    if (!name) {
        elements.studentStatus.textContent = 'Hãy nhập họ tên sinh viên.';
        elements.studentStatus.className = 'student-status error';
        elements.studentName.focus();
        return;
    }

    const now = new Date().toISOString();
    const id = String(elements.studentEditId.value || '');
    const existing = state.students.find((student: Student) => student.id === id);
    const code = String(elements.studentCode.value || '').trim();
    if (code) {
        const duplicate = state.students.find((student: Student) =>
            student.id !== id && normalizeText(student.code) === normalizeText(code)
        );
        if (duplicate) {
            elements.studentStatus.textContent = `Mã SV ${code} đã thuộc về ${duplicate.name}${duplicate.room ? ` (P. ${duplicate.room})` : ''}. Hãy kiểm tra lại.`;
            elements.studentStatus.className = 'student-status error';
            elements.studentCode.focus();
            elements.studentCode.select();
            return;
        }
    }

    const student: Student = {
        ...(existing || {}),
        id: existing ? existing.id : `sv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        name,
        code,
        building: String(elements.studentBuilding.value || '').trim(),
        room: String(elements.studentRoom.value || '').trim(),
        tieuDoi: String(elements.studentTieuDoi.value || '').trim(),
        trungDoi: String(elements.studentTrungDoi.value || '').trim(),
        position: normalizePosition(elements.studentPosition.value),
        phone: String(elements.studentPhone.value || '').trim(),
        note: String(elements.studentNote.value || '').trim(),
        className: String(elements.studentClassName.value || '').trim(),
        school: String(elements.studentSchool.value || '').trim(),
        birthDate: String(elements.studentBirthDate.value || '').trim(),
        hometown: String(elements.studentHometown.value || '').trim(),
        gender: String(elements.studentGender.value || '').trim(),
        ethnicity: String(elements.studentEthnicity.value || '').trim(),
        cccd: String(elements.studentCccd.value || '').trim(),
        updatedAt: now,
        updatedBy: state.graderName || 'Giảng viên'
    };

    if (existing) {
        const index = state.students.findIndex((entry: Student) => entry.id === existing.id);
        state.students[index] = student;
        logAudit('Sửa sinh viên', `${student.name}${student.position !== 'Học viên' ? ` · ${student.position}` : ''}`);
    } else {
        state.students.push(student);
        logAudit('Thêm sinh viên', `${student.name}${student.room ? ` · P. ${student.room}` : ''}${student.position !== 'Học viên' ? ` · ${student.position}` : ''}`);
    }

    const previousStudents = state.students.slice();
    state.students = sortStudents(state.students);
    reconcileStudentTombstones(previousStudents, state.students, now);
    state.studentsUpdatedAt = now;
    saveData();
    renderStudentUI();
    render();
    if (continueAdding) {
        openStudentEditor(null, student.position);
        elements.studentBuilding.value = student.building;
        elements.studentRoom.value = student.room;
        elements.studentTrungDoi.value = student.trungDoi;
        elements.studentTieuDoi.value = student.tieuDoi;
        elements.studentStatus.textContent = existing
            ? 'Đã lưu thay đổi. Nhập sinh viên tiếp theo.'
            : 'Đã thêm sinh viên. Nhập tiếp sinh viên kế tiếp.';
        elements.studentStatus.className = 'student-status ok';
        showToast(existing ? 'Đã cập nhật sinh viên.' : 'Đã thêm sinh viên.');
    } else {
        closeStudentEditor();
        showToast(existing ? 'Đã cập nhật sinh viên.' : 'Đã thêm sinh viên.');
    }
}

async function deleteStudent(id: string) {
    if (state.locked) {
        showToast('Sổ điểm đã khóa. Hãy mở khóa trước khi xóa sinh viên.');
        return;
    }
    const student = state.students.find((entry: Student) => entry.id === id);
    if (!student) return;
    const ok = await customConfirm('Xóa Sinh Viên', `Xóa ${student.name} khỏi danh sách của khóa này?`);
    if (!ok) return;

    applyStudentDeletion([student], 'Xóa sinh viên', 'Đã xóa sinh viên.');
}

function clearLeaderPosition(id: string) {
    if (state.locked) {
        showToast('Sổ điểm đã khóa. Hãy mở khóa trước khi sửa ban cán sự.');
        return;
    }
    const student = state.students.find((entry: Student) => entry.id === id);
    if (!student) return;
    const oldPosition = student.position;
    student.position = 'Học viên';
    student.updatedAt = new Date().toISOString();
    student.updatedBy = state.graderName || 'Giảng viên';
    state.studentsUpdatedAt = student.updatedAt;
    logAudit('Bỏ chức vụ', `${student.name}: ${oldPosition} → Học viên`);
    saveData();
    renderStudentUI();
    render();
    showToast('Đã bỏ chức vụ cán sự.');
}

async function importStudentsFromFile(files: File[]) {
    if (state.locked) {
        showToast('Sổ điểm đã khóa. Hãy mở khóa trước khi nhập danh sách sinh viên.');
        return;
    }
    const fileList = Array.from(files || []).filter(Boolean);
    if (!fileList.length) return;

    const setStatus = (message: string, type = '') => {
        if (elements.studentListStatus) {
            elements.studentListStatus.hidden = !message;
            elements.studentListStatus.textContent = message;
            elements.studentListStatus.className = `student-list-status${type ? ` ${type}` : ''}`;
        }
        elements.studentStatus.textContent = message;
        elements.studentStatus.className = `student-status${type ? ` ${type}` : ''}`;
    };

    setStatus(`Đang đọc ${fileList.length} file...`);
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
                    const result = parseStudentRows(sheet.rows, state.items);
                    if (!best || result.students.length > best.students.length) {
                        best = result;
                        bestName = sheet.name;
                    }
                });

                if (!best || !best.students.length) {
                    const message = best && best.errors.length
                        ? best.errors.slice(0, 2).join(' · ')
                        : 'không đọc được sinh viên';
                    summaries.push(`${file.name}: 0 sinh viên`);
                    allErrors.push(`${file.name}: ${message}`);
                    continue;
                }

                allStudents.push(...best.students);
                summaries.push(`${file.name}: ${best.students.length} sinh viên (trang "${bestName}")`);
                if (best.errors.length) {
                    allErrors.push(...best.errors.slice(0, 2).map(error => `${file.name}: ${error}`));
                }
            } catch (error) {
                summaries.push(`${file.name}: lỗi đọc file`);
                allErrors.push(`${file.name}: ${(error as Error).message}`);
            }
        }

        if (!allStudents.length) {
            const message = allErrors.length
                ? allErrors.slice(0, 4).join(' · ')
                : 'Không đọc được sinh viên từ các file đã chọn.';
            setStatus(message, 'error');
            showToast(message);
            return;
        }

        const incomingBase = mergeStudentLists([], allStudents);
        const mode = elements.studentImportMode.value;
        const ok = await customConfirm(
            'Nhập Danh Sách Sinh Viên',
            `Tìm thấy ${incomingBase.length} sinh viên trong ${fileList.length} file:\n`
            + summaries.join('\n')
            + `\n\n${mode === 'replace' ? 'Thay thế toàn bộ danh sách hiện tại?' : 'Cập nhật vào danh sách hiện tại?'}`
            + (allErrors.length ? `\n${allErrors.length} lỗi/cảnh báo sẽ bị bỏ qua.` : '')
        );
        if (!ok) {
            setStatus('');
            return;
        }

        const now = new Date().toISOString();
        const previousStudents = state.students.slice();
        const existingByCode = new Map<string, Student>();
        const existingByNameRoom = new Map<string, Student>();
        state.students.forEach(student => {
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
                updatedBy: state.graderName || 'Giảng viên'
            };
        });
        state.students = mode === 'replace' ? sortStudents(incoming) : mergeStudentLists(state.students, incoming);
        reconcileStudentTombstones(previousStudents, state.students, now);
        state.studentsUpdatedAt = now;
        logAudit(
            'Nhập danh sách sinh viên',
            `${mode === 'replace' ? 'Thay thế' : 'Cập nhật'} ${incoming.length} sinh viên từ ${fileList.map(file => file.name).join(', ')}`
        );
        saveData();
        renderStudentUI();
        render();
        const success = `Đã nhập ${incoming.length} sinh viên từ ${fileList.length} file.`
            + (allErrors.length ? ` Bỏ qua ${allErrors.length} lỗi/cảnh báo.` : '');
        setStatus(success, 'ok');
        showToast(`Đã nhập ${incoming.length} sinh viên.`);
    } catch (error) {
        const message = `Không đọc được file: ${(error as Error).message}`;
        setStatus(message, 'error');
        showToast(message);
    }
}

function exportStudentCSV(leadersOnly = false) {
    const students = leadersOnly
        ? state.students.filter((student: Student) => isLeaderPosition(student.position))
        : state.students;
    if (!students.length) {
        showToast(leadersOnly ? 'Chưa có cán sự để xuất.' : 'Chưa có sinh viên để xuất.');
        return;
    }
    const filename = `${leadersOnly ? 'CanSu' : 'SinhVien'}_${slugify(state.courseName)}_${dateToken()}.csv`;
    downloadFile('\uFEFF' + studentCSV(students), filename, 'text/csv;charset=utf-8');
    showToast(leadersOnly ? 'Đã xuất CSV ban cán sự.' : 'Đã xuất CSV sinh viên.');
}

// ============================================================
// BACKUP / SNAPSHOTS
// ============================================================
function captureSnapshot(reason: string, force = true): boolean {
    const snapshot = createSnapshot(buildPayload(), reason, force);
    if (!snapshot) return false;
    if (elements.backupModal && elements.backupModal.classList.contains('open')) {
        renderBackupList();
    }
    return true;
}

function renderBackupList() {
    if (!elements.backupListEl) return;

    const snapshots = listSnapshots(state.courseId);
    if (!snapshots.length) {
        elements.backupListEl.innerHTML = '<div class="empty-state">Chưa có bản sao lưu nào. Hệ thống sẽ tự tạo bản đầu tiên và tự sao lưu định kỳ khi có thay đổi.</div>';
        return;
    }

    elements.backupListEl.innerHTML = snapshots.map(snapshot => {
        const record = snapshot.record;
        const itemCount = Array.isArray(record.items) ? record.items.length : 0;
        const average = itemCount
            ? (record.items.reduce((sum, item) => sum + (Number(item.totalScore) || 0), 0) / itemCount).toFixed(2)
            : '0.00';
        return `
            <div class="backup-row">
                <div class="backup-main">
                    <div class="backup-title">${escapeHtml(snapshot.reason)}</div>
                    <div class="backup-meta">
                        ${escapeHtml(formatCourseDate(snapshot.createdAt))} · ${itemCount} trung đội · TB ${average}đ
                    </div>
                </div>
                <div class="backup-actions">
                    <button type="button" class="btn-course" data-backup-action="restore" data-backup-id="${escapeHtml(snapshot.id)}">Khôi phục</button>
                    <button type="button" class="btn-course danger" data-backup-action="delete" data-backup-id="${escapeHtml(snapshot.id)}">Xóa</button>
                </div>
            </div>
        `;
    }).join('');
}

function openBackupModal() {
    renderBackupList();
    elements.backupModal.classList.add('open');
}

function closeBackupModal() {
    elements.backupModal.classList.remove('open');
}

function createBackupNow() {
    if (captureSnapshot('Sao lưu thủ công', true)) {
        renderBackupList();
        showToast('Đã tạo bản sao lưu mới.');
    } else {
        showToast('Không thể tạo bản sao lưu. Bộ nhớ thiết bị có thể đã đầy.');
    }
}

async function restoreBackup(id: string) {
    if (state.locked) {
        showToast('Sổ điểm đã khóa. Hãy mở khóa trước khi khôi phục bản sao lưu.');
        return;
    }
    const snapshot = getSnapshot(state.courseId, id);
    if (!snapshot) {
        showToast('Không tìm thấy bản sao lưu này.');
        return;
    }

    const ok = await customConfirm(
        'Khôi Phục Bản Sao Lưu',
        `Khôi phục dữ liệu lúc ${formatCourseDate(snapshot.createdAt)}?\nDữ liệu hiện tại sẽ được tự động sao lưu trước khi khôi phục.`
    );
    if (!ok) return;

    captureSnapshot('Trước khi khôi phục', true);

    const record: CourseRecord = JSON.parse(JSON.stringify(snapshot.record));
    const now = new Date().toISOString();
    record.meta.id = state.courseId;
    record.meta.updatedAt = now;
    record.meta.settingsUpdatedAt = now;
    record.meta.itemsUpdatedAt = now;
    record.meta.studentsUpdatedAt = now;
    record.savedAt = now;
    record.items = (record.items || []).map(item => ({ ...item, updatedAt: now, updatedBy: state.graderName || 'Giảng viên' }));
    record.students = normalizeStudents(record.students).map(student => ({ ...student, updatedAt: now, updatedBy: state.graderName || 'Giảng viên' }));

    applyCourseRecord(record);
    logAudit('Khôi phục bản sao lưu', `Khôi phục bản lưu lúc ${formatCourseDate(snapshot.createdAt)}`);
    applyMetaToUI();
    renderBuildingPills();
    updateCalculations();
    render();
    closeBackupModal();
    showToast('Đã khôi phục bản sao lưu.');
}

async function removeBackup(id: string) {
    const snapshot = getSnapshot(state.courseId, id);
    if (!snapshot) return;

    const ok = await customConfirm(
        'Xóa Bản Sao Lưu',
        `Xóa bản sao lưu "${snapshot.reason}" lúc ${formatCourseDate(snapshot.createdAt)}?`
    );
    if (!ok) return;

    if (deleteSnapshot(state.courseId, id)) {
        renderBackupList();
        showToast('Đã xóa bản sao lưu.');
    } else {
        showToast('Không xóa được bản sao lưu.');
    }
}

// ============================================================
// CLOUD SYNC (SUPABASE - TÙY CHỌN)
// ============================================================
function setCloudStatus(status: CloudStatus | null) {
    if (!elements.cloudStatus) return;
    elements.cloudStatus.classList.toggle('ok', Boolean(status && status.ok));
    elements.cloudStatus.classList.toggle('error', Boolean(status && !status.ok));
    elements.cloudStatus.textContent = status ? status.message : '';
}

function readCloudForm(): CloudConfig {
    return {
        url: String(elements.cloudUrl.value || '').trim().replace(/\/+$/, ''),
        anonKey: String(elements.cloudAnonKey.value || '').trim(),
        table: String(elements.cloudTable.value || '').trim() || 'course_sync',
        syncId: String(elements.cloudSyncId.value || '').trim() || 'gdqpan',
        autoPush: Boolean(elements.cloudAutoPush.checked)
    };
}

function openCloudModal() {
    state.cloudConfig = loadCloudConfig();
    const config = state.cloudConfig;
    elements.cloudUrl.value = config.url || '';
    elements.cloudAnonKey.value = config.anonKey || '';
    elements.cloudTable.value = config.table || 'course_sync';
    elements.cloudSyncId.value = config.syncId || 'gdqpan';
    elements.cloudAutoPush.checked = Boolean(config.autoPush);
    setCloudStatus(isCloudConfigured(config)
        ? { ok: true, message: 'Đã có cấu hình. Có thể kiểm tra kết nối hoặc đồng bộ.' }
        : { ok: false, message: 'Chưa cấu hình Supabase. Điền URL, anon key và tạo bảng theo hướng dẫn.' });
    elements.cloudModal.classList.add('open');
}

function closeCloudModal() {
    elements.cloudModal.classList.remove('open');
}

function saveCloudForm() {
    const config = readCloudForm();
    if (!saveCloudConfig(config)) {
        setCloudStatus({ ok: false, message: 'Không lưu được cấu hình trên thiết bị này.' });
        return;
    }
    state.cloudConfig = config;
    setCloudStatus({ ok: true, message: 'Đã lưu cấu hình đồng bộ trên thiết bị.' });
    if (state.collabSettings.enabled) startCollab();
    renderCollabUI();
    showToast('Đã lưu cấu hình đồng bộ đám mây.');
}

async function testCloud() {
    const config = readCloudForm();
    saveCloudConfig(config);
    state.cloudConfig = config;
    setCloudStatus({ ok: true, message: 'Đang kiểm tra kết nối...' });
    const status = await testCloudConnection(config);
    setCloudStatus(status);
    if (status.ok && state.collabSettings.enabled) startCollab();
    showToast(status.message);
}

async function pushCloudNow() {
    const config = readCloudForm();
    saveCloudConfig(config);
    state.cloudConfig = config;

    if (!isCloudConfigured(config)) {
        setCloudStatus({ ok: false, message: 'Chưa điền đủ URL, anon key, bảng và mã đồng bộ.' });
        return;
    }

    if (!saveData()) {
        setCloudStatus({ ok: false, message: 'Không lưu được dữ liệu cục bộ trước khi đẩy lên.' });
        return;
    }

    setCloudStatus({ ok: true, message: 'Đang đẩy dữ liệu lên Supabase...' });
    const status = await pushCourse(buildPayload(), config);
    setCloudStatus(status);
    showToast(status.message);
}

async function pullCloudNow() {
    if (state.locked) {
        showToast('Sổ điểm đã khóa. Hãy mở khóa trước khi kéo dữ liệu đám mây.');
        return;
    }

    const config = readCloudForm();
    saveCloudConfig(config);
    state.cloudConfig = config;

    if (!isCloudConfigured(config)) {
        setCloudStatus({ ok: false, message: 'Chưa điền đủ URL, anon key, bảng và mã đồng bộ.' });
        return;
    }

    const ok = await customConfirm(
        'Kéo Dữ Liệu Từ Đám Mây',
        'Tải bản mới nhất của khóa hiện tại từ Supabase và thay thế dữ liệu trên thiết bị?\nDữ liệu hiện tại sẽ được sao lưu trước khi thay thế.'
    );
    if (!ok) return;

    setCloudStatus({ ok: true, message: 'Đang kéo dữ liệu từ Supabase...' });
    const result = await pullCourse(state.courseId, config);
    if (!result.ok || !result.record) {
        setCloudStatus(result);
        showToast(result.message);
        return;
    }

    captureSnapshot('Trước khi kéo dữ liệu đám mây', true);
    const record = result.record;
    const now = new Date().toISOString();
    record.meta.id = state.courseId;
    record.meta.updatedAt = now;
    record.meta.settingsUpdatedAt = now;
    record.meta.itemsUpdatedAt = now;
    record.meta.studentsUpdatedAt = now;
    record.savedAt = now;
    record.items = (record.items || []).map(item => ({ ...item, updatedAt: now, updatedBy: state.graderName || 'Giảng viên' }));
    record.students = normalizeStudents(record.students).map(student => ({ ...student, updatedAt: now, updatedBy: state.graderName || 'Giảng viên' }));

    applyCourseRecord(record);
    logAudit('Đồng bộ đám mây', 'Kéo dữ liệu khóa từ Supabase');
    applyMetaToUI();
    renderBuildingPills();
    updateCalculations();
    render();
    setCloudStatus({ ok: true, message: 'Đã kéo dữ liệu từ Supabase.' });
    showToast('Đã đồng bộ dữ liệu từ đám mây.');
}

// ============================================================
// COLLABORATION (SUPABASE REALTIME + REST)
// ============================================================
function collabIsConfigured(): boolean {
    return Boolean(state.cloudConfig && isCloudConfigured(state.cloudConfig));
}

function formatCollabTime(value: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function isRecordPristine(record: CourseRecord): boolean {
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

async function applyRemoteRecord(record: CourseRecord, info: { initial: boolean; name: string; updatedAt: string }): Promise<void> {
    const localRecord = buildPayload();
    const localGraderName = state.graderName || 'Giảng viên';
    const localPristine = isRecordPristine(localRecord);
    let target: CourseRecord = record;
    let localNewer = false;
    let remoteNewer = true;

    // Lần đầu bật cộng tác: nếu bản trên Supabase vẫn trống mà máy này đã có
    // điểm/sinh viên thì giữ dữ liệu cục bộ và đẩy lên làm bản gốc.
    if (info.initial && !localPristine && isRecordPristine(record)) {
        if (state.collabSession) state.collabSession.schedulePush(localRecord);
        return;
    }

    if (!(info.initial && localPristine)) {
        const merged = mergeCourseRecords(localRecord, record, { initial: info.initial });
        target = merged.record;
        localNewer = merged.localNewer;
        remoteNewer = merged.remoteNewer;
        if (!merged.changed) {
            if (localNewer && state.collabSession) state.collabSession.schedulePush(localRecord);
            return;
        }
    }

    target.meta.id = state.courseId;
    target.meta.graderName = localGraderName;
    state.applyingRemote = true;
    try {
        applyCourseRecord(target);
        state.graderName = localGraderName;
        applyMetaToUI();
        renderBuildingPills();
        updateCalculations();
        render();
        if (elements.gradingDrawer.classList.contains('open')) populateDrawer();
    } finally {
        state.applyingRemote = false;
    }

    if (localNewer && state.collabSession) {
        state.collabSession.schedulePush(buildPayload());
    }
    if (remoteNewer) {
        showToast(info.initial ? 'Đã tải dữ liệu cộng tác mới nhất.' : 'Đã nhận cập nhật từ cộng tác viên.');
    }
}

function renderCollabUI(): void {
    if (!elements.collabModal) return;

    const configured = collabIsConfigured();
    const active = Boolean(state.collabSession);
    const status = state.collabStatus as CollabStatus | null;
    const users: CollabUser[] = status && Array.isArray(status.users) ? status.users : [];
    const stateName = status ? status.state : 'off';

    let title = 'Chưa bật cộng tác';
    let text = 'Bật cộng tác để nhiều người cùng chỉnh sửa bảng điểm và danh sách sinh viên.';
    if (!configured) {
        title = 'Chưa cấu hình Supabase';
        text = 'Mở Cấu hình Supabase để nhập URL, anon key và bảng đồng bộ trước khi bật cộng tác.';
    } else if (!state.collabSettings.enabled) {
        title = 'Cộng tác đang tắt';
        text = 'Dữ liệu chỉ lưu trên thiết bị này. Bật cộng tác để làm việc cùng người khác.';
    } else if (status) {
        if (stateName === 'connected') {
            title = 'Đang cộng tác';
        } else if (stateName === 'connecting') {
            title = 'Đang kết nối...';
        } else if (stateName === 'error') {
            title = 'Cộng tác gặp lỗi';
        } else {
            title = 'Đã tắt cộng tác';
        }
        text = status.message || text;
    } else {
        title = 'Đang bật cộng tác...';
        text = 'Đang chuẩn bị kết nối tới Supabase.';
    }

    elements.collabStatusTitle.textContent = title;
    elements.collabStatusText.textContent = text;
    elements.collabStatusCard.classList.remove('connected', 'error', 'connecting', 'off');
    elements.collabStatusCard.classList.add(stateName === 'connected' ? 'connected' : stateName === 'error' ? 'error' : stateName === 'connecting' ? 'connecting' : 'off');
    elements.collabDot.className = `collab-dot ${stateName}`;
    elements.collabLastSync.textContent = status && status.lastSyncAt
        ? `Đồng bộ lần cuối: ${formatCollabTime(status.lastSyncAt)}`
        : 'Chưa có lần đồng bộ nào trong phiên này.';

    elements.btnCollabToggle.textContent = !configured ? 'Cấu hình Supabase' : active ? 'Tắt cộng tác' : 'Bật cộng tác';
    elements.btnCollabToggle.classList.toggle('primary', !active);
    elements.btnCollabToggle.classList.toggle('secondary', active);

    if (configured) {
        let host = state.cloudConfig.url;
        try { host = new URL(state.cloudConfig.url).host; } catch { /* giữ nguyên URL */ }
        elements.collabConfigLine.textContent = `Supabase: ${host} · bảng ${state.cloudConfig.table} · nhóm ${state.cloudConfig.syncId}`;
        elements.collabConfigLine.className = 'collab-config-line ok';
    } else {
        elements.collabConfigLine.textContent = 'Chưa có cấu hình Supabase. Bấm “Cấu hình Supabase” để thiết lập.';
        elements.collabConfigLine.className = 'collab-config-line missing';
    }

    if (!elements.collabDisplayName.value) {
        elements.collabDisplayName.value = state.collabSettings.displayName || state.graderName || 'Giảng viên';
    }
    elements.collabSyncId.value = state.cloudConfig ? state.cloudConfig.syncId : '';

    elements.collabUserCount.textContent = status && !status.realtime ? '—' : String(users.length);
    if (!active) {
        elements.collabUsers.innerHTML = '<div class="collab-empty">Bật cộng tác để xem những người đang online.</div>';
    } else if (!users.length) {
        elements.collabUsers.innerHTML = status && !status.realtime
            ? '<div class="collab-empty">Realtime chưa kết nối nên chưa xem được danh sách online. Dữ liệu vẫn đồng bộ qua Supabase mỗi 15 giây.</div>'
            : '<div class="collab-empty">Chỉ bạn đang online. Chờ người khác mở ứng dụng...</div>';
    } else {
        elements.collabUsers.innerHTML = users.map(user => `
            <div class="collab-user">
                <span class="collab-user-dot" style="background:${escapeHtml(user.color)}"></span>
                <span class="collab-user-name">${escapeHtml(user.name)}</span>
                ${user.isSelf ? '<span class="collab-user-self">Bạn</span>' : ''}
            </div>
        `).join('');
    }

    if (elements.collabIndicator) {
        elements.collabIndicator.hidden = !state.collabSettings.enabled;
        elements.collabIndicator.classList.toggle('connected', stateName === 'connected');
        elements.collabIndicator.classList.toggle('error', stateName === 'error');
        elements.collabIndicatorText.textContent = stateName === 'connected'
            ? `Cộng tác · ${Math.max(users.length, 1)}`
            : stateName === 'error'
                ? 'Cộng tác lỗi'
                : 'Đang kết nối';
        elements.collabIndicator.title = status ? status.message : 'Mở cộng tác nhóm';
    }
}

function openCollabModal(): void {
    state.collabSettings = loadCollabSettings();
    elements.collabDisplayName.value = state.collabSettings.displayName || state.graderName || 'Giảng viên';
    renderCollabUI();
    elements.collabModal.classList.add('open');
}

function closeCollabModal(): void {
    elements.collabModal.classList.remove('open');
}

function stopCollab(): void {
    const session = state.collabSession;
    state.collabSession = null;
    if (session) session.stop();
    state.collabStatus = null;
    renderCollabUI();
}

function startCollab(): void {
    if (!collabIsConfigured()) {
        state.collabStatus = null;
        renderCollabUI();
        return;
    }

    if (state.collabSession) {
        const oldSession = state.collabSession;
        state.collabSession = null;
        oldSession.stop();
    }

    const displayName = state.collabSettings.displayName || state.graderName || 'Giảng viên';
    state.collabStatus = {
        state: 'connecting',
        message: 'Đang kết nối tới Supabase...',
        users: [],
        lastSyncAt: '',
        realtime: false
    };
    state.collabSession = new CollabSession({
        config: state.cloudConfig as CloudConfig,
        courseId: state.courseId,
        displayName,
        getLocalRecord: () => buildPayload(),
        onStatus: status => {
            state.collabStatus = status;
            renderCollabUI();
        },
        onRemoteRecord: (record, info) => applyRemoteRecord(record, info)
    });
    renderCollabUI();
    void state.collabSession.start();
}

function maybeStartCollab(): void {
    if (state.collabSettings.enabled) {
        if (collabIsConfigured()) {
            startCollab();
        } else {
            state.collabSettings.enabled = false;
            saveCollabSettings(state.collabSettings);
            state.collabStatus = null;
            renderCollabUI();
        }
    } else {
        state.collabStatus = null;
        renderCollabUI();
    }
}

function toggleCollab(): void {
    if (state.collabSession) {
        state.collabSettings.enabled = false;
        saveCollabSettings(state.collabSettings);
        stopCollab();
        showToast('Đã tắt cộng tác nhóm.');
        return;
    }

    if (!collabIsConfigured()) {
        closeCollabModal();
        openCloudModal();
        showToast('Hãy cấu hình Supabase trước khi bật cộng tác.');
        return;
    }

    state.collabSettings.enabled = true;
    saveCollabSettings(state.collabSettings);
    startCollab();
    showToast('Đã bật cộng tác nhóm.');
}

function saveCollabDisplayName(): void {
    const name = String(elements.collabDisplayName.value || '').trim() || 'Giảng viên';
    state.collabSettings.displayName = name;
    saveCollabSettings(state.collabSettings);
    if (state.collabSession) state.collabSession.setDisplayName(name);
    renderCollabUI();
    showToast('Đã lưu tên hiển thị cộng tác.');
}

async function pullCollabNow(): Promise<void> {
    if (!state.collabSession) {
        showToast('Cộng tác chưa bật. Hãy bật cộng tác trước.');
        return;
    }
    const status = await state.collabSession.pullNow(false);
    showToast(status.message);
}

async function pushCollabNow(): Promise<void> {
    if (!state.collabSession) {
        showToast('Cộng tác chưa bật. Hãy bật cộng tác trước.');
        return;
    }
    if (!saveData()) {
        showToast('Không lưu được dữ liệu cục bộ trước khi đẩy.');
        return;
    }
    const status = await state.collabSession.pushNow(buildPayload());
    showToast(status.message);
}

// ============================================================
// AUDIT LOG & SCORE LOCK
// ============================================================
function logAudit(action: string, detail: string) {
    state.audit = appendAuditEntry(
        state.audit,
        createAuditEntry(action, detail, state.graderName || 'Giảng viên')
    );
}

function renderAuditList() {
    if (!elements.auditListEl) return;

    const entries = Array.isArray(state.audit)
        ? state.audit.slice(-200).reverse()
        : [];

    if (!entries.length) {
        elements.auditListEl.innerHTML = '<div class="empty-state">Chưa có ghi nhận thay đổi nào.</div>';
        return;
    }

    elements.auditListEl.innerHTML = entries.map(entry => `
        <div class="audit-row">
            <div class="audit-top">
                <span class="audit-action">${escapeHtml(entry.action || 'Thay đổi')}</span>
                <span class="audit-time">${escapeHtml(formatCourseDate(entry.at))}</span>
            </div>
            <div class="audit-detail">${escapeHtml(entry.detail || '')}</div>
            <div class="audit-actor">${escapeHtml(entry.actor || 'Giảng viên')}</div>
        </div>
    `).join('');
}

function updateDrawerLockUI() {
    const locked = Boolean(state.locked);
    if (elements.gradingDrawer) elements.gradingDrawer.classList.toggle('locked', locked);
    if (elements.drawerLockNotice) elements.drawerLockNotice.hidden = !locked;

    [
        elements.drawerQuanSo,
        elements.drawerHocTap,
        elements.drawerRenLuyen,
        elements.drawerNvvs,
        elements.drawerLeTiet,
        elements.drawerNote
    ].forEach(input => {
        if (input) input.disabled = locked;
    });

    document.querySelectorAll('.btn-quick-deduct').forEach(button => {
        (button as HTMLButtonElement).disabled = locked;
    });

    if (elements.btnSaveNext) {
        elements.btnSaveNext.disabled = locked;
        elements.btnSaveNext.innerHTML = locked
            ? 'Sổ đã khóa'
            : '<span>Lưu &amp; Sang Phòng Tiếp</span> ›';
    }
}

function renderLockUI() {
    const locked = Boolean(state.locked);
    if (elements.lockBadge) elements.lockBadge.hidden = !locked;
    if (elements.lockNotice) elements.lockNotice.hidden = !locked;
    document.body.classList.toggle('score-locked', locked);

    if (elements.lockStatusText) {
        elements.lockStatusText.textContent = locked ? 'Sổ điểm đã khóa' : 'Sổ điểm đang mở';
    }
    if (elements.lockStatusDetail) {
        elements.lockStatusDetail.textContent = locked && state.lockedAt
            ? `Khóa lúc ${formatCourseDate(state.lockedAt)} bởi ${state.lockedBy || state.graderName || 'Giảng viên'}.`
            : 'Có thể chấm điểm và sửa dữ liệu. Hãy khóa sổ sau khi hoàn tất để tránh sửa nhầm.';
    }
    if (elements.btnToggleLock) {
        elements.btnToggleLock.textContent = locked ? 'Mở khóa sổ điểm' : 'Khóa sổ điểm';
        elements.btnToggleLock.className = `btn-modal ${locked ? 'secondary' : 'danger'}`;
    }
    if (elements.auditGraderName && document.activeElement !== elements.auditGraderName) {
        elements.auditGraderName.value = state.graderName || 'Giảng viên';
    }
    if (elements.btnSaveSettings) elements.btnSaveSettings.disabled = locked;

    updateDrawerLockUI();
}

function openAuditModal() {
    renderAuditList();
    renderLockUI();
    elements.auditModal.classList.add('open');
}

function closeAuditModal() {
    elements.auditModal.classList.remove('open');
}

async function toggleLock() {
    const nextLocked = !state.locked;
    const ok = await customConfirm(
        nextLocked ? 'Khóa Sổ Điểm' : 'Mở Khóa Sổ Điểm',
        nextLocked
            ? 'Khóa sổ điểm của khóa hiện tại?\nSau khi khóa, các thao tác chấm điểm, sửa quân số, nhập Excel và đổi cấu hình sẽ bị chặn cho đến khi mở khóa.'
            : 'Mở khóa sổ điểm để tiếp tục chấm điểm và chỉnh sửa?'
    );
    if (!ok) return;

    state.locked = nextLocked;
    state.settingsUpdatedAt = new Date().toISOString();
    if (nextLocked) {
        state.lockedAt = new Date().toISOString();
        state.lockedBy = state.graderName || 'Giảng viên';
        logAudit('Khóa sổ điểm', `Khóa bởi ${state.lockedBy}`);
    } else {
        state.lockedAt = '';
        state.lockedBy = '';
        logAudit('Mở khóa sổ điểm', `Mở bởi ${state.graderName || 'Giảng viên'}`);
    }

    saveData();
    renderCourseSelect();
    renderCourseList();
    renderLockUI();
    renderAuditList();
    render();
    showToast(nextLocked ? 'Đã khóa sổ điểm.' : 'Đã mở khóa sổ điểm.');
}

function saveGraderName() {
    const name = String(elements.auditGraderName.value || '').trim() || 'Giảng viên';
    if (name === state.graderName) {
        showToast('Tên người chấm không thay đổi.');
        return;
    }

    const oldName = state.graderName || 'Giảng viên';
    state.graderName = name;
    if (!state.collabSettings.displayName && state.collabSession) {
        state.collabSession.setDisplayName(name);
    }
    logAudit('Đổi người chấm', `${oldName} → ${name}`);
    saveData();
    renderLockUI();
    renderAuditList();
    renderCollabUI();
    showToast('Đã lưu tên người chấm.');
}

function exportAuditCSV() {
    const rows = [
        ['Thời gian', 'Hành động', 'Chi tiết', 'Người thực hiện'],
        ...(state.audit || []).map(entry => [
            formatCourseDate(entry.at),
            entry.action,
            entry.detail,
            entry.actor
        ])
    ];
    const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    const filename = `NhatKy_${slugify(state.courseName)}_${dateToken()}.csv`;
    downloadFile(csv, filename, 'text/csv;charset=utf-8');
    showToast('Đã xuất nhật ký CSV.');
}

// ============================================================
// CALCULATIONS, STATS & FILTERS
// ============================================================
function updateCalculations() {
    state.items = recalculateScores(state.items, state.baseScore);
    updateStats();
    saveData();
}

function updateStats() {
    const stats = calculateScoreStats(state.items, state.baseScore);
    elements.statQuanSo.textContent = `${stats.present}/${stats.total}`;
    elements.statAvgScore.textContent = stats.average.toFixed(2);
    elements.statPerfect.textContent = String(stats.perfect);
    elements.statDeducted.textContent = String(stats.deducted);
}

function getFilteredItems() {
    const query = normalizeText(state.searchQuery);
    const bMatch = /^b(\d+)$/.exec(query);
    const numericQuery = /^\d+$/.test(query);
    const idQuery = bMatch ? Number(bMatch[1]) : (numericQuery ? Number(query) : null);

    return state.items.filter(item => {
        if (state.activeBuilding !== 'ALL' && item.building !== state.activeBuilding) {
            return false;
        }
        if (!query) return true;

        const idMatch = idQuery !== null && idQuery === item.id;
        const roomTokens = normalizeText(item.rooms).split(/[,\s]+/).filter(Boolean);
        const roomMatch = roomTokens.includes(query);
        const buildingMatch = normalizeText(item.building).includes(query);
        const noteMatch = normalizeText(item.note).includes(query);

        return idMatch || roomMatch || buildingMatch || noteMatch;
    });
}

function renderBuildingPills() {
    const counts = new Map();
    state.items.forEach(item => {
        counts.set(item.building, (counts.get(item.building) || 0) + 1);
    });

    if (state.activeBuilding !== 'ALL' && !counts.has(state.activeBuilding)) {
        state.activeBuilding = 'ALL';
    }

    let html = `<button type="button" class="pill-btn ${state.activeBuilding === 'ALL' ? 'active' : ''}" data-b="ALL">
        Tất Cả <span class="pill-badge">${state.items.length}</span>
    </button>`;

    counts.forEach((count, building) => {
        const label = building || 'Chưa xếp tòa';
        html += `<button type="button" class="pill-btn ${state.activeBuilding === building ? 'active' : ''}" data-b="${escapeHtml(building)}">
            ${escapeHtml(label)} <span class="pill-badge">${count}</span>
        </button>`;
    });

    elements.buildingPills.innerHTML = html;
}

// ============================================================
// RENDER: CARDS / TABLE
// ============================================================
function render() {
    const filtered = getFilteredItems();
    if (elements.listCount) {
        elements.listCount.textContent = `${filtered.length} trung đội`;
    }

    if (state.viewMode === 'cards') {
        elements.cardsList.style.display = 'grid';
        elements.tableCard.style.display = 'none';
        renderCards(filtered);
    } else {
        elements.cardsList.style.display = 'none';
        elements.tableCard.style.display = 'block';
        renderTable(filtered);
    }
}

function scheduleRender() {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
        renderTimer = null;
        render();
    }, 140);
}

function renderCards(items) {
    if (!items.length) {
        elements.cardsList.innerHTML = `<div class="empty-state">Không tìm thấy trung đội phù hợp. Hãy xóa bộ lọc hoặc từ khóa tìm kiếm.</div>`;
        return;
    }

    elements.cardsList.innerHTML = items.map(item => {
        const isDeducted = item.totalScore < state.baseScore;
        const isTop1 = item.rank === 1;
        const studentCount = countStudentsForPlatoon(state.students, item);

        const breakdownValues = [
            ['HT', item.hocTap],
            ['RL', item.renLuyen],
            ['NVVS', item.nvvs],
            ['LT', item.leTiet]
        ].filter(entry => entry[1] !== 0);

        const breakdownHtml = breakdownValues.length
            ? breakdownValues.map(entry => `<span class="break-item">${entry[0]}: ${entry[1] > 0 ? '+' : ''}${formatNum(entry[1])}</span>`).join('')
            : `<span class="break-item clean">Không vi phạm (${formatNum(state.baseScore)}đ)</span>`;

        const noteHtml = item.note
            ? `<div class="card-note"><strong>Ghi chú:</strong> ${formatNoteHtml(item.note)}</div>`
            : '';

        return `
            <div class="platoon-card ${isTop1 ? 'rank-1' : (isDeducted ? 'deducted' : '')}">
                <div class="card-header">
                    <div>
                        <div class="platoon-badges">
                            <span class="badge-id">Trung Đội ${item.id}</span>
                            <span class="badge-building">${escapeHtml(item.building || 'Chưa xếp tòa')}</span>
                            <span class="badge-qs">QS: ${escapeHtml(item.quanSo || '—')}</span>
                            <button type="button" class="badge-students" onclick="openStudentsForPlatoon(${item.id})" title="Xem danh sách sinh viên của trung đội">SV: ${studentCount}</button>
                        </div>
                        <div class="card-room-info">Phòng: ${escapeHtml(item.rooms || '—')}</div>
                    </div>

                    <div class="card-score-box">
                        <div class="score-num ${isDeducted ? 'deducted' : 'perfect'}">${formatNum(item.totalScore)}</div>
                        <div class="rank-badge ${isTop1 ? 'top-1' : (item.rank <= 3 ? 'top-3' : '')}">
                            ${isTop1 ? '★ ' : ''}Hạng ${item.rank}
                        </div>
                    </div>
                </div>

                ${noteHtml}

                <div class="card-footer">
                    <div class="scores-breakdown">${breakdownHtml}</div>
                    <button class="btn-grade-card" onclick="openDrawerById(${item.id})" ${state.locked ? 'title="Sổ điểm đã khóa"' : ''}>
                        ${state.locked ? '🔒 Xem Điểm' : '✎ Chấm Điểm'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderTable(items) {
    if (!items.length) {
        elements.tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:24px; color:#64748b;">Không tìm thấy trung đội phù hợp.</td></tr>`;
        return;
    }

    elements.tableBody.innerHTML = items.map(item => {
        const noteIcon = item.note
            ? ` <span title="${escapeHtml(item.note)}" style="color:#b45309; cursor:help;">✎</span>`
            : '';

        return `
            <tr>
                <td style="text-align:center; font-weight:800;">${item.id}${noteIcon}</td>
                <td>
                    <strong style="color:#0f172a;">B${item.id} (${escapeHtml(item.building)})</strong>
                    <div style="font-size:10px; color:#64748b;">P. ${escapeHtml(item.rooms)}</div>
                    <button type="button" class="table-student-link" onclick="openStudentsForPlatoon(${item.id})">SV: ${countStudentsForPlatoon(state.students, item)}</button>
                </td>
                <td style="text-align:center;">
                    <input type="text" class="table-input" inputmode="numeric" value="${escapeHtml(item.quanSo)}" onchange="updateItemQuanSo(${item.id}, this.value)" ${state.locked ? 'disabled' : ''}>
                </td>
                <td style="text-align:center;">
                    <input type="number" step="0.1" class="table-input ${item.hocTap < 0 ? 'neg' : ''}" value="${formatNum(item.hocTap)}" onchange="updateItemCat(${item.id}, 'hocTap', this.value)" ${state.locked ? 'disabled' : ''}>
                </td>
                <td style="text-align:center;">
                    <input type="number" step="0.1" class="table-input ${item.renLuyen < 0 ? 'neg' : ''}" value="${formatNum(item.renLuyen)}" onchange="updateItemCat(${item.id}, 'renLuyen', this.value)" ${state.locked ? 'disabled' : ''}>
                </td>
                <td style="text-align:center;">
                    <input type="number" step="0.1" class="table-input ${item.nvvs < 0 ? 'neg' : ''}" value="${formatNum(item.nvvs)}" onchange="updateItemCat(${item.id}, 'nvvs', this.value)" ${state.locked ? 'disabled' : ''}>
                </td>
                <td style="text-align:center;">
                    <input type="number" step="0.1" class="table-input ${item.leTiet < 0 ? 'neg' : ''}" value="${formatNum(item.leTiet)}" onchange="updateItemCat(${item.id}, 'leTiet', this.value)" ${state.locked ? 'disabled' : ''}>
                </td>
                <td style="text-align:center; font-weight:900; ${item.totalScore < state.baseScore ? 'color:var(--danger-red)' : 'color:var(--primary-dark)'}">
                    ${formatNum(item.totalScore)}
                </td>
                <td style="text-align:center; font-weight:800;">${item.rank}</td>
                <td style="text-align:center;">
                    <button class="btn-grade-card" style="padding:4px 8px;" onclick="openDrawerById(${item.id})">${state.locked ? '🔒' : '✎'}</button>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================================
// DRAWER / GRADING
// ============================================================
function getActiveItem() {
    return state.items.find(item => item.id === state.activeItemId) || null;
}

function openDrawerById(id) {
    const filtered = getFilteredItems();
    const index = filtered.findIndex(item => item.id === id);
    if (index === -1) return;

    state.activeItemId = id;
    state.activeModalIndex = index;
    populateDrawer();
    elements.gradingDrawer.classList.add('open');
    if (elements.drawerBody) elements.drawerBody.scrollTop = 0;
}

function populateDrawer() {
    const item = getActiveItem();
    if (!item) return;

    elements.drawerPName.textContent = `Trung Đội ${item.id}`;
    elements.drawerPRooms.textContent = `${item.building || 'Chưa xếp tòa'} - Phòng ${item.rooms || '—'}`;
    elements.drawerQuanSo.value = item.quanSo || '';
    elements.drawerHocTap.value = item.hocTap;
    elements.drawerRenLuyen.value = item.renLuyen;
    elements.drawerNvvs.value = item.nvvs;
    elements.drawerLeTiet.value = item.leTiet;
    elements.drawerNote.value = item.note || '';

    refreshDrawerHeader();
    state.drawerOriginal = { ...item };
    updateDrawerLockUI();

    const filtered = getFilteredItems();
    state.activeModalIndex = filtered.findIndex(entry => entry.id === state.activeItemId);
    elements.btnPrevPlatoon.disabled = state.activeModalIndex <= 0;
    elements.btnNextPlatoon.disabled = state.activeModalIndex === -1 || state.activeModalIndex >= filtered.length - 1;
}

function refreshDrawerHeader() {
    const item = getActiveItem();
    if (!item) return;

    elements.drawerScoreVal.textContent = `${formatNum(item.totalScore)} / ${formatNum(state.baseScore)}`;
    elements.drawerRankVal.textContent = `Hạng ${item.rank}`;

    const categoryInputs = [
        ['hocTap', elements.drawerHocTap],
        ['renLuyen', elements.drawerRenLuyen],
        ['nvvs', elements.drawerNvvs],
        ['leTiet', elements.drawerLeTiet]
    ];

    categoryInputs.forEach(entry => {
        entry[1].className = `grading-num-input ${item[entry[0]] < 0 ? 'neg' : ''}`;
    });
}

function saveDrawerCurrentValues(options: any = {}) {
    const opts = options || {};
    const item = getActiveItem();
    if (!item) return false;
    if (state.locked) return false;

    const original = state.drawerOriginal || { ...item };
    const categoryInputs = [
        ['hocTap', elements.drawerHocTap],
        ['renLuyen', elements.drawerRenLuyen],
        ['nvvs', elements.drawerNvvs],
        ['leTiet', elements.drawerLeTiet]
    ];

    const parsedValues = {};
    for (const entry of categoryInputs) {
        const category = entry[0];
        const raw = String(entry[1].value).trim();

        if (raw === '') {
            parsedValues[category] = 0;
            continue;
        }
        if (!isNumericDraft(raw)) {
            if (!opts.normalize) return false;
            parsedValues[category] = 0;
            continue;
        }
        parsedValues[category] = parseScoreVal(raw);
    }

    const quanSoRaw = String(elements.drawerQuanSo.value).trim();
    if (quanSoRaw === '') {
        item.quanSo = '';
    } else {
        const normalizedQuanSo = normalizeQuanSo(quanSoRaw);
        if (normalizedQuanSo !== null) {
            item.quanSo = normalizedQuanSo;
        } else if (opts.normalize) {
            showToast('Quân số phải có dạng 30/31');
        }
    }

    categoryInputs.forEach(entry => {
        item[entry[0]] = parsedValues[entry[0]];
    });
    item.note = String(elements.drawerNote.value).trim();
    item.updatedAt = new Date().toISOString();
    item.updatedBy = state.graderName || 'Giảng viên';

    if (opts.normalize) {
        const labels = { hocTap: 'Học tập', renLuyen: 'Rèn luyện', nvvs: 'NVVS', leTiet: 'Lễ tiết' };
        const changes: string[] = [];

        categoryInputs.forEach(entry => {
            const category = entry[0];
            if (Number(original[category]) !== Number(item[category])) {
                changes.push(`${labels[category]}: ${formatNum(original[category])} → ${formatNum(item[category])}`);
            }
        });
        if (String(original.quanSo || '') !== String(item.quanSo || '')) {
            changes.push(`Quân số: ${original.quanSo || '—'} → ${item.quanSo || '—'}`);
        }
        if (String(original.note || '') !== String(item.note || '')) {
            changes.push('Ghi chú đã thay đổi');
        }

        if (changes.length) {
            logAudit('Sửa điểm', `TĐ ${item.id} · ${changes.join('; ')}`);
            state.drawerOriginal = { ...item };
        }
    }

    updateCalculations();
    refreshDrawerHeader();

    if (opts.normalize) {
        elements.drawerQuanSo.value = item.quanSo;
        categoryInputs.forEach(entry => {
            entry[1].value = item[entry[0]];
            entry[1].className = `grading-num-input ${item[entry[0]] < 0 ? 'neg' : ''}`;
        });
    }

    return true;
}

function closeDrawer() {
    saveDrawerCurrentValues({ normalize: true });
    elements.gradingDrawer.classList.remove('open');
    render();
}

function goToPrevPlatoon() {
    if (state.activeModalIndex <= 0) return;
    saveDrawerCurrentValues({ normalize: true });
    const filtered = getFilteredItems();
    const currentIndex = filtered.findIndex(item => item.id === state.activeItemId);
    if (currentIndex <= 0) return;
    state.activeItemId = filtered[currentIndex - 1].id;
    state.activeModalIndex = currentIndex - 1;
    populateDrawer();
    render();
}

function goToNextPlatoon() {
    saveDrawerCurrentValues({ normalize: true });
    const filtered = getFilteredItems();
    const currentIndex = filtered.findIndex(item => item.id === state.activeItemId);
    if (currentIndex === -1 || currentIndex >= filtered.length - 1) return;
    state.activeItemId = filtered[currentIndex + 1].id;
    state.activeModalIndex = currentIndex + 1;
    populateDrawer();
    render();
}

function saveAndGoNext() {
    saveDrawerCurrentValues({ normalize: true });
    const filtered = getFilteredItems();
    const currentIndex = filtered.findIndex(item => item.id === state.activeItemId);

    if (currentIndex !== -1 && currentIndex < filtered.length - 1) {
        state.activeItemId = filtered[currentIndex + 1].id;
        state.activeModalIndex = currentIndex + 1;
        populateDrawer();
        render();
        showToast(`Đã lưu & chuyển sang Trung đội ${state.activeItemId}`);
    } else {
        elements.gradingDrawer.classList.remove('open');
        render();
        showToast('Đã chấm xong trung đội cuối cùng!');
    }
}

function updateItemQuanSo(id, value) {
    if (state.locked) {
        showToast('Sổ điểm đã khóa. Hãy mở khóa trước khi sửa quân số.');
        render();
        return;
    }

    const item = state.items.find(entry => entry.id === id);
    if (!item) return;

    const oldValue = item.quanSo;
    const raw = String(value).trim();
    if (raw === '') {
        item.quanSo = '';
    } else {
        const normalized = normalizeQuanSo(raw);
        if (normalized === null) {
            showToast('Quân số phải có dạng 30/31');
            render();
            return;
        }
        item.quanSo = normalized;
    }

    if (String(oldValue || '') !== String(item.quanSo || '')) {
        item.updatedAt = new Date().toISOString();
        item.updatedBy = state.graderName || 'Giảng viên';
        logAudit('Sửa quân số', `TĐ ${id}: ${oldValue || '—'} → ${item.quanSo || '—'}`);
    }

    updateCalculations();
    render();
}

function updateItemCat(id, category, value) {
    if (state.locked) {
        showToast('Sổ điểm đã khóa. Hãy mở khóa trước khi sửa điểm.');
        render();
        return;
    }

    const item = state.items.find(entry => entry.id === id);
    if (!item) return;

    const labels = { hocTap: 'Học tập', renLuyen: 'Rèn luyện', nvvs: 'NVVS', leTiet: 'Lễ tiết' };
    const oldValue = item[category];
    item[category] = parseScoreVal(value);
    if (Number(oldValue) !== Number(item[category])) {
        item.updatedAt = new Date().toISOString();
        item.updatedBy = state.graderName || 'Giảng viên';
        logAudit('Sửa điểm', `TĐ ${id} · ${labels[category] || category}: ${formatNum(oldValue)} → ${formatNum(item[category])}`);
    }
    updateCalculations();
    render();
}

// ============================================================
// SETTINGS
// ============================================================
function openSettings() {
    elements.setCourseName.value = state.courseName;
    elements.setUnitName.value = state.unitName;
    elements.setBaseScore.value = state.baseScore;
    elements.setNgay.value = state.date.ngay;
    elements.setThang.value = state.date.thang;
    elements.setNam.value = state.date.nam;
    elements.setPlatoons.value = [...state.items]
        .sort((a, b) => a.id - b.id)
        .map(item => `${item.id} | ${item.building} | ${item.rooms} | ${item.quanSo}`)
        .join('\n');

    elements.settingsError.classList.remove('show');
    elements.settingsError.textContent = '';
    elements.settingsModal.classList.add('open');
    setTimeout(() => elements.setCourseName.focus(), 60);
}

function closeSettings() {
    elements.settingsModal.classList.remove('open');
}

function showSettingsError(errors) {
    const list = errors.slice(0, 6).join('\n');
    const suffix = errors.length > 6 ? `\n... và ${errors.length - 6} lỗi khác.` : '';
    elements.settingsError.textContent = list + suffix;
    elements.settingsError.classList.add('show');
}

function parsePlatoonConfig(text) {
    const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
    const items = [];
    const errors = [];
    const seenIds = new Set();

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        const parts = trimmed.split(/\s*[|;\t]\s*/).map(part => part.trim());
        if (parts.length < 3) {
            errors.push(`Dòng ${index + 1}: cần ít nhất 3 cột (Số TĐ | Tòa | Phòng).`);
            return;
        }

        const id = Number(parts[0]);
        if (!Number.isInteger(id) || id <= 0) {
            errors.push(`Dòng ${index + 1}: số trung đội không hợp lệ.`);
            return;
        }
        if (seenIds.has(id)) {
            errors.push(`Dòng ${index + 1}: trùng số trung đội ${id}.`);
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
        items.push({ id, building, rooms, quanSo });
    });

    if (!items.length && !errors.length) {
        errors.push('Danh sách trung đội đang trống.');
    }

    items.sort((a, b) => a.id - b.id);
    return { items, errors };
}

async function saveSettings() {
    if (state.locked) {
        showSettingsError(['Sổ điểm đã khóa. Hãy mở khóa trong mục Nhật Ký & Khóa Sổ trước khi đổi cấu hình.']);
        return;
    }

    const parsed = parsePlatoonConfig(elements.setPlatoons.value);
    if (parsed.errors.length) {
        showSettingsError(parsed.errors);
        return;
    }

    const baseScore = Number(elements.setBaseScore.value);
    if (!Number.isFinite(baseScore) || baseScore <= 0) {
        showSettingsError(['Điểm gốc phải là số lớn hơn 0.']);
        return;
    }

    const courseName = elements.setCourseName.value.trim() || DEFAULT_META.courseName;
    const unitName = elements.setUnitName.value.trim() || DEFAULT_META.unitName;
    const oldCourseName = state.courseName;
    const oldBaseScore = state.baseScore;
    const oldItemCount = state.items.length;
    const existingById: Map<number, any> = new Map(state.items.map((item: any) => [item.id, item]));
    const newIds = new Set(parsed.items.map(item => item.id));
    const removedWithData = state.items.filter(item => {
        if (newIds.has(item.id)) return false;
        return item.hocTap !== 0 || item.renLuyen !== 0 || item.nvvs !== 0 || item.leTiet !== 0 || item.note;
    });

    if (removedWithData.length) {
        const ok = await customConfirm(
            'Thay Đổi Danh Sách Trung Đội',
            `Có ${removedWithData.length} trung đội đang có điểm/ghi chú sẽ bị xóa khỏi danh sách.\nBạn có chắc chắn muốn tiếp tục?`
        );
        if (!ok) return;
    }

    captureSnapshot('Trước khi đổi cấu hình', true);

    const now = new Date().toISOString();
    state.items = parsed.items.map((entry: any) => {
        const old: any = existingById.get(entry.id);
        const next = {
            id: entry.id,
            building: entry.building,
            rooms: entry.rooms,
            quanSo: entry.quanSo || (old ? old.quanSo : '0/0'),
            hocTap: old ? old.hocTap : 0,
            renLuyen: old ? old.renLuyen : 0,
            nvvs: old ? old.nvvs : 0,
            leTiet: old ? old.leTiet : 0,
            note: old ? old.note : '',
            totalScore: 0,
            rank: 1,
            updatedAt: old ? String(old.updatedAt || '') : now,
            updatedBy: old ? String(old.updatedBy || '') : (state.graderName || 'Giảng viên')
        };
        const changed = !old || ['building', 'rooms', 'quanSo', 'hocTap', 'renLuyen', 'nvvs', 'leTiet', 'note']
            .some(field => String(old[field] ?? '') !== String(next[field] ?? ''));
        if (changed) {
            next.updatedAt = now;
            next.updatedBy = state.graderName || 'Giảng viên';
        }
        return next;
    });

    state.settingsUpdatedAt = now;
    state.itemsUpdatedAt = now;
    state.baseScore = round1(baseScore);
    state.courseName = courseName;
    state.unitName = unitName;
    state.date.ngay = clampInt(elements.setNgay.value, 1, 31, state.date.ngay);
    state.date.thang = clampInt(elements.setThang.value, 1, 12, state.date.thang);
    state.date.nam = clampInt(elements.setNam.value, 2000, 2100, state.date.nam);
    state.activeItemId = null;
    state.activeModalIndex = -1;

    if (state.activeBuilding !== 'ALL' && !state.items.some(item => item.building === state.activeBuilding)) {
        state.activeBuilding = 'ALL';
    }

    logAudit(
        'Đổi cấu hình',
        `Khóa: ${oldCourseName} → ${state.courseName}; điểm gốc: ${formatNum(oldBaseScore)} → ${formatNum(state.baseScore)}; số TĐ: ${oldItemCount} → ${state.items.length}`
    );

    updateCalculations();
    applyMetaToUI();
    renderBuildingPills();
    render();
    closeSettings();
    showToast(`Đã lưu cấu hình: ${state.courseName}`);
}

function restorePresetList() {
    elements.setPlatoons.value = PLATOONS_PRESET
        .map(item => `${item.id} | ${item.building} | ${item.rooms} | ${item.defaultQuanSo}`)
        .join('\n');
    elements.settingsError.classList.remove('show');
    showToast('Đã nạp mẫu K337. Bấm "Lưu Cấu Hình" để áp dụng.');
}

// ============================================================
// IMPORT / EXPORT / PRINT
// ============================================================
function exportJSON() {
    const filename = `ThiDua_${slugify(state.courseName)}_${dateToken()}.json`;
    downloadFile(JSON.stringify(buildPayload(), null, 2), filename, 'application/json;charset=utf-8');
    showToast('Đã xuất file sao lưu JSON!');
}

function csvCell(value) {
    const text = String(value === undefined || value === null ? '' : value);
    if (/[",\r\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

function exportCSV() {
    const rows = [
        [`Khóa: ${state.courseName}`],
        [`Đơn vị: ${state.unitName}`],
        [`Ngày: ${pad2(state.date.ngay)}/${pad2(state.date.thang)}/${state.date.nam}`],
        [],
        ['TĐ', 'Tòa', 'Phòng', 'Quân số', 'Học tập', 'Rèn luyện', 'NVVS', 'Lễ tiết', 'Tổng điểm', 'Hạng', 'Ghi chú']
    ];

    state.items.forEach(item => {
        rows.push([
            item.id,
            item.building,
            item.rooms,
            item.quanSo,
            formatNum(item.hocTap),
            formatNum(item.renLuyen),
            formatNum(item.nvvs),
            formatNum(item.leTiet),
            formatNum(item.totalScore),
            item.rank,
            item.note
        ]);
    });

    const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    const filename = `ThiDua_${slugify(state.courseName)}_${dateToken()}.csv`;
    downloadFile(csv, filename, 'text/csv;charset=utf-8');
    showToast('Đã xuất file CSV cho Excel!');
}

function printReport() {
    updatePrintDate();
    elements.printCourse.textContent = state.courseName;
    elements.printUnit.textContent = state.unitName;

    elements.printTableBody.innerHTML = state.items.map(item => `
        <tr>
            <td style="font-weight:bold;">
                ${item.id}
                <div style="font-size:7pt; font-weight:normal;">${escapeHtml(item.building.replace(/^To[àa]\s*/i, ''))}</div>
            </td>
            <td>${escapeHtml(item.quanSo || '')}</td>
            <td>${item.hocTap !== 0 ? formatNum(item.hocTap) : ''}</td>
            <td>${item.renLuyen !== 0 ? formatNum(item.renLuyen) : ''}</td>
            <td>${item.nvvs !== 0 ? formatNum(item.nvvs) : ''}</td>
            <td>${item.leTiet !== 0 ? formatNum(item.leTiet) : ''}</td>
            <td style="font-weight:bold;">${formatNum(item.totalScore)}</td>
            <td>${item.rank}</td>
        </tr>
    `).join('');

    window.print();
}

async function importFromFile(file) {
    if (!file) return;
    if (state.locked) {
        showToast('Sổ điểm đã khóa. Hãy mở khóa trước khi nhập file sao lưu.');
        return;
    }

    let text = '';
    try {
        text = await readFileAsText(file);
    } catch (error) {
        showToast('Không đọc được file. Vui lòng thử lại.');
        return;
    }

    let payload = null;
    try {
        payload = JSON.parse(text);
    } catch (error) {
        showToast('File JSON không hợp lệ!');
        return;
    }

    const rawItems = Array.isArray(payload)
        ? payload
        : (payload && Array.isArray(payload.items) ? payload.items : null);

    if (!rawItems || !rawItems.length) {
        showToast('File không có dữ liệu trung đội!');
        return;
    }

    const items = [];
    const seenIds = new Set();
    rawItems.forEach(raw => {
        const item = normalizeItem(raw);
        if (item && !seenIds.has(item.id)) {
            seenIds.add(item.id);
            items.push(item);
        }
    });

    if (!items.length) {
        showToast('File không có dữ liệu hợp lệ!');
        return;
    }

    const rawStudents = (!Array.isArray(payload) && Array.isArray(payload.students)) ? payload.students : [];
    const students = normalizeStudents(rawStudents);
    const ok = await customConfirm(
        'Nhập Dữ Liệu Sao Lưu',
        `Thay thế toàn bộ dữ liệu hiện tại bằng ${items.length} trung đội và ${students.length} sinh viên từ file?\nThao tác này không thể hoàn tác.`
    );
    if (!ok) return;

    captureSnapshot('Trước khi nhập file sao lưu', true);

    const meta = (!Array.isArray(payload) && payload.meta && typeof payload.meta === 'object')
        ? payload.meta
        : null;

    const now = new Date().toISOString();
    state.items = items.map(item => ({ ...item, updatedAt: now, updatedBy: state.graderName || 'Giảng viên' }));
    state.students = students.map(student => ({ ...student, updatedAt: now, updatedBy: state.graderName || 'Giảng viên' }));
    state.studentsUpdatedAt = now;
    state.itemsUpdatedAt = now;
    state.settingsUpdatedAt = now;
    state.activeItemId = null;
    state.activeModalIndex = -1;
    if (meta) {
        applyMetaValues(meta);
    }
    state.searchQuery = '';
    elements.searchInput.value = '';
    elements.btnClearSearch.style.display = 'none';

    logAudit('Nhập file sao lưu', `${items.length} trung đội, ${students.length} sinh viên từ ${file.name}`);
    updateCalculations();
    applyMetaToUI();
    renderBuildingPills();
    render();
    saveData();
    showToast(`Đã nhập ${items.length} trung đội từ file sao lưu!`);
}

// ============================================================
// EXCEL / GOOGLE SHEETS IMPORT
// ============================================================
function clearSheetError() {
    elements.sheetError.textContent = '';
    elements.sheetError.classList.remove('show');
}

function showSheetError(errors) {
    const limit = 30;
    const list = errors.slice(0, limit).join('\n');
    const suffix = errors.length > limit ? `\n... và ${errors.length - limit} lỗi khác.` : '';
    elements.sheetError.textContent = list + suffix;
    elements.sheetError.classList.add('show');
}

function buildSheetColumnMap(headers: string[]): Record<string, number> {
    const normalizedHeaders = (headers || []).map(header => normalizeText(header));
    const map: Record<string, number> = {};
    const usedIndexes = new Set<number>();

    Object.keys(SHEET_ALIASES).forEach(key => {
        const aliases = SHEET_ALIASES[key];
        for (let index = 0; index < normalizedHeaders.length; index++) {
            if (usedIndexes.has(index)) continue;
            const header = normalizedHeaders[index];
            if (aliases.some(alias => header === alias || header.includes(alias))) {
                map[key] = index;
                usedIndexes.add(index);
                break;
            }
        }
    });

    return map;
}

function defaultSheetColumnMap(rows) {
    const maxColumns = rows.slice(0, 10).reduce((max, row) => Math.max(max, row.length), 0);

    if (maxColumns >= 9) return { id: 0, building: 1, rooms: 2, quanSo: 3, hocTap: 4, renLuyen: 5, nvvs: 6, leTiet: 7, note: 8 };
    if (maxColumns === 8) return { id: 0, building: 1, rooms: 2, quanSo: 3, hocTap: 4, renLuyen: 5, nvvs: 6, leTiet: 7 };
    if (maxColumns === 7) return { id: 0, building: 1, rooms: 2, quanSo: 3, hocTap: 4, renLuyen: 5, nvvs: 6 };
    if (maxColumns === 6) return { id: 0, hocTap: 1, renLuyen: 2, nvvs: 3, leTiet: 4, note: 5 };
    if (maxColumns === 5) return { id: 0, hocTap: 1, renLuyen: 2, nvvs: 3, leTiet: 4 };
    if (maxColumns === 4) return { id: 0, building: 1, rooms: 2, quanSo: 3 };
    if (maxColumns === 3) return { id: 0, building: 1, rooms: 2 };
    return { id: 0 };
}

function parseSheetScore(value) {
    const raw = String(value === undefined || value === null ? '' : value)
        .trim()
        .replace(/[−–]/g, '-')
        .replace(',', '.');

    if (!raw) return null;
    const number = parseFloat(raw);
    if (!Number.isFinite(number)) return null;

    const adjusted = state.autoNegative && number > 0 ? -number : number;
    return round1(adjusted);
}

function scoreSheetHeader(row) {
    const map = buildSheetColumnMap(row || []);
    let score = 0;

    if (map.id !== undefined) score += 1;
    if (map.building !== undefined) score += 2;
    if (map.rooms !== undefined) score += 2;
    if (map.quanSo !== undefined) score += 2;
    ['hocTap', 'renLuyen', 'nvvs', 'leTiet'].forEach(field => {
        if (map[field] !== undefined) score += 1;
    });

    const headers = (row || []).map(cell => normalizeText(cell));
    if (headers.some(header => header.includes('trung doi'))) score += 3;
    if (headers.some(header => header.includes('phong o'))) score += 3;
    if (headers.some(header => header.includes('quan so'))) score += 2;

    return { score, map };
}

function chooseDefaultSheetIndex(sheets) {
    let bestIndex = 0;
    let bestScore = -1;

    (sheets || []).forEach((sheet, index) => {
        const rows = (sheet.rows || []).slice(0, 15);
        let score = 0;
        rows.forEach(row => {
            score = Math.max(score, scoreSheetHeader(row).score);
        });
        if (score > bestScore) {
            bestScore = score;
            bestIndex = index;
        }
    });

    return bestIndex;
}

function normalizeBuildingName(value) {
    const raw = String(value === undefined || value === null ? '' : value).trim();
    if (!raw) return '';
    const clean = raw.replace(/^(toa|nha)\s+/i, '').trim();
    if (/^[A-Za-z]\d+$/.test(clean)) return `Toà ${clean.toUpperCase()}`;
    return raw;
}

function cleanRoomNumber(value) {
    return String(value === undefined || value === null ? '' : value)
        .trim()
        .replace(/\.0+$/, '');
}

function detectRoomSheetLayout(headerRow: string[]): { platoon: number; building: number; rooms: number; quanSo: number } | null {
    const headers = (headerRow || []).map(cell => normalizeText(cell));
    const findColumn = (aliases, excludes = []) => headers.findIndex(header =>
        aliases.some(alias => header === alias || header.includes(alias))
        && !excludes.some(exclude => header.includes(exclude))
    );

    const platoon = findColumn(['trung doi'], ['tieu doi']);
    const building = findColumn(['nha', 'toa']);
    let rooms = findColumn(['phong o']);
    if (rooms < 0) rooms = findColumn(['so phong', 'phong']);
    const quanSo = findColumn(['quan so']);
    const hasScore = ['hoc tap', 'ren luyen', 'nvvs', 'le tiet']
        .some(alias => headers.some(header => header.includes(alias)));

    if (platoon >= 0 && building >= 0 && rooms >= 0 && quanSo >= 0 && !hasScore) {
        return { platoon, building, rooms, quanSo };
    }
    return null;
}

function buildRoomSheetImport(rows: string[][], layout: any, startLine: number) {
    const groups: Map<number, any> = new Map();
    const errors = [];
    let current = null;
    let currentBuilding = '';

    (rows || []).forEach((row, index) => {
        const lineNumber = startLine + index;
        const platoonText = String(row[layout.platoon] === undefined || row[layout.platoon] === null ? '' : row[layout.platoon]).trim();

        if (platoonText) {
            const match = platoonText.match(/(?:B|TĐ|TD)?\s*(\d+)/i);
            if (!match) {
                errors.push(`Dòng ${lineNumber}: không đọc được trung đội "${platoonText}".`);
                current = null;
                return;
            }

            const id = parseInt(match[1], 10);
            if (!groups.has(id)) {
                groups.set(id, { id, building: currentBuilding, rooms: [], quanSo: '' });
            }
            current = groups.get(id);
        }

        if (!current) return;

        const buildingText = String(row[layout.building] === undefined || row[layout.building] === null ? '' : row[layout.building]).trim();
        if (buildingText) {
            currentBuilding = normalizeBuildingName(buildingText);
            current.building = currentBuilding;
        }

        const roomText = String(row[layout.rooms] === undefined || row[layout.rooms] === null ? '' : row[layout.rooms]).trim();
        if (roomText) {
            roomText.split(/[+,;/]+/).map(cleanRoomNumber).filter(Boolean).forEach(room => {
                if (!current.rooms.includes(room)) current.rooms.push(room);
            });
        }

        const quanSoText = String(row[layout.quanSo] === undefined || row[layout.quanSo] === null ? '' : row[layout.quanSo]).trim();
        if (quanSoText) {
            const normalized = normalizeQuanSo(quanSoText);
            if (normalized === null) {
                errors.push(`Dòng ${lineNumber}: quân số "${quanSoText}" không hợp lệ.`);
            } else {
                current.quanSo = normalized;
            }
        }
    });

    const entries = Array.from(groups.values())
        .filter(group => group.building || group.rooms.length || group.quanSo)
        .map(group => {
            const entry: any = { id: group.id };
            if (group.building) entry.building = group.building;
            if (group.rooms.length) entry.rooms = group.rooms.join(', ');
            if (group.quanSo) entry.quanSo = group.quanSo;
            return entry;
        });

    if (!entries.length) {
        return { fatal: 'Không có dòng dữ liệu hợp lệ để nhập.' };
    }

    return {
        entries,
        errors,
        map: { id: layout.platoon, building: layout.building, rooms: layout.rooms, quanSo: layout.quanSo },
        headerRow: null,
        dataRows: rows,
        roomMode: true
    };
}

function buildSheetImport(rows, hasHeader, manualMap: any = null, manualHeaderIndex = 0) {
    const cleanRows = (rows || []).filter(row =>
        Array.isArray(row) && row.some(cell => String(cell === undefined || cell === null ? '' : cell).trim() !== '')
    );

    if (!cleanRows.length) {
        return { fatal: 'Chưa có dữ liệu. Hãy chọn file hoặc dán dữ liệu từ Excel/Google Sheets.' };
    }

    let headerRow = null;
    let dataRows = cleanRows;
    let map: any = null;
    let headerIndex = 0;
    let manual = false;

    const normalizedManual: Record<string, number> = {};
    if (manualMap && typeof manualMap === 'object') {
        Object.keys(manualMap).forEach(key => {
            const index = Number(manualMap[key]);
            if (Number.isInteger(index) && index >= 0) normalizedManual[key] = index;
        });
        manual = Object.keys(normalizedManual).length > 0;
    }

    if (manual) {
        if (normalizedManual.id === undefined) {
            return { fatal: 'Ghép cột thủ công cần chọn cột Số TĐ.' };
        }
        headerIndex = hasHeader
            ? Math.min(Math.max(Number(manualHeaderIndex) || 0, 0), Math.max(cleanRows.length - 1, 0))
            : 0;
        headerRow = hasHeader ? cleanRows[headerIndex] : null;
        dataRows = hasHeader ? cleanRows.slice(headerIndex + 1) : cleanRows;
        map = normalizedManual;
    } else if (hasHeader) {
        const scanLimit = Math.min(cleanRows.length, 15);
        let best: any = { score: -1, index: 0, map: null };

        for (let index = 0; index < scanLimit; index++) {
            const candidate = scoreSheetHeader(cleanRows[index]);
            if (candidate.map.id === undefined) continue;
            if (candidate.score > best.score) {
                best = { score: candidate.score, index, map: candidate.map };
            }
        }

        if (!best.map) {
            return { fatal: 'Không tìm thấy cột "TĐ" trong dòng tiêu đề. Hãy đặt tên cột là TĐ/STT/Trung đội hoặc bỏ chọn "Là dòng tiêu đề".' };
        }

        headerIndex = best.index;
        headerRow = cleanRows[headerIndex];
        dataRows = cleanRows.slice(headerIndex + 1);
        map = best.map;
    } else {
        map = defaultSheetColumnMap(cleanRows);
    }

    if (!dataRows.length) {
        return { fatal: 'Không có dòng dữ liệu sau dòng tiêu đề.' };
    }

    const roomLayout = hasHeader && !manual ? detectRoomSheetLayout(headerRow) : null;
    if (roomLayout) {
        const roomResult: any = buildRoomSheetImport(dataRows, roomLayout, headerIndex + 2);
        if (roomResult && !roomResult.fatal) {
            roomResult.headerIndex = headerIndex;
            roomResult.manual = false;
        }
        return roomResult;
    }

    const entries = [];
    const errors = [];
    const seenIds = new Set();

    dataRows.forEach((row, index) => {
        if (!row.some(cell => String(cell === undefined || cell === null ? '' : cell).trim() !== '')) return;

        const lineNumber = index + (hasHeader ? headerIndex + 2 : 1);
        const rowErrors = [];
        const idText = String(row[map.id] === undefined || row[map.id] === null ? '' : row[map.id]).trim();
        const idMatch = idText.match(/^(?:TĐ|TD|B)?\s*(\d+)$/i);
        const id = idMatch ? parseInt(idMatch[1], 10) : NaN;

        if (!Number.isInteger(id) || id <= 0) {
            errors.push(`Dòng ${lineNumber}: không đọc được số TĐ "${idText || '(trống)'}".`);
            return;
        }
        if (seenIds.has(id)) {
            errors.push(`Dòng ${lineNumber}: trùng số TĐ ${id}.`);
            return;
        }
        seenIds.add(id);

        const entry: any = { id };

        if (map.building !== undefined) {
            const value = String(row[map.building] === undefined || row[map.building] === null ? '' : row[map.building]).trim();
            if (value) entry.building = value;
        }
        if (map.rooms !== undefined) {
            const value = String(row[map.rooms] === undefined || row[map.rooms] === null ? '' : row[map.rooms]).trim();
            if (value) entry.rooms = value;
        }
        if (map.quanSo !== undefined) {
            const raw = String(row[map.quanSo] === undefined || row[map.quanSo] === null ? '' : row[map.quanSo]).trim();
            if (raw) {
                const normalized = normalizeQuanSo(raw);
                if (normalized === null) {
                    rowErrors.push(`Dòng ${lineNumber}: quân số "${raw}" không hợp lệ.`);
                } else {
                    entry.quanSo = normalized;
                }
            }
        }

        ['hocTap', 'renLuyen', 'nvvs', 'leTiet'].forEach(field => {
            if (map[field] === undefined) return;
            const raw = String(row[map[field]] === undefined || row[map[field]] === null ? '' : row[map[field]]).trim();
            if (!raw) return;
            const parsed = parseSheetScore(raw);
            if (parsed === null) {
                rowErrors.push(`Dòng ${lineNumber}: điểm "${raw}" không hợp lệ.`);
            } else {
                entry[field] = parsed;
            }
        });

        if (map.note !== undefined) {
            const note = String(row[map.note] === undefined || row[map.note] === null ? '' : row[map.note]).trim();
            if (note) entry.note = note;
        }

        if (rowErrors.length) {
            errors.push(rowErrors.join(' '));
            return;
        }

        entries.push(entry);
    });

    if (!entries.length) {
        return { fatal: 'Không có dòng dữ liệu hợp lệ để nhập.' };
    }

    return { entries, errors, map, headerRow, dataRows, headerIndex, manual };
}

function resetSheetPreview(message = '') {
    sheetImportState = sheetImportState || { fileName: '', sheets: [], activeSheetIndex: 0, fileRows: [], pasteRows: [], result: null };
    sheetImportState.result = null;
    elements.sheetPreviewTitle.textContent = 'Xem trước dữ liệu';
    elements.sheetPreviewTable.innerHTML = `<tbody><tr><td style="padding:14px; color:#94a3b8;">${escapeHtml(message || 'Chưa có dữ liệu. Hãy chọn file hoặc dán dữ liệu.')}</td></tr></tbody>`;
    elements.sheetSummary.textContent = '';
    elements.btnApplySheet.disabled = true;
}

function renderSheetPreview(result) {
    if (!result || result.fatal) {
        resetSheetPreview(result && result.fatal ? result.fatal : '');
        if (result && result.fatal) showSheetError([result.fatal]);
        return;
    }

    const columns = SHEET_PREVIEW_COLUMNS.filter(column => result.map[column[0]] !== undefined);
    const previewRows = result.entries.slice(0, 8);

    elements.sheetPreviewTable.innerHTML = `
        <thead>
            <tr>${columns.map(column => `<th>${escapeHtml(column[1])}</th>`).join('')}</tr>
        </thead>
        <tbody>
            ${previewRows.map(entry => `
                <tr>${columns.map(column => {
                    let value = entry[column[0]];
                    if (value === undefined || value === null) value = '';
                    if (column[0] === 'note') value = String(value).slice(0, 60);
                    return `<td>${escapeHtml(value)}</td>`;
                }).join('')}</tr>
            `).join('')}
        </tbody>
    `;

    elements.sheetPreviewTitle.textContent = `Xem trước ${previewRows.length}/${result.entries.length} dòng`;
    const modeText = elements.sheetMode.value === 'merge'
        ? 'Cập nhật theo số TĐ'
        : 'Thay thế danh sách hiện tại';
    const noHeaderText = elements.sheetHasHeader.checked ? '' : ' Không có tiêu đề: đang dùng thứ tự cột mặc định.';
    const manualText = result.manual ? ' Đang dùng ghép cột thủ công.' : '';
    const errorText = result.errors.length ? ` Bỏ qua ${result.errors.length} dòng lỗi.` : '';

    elements.sheetSummary.innerHTML = `Đã nhận diện <strong>${result.entries.length}</strong> trung đội. Chế độ: <strong>${modeText}</strong>.${noHeaderText}${manualText}${errorText}`;
    elements.btnApplySheet.disabled = false;

    if (result.errors.length) {
        showSheetError(result.errors);
    } else {
        clearSheetError();
    }
}

function getCurrentSheetRows(): string[][] {
    if (!sheetImportState) return [];
    if (sheetSource === 'paste') return sheetImportState.pasteRows || [];
    const sheet = sheetImportState.sheets ? sheetImportState.sheets[sheetImportState.activeSheetIndex] : null;
    return sheet ? sheet.rows : (sheetImportState.fileRows || []);
}

function renderSheetMapping(result) {
    if (!elements.sheetMappingGrid) return;

    const rows = getCurrentSheetRows();
    if (!rows.length) {
        elements.sheetMappingGrid.innerHTML = '<div class="hint">Chọn file hoặc dán dữ liệu để ghép cột.</div>';
        return;
    }

    const hasHeader = Boolean(elements.sheetHasHeader.checked);
    const headerIndex = result && Number.isInteger(result.headerIndex) ? result.headerIndex : 0;
    const headerRow = result && result.headerRow
        ? result.headerRow
        : (hasHeader ? (rows[headerIndex] || []) : (rows[0] || []));
    const map = (sheetImportState && sheetImportState.manualMap)
        || (result && result.map)
        || {};
    const fields = [
        ['id', 'Số TĐ'],
        ['building', 'Tòa'],
        ['rooms', 'Phòng'],
        ['quanSo', 'Quân số'],
        ['hocTap', 'Học tập'],
        ['renLuyen', 'Rèn luyện'],
        ['nvvs', 'NVVS'],
        ['leTiet', 'Lễ tiết'],
        ['note', 'Ghi chú']
    ];

    elements.sheetMappingGrid.innerHTML = fields.map(field => {
        const key = field[0];
        const label = field[1];
        const options = ['<option value="-1">— Bỏ qua —</option>'].concat(
            (headerRow || []).map((cell, index) => {
                const raw = String(cell === undefined || cell === null ? '' : cell).trim();
                const text = hasHeader && raw ? raw : `Cột ${index + 1}`;
                return `<option value="${index}">${escapeHtml(text)}</option>`;
            })
        ).join('');
        return `<div class="mapping-field"><label for="map_${key}">${label}</label><select id="map_${key}" data-map-field="${key}">${options}</select></div>`;
    }).join('');

    fields.forEach(field => {
        const select = elements.sheetMappingGrid.querySelector(`select[data-map-field="${field[0]}"]`) as HTMLSelectElement | null;
        if (!select) return;
        const value = map[field[0]];
        select.value = value !== undefined && value !== null ? String(value) : '-1';
    });
}

function collectManualMapping(): Record<string, number> {
    const map: Record<string, number> = {};
    if (!elements.sheetMappingGrid) return map;
    elements.sheetMappingGrid.querySelectorAll('select[data-map-field]').forEach(select => {
        const element = select as HTMLSelectElement;
        const field = element.dataset.mapField || '';
        const index = Number(element.value);
        if (field && Number.isInteger(index) && index >= 0) {
            map[field] = index;
        }
    });
    return map;
}

function readMappingPresets(): MappingPreset[] {
    const presets = readJson<MappingPreset[]>(MAPPING_KEY, []);
    return Array.isArray(presets) ? presets.filter(preset => preset && preset.id && preset.map) : [];
}

function renderMappingPresets() {
    if (!elements.mappingPresetSelect) return;
    const presets = readMappingPresets();
    elements.mappingPresetSelect.innerHTML = '<option value="">— Mẫu đã lưu —</option>' + presets.map(preset =>
        `<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.name)}</option>`
    ).join('');
}

function saveMappingPreset() {
    const map = (sheetImportState && sheetImportState.manualMap) || (sheetImportState && sheetImportState.result && sheetImportState.result.map);
    if (!map || map.id === undefined) {
        showToast('Hãy ghép cột Số TĐ trước khi lưu mẫu.');
        return;
    }

    const name = String(elements.mappingName.value || '').trim()
        || `Mẫu ${new Date().toLocaleDateString('vi-VN')}`;
    const presets = readMappingPresets();
    const existingIndex = presets.findIndex(preset => normalizeText(preset.name) === normalizeText(name));
    const preset: MappingPreset = {
        id: existingIndex >= 0 ? presets[existingIndex].id : `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name,
        map: { ...map },
        hasHeader: Boolean(elements.sheetHasHeader.checked),
        headerIndex: sheetImportState && sheetImportState.result && Number.isInteger(sheetImportState.result.headerIndex)
            ? sheetImportState.result.headerIndex
            : 0,
        createdAt: new Date().toISOString()
    };

    if (existingIndex >= 0) presets[existingIndex] = preset;
    else presets.push(preset);

    if (!writeJson(MAPPING_KEY, presets)) {
        showToast('Không lưu được mẫu mapping trên thiết bị này.');
        return;
    }

    if (sheetImportState) {
        sheetImportState.manualMap = { ...map };
        sheetImportState.manualHeaderIndex = sheetImportState.result && Number.isInteger(sheetImportState.result.headerIndex)
            ? sheetImportState.result.headerIndex
            : 0;
    }
    renderMappingPresets();
    elements.mappingPresetSelect.value = preset.id;
    showToast(`Đã lưu mẫu mapping "${name}".`);
}

function applyMappingPreset() {
    const id = elements.mappingPresetSelect.value;
    if (!id || !sheetImportState) return;
    const preset = readMappingPresets().find(entry => entry.id === id);
    if (!preset) {
        showToast('Không tìm thấy mẫu mapping.');
        return;
    }

    sheetImportState.manualMap = { ...preset.map };
    sheetImportState.manualHeaderIndex = Number.isInteger(preset.headerIndex) ? Number(preset.headerIndex) : 0;
    elements.sheetHasHeader.checked = preset.hasHeader !== false;
    elements.mappingName.value = preset.name;
    updateSheetPreview();
    showToast(`Đã áp dụng mẫu mapping "${preset.name}".`);
}

async function deleteMappingPreset() {
    const id = elements.mappingPresetSelect.value;
    if (!id) {
        showToast('Hãy chọn mẫu mapping cần xóa.');
        return;
    }
    const presets = readMappingPresets();
    const preset = presets.find(entry => entry.id === id);
    if (!preset) return;

    const ok = await customConfirm('Xóa Mẫu Mapping', `Xóa mẫu mapping "${preset.name}"?`);
    if (!ok) return;

    writeJson(MAPPING_KEY, presets.filter(entry => entry.id !== id));
    renderMappingPresets();
    showToast('Đã xóa mẫu mapping.');
}

function updateSheetSourceUI(source) {
    sheetSource = source;
    elements.tabSheetFile.classList.toggle('active', source === 'file');
    elements.tabSheetPaste.classList.toggle('active', source === 'paste');
    elements.sheetFilePanel.style.display = source === 'file' ? 'block' : 'none';
    elements.sheetPastePanel.style.display = source === 'paste' ? 'block' : 'none';

    if (elements.sheetSelectField) {
        const hasSheets = source === 'file'
            && sheetImportState
            && sheetImportState.sheets
            && sheetImportState.sheets.length > 1;
        elements.sheetSelectField.style.display = hasSheets ? 'block' : 'none';
    }
}

function renderSheetSelect() {
    if (!elements.sheetSelectField || !elements.sheetSelect) return;
    const sheets = sheetImportState && sheetImportState.sheets ? sheetImportState.sheets : [];

    if (sheets.length <= 1) {
        elements.sheetSelectField.style.display = 'none';
        elements.sheetSelect.innerHTML = '';
        return;
    }

    elements.sheetSelectField.style.display = sheetSource === 'file' ? 'block' : 'none';
    elements.sheetSelect.innerHTML = sheets.map((sheet, index) =>
        `<option value="${index}">${escapeHtml(sheet.name)} (${sheet.rows.length} dòng)</option>`
    ).join('');
    elements.sheetSelect.value = String(sheetImportState.activeSheetIndex || 0);
}

function updateSheetFileLabel() {
    if (!sheetImportState || !sheetImportState.fileName) {
        elements.sheetFileName.textContent = 'Chưa chọn file. Hỗ trợ .xls (Excel 97-2003), .xlsx, .csv, .tsv.';
        return;
    }

    const sheet = sheetImportState.sheets[sheetImportState.activeSheetIndex];
    const sheetText = sheet ? ` · ${sheet.name} · ${sheet.rows.length} dòng` : '';
    const countText = sheetImportState.sheets.length > 1 ? ` · ${sheetImportState.sheets.length} trang tính` : '';
    elements.sheetFileName.textContent = `${sheetImportState.fileName}${sheetText}${countText}`;
}

function updateSheetPreview() {
    let rows = [];
    if (sheetSource === 'paste') {
        rows = sheetImportState ? sheetImportState.pasteRows : [];
    } else if (sheetImportState) {
        const sheet = sheetImportState.sheets ? sheetImportState.sheets[sheetImportState.activeSheetIndex] : null;
        rows = sheet ? sheet.rows : (sheetImportState.fileRows || []);
    }

    if (!rows.length) {
        resetSheetPreview();
        clearSheetError();
        renderSheetMapping(null);
        return;
    }

    const result = buildSheetImport(
        rows,
        elements.sheetHasHeader.checked,
        sheetImportState ? sheetImportState.manualMap : null,
        sheetImportState ? sheetImportState.manualHeaderIndex : 0
    );
    if (sheetImportState) sheetImportState.result = result;
    renderSheetPreview(result);
    renderSheetMapping(result);
}

function setSheetSource(source) {
    updateSheetSourceUI(source);
    if (sheetImportState) {
        sheetImportState.manualMap = null;
        sheetImportState.manualHeaderIndex = 0;
    }
    updateSheetPreview();
}

function openSheetModal() {
    if (state.locked) {
        showToast('Sổ điểm đã khóa. Hãy mở khóa trước khi nhập Excel.');
        return;
    }
    sheetImportState = {
        fileName: '',
        sheets: [],
        activeSheetIndex: 0,
        fileRows: [],
        pasteRows: [],
        result: null,
        manualMap: null,
        manualHeaderIndex: 0
    };
    sheetSource = 'file';
    elements.sheetFileInput.value = '';
    elements.sheetPasteInput.value = '';
    elements.sheetFileName.textContent = 'Chưa chọn file. Hỗ trợ .xls (Excel 97-2003), .xlsx, .csv, .tsv.';
    elements.sheetMode.value = 'merge';
    elements.sheetHasHeader.checked = true;
    clearSheetError();
    renderSheetSelect();
    updateSheetSourceUI('file');
    renderMappingPresets();
    resetSheetPreview();
    renderSheetMapping(null);
    elements.sheetModal.classList.add('open');
}

function closeSheetModal() {
    if (sheetParseTimer) {
        clearTimeout(sheetParseTimer);
        sheetParseTimer = null;
    }
    elements.sheetModal.classList.remove('open');
}

async function handleSheetFile(file) {
    if (!file) return;

    elements.sheetFileName.textContent = `Đang đọc: ${file.name}...`;
    elements.btnApplySheet.disabled = true;

    try {
        const parsed = await parseSheetFile(file);
        const sheets = (parsed && parsed.sheets ? parsed.sheets : [])
            .filter(sheet => sheet.rows && sheet.rows.length);
        if (!sheets.length) {
            throw new Error('File không có dữ liệu.');
        }

        sheetImportState.sheets = sheets;
        sheetImportState.manualMap = null;
        sheetImportState.manualHeaderIndex = 0;
        sheetImportState.activeSheetIndex = chooseDefaultSheetIndex(sheets);
        sheetImportState.fileRows = sheets[sheetImportState.activeSheetIndex].rows;
        sheetImportState.fileName = file.name;
        renderSheetSelect();
        updateSheetFileLabel();
        updateSheetSourceUI('file');
        updateSheetPreview();
    } catch (error) {
        sheetImportState.sheets = [];
        sheetImportState.fileRows = [];
        sheetImportState.fileName = file.name;
        elements.sheetFileName.textContent = file.name;
        renderSheetSelect();
        updateSheetSourceUI('file');
        resetSheetPreview();
        renderSheetMapping(null);
        showSheetError([error.message || 'Không đọc được file.']);
    }
}

function fillSheetSample() {
    const sample = [
        ['TĐ', 'Tòa', 'Phòng', 'Quân số', 'Học tập', 'Rèn luyện', 'NVVS', 'Lễ tiết', 'Ghi chú'],
        ['1', 'Toà C7', '503, 504, 505, 506', '32/32', '0', '0', '-0.5', '0', ''],
        ['2', 'Toà C7', '507, 508, 509, 510', '30/31', '-0.1', '0', '-1.1', '0', 'Đi học muộn']
    ].map(row => row.join('\t')).join('\n');

    updateSheetSourceUI('paste');
    elements.sheetPasteInput.value = sample;
    sheetImportState.pasteRows = parseSheetText(sample);
    sheetImportState.manualMap = null;
    sheetImportState.manualHeaderIndex = 0;
    updateSheetPreview();
}

function applySheetEntry(item, entry) {
    if (entry.building !== undefined) item.building = entry.building;
    if (entry.rooms !== undefined) item.rooms = entry.rooms;
    if (entry.quanSo !== undefined) item.quanSo = entry.quanSo;
    if (entry.note !== undefined) item.note = entry.note;

    ['hocTap', 'renLuyen', 'nvvs', 'leTiet'].forEach(field => {
        if (entry[field] !== undefined) item[field] = entry[field];
    });
    item.updatedAt = new Date().toISOString();
    item.updatedBy = state.graderName || 'Giảng viên';
}

async function applySheetImport() {
    if (state.locked) {
        showToast('Sổ điểm đã khóa. Hãy mở khóa trước khi nhập Excel.');
        return;
    }
    if (!sheetImportState || !sheetImportState.result || sheetImportState.result.fatal) return;

    const result = sheetImportState.result;
    const entries = result.entries;
    const mode = elements.sheetMode.value;

    if (!entries.length) return;

    if (mode === 'replace') {
        const missingLocation = entries.filter(entry => !entry.building || !entry.rooms).length;
        const warning = missingLocation
            ? `\nCó ${missingLocation} dòng thiếu Tòa/Phòng, sẽ để trống để bổ sung sau.`
            : '';
        const ok = await customConfirm(
            'Thay Thế Danh Sách & Điểm',
            `Thay thế toàn bộ ${state.items.length} trung đội hiện tại bằng ${entries.length} trung đội từ file?${warning}\nThao tác này không thể hoàn tác.`
        );
        if (!ok) return;
    } else {
        const existingIds = new Set(state.items.map(item => item.id));
        if (!entries.some(entry => existingIds.has(entry.id))) {
            showSheetError(['Không có số TĐ nào trong file trùng với danh sách hiện tại. Hãy kiểm tra lại cột TĐ hoặc dùng chế độ "Thay thế".']);
            return;
        }
    }

    captureSnapshot('Trước khi nhập Excel', true);

    const now = new Date().toISOString();
    let updated = 0;
    let skipped = 0;

    if (mode === 'merge') {
        entries.forEach(entry => {
            const item = state.items.find(current => current.id === entry.id);
            if (!item) {
                skipped++;
                return;
            }
            applySheetEntry(item, entry);
            updated++;
        });
    } else {
        const oldById: Map<number, any> = new Map(state.items.map((item: any) => [item.id, item]));
        state.items = entries.map((entry: any) => {
            const old: any = oldById.get(entry.id);
            return {
                id: entry.id,
                building: entry.building !== undefined ? entry.building : (old ? old.building : ''),
                rooms: entry.rooms !== undefined ? entry.rooms : (old ? old.rooms : ''),
                quanSo: entry.quanSo !== undefined ? entry.quanSo : (old ? old.quanSo : '0/0'),
                hocTap: entry.hocTap !== undefined ? entry.hocTap : 0,
                renLuyen: entry.renLuyen !== undefined ? entry.renLuyen : 0,
                nvvs: entry.nvvs !== undefined ? entry.nvvs : 0,
                leTiet: entry.leTiet !== undefined ? entry.leTiet : 0,
                note: entry.note !== undefined ? entry.note : '',
                totalScore: 0,
                rank: 1,
                updatedAt: now,
                updatedBy: state.graderName || 'Giảng viên'
            };
        }).sort((a, b) => a.id - b.id);
        state.itemsUpdatedAt = now;
        updated = state.items.length;
    }

    state.activeItemId = null;
    state.activeModalIndex = -1;
    if (state.activeBuilding !== 'ALL' && !state.items.some(item => item.building === state.activeBuilding)) {
        state.activeBuilding = 'ALL';
    }

    logAudit(
        'Nhập Excel',
        `${mode === 'replace' ? 'Thay thế' : 'Cập nhật'} ${updated} trung đội từ ${sheetImportState.fileName || 'dữ liệu dán'}`
    );

    updateCalculations();
    renderBuildingPills();
    render();
    saveData();
    closeSheetModal();

    const skippedText = skipped ? `, bỏ qua ${skipped} TĐ không có trong danh sách` : '';
    const errorText = result.errors.length ? `, ${result.errors.length} dòng lỗi bị bỏ qua` : '';
    showToast(mode === 'merge'
        ? `Đã cập nhật ${updated} trung đội${skippedText}${errorText}`
        : `Đã thay thế bằng ${updated} trung đội${errorText}`);
}

// ============================================================
// DIALOG & TOAST
// ============================================================
function hideToast() {
    if (elements.toastMsg._hideTimer) {
        clearTimeout(elements.toastMsg._hideTimer);
        elements.toastMsg._hideTimer = null;
    }
    elements.toastMsg.classList.remove('show');
    if (elements.toastAction) {
        elements.toastAction.hidden = true;
        elements.toastAction.onclick = null;
    }
}

function showToast(message: string, action?: { label: string; onClick: () => void }) {
    if (elements.toastMsg._hideTimer) {
        clearTimeout(elements.toastMsg._hideTimer);
    }
    if (elements.toastText) elements.toastText.textContent = message;
    else elements.toastMsg.textContent = message;
    if (elements.toastAction) {
        elements.toastAction.hidden = !action;
        elements.toastAction.textContent = action ? action.label : '';
        elements.toastAction.onclick = action
            ? () => {
                hideToast();
                action.onClick();
            }
            : null;
    }
    elements.toastMsg.classList.add('show');
    elements.toastMsg._hideTimer = setTimeout(() => {
        elements.toastMsg.classList.remove('show');
        if (elements.toastAction) {
            elements.toastAction.hidden = true;
            elements.toastAction.onclick = null;
        }
        elements.toastMsg._hideTimer = null;
    }, action ? 6500 : 2600);
}

function customConfirm(title: string, message: string): Promise<boolean> {
    return new Promise<boolean>(resolve => {
        elements.dialogTitle.textContent = title;
        elements.dialogMessage.textContent = message;
        if (elements.dialogInput) {
            elements.dialogInput.hidden = true;
            elements.dialogInput.value = '';
        }
        elements.customDialog.classList.add('open');

        let settled = false;

        const finish = value => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(value);
        };

        const onConfirm = () => finish(true);
        const onCancel = () => finish(false);
        const onKeyDown = event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onCancel();
            }
        };

        function cleanup() {
            elements.customDialog.classList.remove('open');
            elements.btnDialogConfirm.removeEventListener('click', onConfirm);
            elements.btnDialogCancel.removeEventListener('click', onCancel);
            document.removeEventListener('keydown', onKeyDown);
        }

        elements.btnDialogConfirm.addEventListener('click', onConfirm);
        elements.btnDialogCancel.addEventListener('click', onCancel);
        document.addEventListener('keydown', onKeyDown);
    });
}

function customPrompt(title: string, message: string, defaultValue = ''): Promise<string | null> {
    return new Promise<string | null>(resolve => {
        elements.dialogTitle.textContent = title;
        elements.dialogMessage.textContent = message;
        elements.dialogInput.hidden = false;
        elements.dialogInput.value = defaultValue;
        elements.customDialog.classList.add('open');

        let settled = false;

        const finish = value => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(value);
        };

        const onConfirm = () => finish(elements.dialogInput.value.trim() || null);
        const onCancel = () => finish(null);
        const onKeyDown = event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onCancel();
            } else if (event.key === 'Enter') {
                event.preventDefault();
                onConfirm();
            }
        };

        function cleanup() {
            elements.customDialog.classList.remove('open');
            elements.dialogInput.hidden = true;
            elements.btnDialogConfirm.removeEventListener('click', onConfirm);
            elements.btnDialogCancel.removeEventListener('click', onCancel);
            document.removeEventListener('keydown', onKeyDown);
        }

        elements.btnDialogConfirm.addEventListener('click', onConfirm);
        elements.btnDialogCancel.addEventListener('click', onCancel);
        document.addEventListener('keydown', onKeyDown);
        setTimeout(() => {
            elements.dialogInput.focus();
            elements.dialogInput.select();
        }, 50);
    });
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {
    // View mode
    elements.btnToggleView.addEventListener('click', () => {
        state.viewMode = state.viewMode === 'cards' ? 'table' : 'cards';
        elements.viewModeLabel.textContent = state.viewMode === 'cards' ? 'Xem Bảng' : 'Xem Thẻ';
        render();
        saveData();
    });

    // Dropdown menu
    elements.btnMenuToggle.addEventListener('click', event => {
        event.stopPropagation();
        elements.dropdownMenu.classList.toggle('show');
    });
    document.addEventListener('click', () => elements.dropdownMenu.classList.remove('show'));

    // Search
    elements.searchInput.addEventListener('input', event => {
        state.searchQuery = event.target.value;
        elements.btnClearSearch.style.display = state.searchQuery ? 'block' : 'none';
        render();
    });
    elements.btnClearSearch.addEventListener('click', () => {
        state.searchQuery = '';
        elements.searchInput.value = '';
        elements.btnClearSearch.style.display = 'none';
        render();
    });

    // Auto-negative toggle
    elements.btnAutoNegative.addEventListener('click', () => {
        if (state.locked) {
            showToast('Sổ điểm đã khóa. Hãy mở khóa trước khi đổi cách nhập điểm.');
            return;
        }
        state.autoNegative = !state.autoNegative;
        state.settingsUpdatedAt = new Date().toISOString();
        logAudit('Đổi cách nhập điểm', state.autoNegative ? 'Bật tự động âm' : 'Tắt tự động âm');
        elements.btnAutoNegative.classList.toggle('active', state.autoNegative);
        elements.btnAutoNegative.querySelector('span').textContent = state.autoNegative ? 'Tự âm (-)' : 'Tự do';
        saveData();
    });

    // Building filter pills (event delegation)
    elements.buildingPills.addEventListener('click', event => {
        const button = event.target.closest('.pill-btn');
        if (!button) return;
        state.activeBuilding = button.dataset.b;
        renderBuildingPills();
        render();
        saveData();
    });

    // Dates
    [elements.inputNgay, elements.inputThang, elements.inputNam].forEach(input => {
        input.addEventListener('change', () => {
            if (state.locked) {
                showToast('Sổ điểm đã khóa. Hãy mở khóa trước khi đổi ngày chấm.');
                applyMetaToUI();
                return;
            }
            const oldDate = `${state.date.ngay}/${state.date.thang}/${state.date.nam}`;
            state.date.ngay = clampInt(elements.inputNgay.value, 1, 31, state.date.ngay);
            state.date.thang = clampInt(elements.inputThang.value, 1, 12, state.date.thang);
            state.date.nam = clampInt(elements.inputNam.value, 2000, 2100, state.date.nam);
            elements.inputNgay.value = state.date.ngay;
            elements.inputThang.value = state.date.thang;
            elements.inputNam.value = state.date.nam;
            const newDate = `${state.date.ngay}/${state.date.thang}/${state.date.nam}`;
            if (oldDate !== newDate) {
                state.settingsUpdatedAt = new Date().toISOString();
                logAudit('Đổi ngày chấm', `${oldDate} → ${newDate}`);
            }
            updatePrintDate();
            saveData();
        });
    });

    elements.btnToday.addEventListener('click', () => {
        if (state.locked) {
            showToast('Sổ điểm đã khóa. Hãy mở khóa trước khi đổi ngày chấm.');
            return;
        }
        const today = new Date();
        const oldDate = `${state.date.ngay}/${state.date.thang}/${state.date.nam}`;
        state.date.ngay = today.getDate();
        state.date.thang = today.getMonth() + 1;
        state.date.nam = today.getFullYear();
        elements.inputNgay.value = state.date.ngay;
        elements.inputThang.value = state.date.thang;
        elements.inputNam.value = state.date.nam;
        const newDate = `${state.date.ngay}/${state.date.thang}/${state.date.nam}`;
        if (oldDate !== newDate) {
            state.settingsUpdatedAt = new Date().toISOString();
            logAudit('Đổi ngày chấm', `${oldDate} → ${newDate}`);
        }
        updatePrintDate();
        saveData();
        showToast('Đã chọn ngày hôm nay.');
    });

    // Course management
    elements.courseSelect.addEventListener('change', () => switchCourse(elements.courseSelect.value));
    elements.btnOpenCourses.addEventListener('click', openCourseModal);
    elements.btnCloseCourses.addEventListener('click', closeCourseModal);
    elements.btnCloseCoursesFooter.addEventListener('click', closeCourseModal);
    elements.courseModal.addEventListener('click', event => {
        if (event.target === elements.courseModal) closeCourseModal();
    });
    elements.btnCreateCourse.addEventListener('click', () => createCourseFromName(elements.newCourseName.value));
    elements.newCourseName.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            createCourseFromName(elements.newCourseName.value);
        }
    });
    elements.btnCloneCourse.addEventListener('click', async () => {
        const name = await customPrompt(
            'Nhân Bản Khóa Hiện Tại',
            'Nhập tên cho khóa mới. Cấu hình, tòa/phòng và quân số được giữ lại; điểm và ghi chú sẽ đặt về 0.',
            `${state.courseName} (bản sao)`
        );
        if (name) createCourseFromName(name, state.courseId);
    });
    elements.courseListEl.addEventListener('click', async event => {
        const button = (event.target as HTMLElement).closest('[data-course-action]') as HTMLElement | null;
        if (!button) return;

        const id = button.dataset.courseId || '';
        const action = button.dataset.courseAction;
        const summary = state.courseList.find(course => course.id === id);

        if (action === 'open') {
            switchCourse(id);
        } else if (action === 'rename' && summary) {
            const name = await customPrompt('Đổi Tên Khóa', 'Nhập tên mới cho khóa:', summary.courseName);
            if (name) await renameCourse(id, name);
        } else if (action === 'clone' && summary) {
            const name = await customPrompt(
                'Nhân Bản Khóa',
                'Nhập tên cho khóa mới. Điểm và ghi chú sẽ được đặt về 0.',
                `${summary.courseName} (bản sao)`
            );
            if (name) createCourseFromName(name, id);
        } else if (action === 'delete') {
            await deleteCourse(id);
        }
    });

    // Students & leaders
    elements.btnOpenStudents.addEventListener('click', () => openStudentsModal());
    elements.btnCloseStudents.addEventListener('click', closeStudentsModal);
    elements.btnCloseStudentsFooter.addEventListener('click', closeStudentsModal);
    elements.studentsModal.addEventListener('click', event => {
        if (event.target === elements.studentsModal) closeStudentsModal();
    });
    elements.tabStudents.addEventListener('click', () => setStudentTab('students'));
    elements.tabLeaders.addEventListener('click', () => setStudentTab('leaders'));
    elements.studentSearch.addEventListener('input', () => {
        studentUi.query = elements.studentSearch.value;
        renderStudentRoomList();
    });
    elements.studentGroupRoom.addEventListener('click', () => {
        studentUi.groupBy = 'room';
        renderStudentRoomList();
    });
    elements.studentGroupPlatoon.addEventListener('click', () => {
        studentUi.groupBy = 'platoon';
        renderStudentRoomList();
    });
    elements.studentQuickAll.addEventListener('click', () => {
        studentUi.quick = 'all';
        renderStudentRoomList();
    });
    elements.studentQuickLeaders.addEventListener('click', () => {
        studentUi.quick = 'leaders';
        renderStudentRoomList();
    });
    elements.studentQuickNoRoom.addEventListener('click', () => {
        studentUi.quick = 'noRoom';
        renderStudentRoomList();
    });
    elements.studentQuickNoPlatoon.addEventListener('click', () => {
        studentUi.quick = 'noPlatoon';
        renderStudentRoomList();
    });
    elements.studentBuildingFilter.addEventListener('change', () => {
        studentUi.building = elements.studentBuildingFilter.value;
        studentUi.room = 'ALL';
        studentUi.tieuDoi = 'ALL';
        renderStudentUI();
    });
    elements.studentRoomFilter.addEventListener('change', () => {
        studentUi.room = elements.studentRoomFilter.value;
        studentUi.tieuDoi = 'ALL';
        renderStudentUI();
    });
    elements.studentPlatoonFilter.addEventListener('change', () => {
        studentUi.platoon = elements.studentPlatoonFilter.value;
        studentUi.tieuDoi = 'ALL';
        renderStudentUI();
    });
    elements.studentTieuDoiFilter.addEventListener('change', () => {
        studentUi.tieuDoi = elements.studentTieuDoiFilter.value;
        renderStudentUI();
    });
    elements.btnAddStudent.addEventListener('click', () => openStudentEditor(null, 'Học viên'));
    elements.btnAddLeader.addEventListener('click', async () => {
        setStudentTab('leaders');
        const query = await customPrompt(
            'Gán Chức Vụ Cán Sự',
            'Nhập tên hoặc mã sinh viên cần gán chức vụ. Nếu có nhiều kết quả, ứng dụng sẽ mở danh sách để chọn.'
        );
        if (!query) return;
        const normalized = normalizeText(query);
        const exactCode = state.students.find((student: Student) => normalizeText(student.code) === normalized);
        const matches = exactCode
            ? [exactCode]
            : state.students.filter((student: Student) =>
                normalizeText(student.name).includes(normalized) || normalizeText(student.code).includes(normalized)
            );
        if (matches.length === 1) {
            const student = matches[0];
            openStudentEditor(student);
            if (!isLeaderPosition(student.position)) populateStudentPositionSelect('Tiểu đội trưởng');
            elements.studentStatus.textContent = 'Chọn chức vụ cán sự rồi bấm Lưu sinh viên.';
            elements.studentStatus.className = 'student-status ok';
            setTimeout(() => elements.studentPosition.focus(), 120);
            return;
        }
        if (matches.length > 1) {
            setStudentTab('students');
            studentUi.query = query;
            studentUi.quick = 'all';
            studentUi.building = 'ALL';
            studentUi.room = 'ALL';
            studentUi.platoon = 'ALL';
            studentUi.tieuDoi = 'ALL';
            elements.studentSearch.value = query;
            renderStudentUI();
            showToast(`Tìm thấy ${matches.length} sinh viên. Bấm Sửa để gán chức vụ.`);
            return;
        }
        showToast('Không tìm thấy sinh viên phù hợp. Hãy thử nhập mã SV hoặc tên khác.');
    });
    elements.btnCancelStudent.addEventListener('click', closeStudentEditor);
    elements.btnSaveStudent.addEventListener('click', () => saveStudentFromForm(false));
    elements.btnSaveStudentNext.addEventListener('click', () => saveStudentFromForm(true));
    elements.btnSelectVisible.addEventListener('click', toggleVisibleStudentSelection);
    elements.btnBulkClear.addEventListener('click', clearStudentSelection);
    elements.btnBulkDelete.addEventListener('click', () => {
        void deleteSelectedStudents();
    });
    elements.btnBulkAssign.addEventListener('click', applyBulkStudentPosition);
    elements.btnImportStudents.addEventListener('click', () => elements.studentFileInput.click());
    elements.studentFileInput.addEventListener('change', async event => {
        const input = event.target as HTMLInputElement;
        const files = Array.from(input.files || []);
        await importStudentsFromFile(files);
        input.value = '';
    });
    elements.btnExportStudents.addEventListener('click', () => exportStudentCSV(false));
    elements.btnExportLeaders.addEventListener('click', () => exportStudentCSV(true));
    elements.studentRoomList.addEventListener('change', event => {
        const checkbox = (event.target as HTMLElement).closest('[data-student-select]') as HTMLInputElement | null;
        if (!checkbox) return;
        const id = checkbox.dataset.studentSelect || '';
        if (!id) return;
        if (checkbox.checked) studentUi.selected.add(id);
        else studentUi.selected.delete(id);
        renderStudentRoomList();
    });
    elements.studentRoomList.addEventListener('click', async event => {
        const button = (event.target as HTMLElement).closest('[data-student-action]') as HTMLElement | null;
        if (!button) return;
        const id = button.dataset.studentId || '';
        if (button.dataset.studentAction === 'edit') {
            const student = state.students.find((entry: Student) => entry.id === id);
            if (student) openStudentEditor(student);
        } else if (button.dataset.studentAction === 'delete') {
            await deleteStudent(id);
        }
    });
    elements.leaderList.addEventListener('click', async event => {
        const button = (event.target as HTMLElement).closest('[data-leader-action]') as HTMLElement | null;
        if (!button) return;
        const id = button.dataset.studentId || '';
        if (button.dataset.leaderAction === 'edit') {
            const student = state.students.find((entry: Student) => entry.id === id);
            if (student) openStudentEditor(student);
        } else if (button.dataset.leaderAction === 'clear') {
            clearLeaderPosition(id);
        } else if (button.dataset.leaderAction === 'delete') {
            await deleteStudent(id);
        }
    });

    // Backups
    elements.btnOpenBackups.addEventListener('click', openBackupModal);
    elements.btnCloseBackups.addEventListener('click', closeBackupModal);
    elements.btnCloseBackupsFooter.addEventListener('click', closeBackupModal);
    elements.btnCreateBackup.addEventListener('click', createBackupNow);
    elements.backupModal.addEventListener('click', event => {
        if (event.target === elements.backupModal) closeBackupModal();
    });
    elements.backupListEl.addEventListener('click', async event => {
        const button = (event.target as HTMLElement).closest('[data-backup-action]') as HTMLElement | null;
        if (!button) return;
        const id = button.dataset.backupId || '';
        if (button.dataset.backupAction === 'restore') {
            await restoreBackup(id);
        } else if (button.dataset.backupAction === 'delete') {
            await removeBackup(id);
        }
    });

    // Cloud sync
    elements.btnOpenCloud.addEventListener('click', openCloudModal);
    elements.btnCloseCloud.addEventListener('click', closeCloudModal);
    elements.btnCloseCloudFooter.addEventListener('click', closeCloudModal);
    elements.btnCloudSave.addEventListener('click', saveCloudForm);
    elements.btnCloudTest.addEventListener('click', testCloud);
    elements.btnCloudPush.addEventListener('click', pushCloudNow);
    elements.btnCloudPull.addEventListener('click', pullCloudNow);
    elements.cloudModal.addEventListener('click', event => {
        if (event.target === elements.cloudModal) closeCloudModal();
    });

    // Collaboration
    elements.btnOpenCollab.addEventListener('click', openCollabModal);
    elements.btnCloseCollab.addEventListener('click', closeCollabModal);
    elements.btnCloseCollabFooter.addEventListener('click', closeCollabModal);
    elements.collabModal.addEventListener('click', event => {
        if (event.target === elements.collabModal) closeCollabModal();
    });
    elements.btnCollabToggle.addEventListener('click', toggleCollab);
    elements.btnCollabSaveName.addEventListener('click', saveCollabDisplayName);
    elements.btnCollabPull.addEventListener('click', pullCollabNow);
    elements.btnCollabPush.addEventListener('click', pushCollabNow);
    elements.btnCollabConfig.addEventListener('click', () => {
        closeCollabModal();
        openCloudModal();
    });
    elements.collabIndicator.addEventListener('click', openCollabModal);

    // Audit log & score lock
    elements.btnOpenAudit.addEventListener('click', openAuditModal);
    elements.btnCloseAudit.addEventListener('click', closeAuditModal);
    elements.btnCloseAuditFooter.addEventListener('click', closeAuditModal);
    elements.btnToggleLock.addEventListener('click', toggleLock);
    elements.btnSaveGrader.addEventListener('click', saveGraderName);
    elements.btnExportAudit.addEventListener('click', exportAuditCSV);
    elements.auditGraderName.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            saveGraderName();
        }
    });
    elements.auditModal.addEventListener('click', event => {
        if (event.target === elements.auditModal) closeAuditModal();
    });

    // Settings & help
    document.getElementById('btnOpenSettings').addEventListener('click', openSettings);
    elements.btnCloseSettings.addEventListener('click', closeSettings);
    elements.btnCancelSettings.addEventListener('click', closeSettings);
    elements.btnSaveSettings.addEventListener('click', saveSettings);
    elements.btnRestorePresetList.addEventListener('click', restorePresetList);
    elements.settingsModal.addEventListener('click', event => {
        if (event.target === elements.settingsModal) closeSettings();
    });

    document.getElementById('btnOpenHelp').addEventListener('click', () => {
        elements.helpModal.classList.add('open');
    });
    elements.btnCloseHelp.addEventListener('click', () => elements.helpModal.classList.remove('open'));
    elements.btnCloseHelpFooter.addEventListener('click', () => elements.helpModal.classList.remove('open'));
    elements.helpModal.addEventListener('click', event => {
        if (event.target === elements.helpModal) elements.helpModal.classList.remove('open');
    });

    // Excel / Google Sheets import
    elements.btnOpenSheet.addEventListener('click', openSheetModal);
    elements.btnCloseSheet.addEventListener('click', closeSheetModal);
    elements.btnCancelSheet.addEventListener('click', closeSheetModal);
    elements.sheetModal.addEventListener('click', event => {
        if (event.target === elements.sheetModal) closeSheetModal();
    });
    elements.btnChooseSheetFile.addEventListener('click', () => elements.sheetFileInput.click());
    elements.sheetFileInput.addEventListener('change', async event => {
        const file = event.target.files && event.target.files[0];
        await handleSheetFile(file);
        event.target.value = '';
    });
    elements.tabSheetFile.addEventListener('click', () => setSheetSource('file'));
    elements.tabSheetPaste.addEventListener('click', () => setSheetSource('paste'));
    elements.sheetPasteInput.addEventListener('input', () => {
        if (sheetParseTimer) clearTimeout(sheetParseTimer);
        sheetParseTimer = setTimeout(() => {
            if (!sheetImportState) return;
            sheetImportState.pasteRows = parseSheetText(elements.sheetPasteInput.value);
            updateSheetPreview();
        }, 250);
    });
    elements.sheetHasHeader.addEventListener('change', () => {
        if (sheetImportState) sheetImportState.manualHeaderIndex = 0;
        updateSheetPreview();
    });
    elements.sheetMode.addEventListener('change', updateSheetPreview);
    elements.sheetSelect.addEventListener('change', () => {
        if (!sheetImportState) return;
        const index = parseInt(elements.sheetSelect.value, 10);
        if (!Number.isInteger(index) || !sheetImportState.sheets[index]) return;
        sheetImportState.activeSheetIndex = index;
        sheetImportState.fileRows = sheetImportState.sheets[index].rows;
        sheetImportState.manualMap = null;
        sheetImportState.manualHeaderIndex = 0;
        updateSheetFileLabel();
        updateSheetPreview();
    });
    elements.btnSheetSample.addEventListener('click', fillSheetSample);
    elements.btnApplySheet.addEventListener('click', applySheetImport);
    elements.sheetMappingGrid.addEventListener('change', () => {
        if (!sheetImportState) return;
        sheetImportState.manualMap = collectManualMapping();
        sheetImportState.manualHeaderIndex = sheetImportState.result && Number.isInteger(sheetImportState.result.headerIndex)
            ? sheetImportState.result.headerIndex
            : 0;
        updateSheetPreview();
    });
    elements.btnSaveMapping.addEventListener('click', saveMappingPreset);
    elements.btnApplyMapping.addEventListener('click', applyMappingPreset);
    elements.btnDeleteMapping.addEventListener('click', deleteMappingPreset);

    // Import / export / print
    elements.btnImportJSON.addEventListener('click', () => elements.importFile.click());
    elements.importFile.addEventListener('change', async event => {
        const file = event.target.files && event.target.files[0];
        await importFromFile(file);
        event.target.value = '';
    });
    elements.btnExportJSON.addEventListener('click', exportJSON);
    elements.btnExportCSV.addEventListener('click', exportCSV);
    elements.btnPrintReport.addEventListener('click', printReport);

    // Sample data
    document.getElementById('btnLoadSample').addEventListener('click', async () => {
        if (state.locked) {
            showToast('Sổ điểm đã khóa. Hãy mở khóa trước khi nạp dữ liệu mẫu.');
            return;
        }
        const ok = await customConfirm(
            'Nạp Dữ Liệu Mẫu K337',
            'Nạp điểm mẫu K337 cho các trung đội trùng số?\nCác trung đội còn lại sẽ được đặt về 0 và dữ liệu đã chấm sẽ bị thay thế.'
        );
        if (!ok) return;

        captureSnapshot('Trước khi nạp dữ liệu mẫu', true);

        const now = new Date().toISOString();
        state.items.forEach(item => {
            const sample = PHOTO_SAMPLE_DATA[item.id];
            item.updatedAt = now;
            item.updatedBy = state.graderName || 'Giảng viên';
            if (sample) {
                item.quanSo = sample.quanSo || item.quanSo;
                item.hocTap = sample.hocTap || 0;
                item.renLuyen = sample.renLuyen || 0;
                item.nvvs = sample.nvvs || 0;
                item.leTiet = sample.leTiet || 0;
            } else {
                item.hocTap = 0;
                item.renLuyen = 0;
                item.nvvs = 0;
                item.leTiet = 0;
            }
        });

        logAudit('Nạp dữ liệu mẫu', `Đã nạp điểm mẫu K337 cho ${state.items.length} trung đội`);
        updateCalculations();
        render();
        showToast('Đã nạp dữ liệu mẫu từ ảnh!');
    });

    // Reset scores
    document.getElementById('btnResetScores').addEventListener('click', async () => {
        if (state.locked) {
            showToast('Sổ điểm đã khóa. Hãy mở khóa trước khi đặt lại điểm.');
            return;
        }
        const ok = await customConfirm(
            'Đặt Lại Điểm Toàn Bộ',
            `Xóa toàn bộ điểm trừ và ghi chú của ${state.items.length} trung đội?\nDanh sách, tên khóa và ngày chấm được giữ nguyên.`
        );
        if (!ok) return;

        captureSnapshot('Trước khi đặt lại điểm', true);

        const now = new Date().toISOString();
        state.items.forEach(item => {
            item.hocTap = 0;
            item.renLuyen = 0;
            item.nvvs = 0;
            item.leTiet = 0;
            item.note = '';
            item.updatedAt = now;
            item.updatedBy = state.graderName || 'Giảng viên';
        });

        logAudit('Đặt lại điểm', `Đặt lại điểm và ghi chú của ${state.items.length} trung đội`);
        updateCalculations();
        render();
        showToast('Đã đặt lại toàn bộ điểm về 0!');
    });

    // Quick deduct buttons
    document.querySelectorAll('.quick-deduct-grid').forEach(grid => {
        const category = (grid as HTMLElement).dataset.cat as string;
        const input = elements['drawer' + category.charAt(0).toUpperCase() + category.slice(1)];

        grid.addEventListener('click', event => {
            const button = (event.target as HTMLElement).closest('.btn-quick-deduct') as HTMLElement | null;
            if (!button || !input) return;

            const value = parseFloat(button.dataset.val) || 0;
            if (value === 0) {
                input.value = 0;
            } else {
                input.value = round1((parseFloat(input.value) || 0) + value);
            }

            if (saveDrawerCurrentValues({ normalize: true })) {
                populateDrawer();
                render();
            }
        });
    });

    // Drawer live inputs
    [
        elements.drawerHocTap,
        elements.drawerRenLuyen,
        elements.drawerNvvs,
        elements.drawerLeTiet,
        elements.drawerQuanSo
    ].forEach(input => {
        input.addEventListener('input', () => {
            if (saveDrawerCurrentValues()) scheduleRender();
        });
        input.addEventListener('change', () => {
            if (saveDrawerCurrentValues({ normalize: true })) {
                populateDrawer();
                render();
            }
        });
    });

    elements.drawerNote.addEventListener('input', () => {
        if (saveDrawerCurrentValues()) scheduleRender();
    });
    elements.drawerNote.addEventListener('change', () => {
        if (saveDrawerCurrentValues({ normalize: true })) render();
    });

    // Drawer navigation
    elements.btnPrevPlatoon.addEventListener('click', goToPrevPlatoon);
    elements.btnNextPlatoon.addEventListener('click', goToNextPlatoon);
    elements.btnSaveNext.addEventListener('click', saveAndGoNext);
    elements.btnCloseDrawer.addEventListener('click', closeDrawer);
    elements.gradingDrawer.addEventListener('click', event => {
        if (event.target === elements.gradingDrawer) closeDrawer();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', event => {
        if (elements.customDialog.classList.contains('open')) return;

        if (event.key === 'Escape') {
            if (elements.courseModal.classList.contains('open')) {
                closeCourseModal();
                return;
            }
            if (elements.studentsModal.classList.contains('open')) {
                closeStudentsModal();
                return;
            }
            if (elements.backupModal.classList.contains('open')) {
                closeBackupModal();
                return;
            }
            if (elements.collabModal.classList.contains('open')) {
                closeCollabModal();
                return;
            }
            if (elements.cloudModal.classList.contains('open')) {
                closeCloudModal();
                return;
            }
            if (elements.auditModal.classList.contains('open')) {
                closeAuditModal();
                return;
            }
            if (elements.settingsModal.classList.contains('open')) {
                closeSettings();
                return;
            }
            if (elements.sheetModal.classList.contains('open')) {
                closeSheetModal();
                return;
            }
            if (elements.helpModal.classList.contains('open')) {
                elements.helpModal.classList.remove('open');
                return;
            }
            if (elements.gradingDrawer.classList.contains('open')) {
                closeDrawer();
                return;
            }
            elements.dropdownMenu.classList.remove('show');
            return;
        }

        if (!elements.gradingDrawer.classList.contains('open')) return;
        if (elements.settingsModal.classList.contains('open')
            || elements.sheetModal.classList.contains('open')
            || elements.helpModal.classList.contains('open')
            || elements.courseModal.classList.contains('open')
            || elements.backupModal.classList.contains('open')
            || elements.studentsModal.classList.contains('open')
            || elements.auditModal.classList.contains('open')
            || elements.collabModal.classList.contains('open')
            || elements.cloudModal.classList.contains('open')) return;

        const tagName = String((event.target as HTMLElement).tagName || '').toLowerCase();
        if (tagName === 'input' || tagName === 'textarea') return;

        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            goToPrevPlatoon();
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            goToNextPlatoon();
        }
    });

    window.addEventListener('beforeunload', saveData);
}

// ============================================================
// CONNECTIVITY
// ============================================================
function updateConnectivity() {
    const offline = !navigator.onLine;
    if (elements.offlineBadge) elements.offlineBadge.hidden = !offline;
    document.body.classList.toggle('is-offline', offline);
}

function setupConnectivity() {
    updateConnectivity();
    window.addEventListener('online', updateConnectivity);
    window.addEventListener('offline', updateConnectivity);
}

// ============================================================
// START APP
// ============================================================
function initApp() {
    state.cloudConfig = loadCloudConfig();
    state.collabSettings = loadCollabSettings();
    loadSavedData();
    applyMetaToUI();
    setupEventListeners();
    setupConnectivity();
    renderBuildingPills();
    updateCalculations();
    render();
    renderCollabUI();
    maybeStartCollab();
}

// Global functions for inline onclick handlers
(window as any).openDrawerById = openDrawerById;
(window as any).updateItemQuanSo = updateItemQuanSo;
(window as any).updateItemCat = updateItemCat;
(window as any).openStudentsForPlatoon = openStudentsForPlatoon;

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
