import { describe, expect, it } from 'vitest';
import { calculateItemTotal, calculateScoreStats, recalculateScores } from './scoring';

describe('calculateItemTotal', () => {
  it('cộng điểm gốc với các khoản trừ', () => {
    expect(calculateItemTotal(50, { hocTap: -1, renLuyen: -0.5, nvvs: 0, leTiet: -2 })).toBe(46.5);
  });

  it('làm tròn 1 chữ số thập phân', () => {
    expect(calculateItemTotal(50, { hocTap: -0.05, renLuyen: 0, nvvs: 0, leTiet: 0 })).toBe(50);
    expect(calculateItemTotal(50, { hocTap: -0.06, renLuyen: 0, nvvs: 0, leTiet: 0 })).toBe(49.9);
  });

  it('bỏ qua giá trị không phải số', () => {
    expect(calculateItemTotal(50, { hocTap: 'abc', renLuyen: null, nvvs: undefined, leTiet: '' })).toBe(50);
  });
});

describe('recalculateScores', () => {
  it('tính điểm và xếp hạng theo điểm giảm dần', () => {
    const items = [
      { id: 1, hocTap: -2, renLuyen: 0, nvvs: 0, leTiet: 0 },
      { id: 2, hocTap: 0, renLuyen: 0, nvvs: 0, leTiet: 0 },
      { id: 3, hocTap: -2, renLuyen: 0, nvvs: 0, leTiet: 0 },
      { id: 4, hocTap: -3, renLuyen: 0, nvvs: 0, leTiet: 0 }
    ];

    const result = recalculateScores(items, 50);
    expect(result.map(item => item.totalScore)).toEqual([48, 50, 48, 47]);
    expect(result.map(item => item.rank)).toEqual([2, 1, 2, 3]);
  });

  it('không thay đổi mảng đầu vào', () => {
    const items = [{ id: 1, hocTap: -1 }];
    recalculateScores(items, 50);
    expect(items[0]).toEqual({ id: 1, hocTap: -1 });
  });
});

describe('calculateScoreStats', () => {
  it('tổng hợp quân số, điểm trung bình và số lượng đạt/trừ', () => {
    const items = [
      { id: 1, quanSo: '32/32', totalScore: 50 },
      { id: 2, quanSo: '30/31', totalScore: 48.5 },
      { id: 3, quanSo: '28/30', totalScore: 50 },
      { id: 4, quanSo: '', totalScore: 45 }
    ];

    const stats = calculateScoreStats(items, 50);
    expect(stats.present).toBe(90);
    expect(stats.total).toBe(93);
    expect(stats.average).toBeCloseTo(48.375);
    expect(stats.perfect).toBe(2);
    expect(stats.deducted).toBe(2);
  });

  it('trả về 0 khi danh sách rỗng', () => {
    expect(calculateScoreStats([], 50)).toEqual({
      present: 0,
      total: 0,
      average: 0,
      perfect: 0,
      deducted: 0
    });
  });
});
