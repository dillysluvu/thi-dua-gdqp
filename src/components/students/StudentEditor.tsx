import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, GraduationCap, Lock, Save, UserPlus } from 'lucide-react';
import { STUDENT_POSITIONS } from '../../students';
import {
  useAppStore,
  type SaveStudentInput
} from '../../store/useAppStore';
import { Modal } from '../ui/Modal';
import { Field } from '../ui/Field';
import { daiDoiFromTrungDoi, unitLabel } from '../../lib/units';

function emptyStudent(position = 'Học viên'): SaveStudentInput {
  return {
    name: '',
    code: '',
    building: '',
    room: '',
    tieuDoi: '',
    trungDoi: '',
    daiDoi: '',
    position,
    phone: '',
    note: '',
    className: '',
    school: '',
    birthDate: '',
    hometown: '',
    gender: '',
    ethnicity: '',
    cccd: ''
  };
}

export function StudentEditor() {
  const editor = useAppStore(state => state.studentEditor);
  const record = useAppStore(state => state.record);
  const close = useAppStore(state => state.closeStudentEditor);
  const saveStudent = useAppStore(state => state.saveStudent);
  const locked = record.meta.locked;
  const [form, setForm] = useState<SaveStudentInput>(emptyStudent());
  const [error, setError] = useState('');

  const existing = useMemo(
    () => editor.studentId ? record.students.find(student => student.id === editor.studentId) : null,
    [editor.studentId, record.students]
  );

  useEffect(() => {
    if (!editor.open) return;
    if (existing) {
      setForm({
        id: existing.id,
        name: existing.name,
        code: existing.code,
        building: existing.building,
        room: existing.room,
        tieuDoi: existing.tieuDoi,
        trungDoi: existing.trungDoi,
        daiDoi: existing.daiDoi,
        position: existing.position,
        phone: existing.phone,
        note: existing.note,
        className: existing.className,
        school: existing.school,
        birthDate: existing.birthDate,
        hometown: existing.hometown,
        gender: existing.gender,
        ethnicity: existing.ethnicity,
        cccd: existing.cccd
      });
    } else {
      setForm(emptyStudent(editor.presetPosition || 'Học viên'));
    }
    setError('');
  }, [editor.open, editor.key, existing]);

  const update = (field: keyof SaveStudentInput, value: string) => {
    setForm(current => {
      const next = { ...current, [field]: value };
      if (field === 'trungDoi') next.daiDoi = daiDoiFromTrungDoi(value);
      return next;
    });
  };

  const submit = (continueAdding = false) => {
    const result = saveStudent(form, continueAdding);
    if (!result.ok) setError(result.error || 'Không lưu được sinh viên.');
    else setError('');
  };

  const buildings = useMemo(() => Array.from(new Set(record.students.map(student => student.building).filter(Boolean))), [record.students]);
  const rooms = useMemo(() => Array.from(new Set(record.students.map(student => student.room).filter(Boolean))), [record.students]);
  const daiDois = useMemo(() => Array.from(new Set(record.students.map(student => student.daiDoi).filter(Boolean))), [record.students]);
  const platoons = useMemo(() => Array.from(new Set(record.students.map(student => student.trungDoi).filter(Boolean))), [record.students]);
  const squads = useMemo(() => Array.from(new Set(record.students.map(student => student.tieuDoi).filter(Boolean))), [record.students]);

  return (
    <Modal
      open={editor.open}
      onClose={close}
      title={existing ? 'Sửa hồ sơ sinh viên' : 'Thêm sinh viên'}
      subtitle={existing ? `${existing.name} · ${existing.position}` : 'Nhập thông tin cơ bản và đơn vị. Các trường không bắt buộc có thể bổ sung sau.'}
      icon={<UserPlus size={20} />}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={close}>Hủy</button>
          <div className="modal-footer-group">
            {!existing ? (
              <button type="button" className="btn btn-soft" onClick={() => submit(true)} disabled={locked}>
                <Save size={16} /> Lưu &amp; thêm tiếp
              </button>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={() => submit(false)} disabled={locked}>
              <Save size={16} /> {existing ? 'Lưu thay đổi' : 'Thêm sinh viên'}
            </button>
          </div>
        </>
      }
    >
      {locked ? (
        <div className="inline-alert warning">
          <Lock size={16} /> Sổ điểm đã khóa. Mở khóa trong Nhật ký &amp; khóa sổ để sửa hồ sơ.
        </div>
      ) : null}
      {error ? <div className="inline-alert error"><AlertTriangle size={16} /> {error}</div> : null}

      <section className="form-section">
        <div className="form-section-head">
          <h3>Thông tin cơ bản</h3>
          <span>Họ tên là bắt buộc</span>
        </div>
        <div className="form-grid two">
          <Field label="Họ và tên" htmlFor="student-name" className="span-2">
            <input
              id="student-name"
              className="text-input"
              value={form.name}
              onChange={event => update('name', event.target.value)}
              placeholder="Nguyễn Văn A"
              autoComplete="name"
              disabled={locked}
            />
          </Field>
          <Field label="Mã sinh viên" htmlFor="student-code" hint="Dùng để nhận diện khi nhập Excel">
            <input
              id="student-code"
              className="text-input"
              value={form.code}
              onChange={event => update('code', event.target.value)}
              placeholder="2251234567"
              disabled={locked}
            />
          </Field>
          <Field label="Chức vụ" htmlFor="student-position">
            <select
              id="student-position"
              className="select-input"
              value={form.position}
              onChange={event => update('position', event.target.value)}
              disabled={locked}
            >
              {STUDENT_POSITIONS.map(position => <option key={position} value={position}>{position}</option>)}
            </select>
          </Field>
          <Field label="Lớp" htmlFor="student-class">
            <input id="student-class" className="text-input" value={form.className} onChange={event => update('className', event.target.value)} placeholder="K68-A" disabled={locked} />
          </Field>
          <Field label="Trường / đơn vị" htmlFor="student-school">
            <input id="student-school" className="text-input" value={form.school} onChange={event => update('school', event.target.value)} placeholder="Học viện Kỹ thuật Quân sự" disabled={locked} />
          </Field>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-head">
          <h3>Đơn vị &amp; nơi ở</h3>
          <span>c = đại đội · b = trung đội · a = tiểu đội</span>
        </div>
        <div className="form-grid two">
          <Field label="Tòa nhà" htmlFor="student-building">
            <input id="student-building" className="text-input" list="student-building-list" value={form.building} onChange={event => update('building', event.target.value)} placeholder="Toà C7" disabled={locked} />
            <datalist id="student-building-list">{buildings.map(value => <option key={value} value={value} />)}</datalist>
          </Field>
          <Field label="Phòng" htmlFor="student-room">
            <input id="student-room" className="text-input" list="student-room-list" value={form.room} onChange={event => update('room', event.target.value)} placeholder="503" disabled={locked} />
            <datalist id="student-room-list">{rooms.map(value => <option key={value} value={value} />)}</datalist>
          </Field>
          <Field label={unitLabel('daiDoi')} htmlFor="student-company" hint="Tự động: cứ 4 trung đội là 1 đại đội; có thể chỉnh">
            <input id="student-company" className="text-input" list="student-company-list" value={form.daiDoi} onChange={event => update('daiDoi', event.target.value)} placeholder="Tự động từ b" disabled={locked} />
            <datalist id="student-company-list">{daiDois.map(value => <option key={value} value={value} />)}</datalist>
          </Field>
          <Field label={unitLabel('trungDoi')} htmlFor="student-platoon" hint="Kí hiệu b, ví dụ b12">
            <input id="student-platoon" className="text-input" list="student-platoon-list" value={form.trungDoi} onChange={event => update('trungDoi', event.target.value)} placeholder="12" disabled={locked} />
            <datalist id="student-platoon-list">{platoons.map(value => <option key={value} value={value} />)}</datalist>
          </Field>
          <Field label={unitLabel('tieuDoi')} htmlFor="student-squad" hint="Kí hiệu a, ví dụ a45">
            <input id="student-squad" className="text-input" list="student-squad-list" value={form.tieuDoi} onChange={event => update('tieuDoi', event.target.value)} placeholder="45" disabled={locked} />
            <datalist id="student-squad-list">{squads.map(value => <option key={value} value={value} />)}</datalist>
          </Field>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-head">
          <h3>Liên hệ &amp; thông tin khác</h3>
          <span>Không bắt buộc</span>
        </div>
        <div className="form-grid two">
          <Field label="Số điện thoại" htmlFor="student-phone">
            <input id="student-phone" className="text-input" type="tel" value={form.phone} onChange={event => update('phone', event.target.value)} placeholder="09xx xxx xxx" disabled={locked} />
          </Field>
          <Field label="Ngày sinh" htmlFor="student-birth">
            <input id="student-birth" className="text-input" value={form.birthDate} onChange={event => update('birthDate', event.target.value)} placeholder="12/03/2006" disabled={locked} />
          </Field>
          <Field label="Quê quán" htmlFor="student-hometown">
            <input id="student-hometown" className="text-input" value={form.hometown} onChange={event => update('hometown', event.target.value)} placeholder="Hà Nội" disabled={locked} />
          </Field>
          <Field label="Giới tính" htmlFor="student-gender">
            <select id="student-gender" className="select-input" value={form.gender} onChange={event => update('gender', event.target.value)} disabled={locked}>
              <option value="">Chưa chọn</option>
              <option value="Nam">Nam</option>
              <option value="Nữ">Nữ</option>
              <option value="Khác">Khác</option>
            </select>
          </Field>
          <Field label="Dân tộc" htmlFor="student-ethnicity">
            <input id="student-ethnicity" className="text-input" value={form.ethnicity} onChange={event => update('ethnicity', event.target.value)} placeholder="Kinh" disabled={locked} />
          </Field>
          <Field label="CCCD / CMND" htmlFor="student-cccd">
            <input id="student-cccd" className="text-input" value={form.cccd} onChange={event => update('cccd', event.target.value)} placeholder="012345678901" disabled={locked} />
          </Field>
          <Field label="Ghi chú" htmlFor="student-note" className="span-2">
            <textarea id="student-note" className="text-area" rows={3} value={form.note} onChange={event => update('note', event.target.value)} placeholder="Thông tin cần lưu ý..." disabled={locked} />
          </Field>
        </div>
      </section>

      {form.position !== 'Học viên' ? (
        <div className="editor-position-hint">
          <GraduationCap size={16} />
          <span>Hồ sơ này sẽ xuất hiện trong tab <strong>Ban cán sự</strong> với chức vụ <strong>{form.position}</strong>.</span>
        </div>
      ) : null}
    </Modal>
  );
}
