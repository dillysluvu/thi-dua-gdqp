export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const num = parseInt(String(value), 10);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

export function round1(value: unknown): number {
  return Math.round((Number(value) || 0) * 10) / 10;
}

export function toNumber(value: unknown): number {
  const num = parseFloat(String(value === undefined || value === null ? '' : value).replace(',', '.'));
  return Number.isFinite(num) ? num : 0;
}

export function formatNum(value: unknown): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  return String(Math.round(num * 10) / 10);
}

export function normalizeText(value: unknown): string {
  return String(value === undefined || value === null ? '' : value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function escapeHtml(value: unknown): string {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatNoteHtml(value: unknown): string {
  return escapeHtml(value).replace(/\r?\n/g, '<br>');
}

export function pad2(value: unknown): string {
  return String(value).padStart(2, '0');
}

export function slugify(value: unknown): string {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Khoa';
}

export function isNumericDraft(value: unknown): boolean {
  return /^-?\d+(?:[.,]\d*)?$/.test(String(value).trim());
}

export function normalizeQuanSo(value: unknown): string | null {
  const raw = String(value === undefined || value === null ? '' : value).trim();
  if (raw === '') return '';
  const match = raw.match(/^(\d+)\s*(?:\/\s*(\d+))?$/);
  if (!match) return null;
  const present = parseInt(match[1], 10);
  const total = match[2] === undefined ? present : parseInt(match[2], 10);
  if (total < present) return null;
  return `${present}/${total}`;
}

export function readFileAsText(file: File): Promise<string> {
  if (file && typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function downloadFile(content: BlobPart, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
