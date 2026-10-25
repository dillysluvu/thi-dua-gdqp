export interface AuditEntry {
  id: string;
  at: string;
  action: string;
  detail: string;
  actor: string;
}

export const MAX_AUDIT_ENTRIES = 1000;

function makeAuditId(): string {
  return `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createAuditEntry(
  action: string,
  detail: string,
  actor = 'Giảng viên',
  at = new Date().toISOString()
): AuditEntry {
  return {
    id: makeAuditId(),
    at,
    action: String(action || 'Thay đổi').trim() || 'Thay đổi',
    detail: String(detail || '').trim(),
    actor: String(actor || 'Giảng viên').trim() || 'Giảng viên'
  };
}

export function appendAuditEntry(
  entries: AuditEntry[] | undefined,
  entry: AuditEntry,
  max = MAX_AUDIT_ENTRIES
): AuditEntry[] {
  const list = Array.isArray(entries) ? entries.slice() : [];
  list.push(entry);
  return list.length > max ? list.slice(list.length - max) : list;
}
