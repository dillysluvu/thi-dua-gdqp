import { useMemo } from 'react';
import { ClipboardList, Search, SlidersHorizontal, X } from 'lucide-react';
import {
  selectBuildings,
  selectVisibleItems,
  useAppStore
} from '../../store/useAppStore';
import { PlatoonCard } from '../platoons/PlatoonCard';
import { EmptyState } from '../ui/EmptyState';

export function ListPage() {
  const record = useAppStore(state => state.record);
  const search = useAppStore(state => state.search);
  const building = useAppStore(state => state.building);
  const setSearch = useAppStore(state => state.setSearch);
  const setBuilding = useAppStore(state => state.setBuilding);
  const setAutoNegative = useAppStore(state => state.setAutoNegative);
  const openGrading = useAppStore(state => state.openGrading);
  const updateCategory = useAppStore(state => state.updateCategory);

  const buildings = useMemo(() => selectBuildings(record), [record]);
  const items = useMemo(() => selectVisibleItems({ record, search, building }), [record, search, building]);
  const locked = record.meta.locked;

  return (
    <div className="page-stack list-page">
      <section className="page-heading">
        <div>
          <span className="section-eyebrow">Danh sách b · trung đội</span>
          <h1>Bảng theo dõi thi đua</h1>
          <p>Tìm nhanh theo số b, tòa nhà, phòng hoặc ghi chú. Chạm vào thẻ để mở phiếu chấm.</p>
        </div>
        <div className="page-heading-meta">
          <span className="metric-pill"><ClipboardList size={15} /> {items.length}/{record.items.length} trung đội</span>
          <span className={`metric-pill ${record.meta.autoNegative ? 'active' : ''}`}>Tự âm: {record.meta.autoNegative ? 'Bật' : 'Tắt'}</span>
        </div>
      </section>

      <section className="filter-panel">
        <div className="search-box">
          <Search size={18} />
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Tìm b, tòa, phòng, ghi chú..."
            aria-label="Tìm trung đội"
          />
          {search ? (
            <button type="button" className="search-clear" onClick={() => setSearch('')} aria-label="Xóa tìm kiếm">
              <X size={16} />
            </button>
          ) : null}
        </div>
        <div className="filter-actions">
          <button
            type="button"
            className={`toggle-pill ${record.meta.autoNegative ? 'active' : ''}`}
            onClick={() => setAutoNegative(!record.meta.autoNegative)}
            title="Tự động chuyển điểm dương thành điểm trừ"
          >
            <SlidersHorizontal size={15} /> Tự âm (-)
          </button>
        </div>
      </section>

      <div className="building-pills" aria-label="Lọc theo tòa nhà">
        <button type="button" className={`building-pill ${building === 'ALL' ? 'active' : ''}`} onClick={() => setBuilding('ALL')}>
          Tất cả <span>{record.items.length}</span>
        </button>
        {buildings.map(name => {
          const count = record.items.filter(item => item.building === name).length;
          return (
            <button
              key={name}
              type="button"
              className={`building-pill ${building === name ? 'active' : ''}`}
              onClick={() => setBuilding(name)}
            >
              {name} <span>{count}</span>
            </button>
          );
        })}
      </div>

      {items.length ? (
        <div className="platoon-grid">
          {items.map(item => (
            <PlatoonCard
              key={item.id}
              item={item}
              baseScore={record.meta.baseScore}
              locked={locked}
              onGrade={() => openGrading(item.id)}
              onQuickDeduct={(field, value) => updateCategory(item.id, field, value)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Search size={28} />}
          title="Không tìm thấy b phù hợp"
          description="Thử xóa từ khóa hoặc chọn lại tòa nhà để xem toàn bộ danh sách."
          action={(
            <button type="button" className="btn btn-soft" onClick={() => { setSearch(''); setBuilding('ALL'); }}>
              Xóa bộ lọc
            </button>
          )}
        />
      )}
    </div>
  );
}
