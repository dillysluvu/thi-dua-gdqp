import { describe, expect, it } from 'vitest';
import {
  clampInt,
  formatNum,
  isNumericDraft,
  normalizeQuanSo,
  normalizeText,
  round1,
  slugify
} from './utils';

describe('utils', () => {
  it('clampInt giới hạn số nguyên trong khoảng', () => {
    expect(clampInt('15', 1, 31, 21)).toBe(15);
    expect(clampInt('40', 1, 31, 21)).toBe(31);
    expect(clampInt('abc', 1, 31, 21)).toBe(21);
  });

  it('round1 và formatNum xử lý số thập phân', () => {
    expect(round1(49.95)).toBe(50);
    expect(round1('48.54')).toBe(48.5);
    expect(formatNum(50)).toBe('50');
    expect(formatNum(-0.5)).toBe('-0.5');
    expect(formatNum('abc')).toBe('0');
  });

  it('normalizeText bỏ dấu tiếng Việt và chữ hoa', () => {
    expect(normalizeText('  Toà C7 - Trung Đội 1  ')).toBe('toa c7 - trung doi 1');
  });

  it('normalizeQuanSo chấp nhận dạng 30/31 và 30', () => {
    expect(normalizeQuanSo('30/31')).toBe('30/31');
    expect(normalizeQuanSo('30')).toBe('30/30');
    expect(normalizeQuanSo('31/30')).toBeNull();
    expect(normalizeQuanSo('abc')).toBeNull();
    expect(normalizeQuanSo('')).toBe('');
  });

  it('slugify tạo tên file an toàn', () => {
    expect(slugify('K337 - ĐHKT')).toBe('k337_dhkt');
    expect(slugify('')).toBe('Khoa');
  });

  it('isNumericDraft nhận số đang nhập', () => {
    expect(isNumericDraft('-0.5')).toBe(true);
    expect(isNumericDraft('10,')).toBe(true);
    expect(isNumericDraft('abc')).toBe(false);
  });
});
