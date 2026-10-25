import { describe, expect, it } from 'vitest';
import {
  courseKey,
  cloneRecord,
  makeDefaultRecord,
  snapshotKey,
  summarizeRecord
} from './courseStore';

describe('courseStore', () => {
  it('tạo khóa mặc định với 56 trung đội', () => {
    const record = makeDefaultRecord('K338');
    expect(record.meta.courseName).toBe('K338');
    expect(record.items).toHaveLength(56);
    expect(record.items[0].totalScore).toBe(50);
    expect(record.items[0].rank).toBe(1);
    expect(record.audit).toEqual([]);
  });

  it('nhân bản khóa giữ cấu hình nhưng đặt điểm về 0', () => {
    const source = makeDefaultRecord('K337');
    source.meta.locked = true;
    source.meta.unitName = 'Trung Tâm GDQP&AN';
    source.items[0].hocTap = -5;
    source.items[0].note = 'Đi muộn';
    source.items[0].totalScore = 45;
    source.audit.push({ id: 'a1', at: '', action: 'Sửa điểm', detail: '', actor: 'GV' });

    const clone = cloneRecord(source, 'K338');

    expect(clone.meta.id).not.toBe(source.meta.id);
    expect(clone.meta.courseName).toBe('K338');
    expect(clone.meta.unitName).toBe('Trung Tâm GDQP&AN');
    expect(clone.meta.locked).toBe(false);
    expect(clone.items[0].building).toBe(source.items[0].building);
    expect(clone.items[0].quanSo).toBe(source.items[0].quanSo);
    expect(clone.items[0].hocTap).toBe(0);
    expect(clone.items[0].note).toBe('');
    expect(clone.items[0].totalScore).toBe(50);
    expect(clone.audit).toEqual([]);
    expect(source.items[0].hocTap).toBe(-5);
  });

  it('tóm tắt khóa dùng cho danh sách chọn khóa', () => {
    const record = makeDefaultRecord('K337');
    record.meta.unitName = 'Đơn vị A';
    const summary = summarizeRecord(record);
    expect(summary).toMatchObject({
      id: record.meta.id,
      courseName: 'K337',
      unitName: 'Đơn vị A',
      itemCount: 56,
      locked: false
    });
  });

  it('tạo đúng khóa lưu localStorage', () => {
    expect(courseKey('abc')).toBe('THI_DUA_GDQPAN_V3:course:abc');
    expect(snapshotKey('abc')).toBe('THI_DUA_GDQPAN_V3:snapshots:abc');
  });
});
