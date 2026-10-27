import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeDefaultRecord } from './courseStore';
import {
  CLOUD_CONFIG_KEY,
  cloudProviderName,
  cloudProviderOf,
  isCloudConfigured,
  loadCloudConfig,
  pullCourse,
  pushCourse,
  saveCloudConfig,
  testCloudConnection,
  type CloudConfig
} from './cloudSync';

const config: CloudConfig = {
  provider: 'supabase',
  url: 'https://demo.supabase.co/',
  anonKey: 'anon-key',
  table: 'course_sync',
  syncId: 'gdqpan',
  autoPush: false
};

const localConfig: CloudConfig = {
  provider: 'local',
  url: 'http://127.0.0.1:8787/',
  anonKey: 'ma-truy-cap',
  table: '',
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

describe('cloudSync máy chủ riêng', () => {
  it('nhận diện provider và không bắt buộc tên bảng', () => {
    expect(cloudProviderOf(localConfig)).toBe('local');
    expect(cloudProviderName(localConfig)).toBe('Máy chủ riêng');
    expect(cloudProviderName(config)).toBe('Supabase');
    expect(isCloudConfigured(localConfig)).toBe(true);
    expect(isCloudConfigured({ ...localConfig, table: '' })).toBe(true);
    expect(isCloudConfigured({ ...localConfig, anonKey: '' })).toBe(false);
  });

  it('lưu và đọc lại provider local', () => {
    expect(saveCloudConfig(localConfig)).toBe(true);
    const loaded = loadCloudConfig();
    expect(loaded.provider).toBe('local');
    expect(loaded.url).toBe('http://127.0.0.1:8787/');
  });

  it('đẩy lên đúng khóa chung và không làm đổi id cục bộ', async () => {
    const record = makeDefaultRecord('K337');
    const localId = record.meta.id;
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const status = await pushCourse(record, localConfig, { id: 'u_1', name: 'Thầy Nam' });
    expect(status.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:8787/api/sync/gdqpan/courses/gdqpan');
    expect(init.method).toBe('PUT');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer ma-truy-cap');
    const body = JSON.parse(String(init.body));
    expect(body.payload.meta.id).toBe('gdqpan');
    expect(body.clientId).toBe('u_1');
    expect(body.clientName).toBe('Thầy Nam');
    expect(record.meta.id).toBe(localId);
  });

  it('kéo bản dùng chung từ máy chủ', async () => {
    const shared = makeDefaultRecord('K338');
    shared.meta.id = 'gdqpan';
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      payload: shared,
      updatedAt: new Date().toISOString(),
      revision: 4
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await pullCourse('c_local', localConfig);
    expect(result.ok).toBe(true);
    expect(result.record?.meta.courseName).toBe('K338');
    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:8787/api/sync/gdqpan/courses/gdqpan');
  });

  it('báo chưa có bản đồng bộ khi máy chủ trả 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
    const result = await pullCourse('c_local', localConfig);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Chưa có bản đồng bộ');
  });

  it('kiểm tra kết nối và hiển thị dung lượng máy chủ', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      usage: { usedBytes: 1024 ** 3, limitBytes: 10 * 1024 ** 3 }
    }), { status: 200 })));
    const status = await testCloudConnection(localConfig);
    expect(status.ok).toBe(true);
    expect(status.message).toContain('1.00 / 10.00 GB');
  });
});
