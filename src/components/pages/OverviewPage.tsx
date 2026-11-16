import { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Building2,
  CheckCircle2,
  ClipboardList,
  DoorOpen,
  FileSpreadsheet,
  FileText,
  Lock,
  Pencil,
  Printer,
  TrendingUp,
  UserPlus,
  Users
} from 'lucide-react';
import { formatNum } from '../../utils';
import {
  selectBuildings,
  selectStats,
  useAppStore
} from '../../store/useAppStore';
import { ScoreRing } from '../ui/ScoreRing';
import { StatCard } from '../ui/StatCard';
import { EmptyState } from '../ui/EmptyState';
import { formatTime } from '../../lib/record';
import { unitCode, unitFull } from '../../lib/units';

export function OverviewPage() {
  const record = useAppStore(state => state.record);
  const openGrading = useAppStore(state => state.openGrading);
  const setPage = useAppStore(state => state.setPage);
  const setBuilding = useAppStore(state => state.setBuilding);
  const openModal = useAppStore(state => state.openModal);
  const openStudentEditor = useAppStore(state => state.openStudentEditor);

  const stats = useMemo(() => selectStats(record), [record]);
  const buildings = useMemo(() => selectBuildings(record), [record]);
  const items = record.items as Array<Record<string, any>>;
  const topItems = useMemo(() => items.slice().sort((a, b) => a.rank - b.rank || a.id - b.id).slice(0, 6), [items]);
  const recentItems = useMemo(() => items
    .filter(item => item.updatedAt)
    .slice()
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, 4), [items]);
  const recentAudit = record.audit.slice(-4).reverse();
  const attendanceRate = stats.total ? Math.round((stats.present / stats.total) * 100) : 0;
  const firstItem = items.slice().sort((a, b) => a.id - b.id)[0];
  const dateText = `${String(record.meta.ngay).padStart(2, '0')}/${String(record.meta.thang).padStart(2, '0')}/${record.meta.nam}`;

  const buildingStats = useMemo(() => buildings.map(building => {
    const list = items.filter(item => item.building === building);
    const average = list.length ? list.reduce((sum, item) => sum + Number(item.totalScore || 0), 0) / list.length : 0;
    return { building, count: list.length, average };
  }), [buildings, items]);

  return (
    <div className="page-stack overview-page">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="section-eyebrow">Trung tâm điều hành thi đua</span>
          <h1>Chào ngày mới,<br /><span>{record.meta.graderName || 'Giảng viên'}.</span></h1>
          <p>
            {record.meta.courseName} · {record.meta.unitName} · Ngày chấm {dateText}
          </p>
          <div className="hero-tags">
            <span className={`status-pill ${record.meta.locked ? 'locked' : 'open'}`}>
              {record.meta.locked ? <Lock size={13} /> : <CheckCircle2 size={13} />}
              {record.meta.locked ? 'Sổ điểm đã khóa' : 'Đang mở chấm điểm'}
            </span>
            <span className="status-pill neutral"><ClipboardList size={13} /> {items.length} trung đội</span>
            <span className="status-pill neutral"><Users size={13} /> {record.students.length} sinh viên</span>
          </div>
          <div className="hero-actions">
            <button type="button" className="btn btn-primary" onClick={() => firstItem && openGrading(firstItem.id)} disabled={!firstItem}>
              <Pencil size={17} /> Chấm điểm
            </button>
            <button type="button" className="btn btn-soft" onClick={() => openModal('importSheet')}>
              <FileSpreadsheet size={17} /> Nhập Excel
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => openStudentEditor()}>
              <UserPlus size={17} /> Thêm sinh viên
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setPage('report')}>
              <Printer size={17} /> In báo cáo
            </button>
          </div>
        </div>
        <div className="hero-decoration" aria-hidden="true">
          <span className="hero-orbit orbit-one" />
          <span className="hero-orbit orbit-two" />
          <span className="hero-star">★</span>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard
          icon={<Users size={21} />}
          label="Tổng quân số"
          value={`${stats.present}/${stats.total}`}
          hint={`Tỷ lệ hiện diện ${attendanceRate}%`}
          tone="blue"
        />
        <StatCard
          icon={<TrendingUp size={21} />}
          label="Điểm TB toàn khóa"
          value={formatNum(stats.average)}
          hint={`Trên thang ${formatNum(record.meta.baseScore)} điểm`}
          tone="green"
        />
        <StatCard
          icon={<Award size={21} />}
          label="Đạt điểm gốc"
          value={stats.perfect}
          hint={`${items.length ? Math.round((stats.perfect / items.length) * 100) : 0}% số trung đội`}
          tone="gold"
        />
        <StatCard
          icon={<AlertTriangle size={21} />}
          label="Bị trừ điểm"
          value={stats.deducted}
          hint={`${items.length ? Math.round((stats.deducted / items.length) * 100) : 0}% số trung đội`}
          tone="red"
        />
      </section>

      <div className="overview-grid">
        <section className="panel ranking-panel">
          <div className="panel-head">
            <div>
              <span className="section-eyebrow">Bảng xếp hạng</span>
              <h2>Dẫn đầu khóa</h2>
            </div>
            <button type="button" className="text-button" onClick={() => setPage('list')}>
              Xem tất cả <ArrowRight size={15} />
            </button>
          </div>
          <div className="ranking-list">
            {topItems.length ? topItems.map(item => (
              <button key={item.id} type="button" className="ranking-row" onClick={() => openGrading(item.id)}>
                <span className={`ranking-number ${item.rank <= 3 ? `top-${item.rank}` : ''}`}>{item.rank}</span>
                <span className="ranking-main">
                  <strong title={unitFull('trungDoi', item.id)}>
                    {unitCode('trungDoi', item.id)}
                    {item.daiDoi ? <small className="unit-company-code" title={unitFull('daiDoi', item.daiDoi)}> · {unitCode('daiDoi', item.daiDoi)}</small> : null}
                  </strong>
                  <span><Building2 size={13} /> {item.building || 'Chưa xếp tòa'} · <DoorOpen size={13} /> {item.rooms || '—'}</span>
                </span>
                <span className="ranking-quan-so">{item.quanSo || '—'}</span>
                <ScoreRing score={item.totalScore} base={record.meta.baseScore} size="sm" />
              </button>
            )) : (
              <EmptyState icon={<ClipboardList size={26} />} title="Chưa có trung đội" description="Nhập Excel hoặc cấu hình danh sách trung đội để bắt đầu." />
            )}
          </div>
        </section>

        <section className="panel building-panel">
          <div className="panel-head">
            <div>
              <span className="section-eyebrow">Theo địa bàn</span>
              <h2>Tòa nhà</h2>
            </div>
          </div>
          <div className="building-list">
            {buildingStats.length ? buildingStats.map(entry => (
              <button
                key={entry.building}
                type="button"
                className="building-row"
                onClick={() => {
                  setBuilding(entry.building);
                  setPage('list');
                }}
              >
                <span className="building-icon"><Building2 size={17} /></span>
                <span className="building-copy">
                  <strong>{entry.building}</strong>
                  <span>{entry.count} trung đội</span>
                </span>
                <span className="building-average">{formatNum(entry.average)}</span>
                <ArrowRight size={15} />
              </button>
            )) : <EmptyState icon={<Building2 size={26} />} title="Chưa có dữ liệu tòa" description="Nhập danh sách trung đội để xem thống kê." />}
          </div>
        </section>
      </div>

      <div className="overview-grid overview-grid-bottom">
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="section-eyebrow">Cập nhật gần đây</span>
              <h2>Trung đội vừa chấm</h2>
            </div>
          </div>
          {recentItems.length ? (
            <div className="recent-list">
              {recentItems.map(item => (
                <button key={item.id} type="button" className="recent-row" onClick={() => openGrading(item.id)}>
                  <span className="recent-dot" />
                  <span className="recent-copy">
                    <strong title={unitFull('trungDoi', item.id)}>{unitCode('trungDoi', item.id)}{item.daiDoi ? ` · ${unitCode('daiDoi', item.daiDoi)}` : ''} · {item.building || 'Chưa xếp tòa'}</strong>
                    <span>{item.note || `${formatNum(item.totalScore)} điểm`} {item.updatedAt ? `· ${formatTime(item.updatedAt)}` : ''}</span>
                  </span>
                  <span className={`recent-score ${item.totalScore < record.meta.baseScore ? 'negative' : ''}`}>{formatNum(item.totalScore)}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Pencil size={26} />} title="Chưa có lần chấm nào" description="Mở một trung đội và ghi điểm trừ để bắt đầu." />
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="section-eyebrow">Nhật ký</span>
              <h2>Hoạt động gần đây</h2>
            </div>
            <button type="button" className="text-button" onClick={() => openModal('audit')}>
              Nhật ký <ArrowRight size={15} />
            </button>
          </div>
          {recentAudit.length ? (
            <div className="activity-list">
              {recentAudit.map(entry => (
                <div key={entry.id} className="activity-row">
                  <span className="activity-icon"><FileText size={14} /></span>
                  <span className="activity-copy">
                    <strong>{entry.action}</strong>
                    <span>{entry.detail}</span>
                  </span>
                  <span className="activity-time">{formatTime(entry.at)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<FileText size={26} />} title="Chưa có nhật ký" description="Mọi thay đổi điểm và sinh viên sẽ được ghi lại tại đây." />
          )}
        </section>
      </div>
    </div>
  );
}
