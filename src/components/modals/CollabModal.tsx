import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Cloud,
  DownloadCloud,
  RefreshCw,
  Save,
  Share2,
  UploadCloud,
  Users2,
  Wifi,
  WifiOff
} from 'lucide-react';
import { isCloudConfigured } from '../../cloudSync';
import { useAppStore } from '../../store/useAppStore';
import { Modal } from '../ui/Modal';
import { Field } from '../ui/Field';

export function CollabModal() {
  const modal = useAppStore(state => state.modal);
  const cloudConfig = useAppStore(state => state.cloudConfig);
  const collabSettings = useAppStore(state => state.collabSettings);
  const collabStatus = useAppStore(state => state.collabStatus);
  const closeModal = useAppStore(state => state.closeModal);
  const openModal = useAppStore(state => state.openModal);
  const toggleCollab = useAppStore(state => state.toggleCollab);
  const saveCollabName = useAppStore(state => state.saveCollabName);
  const pullCollabNow = useAppStore(state => state.pullCollabNow);
  const pushCollabNow = useAppStore(state => state.pushCollabNow);
  const [name, setName] = useState(collabSettings.displayName || '');
  const open = modal === 'collab';
  const configured = isCloudConfigured(cloudConfig);
  const enabled = collabSettings.enabled;

  useEffect(() => {
    if (open) setName(collabSettings.displayName || '');
  }, [open, collabSettings.displayName]);

  const statusTone = collabStatus?.state === 'connected'
    ? 'open'
    : collabStatus?.state === 'error'
      ? 'locked'
      : 'neutral';

  return (
    <Modal
      open={open}
      onClose={closeModal}
      title="Cộng tác nhóm"
      subtitle="Nhiều người cùng chấm điểm và sửa danh sách sinh viên. Thay đổi được đồng bộ qua máy chủ chia sẻ."
      icon={<Share2 size={20} />}
      size="lg"
      footer={<button type="button" className="btn btn-ghost" onClick={closeModal}>Đóng</button>}
    >
      {!configured ? (
        <div className="inline-alert warning">
          <AlertTriangle size={16} />
          <span>Chưa cấu hình kết nối chia sẻ. Hãy kết nối máy chủ riêng hoặc Supabase trước khi bật cộng tác.</span>
          <button type="button" className="btn btn-soft btn-sm" onClick={() => openModal('cloud')}>
            <Cloud size={15} /> Cấu hình
          </button>
        </div>
      ) : null}

      <section className={`collab-status-card ${enabled ? 'enabled' : ''}`}>
        <div className="collab-status-top">
          <span className={`collab-status-icon ${collabStatus?.state === 'connected' ? 'connected' : ''}`}>
            {enabled ? <Wifi size={20} /> : <WifiOff size={20} />}
          </span>
          <div>
            <strong>{enabled ? 'Đang bật cộng tác' : 'Cộng tác đang tắt'}</strong>
            <span>{collabStatus?.message || (enabled ? 'Đang chờ kết nối...' : 'Bật để nhiều người cùng làm việc trên khóa hiện tại.')}</span>
          </div>
          <span className={`status-pill ${statusTone}`}>
            {collabStatus?.state === 'connected' ? 'Đã kết nối' : collabStatus?.state === 'connecting' ? 'Đang kết nối' : collabStatus?.state === 'error' ? 'Có lỗi' : 'Chưa bật'}
          </span>
        </div>
        {enabled && collabStatus?.users?.length ? (
          <div className="collab-users">
            {collabStatus.users.map(user => (
              <span key={user.id} className="collab-user" title={user.isSelf ? 'Bạn' : user.name}>
                <span className="collab-avatar" style={{ background: user.color }}>{user.name.slice(0, 1).toUpperCase()}</span>
                <span>{user.name}{user.isSelf ? ' (bạn)' : ''}</span>
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <div className="form-grid two">
        <Field label="Tên hiển thị của bạn" htmlFor="collab-name" className="span-2" hint="Tên này hiển thị với người khác trong nhóm và trong nhật ký.">
          <input id="collab-name" className="text-input" value={name} onChange={event => setName(event.target.value)} placeholder="Ví dụ: GV. Minh" />
        </Field>
      </div>

      <div className="collab-actions">
        <button type="button" className="btn btn-soft" onClick={() => saveCollabName(name)}>
          <Save size={16} /> Lưu tên
        </button>
        <button
          type="button"
          className={`btn ${enabled ? 'btn-danger' : 'btn-primary'}`}
          onClick={() => toggleCollab(name)}
          disabled={!configured}
        >
          <Users2 size={16} /> {enabled ? 'Tắt cộng tác' : 'Bật cộng tác'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => void pullCollabNow()} disabled={!enabled}>
          <DownloadCloud size={16} /> Kéo mới nhất
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => void pushCollabNow()} disabled={!enabled}>
          <UploadCloud size={16} /> Đẩy dữ liệu
        </button>
      </div>

      <div className="collab-info-grid">
        <div>
          <RefreshCw size={17} />
          <strong>Đồng bộ tự động</strong>
          <p>Khi bật, thay đổi được gửi ngay khi lưu. Hệ thống tự gộp thay đổi theo từng trung đội và sinh viên.</p>
        </div>
        <div>
          <Users2 size={17} />
          <strong>Nhiều người cùng lúc</strong>
          <p>Mọi người dùng cùng mã nhóm dữ liệu sẽ thấy cùng khóa hiện tại. Nên thống nhất người chấm để tránh trùng.</p>
        </div>
      </div>

      {collabStatus?.lastSyncAt ? (
        <p className="settings-help">Đồng bộ gần nhất: {new Date(collabStatus.lastSyncAt).toLocaleString('vi-VN')}</p>
      ) : null}
    </Modal>
  );
}
