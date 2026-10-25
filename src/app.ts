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

// ============================================================
// APP CONFIG, STORAGE & STATE
// ============================================================
const APP_ID = 'THI_DUA_GDQPAN';
const APP_VERSION = 2;

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
    items: []
};

// DOM Elements
const elements: Record<string, any> = {
    appTitle: document.getElementById('appTitle'),
    appSubtitle: document.getElementById('appSubtitle'),
    baseScoreLabel: document.getElementById('baseScoreLabel'),
    inputNgay: document.getElementById('inputNgay'),
    inputThang: document.getElementById('inputThang'),
    inputNam: document.getElementById('inputNam'),
    btnToday: document.getElementById('btnToday'),
    saveStatus: document.getElementById('saveStatus'),
    saveStatusText: document.getElementById('saveStatusText'),

    cardsList: document.getElementById('cardsList'),
    tableCard: document.getElementById('tableCard'),
    tableBody: document.getElementById('tableBody'),
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

function loadSavedData() {
    let payload = null;
    let loadedFromKey = '';

    const loadKeys = [
        STORAGE_KEY,
        ...(IS_ORIGINAL_PAGE ? [PREVIOUS_STORAGE_KEY, LEGACY_STORAGE_KEY] : []),
        ...LEGACY_PAGE_STORAGE_KEYS
    ];

    for (const key of loadKeys) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;

            const candidate = JSON.parse(raw);
            const hasItems = Array.isArray(candidate)
                ? candidate.length > 0
                : Boolean(candidate && Array.isArray(candidate.items) && candidate.items.length);

            if (hasItems) {
                payload = candidate;
                loadedFromKey = key;
                break;
            }
        } catch (error) {
            console.warn(`Không đọc được dữ liệu đã lưu (${key}):`, error);
        }
    }

    let meta = null;
    let rawItems = null;

    if (Array.isArray(payload)) {
        rawItems = payload;
    } else if (payload && typeof payload === 'object') {
        meta = payload.meta && typeof payload.meta === 'object' ? payload.meta : null;
        rawItems = payload.items;
    }

    applyMetaValues(meta);

    state.items = [];
    if (Array.isArray(rawItems) && rawItems.length) {
        const seenIds = new Set();
        rawItems.forEach(raw => {
            const item = normalizeItem(raw);
            if (item && !seenIds.has(item.id)) {
                seenIds.add(item.id);
                state.items.push(item);
            }
        });
    }

    if (!state.items.length) {
        state.items = createDefaultItems();
    }

    // Tự chuyển dữ liệu cũ sang khóa theo đường dẫn mới.
    if (payload && loadedFromKey && loadedFromKey !== STORAGE_KEY) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPayload()));
        } catch (error) {
            console.warn('Không chuyển được dữ liệu sang khóa lưu mới:', error);
        }
    }
}

function buildPayload() {
    return {
        app: APP_ID,
        version: APP_VERSION,
        savedAt: new Date().toISOString(),
        meta: {
            courseName: state.courseName,
            unitName: state.unitName,
            baseScore: state.baseScore,
            ngay: state.date.ngay,
            thang: state.date.thang,
            nam: state.date.nam,
            autoNegative: state.autoNegative,
            viewMode: state.viewMode,
            activeBuilding: state.activeBuilding
        },
        items: state.items
    };
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
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPayload()));
        updateSaveStatus(true);
        return true;
    } catch (error) {
        console.error('Storage write error', error);
        updateSaveStatus(false);
        return false;
    }
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

    document.title = `Thi Đua ${state.courseName} - ${state.unitName}`;
}

// ============================================================
// CALCULATIONS, STATS & FILTERS
// ============================================================
function updateCalculations() {
    state.items.forEach(item => {
        const total = state.baseScore
            + toNumber(item.hocTap)
            + toNumber(item.renLuyen)
            + toNumber(item.nvvs)
            + toNumber(item.leTiet);
        item.totalScore = round1(total);
    });

    const scores = (Array.from(new Set(state.items.map((item: any) => Number(item.totalScore)))) as number[]).sort((a, b) => b - a);
    state.items.forEach(item => {
        item.rank = scores.indexOf(item.totalScore) + 1;
    });

    updateStats();
    saveData();
}

