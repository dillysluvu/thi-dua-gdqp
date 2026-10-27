import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeDefaultRecord } from './courseStore';

const mocks = vi.hoisted(() => {
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn(),
    track: vi.fn().mockResolvedValue(undefined),
    presenceState: vi.fn().mockReturnValue({}),
    send: vi.fn().mockResolvedValue('ok'),
    unsubscribe: vi.fn().mockResolvedValue(undefined)
  };
  const client = {
    channel: vi.fn(() => channel),
    removeAllChannels: vi.fn().mockResolvedValue(undefined)
  };
  return { channel, client };
});

const cloud = vi.hoisted(() => ({
  pullCourse: vi.fn(),
  pushCourse: vi.fn()
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mocks.client)
}));

vi.mock('./cloudSync', () => ({
  pullCourse: cloud.pullCourse,
  pushCourse: cloud.pushCourse
}));

import {
  COLLAB_SETTINGS_KEY,
  CollabSession,
  loadCollabSettings,
  saveCollabSettings
} from './collab';
import type { CloudConfig } from './cloudSync';

const config: CloudConfig = {
  url: 'https://demo.supabase.co',
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
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('collab settings', () => {
  it('lưu và đọc cấu hình cộng tác', () => {
    expect(loadCollabSettings()).toEqual({ enabled: false, displayName: '' });
    expect(saveCollabSettings({ enabled: true, displayName: ' Thầy Nam ' })).toBe(true);
    expect(store.has(COLLAB_SETTINGS_KEY)).toBe(true);
    expect(loadCollabSettings()).toEqual({ enabled: true, displayName: 'Thầy Nam' });
  });
});

describe('CollabSession', () => {
  it('kéo dữ liệu ban đầu và tạo bản gốc khi Supabase chưa có dữ liệu', async () => {
    const record = makeDefaultRecord('K337');
    cloud.pullCourse.mockResolvedValue({
      ok: false,
      message: 'Chưa có bản đồng bộ nào cho khóa này.'
    });
    cloud.pushCourse.mockResolvedValue({ ok: true, message: 'Đã đẩy dữ liệu khóa lên Supabase.' });

    const statuses: string[] = [];
    const session = new CollabSession({
      config,
      courseId: record.meta.id,
      displayName: 'A',
      getLocalRecord: () => record,
      onStatus: status => statuses.push(status.state),
      onRemoteRecord: vi.fn()
    });

    await session.start();
    await vi.waitFor(() => expect(cloud.pushCourse).toHaveBeenCalledTimes(1));
    expect(cloud.pushCourse.mock.calls[0][0].meta.id).toBe(record.meta.id);
    expect(statuses).toContain('connected');
    session.stop();
  });

  it('gọi callback khi tải được bản ghi từ xa', async () => {
    const record = makeDefaultRecord('K338');
    cloud.pullCourse.mockResolvedValue({ ok: true, message: 'Đã tải dữ liệu từ Supabase.', record });
    cloud.pushCourse.mockResolvedValue({ ok: true, message: 'ok' });
    const onRemoteRecord = vi.fn();

    const session = new CollabSession({
      config,
      courseId: record.meta.id,
      displayName: 'B',
      getLocalRecord: () => record,
      onStatus: vi.fn(),
      onRemoteRecord
    });

    await session.start();
    await vi.waitFor(() => expect(onRemoteRecord).toHaveBeenCalledTimes(1));
    expect(onRemoteRecord.mock.calls[0][0].meta.courseName).toBe('K338');
    expect(onRemoteRecord.mock.calls[0][1].initial).toBe(true);
    session.stop();
  });
});
