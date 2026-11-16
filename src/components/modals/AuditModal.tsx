import {
  Download,
  History,
  Lock,
  ShieldCheck,
  Unlock
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { exportAuditCSV } from '../../lib/export';
import { formatShortDate, formatTime } from '../../lib/record';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';

export function AuditModal() {
  const modal = useAppStore(state => state.modal);
  const record = useAppStore(state => state.record);
  const closeModal = useAppStore(state => state.closeModal);
  const toggleLock = useAppStore(state => state.toggleLock);
  const confirmAction = useAppStore(state => state.confirmAction);
  const notify = useAppStore(state => state.notify);
  const open = modal === 'audit';
  const entries = record.audit.slice().reverse();

  const askToggle = async () => {
    const nextLocked = !record.meta.locked;
    const ok = await confirmAction({
      title: nextLocked ? 'Khóa sổ điểm' : 'Mở khóa sổ điểm',
      message: nextLocked
        ? 'Khóa sổ sau khi hoàn tất? Mọi thao tác sửa điểm, sinh viên và cấu hình sẽ bị chặn cho đến khi mở khóa.'
        : 'Mở khóa sổ để tiếp tục chỉnh sửa điểm và sinh viên?',
      confirmLabel: nextLocked ? 'Khóa sổ' : 'Mở khóa',
      danger: nextLocked
    });
    if (ok) toggleLock();
  };

  const exportLog = () => {
    if (!record.audit.length) {
      notify('Chưa có nhật ký để xuất.', 'error');
      return;
    }
    exportAuditCSV(record);
    notify('Đã xuất nhật ký CSV.', 'success');
  };

  return (
    <Modal
      open={open}
      onClose={closeModal}
      title="Nhật ký & khóa sổ"
      subtitle="Theo dõi ai đã thay đổi điểm, sinh viên hoặc cấu hình. Khóa sổ khi đã hoàn tất để tránh sửa nhầm."
      icon={<History size={20} />}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={closeModal}>Đóng</button>
          <button type="button" className="btn btn-soft" onClick={exportLog}><Download size={16} /> Xuất nhật ký</button>
          <button type="button" className={`btn ${record.meta.locked ? 'btn-soft' : 'btn-danger'}`} onClick={askToggle}>
            {record.meta.locked ? <Unlock size={16} /> : <Lock size={16} />}
            {record.meta.locked ? 'Mở khóa sổ' : 'Khóa sổ điểm'}
          </button>
        </>
      }
    >
      <section className={`audit-status ${record.meta.locked ? 'locked' : 'open'}`}>
        <span className="audit-status-icon">{record.meta.locked ? <Lock size={20} /> : <ShieldCheck size={20} />}</span>
        <div>
          <strong>{record.meta.locked ? 'Sổ điểm đang khóa' : 'Sổ điểm đang mở'}</strong>
          <span>
            {record.meta.locked
              ? `Khóa bởi ${record.meta.lockedBy || record.meta.graderName}${record.meta.lockedAt ? ` lúc ${formatShortDate(record.meta.lockedAt)} ${formatTime(record.meta.lockedAt)}` : ''}`
              : 'Có thể chấm điểm và chỉnh sửa dữ liệu.'}
          </span>
        </div>
        <span className="audit-count">{record.audit.length} thao tác</span>
      </section>

      <div className="audit-list-head">
        <h3>Lịch sử thay đổi</h3>
        <span>Mới nhất ở trên</span>
      </div>

      {entries.length ? (
        <div className="audit-list">
          {entries.map(entry => (
            <article key={entry.id} className="audit-row">
              <span className="audit-dot" />
              <div className="audit-copy">
                <strong>{entry.action}</strong>
                <span>{entry.detail || '—'}</span>
              </div>
              <div className="audit-meta">
                <strong>{entry.actor}</strong>
                <span>{formatShortDate(entry.at)} · {formatTime(entry.at)}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<History size={28} />}
          title="Chưa có nhật ký"
          description="Mọi thay đổi điểm, sinh viên và cấu hình sẽ được ghi lại tự động tại đây."
        />
      )}

      <div className="inline-alert info">
        <ShieldCheck size={16} />
        <span>Nhật ký được lưu cùng khóa học và có thể xuất CSV để đối chiếu. Tối đa 1.000 thao tác gần nhất.</span>
      </div>
    </Modal>
  );
}
