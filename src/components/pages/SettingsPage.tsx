import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Cloud,
  Database,
  Download,
  History,
  Lock,
  Moon,
  RefreshCw,
  Save,
  Share2,
  ShieldCheck,
  Sun,
  Unlock
} from 'lucide-react';
import {
  useAppStore,
  type SettingsInput
} from '../../store/useAppStore';
import {
  parsePlatoonConfig,
  platoonsToText,
  presetPlatoonsText,
  type PlatoonItem
} from '../../lib/record';
import { exportRecordCSV, exportRecordJSON } from '../../lib/export';
import { UNIT_RULE, unitCode, unitFull } from '../../lib/units';
import { Field } from '../ui/Field';
import { Segmented } from '../ui/Segmented';

export function SettingsPage() {
  const record = useAppStore(state => state.record);
  const theme = useAppStore(state => state.theme);
  const setTheme = useAppStore(state => state.setTheme);
  const updateSettings = useAppStore(state => state.updateSettings);
  const toggleLock = useAppStore(state => state.toggleLock);
  const openModal = useAppStore(state => state.openModal);
  const openBackups = useAppStore(state => state.openBackups);
  const confirmAction = useAppStore(state => state.confirmAction);
  const notify = useAppStore(state => state.notify);

  const [form, setForm] = useState<SettingsInput>({
    courseName: record.meta.courseName,
    unitName: record.meta.unitName,
    baseScore: record.meta.baseScore,
    ngay: record.meta.ngay,
    thang: record.meta.thang,
    nam: record.meta.nam,
    graderName: record.meta.graderName,
    platoonsText: platoonsToText(record.items as PlatoonItem[])
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [savedAt, setSavedAt] = useState('');

  useEffect(() => {
    setForm({
      courseName: record.meta.courseName,
      unitName: record.meta.unitName,
      baseScore: record.meta.baseScore,
      ngay: record.meta.ngay,
      thang: record.meta.thang,
      nam: record.meta.nam,
      graderName: record.meta.graderName,
      platoonsText: platoonsToText(record.items as PlatoonItem[])
    });
  }, [record.meta.id, record.meta.settingsUpdatedAt]);

  const parsed = useMemo(() => parsePlatoonConfig(form.platoonsText), [form.platoonsText]);
  const existingIds = useMemo(() => new Set((record.items as PlatoonItem[]).map(item => item.id)), [record.items]);
  const parsedIds = useMemo(() => new Set(parsed.items.map(item => item.id)), [parsed.items]);
  const removedWithData = useMemo(() => (record.items as PlatoonItem[]).filter(item =>
    existingIds.has(item.id)
    && !parsedIds.has(item.id)
    && (Number(item.hocTap) || Number(item.renLuyen) || Number(item.nvvs) || Number(item.leTiet) || item.note)
  ), [existingIds, parsedIds, record.items]);

  const update = (field: keyof SettingsInput, value: string | number) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const save = async () => {
    setErrors([]);
    const baseScore = Number(form.baseScore);
    if (!Number.isFinite(baseScore) || baseScore <= 0) {
      setErrors(['Điểm gốc phải là số lớn hơn 0.']);
      return;
    }
    if (parsed.errors.length) {
      setErrors(parsed.errors);
      return;
    }
    if (removedWithData.length) {
      const ok = await confirmAction({
        title: 'Xóa trung đội đang có dữ liệu',
        message: `Danh sách mới bỏ ${removedWithData.length} trung đội đang có điểm hoặc ghi chú (${removedWithData.map(item => unitCode('trungDoi', item.id)).join(', ')}).\nDữ liệu của các trung đội này sẽ bị xóa khỏi khóa hiện tại. Tiếp tục?`,
        confirmLabel: 'Vẫn lưu',
        danger: true
      });
      if (!ok) return;
    }
    const result = updateSettings(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setSavedAt(new Date().toISOString());
    notify('Đã lưu cấu hình khóa học.', 'success');
  };

  const askLock = async () => {
    const nextLocked = !record.meta.locked;
    const ok = await confirmAction({
      title: nextLocked ? 'Khóa sổ điểm' : 'Mở khóa sổ điểm',
      message: nextLocked
        ? 'Sau khi khóa, toàn bộ điểm, sinh viên và cấu hình sẽ không thể chỉnh sửa cho đến khi mở khóa. Tiếp tục?'
        : 'Mở khóa để tiếp tục chấm điểm và chỉnh sửa dữ liệu?',
      confirmLabel: nextLocked ? 'Khóa sổ' : 'Mở khóa',
      danger: nextLocked
    });
    if (ok) toggleLock();
  };

  return (
    <div className="page-stack settings-page">
      <section className="page-heading">
        <div>
          <span className="section-eyebrow">Cấu hình khóa học</span>
          <h1>Cài đặt</h1>
          <p>Thay đổi tên khóa, đơn vị, điểm gốc, ngày chấm và danh sách b (trung đội), c (đại đội). Dữ liệu được lưu tự động sau khi bấm lưu.</p>
        </div>
        <div className="page-heading-actions">
          <span className={`status-pill ${record.meta.locked ? 'locked' : 'open'}`}>
            {record.meta.locked ? <Lock size={13} /> : <ShieldCheck size={13} />}
            {record.meta.locked ? 'Đã khóa' : 'Đang mở'}
          </span>
          <button type="button" className={`btn ${record.meta.locked ? 'btn-soft' : 'btn-ghost'}`} onClick={askLock}>
            {record.meta.locked ? <Unlock size={16} /> : <Lock size={16} />}
            {record.meta.locked ? 'Mở khóa sổ' : 'Khóa sổ điểm'}
          </button>
        </div>
      </section>

      <div className="settings-layout">
        <div className="settings-main">
          <section className="panel settings-card">
            <div className="panel-head">
              <div>
                <span className="section-eyebrow">Thông tin chung</span>
                <h2>Khóa học &amp; ngày chấm</h2>
              </div>
            </div>
            <div className="form-grid two">
              <Field label="Tên khóa học" htmlFor="setting-course" className="span-2">
                <input id="setting-course" className="text-input" value={form.courseName} onChange={event => update('courseName', event.target.value)} />
              </Field>
              <Field label="Đơn vị" htmlFor="setting-unit">
                <input id="setting-unit" className="text-input" value={form.unitName} onChange={event => update('unitName', event.target.value)} />
              </Field>
              <Field label="Người chấm" htmlFor="setting-grader">
                <input id="setting-grader" className="text-input" value={form.graderName} onChange={event => update('graderName', event.target.value)} />
              </Field>
              <Field label="Điểm gốc" htmlFor="setting-base" hint="Thường là 50 hoặc 100 điểm">
                <input id="setting-base" className="text-input" type="number" inputMode="decimal" min="1" step="0.1" value={form.baseScore} onChange={event => update('baseScore', Number(event.target.value) || 0)} />
              </Field>
              <Field label="Ngày chấm" htmlFor="setting-day" hint="Ngày / tháng / năm">
                <div className="date-input-group">
                  <input id="setting-day" className="text-input" type="number" min="1" max="31" value={form.ngay} onChange={event => update('ngay', Number(event.target.value) || 1)} aria-label="Ngày" />
                  <span>/</span>
                  <input className="text-input" type="number" min="1" max="12" value={form.thang} onChange={event => update('thang', Number(event.target.value) || 1)} aria-label="Tháng" />
                  <span>/</span>
                  <input className="text-input" type="number" min="2000" max="2100" value={form.nam} onChange={event => update('nam', Number(event.target.value) || 2026)} aria-label="Năm" />
                </div>
              </Field>
            </div>
          </section>

          <section className="panel settings-card">
            <div className="panel-head">
              <div>
                <span className="section-eyebrow">Danh sách b · trung đội</span>
                <h2>Đơn vị &amp; phòng ở</h2>
              </div>
              <div className="panel-head-actions">
                <button type="button" className="text-button" onClick={() => update('platoonsText', presetPlatoonsText())}>
                  <RefreshCw size={14} /> Khôi phục mẫu
                </button>
              </div>
            </div>
            <p className="settings-help">
              Mỗi dòng theo dạng <code>Số b | Tòa | Phòng | Quân số | c</code>. Số b phải liên tục từ 1 đến 168 toàn khóa, không reset theo trung đội. {UNIT_RULE} Cột c được tự động điền nếu để trống.
            </p>
            <textarea
              className="text-area platoon-editor"
              rows={12}
              value={form.platoonsText}
              onChange={event => update('platoonsText', event.target.value)}
              spellCheck={false}
            />
            <div className="platoon-editor-meta">
              <span className={parsed.errors.length ? 'text-danger' : 'text-success'}>
                {parsed.errors.length ? `${parsed.errors.length} lỗi cần sửa` : `${parsed.items.length} b hợp lệ`}
              </span>
              <span>{removedWithData.length ? `${removedWithData.length} b có dữ liệu sẽ bị bỏ` : 'Không có dữ liệu bị mất'}</span>
            </div>
            {parsed.errors.length ? (
              <div className="inline-alert error">
                <AlertTriangle size={16} />
                <div>{parsed.errors.slice(0, 6).map(error => <div key={error}>{error}</div>)}</div>
              </div>
            ) : null}
            {parsed.items.length ? (
              <div className="platoon-preview">
                <div className="platoon-preview-head">
                  <strong>Xem trước</strong>
                  <span>{parsed.items.length} dòng</span>
                </div>
                <div className="platoon-preview-grid">
                  {parsed.items.slice(0, 12).map(item => (
                    <div key={item.id} className="platoon-preview-row">
                      <strong title={unitFull('trungDoi', item.id)}>{unitCode('trungDoi', item.id)}</strong>
                      <span title={item.daiDoi ? unitFull('daiDoi', item.daiDoi) : 'Chưa xếp đại đội'}>{item.daiDoi ? unitCode('daiDoi', item.daiDoi) : '—'}</span>
                      <span>{item.building}</span>
                      <span>{item.rooms}</span>
                      <span>{item.quanSo || '—'}</span>
                    </div>
                  ))}
                </div>
                {parsed.items.length > 12 ? <p className="platoon-preview-more">... và {parsed.items.length - 12} b khác</p> : null}
              </div>
            ) : null}
          </section>

          <div className="settings-save-bar">
            <div>
              <strong>Lưu thay đổi cấu hình</strong>
              <span>{savedAt ? `Đã lưu lúc ${new Date(savedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : 'Điểm và danh sách hiện tại sẽ được giữ lại khi có thể.'}</span>
            </div>
            {errors.length ? <div className="inline-alert error">{errors[0]}</div> : null}
            <button type="button" className="btn btn-primary" onClick={save}>
              <Save size={17} /> Lưu cấu hình
            </button>
          </div>
        </div>

        <aside className="settings-side">
          <section className="panel settings-card">
            <div className="panel-head">
              <div>
                <span className="section-eyebrow">Giao diện</span>
                <h2>Chế độ hiển thị</h2>
              </div>
            </div>
            <Segmented
              value={theme}
              onChange={value => setTheme(value)}
              ariaLabel="Chế độ hiển thị"
              options={[
                { value: 'light', label: 'Sáng', icon: <Sun size={15} /> },
                { value: 'dark', label: 'Tối', icon: <Moon size={15} /> }
              ]}
            />
            <p className="settings-help">Lựa chọn được ghi nhớ trên thiết bị này. Chế độ tối phù hợp khi chấm điểm buổi tối.</p>
          </section>

          <section className="panel settings-card">
            <div className="panel-head">
              <div>
                <span className="section-eyebrow">Dữ liệu</span>
                <h2>Sao lưu &amp; chia sẻ</h2>
              </div>
            </div>
            <div className="settings-action-list">
              <button type="button" onClick={openBackups}><Database size={17} /><span><strong>Sao lưu &amp; khôi phục</strong><small>Bản tự động và thủ công</small></span></button>
              <button type="button" onClick={() => openModal('cloud')}><Cloud size={17} /><span><strong>Kết nối chia sẻ</strong><small>Máy chủ riêng hoặc Supabase</small></span></button>
              <button type="button" onClick={() => openModal('collab')}><Share2 size={17} /><span><strong>Cộng tác nhóm</strong><small>Nhiều người cùng sửa</small></span></button>
              <button type="button" onClick={() => openModal('audit')}><History size={17} /><span><strong>Nhật ký &amp; khóa sổ</strong><small>Theo dõi thay đổi</small></span></button>
            </div>
          </section>

          <section className="panel settings-card">
            <div className="panel-head">
              <div>
                <span className="section-eyebrow">Xuất dữ liệu</span>
                <h2>Tải về máy</h2>
              </div>
            </div>
            <div className="settings-action-list">
              <button type="button" onClick={() => { exportRecordJSON(record); notify('Đã xuất file JSON.', 'success'); }}>
                <Download size={17} /><span><strong>Xuất JSON</strong><small>Toàn bộ dữ liệu khóa</small></span>
              </button>
              <button type="button" onClick={() => { exportRecordCSV(record); notify('Đã xuất CSV.', 'success'); }}>
                <Download size={17} /><span><strong>Xuất CSV</strong><small>Mở bằng Excel</small></span>
              </button>
            </div>
            <p className="settings-help"><CalendarDays size={14} /> Dữ liệu hiện tại: {record.items.length} trung đội, {record.students.length} sinh viên.</p>
          </section>

          <section className="panel settings-card settings-danger-card">
            <div className="panel-head">
              <div>
                <span className="section-eyebrow">An toàn</span>
                <h2>Khóa sổ điểm</h2>
              </div>
            </div>
            <p className="settings-help">
              Khóa sổ sau khi hoàn tất chấm điểm để tránh sửa nhầm. Mọi thao tác khóa/mở khóa đều được ghi vào nhật ký.
            </p>
            <button type="button" className={`btn ${record.meta.locked ? 'btn-soft' : 'btn-danger'}`} onClick={askLock}>
              {record.meta.locked ? <Unlock size={16} /> : <Lock size={16} />}
              {record.meta.locked ? 'Mở khóa sổ điểm' : 'Khóa sổ điểm'}
            </button>
          </section>
        </aside>
      </div>

    </div>
  );
}
