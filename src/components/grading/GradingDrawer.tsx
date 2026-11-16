import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Lock,
  Minus,
  RotateCcw,
  Save,
  StickyNote,
  X
} from 'lucide-react';
import { formatNum, round1 } from '../../utils';
import {
  selectFilteredStudents,
  selectSelectedItem,
  useAppStore,
  type GradingDraft
} from '../../store/useAppStore';
import { SCORE_LABELS, type ScoreField } from '../../lib/record';
import { unitCode, unitFull } from '../../lib/units';
import { ScoreRing } from '../ui/ScoreRing';

const QUICK_VALUES = [-0.1, -0.2, -0.5, -1];
const QUICK_NOTES = ['Đi học muộn', 'Không vệ sinh', 'Mất trật tự', 'Thiếu lễ tiết', 'Vắng không phép'];

export function GradingDrawer() {
  const item = useAppStore(selectSelectedItem);
  const record = useAppStore(state => state.record);
  const applyGrading = useAppStore(state => state.applyGrading);
  const closeGrading = useAppStore(state => state.closeGrading);
  const goPrev = useAppStore(state => state.goPrev);
  const goNext = useAppStore(state => state.goNext);
  const notify = useAppStore(state => state.notify);
  const search = useAppStore(state => state.search);
  const building = useAppStore(state => state.building);
  const selectedItemId = useAppStore(state => state.selectedItemId);
  const students = useMemo(() => selectFilteredStudents({
    record,
    studentSearch: '',
    studentBuilding: 'ALL',
    studentRoom: 'ALL',
    studentPlatoon: selectedItemId ? String(selectedItemId) : 'ALL',
    studentTieuDoi: 'ALL',
    studentDaiDoi: 'ALL'
  }), [record, selectedItemId]);

  const [draft, setDraft] = useState<GradingDraft>({
    quanSo: '',
    hocTap: 0,
    renLuyen: 0,
    nvvs: 0,
    leTiet: 0,
    note: ''
  });
  const [error, setError] = useState('');
  const locked = record.meta.locked;
  const saveRef = useRef<() => boolean>(() => false);

  useEffect(() => {
    if (!item) return;
    setDraft({
      quanSo: item.quanSo || '',
      hocTap: Number(item.hocTap) || 0,
      renLuyen: Number(item.renLuyen) || 0,
      nvvs: Number(item.nvvs) || 0,
      leTiet: Number(item.leTiet) || 0,
      note: item.note || ''
    });
    setError('');
  }, [item?.id, item?.updatedAt]);

  useEffect(() => {
    if (!item) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (saveRef.current()) closeGrading();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [item?.id]);

  const localTotal = useMemo(() => round1(
    Number(record.meta.baseScore || 0)
    + Number(draft.hocTap || 0)
    + Number(draft.renLuyen || 0)
    + Number(draft.nvvs || 0)
    + Number(draft.leTiet || 0)
  ), [draft, record.meta.baseScore]);

  const localRank = useMemo(() => {
    if (!item) return 1;
    const scores = (record.items as any[]).map(entry => entry.id === item.id ? localTotal : Number(entry.totalScore));
    const unique = Array.from(new Set(scores)).sort((a, b) => b - a);
    return unique.indexOf(localTotal) + 1;
  }, [item, localTotal, record.items]);

  const saveDraft = (): boolean => {
    if (!item) return false;
    if (locked) return true;
    const result = applyGrading(item.id, draft);
    if (!result.ok) {
      setError(result.error || 'Không lưu được điểm.');
      return false;
    }
    setError('');
    return true;
  };

  const closeWithSave = () => {
    if (saveDraft()) closeGrading();
  };
  saveRef.current = saveDraft;

  const handlePrev = () => {
    if (!saveDraft()) return;
    goPrev();
  };

  const handleNext = () => {
    if (!saveDraft()) return;
    goNext();
  };

  const saveAndNext = () => {
    if (!saveDraft()) return;
    const list = (record.items as any[]).filter(entry =>
      (building === 'ALL' || entry.building === building)
      && (!search || `${unitCode('trungDoi', entry.id)} ${unitCode('daiDoi', entry.daiDoi)} ${entry.id} ${entry.daiDoi || ''} ${entry.building} ${entry.rooms} ${entry.note}`.toLowerCase().includes(search.toLowerCase()))
    );
    const index = list.findIndex(entry => entry.id === item?.id);
    if (index >= 0 && index < list.length - 1) {
      goNext();
      notify(`Đã lưu ${unitCode('trungDoi', item?.id)} · chuyển sang ${unitCode('trungDoi', list[index + 1].id)}.`, 'success');
    } else {
      closeGrading();
      notify('Đã chấm xong trung đội cuối cùng.', 'success');
    }
  };

  const adjust = (field: ScoreField, delta: number) => {
    setDraft(current => ({
      ...current,
      [field]: round1(Math.max(-99, Math.min(0, Number(current[field] || 0) + delta)))
    }));
  };

  const resetField = (field: ScoreField) => {
    setDraft(current => ({ ...current, [field]: 0 }));
  };

  if (!item) return null;

  const studentsInPlatoon = students.length;
  const list = (record.items as any[]).filter(entry =>
    (building === 'ALL' || entry.building === building)
    && (!search || `${unitCode('trungDoi', entry.id)} ${unitCode('daiDoi', entry.daiDoi)} ${entry.id} ${entry.daiDoi || ''} ${entry.building} ${entry.rooms} ${entry.note}`.toLowerCase().includes(search.toLowerCase()))
  );
  const position = list.findIndex(entry => entry.id === item.id);
  const canPrev = position > 0;
  const canNext = position >= 0 && position < list.length - 1;

  return createPortal(
    <div className="drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeWithSave(); }}>
      <aside className="grading-drawer" role="dialog" aria-modal="true" aria-label={`Chấm điểm ${unitFull('trungDoi', item.id)}`}>
        <div className="drawer-handle" aria-hidden="true" />
        <header className="drawer-header">
          <div className="drawer-title-wrap">
            <span className="drawer-eyebrow">Phiếu chấm thi đua</span>
            <div className="drawer-title-row">
              <h2 title={unitFull('trungDoi', item.id)}>{unitCode('trungDoi', item.id)}</h2>
              {item.daiDoi ? <span className="status-pill neutral" title={unitFull('daiDoi', item.daiDoi)}>{unitCode('daiDoi', item.daiDoi)}</span> : null}
              <span className="drawer-rank">Hạng {localRank}</span>
            </div>
            <p>{item.building || 'Chưa xếp tòa'} · Phòng {item.rooms || '—'} · {item.quanSo || 'Chưa có quân số'}</p>
          </div>
          <div className="drawer-header-side">
            <ScoreRing score={localTotal} base={record.meta.baseScore} size="lg" label={`/ ${formatNum(record.meta.baseScore)}`} />
            <button type="button" className="icon-button drawer-close" onClick={closeWithSave} aria-label="Đóng phiếu chấm">
              <X size={19} />
            </button>
          </div>
        </header>

        {locked ? (
          <div className="drawer-lock-notice">
            <Lock size={16} />
            <span>Sổ điểm đã khóa. Mở khóa trong <strong>Nhật ký &amp; khóa sổ</strong> để chỉnh sửa.</span>
          </div>
        ) : null}

        <div className="drawer-body">
          <section className="drawer-section">
            <div className="drawer-section-head">
              <h3>Quân số</h3>
              <span className="drawer-hint">Dạng 30/31</span>
            </div>
            <input
              className="text-input drawer-quanso"
              value={draft.quanSo}
              disabled={locked}
              placeholder="30/31"
              inputMode="numeric"
              onChange={event => setDraft(current => ({ ...current, quanSo: event.target.value }))}
            />
            <div className="drawer-meta-line">
              <span><Check size={13} /> {studentsInPlatoon} sinh viên trong danh sách</span>
              <span>{item.rooms ? `${item.rooms.split(',').length} phòng` : 'Chưa xếp phòng'}</span>
            </div>
          </section>

          <section className="drawer-section">
            <div className="drawer-section-head">
              <h3>Điểm trừ</h3>
              <span className="drawer-hint">Chạm nhanh hoặc nhập tay</span>
            </div>
            <div className="score-input-list">
              {(Object.keys(SCORE_LABELS) as ScoreField[]).map(field => (
                <div key={field} className="score-input-row">
                  <div className="score-input-label">
                    <strong>{SCORE_LABELS[field]}</strong>
                    <span className={`score-current ${Number(draft[field]) < 0 ? 'negative' : ''}`}>{formatNum(draft[field])}</span>
                  </div>
                  <div className="score-input-controls">
                    <div className="stepper">
                      <button type="button" disabled={locked} onClick={() => adjust(field, -0.1)} aria-label={`Giảm ${SCORE_LABELS[field]} 0,1`}><Minus size={14} /></button>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        value={draft[field]}
                        disabled={locked}
                        onChange={event => setDraft(current => ({ ...current, [field]: Number(event.target.value) || 0 }))}
                        onBlur={() => {
                          if (record.meta.autoNegative && Number(draft[field]) > 0) {
                            setDraft(current => ({ ...current, [field]: round1(-Math.abs(Number(current[field])) || 0) }));
                          }
                        }}
                        aria-label={SCORE_LABELS[field]}
                      />
                      <button type="button" disabled={locked} onClick={() => adjust(field, 0.1)} aria-label={`Tăng ${SCORE_LABELS[field]} 0,1`}><span className="plus-mark">+</span></button>
                    </div>
                    <button type="button" className="reset-score" disabled={locked || Number(draft[field]) === 0} onClick={() => resetField(field)} title={`Đặt lại ${SCORE_LABELS[field]}`}>
                      <RotateCcw size={14} />
                    </button>
                  </div>
                  <div className="quick-deduct-row">
                    {QUICK_VALUES.map(value => (
                      <button key={value} type="button" className="quick-deduct" disabled={locked} onClick={() => adjust(field, value)}>
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="drawer-section">
            <div className="drawer-section-head">
              <h3>Ghi chú</h3>
              <span className="drawer-hint">Lý do trừ điểm</span>
            </div>
            <textarea
              className="text-area drawer-note"
              value={draft.note}
              disabled={locked}
              rows={3}
              placeholder="Ví dụ: Đi học muộn, không vệ sinh khu vực..."
              onChange={event => setDraft(current => ({ ...current, note: event.target.value }))}
            />
            <div className="note-chips">
              {QUICK_NOTES.map(note => (
                <button
                  key={note}
                  type="button"
                  className="note-chip"
                  disabled={locked}
                  onClick={() => setDraft(current => ({ ...current, note: current.note ? `${current.note}; ${note}` : note }))}
                >
                  <StickyNote size={12} /> {note}
                </button>
              ))}
            </div>
          </section>

          <section className="drawer-summary">
            <div>
              <span>Điểm gốc</span>
              <strong>{formatNum(record.meta.baseScore)}</strong>
            </div>
            <div>
              <span>Tổng trừ</span>
              <strong className="text-danger">{formatNum(Number(draft.hocTap) + Number(draft.renLuyen) + Number(draft.nvvs) + Number(draft.leTiet))}</strong>
            </div>
            <div>
              <span>Điểm hiện tại</span>
              <strong className={localTotal < record.meta.baseScore ? 'text-danger' : 'text-success'}>{formatNum(localTotal)}</strong>
            </div>
            <div>
              <span>Hạng tạm tính</span>
              <strong>#{localRank}</strong>
            </div>
          </section>

          {error ? (
            <div className="inline-alert error"><AlertTriangle size={15} /> {error}</div>
          ) : null}
        </div>

        <footer className="drawer-footer">
          <div className="drawer-nav">
            <button type="button" className="btn btn-ghost" onClick={handlePrev} disabled={!canPrev}>
              <ChevronLeft size={17} /> b trước
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleNext} disabled={!canNext}>
              b sau <ChevronRight size={17} />
            </button>
          </div>
          <div className="drawer-footer-actions">
            <button type="button" className="btn btn-ghost drawer-save-only" onClick={closeWithSave} disabled={locked}>
              <Save size={16} /> Lưu
            </button>
            <button type="button" className="btn btn-primary" onClick={saveAndNext} disabled={locked}>
              {canNext ? 'Lưu &amp; chấm tiếp' : 'Lưu &amp; hoàn tất'} <ChevronRight size={17} />
            </button>
          </div>
        </footer>
      </aside>
    </div>,
    document.body
  );
}