function updateStats() {
    let present = 0;
    let total = 0;

    state.items.forEach(item => {
        const match = String(item.quanSo || '').match(/^(\d+)\s*\/\s*(\d+)$/);
        if (match) {
            present += parseInt(match[1], 10) || 0;
            total += parseInt(match[2], 10) || 0;
        }
    });

    elements.statQuanSo.textContent = `${present}/${total}`;

    const sumScore = state.items.reduce((sum, item) => sum + item.totalScore, 0);
    elements.statAvgScore.textContent = state.items.length
        ? (sumScore / state.items.length).toFixed(2)
        : '0.00';

    elements.statPerfect.textContent = state.items.filter(item => item.totalScore >= state.baseScore).length;
    elements.statDeducted.textContent = state.items.filter(item => item.totalScore < state.baseScore).length;
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
                    <button class="btn-grade-card" onclick="openDrawerById(${item.id})">
                        ✎ Chấm Điểm
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
                    <input type="text" class="table-input" inputmode="numeric" value="${escapeHtml(item.quanSo)}" onchange="updateItemQuanSo(${item.id}, this.value)">
                </td>
                <td style="text-align:center;">
                    <input type="number" step="0.1" class="table-input ${item.hocTap < 0 ? 'neg' : ''}" value="${formatNum(item.hocTap)}" onchange="updateItemCat(${item.id}, 'hocTap', this.value)">
                </td>
                <td style="text-align:center;">
                    <input type="number" step="0.1" class="table-input ${item.renLuyen < 0 ? 'neg' : ''}" value="${formatNum(item.renLuyen)}" onchange="updateItemCat(${item.id}, 'renLuyen', this.value)">
                </td>
                <td style="text-align:center;">
                    <input type="number" step="0.1" class="table-input ${item.nvvs < 0 ? 'neg' : ''}" value="${formatNum(item.nvvs)}" onchange="updateItemCat(${item.id}, 'nvvs', this.value)">
                </td>
                <td style="text-align:center;">
                    <input type="number" step="0.1" class="table-input ${item.leTiet < 0 ? 'neg' : ''}" value="${formatNum(item.leTiet)}" onchange="updateItemCat(${item.id}, 'leTiet', this.value)">
                </td>
                <td style="text-align:center; font-weight:900; ${item.totalScore < state.baseScore ? 'color:var(--danger-red)' : 'color:var(--primary-dark)'}">
                    ${formatNum(item.totalScore)}
                </td>
                <td style="text-align:center; font-weight:800;">${item.rank}</td>
                <td style="text-align:center;">
                    <button class="btn-grade-card" style="padding:4px 8px;" onclick="openDrawerById(${item.id})">✎</button>
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
    const item = state.items.find(entry => entry.id === id);
    if (!item) return;

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

    updateCalculations();
    render();
}

