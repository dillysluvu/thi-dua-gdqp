import { describe, expect, it } from 'vitest';
import {
  countStudentsForPlatoon,
  groupStudentsByPlatoon,
  groupStudentsByRoom,
  mergeStudentLists,
  normalizePosition,
  normalizeStudents,
  parseStudentRows,
  studentCSV,
  studentMatchesPlatoon
} from './students';
import { parseSheetText } from './parsers';

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

  it('đọc file biên chế nhiều tiểu đội, ghép họ tên và giữ thông tin phụ', () => {
    const result = parseStudentRows([
      ['', '', '', '', ' Danh sách biên chế tiểu đội :', '46', '', '', '', 'Trung đội :', '16', '', '', '', ''],
      ['', '', '', '', '', '', 'Trung đội trưởng:', 'Nguyễn Văn A', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', 'Tiểu đội trưởng :', 'Trần Thị B', '', 'Phòng ở:', '503+504', 'C7', '', ''],
      ['', 'STT', 'mã tt', 'Mã SV', 'Họ và tên', '', 'Ngày sinh', 'Nơi sinh', 'Lớp', 'Giới tính', 'Trường', '', 'chữ ký', '', ''],
      ['', '1', '1', 'SV01', 'Nguyễn Văn', 'A', '01/01/2008', 'Hà Nội', 'AT23A', 'Nam', 'HVMM', '503 - C7', '', 'Kinh', '001208000001'],
      ['', '2', '2', 'SV02', 'Trần Thị', 'B', '02/02/2008', 'Hải Phòng', 'AT23A', 'Nữ', 'HVMM', '', '', 'Kinh', '001208000002'],
      ['', '3', '3', 'SV03', 'Lê Văn', 'C', '03/03/2008', 'Nam Định', 'AT23A', 'Nam', 'HVMM', '504 - C7', '', 'Kinh', '001208000003'],
      ['', '4', '4', 'SV04', 'Phạm Văn', 'D', '04/04/2008', 'Thái Bình', 'AT23A', 'Nam', 'HVMM', '', '', 'Kinh', '001208000004'],
      ['', '', '', '', ' Danh sách biên chế tiểu đội :', '47', '', '', '', 'Trung đội :', '16', '', '', '', ''],
      ['', '', '', '', '', '', 'Trung đội trưởng:', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', 'Tiểu đội trưởng :', '', '', 'Phòng ở:', '505', 'C7', '', ''],
      ['', 'STT', 'mã tt', 'Mã SV', 'Họ và tên', '', 'Ngày sinh', 'Nơi sinh', 'Lớp', 'Giới tính', 'Trường', '', 'chữ ký', '', ''],
      ['', '1', '5', 'SV05', 'Hoàng Văn', 'E', '05/05/2008', 'Ninh Bình', 'AT23A', 'Nam', 'HVMM', '505 - C7', '', 'Kinh', '001208000005'],
      ['', '', '', '', ' Danh sách biên chế tiểu đội :', '1', '', '', '', 'Trung đội :', '17', '', '', '', ''],
      ['', '', '', '', '', '', 'Trung đội trưởng:', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', 'Tiểu đội trưởng :', '', '', 'Phòng ở:', '506', 'C7', '', ''],
      ['', 'STT', 'mã tt', 'Mã SV', 'Họ và tên', '', 'Ngày sinh', 'Nơi sinh', 'Lớp', 'Giới tính', 'Trường', '', 'chữ ký', '', ''],
      ['', '1', '6', 'SV06', 'Vũ Văn', 'F', '06/06/2008', 'Hà Nam', 'AT23A', 'Nam', 'HVMM', '506 - C7', '', 'Kinh', '001208000006']
    ]);

    expect(result.errors).toEqual([]);
    expect(result.students).toHaveLength(6);
    const byCode = new Map(result.students.map(student => [student.code, student]));
    expect(byCode.get('SV01')?.name).toBe('Nguyễn Văn A');
    expect(byCode.get('SV01')?.trungDoi).toBe('16');
    expect(byCode.get('SV01')?.tieuDoi).toBe('46');
    expect(byCode.get('SV01')?.room).toBe('503');
    expect(byCode.get('SV01')?.building).toBe('C7');
    expect(byCode.get('SV01')?.className).toBe('AT23A');
    expect(byCode.get('SV01')?.birthDate).toBe('01/01/2008');
    expect(byCode.get('SV01')?.hometown).toBe('Hà Nội');
    expect(byCode.get('SV01')?.cccd).toBe('001208000001');
    expect(byCode.get('SV01')?.position).toBe('Trung đội trưởng');
    expect(byCode.get('SV02')?.position).toBe('Tiểu đội trưởng');
    expect(byCode.get('SV03')?.room).toBe('504');
    expect(byCode.get('SV04')?.room).toBe('504');
    expect(byCode.get('SV05')?.tieuDoi).toBe('47');
    expect(byCode.get('SV06')?.trungDoi).toBe('17');
    expect(byCode.get('SV06')?.tieuDoi).toBe('1');
  });

  it('giữ số tiểu đội liên tục 1–12, không reset theo từng trung đội', () => {
    const rows: string[][] = [];
    for (let trungDoi = 1; trungDoi <= 4; trungDoi++) {
      for (let tieuDoi = (trungDoi - 1) * 3 + 1; tieuDoi <= trungDoi * 3; tieuDoi++) {
        rows.push(['', '', '', '', ' Danh sách biên chế tiểu đội :', String(tieuDoi), '', '', '', 'Trung đội :', String(trungDoi), '', '', '', '']);
        rows.push(['', '', '', '', '', '', 'Tiểu đội trưởng :', '', '', 'Phòng ở:', '503', 'C7', '', '']);
        rows.push(['', 'STT', 'mã tt', 'Mã SV', 'Họ và tên', '', 'Ngày sinh', 'Nơi sinh', 'Lớp', 'Giới tính', 'Trường', '', 'chữ ký', '', '']);
        rows.push(['', '1', '1', `SV${tieuDoi}`, 'Học viên', String(tieuDoi), '', '', '', '', '', '503 - C7', '', '', '']);
      }
    }

    const result = parseStudentRows(rows);
    expect(result.errors).toEqual([]);
    expect(result.students).toHaveLength(12);
    expect(result.students.map(student => student.tieuDoi)).toEqual([
      '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
    ]);
  });

  it('nhóm theo trung đội cho giao diện danh sách', () => {
    const students = normalizeStudents([
      { id: '1', name: 'A', room: '503', trungDoi: '2', tieuDoi: '1' },
      { id: '2', name: 'B', room: '504', trungDoi: '2', tieuDoi: '2' },
      { id: '3', name: 'C', room: '505', trungDoi: '1', tieuDoi: '1' }
    ]);
    const groups = groupStudentsByPlatoon(students);
    expect(groups).toHaveLength(2);
    expect(groups[0].trungDoi).toBe('1');
    expect(groups[1].trungDoi).toBe('2');
    expect(groups[1].rooms).toEqual(['503', '504']);
    expect(groups[1].students).toHaveLength(2);
  });


  it('không gộp hai sinh viên khác mã dù trùng tên và phòng', () => {
    const current = normalizeStudents([{ id: '1', name: 'Nguyễn Văn A', code: 'SV01', room: '503' }]);
    const incoming = normalizeStudents([{ id: '2', name: 'Nguyễn Văn A', code: 'SV99', room: '503' }]);
    const merged = mergeStudentLists(current, incoming);
    expect(merged).toHaveLength(2);
    expect(merged.map(student => student.code).sort()).toEqual(['SV01', 'SV99']);
  });


  it('xuất CSV và nhập lại giữ thông tin bổ sung', () => {
    const students = normalizeStudents([{
      id: '1',
      name: 'Nguyễn Văn A',
      code: 'SV01',
      building: 'C7',
      room: '503',
      tieuDoi: '1',
      trungDoi: '1',
      position: 'Tiểu đội trưởng',
      className: 'AT23A',
      school: 'HVMM',
      birthDate: '01/01/2008',
      hometown: 'Hà Nội',
      gender: 'Nam',
      ethnicity: 'Kinh',
      cccd: '001208000001'
    }]);
    const csv = studentCSV(students);
    const result = parseStudentRows(parseSheetText(csv));
    expect(result.students).toHaveLength(1);
    expect(result.students[0]).toMatchObject({
      name: 'Nguyễn Văn A',
      code: 'SV01',
      className: 'AT23A',
      school: 'HVMM',
      birthDate: '01/01/2008',
      hometown: 'Hà Nội',
      gender: 'Nam',
      ethnicity: 'Kinh',
      cccd: '001208000001',
      position: 'Tiểu đội trưởng'
    });
  });

});
