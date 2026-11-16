export type UnitLevel = 'tieuDoi' | 'trungDoi' | 'daiDoi';

export const UNIT_INFO: Record<UnitLevel, { symbol: 'a' | 'b' | 'c'; label: string }> = {
  tieuDoi: { symbol: 'a', label: 'Tiểu đội' },
  trungDoi: { symbol: 'b', label: 'Trung đội' },
  daiDoi: { symbol: 'c', label: 'Đại đội' }
};

export const UNIT_LEGEND = 'a = tiểu đội · b = trung đội · c = đại đội';

/** Mỗi đại đội gồm 4 trung đội: b1–b4 = c1, b5–b8 = c2, … */
export const PLATOONS_PER_DAI_DOI = 4;
export const UNIT_RULE = 'Mỗi đại đội gồm 4 trung đội: b1–b4 = c1, b5–b8 = c2, …';

/** Bỏ kí hiệu a/b/c ở đầu nếu người dùng đã nhập kèm, ví dụ "b12" -> "12". */
export function unitValue(value: unknown): string {
  const text = String(value === undefined || value === null ? '' : value).trim();
  if (!text) return '';
  return text.replace(/^[abcABC][.\s-]*(?=\d)/, '').trim();
}

/** Suy ra đại đội từ trung đội: cứ 4 trung đội là 1 đại đội. */
export function daiDoiFromTrungDoi(value: unknown): string {
  const clean = unitValue(value);
  const number = Number(clean);
  if (!Number.isFinite(number) || number <= 0) return '';
  return String(Math.ceil(number / PLATOONS_PER_DAI_DOI));
}

/** Dùng đại đội đã nhập nếu có, nếu chưa có thì suy ra từ trung đội. */
export function effectiveDaiDoi(daiDoi: unknown, trungDoi: unknown): string {
  return unitValue(daiDoi) || daiDoiFromTrungDoi(trungDoi);
}

/** Kí hiệu đơn vị kèm số, ví dụ tiểu đội 45 -> a45. */
export function unitCode(level: UnitLevel, value: unknown): string {
  const clean = unitValue(value);
  return clean ? `${UNIT_INFO[level].symbol}${clean}` : '';
}

/** Nhãn đầy đủ cho aria/title, ví dụ "Trung đội 12 (b12)". */
export function unitFull(level: UnitLevel, value: unknown): string {
  const clean = unitValue(value);
  if (!clean) return UNIT_INFO[level].label;
  return `${UNIT_INFO[level].label} ${clean} (${unitCode(level, clean)})`;
}

export function unitLabel(level: UnitLevel): string {
  return `${UNIT_INFO[level].label} (${UNIT_INFO[level].symbol})`;
}
