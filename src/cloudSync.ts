import { readJson, writeJson, type CourseRecord } from './courseStore';

export const CLOUD_CONFIG_KEY = 'THI_DUA_GDQPAN_V3:cloud';

export interface CloudConfig {
  url: string;
  anonKey: string;
  table: string;
  syncId: string;
  autoPush: boolean;
}

export interface CloudStatus {
  ok: boolean;
  message: string;
}

const DEFAULT_CONFIG: CloudConfig = {
  url: '',
  anonKey: '',
  table: 'course_sync',
  syncId: 'gdqpan',
  autoPush: false
};

export function loadCloudConfig(): CloudConfig {
  const stored = readJson<Partial<CloudConfig>>(CLOUD_CONFIG_KEY, {});
  return {
    ...DEFAULT_CONFIG,
    ...(stored && typeof stored === 'object' ? stored : {}),
    table: String(stored && stored.table || DEFAULT_CONFIG.table).trim() || DEFAULT_CONFIG.table,
    syncId: String(stored && stored.syncId || DEFAULT_CONFIG.syncId).trim() || DEFAULT_CONFIG.syncId
  };
}

export function saveCloudConfig(config: CloudConfig): boolean {
  return writeJson(CLOUD_CONFIG_KEY, config);
}

export function isCloudConfigured(config: CloudConfig | null | undefined): boolean {
  return Boolean(config && config.url && config.anonKey && config.table && config.syncId);
}

function normalizeBaseUrl(url: string): string {
  return String(url || '').trim().replace(/\/+$/, '');
}

function cloudHeaders(config: CloudConfig): Record<string, string> {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
    'Content-Type': 'application/json'
  };
}

function cloudRowId(config: CloudConfig, courseId: string): string {
  return `${config.syncId}:${courseId}`;
}

function validateConfig(config: CloudConfig): string {
  if (!config.url || !/^https?:\/\//i.test(config.url)) {
    return 'URL Supabase phải bắt đầu bằng http:// hoặc https://.';
  }
  if (!config.anonKey) return 'Chưa nhập anon key.';
  if (!/^[A-Za-z0-9_]+$/.test(config.table)) return 'Tên bảng chỉ gồm chữ, số và dấu gạch dưới.';
  if (!config.syncId) return 'Chưa nhập mã đồng bộ.';
  return '';
}

export async function testCloudConnection(config: CloudConfig): Promise<CloudStatus> {
  const error = validateConfig(config);
  if (error) return { ok: false, message: error };

  try {
    const url = `${normalizeBaseUrl(config.url)}/rest/v1/${encodeURIComponent(config.table)}?select=id&limit=1`;
    const response = await fetch(url, { headers: cloudHeaders(config) });
    if (!response.ok) {
      const body = await response.text();
      return { ok: false, message: `Supabase trả về ${response.status}: ${body.slice(0, 180)}` };
    }
    return { ok: true, message: 'Kết nối Supabase thành công.' };
  } catch (error) {
    return { ok: false, message: `Không kết nối được: ${(error as Error).message}` };
  }
}

export async function pushCourse(record: CourseRecord, config: CloudConfig): Promise<CloudStatus> {
  const error = validateConfig(config);
  if (error) return { ok: false, message: error };
  if (!record || !record.meta || !record.meta.id) return { ok: false, message: 'Không có dữ liệu khóa để đẩy lên.' };

  try {
    const url = `${normalizeBaseUrl(config.url)}/rest/v1/${encodeURIComponent(config.table)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...cloudHeaders(config),
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({
        id: cloudRowId(config, record.meta.id),
        course_id: record.meta.id,
        payload: record,
        updated_at: new Date().toISOString()
      })
    });

    if (!response.ok) {
      const body = await response.text();
      return { ok: false, message: `Đẩy lên thất bại (${response.status}): ${body.slice(0, 180)}` };
    }
    return { ok: true, message: 'Đã đẩy dữ liệu khóa lên Supabase.' };
  } catch (error) {
    return { ok: false, message: `Không đẩy được dữ liệu: ${(error as Error).message}` };
  }
}

export async function pullCourse(courseId: string, config: CloudConfig): Promise<{ ok: boolean; message: string; record?: CourseRecord }> {
  const error = validateConfig(config);
  if (error) return { ok: false, message: error };
  if (!courseId) return { ok: false, message: 'Chưa chọn khóa.' };

  try {
    const rowId = cloudRowId(config, courseId);
    const url = `${normalizeBaseUrl(config.url)}/rest/v1/${encodeURIComponent(config.table)}?id=eq.${encodeURIComponent(rowId)}&select=payload,updated_at&limit=1`;
    const response = await fetch(url, { headers: cloudHeaders(config) });
    if (!response.ok) {
      const body = await response.text();
      return { ok: false, message: `Kéo dữ liệu thất bại (${response.status}): ${body.slice(0, 180)}` };
    }

    const rows = await response.json();
    if (!Array.isArray(rows) || !rows.length || !rows[0].payload) {
      return { ok: false, message: 'Chưa có bản đồng bộ nào cho khóa này.' };
    }

    const record = rows[0].payload as CourseRecord;
    if (!record.meta || !Array.isArray(record.items)) {
      return { ok: false, message: 'Dữ liệu trên đám mây không đúng định dạng.' };
    }
    return { ok: true, message: 'Đã tải dữ liệu từ Supabase.', record };
  } catch (error) {
    return { ok: false, message: `Không kéo được dữ liệu: ${(error as Error).message}` };
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleCloudPush(
  record: CourseRecord,
  config: CloudConfig,
  onResult?: (status: CloudStatus) => void
): void {
  if (!config || !config.autoPush || !isCloudConfigured(config)) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    pushTimer = null;
    const status = await pushCourse(record, config);
    if (onResult) onResult(status);
  }, 6000);
}
