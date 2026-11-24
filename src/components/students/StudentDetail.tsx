import { ContactRound, Pencil } from 'lucide-react';
import { STUDENT_INFO_FIELDS, type Student } from '../../students';
import { unitFull, unitLabel } from '../../lib/units';
import { Modal } from '../ui/Modal';

function initials(name: string): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'SV';
  return (parts[parts.length - 1][0] + (parts.length > 1 ? parts[0][0] : '')).toUpperCase();
}

function formatUpdated(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function detailValue(value: string): string {
  return String(value || '').trim() || '—';
}

export function StudentDetail({
  student,
  onClose,
  onEdit
}: {
  student: Student | null;
  onClose: () => void;
  onEdit: () => void;
}) {
  if (!student) return null;

  const personal = STUDENT_INFO_FIELDS.map(field => ({
    label: field.label,
    value: student[field.key]
  }));
  const units = [
    { label: unitLabel('daiDoi'), value: student.daiDoi ? unitFull('daiDoi', student.daiDoi) : '' },
    { label: unitLabel('trungDoi'), value: student.trungDoi ? unitFull('trungDoi', student.trungDoi) : '' },
    { label: unitLabel('tieuDoi'), value: student.tieuDoi ? unitFull('tieuDoi', student.tieuDoi) : '' },
    { label: 'Tòa nhà', value: student.building },
    { label: 'Phòng', value: student.room },
    { label: 'Chức vụ', value: student.position }
  ];
  const updatedAt = formatUpdated(student.updatedAt || '');

  return (
    <Modal
      open
      onClose={onClose}
      title="Hồ sơ sinh viên"
      subtitle={`${student.name} · ${student.position}`}
      icon={<ContactRound size={20} />}
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Đóng</button>
          <button type="button" className="btn btn-primary" onClick={onEdit}>
            <Pencil size={16} /> Sửa hồ sơ
          </button>
        </>
      }
    >
      <div className="student-detail-hero">
        <span className="student-detail-avatar">{initials(student.name)}</span>
        <div>
          <strong>{student.name}</strong>
          <span>{student.code ? `Mã SV ${student.code}` : 'Chưa có mã sinh viên'}</span>
        </div>
      </div>

      <section className="form-section">
        <div className="form-section-head">
          <h3>Thông tin cá nhân</h3>
          <span>Dữ liệu nhập từ file và chỉnh sửa trong hồ sơ</span>
        </div>
        <dl className="detail-grid">
          {personal.map(item => (
            <div key={item.label} className="detail-item">
              <dt>{item.label}</dt>
              <dd>{detailValue(item.value)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="form-section">
        <div className="form-section-head">
          <h3>Đơn vị &amp; nơi ở</h3>
        </div>
        <dl className="detail-grid">
          {units.map(item => (
            <div key={item.label} className="detail-item">
              <dt>{item.label}</dt>
              <dd>{detailValue(item.value)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {student.note ? (
        <section className="form-section">
          <div className="form-section-head">
            <h3>Ghi chú</h3>
          </div>
          <p className="student-detail-note">{student.note}</p>
        </section>
      ) : null}

      {updatedAt ? (
        <p className="student-detail-updated">
          Cập nhật {updatedAt}{student.updatedBy ? ` · ${student.updatedBy}` : ''}
        </p>
      ) : null}
    </Modal>
  );
}
