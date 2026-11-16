import { useEffect, useMemo, useState } from 'react';
import { Download, Pencil, Search, Table2, X } from 'lucide-react';
import { formatNum } from '../../utils';
import {
  selectBuildings,
  selectVisibleItems,
  useAppStore
} from '../../store/useAppStore';
import { exportRecordCSV } from '../../lib/export';
import type { ScoreField } from '../../lib/record';
import { unitCode, unitFull } from '../../lib/units';
import { EmptyState } from '../ui/EmptyState';

function ScoreCell({
  value,
  locked,
  negative,
  onCommit
}: {
  value: number;
  locked: boolean;
  negative: boolean;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(formatNum(value));
  useEffect(() => setDraft(formatNum(value)), [value]);

  return (
    <input
      className={`table-score-input ${negative ? 'negative' : ''}`}
      type="number"
      inputMode="decimal"
      step="0.1"
      value={draft}
      disabled={locked}
      onChange={event => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== formatNum(value)) onCommit(draft);
      }}
      onKeyDown={event => {
        if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
      }}
      aria-label="Điểm trừ"
    />
  );
}

function QuanSoCell({ value, locked, onCommit }: { value: string; locked: boolean; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <input
      className="table-quanso-input"
      type="text"
      inputMode="numeric"
      value={draft}
      disabled={locked}
      placeholder="30/31"
      onChange={event => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={event => {
        if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
      }}
      aria-label="Quân số"
    />
  );
}

export function TablePage() {
  const record = useAppStore(state => state.record);
  const search = useAppStore(state => state.search);
  const building = useAppStore(state => state.building);
  const setSearch = useAppStore(state => state.setSearch);
  const setBuilding = useAppStore(state => state.setBuilding);
  const updateCategory = useAppStore(state => state.updateCategory);
  const updateQuanSo = useAppStore(state => state.updateQuanSo);
  const openGrading = useAppStore(state => state.openGrading);
  const notify = useAppStore(state => state.notify);

  const buildings = useMemo(() => selectBuildings(record), [record]);
  const items = useMemo(() => selectVisibleItems({ record, search, building }), [record, search, building]);
  const locked = record.meta.locked;
  const scoreFields: Array<{ field: ScoreField; label: string }> = [
    { field: 'hocTap', label: 'HT' },
    { field: 'renLuyen', label: 'RL' },
    { field: 'nvvs', label: 'NVVS' },
    { field: 'leTiet', label: 'LT' }
  ];

  return (
    <div className="page-stack table-page">
      <section className="page-heading">
        <div>
          <span className="section-eyebrow">Bảng điểm đầy đủ</span>
          <h1>Bảng điểm thi đua</h1>
          <p>Sửa trực tiếp điểm trừ, quân số và mở phiếu chấm chi tiết. Bảng tự động tính tổng điểm và xếp hạng.</p>
        </div>
        <div className="page-heading-actions">
          <button type="button" className="btn btn-ghost" onClick={() => { exportRecordCSV(record); notify('Đã xuất CSV bảng điểm.', 'success'); }}>
            <Download size={16} /> Xuất CSV
          </button>
        </div>
      </section>

      <section className="filter-panel table-filter-panel">
        <div className="search-box">
          <Search size={18} />
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Tìm b, tòa, phòng..."
            aria-label="Tìm trung đội"
          />
          {search ? (
            <button type="button" className="search-clear" onClick={() => setSearch('')} aria-label="Xóa tìm kiếm">
              <X size={16} />
            </button>
          ) : null}
        </div>
        <div className="building-pills compact">
          <button type="button" className={`building-pill ${building === 'ALL' ? 'active' : ''}`} onClick={() => setBuilding('ALL')}>Tất cả</button>
          {buildings.map(name => (
            <button key={name} type="button" className={`building-pill ${building === name ? 'active' : ''}`} onClick={() => setBuilding(name)}>{name}</button>
          ))}
        </div>
      </section>

      {items.length ? (
        <section className="table-panel">
          <div className="table-scroll">
            <table className="score-table">
              <thead>
                <tr>
                  <th className="col-rank">Hạng</th>
                  <th className="col-id">b</th>
                  <th className="col-id">c</th>
                  <th>Tòa</th>
                  <th>Phòng</th>
                  <th>Quân số</th>
                  {scoreFields.map(column => <th key={column.field} className="col-score">{column.label}</th>)}
                  <th className="col-total">Tổng</th>
                  <th className="col-action" aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className={item.totalScore < record.meta.baseScore ? 'row-negative' : ''}>
                    <td className="col-rank">
                      <span className={`table-rank ${item.rank <= 3 ? `top-${item.rank}` : ''}`}>{item.rank}</span>
                    </td>
                    <td className="col-id"><strong title={unitFull('trungDoi', item.id)}>{unitCode('trungDoi', item.id)}</strong></td>
                    <td className="col-id"><span className="cell-muted" title={item.daiDoi ? unitFull('daiDoi', item.daiDoi) : 'Chưa xếp đại đội'}>{item.daiDoi ? unitCode('daiDoi', item.daiDoi) : '—'}</span></td>
                    <td className="cell-muted">{item.building || '—'}</td>
                    <td className="cell-muted">{item.rooms || '—'}</td>
                    <td>
                      <QuanSoCell value={item.quanSo} locked={locked} onCommit={value => updateQuanSo(item.id, value)} />
                    </td>
                    {scoreFields.map(column => (
                      <td key={column.field} className="col-score">
                        <ScoreCell
                          value={Number(item[column.field] || 0)}
                          locked={locked}
                          negative={Number(item[column.field]) < 0}
                          onCommit={value => updateCategory(item.id, column.field, value)}
                        />
                      </td>
                    ))}
                    <td className="col-total">
                      <strong className={item.totalScore < record.meta.baseScore ? 'text-danger' : 'text-success'}>
                        {formatNum(item.totalScore)}
                      </strong>
                    </td>
                    <td className="col-action">
                      <button type="button" className="icon-button table-edit" onClick={() => openGrading(item.id)} aria-label={`Chấm trung đội ${item.id}`}>
                        {locked ? <span aria-hidden="true">🔒</span> : <Pencil size={16} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-caption">
            <span><Table2 size={14} /> Hiển thị {items.length}/{record.items.length} trung đội</span>
            <span>Điểm gốc: {formatNum(record.meta.baseScore)} · Tự âm: {record.meta.autoNegative ? 'bật' : 'tắt'}</span>
          </div>
        </section>
      ) : (
        <EmptyState
          icon={<Table2 size={28} />}
          title="Không có dữ liệu phù hợp"
          description="Xóa bộ lọc hoặc nhập Excel để bổ sung danh sách trung đội."
          action={<button type="button" className="btn btn-soft" onClick={() => { setSearch(''); setBuilding('ALL'); }}>Xóa bộ lọc</button>}
        />
      )}
    </div>
  );
}
