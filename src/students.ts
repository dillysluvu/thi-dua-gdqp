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
  note: ['ghi chu', 'note', 'ghi chu khac']
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
  note: 8
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

export function parseStudentRows(rows: string[][], items: any[] = []): StudentImportResult {
  const cleanRows = (Array.isArray(rows) ? rows : []).filter(row => Array.isArray(row) && row.some(cellValue => String(cellValue || '').trim()));
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
      note: cell(row, mapping.note)
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
    const index = codeKey && byCode.has(codeKey)
      ? byCode.get(codeKey)!
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
  const header = ['Họ tên', 'Mã SV', 'Tòa', 'Phòng', 'Tiểu đội', 'Trung đội', 'Chức vụ', 'SĐT', 'Ghi chú'];
  const rows = sortStudents(students).map(student => [
    student.name,
    student.code,
    student.building,
    student.room,
    student.tieuDoi,
    student.trungDoi,
    student.position,
    student.phone,
    student.note
  ]);
  return [header, ...rows].map(row => row.map(value => {
    const text = String(value === undefined || value === null ? '' : value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(',')).join('\r\n');
}
