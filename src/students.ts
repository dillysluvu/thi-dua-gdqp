import { normalizeText } from './utils';

export const STUDENT_POSITIONS = [
  'Học viên',
  'Tiểu đội trưởng',
  'Trung đội trưởng',
  'Phó đại đội trưởng'
] as const;

export const LEADER_POSITIONS = [
  'Phó đại đội trưởng',
  'Trung đội trưởng',
  'Tiểu đội trưởng'
] as const;

export type StudentPosition = string;

export interface Student {
  id: string;
  name: string;
  code: string;
  building: string;
  room: string;
  tieuDoi: string;
  trungDoi: string;
  position: StudentPosition;
  phone: string;
  note: string;
  className: string;
  school: string;
  birthDate: string;
  hometown: string;
  gender: string;
  ethnicity: string;
  cccd: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface StudentRoomGroup {
  key: string;
  building: string;
  room: string;
  students: Student[];
  trungDois: string[];
  tieuDois: string[];
}

export interface StudentPlatoonGroup {
  key: string;
  trungDoi: string;
  students: Student[];
  buildings: string[];
  rooms: string[];
  tieuDois: string[];
}

export interface StudentImportResult {
  students: Student[];
  errors: string[];
  headerRow: string[] | null;
  headerIndex: number;
  mapping: Record<string, number>;
}

const STUDENT_ALIASES: Record<string, string[]> = {
  name: ['ho ten', 'ho va ten', 'ho ten sinh vien', 'ten sinh vien', 'ten', 'sinh vien', 'full name'],
  code: ['ma sv', 'mssv', 'ma sinh vien', 'ma so sinh vien', 'msv', 'ma hoc vien'],
  building: ['toa', 'toa nha', 'nha', 'building', 'day nha'],
  room: ['phong', 'phong o', 'so phong', 'room'],
  tieuDoi: ['tieu doi', 'tieu doi so', 'td nho', 'squad'],
  trungDoi: ['trung doi', 'trung doi so', 'td', 'platoon'],
  position: ['chuc vu', 'chuc danh', 'vi tri', 'position', 'vai tro'],
  phone: ['sdt', 'so dien thoai', 'dien thoai', 'phone', 'lien he'],
  note: ['ghi chu', 'note', 'ghi chu khac'],
  className: ['lop', 'lop hoc', 'class'],
  school: ['truong', 'truong hoc', 'don vi', 'school'],
  birthDate: ['ngay sinh', 'sinh ngay', 'dob', 'birthdate'],
  hometown: ['noi sinh', 'que quan', 'hometown'],
  gender: ['gioi tinh', 'gender'],
  ethnicity: ['dan toc', 'ethnicity'],
  cccd: ['cccd', 'cmnd', 'can cuoc', 'so cccd', 'cccd/cmnd']
};

const DEFAULT_MAPPING: Record<string, number> = {
  name: 0,
  code: 1,
  building: 2,
  room: 3,
  tieuDoi: 4,
  trungDoi: 5,
  position: 6,
  phone: 7,
  note: 8,
  className: 9,
  school: 10,
  birthDate: 11,
  hometown: 12,
  gender: 13,
  ethnicity: 14,
  cccd: 15
};

function makeStudentId(): string {
  return `sv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function cell(row: string[], index: number | undefined): string {
  if (index === undefined || index < 0) return '';
  return String(row[index] === undefined || row[index] === null ? '' : row[index]).trim();
}

export function normalizePosition(value: unknown): StudentPosition {
  const normalized = normalizeText(value);
  if (!normalized) return 'Học viên';
  if (normalized.includes('pho dai doi')) return 'Phó đại đội trưởng';
  if (normalized.includes('trung doi truong')) return 'Trung đội trưởng';
  if (normalized.includes('tieu doi truong')) return 'Tiểu đội trưởng';
  return 'Học viên';
}

export function isLeaderPosition(value: unknown): boolean {
  return LEADER_POSITIONS.includes(normalizePosition(value) as typeof LEADER_POSITIONS[number]);
}

export function normalizeStudent(raw: any): Student | null {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name !== undefined ? raw.name : '').trim();
  if (!name) return null;

  return {
    id: String(raw.id || makeStudentId()),
    name,
    code: String(raw.code !== undefined && raw.code !== null ? raw.code : '').trim(),
    building: String(raw.building !== undefined && raw.building !== null ? raw.building : '').trim(),
    room: String(raw.room !== undefined && raw.room !== null ? raw.room : '').trim(),
    tieuDoi: String(raw.tieuDoi !== undefined && raw.tieuDoi !== null ? raw.tieuDoi : '').trim(),
    trungDoi: String(raw.trungDoi !== undefined && raw.trungDoi !== null ? raw.trungDoi : '').trim(),
    position: normalizePosition(raw.position),
    phone: String(raw.phone !== undefined && raw.phone !== null ? raw.phone : '').trim(),
    note: String(raw.note !== undefined && raw.note !== null ? raw.note : '').trim(),
    className: String(raw.className !== undefined && raw.className !== null ? raw.className : (raw.class || '')).trim(),
    school: String(raw.school !== undefined && raw.school !== null ? raw.school : '').trim(),
    birthDate: String(raw.birthDate !== undefined && raw.birthDate !== null ? raw.birthDate : (raw.dob || '')).trim(),
    hometown: String(raw.hometown !== undefined && raw.hometown !== null ? raw.hometown : (raw.queQuan || '')).trim(),
    gender: String(raw.gender !== undefined && raw.gender !== null ? raw.gender : '').trim(),
    ethnicity: String(raw.ethnicity !== undefined && raw.ethnicity !== null ? raw.ethnicity : (raw.danToc || '')).trim(),
    cccd: String(raw.cccd !== undefined && raw.cccd !== null ? raw.cccd : (raw.cmnd || '')).trim(),
    updatedAt: String(raw.updatedAt || ''),
    updatedBy: String(raw.updatedBy || '')
  };
}


export function normalizeStudentTombstones(raw: any): Record<string, string> {
  const result: Record<string, string> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result;
  Object.entries(raw).forEach(([id, at]) => {
    const key = String(id || '').trim();
    const value = String(at || '').trim();
    if (key && value) result[key] = value;
  });
  return result;
}

export function normalizeStudents(rawStudents: any): Student[] {
  const list: Student[] = [];
  const seen = new Set<string>();
  (Array.isArray(rawStudents) ? rawStudents : []).forEach(raw => {
    const student = normalizeStudent(raw);
    if (!student) return;
    let id = student.id;
    while (seen.has(id)) id = makeStudentId();
    seen.add(id);
    list.push({ ...student, id });
  });
  return list;
}

function numericText(value: string): number {
  const match = String(value || '').match(/\d+/);
  return match ? parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER;
}

export function sortStudents(students: Student[]): Student[] {
  return (students || []).slice().sort((a, b) => {
    const trungDoiDiff = numericText(a.trungDoi) - numericText(b.trungDoi);
    if (trungDoiDiff) return trungDoiDiff;
    const tieuDoiDiff = numericText(a.tieuDoi) - numericText(b.tieuDoi);
    if (tieuDoiDiff) return tieuDoiDiff;
    return String(a.name || '').localeCompare(String(b.name || ''), 'vi');
  });
}

export function studentMatchesPlatoon(student: Student, item: any): boolean {
  if (!student || !item) return false;
  const trungDoi = normalizeText(student.trungDoi);
  if (trungDoi) {
    const itemId = normalizeText(item.id);
    return trungDoi === itemId || numericText(trungDoi) === Number(item.id);
  }

  const room = normalizeText(student.room);
  if (!room) return false;
  const rooms = normalizeText(item.rooms).split(/[,\s]+/).filter(Boolean);
  if (!rooms.includes(room)) return false;
  const building = normalizeText(student.building);
  return !building || building === normalizeText(item.building);
}

export function countStudentsForPlatoon(students: Student[], item: any): number {
  return (students || []).filter(student => studentMatchesPlatoon(student, item)).length;
}

export function groupStudentsByRoom(students: Student[]): StudentRoomGroup[] {
  const groups = new Map<string, StudentRoomGroup>();

  sortStudents(students).forEach(student => {
    const building = String(student.building || '').trim();
    const room = String(student.room || '').trim();
    const key = `${normalizeText(building)}::${normalizeText(room)}`;
    if (!groups.has(key)) {
      groups.set(key, { key, building, room, students: [], trungDois: [], tieuDois: [] });
    }
    const group = groups.get(key)!;
    group.students.push(student);
    if (student.trungDoi && !group.trungDois.includes(student.trungDoi)) group.trungDois.push(student.trungDoi);
    if (student.tieuDoi && !group.tieuDois.includes(student.tieuDoi)) group.tieuDois.push(student.tieuDoi);
  });

  return Array.from(groups.values()).sort((a, b) => {
    const buildingDiff = String(a.building || 'zzzz').localeCompare(String(b.building || 'zzzz'), 'vi');
    if (buildingDiff) return buildingDiff;
    return numericText(a.room) - numericText(b.room) || String(a.room).localeCompare(String(b.room), 'vi');
  });
}

export function groupStudentsByPlatoon(students: Student[]): StudentPlatoonGroup[] {
  const groups = new Map<string, StudentPlatoonGroup>();

  sortStudents(students).forEach(student => {
    const trungDoi = String(student.trungDoi || '').trim();
    const key = normalizeText(trungDoi) || '__unassigned__';
    if (!groups.has(key)) {
      groups.set(key, { key, trungDoi, students: [], buildings: [], rooms: [], tieuDois: [] });
    }
    const group = groups.get(key)!;
    group.students.push(student);
    if (student.building && !group.buildings.includes(student.building)) group.buildings.push(student.building);
    if (student.room && !group.rooms.includes(student.room)) group.rooms.push(student.room);
    if (student.tieuDoi && !group.tieuDois.includes(student.tieuDoi)) group.tieuDois.push(student.tieuDoi);
  });

  return Array.from(groups.values()).sort((a, b) => {
    if (!a.trungDoi) return 1;
    if (!b.trungDoi) return -1;
    return numericText(a.trungDoi) - numericText(b.trungDoi)
      || String(a.trungDoi).localeCompare(String(b.trungDoi), 'vi');
  });
}

function findHeaderMapping(rows: string[][]): { mapping: Record<string, number>; headerIndex: number } | null {
  const limit = Math.min(rows.length, 6);
  for (let rowIndex = 0; rowIndex < limit; rowIndex++) {
    const row = rows[rowIndex] || [];
    const mapping: Record<string, number> = {};
    row.forEach((value, index) => {
      const normalized = normalizeText(value);
      if (!normalized) return;
      Object.keys(STUDENT_ALIASES).forEach(key => {
        if (mapping[key] !== undefined) return;
        if (STUDENT_ALIASES[key].includes(normalized)) mapping[key] = index;
      });
    });
    if (mapping.name !== undefined && Object.keys(mapping).length >= 2) {
      return { mapping, headerIndex: rowIndex };
    }
  }
  return null;
}

function inferBuilding(items: any[], trungDoi: string): string {
  if (!trungDoi) return '';
  const match = (items || []).find(item => String(item.id) === String(trungDoi));
  return match ? String(match.building || '') : '';
}


interface BienCheBlock {
  end: number;
  headerIndex: number;
  headerRow: string[];
  trungDoi: string;
  tieuDoiRaw: string;
  order: number;
  rooms: Array<{ room: string; building: string }>;
  building: string;
  platoonLeader: string;
  squadLeader: string;
}

interface BienCheRecord {
  student: Student;
  blockOrder: number;
  tieuDoiRaw: string;
  trungDoi: string;
  platoonLeader: string;
  squadLeader: string;
}

interface LabelInfo {
  value: string;
  next: string;
}

function labelInfo(row: string[], label: string, avoid: string[] = []): LabelInfo | null {
  const target = normalizeText(label);
  const avoidNormalized = avoid.map(normalizeText);
  for (let index = 0; index < row.length; index++) {
    const normalized = normalizeText(row[index]);
    if (!normalized.includes(target)) continue;
    if (avoidNormalized.some(item => item && normalized.includes(item))) continue;
    const raw = String(row[index] === undefined || row[index] === null ? '' : row[index]).trim();
    const colon = raw.search(/[:：]/);
    if (colon >= 0) {
      const after = raw.slice(colon + 1).trim();
      if (after) {
        let next = '';
        for (let nextIndex = index + 1; nextIndex < row.length; nextIndex++) {
          const value = String(row[nextIndex] === undefined || row[nextIndex] === null ? '' : row[nextIndex]).trim();
          if (value) { next = value; break; }
        }
        return { value: after, next };
      }
    }
    for (let nextIndex = index + 1; nextIndex < row.length; nextIndex++) {
      const value = String(row[nextIndex] === undefined || row[nextIndex] === null ? '' : row[nextIndex]).trim();
      if (!value) continue;
      let next = '';
      for (let afterIndex = nextIndex + 1; afterIndex < row.length; afterIndex++) {
        const afterValue = String(row[afterIndex] === undefined || row[afterIndex] === null ? '' : row[afterIndex]).trim();
        if (afterValue) { next = afterValue; break; }
      }
      return { value, next };
    }
  }
  return null;
}

function parseRoomValue(value: unknown): { room: string; building: string } {
  const text = String(value === undefined || value === null ? '' : value).trim();
  if (!text) return { room: '', building: '' };
  const withBuilding = text.match(/^(\d{2,4})\s*[-–]\s*(.+)$/);
  if (withBuilding) return { room: withBuilding[1], building: withBuilding[2].trim() };
  const firstRoom = text.match(/(\d{2,4})/);
  if (firstRoom) return { room: firstRoom[1], building: '' };
  return { room: text, building: '' };
}

function parseRoomList(value: unknown): Array<{ room: string; building: string }> {
  return String(value === undefined || value === null ? '' : value)
    .split(/[+,;]/)
    .map(part => parseRoomValue(part))
    .filter(entry => Boolean(entry.room));
}

function findStudentColumn(header: string[], aliases: string[]): number {
  const normalized = (header || []).map(normalizeText);
  for (const alias of aliases) {
    const target = normalizeText(alias);
    const index = normalized.findIndex(value => value === target || value.includes(target));
    if (index >= 0) return index;
  }
  return -1;
}

function detectRoomColumn(rows: string[][], from: number, to: number, minIndex: number): number {
  const maxColumns = rows.slice(from, to).reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
  let best = -1;
  let bestCount = 0;
  for (let column = Math.max(0, minIndex); column < maxColumns; column++) {
    let count = 0;
    for (let index = from; index < to; index++) {
      const value = String((rows[index] || [])[column] === undefined ? '' : (rows[index] || [])[column]).trim();
      if (/^\d{2,4}\s*[-–]\s*\S+/.test(value)) count += 2;
      else if (/^\d{2,4}$/.test(value)) count += 1;
    }
    if (count > bestCount) {
      best = column;
      bestCount = count;
    }
  }
  return bestCount > 0 ? best : -1;
}

function isBienCheHeader(row: string[]): boolean {
  const normalized = (row || []).map(normalizeText);
  const hasName = normalized.some(value => value === 'ho va ten' || value === 'ho ten' || value.includes('ho va ten'));
  const hasCode = normalized.some(value => value === 'ma sv' || value.includes('ma sv') || value === 'stt');
  return hasName && hasCode;
}

function parseBienCheRows(rows: string[][], items: any[] = []): StudentImportResult | null {
  const starts: number[] = [];
  rows.forEach((row, index) => {
    const text = normalizeText((row || []).join(' '));
    if (text.includes('danh sach bien che tieu doi') || text.includes('danh sach bien che')) starts.push(index);
  });
  if (!starts.length) return null;

  const blocks: BienCheBlock[] = [];
  starts.forEach((start, order) => {
    const nextStart = order + 1 < starts.length ? starts[order + 1] : rows.length;
    let headerIndex = -1;
    for (let index = start; index < nextStart; index++) {
      if (isBienCheHeader(rows[index] || [])) { headerIndex = index; break; }
    }
    if (headerIndex < 0) return;

    let trungDoi = '';
    let tieuDoiRaw = '';
    let rooms: Array<{ room: string; building: string }> = [];
    let building = '';
    let platoonLeader = '';
    let squadLeader = '';

    for (let index = start; index <= headerIndex; index++) {
      const row = rows[index] || [];
      if (!tieuDoiRaw) {
        const info = labelInfo(row, 'danh sach bien che tieu doi');
        if (info) tieuDoiRaw = info.value;
      }
      if (!trungDoi) {
        const info = labelInfo(row, 'trung doi', ['trung doi truong']);
        if (info) trungDoi = info.value;
      }
      if (!rooms.length) {
        const info = labelInfo(row, 'phong o');
        if (info) {
          rooms = parseRoomList(info.value);
          if (info.next) building = info.next;
        }
      }
      if (!platoonLeader) {
        const info = labelInfo(row, 'trung doi truong');
        if (info) platoonLeader = info.value;
      }
      if (!squadLeader) {
        const info = labelInfo(row, 'tieu doi truong');
        if (info) squadLeader = info.value;
      }
    }

    blocks.push({
      end: nextStart,
      headerIndex,
      headerRow: rows[headerIndex] || [],
      trungDoi: trungDoi || '',
      tieuDoiRaw: tieuDoiRaw || '',
      order,
      rooms,
      building: building || (rooms.find(entry => entry.building)?.building || ''),
      platoonLeader: platoonLeader || '',
      squadLeader: squadLeader || ''
    });
  });

  if (!blocks.length) {
    return {
      students: [],
      errors: ['Có mẫu biên chế nhưng không tìm thấy dòng tiêu đề "Họ và tên" và "Mã SV".'],
      headerRow: null,
      headerIndex: -1,
      mapping: {}
    };
  }

  const records: BienCheRecord[] = [];
  const errors: string[] = [];
  let firstHeaderRow: string[] | null = null;
  let firstHeaderIndex = -1;
  const mapping: Record<string, number> = {};

  blocks.forEach(block => {
    const header = block.headerRow;
    if (!firstHeaderRow) {
      firstHeaderRow = header;
      firstHeaderIndex = block.headerIndex;
    }
    const nextStart = block.end;
    const nameIndex = findStudentColumn(header, STUDENT_ALIASES.name);
    if (nameIndex < 0) return;
    const nextHeader = normalizeText(header[nameIndex + 1] || '');
    const givenNameIndex = (!nextHeader || nextHeader === 'ten' || nextHeader === 'ten dem') ? nameIndex + 1 : -1;
    const codeIndex = findStudentColumn(header, STUDENT_ALIASES.code);
    const classNameIndex = findStudentColumn(header, STUDENT_ALIASES.className);
    const schoolIndex = findStudentColumn(header, STUDENT_ALIASES.school);
    const birthDateIndex = findStudentColumn(header, STUDENT_ALIASES.birthDate);
    const hometownIndex = findStudentColumn(header, STUDENT_ALIASES.hometown);
    const genderIndex = findStudentColumn(header, STUDENT_ALIASES.gender);
    const signatureIndex = findStudentColumn(header, ['chu ky']);
    const ethnicityIndex = findStudentColumn(header, STUDENT_ALIASES.ethnicity) >= 0
      ? findStudentColumn(header, STUDENT_ALIASES.ethnicity)
      : (signatureIndex >= 0 ? signatureIndex + 1 : -1);
    const cccdIndex = findStudentColumn(header, STUDENT_ALIASES.cccd) >= 0
      ? findStudentColumn(header, STUDENT_ALIASES.cccd)
      : (signatureIndex >= 0 ? signatureIndex + 2 : -1);
    const phoneIndex = findStudentColumn(header, STUDENT_ALIASES.phone);
    const noteIndex = findStudentColumn(header, STUDENT_ALIASES.note);
    const roomIndex = findStudentColumn(header, STUDENT_ALIASES.room) >= 0
      ? findStudentColumn(header, STUDENT_ALIASES.room)
      : detectRoomColumn(rows, block.headerIndex + 1, nextStart, Math.max(0, schoolIndex + 1));

    Object.assign(mapping, {
      name: nameIndex,
      code: codeIndex,
      className: classNameIndex,
      school: schoolIndex,
      birthDate: birthDateIndex,
      hometown: hometownIndex,
      gender: genderIndex,
      ethnicity: ethnicityIndex,
      cccd: cccdIndex,
      trungDoi: -1,
      tieuDoi: -1
    });
    if (mapping.room === undefined || mapping.room < 0) mapping.room = roomIndex;

    let currentRoom = block.rooms[0]?.room || '';
    let currentBuilding = block.rooms[0]?.building || block.building;
    for (let index = block.headerIndex + 1; index < nextStart; index++) {
      const row = rows[index] || [];
      const mainName = cell(row, nameIndex);
      const givenName = givenNameIndex >= 0 ? cell(row, givenNameIndex) : '';
      const name = [mainName, givenName].filter(Boolean).join(' ').trim();
      if (!name || normalizeText(name).includes('ho va ten')) continue;
      if (!mainName && !givenName) continue;

      const roomValue = roomIndex >= 0 ? cell(row, roomIndex) : '';
      const roomInfo = parseRoomValue(roomValue);
      if (roomInfo.room) {
        currentRoom = roomInfo.room;
        if (roomInfo.building) currentBuilding = roomInfo.building;
      }
      const building = roomInfo.building || currentBuilding || block.building;
      const trungDoi = block.trungDoi || '';
      const student = normalizeStudent({
        name,
        code: cell(row, codeIndex),
        building: building || inferBuilding(items, trungDoi),
        room: roomInfo.room || currentRoom,
        tieuDoi: block.tieuDoiRaw || '',
        trungDoi,
        position: '',
        phone: cell(row, phoneIndex),
        note: cell(row, noteIndex),
        className: cell(row, classNameIndex),
        school: cell(row, schoolIndex),
        birthDate: cell(row, birthDateIndex),
        hometown: cell(row, hometownIndex),
        gender: cell(row, genderIndex),
        ethnicity: cell(row, ethnicityIndex),
        cccd: cell(row, cccdIndex)
      });
      if (!student) continue;
      records.push({
        student,
        blockOrder: block.order,
        tieuDoiRaw: block.tieuDoiRaw,
        trungDoi,
        platoonLeader: block.platoonLeader,
        squadLeader: block.squadLeader
      });
    }
  });

  if (!records.length) {
    return {
      students: [],
      errors: errors.length ? errors : ['Không tìm thấy sinh viên trong mẫu biên chế.'],
      headerRow: firstHeaderRow,
      headerIndex: firstHeaderIndex,
      mapping
    };
  }

  const groups = new Map<string, BienCheRecord[]>();
  records.forEach(record => {
    const key = normalizeText(record.trungDoi) || '__unassigned__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(record);
  });

  groups.forEach(groupRecords => {
    const blockOrders = Array.from(new Set(groupRecords.map(record => record.blockOrder))).sort((a, b) => a - b);
    const leaderByRole: Array<[string, string]> = [];
    blockOrders.forEach(order => {
      const record = groupRecords.find(entry => entry.blockOrder === order);
      if (record?.platoonLeader) leaderByRole.push(['Trung đội trưởng', record.platoonLeader]);
      if (record?.squadLeader) leaderByRole.push(['Tiểu đội trưởng', record.squadLeader]);
    });
    leaderByRole.forEach(([position, leaderName]) => {
      const normalizedLeader = normalizeText(leaderName);
      const matched = groupRecords.find(record => normalizeText(record.student.name) === normalizedLeader);
      if (matched) matched.student.position = position;
    });
  });

  return {
    students: sortStudents(records.map(record => record.student)),
    errors,
    headerRow: firstHeaderRow,
    headerIndex: firstHeaderIndex,
    mapping
  };
}

export function parseStudentRows(rows: string[][], items: any[] = []): StudentImportResult {
  const cleanRows = (Array.isArray(rows) ? rows : []).filter(row => Array.isArray(row) && row.some(cellValue => String(cellValue || '').trim()));
  const bienChe = parseBienCheRows(cleanRows, items);
  if (bienChe) return bienChe;

  const header = findHeaderMapping(cleanRows);
  const mapping = header ? header.mapping : { ...DEFAULT_MAPPING };
  const headerIndex = header ? header.headerIndex : -1;
  const dataRows = cleanRows.slice(header ? headerIndex + 1 : 0);
  const students: Student[] = [];
  const errors: string[] = [];

  dataRows.forEach((row, index) => {
    const lineNumber = (header ? headerIndex + 1 : 0) + index + 1;
    const name = cell(row, mapping.name);
    if (!name) {
      if (row.some(value => String(value || '').trim())) {
        errors.push(`Dòng ${lineNumber}: thiếu họ tên.`);
      }
      return;
    }

    const trungDoi = cell(row, mapping.trungDoi);
    const building = cell(row, mapping.building) || inferBuilding(items, trungDoi);
    const student = normalizeStudent({
      name,
      code: cell(row, mapping.code),
      building,
      room: cell(row, mapping.room),
      tieuDoi: cell(row, mapping.tieuDoi),
      trungDoi,
      position: cell(row, mapping.position),
      phone: cell(row, mapping.phone),
      note: cell(row, mapping.note),
      className: cell(row, mapping.className),
      school: cell(row, mapping.school),
      birthDate: cell(row, mapping.birthDate),
      hometown: cell(row, mapping.hometown),
      gender: cell(row, mapping.gender),
      ethnicity: cell(row, mapping.ethnicity),
      cccd: cell(row, mapping.cccd)
    });

    if (!student) {
      errors.push(`Dòng ${lineNumber}: dữ liệu sinh viên không hợp lệ.`);
      return;
    }
    students.push(student);
  });

  if (!students.length && !errors.length) {
    errors.push('Không tìm thấy dòng sinh viên nào. Kiểm tra lại tên cột hoặc dữ liệu đã dán.');
  }

  return {
    students,
    errors,
    headerRow: header ? cleanRows[headerIndex] : null,
    headerIndex,
    mapping
  };
}

export function mergeStudentLists(current: Student[], incoming: Student[]): Student[] {
  const result = (current || []).slice();
  const byCode = new Map<string, number>();
  const byNameRoom = new Map<string, number>();

  result.forEach((student, index) => {
    if (student.code) byCode.set(normalizeText(student.code), index);
    byNameRoom.set(`${normalizeText(student.name)}::${normalizeText(student.room)}`, index);
  });

  (incoming || []).forEach(student => {
    const codeKey = student.code ? normalizeText(student.code) : '';
    const nameKey = `${normalizeText(student.name)}::${normalizeText(student.room)}`;
    const index = codeKey
      ? (byCode.has(codeKey) ? byCode.get(codeKey)! : -1)
      : (byNameRoom.has(nameKey) ? byNameRoom.get(nameKey)! : -1);

    if (index >= 0) {
      const id = result[index].id;
      result[index] = { ...student, id };
      if (student.code) byCode.set(codeKey, index);
      byNameRoom.set(nameKey, index);
    } else {
      const nextIndex = result.length;
      result.push(student);
      if (student.code) byCode.set(codeKey, nextIndex);
      byNameRoom.set(nameKey, nextIndex);
    }
  });

  return sortStudents(result);
}

export function studentCSV(students: Student[]): string {
  const header = ['Họ tên', 'Mã SV', 'Tòa', 'Phòng', 'Tiểu đội', 'Trung đội', 'Chức vụ', 'SĐT', 'Ghi chú', 'Lớp', 'Trường', 'Ngày sinh', 'Nơi sinh', 'Giới tính', 'Dân tộc', 'CCCD'];
  const rows = sortStudents(students).map(student => [
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
  ]);
  return [header, ...rows].map(row => row.map(value => {
    const text = String(value === undefined || value === null ? '' : value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(',')).join('\r\n');
}
