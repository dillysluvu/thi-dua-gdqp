import { describe, expect, it } from 'vitest';
import { daiDoiFromTrungDoi, effectiveDaiDoi, unitCode, unitFull, unitLabel, unitValue } from './units';

describe('units', () => {
  it('dùng kí hiệu a/b/c cho tiểu đội, trung đội, đại đội', () => {
    expect(unitCode('tieuDoi', 45)).toBe('a45');
    expect(unitCode('trungDoi', 12)).toBe('b12');
    expect(unitCode('daiDoi', 3)).toBe('c3');
  });

  it('không nhân đôi kí hiệu khi dữ liệu đã có a/b/c', () => {
    expect(unitValue('b12')).toBe('12');
    expect(unitCode('trungDoi', 'b12')).toBe('b12');
    expect(unitCode('daiDoi', 'C.3')).toBe('c3');
  });

  it('giữ nhãn đầy đủ cho trợ năng', () => {
    expect(unitLabel('daiDoi')).toBe('Đại đội (c)');
    expect(unitFull('trungDoi', 12)).toBe('Trung đội 12 (b12)');
  });

  it('trả về chuỗi rỗng khi chưa xếp đơn vị', () => {
    expect(unitCode('tieuDoi', '')).toBe('');
    expect(unitFull('daiDoi', '')).toBe('Đại đội');
  });

  it('suy ra đại đội: cứ 4 trung đội là 1 đại đội', () => {
    expect([1, 2, 3, 4].map(daiDoiFromTrungDoi)).toEqual(['1', '1', '1', '1']);
    expect([5, 8, 9, 12, 168].map(daiDoiFromTrungDoi)).toEqual(['2', '2', '3', '3', '42']);
    expect(daiDoiFromTrungDoi('b12')).toBe('3');
    expect(daiDoiFromTrungDoi('')).toBe('');
  });

  it('ưu tiên đại đội đã nhập, chỉ suy ra khi còn trống', () => {
    expect(effectiveDaiDoi('', 12)).toBe('3');
    expect(effectiveDaiDoi('c5', 12)).toBe('5');
    expect(effectiveDaiDoi('', '')).toBe('');
  });
});
