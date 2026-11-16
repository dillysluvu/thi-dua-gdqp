import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Cloud,
  Database,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  History,
  RotateCcw,
  Settings,
  Share2,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { exportRecordCSV, exportRecordJSON } from '../../lib/export';

function ToolAction({
  icon,
  title,
  description,
  onClick,
  tone = ''
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  tone?: string;
}) {
  return (
    <button type="button" className={`tool-action ${tone}`.trim()} role="menuitem" onClick={onClick}>
      <span className="tool-action-icon">{icon}</span>
      <span className="tool-action-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
    </button>
  );
}

export function ToolsSheet() {
  const open = useAppStore(state => state.toolsOpen);
  const record = useAppStore(state => state.record);
  const setToolsOpen = useAppStore(state => state.setToolsOpen);
  const setPage = useAppStore(state => state.setPage);
  const openModal = useAppStore(state => state.openModal);
  const importBackupFile = useAppStore(state => state.importBackupFile);
  const loadSample = useAppStore(state => state.loadSample);
  const resetScores = useAppStore(state => state.resetScores);
  const confirmAction = useAppStore(state => state.confirmAction);
  const notify = useAppStore(state => state.notify);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setToolsOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('.tools-sheet') || target.closest('.nav-tools')) return;
      setToolsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, setToolsOpen]);

  if (!open) return null;

  const close = () => setToolsOpen(false);
  const run = (action: () => void) => {
    close();
    action();
  };

  const askReset = async () => {
    const ok = await confirmAction({
      title: 'Đặt lại điểm toàn bộ',
      message: `Xóa toàn bộ điểm trừ và ghi chú của ${record.items.length} trung đội?\nDanh sách, tên khóa và ngày chấm được giữ nguyên.`,
      confirmLabel: 'Đặt lại điểm',
      danger: true
    });
    if (ok) run(resetScores);
  };

  const askSample = async () => {
    const ok = await confirmAction({
      title: 'Nạp dữ liệu mẫu K337',
      message: 'Thay điểm hiện tại bằng bộ điểm mẫu K337 để xem thử giao diện? Bạn có thể hoàn tác bằng bản sao lưu tự động.',
      confirmLabel: 'Nạp dữ liệu mẫu'
    });
    if (ok) run(loadSample);
  };

  return createPortal(
    <>
      <div className="tools-backdrop" onClick={close} />
      <div className="tools-sheet" role="menu" aria-label="Công cụ">
        <div className="tools-sheet-handle" aria-hidden="true" />
        <div className="tools-sheet-head">
          <div>
            <span className="section-eyebrow">Trung tâm điều khiển</span>
            <h2>Công cụ</h2>
          </div>
          <button type="button" className="icon-button" onClick={close} aria-label="Đóng công cụ">
            <X size={18} />
          </button>
        </div>

        <div className="tools-scroll">
          <section className="tool-group">
            <h3>Khóa học &amp; dữ liệu</h3>
            <ToolAction icon={<FolderOpen size={19} />} title="Quản lý khóa học" description="Tạo, đổi tên, nhân bản hoặc chuyển khóa" onClick={() => run(() => openModal('courses'))} />
            <ToolAction icon={<FileSpreadsheet size={19} />} title="Nhập Excel / Google Sheets" description="Hỗ trợ .xls, .xlsx, .csv, .tsv và dán dữ liệu" onClick={() => run(() => openModal('importSheet'))} tone="success" />
            <ToolAction icon={<ArrowDownToLine size={19} />} title="Nhập file sao lưu" description="Khôi phục toàn bộ khóa từ file .json" onClick={() => fileRef.current?.click()} />
            <ToolAction icon={<ArrowUpFromLine size={19} />} title="Xuất file sao lưu" description="Tải toàn bộ dữ liệu khóa về máy" onClick={() => run(() => { exportRecordJSON(record); notify('Đã xuất file sao lưu JSON.', 'success'); })} />
            <ToolAction icon={<FileText size={19} />} title="Xuất CSV cho Excel" description="Bảng điểm đầy đủ, mở được bằng Excel" onClick={() => run(() => { exportRecordCSV(record); notify('Đã xuất CSV bảng điểm.', 'success'); })} />
          </section>

          <section className="tool-group">
            <h3>Chia sẻ &amp; an toàn</h3>
            <ToolAction icon={<Database size={19} />} title="Sao lưu &amp; khôi phục" description="Xem các bản sao lưu tự động và thủ công" onClick={() => run(() => openModal('backups'))} />
            <ToolAction icon={<Cloud size={19} />} title="Kết nối chia sẻ" description="Máy chủ riêng hoặc Supabase" onClick={() => run(() => openModal('cloud'))} />
            <ToolAction icon={<Share2 size={19} />} title="Cộng tác nhóm" description="Nhiều người cùng sửa bảng điểm, sinh viên" onClick={() => run(() => openModal('collab'))} />
            <ToolAction icon={<History size={19} />} title="Nhật ký &amp; khóa sổ" description="Theo dõi thay đổi, khóa dữ liệu cuối kỳ" onClick={() => run(() => openModal('audit'))} />
          </section>

          <section className="tool-group">
            <h3>Khác</h3>
            <ToolAction icon={<BookOpen size={19} />} title="Hướng dẫn sử dụng" description="Thao tác nhanh trên điện thoại và máy tính" onClick={() => run(() => openModal('help'))} />
            <ToolAction icon={<Sparkles size={19} />} title="Dữ liệu mẫu K337" description="Nạp điểm mẫu để xem trước giao diện" onClick={askSample} tone="success" />
            <ToolAction icon={<RotateCcw size={19} />} title="Đặt lại điểm toàn bộ" description="Xóa điểm trừ, giữ nguyên danh sách" onClick={askReset} tone="danger" />
          </section>

          <div className="tools-footer">
            <button type="button" className="btn btn-ghost" onClick={() => run(() => setPage('settings'))}>
              <Settings size={16} /> Cài đặt khóa
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => run(() => setPage('report'))}>
              <FileText size={16} /> Mở báo cáo
            </button>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) {
              close();
              await importBackupFile(file);
            }
          }}
        />
        <div className="tools-sheet-footnote">
          <Trash2 size={13} /> Dữ liệu luôn được lưu trên thiết bị trước khi đồng bộ.
        </div>
      </div>
    </>,
    document.body
  );
}
