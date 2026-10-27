import { describe, expect, it } from 'vitest';
import {
  countStudentsForPlatoon,
  groupStudentsByRoom,
  mergeStudentLists,
  normalizePosition,
  normalizeStudents,
  parseStudentRows,
  studentMatchesPlatoon
} from './students';

describe('students', () => {
  it('chuẩn hóa chức vụ', () => {
    expect(normalizePosition('Tiểu đội trưởng')).toBe('Tiểu đội trưởng');
    expect(normalizePosition('PHÓ ĐẠI ĐỘI TRƯỞNG')).toBe('Phó đại đội trưởng');
    expect(normalizePosition('Trung đội phó')).toBe('Học viên');
    expect(normalizePosition('')).toBe('Học viên');
  });

  it('đọc bảng sinh viên có tiêu đề', () => {
    const result = parseStudentRows([
      ['STT', 'Họ tên', 'MSSV', 'Tòa', 'Phòng', 'Tiểu đội', 'Trung đội', 'Chức vụ', 'SĐT'],
      ['1', 'Nguyễn Văn A', 'SV01', 'Toà C7', '503', '1', '1', 'Tiểu đội trưởng', '0901'],
      ['2', 'Trần Thị B', 'SV02', 'Toà C7', '503', '1', '1', '', '']
    ]);
    expect(result.errors).toEqual([]);
    expect(result.students).toHaveLength(2);
    expect(result.students[0].name).toBe('Nguyễn Văn A');
    expect(result.students[0].position).toBe('Tiểu đội trưởng');
    expect(result.students[1].position).toBe('Học viên');
  });

  it('suy ra tòa từ số trung đội nếu thiếu', () => {
    const result = parseStudentRows([
      ['Họ tên', 'Trung đội', 'Phòng'],
      ['Lê Văn C', '2', '507']
    ], [{ id: 2, building: 'Toà C7', rooms: '507, 508' }]);
    expect(result.students[0].building).toBe('Toà C7');
  });

  it('nhóm theo phòng và đếm theo trung đội', () => {
    const students = normalizeStudents([
      { id: '1', name: 'A', building: 'Toà C7', room: '503', trungDoi: '1', tieuDoi: '1' },
      { id: '2', name: 'B', building: 'Toà C7', room: '503', trungDoi: '1', tieuDoi: '1' },
      { id: '3', name: 'C', building: 'Toà C7', room: '504', trungDoi: '1', tieuDoi: '2' }
    ]);
    const groups = groupStudentsByRoom(students);
    expect(groups).toHaveLength(2);
    expect(groups[0].students).toHaveLength(2);
    expect(countStudentsForPlatoon(students, { id: 1, building: 'Toà C7', rooms: '503, 504' })).toBe(3);
    expect(studentMatchesPlatoon(students[2], { id: 1, building: 'Toà C7', rooms: '503, 504' })).toBe(true);
  });

  it('gộp danh sách theo mã sinh viên', () => {
    const current = normalizeStudents([{ id: '1', name: 'A', code: 'SV01', room: '503' }]);
    const incoming = normalizeStudents([{ id: '2', name: 'A mới', code: 'SV01', room: '503' }, { id: '3', name: 'B', code: 'SV02', room: '504' }]);
    const merged = mergeStudentLists(current, incoming);
    expect(merged).toHaveLength(2);
    expect(merged.find(s => s.code === 'SV01')?.name).toBe('A mới');
  });
});
