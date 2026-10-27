import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { cloudProviderOf, pullCourse, pushCourse, type CloudConfig, type CloudStatus } from './cloudSync';
import { readJson, writeJson, type CourseRecord } from './courseStore';

export const COLLAB_SETTINGS_KEY = 'THI_DUA_GDQPAN_V3:collab';
export const COLLAB_CLIENT_KEY = 'THI_DUA_GDQPAN_V3:collabClient';

export interface CollabSettings {
  enabled: boolean;
  displayName: string;
}

export interface CollabUser {
  id: string;
  name: string;
  color: string;
  joinedAt: string;
  isSelf: boolean;
}

export interface CollabStatus {
  state: 'off' | 'connecting' | 'connected' | 'error';
  message: string;
  users: CollabUser[];
  lastSyncAt: string;
  realtime: boolean;
}

export interface CollabRemoteInfo {
  clientId: string;
  name: string;
  updatedAt: string;
  initial: boolean;
}

export interface CollabSessionOptions {
  config: CloudConfig;
  courseId: string;
  displayName: string;
  getLocalRecord: () => CourseRecord;
  onStatus: (status: CollabStatus) => void;
  onRemoteRecord: (record: CourseRecord, info: CollabRemoteInfo) => void | Promise<void>;
}

const DEFAULT_SETTINGS: CollabSettings = { enabled: false, displayName: '' };
const PRESENCE_COLORS = ['#0f766e', '#d4a017', '#3b82f6', '#c2415a', '#7c3aed', '#0e7490', '#b45309', '#15803d'];

export function loadCollabSettings(): CollabSettings {
  const stored = readJson<Partial<CollabSettings>>(COLLAB_SETTINGS_KEY, {});
  return {
    enabled: Boolean(stored && stored.enabled),
    displayName: String(stored && stored.displayName || '').trim()
  };
}

export function saveCollabSettings(settings: CollabSettings): boolean {
  return writeJson(COLLAB_SETTINGS_KEY, {
    enabled: Boolean(settings.enabled),
    displayName: String(settings.displayName || '').trim()
  });
}