function updateItemCat(id, category, value) {
    const item = state.items.find(entry => entry.id === id);
    if (!item) return;

    item[category] = parseScoreVal(value);
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
    const list = errors.slice(0, 6).join('\n');
    const suffix = errors.length > 6 ? `\n... và ${errors.length - 6} lỗi khác.` : '';
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

function buildSheetImport(rows, hasHeader) {
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

    if (hasHeader) {
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

    const roomLayout = hasHeader ? detectRoomSheetLayout(headerRow) : null;
    if (roomLayout) {
        return buildRoomSheetImport(dataRows, roomLayout, headerIndex + 2);
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

    return { entries, errors, map, headerRow, dataRows };
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
    const errorText = result.errors.length ? ` Bỏ qua ${result.errors.length} dòng lỗi.` : '';

    elements.sheetSummary.innerHTML = `Đã nhận diện <strong>${result.entries.length}</strong> trung đội. Chế độ: <strong>${modeText}</strong>.${noHeaderText}${errorText}`;
    elements.btnApplySheet.disabled = false;

    if (result.errors.length) {
        showSheetError(result.errors);
    } else {
        clearSheetError();
    }
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
        return;
    }

    const result = buildSheetImport(rows, elements.sheetHasHeader.checked);
    if (sheetImportState) sheetImportState.result = result;
    renderSheetPreview(result);
}

function setSheetSource(source) {
    updateSheetSourceUI(source);
    updateSheetPreview();
}

function openSheetModal() {
    sheetImportState = {
        fileName: '',
        sheets: [],
        activeSheetIndex: 0,
        fileRows: [],
        pasteRows: [],
        result: null
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
    resetSheetPreview();
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

function customConfirm(title, message) {
    return new Promise(resolve => {
        elements.dialogTitle.textContent = title;
        elements.dialogMessage.textContent = message;
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
        state.autoNegative = !state.autoNegative;
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
            state.date.ngay = clampInt(elements.inputNgay.value, 1, 31, state.date.ngay);
            state.date.thang = clampInt(elements.inputThang.value, 1, 12, state.date.thang);
            state.date.nam = clampInt(elements.inputNam.value, 2000, 2100, state.date.nam);
            elements.inputNgay.value = state.date.ngay;
            elements.inputThang.value = state.date.thang;
            elements.inputNam.value = state.date.nam;
            updatePrintDate();
            saveData();
        });
    });

    elements.btnToday.addEventListener('click', () => {
        const today = new Date();
        state.date.ngay = today.getDate();
        state.date.thang = today.getMonth() + 1;
        state.date.nam = today.getFullYear();
        elements.inputNgay.value = state.date.ngay;
        elements.inputThang.value = state.date.thang;
        elements.inputNam.value = state.date.nam;
        updatePrintDate();
        saveData();
        showToast('Đã chọn ngày hôm nay.');
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
    elements.sheetHasHeader.addEventListener('change', updateSheetPreview);
    elements.sheetMode.addEventListener('change', updateSheetPreview);
    elements.sheetSelect.addEventListener('change', () => {
        if (!sheetImportState) return;
        const index = parseInt(elements.sheetSelect.value, 10);
        if (!Number.isInteger(index) || !sheetImportState.sheets[index]) return;
        sheetImportState.activeSheetIndex = index;
        sheetImportState.fileRows = sheetImportState.sheets[index].rows;
        updateSheetFileLabel();
        updateSheetPreview();
    });
    elements.btnSheetSample.addEventListener('click', fillSheetSample);
    elements.btnApplySheet.addEventListener('click', applySheetImport);

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
        const ok = await customConfirm(
            'Nạp Dữ Liệu Mẫu K337',
            'Nạp điểm mẫu K337 cho các trung đội trùng số?\nCác trung đội còn lại sẽ được đặt về 0 và dữ liệu đã chấm sẽ bị thay thế.'
        );
        if (!ok) return;

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

        updateCalculations();
        render();
        showToast('Đã nạp dữ liệu mẫu từ ảnh!');
    });

    // Reset scores
    document.getElementById('btnResetScores').addEventListener('click', async () => {
        const ok = await customConfirm(
            'Đặt Lại Điểm Toàn Bộ',
            `Xóa toàn bộ điểm trừ và ghi chú của ${state.items.length} trung đội?\nDanh sách, tên khóa và ngày chấm được giữ nguyên.`
        );
        if (!ok) return;

        state.items.forEach(item => {
            item.hocTap = 0;
            item.renLuyen = 0;
            item.nvvs = 0;
            item.leTiet = 0;
            item.note = '';
        });

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
            || elements.helpModal.classList.contains('open')) return;

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
// START APP
// ============================================================
function initApp() {
    loadSavedData();
    applyMetaToUI();
    setupEventListeners();
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
