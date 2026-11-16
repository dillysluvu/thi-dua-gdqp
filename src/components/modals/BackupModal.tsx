import { Database, Plus, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { formatShortDate } from '../../lib/record';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';

export function BackupModal() {
  const modal = useAppStore(state => state.modal);
  const record = useAppStore(state => state.record);
  const backups = useAppStore(state => state.backups);
  const closeModal = useAppStore(state => state.closeModal);
  const createBackupNow = useAppStore(state => state.createBackupNow);
  const restoreBackup = useAppStore(state => state.restoreBackup);
  const removeBackup = useAppStore(state => state.removeBackup);
  const confirmAction = useAppStore(state => state.confirmAction);
  const refreshBackups = useAppStore(state => state.refreshBackups);
  const open = modal === 'backups';

  const restore = async (id: string, createdAt: string) => {
    const ok = await confirmAction({
      title: 'Khôi phục bản sao lưu',
      message: `Khôi phục dữ liệu từ bản sao lưu lúc ${formatShortDate(createdAt)}?\nDữ liệu hiện tại sẽ được thay thế. Một bản sao lưu tự động sẽ được tạo trước khi khôi phục.`,
      confirmLabel: 'Khôi phục',
      danger: true
    });
    if (ok) restoreBackup(id);
  };

  const remove = async (id: string) => {
    const ok = await confirmAction({
      title: 'Xóa bản sao lưu',
      message: 'Xóa bản sao lưu này khỏi thiết bị? Thao tác không thể hoàn tác.',
      confirmLabel: 'Xóa',
      danger: true
    });
    if (ok) removeBackup(id);
  };

  return (
    <Modal
      open={open}
      onClose={closeModal}
      title="Sao lưu & khôi phục"
      subtitle="Bản sao lưu được lưu trên thiết bị này. Hệ thống tự tạo bản mới khi có thay đổi lớn và giữ tối đa 15 bản gần nhất."
      icon={<Database size={20} />}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={closeModal}>Đóng</button>
          <button type="button" className="btn btn-primary" onClick={createBackupNow}>
            <Plus size={16} /> Tạo bản sao lưu
          </button>
        </>
      }
    >
      <div className="backup-summary">
        <div>
          <span className="section-eyebrow">Khóa hiện tại</span>
          <strong>{record.meta.courseName}</strong>
          <span>{record.items.length} trung đội · {record.students.length} sinh viên · Lưu lúc {formatShortDate(record.savedAt)}</span>
        </div>
        <div className="backup-count"><strong>{backups.length}</strong><span>/ 15 bản</span></div>
      </div>

      <div className="backup-list-head">
        <h3>Bản sao lưu gần đây</h3>
        <button type="button" className="text-button" onClick={refreshBackups}><RotateCcw size={14} /> Làm mới</button>
      </div>

      {backups.length ? (
        <div className="backup-list">
          {backups.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map(snapshot => (
            <article key={snapshot.id} className="backup-row">
              <span className="backup-icon"><ShieldCheck size={18} /></span>
              <div className="backup-copy">
                <strong>{snapshot.reason || 'Bản sao lưu'}</strong>
                <span>{new Date(snapshot.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                <span>{snapshot.record.items.length} trung đội · {snapshot.record.students?.length || 0} sinh viên · {snapshot.record.meta.courseName}</span>
              </div>
              <div className="backup-actions">
                <button type="button" className="btn btn-soft btn-sm" onClick={() => restore(snapshot.id, snapshot.createdAt)}>
                  <RotateCcw size={15} /> Khôi phục
                </button>
                <button type="button" className="icon-button danger" onClick={() => remove(snapshot.id)} aria-label="Xóa bản sao lưu">
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Database size={28} />}
          title="Chưa có bản sao lưu"
          description="Tạo bản sao lưu thủ công trước khi nhập Excel hoặc chuyển khóa quan trọng."
          action={<button type="button" className="btn btn-soft" onClick={createBackupNow}><Plus size={16} /> Tạo bản sao lưu đầu tiên</button>}
        />
      )}

      <div className="inline-alert info">
        <ShieldCheck size={16} />
        <span>Bản sao lưu tự động được tạo tối đa mỗi 5 phút khi có thay đổi. Dữ liệu cũ vẫn có thể khôi phục nếu lỡ nhập sai.</span>
      </div>
    </Modal>
  );
}
