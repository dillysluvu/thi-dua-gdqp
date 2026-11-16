import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  DownloadCloud,
  RefreshCw,
  Save,
  Server,
  UploadCloud
} from 'lucide-react';
import type { CloudConfig } from '../../cloudSync';
import { cloudProviderName } from '../../cloudSync';
import { useAppStore } from '../../store/useAppStore';
import { Modal } from '../ui/Modal';
import { Field } from '../ui/Field';
import { Segmented } from '../ui/Segmented';

const LOCAL_DEFAULT_URL = typeof window !== 'undefined' && !window.location.hostname.endsWith('github.io')
  ? window.location.origin
  : 'http://127.0.0.1:8787';

function normalizeConfig(config: CloudConfig): CloudConfig {
  return {
    provider: config.provider === 'local' ? 'local' : 'supabase',
    url: config.url || (config.provider === 'local' ? LOCAL_DEFAULT_URL : ''),
    anonKey: config.anonKey || '',
    table: config.table || 'course_sync',
    syncId: config.syncId || 'gdqpan',
    autoPush: Boolean(config.autoPush)
  };
}

export function CloudModal() {
  const modal = useAppStore(state => state.modal);
  const cloudConfig = useAppStore(state => state.cloudConfig);
  const cloudStatus = useAppStore(state => state.cloudStatus);
  const cloudBusy = useAppStore(state => state.cloudBusy);
  const closeModal = useAppStore(state => state.closeModal);
  const saveCloud = useAppStore(state => state.saveCloud);
  const testCloud = useAppStore(state => state.testCloud);
  const pushCloud = useAppStore(state => state.pushCloud);
  const pullCloud = useAppStore(state => state.pullCloud);
  const [form, setForm] = useState<CloudConfig>(normalizeConfig(cloudConfig));
  const open = modal === 'cloud';

  useEffect(() => {
    if (open) setForm(normalizeConfig(cloudConfig));
  }, [open, cloudConfig]);

  const update = (field: keyof CloudConfig, value: string | boolean) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const provider = form.provider === 'local' ? 'local' : 'supabase';
  const label = cloudProviderName(form);

  return (
    <Modal
      open={open}
      onClose={closeModal}
      title="Kết nối chia sẻ"
      subtitle="Dùng máy chủ riêng của nhóm hoặc Supabase. Nhiều người nhập cùng mã nhóm dữ liệu sẽ thấy cùng bảng điểm."
      icon={<Cloud size={20} />}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={closeModal}>Đóng</button>
          <button type="button" className="btn btn-soft" onClick={() => saveCloud(form)}>
            <Save size={16} /> Lưu cấu hình
          </button>
        </>
      }
    >
      <div className="cloud-provider-switch">
        <Segmented
          value={provider}
          onChange={value => update('provider', value)}
          ariaLabel="Nhà cung cấp kết nối"
          options={[
            { value: 'local', label: 'Máy chủ riêng', icon: <Server size={15} /> },
            { value: 'supabase', label: 'Supabase', icon: <Cloud size={15} /> }
          ]}
        />
        <span className={`status-pill ${cloudStatus?.ok === false ? 'locked' : cloudStatus?.ok ? 'open' : 'neutral'}`}>
          {cloudStatus?.ok === false ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
          {cloudStatus ? (cloudStatus.ok ? 'Sẵn sàng' : 'Có lỗi') : 'Chưa kiểm tra'}
        </span>
      </div>

      {cloudStatus ? (
        <div className={`inline-alert ${cloudStatus.ok ? 'success' : 'error'}`}>
          {cloudStatus.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{cloudStatus.message}</span>
        </div>
      ) : null}

      <div className="form-grid two">
        <Field label={provider === 'local' ? 'Địa chỉ máy chủ' : 'Supabase URL'} htmlFor="cloud-url" className="span-2" hint={provider === 'local' ? 'Ví dụ: http://127.0.0.1:8787 hoặc địa chỉ LAN/tunnel của máy chủ.' : 'Ví dụ: https://xxxx.supabase.co'}>
          <input id="cloud-url" className="text-input" value={form.url} onChange={event => update('url', event.target.value)} placeholder={provider === 'local' ? 'http://127.0.0.1:8787' : 'https://xxxx.supabase.co'} />
        </Field>
        <Field label={provider === 'local' ? 'Mã truy cập máy chủ' : 'Anon key'} htmlFor="cloud-key" className={provider === 'local' ? '' : 'span-2'} hint={provider === 'local' ? 'Mã truy cập được cấu hình trên máy chủ, không phải mật khẩu tài khoản.' : 'Khóa công khai anon của Supabase.'}>
          <input id="cloud-key" className="text-input" type="password" value={form.anonKey} onChange={event => update('anonKey', event.target.value)} placeholder={provider === 'local' ? 'Nhập mã truy cập' : 'eyJhbGciOi...'} autoComplete="off" />
        </Field>
        {provider === 'supabase' ? (
          <Field label="Bảng dữ liệu" htmlFor="cloud-table" hint="Mặc định course_sync">
            <input id="cloud-table" className="text-input" value={form.table} onChange={event => update('table', event.target.value)} placeholder="course_sync" />
          </Field>
        ) : null}
        <Field label="Mã nhóm dữ liệu" htmlFor="cloud-sync" hint="Nhiều người dùng cùng mã này sẽ thấy cùng dữ liệu.">
          <input id="cloud-sync" className="text-input" value={form.syncId} onChange={event => update('syncId', event.target.value)} placeholder="gdqpan" />
        </Field>
        <label className="checkbox-line cloud-autopush">
          <input type="checkbox" checked={form.autoPush} onChange={event => update('autoPush', event.target.checked)} />
          <span>Tự động đẩy dữ liệu sau khi lưu</span>
        </label>
      </div>

      <div className="cloud-actions">
        <button type="button" className="btn btn-soft" onClick={() => void testCloud(form)} disabled={cloudBusy}>
          <RefreshCw size={16} className={cloudBusy ? 'spin' : ''} /> Kiểm tra kết nối
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void pushCloud(form)} disabled={cloudBusy}>
          <UploadCloud size={16} /> Đẩy dữ liệu lên {label}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => void pullCloud(form)} disabled={cloudBusy}>
          <DownloadCloud size={16} /> Kéo dữ liệu về
        </button>
      </div>

      <div className="cloud-note-grid">
        <div>
          <strong>Máy chủ riêng</strong>
          <p>Phù hợp khi cả nhóm dùng chung laptop/máy chủ nội bộ. Cần bật server và tunnel nếu truy cập ngoài mạng LAN.</p>
        </div>
        <div>
          <strong>Supabase</strong>
          <p>Phù hợp khi cần truy cập từ xa ổn định. Cần tạo bảng <code>course_sync</code> và bật Realtime nếu muốn cộng tác trực tiếp.</p>
        </div>
      </div>
    </Modal>
  );
}
