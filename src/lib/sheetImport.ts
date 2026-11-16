import { SHEET_ALIASES, SHEET_PREVIEW_COLUMNS } from '../constants';
import { MAPPING_KEY, readJson, writeJson } from '../courseStore';
import { normalizeQuanSo, normalizeText, round1 } from '../utils';
import { daiDoiFromTrungDoi } from './units';

export interface SheetEntry {
  id: number;
  building?: string;
  rooms?: string;
  daiDoi?: string;
  quanSo?: string;
  hocTap?: number;
  renLuyen?: number;
  nvvs?: number;
  leTiet?: number;
  note?: string;
}

export interface SheetImportResult {
  entries: SheetEntry[];
  errors: string[];
  map: Record<string, number>;
  headerRow: string[] | null;
  dataRows: string[][];
  headerIndex: number;
  manual: boolean;
  roomMode?: boolean;
  fatal?: string;
}

export interface MappingPreset {
  id: string;
  name: string;
  map: Record<string, number>;
  hasHeader: boolean;
  headerIndex?: number;
  createdAt: string;
}

export interface SheetColumn {
  key: string;
  label: string;
}

export const SHEET_FIELDS: SheetColumn[] = [
  { key: 'id', label: 'Số b (trung đội)' },
  { key: 'daiDoi', label: 'c (đại đội)' },
  { key: 'building', label: 'Tòa' },
  { key: 'rooms', label: 'Phòng' },
  { key: 'quanSo', label: 'Quân số' },
  { key: 'hocTap', label: 'Học tập' },
  { key: 'renLuyen', label: 'Rèn luyện' },
  { key: 'nvvs', label: 'NVVS' },
  { key: 'leTiet', label: 'Lễ tiết' },
  { key: 'note', label: 'Ghi chú' }
];

export const SHEET_PREVIEW_FIELDS = SHEET_PREVIEW_COLUMNS;

export function buildSheetColumnMap(headers: string[]): Record<string, number> {
  const normalizedHeaders = (headers || []).map(header => normalizeText(header));
  const map: Record<string, number> = {};
  const usedIndexes = new Set<number>();

  Object.keys(SHEET_ALIASES).forEach(key => {
    const aliases = SHEET_ALIASES[key];
    for (let index = 0; index < normalizedHeaders.length; index++) {
      if (usedIndexes.has(index)) continue;
      const header = normalizedHeaders[index];
      if (aliases.some(alias => header === alias || (alias.length > 1 && header.includes(alias)))) {
        map[key] = index;
        usedIndexes.add(index);
        break;
      }
    }
  });

  return map;
}

