import { describe, expect, it } from 'vitest';
import { makeDefaultRecord } from './courseStore';
import { mergeCourseRecords } from './merge';
import { normalizeStudents } from './students';

function withItem(record: any, id: number, score: number, updatedAt: string) {
  const item = record.items.find((entry: any) => entry.id === id);
  item.hocTap = score;
  item.updatedAt = updatedAt;
  return record;
}

describe('mergeCourseRecords', () => {
  it('giữ thay đổi điểm ở hai trung đội khác nhau', () => {
    const local = makeDefaultRecord('K337');
    const remote = makeDefaultRecord('K337');
    local.meta.id = remote.meta.id = 'course-1';
    local.savedAt = '2026-10-27T08:00:10.000Z';
    remote.savedAt = '2026-10-27T08:00:09.000Z';
    withItem(local, 1, -2, '2026-10-27T08:00:10.000Z');
    withItem(remote, 2, -3, '2026-10-27T08:00:09.000Z');

    const result = mergeCourseRecords(local, remote);
    expect(result.record.items.find((entry: any) => entry.id === 1).hocTap).toBe(-2);
    expect(result.record.items.find((entry: any) => entry.id === 2).hocTap).toBe(-3);
    expect(result.localNewer).toBe(true);
    expect(result.remoteNewer).toBe(true);
  });

  it('ưu tiên cấu hình mới hơn', () => {
    const local = makeDefaultRecord('K337');
    const remote = makeDefaultRecord('K338');
    local.meta.id = remote.meta.id = 'course-1';
    local.meta.settingsUpdatedAt = '2026-10-27T08:00:00.000Z';
    remote.meta.settingsUpdatedAt = '2026-10-27T09:00:00.000Z';
    remote.savedAt = '2026-10-27T09:00:00.000Z';
    local.savedAt = '2026-10-27T08:00:00.000Z';

    const result = mergeCourseRecords(local, remote);
    expect(result.record.meta.courseName).toBe('K338');
    expect(result.remoteNewer).toBe(true);
  });

  it('gộp danh sách sinh viên theo updatedAt', () => {
    const local = makeDefaultRecord('K337');
    const remote = makeDefaultRecord('K337');
    local.meta.id = remote.meta.id = 'course-1';
    local.students = normalizeStudents([{ id: 'a', name: 'A', room: '503', updatedAt: '2026-10-27T08:00:00.000Z' }]);
    remote.students = normalizeStudents([
      { id: 'a', name: 'A mới', room: '503', updatedAt: '2026-10-27T09:00:00.000Z' },
      { id: 'b', name: 'B', room: '504', updatedAt: '2026-10-27T09:00:00.000Z' }
    ]);
    local.meta.studentsUpdatedAt = '2026-10-27T08:00:00.000Z';
    remote.meta.studentsUpdatedAt = '2026-10-27T09:00:00.000Z';
    local.savedAt = '2026-10-27T08:00:00.000Z';
    remote.savedAt = '2026-10-27T09:00:00.000Z';

    const result = mergeCourseRecords(local, remote);
    expect(result.record.students).toHaveLength(2);
    expect(result.record.students.find((student: any) => student.id === 'a')?.name).toBe('A mới');
  });

  it('gộp nhật ký không trùng id', () => {
    const local = makeDefaultRecord('K337');
    const remote = makeDefaultRecord('K337');
    local.meta.id = remote.meta.id = 'course-1';
    local.audit = [{ id: 'a1', at: '2026-10-27T08:00:00.000Z', action: 'A', detail: '', actor: 'X' }];
    remote.audit = [
      { id: 'a1', at: '2026-10-27T08:00:00.000Z', action: 'A', detail: '', actor: 'X' },
      { id: 'a2', at: '2026-10-27T09:00:00.000Z', action: 'B', detail: '', actor: 'Y' }
    ];

    const result = mergeCourseRecords(local, remote);
    expect(result.record.audit).toHaveLength(2);
  });

  it('báo localNewer khi cấu hình địa phương mới hơn', () => {
    const local = makeDefaultRecord('K339');
    const remote = makeDefaultRecord('K337');
    local.meta.id = remote.meta.id = 'course-1';
    local.meta.settingsUpdatedAt = '2026-10-27T10:00:00.000Z';
    remote.meta.settingsUpdatedAt = '2026-10-27T09:00:00.000Z';
    local.savedAt = '2026-10-27T10:00:00.000Z';
    remote.savedAt = '2026-10-27T09:00:00.000Z';

    const result = mergeCourseRecords(local, remote);
    expect(result.record.meta.courseName).toBe('K339');
    expect(result.localNewer).toBe(true);
  });

  it('lần đồng bộ đầu gộp danh sách sinh viên thay vì xóa bản cũ', () => {
    const local = makeDefaultRecord('K337');
    const remote = makeDefaultRecord('K337');
    local.meta.id = remote.meta.id = 'course-1';
    local.students = normalizeStudents([{ id: 'a', name: 'A', room: '503', updatedAt: '2026-10-27T10:00:00.000Z' }]);
    remote.students = normalizeStudents([{ id: 'b', name: 'B', room: '504', updatedAt: '2026-10-27T09:00:00.000Z' }]);
    local.meta.studentsUpdatedAt = '2026-10-27T10:00:00.000Z';
    remote.meta.studentsUpdatedAt = '2026-10-27T09:00:00.000Z';
    local.savedAt = '2026-10-27T10:00:00.000Z';
    remote.savedAt = '2026-10-27T09:00:00.000Z';

    const result = mergeCourseRecords(local, remote, { initial: true });
    expect(result.record.students).toHaveLength(2);
  });

  it('giữ sinh viên do hai người thêm cùng lúc', () => {
    const local = makeDefaultRecord('K337');
    const remote = makeDefaultRecord('K337');
    local.meta.id = remote.meta.id = 'course-1';
    local.students = normalizeStudents([{ id: 'x', name: 'X', room: '503', updatedAt: '2026-10-27T10:00:00.000Z' }]);
    remote.students = normalizeStudents([{ id: 'y', name: 'Y', room: '504', updatedAt: '2026-10-27T10:00:05.000Z' }]);
    local.meta.studentsUpdatedAt = '2026-10-27T10:00:00.000Z';
    remote.meta.studentsUpdatedAt = '2026-10-27T10:00:05.000Z';
    local.savedAt = '2026-10-27T10:00:00.000Z';
    remote.savedAt = '2026-10-27T10:00:05.000Z';

    const result = mergeCourseRecords(local, remote);
    expect(result.record.students?.map(student => student.id).sort()).toEqual(['x', 'y']);
    expect(result.localNewer).toBe(true);
    expect(result.remoteNewer).toBe(true);
  });

  it('xóa sinh viên bằng tombstone không bị hồi sinh', () => {
    const local = makeDefaultRecord('K337');
    const remote = makeDefaultRecord('K337');
    local.meta.id = remote.meta.id = 'course-1';
    remote.students = normalizeStudents([{ id: 'a', name: 'A', room: '503', updatedAt: '2026-10-27T09:00:00.000Z' }]);
    local.meta.studentTombstones = { a: '2026-10-27T10:00:00.000Z' };
    local.meta.studentsUpdatedAt = '2026-10-27T10:00:00.000Z';
    remote.meta.studentsUpdatedAt = '2026-10-27T09:00:00.000Z';
    local.savedAt = '2026-10-27T10:00:00.000Z';
    remote.savedAt = '2026-10-27T09:00:00.000Z';

    const result = mergeCourseRecords(local, remote);
    expect(result.record.students).toHaveLength(0);
    expect(result.record.meta.studentTombstones?.a).toBe('2026-10-27T10:00:00.000Z');
    expect(result.localNewer).toBe(true);
  });

  it('sinh viên được sửa sau tombstone thì được hồi sinh', () => {
    const local = makeDefaultRecord('K337');
    const remote = makeDefaultRecord('K337');
    local.meta.id = remote.meta.id = 'course-1';
    local.meta.studentTombstones = { a: '2026-10-27T09:00:00.000Z' };
    remote.students = normalizeStudents([{ id: 'a', name: 'A mới', room: '503', updatedAt: '2026-10-27T10:00:00.000Z' }]);
    local.meta.studentsUpdatedAt = '2026-10-27T09:00:00.000Z';
    remote.meta.studentsUpdatedAt = '2026-10-27T10:00:00.000Z';
    local.savedAt = '2026-10-27T09:00:00.000Z';
    remote.savedAt = '2026-10-27T10:00:00.000Z';

    const result = mergeCourseRecords(local, remote);
    expect(result.record.students).toHaveLength(1);
    expect(result.record.students?.[0].name).toBe('A mới');
    expect(result.record.meta.studentTombstones?.a).toBeUndefined();
    expect(result.remoteNewer).toBe(true);
  });

  it('không đẩy lại khi tombstone hai bên giống nhau', () => {
    const local = makeDefaultRecord('K337');
    const remote = makeDefaultRecord('K337');
    local.meta.id = remote.meta.id = 'course-1';
    local.students = remote.students = normalizeStudents([{ id: 'b', name: 'B', room: '504', updatedAt: '2026-10-27T09:00:00.000Z' }]);
    local.meta.studentTombstones = { a: '2026-10-27T10:00:00.000Z' };
    remote.meta.studentTombstones = { a: '2026-10-27T10:00:00.000Z' };
    local.meta.studentsUpdatedAt = remote.meta.studentsUpdatedAt = '2026-10-27T10:00:00.000Z';
    local.savedAt = remote.savedAt = '2026-10-27T10:00:00.000Z';

    const result = mergeCourseRecords(local, remote);
    expect(result.localNewer).toBe(false);
    expect(result.remoteNewer).toBe(false);
  });
})
