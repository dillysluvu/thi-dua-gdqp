import { useState } from 'react';
import {
  Check,
  Copy,
  FolderOpen,
  Lock,
  Pencil,
  Plus,
  Trash2,
  X
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { formatShortDate } from '../../lib/record';
import { Modal } from '../ui/Modal';
import { Field } from '../ui/Field';

export function CourseModal() {
  const modal = useAppStore(state => state.modal);
  const record = useAppStore(state => state.record);
  const courses = useAppStore(state => state.courses);
  const closeModal = useAppStore(state => state.closeModal);
  const switchCourse = useAppStore(state => state.switchCourse);
  const createCourse = useAppStore(state => state.createCourse);
  const renameCourse = useAppStore(state => state.renameCourse);
  const deleteCourse = useAppStore(state => state.deleteCourse);
  const confirmAction = useAppStore(state => state.confirmAction);
  const [newName, setNewName] = useState('');
  const [cloneSource, setCloneSource] = useState(record.meta.id);
  const [cloneEnabled, setCloneEnabled] = useState(false);
  const [renameId, setRenameId] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [error, setError] = useState('');

  const open = modal === 'courses';
  const close = () => {
    setError('');
    closeModal();
  };

  const create = () => {
    setError('');
    const result = createCourse(newName, cloneEnabled ? cloneSource : '');
    if (!result.ok) {
      setError(result.error || 'Không tạo được khóa.');
      return;
    }
    setNewName('');
    close();
  };

  const startRename = (id: string, name: string) => {
    setRenameId(id);
    setRenameValue(name);
    setError('');
  };

  const submitRename = () => {
    const result = renameCourse(renameId, renameValue);
    if (!result.ok) {
      setError(result.error || 'Không đổi được tên khóa.');
      return;
    }
    setRenameId('');
    setRenameValue('');
  };

  const askDelete = async (id: string, name: string) => {
    const ok = await confirmAction({
      title: 'Xóa khóa học',
      message: `Xóa vĩnh viễn khóa “${name}” và toàn bộ điểm, sinh viên, nhật ký của khóa?\nThao tác này không thể hoàn tác. Hãy xuất file sao lưu trước nếu cần.`,
      confirmLabel: 'Xóa khóa',
      danger: true
    });
    if (ok) deleteCourse(id);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Quản lý khóa học"
      subtitle="Mỗi khóa có bảng điểm, danh sách sinh viên và nhật ký riêng. Có thể nhân bản để dùng lại cấu hình."
      icon={<FolderOpen size={20} />}
      size="lg"
      footer={<button type="button" className="btn btn-ghost" onClick={close}>Đóng</button>}
    >
      {error ? <div className="inline-alert error">{error}</div> : null}

      <section className="course-create-card">
        <div className="course-create-head">
          <div>
            <span className="section-eyebrow">Khóa mới</span>
            <h3>Tạo khóa học</h3>
          </div>
          <Plus size={20} />
        </div>
        <div className="course-create-grid">
          <Field label="Tên khóa" htmlFor="new-course-name" className="course-create-name">
            <input
              id="new-course-name"
              className="text-input"
              value={newName}
              onChange={event => setNewName(event.target.value)}
              placeholder="Ví dụ: K69 · Đợt 1"
              onKeyDown={event => { if (event.key === 'Enter') create(); }}
            />
          </Field>
          <label className="checkbox-line course-clone-toggle">
            <input type="checkbox" checked={cloneEnabled} onChange={event => setCloneEnabled(event.target.checked)} />
            <span>Nhân bản từ khóa</span>
          </label>
          <select
            className="select-input course-clone-select"
            value={cloneSource}
            onChange={event => setCloneSource(event.target.value)}
            disabled={!cloneEnabled}
            aria-label="Khóa nguồn để nhân bản"
          >
            {courses.map(course => <option key={course.id} value={course.id}>{course.courseName}</option>)}
          </select>
          <button type="button" className="btn btn-primary" onClick={create}>
            <Plus size={16} /> Tạo khóa
          </button>
        </div>
        <p className="settings-help">Tạo mới sẽ dùng danh sách 168 trung đội mặc định. Nhân bản sẽ sao chép cả điểm và sinh viên của khóa nguồn.</p>
      </section>

      <section className="course-list-section">
        <div className="course-list-head">
          <h3>Khóa hiện có</h3>
          <span>{courses.length} khóa</span>
        </div>
        <div className="course-list">
          {courses.map(course => {
            const current = course.id === record.meta.id;
            return (
              <article key={course.id} className={`course-row ${current ? 'current' : ''}`}>
                <div className="course-row-main">
                  <span className={`course-status-dot ${current ? 'active' : ''}`} />
                  <div className="course-row-copy">
                    {renameId === course.id ? (
                      <div className="course-rename-row">
                        <input
                          className="text-input"
                          value={renameValue}
                          onChange={event => setRenameValue(event.target.value)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') submitRename();
                            if (event.key === 'Escape') setRenameId('');
                          }}
                          autoFocus
                        />
                        <button type="button" className="icon-button" onClick={submitRename} aria-label="Lưu tên khóa"><Check size={16} /></button>
                        <button type="button" className="icon-button" onClick={() => setRenameId('')} aria-label="Hủy đổi tên"><X size={16} /></button>
                      </div>
                    ) : (
                      <>
                        <strong>{course.courseName} {current ? <span className="current-badge">Đang mở</span> : null}</strong>
                        <span>{course.unitName} · {course.itemCount} trung đội · Cập nhật {formatShortDate(course.updatedAt)}</span>
                      </>
                    )}
                  </div>
                  {course.locked ? <span className="course-lock"><Lock size={14} /> Đã khóa</span> : null}
                </div>
                <div className="course-row-actions">
                  {!current ? (
                    <button type="button" className="btn btn-soft btn-sm" onClick={() => { switchCourse(course.id); close(); }}>
                      <FolderOpen size={15} /> Mở
                    </button>
                  ) : null}
                  <button type="button" className="icon-button" onClick={() => startRename(course.id, course.courseName)} title="Đổi tên" aria-label={`Đổi tên ${course.courseName}`}>
                    <Pencil size={15} />
                  </button>
                  <button type="button" className="icon-button" onClick={() => { const result = createCourse(`${course.courseName} (bản sao)`, course.id); if (!result.ok) setError(result.error || 'Không nhân bản được khóa.'); else close(); }} title="Nhân bản" aria-label={`Nhân bản ${course.courseName}`}>
                    <Copy size={15} />
                  </button>
                  <button type="button" className="icon-button danger" onClick={() => askDelete(course.id, course.courseName)} title="Xóa khóa" aria-label={`Xóa ${course.courseName}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </Modal>
  );
}