export function defaultSheetColumnMap(rows: string[][]): Record<string, number> {
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

export function parseSheetScore(value: unknown, autoNegative: boolean): number | null {
  const raw = String(value === undefined || value === null ? '' : value)
    .trim()
    .replace(/[−–]/g, '-')
    .replace(',', '.');

  if (!raw) return null;
  const number = parseFloat(raw);
  if (!Number.isFinite(number)) return null;

  const adjusted = autoNegative && number > 0 ? -number : number;
  return round1(adjusted);
}

export function scoreSheetHeader(row: string[]): { score: number; map: Record<string, number> } {
  const map = buildSheetColumnMap(row || []);
  let score = 0;

  if (map.id !== undefined) score += 1;
  if (map.building !== undefined) score += 2;
  if (map.rooms !== undefined) score += 2;
  if (map.quanSo !== undefined) score += 2;
  (['hocTap', 'renLuyen', 'nvvs', 'leTiet'] as const).forEach(field => {
    if (map[field] !== undefined) score += 1;
  });

  const headers = (row || []).map(cell => normalizeText(cell));
  if (headers.some(header => header.includes('trung doi'))) score += 3;
  if (headers.some(header => header.includes('phong o'))) score += 3;
  if (headers.some(header => header.includes('quan so'))) score += 2;

  return { score, map };
}

export function chooseDefaultSheetIndex(sheets: Array<{ rows: string[][] }>): number {
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

function normalizeBuildingName(value: unknown): string {
  const raw = String(value === undefined || value === null ? '' : value).trim();
  if (!raw) return '';
  const clean = raw.replace(/^(toa|nha)\s+/i, '').trim();
  if (/^[A-Za-z]\d+$/.test(clean)) return `Toà ${clean.toUpperCase()}`;
  return raw;
}

function cleanRoomNumber(value: unknown): string {
  return String(value === undefined || value === null ? '' : value)
    .trim()
    .replace(/\.0+$/, '');
}

function detectRoomSheetLayout(headerRow: string[]): { platoon: number; building: number; rooms: number; quanSo: number; daiDoi: number } | null {
  const headers = (headerRow || []).map(cell => normalizeText(cell));
  const findColumn = (aliases: string[], excludes: string[] = []) => headers.findIndex(header =>
    aliases.some(alias => header === alias || header.includes(alias))
    && !excludes.some(exclude => header.includes(exclude))
  );

  const platoon = findColumn(['trung doi'], ['tieu doi']);
  const daiDoi = findColumn(['dai doi'], ['dai doi truong', 'pho dai doi']);
  const building = findColumn(['nha', 'toa']);
  let rooms = findColumn(['phong o']);
  if (rooms < 0) rooms = findColumn(['so phong', 'phong']);
  const quanSo = findColumn(['quan so']);
  const hasScore = ['hoc tap', 'ren luyen', 'nvvs', 'le tiet']
    .some(alias => headers.some(header => header.includes(alias)));

  if (platoon >= 0 && building >= 0 && rooms >= 0 && quanSo >= 0 && !hasScore) {
    return { platoon, building, rooms, quanSo, daiDoi };
  }
  return null;
}

function buildRoomSheetImport(rows: string[][], layout: any, startLine: number): SheetImportResult | { fatal: string } {
  const groups = new Map<number, { id: number; building: string; rooms: string[]; quanSo: string; daiDoi: string }>();
  const errors: string[] = [];
  let current: { id: number; building: string; rooms: string[]; quanSo: string; daiDoi: string } | null = null;
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
      if (!groups.has(id)) groups.set(id, { id, building: currentBuilding, rooms: [], quanSo: '', daiDoi: daiDoiFromTrungDoi(id) });
      current = groups.get(id)!;
    }

    if (!current) return;

    if (layout.daiDoi >= 0) {
      const daiDoiText = String(row[layout.daiDoi] === undefined || row[layout.daiDoi] === null ? '' : row[layout.daiDoi]).trim();
      if (daiDoiText) current.daiDoi = daiDoiText;
    }

    const buildingText = String(row[layout.building] === undefined || row[layout.building] === null ? '' : row[layout.building]).trim();
    if (buildingText) {
      currentBuilding = normalizeBuildingName(buildingText);
      current.building = currentBuilding;
    }

    const roomText = String(row[layout.rooms] === undefined || row[layout.rooms] === null ? '' : row[layout.rooms]).trim();
    if (roomText) {
      roomText.split(/[+,;/]+/).map(cleanRoomNumber).filter(Boolean).forEach(room => {
        if (!current!.rooms.includes(room)) current!.rooms.push(room);
      });
    }

    const quanSoText = String(row[layout.quanSo] === undefined || row[layout.quanSo] === null ? '' : row[layout.quanSo]).trim();
    if (quanSoText) {
      const normalized = normalizeQuanSo(quanSoText);
      if (normalized === null) errors.push(`Dòng ${lineNumber}: quân số "${quanSoText}" không hợp lệ.`);
      else current.quanSo = normalized;
    }
  });

  const entries: SheetEntry[] = Array.from(groups.values())
    .filter(group => group.building || group.rooms.length || group.quanSo)
    .map(group => {
      const entry: SheetEntry = { id: group.id };
      if (group.building) entry.building = group.building;
      if (group.rooms.length) entry.rooms = group.rooms.join(', ');
      if (group.quanSo) entry.quanSo = group.quanSo;
      entry.daiDoi = group.daiDoi || daiDoiFromTrungDoi(group.id);
      return entry;
    });

  if (!entries.length) return { fatal: 'Không có dòng dữ liệu hợp lệ để nhập.' };

  return {
    entries,
    errors,
    map: {
      id: layout.platoon,
      building: layout.building,
      rooms: layout.rooms,
      quanSo: layout.quanSo,
      ...(layout.daiDoi >= 0 ? { daiDoi: layout.daiDoi } : {})
    },
    headerRow: null,
    dataRows: rows,
    headerIndex: 0,
    manual: false,
    roomMode: true
  };
}

