import { round1, toNumber } from './utils';

export interface ScoringItem {
  id?: number;
  quanSo?: string;
  hocTap?: unknown;
  renLuyen?: unknown;
  nvvs?: unknown;
  leTiet?: unknown;
  totalScore?: unknown;
  rank?: number;
  [key: string]: any;
}

export function calculateItemTotal(baseScore: number, item: ScoringItem): number {
  return round1(
    Number(baseScore || 0)
    + toNumber(item.hocTap)
    + toNumber(item.renLuyen)
    + toNumber(item.nvvs)
    + toNumber(item.leTiet)
  );
}

export function recalculateScores<T extends ScoringItem>(items: T[], baseScore: number): Array<T & { totalScore: number; rank: number }> {
  const scored = (items || []).map(item => ({
    ...item,
    totalScore: calculateItemTotal(baseScore, item)
  }));

  const uniqueScores = Array.from(new Set(scored.map(item => Number(item.totalScore))))
    .sort((a, b) => b - a);

  return scored.map(item => ({
    ...item,
    rank: uniqueScores.indexOf(Number(item.totalScore)) + 1
  }));
}

export interface ScoreStats {
  present: number;
  total: number;
  average: number;
  perfect: number;
  deducted: number;
}

export function calculateScoreStats(items: ScoringItem[], baseScore: number): ScoreStats {
  let present = 0;
  let total = 0;

  (items || []).forEach(item => {
    const match = String(item.quanSo || '').match(/^(\d+)\s*\/\s*(\d+)$/);
    if (match) {
      present += parseInt(match[1], 10) || 0;
      total += parseInt(match[2], 10) || 0;
    }
  });

  const sumScore = (items || []).reduce((sum, item) => sum + Number(item.totalScore || 0), 0);

  return {
    present,
    total,
    average: items && items.length ? sumScore / items.length : 0,
    perfect: (items || []).filter(item => Number(item.totalScore) >= Number(baseScore)).length,
    deducted: (items || []).filter(item => Number(item.totalScore) < Number(baseScore)).length
  };
}
