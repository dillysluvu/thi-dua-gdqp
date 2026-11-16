import type { CourseRecord } from '../courseStore';
import { isLeaderPosition, studentCSV, type Student } from '../students';
import { downloadFile, formatNum, pad2, slugify } from '../utils';
import { dateToken, formatShortDate } from './record';

function csvCell(value: unknown): string {
  const text = String(value === undefined || value === null ? '' : value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csv(rows: unknown[][]): string {
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}

export function exportRecordJSON(record: CourseRecord): void {
  const filename = `ThiDua_${slugify(record.meta.courseName)}_${dateToken(record)}.json`;
  downloadFile(JSON.stringify(record, null, 2), filename, 'application/json;charset=utf-8');
}

export function exportRecordCSV(record: CourseRecord): void {
  const rows: unknown[][] = [
    [`Khóa: ${record.meta.courseName}`],
    [`Đơn vị: ${record.meta.unitName}`],
    [`Ngày: ${pad2(record.meta.ngay)}/${pad2(record.meta.thang)}/${record.meta.nam}`],
    [],
    ['b', 'c', 'Tòa', 'Phòng', 'Quân số', 'Học tập', 'Rèn luyện', 'NVVS', 'Lễ tiết', 'Tổng điểm', 'Hạng', 'Ghi chú']
  ];

  record.items.forEach(item => {
    rows.push([
      item.id,
      item.daiDoi || '',
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

  const filename = `ThiDua_${slugify(record.meta.courseName)}_${dateToken(record)}.csv`;
  downloadFile(csv(rows), filename, 'text/csv;charset=utf-8');
}

export function exportStudentsCSV(record: CourseRecord, leadersOnly = false): void {
  const students = leadersOnly
    ? record.students.filter((student: Student) => isLeaderPosition(student.position))
    : record.students;
  if (!students.length) return;
  const filename = `${leadersOnly ? 'CanSu' : 'SinhVien'}_${slugify(record.meta.courseName)}_${dateToken(record)}.csv`;
  downloadFile('\uFEFF' + studentCSV(students), filename, 'text/csv;charset=utf-8');
}

export function exportAuditCSV(record: CourseRecord): void {
  if (!record.audit.length) return;
  const rows: unknown[][] = [['Thời gian', 'Người thực hiện', 'Hành động', 'Chi tiết']];
  record.audit.forEach(entry => {
    rows.push([
      formatShortDate(entry.at) + ' ' + new Date(entry.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      entry.actor,
      entry.action,
      entry.detail
    ]);
  });
  const filename = `NhatKy_${slugify(record.meta.courseName)}_${dateToken(record)}.csv`;
  downloadFile(csv(rows), filename, 'text/csv;charset=utf-8');
}
