import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeDefaultRecord } from './courseStore';
import {
  CLOUD_CONFIG_KEY,
  isCloudConfigured,
  loadCloudConfig,
  pullCourse,
  pushCourse,
  saveCloudConfig,
  testCloudConnection,
  type CloudConfig
} from './cloudSync';

const config: CloudConfig = {
  url: 'https://demo.supabase.co/',
  anonKey: 'anon-key',
  table: 'course_sync',
  syncId: 'gdqpan',
  autoPush: false
};

let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear()
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('cloudSync config', () => {
  it('kiểm tra cấu hình đầy đủ', () => {
    expect(isCloudConfigured(config)).toBe(true);
    expect(isCloudConfigured({ ...config, anonKey: '' })).toBe(false);
    expect(isCloudConfigured(null)).toBe(false);
  });

  it('đọc cấu hình mặc định và lưu cấu hình', () => {
    const defaults = loadCloudConfig();
    expect(defaults.table).toBe('course_sync');
    expect(defaults.syncId).toBe('gdqpan');

    expect(saveCloudConfig(config)).toBe(true);
    expect(store.has(CLOUD_CONFIG_KEY)).toBe(true);
    expect(loadCloudConfig().url).toBe('https://demo.supabase.co/');
  });
});

describe('cloudSync Supabase REST', () => {
  it('đẩy khóa lên bằng upsert', async () => {
    const record = makeDefaultRecord('K337');
    const fetchMock = vi.fn(async () => new Response('[]', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    const status = await pushCourse(record, config);
    expect(status.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://demo.supabase.co/rest/v1/course_sync');
    expect(init.method).toBe('POST');
    const body = JSON.parse(String(init.body));
    expect(body.id).toBe(`gdqpan:${record.meta.id}`);
    expect(body.payload.meta.courseName).toBe('K337');
  });

  it('kéo khóa về đúng định dạng', async () => {
    const record = makeDefaultRecord('K338');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([
      { payload: record, updated_at: new Date().toISOString() }
    ]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await pullCourse(record.meta.id, config);
    expect(result.ok).toBe(true);
    expect(result.record?.meta.courseName).toBe('K338');
  });

  it('báo lỗi khi Supabase trả về lỗi', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('permission denied', { status: 403 })));
    const status = await testCloudConnection(config);
    expect(status.ok).toBe(false);
    expect(status.message).toContain('403');
  });
});
