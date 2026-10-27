import { readJson, writeJson, type CourseRecord } from './courseStore';

export const CLOUD_CONFIG_KEY = 'THI_DUA_GDQPAN_V3:cloud';

export type CloudProvider = 'supabase' | 'local';

export interface CloudConfig {
  provider?: CloudProvider;
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

export interface CloudClientInfo {
  id: string;
  name: string;
}

const DEFAULT_CONFIG: CloudConfig = {
  provider: 'supabase',
  url: '',
  anonKey: '',
  table: 'course_sync',
  syncId: 'gdqpan',
  autoPush: false
};

export function cloudProviderOf(config: CloudConfig | null | undefined): CloudProvider {
  return config && config.provider === 'local' ? 'local' : 'supabase';
}

export function cloudProviderName(config: CloudConfig | null | undefined): string {
  return cloudProviderOf(config) === 'local' ? 'Máy chủ riêng' : 'Supabase';
}

export function loadCloudConfig(): CloudConfig {
  const stored = readJson<Partial<CloudConfig>>(CLOUD_CONFIG_KEY, {});
  return {
    ...DEFAULT_CONFIG,
    ...(stored && typeof stored === 'object' ? stored : {}),
    provider: stored && stored.provider === 'local' ? 'local' : 'supabase',
    table: String(stored && stored.table || DEFAULT_CONFIG.table).trim() || DEFAULT_CONFIG.table,
    syncId: String(stored && stored.syncId || DEFAULT_CONFIG.syncId).trim() || DEFAULT_CONFIG.syncId
  };
}

export function saveCloudConfig(config: CloudConfig): boolean {
  return writeJson(CLOUD_CONFIG_KEY, {
    ...config,
    provider: cloudProviderOf(config)
  });
}

export function isCloudConfigured(config: CloudConfig | null | undefined): boolean {
  if (!config) return false;
  if (cloudProviderOf(config) === 'local') {
    return Boolean(config.url && config.anonKey && config.syncId);
  }
  return Boolean(config.url && config.anonKey && config.table && config.syncId);
}

function normalizeBaseUrl(url: string): string {
  return String(url || '').trim().replace(/\/+$/, '');
}

function localHeaders(config: CloudConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${config.anonKey}`,
    'Content-Type': 'application/json'
  };
}

function supabaseHeaders(config: CloudConfig): Record<string, string> {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
    'Content-Type': 'application/json'
  };
}

function cloudRowId(config: CloudConfig, courseId: string): string {
  return `${config.syncId}:${courseId}`;
}

function localCourseUrl(config: CloudConfig): string {
  // Với máy chủ riêng, mã nhóm cũng là mã bản dùng chung. Mọi người nhập cùng
  // một mã nhóm sẽ làm việc trên cùng một bản, dù mã khóa cục bộ khác nhau.
  return `${normalizeBaseUrl(config.url)}/api/sync/${encodeURIComponent(config.syncId)}/courses/${encodeURIComponent(config.syncId)}`;
}

function validateConfig(config: CloudConfig): string {
  if (!config.url || !/^https?:\/\//i.test(config.url)) {
    return 'URL phải bắt đầu bằng http:// hoặc https://.';
  }
  if (!config.anonKey) {
    return cloudProviderOf(config) === 'local' ? 'Chưa nhập mã truy cập máy chủ.' : 'Chưa nhập anon key.';
  }
  if (!config.syncId) return 'Chưa nhập mã nhóm đồng bộ.';
  if (!/^[A-Za-z0-9_.-]{1,120}$/.test(config.syncId)) {
    return 'Mã nhóm chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.';
  }
  if (cloudProviderOf(config) === 'supabase' && !/^[A-Za-z0-9_]+$/.test(config.table)) {
    return 'Tên bảng chỉ gồm chữ, số và dấu gạch dưới.';
  }
  return '';
}

function errorMessage(provider: CloudProvider, status: number, body: string): string {
  const label = provider === 'local' ? 'Máy chủ' : 'Supabase';
  const detail = body.slice(0, 220);
  if (status === 401) return `${label} từ chối mã truy cập (401). Kiểm tra lại mã truy cập.`;
  if (status === 507) return `${label} báo hết dung lượng (507): ${detail}`;
  return `${label} trả về ${status}: ${detail}`;
}

export async function testCloudConnection(config: CloudConfig): Promise<CloudStatus> {
  const error = validateConfig(config);
  if (error) return { ok: false, message: error };

  try {
    if (cloudProviderOf(config) === 'local') {
      const response = await fetch(`${normalizeBaseUrl(config.url)}/api/health`, {
        headers: localHeaders(config)
      });
      if (!response.ok) {
        const body = await response.text();
        return { ok: false, message: errorMessage('local', response.status, body) };
      }
      const data = await response.json().catch(() => ({}));
      const used = Number(data?.usage?.usedBytes) || 0;
      const limit = Number(data?.usage?.limitBytes) || 0;
      const usageText = limit
        ? ` Đã dùng ${(used / 1024 ** 3).toFixed(2)} / ${(limit / 1024 ** 3).toFixed(2)} GB.`
        : '';
      return { ok: true, message: `Kết nối máy chủ thành công.${usageText}` };
    }

    const url = `${normalizeBaseUrl(config.url)}/rest/v1/${encodeURIComponent(config.table)}?select=id&limit=1`;
    const response = await fetch(url, { headers: supabaseHeaders(config) });
    if (!response.ok) {
      const body = await response.text();
      return { ok: false, message: errorMessage('supabase', response.status, body) };
    }
    return { ok: true, message: 'Kết nối Supabase thành công.' };
  } catch (error) {
    return { ok: false, message: `Không kết nối được: ${(error as Error).message}` };
  }
}

export async function pushCourse(
  record: CourseRecord,
  config: CloudConfig,
  client?: CloudClientInfo
): Promise<CloudStatus> {
  const error = validateConfig(config);
  if (error) return { ok: false, message: error };
  if (!record || !record.meta || !record.meta.id) return { ok: false, message: 'Không có dữ liệu khóa để đẩy lên.' };

  try {
    if (cloudProviderOf(config) === 'local') {
      const remoteRecord: CourseRecord = {
        ...record,
        meta: { ...record.meta, id: config.syncId }
      };
      const response = await fetch(localCourseUrl(config), {
        method: 'PUT',
        headers: localHeaders(config),
        body: JSON.stringify({
          payload: remoteRecord,
          updatedAt: new Date().toISOString(),
          clientId: client?.id || '',
          clientName: client?.name || ''
        })
      });
      if (!response.ok) {
        const body = await response.text();
        return { ok: false, message: errorMessage('local', response.status, body) };
      }
      return { ok: true, message: 'Đã đẩy dữ liệu khóa lên máy chủ.' };
    }

    const url = `${normalizeBaseUrl(config.url)}/rest/v1/${encodeURIComponent(config.table)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...supabaseHeaders(config),
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
      return { ok: false, message: errorMessage('supabase', response.status, body) };
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
    if (cloudProviderOf(config) === 'local') {
      const response = await fetch(localCourseUrl(config), {
        headers: localHeaders(config)
      });
      if (response.status === 404) {
        return { ok: false, message: 'Chưa có bản đồng bộ nào cho khóa này.' };
      }
      if (!response.ok) {
        const body = await response.text();
        return { ok: false, message: errorMessage('local', response.status, body) };
      }
      const data = await response.json().catch(() => null);
      const record = data?.payload as CourseRecord | undefined;
      if (!record || !record.meta || !Array.isArray(record.items)) {
        return { ok: false, message: 'Dữ liệu trên máy chủ không đúng định dạng.' };
      }
      return { ok: true, message: 'Đã tải dữ liệu từ máy chủ.', record };
    }

    const rowId = cloudRowId(config, courseId);
    const url = `${normalizeBaseUrl(config.url)}/rest/v1/${encodeURIComponent(config.table)}?id=eq.${encodeURIComponent(rowId)}&select=payload,updated_at&limit=1`;
    const response = await fetch(url, { headers: supabaseHeaders(config) });
    if (!response.ok) {
      const body = await response.text();
      return { ok: false, message: errorMessage('supabase', response.status, body) };
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

export function cancelScheduledCloudPush(): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
}

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