export function getCollabClientId(): string {
  try {
    const existing = localStorage.getItem(COLLAB_CLIENT_KEY);
    if (existing) return existing;
    const id = `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(COLLAB_CLIENT_KEY, id);
    return id;
  } catch {
    return `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

function colorFor(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index++) hash = ((hash << 5) - hash + id.charCodeAt(index)) | 0;
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}

function nowIso(): string {
  return new Date().toISOString();
}

function channelName(config: CloudConfig, courseId: string): string {
  return `collab-${config.syncId}-${courseId}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);
}

export class CollabSession {
  private options: CollabSessionOptions;
  private client: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private clientId: string;
  private color: string;
  private joinedAt: string;
  private displayName: string;
  private ready = false;
  private initializing = false;
  private connected = false;
  private pulling = false;
  private pushing = false;
  private pendingRecord: CourseRecord | null = null;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private remotePullTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private localSocket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private stopped = false;
  private state: CollabStatus['state'] = 'off';
  private message = 'Chưa bật cộng tác.';
  private users: CollabUser[] = [];
  private lastSyncAt = '';

  constructor(options: CollabSessionOptions) {
    this.options = options;
    this.clientId = getCollabClientId();
    this.color = colorFor(this.clientId);
    this.joinedAt = nowIso();
    this.displayName = String(options.displayName || 'Giảng viên').trim() || 'Giảng viên';
  }

  getStatus(): CollabStatus {
    return {
      state: this.state,
      message: this.message,
      users: this.users.slice(),
      lastSyncAt: this.lastSyncAt,
      realtime: this.connected
    };
  }

  isConnected(): boolean {
    return this.connected;
  }

  private isLocal(): boolean {
    return cloudProviderOf(this.options.config) === 'local';
  }

  private providerLabel(): string {
    return this.isLocal() ? 'máy chủ' : 'Supabase';
  }

  private startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      if (!this.stopped && this.ready && document.visibilityState !== 'hidden') {
        void this.pullNow(false);
      }
    }, 15000);
  }

  setDisplayName(name: string): void {
    this.displayName = String(name || '').trim() || 'Giảng viên';
    if (this.isLocal()) {
      this.sendLocal({ type: 'presence', name: this.displayName });
    } else if (this.channel && this.connected) {
      void this.channel.track({
        client_id: this.clientId,
        name: this.displayName,
        color: this.color,
        joined_at: this.joinedAt
      });
    }
    this.emitStatus(this.state, this.message);
  }

  async start(): Promise<void> {
    this.stopped = false;
    this.ready = false;
    this.initializing = false;
    this.connected = false;
    this.users = [];

    if (this.isLocal()) {
      this.startLocal();
      return;
    }

    this.emitStatus('connecting', 'Đang kết nối cộng tác...');

    try {
      const url = String(this.options.config.url || '').replace(/\/+$/, '');
      this.client = createClient(url, this.options.config.anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        },
        realtime: {
          params: { eventsPerSecond: 20 }
        }
      });
    } catch (error) {
      this.emitStatus('error', `Không tạo được kết nối realtime: ${(error as Error).message}`);
      return;
    }

    this.channel = this.client.channel(channelName(this.options.config, this.options.courseId), {
      config: {
        broadcast: { self: false, ack: true },
        presence: { key: this.clientId }
      }
    });

    this.channel.on('broadcast', { event: 'changed' }, payload => {
      const data: any = payload && (payload as any).payload ? (payload as any).payload : payload;
      this.handleBroadcast(data);
    });

    this.channel.on('presence', { event: 'sync' }, () => this.updatePresence());
    this.channel.on('presence', { event: 'join' }, () => this.updatePresence());
    this.channel.on('presence', { event: 'leave' }, () => this.updatePresence());

    this.channel.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        this.connected = true;
        void this.handleSubscribed();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.connected = false;
        this.emitStatus(this.ready ? 'connected' : 'connecting', 'Realtime chưa kết nối; vẫn đồng bộ qua Supabase mỗi 15 giây.');
      } else if (status === 'CLOSED' && !this.stopped) {
        this.connected = false;
        this.emitStatus(this.ready ? 'connected' : 'connecting', 'Kênh realtime đã đóng; vẫn đồng bộ qua Supabase mỗi 15 giây.');
      }
    });

    this.startPolling();

    // REST vẫn hoạt động dù WebSocket/Realtime bị chặn.
    void this.initializeRestSync();
  }

  private startLocal(): void {
    this.emitStatus('connecting', 'Đang kết nối tới máy chủ...');
    this.startPolling();
    // REST hoạt động độc lập với WebSocket; nếu WebSocket lỗi vẫn có polling 15 giây.
    void this.initializeRestSync();
    this.connectLocalSocket();
  }

  private localSocketUrl(): string {
    const base = new URL(this.options.config.url);
    const url = new URL('/ws', base);
    url.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('syncId', this.options.config.syncId);
    // Mã nhóm cũng là mã bản dùng chung trên máy chủ riêng.
    url.searchParams.set('courseId', this.options.config.syncId);
    url.searchParams.set('token', this.options.config.anonKey);
    url.searchParams.set('clientId', this.clientId);
    url.searchParams.set('name', this.displayName);
    return url.toString();
  }

  private connectLocalSocket(): void {
    if (this.stopped) return;
    this.clearLocalSocket();
    let socket: WebSocket;
    try {
      socket = new WebSocket(this.localSocketUrl());
    } catch (error) {
      this.emitStatus('connecting', `Realtime chưa kết nối: ${(error as Error).message}. Vẫn đồng bộ qua máy chủ mỗi 15 giây.`);
      this.scheduleLocalReconnect();
      return;
    }
    this.localSocket = socket;

    socket.addEventListener('open', () => {
      if (this.stopped || this.localSocket !== socket) return;
      this.connected = true;
      this.reconnectAttempts = 0;
      this.sendLocal({ type: 'presence', name: this.displayName });
      this.emitStatus('connected', this.users.length > 1
        ? `Đã kết nối · ${this.users.length} người đang cộng tác`
        : 'Đã kết nối cộng tác. Chờ người khác tham gia...');
      void this.initializeRestSync();
    });

    socket.addEventListener('message', event => {
      if (this.stopped || this.localSocket !== socket) return;
      let message: any;
      try { message = JSON.parse(String(event.data)); } catch { return; }
      if (!message || typeof message !== 'object') return;
      if (message.type === 'presence' && Array.isArray(message.users)) {
        this.setLocalUsers(message.users);
        return;
      }
      if (message.type === 'changed') {
        if (message.clientId && message.clientId === this.clientId) return;
        const expectedCourseId = this.isLocal() ? this.options.config.syncId : this.options.courseId;
        if (message.courseId && message.courseId !== expectedCourseId) return;
        if (this.remotePullTimer) clearTimeout(this.remotePullTimer);
        this.remotePullTimer = setTimeout(() => {
          this.remotePullTimer = null;
          void this.pullNow(false);
        }, 250);
        return;
      }
      if (message.type === 'error') {
        this.emitStatus('error', String(message.message || 'Máy chủ báo lỗi.'));
      }
    });

    socket.addEventListener('close', () => {
      if (this.stopped || this.localSocket !== socket) return;
      this.localSocket = null;
      this.connected = false;
      this.users = [];
      this.emitStatus('connecting', 'Mất kết nối realtime; vẫn đồng bộ qua máy chủ mỗi 15 giây.');
      this.scheduleLocalReconnect();
    });

    socket.addEventListener('error', () => {
      if (this.stopped || this.localSocket !== socket) return;
      this.connected = false;
      this.emitStatus('connecting', 'Realtime chưa kết nối; vẫn đồng bộ qua máy chủ mỗi 15 giây.');
    });
  }

  private scheduleLocalReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    const delay = Math.min(15000, 1500 * 2 ** Math.min(this.reconnectAttempts, 4));
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.stopped) this.connectLocalSocket();
    }, delay);
  }

  private sendLocal(data: unknown): void {
    if (!this.localSocket || this.localSocket.readyState !== WebSocket.OPEN) return;
    try { this.localSocket.send(JSON.stringify(data)); } catch { /* ignore */ }
  }

  private setLocalUsers(users: any[]): void {
    const mapped: CollabUser[] = [];
    const seen = new Set<string>();
    for (const item of users) {
      const id = String(item?.id || '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      mapped.push({
        id,
        name: String(item?.name || 'Giảng viên'),
        color: String(item?.color || colorFor(id)),
        joinedAt: String(item?.joinedAt || ''),
        isSelf: id === this.clientId
      });
    }
    mapped.sort((a, b) => {
      if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
      return a.name.localeCompare(b.name, 'vi');
    });
    this.users = mapped;
    this.emitStatus(this.state, this.connected
      ? (mapped.length > 1 ? `Đã kết nối · ${mapped.length} người đang cộng tác` : 'Đã kết nối cộng tác. Chờ người khác tham gia...')
      : this.message);
  }

  private clearLocalSocket(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.localSocket) {
      const socket = this.localSocket;
      this.localSocket = null;
      try { socket.close(); } catch { /* ignore */ }
    }
  }

  private async initializeRestSync(): Promise<void> {
    if (this.ready || this.initializing || this.stopped) return;
    this.initializing = true;
    this.emitStatus('connecting', `Đang tải dữ liệu mới nhất từ ${this.providerLabel()}...`);
    const result = await this.pullNow(true);
    if (this.stopped) return;
    this.ready = true;
    this.initializing = false;
    const noRemote = /chưa có bản đồng bộ/i.test(result.message);
    const reachable = result.ok || noRemote;
    this.emitStatus(
      reachable ? 'connected' : 'error',
      !reachable
        ? result.message
        : this.connected
          ? (this.users.length > 1 ? `Đã kết nối · ${this.users.length} người đang cộng tác` : 'Đã kết nối cộng tác. Chờ người khác tham gia...')
          : `Đã kết nối ${this.providerLabel()}. Realtime chưa kết nối, ứng dụng vẫn tự đồng bộ mỗi 15 giây.`
    );

    if (this.pendingRecord) {
      this.pendingRecord = null;
      // Sau khi gộp bản từ xa, đẩy trạng thái hiện tại (đã gộp) thay vì
      // bản ghi cũ được chụp trước khi kéo dữ liệu.
      await this.pushNow(this.options.getLocalRecord());
    } else if (noRemote) {
      // Chưa có bản trên máy chủ/Supabase: tạo bản gốc từ dữ liệu đang mở.
      await this.pushNow(this.options.getLocalRecord());
    }
  }

  private async handleSubscribed(): Promise<void> {
    if (this.channel) {
      await this.channel.track({
        client_id: this.clientId,
        name: this.displayName,
        color: this.color,
        joined_at: this.joinedAt
      });
    }
    if (this.stopped) return;
    this.connected = true;
    this.emitStatus('connected', 'Đã kết nối realtime. Đang đồng bộ dữ liệu...');
    await this.initializeRestSync();
    if (this.stopped) return;
    await this.pullNow(false);
    if (this.stopped) return;
    this.emitStatus('connected', this.users.length > 1
      ? `Đã kết nối · ${this.users.length} người đang cộng tác`
      : 'Đã kết nối cộng tác. Chờ người khác tham gia...');
  }

  async pullNow(initial = false): Promise<CloudStatus> {
    if (this.stopped) return { ok: false, message: 'Cộng tác đã tắt.' };
    if (this.pulling) return { ok: true, message: 'Đang tải dữ liệu...' };
    this.pulling = true;

    try {
      const result = await pullCourse(this.options.courseId, this.options.config);
      if (this.stopped) return { ok: false, message: 'Cộng tác đã tắt.' };
      if (result.ok && result.record) {
        this.lastSyncAt = nowIso();
        await this.options.onRemoteRecord(result.record, {
          clientId: this.isLocal() ? 'server' : 'supabase',
          name: this.isLocal() ? 'Máy chủ' : 'Supabase',
          updatedAt: this.lastSyncAt,
          initial
        });
        this.emitStatus('connected', 'Đã tải dữ liệu mới nhất từ nhóm.');
        return result;
      }

      if (!result.ok && /chưa có bản đồng bộ/i.test(result.message)) {
        this.emitStatus(
          this.connected ? 'connected' : 'connecting',
          `Chưa có dữ liệu trên ${this.providerLabel()}. Bản hiện tại sẽ được đẩy lên khi có thay đổi.`
        );
        return result;
      }

      this.emitStatus('error', result.message);
      return result;
    } catch (error) {
      const status = { ok: false, message: `Không tải được dữ liệu cộng tác: ${(error as Error).message}` };
      this.emitStatus('error', status.message);
      return status;
    } finally {
      this.pulling = false;
    }
  }

  schedulePush(record: CourseRecord): void {
    if (this.stopped || !record) return;
    this.pendingRecord = record;
    if (!this.ready) return;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      const pending = this.pendingRecord;
      this.pendingRecord = null;
      if (pending) void this.pushNow(pending);
    }, 1200);
  }

  async pushNow(record: CourseRecord): Promise<CloudStatus> {
    if (this.stopped) return { ok: false, message: 'Cộng tác đã tắt.' };
    if (this.pushing) {
      this.pendingRecord = record;
      return { ok: true, message: 'Đang đẩy dữ liệu...' };
    }

    this.pushing = true;
    try {
      const result = await pushCourse(
        record,
        this.options.config,
        this.isLocal() ? { id: this.clientId, name: this.displayName } : undefined
      );
      if (this.stopped) return { ok: false, message: 'Cộng tác đã tắt.' };
      if (result.ok) {
        this.lastSyncAt = nowIso();
        await this.broadcastChanged(record);
        this.emitStatus('connected', 'Đã đồng bộ dữ liệu lên nhóm.');
      } else {
        this.emitStatus('error', result.message);
      }
      return result;
    } finally {
      this.pushing = false;
      if (this.pendingRecord && !this.stopped) {
        const pending = this.pendingRecord;
        this.pendingRecord = null;
        void this.pushNow(pending);
      }
    }
  }

  private async broadcastChanged(record: CourseRecord): Promise<void> {
    // Với máy chủ riêng, server tự broadcast sau khi PUT thành công.
    if (this.isLocal() || !this.channel || !this.connected) return;
    try {
      await this.channel.send({
        type: 'broadcast',
        event: 'changed',
        payload: {
          clientId: this.clientId,
          name: this.displayName,
          courseId: this.options.courseId,
          updatedAt: record.savedAt,
          revision: record.meta.revision || 1
        }
      });
    } catch {
      // Polling 15 giây vẫn bắt được thay đổi nếu broadcast lỗi.
    }
  }

  private handleBroadcast(data: any): void {
    if (!data || data.clientId === this.clientId || data.courseId !== this.options.courseId) return;
    if (this.remotePullTimer) clearTimeout(this.remotePullTimer);
    this.remotePullTimer = setTimeout(() => {
      this.remotePullTimer = null;
      void this.pullNow(false);
    }, 250);
  }

  private updatePresence(): void {
    if (!this.channel) return;
    const presence = this.channel.presenceState() as Record<string, any[]>;
    const users: CollabUser[] = [];
    const seen = new Set<string>();

    Object.values(presence).forEach(entries => {
      (entries || []).forEach(meta => {
        const id = String(meta.client_id || meta.user_id || '');
        if (!id || seen.has(id)) return;
        seen.add(id);
        users.push({
          id,
          name: String(meta.name || 'Giảng viên'),
          color: String(meta.color || colorFor(id)),
          joinedAt: String(meta.joined_at || ''),
          isSelf: id === this.clientId
        });
      });
    });

    users.sort((a, b) => {
      if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
      return a.name.localeCompare(b.name, 'vi');
    });
    this.users = users;
    this.emitStatus(this.state, this.connected
      ? (users.length > 1 ? `Đã kết nối · ${users.length} người đang cộng tác` : 'Đã kết nối cộng tác. Chờ người khác tham gia...')
      : this.message);
  }

  private emitStatus(state: CollabStatus['state'], message: string): void {
    this.state = state;
    this.message = message;
    this.options.onStatus(this.getStatus());
  }

  stop(): void {
    this.stopped = true;
    this.ready = false;
    this.initializing = false;
    this.connected = false;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    if (this.remotePullTimer) clearTimeout(this.remotePullTimer);
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pushTimer = null;
    this.remotePullTimer = null;
    this.pollTimer = null;
    this.pendingRecord = null;
    this.clearLocalSocket();

    if (this.channel) {
      void this.channel.unsubscribe();
      this.channel = null;
    }
    if (this.client) {
      void this.client.removeAllChannels();
      this.client = null;
    }
    this.users = [];
    this.emitStatus('off', 'Đã tắt cộng tác.');
  }
}
