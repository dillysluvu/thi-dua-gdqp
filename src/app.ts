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
    drawerOriginal: null as any,
    cloudConfig: null as CloudConfig | null
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
    toastMsg: document.getElementById('toastMsg')
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
        rank: 1
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
            updatedAt: now
        },
        items: items.length ? items : createDefaultItems(),
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
            updatedAt: now
        },
        items: state.items,
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
    if (state.cloudConfig) {
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
    record.savedAt = now;

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
    showToast('Đã lưu cấu hình đồng bộ đám mây.');
}

async function testCloud() {
    const config = readCloudForm();
    saveCloudConfig(config);
    state.cloudConfig = config;
    setCloudStatus({ ok: true, message: 'Đang kiểm tra kết nối...' });
    const status = await testCloudConnection(config);
    setCloudStatus(status);
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
    record.savedAt = now;

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
    logAudit('Đổi người chấm', `${oldName} → ${name}`);
    saveData();
    renderLockUI();
    renderAuditList();
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

    state.items = parsed.items.map((entry: any) => {
        const old: any = existingById.get(entry.id);
        return {
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
            rank: 1
        };
    });

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

    const ok = await customConfirm(
        'Nhập Dữ Liệu Sao Lưu',
        `Thay thế toàn bộ dữ liệu hiện tại bằng ${items.length} trung đội từ file?\nThao tác này không thể hoàn tác.`
    );
    if (!ok) return;

    captureSnapshot('Trước khi nhập file sao lưu', true);

    const meta = (!Array.isArray(payload) && payload.meta && typeof payload.meta === 'object')
        ? payload.meta
        : null;

    state.items = items;
    state.activeItemId = null;
    state.activeModalIndex = -1;
    if (meta) {
        applyMetaValues(meta);
    }
    state.searchQuery = '';
    elements.searchInput.value = '';
    elements.btnClearSearch.style.display = 'none';

    logAudit('Nhập file sao lưu', `${items.length} trung đội từ ${file.name}`);
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
                rank: 1
            };
        }).sort((a, b) => a.id - b.id);
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
function showToast(message) {
    if (elements.toastMsg._hideTimer) {
        clearTimeout(elements.toastMsg._hideTimer);
    }
    elements.toastMsg.textContent = message;
    elements.toastMsg.classList.add('show');
    elements.toastMsg._hideTimer = setTimeout(() => {
        elements.toastMsg.classList.remove('show');
    }, 2600);
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
            if (oldDate !== newDate) logAudit('Đổi ngày chấm', `${oldDate} → ${newDate}`);
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
        if (oldDate !== newDate) logAudit('Đổi ngày chấm', `${oldDate} → ${newDate}`);
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

        state.items.forEach(item => {
            const sample = PHOTO_SAMPLE_DATA[item.id];
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

        state.items.forEach(item => {
            item.hocTap = 0;
            item.renLuyen = 0;
            item.nvvs = 0;
            item.leTiet = 0;
            item.note = '';
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
            if (elements.backupModal.classList.contains('open')) {
                closeBackupModal();
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
            || elements.auditModal.classList.contains('open')
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
    loadSavedData();
    applyMetaToUI();
    setupEventListeners();
    setupConnectivity();
    renderBuildingPills();
    updateCalculations();
    render();
}

// Global functions for inline onclick handlers
(window as any).openDrawerById = openDrawerById;
(window as any).updateItemQuanSo = updateItemQuanSo;
(window as any).updateItemCat = updateItemCat;

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
