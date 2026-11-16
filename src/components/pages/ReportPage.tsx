import { useMemo } from 'react';
import { Award, Building2, CalendarDays, FileText, Printer, Users } from 'lucide-react';
import { formatNum } from '../../utils';
import { selectStats, useAppStore } from '../../store/useAppStore';
import { formatShortDate } from '../../lib/record';
import { unitCode, unitFull } from '../../lib/units';

export function ReportPage() {
  const record = useAppStore(state => state.record);
  const notify = useAppStore(state => state.notify);
  const stats = useMemo(() => selectStats(record), [record]);
  const items = useMemo(() => (record.items as any[]).slice().sort((a, b) => a.rank - b.rank || a.id - b.id), [record.items]);
  const dateText = `${String(record.meta.ngay).padStart(2, '0')}/${String(record.meta.thang).padStart(2, '0')}/${record.meta.nam}`;

  const print = () => {
    notify('Đang mở hộp thoại in. Chọn “Lưu dưới dạng PDF” nếu cần gửi báo cáo.', 'info');
    window.setTimeout(() => window.print(), 180);
  };

  return (
    <div className="page-stack report-page">
      <section className="page-heading no-print">
        <div>
          <span className="section-eyebrow">Báo cáo tổng hợp</span>
          <h1>Báo cáo thi đua</h1>
          <p>Bản in được tối ưu cho khổ A4. Có thể in trực tiếp hoặc lưu thành PDF để gửi báo cáo.</p>
        </div>
        <div className="page-heading-actions">
          <button type="button" className="btn btn-primary" onClick={print}>
            <Printer size={17} /> In / Lưu PDF
          </button>
        </div>
      </section>

      <article className="report-sheet">
        <header className="report-head">
          <div className="report-emblem" aria-hidden="true">★</div>
          <div className="report-heading">
            <span>{record.meta.unitName}</span>
            <h2>BÁO CÁO THI ĐUA GDQP&amp;AN</h2>
            <p>{record.meta.courseName}</p>
          </div>
          <div className="report-date">
            <CalendarDays size={15} />
            <span>Ngày {dateText}</span>
          </div>
        </header>

        <div className="report-meta-grid">
          <div><span>Đơn vị</span><strong>{record.meta.unitName}</strong></div>
          <div><span>Khóa học</span><strong>{record.meta.courseName}</strong></div>
          <div><span>Người lập</span><strong>{record.meta.graderName}</strong></div>
          <div><span>Điểm gốc</span><strong>{formatNum(record.meta.baseScore)} điểm</strong></div>
          <div><span>Tổng quân số</span><strong>{stats.present}/{stats.total}</strong></div>
          <div><span>Điểm trung bình</span><strong>{formatNum(stats.average)}</strong></div>
          <div><span>Đạt điểm gốc</span><strong>{stats.perfect} trung đội</strong></div>
          <div><span>Bị trừ điểm</span><strong>{stats.deducted} trung đội</strong></div>
        </div>

        <div className="report-summary-row">
          <div className="report-summary-item">
            <Award size={18} />
            <span>Đơn vị dẫn đầu</span>
            <strong>{items[0] ? `${unitCode('trungDoi', items[0].id)}${items[0].daiDoi ? ` · ${unitCode('daiDoi', items[0].daiDoi)}` : ''} · ${formatNum(items[0].totalScore)} điểm` : '—'}</strong>
          </div>
          <div className="report-summary-item">
            <Building2 size={18} />
            <span>Số tòa nhà</span>
            <strong>{new Set(record.items.map((item: any) => item.building).filter(Boolean)).size}</strong>
          </div>
          <div className="report-summary-item">
            <Users size={18} />
            <span>Sinh viên</span>
            <strong>{record.students.length}</strong>
          </div>
          <div className="report-summary-item">
            <FileText size={18} />
            <span>Cập nhật lần cuối</span>
            <strong>{formatShortDate(record.savedAt)}</strong>
          </div>
        </div>

        <div className="report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>Hạng</th>
                <th>b</th>
                <th>c</th>
                <th>Tòa</th>
                <th>Phòng</th>
                <th>Quân số</th>
                <th>HT</th>
                <th>RL</th>
                <th>NVVS</th>
                <th>LT</th>
                <th>Tổng</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className={item.rank <= 3 ? `report-top-${item.rank}` : ''}>
                  <td className="center"><strong>{item.rank}</strong></td>
                  <td className="center"><strong title={unitFull('trungDoi', item.id)}>{unitCode('trungDoi', item.id)}</strong></td>
                  <td className="center" title={item.daiDoi ? unitFull('daiDoi', item.daiDoi) : 'Chưa xếp đại đội'}>{item.daiDoi ? unitCode('daiDoi', item.daiDoi) : '—'}</td>
                  <td>{item.building || '—'}</td>
                  <td>{item.rooms || '—'}</td>
                  <td className="center">{item.quanSo || '—'}</td>
                  <td className="center">{formatNum(item.hocTap)}</td>
                  <td className="center">{formatNum(item.renLuyen)}</td>
                  <td className="center">{formatNum(item.nvvs)}</td>
                  <td className="center">{formatNum(item.leTiet)}</td>
                  <td className="center"><strong>{formatNum(item.totalScore)}</strong></td>
                  <td className="report-note">{item.note || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="report-footer">
          <div>
            <span>Người lập bảng</span>
            <strong>{record.meta.graderName}</strong>
            <em>(Ký, ghi rõ họ tên)</em>
          </div>
          <div>
            <span>Xác nhận của đơn vị</span>
            <strong>&nbsp;</strong>
            <em>(Ký, ghi rõ họ tên)</em>
          </div>
        </footer>
        <p className="report-footnote">Báo cáo được tạo từ hệ thống Thi Đua GDQP&amp;AN · {formatShortDate(new Date().toISOString())}</p>
      </article>
    </div>
  );
}