export function buildSheetImport(
  rows: string[][],
  hasHeader: boolean,
  autoNegative: boolean,
  manualMap: Record<string, number> | null = null,
  manualHeaderIndex = 0
): SheetImportResult {
  const cleanRows = (rows || []).filter(row =>
    Array.isArray(row) && row.some(cell => String(cell === undefined || cell === null ? '' : cell).trim() !== '')
  );

  if (!cleanRows.length) {
    return {
      entries: [],
      errors: [],
      map: {},
      headerRow: null,
      dataRows: [],
      headerIndex: 0,
      manual: false,
      fatal: 'Chưa có dữ liệu. Hãy chọn file hoặc dán dữ liệu từ Excel/Google Sheets.'
    };
  }

  let headerRow: string[] | null = null;
  let dataRows = cleanRows;
  let map: Record<string, number> = {};
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
      return {
        entries: [], errors: [], map: {}, headerRow: null, dataRows: [], headerIndex: 0, manual,
        fatal: 'Ghép cột thủ công cần chọn cột số b (trung đội).'
      };
    }
    headerIndex = hasHeader
      ? Math.min(Math.max(Number(manualHeaderIndex) || 0, 0), Math.max(cleanRows.length - 1, 0))
      : 0;
    headerRow = hasHeader ? cleanRows[headerIndex] : null;
    dataRows = hasHeader ? cleanRows.slice(headerIndex + 1) : cleanRows;
    map = normalizedManual;
  } else if (hasHeader) {
    const scanLimit = Math.min(cleanRows.length, 15);
    let best: { score: number; index: number; map: Record<string, number> | null } = { score: -1, index: 0, map: null };

    for (let index = 0; index < scanLimit; index++) {
      const candidate = scoreSheetHeader(cleanRows[index]);
      if (candidate.map.id === undefined) continue;
      if (candidate.score > best.score) best = { score: candidate.score, index, map: candidate.map };
    }

    if (!best.map) {
      return {
        entries: [], errors: [], map: {}, headerRow: null, dataRows: [], headerIndex: 0, manual,
        fatal: 'Không tìm thấy cột "b" (trung đội) trong dòng tiêu đề. Hãy đặt tên cột là b/STT/Trung đội hoặc bỏ chọn "Là dòng tiêu đề".'
      };
    }

    headerIndex = best.index;
    headerRow = cleanRows[headerIndex];
    dataRows = cleanRows.slice(headerIndex + 1);
    map = best.map;
  } else {
    map = defaultSheetColumnMap(cleanRows);
  }

  if (!dataRows.length) {
    return {
      entries: [], errors: [], map, headerRow, dataRows, headerIndex, manual,
      fatal: 'Không có dòng dữ liệu sau dòng tiêu đề.'
    };
  }

  const roomLayout = hasHeader && !manual ? detectRoomSheetLayout(headerRow || []) : null;
  if (roomLayout) {
    const roomResult = buildRoomSheetImport(dataRows, roomLayout, headerIndex + 2);
    if ('fatal' in roomResult) return { ...roomResult, entries: [], errors: [], map: {}, headerRow: null, dataRows: [], headerIndex: 0, manual: false };
    return { ...roomResult, headerIndex, manual: false };
  }

  const entries: SheetEntry[] = [];
  const errors: string[] = [];
  const seenIds = new Set<number>();

  dataRows.forEach((row, index) => {
    if (!row.some(cell => String(cell === undefined || cell === null ? '' : cell).trim() !== '')) return;

    const lineNumber = index + (hasHeader ? headerIndex + 2 : 1);
    const rowErrors: string[] = [];
    const idText = String(row[map.id] === undefined || row[map.id] === null ? '' : row[map.id]).trim();
    const idMatch = idText.match(/^(?:TĐ|TD|B)?\s*(\d+)$/i);
    const id = idMatch ? parseInt(idMatch[1], 10) : NaN;

    if (!Number.isInteger(id) || id <= 0) {
      errors.push(`Dòng ${lineNumber}: không đọc được số b "${idText || '(trống)'}".`);
      return;
    }
    if (seenIds.has(id)) {
      errors.push(`Dòng ${lineNumber}: trùng số b ${id}.`);
      return;
    }
    seenIds.add(id);

    const entry: SheetEntry = { id };

    if (map.daiDoi !== undefined) {
      const value = String(row[map.daiDoi] === undefined || row[map.daiDoi] === null ? '' : row[map.daiDoi]).trim();
      if (value) entry.daiDoi = value;
    }
    if (!entry.daiDoi) entry.daiDoi = daiDoiFromTrungDoi(id);
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
        if (normalized === null) rowErrors.push(`Dòng ${lineNumber}: quân số "${raw}" không hợp lệ.`);
        else entry.quanSo = normalized;
      }
    }

    (['hocTap', 'renLuyen', 'nvvs', 'leTiet'] as const).forEach(field => {
      if (map[field] === undefined) return;
      const raw = String(row[map[field]] === undefined || row[map[field]] === null ? '' : row[map[field]]).trim();
      if (!raw) return;
      const parsed = parseSheetScore(raw, autoNegative);
      if (parsed === null) rowErrors.push(`Dòng ${lineNumber}: điểm "${raw}" không hợp lệ.`);
      else entry[field] = parsed;
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
    return {
      entries: [], errors, map, headerRow, dataRows, headerIndex, manual,
      fatal: 'Không có dòng dữ liệu hợp lệ để nhập.'
    };
  }

  return { entries, errors, map, headerRow, dataRows, headerIndex, manual };
}

