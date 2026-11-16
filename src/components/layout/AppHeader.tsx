import {
  FileText,
  LayoutDashboard,
  List,
  Moon,
  Settings,
  Shield,
  Sun,
  Table2,
  Users,
  Users2,
  WifiOff,
  Wrench
} from 'lucide-react';
import { useAppStore, type Page } from '../../store/useAppStore';
import { formatTime } from '../../lib/record';

const NAV_ITEMS: Array<{ key: Page; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
  { key: 'list', label: 'Danh sách', icon: List },
  { key: 'table', label: 'Bảng điểm', icon: Table2 },
  { key: 'students', label: 'Sinh viên', icon: Users },
  { key: 'report', label: 'Báo cáo', icon: FileText },
  { key: 'settings', label: 'Cài đặt', icon: Settings }
];

export function AppHeader() {
  const record = useAppStore(state => state.record);
  const courses = useAppStore(state => state.courses);
  const theme = useAppStore(state => state.theme);
  const online = useAppStore(state => state.online);
  const saveState = useAppStore(state => state.saveState);
  const lastSavedAt = useAppStore(state => state.lastSavedAt);
  const page = useAppStore(state => state.page);
  const toolsOpen = useAppStore(state => state.toolsOpen);
  const collabSettings = useAppStore(state => state.collabSettings);
  const collabStatus = useAppStore(state => state.collabStatus);
  const setPage = useAppStore(state => state.setPage);
  const toggleTheme = useAppStore(state => state.toggleTheme);
  const switchCourse = useAppStore(state => state.switchCourse);
  const setToolsOpen = useAppStore(state => state.setToolsOpen);

  const saveLabel = !online
    ? 'Ngoại tuyến'
    : saveState === 'saving'
      ? 'Đang lưu...'
      : saveState === 'error'
        ? 'Chưa lưu được'
        : lastSavedAt
          ? `Đã lưu ${formatTime(lastSavedAt)}`
          : 'Đã lưu';

  return (
    <header className="app-header no-print">
      <div className="header-main">
        <button type="button" className="brand" onClick={() => setPage('overview')} aria-label="Về tổng quan">
          <span className="brand-mark" aria-hidden="true">
            <Shield size={27} strokeWidth={1.7} />
            <span className="brand-star">★</span>
          </span>
          <span className="brand-copy">
            <span className="brand-eyebrow">Hệ thống thi đua GDQP&amp;AN</span>
            <strong className="brand-title">TỔ THI ĐUA</strong>
            <span className="brand-subtitle">{record.meta.courseName} · {record.meta.unitName}</span>
          </span>
        </button>

        <div className="header-actions">
          {collabSettings.enabled ? (
            <span className={`header-chip collab-chip ${collabStatus?.state === 'connected' ? 'ok' : ''}`} title={collabStatus?.message || 'Cộng tác nhóm'}>
              <Users2 size={14} />
              <span>{collabStatus?.users?.length || 1}</span>
            </span>
          ) : null}
          <span className={`header-chip save-chip ${!online || saveState === 'error' ? 'warn' : saveState === 'saving' ? 'saving' : ''}`} title={saveLabel}>
            {!online ? <WifiOff size={14} /> : <span className="save-dot" />}
            <span>{saveLabel}</span>
          </span>
          <button
            type="button"
            className="icon-button theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Bật chế độ sáng' : 'Bật chế độ tối'}
            title={theme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
            aria-pressed={theme === 'dark'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <label className="course-switcher">
            <span>Khóa</span>
            <select
              value={record.meta.id}
              onChange={event => switchCourse(event.target.value)}
              aria-label="Chọn khóa học"
            >
              {courses.length ? courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.courseName}{course.locked ? ' · đã khóa' : ''}
                </option>
              )) : <option value={record.meta.id}>{record.meta.courseName}</option>}
            </select>
          </label>
        </div>
      </div>

      <nav className="app-nav" aria-label="Điều hướng chính">
        <div className="app-nav-track">
          {NAV_ITEMS.slice(0, 4).map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className={`nav-item ${page === item.key ? 'active' : ''}`}
                onClick={() => setPage(item.key)}
                aria-current={page === item.key ? 'page' : undefined}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            className={`nav-item nav-tools ${toolsOpen ? 'active' : ''}`}
            onClick={() => setToolsOpen(!toolsOpen)}
            aria-expanded={toolsOpen}
            aria-haspopup="menu"
          >
            <Wrench size={17} />
            <span>Công cụ</span>
          </button>
          {NAV_ITEMS.slice(4).map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className={`nav-item ${page === item.key ? 'active' : ''}`}
                onClick={() => setPage(item.key)}
                aria-current={page === item.key ? 'page' : undefined}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