export function readMappingPresets(): MappingPreset[] {
  const presets = readJson<MappingPreset[]>(MAPPING_KEY, []);
  return Array.isArray(presets) ? presets.filter(preset => preset && preset.id && preset.map) : [];
}

export function saveMappingPreset(preset: MappingPreset): boolean {
  const presets = readMappingPresets();
  const index = presets.findIndex(item => item.id === preset.id || normalizeText(item.name) === normalizeText(preset.name));
  if (index >= 0) presets[index] = preset;
  else presets.push(preset);
  return writeJson(MAPPING_KEY, presets);
}

export function deleteMappingPreset(id: string): boolean {
  const presets = readMappingPresets();
  return writeJson(MAPPING_KEY, presets.filter(preset => preset.id !== id));
}

export function mappingNameFromMap(map: Record<string, number>, hasHeader: boolean, headerIndex = 0): Omit<MappingPreset, 'id' | 'name' | 'createdAt'> {
  return { map: { ...map }, hasHeader, headerIndex };
}

export function sampleSheetText(): string {
  return [
    ['b', 'c', 'Tòa', 'Phòng', 'Quân số', 'Học tập', 'Rèn luyện', 'NVVS', 'Lễ tiết', 'Ghi chú'],
    ['1', '3', 'Toà C7', '503, 504, 505, 506', '32/32', '0', '0', '-0.5', '0', ''],
    ['2', '3', 'Toà C7', '507, 508, 509, 510', '30/31', '-0.1', '0', '-1.1', '0', 'Đi học muộn']
  ].map(row => row.join('\t')).join('\n');
}
