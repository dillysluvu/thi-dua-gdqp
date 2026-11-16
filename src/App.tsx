import { useEffect } from 'react';
import { AppHeader } from './components/layout/AppHeader';
import { ToolsSheet } from './components/layout/ToolsSheet';
import { OverviewPage } from './components/pages/OverviewPage';
import { ListPage } from './components/pages/ListPage';
import { TablePage } from './components/pages/TablePage';
import { StudentsPage } from './components/pages/StudentsPage';
import { ReportPage } from './components/pages/ReportPage';
import { SettingsPage } from './components/pages/SettingsPage';
import { GradingDrawer } from './components/grading/GradingDrawer';
import { StudentEditor } from './components/students/StudentEditor';
import { CourseModal } from './components/modals/CourseModal';
import { SheetImportModal } from './components/modals/SheetImportModal';
import { BackupModal } from './components/modals/BackupModal';
import { CloudModal } from './components/modals/CloudModal';
import { CollabModal } from './components/modals/CollabModal';
import { AuditModal } from './components/modals/AuditModal';
import { HelpModal } from './components/modals/HelpModal';
import { ToastHost } from './components/ui/ToastHost';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { useAppStore, type Page } from './store/useAppStore';

const PAGES: Page[] = ['overview', 'list', 'table', 'students', 'report', 'settings'];

function pageFromHash(): Page | null {
  const value = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return PAGES.includes(value as Page) ? value as Page : null;
}

export default function App() {
  const page = useAppStore(state => state.page);
  const record = useAppStore(state => state.record);
  const init = useAppStore(state => state.init);
  const setPage = useAppStore(state => state.setPage);

  useEffect(() => {
    init();
    const initial = pageFromHash();
    if (initial) setPage(initial);
  }, [init, setPage]);

  useEffect(() => {
    const onHashChange = () => {
      const next = pageFromHash();
      if (next && next !== useAppStore.getState().page) setPage(next);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [setPage]);

  useEffect(() => {
    const next = `#/${page}`;
    if (window.location.hash !== next) window.history.replaceState(null, '', next);
  }, [page]);

  useEffect(() => {
    document.title = `${record.meta.courseName} · Thi Đua GDQP&AN`;
  }, [record.meta.courseName]);

  return (
    <>
      <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
      <div className="app-shell">
        <AppHeader />
        <main className="app-main" id="main-content">
          <div className="page-enter" key={page}>
            {page === 'overview' ? <OverviewPage /> : null}
            {page === 'list' ? <ListPage /> : null}
            {page === 'table' ? <TablePage /> : null}
            {page === 'students' ? <StudentsPage /> : null}
            {page === 'report' ? <ReportPage /> : null}
            {page === 'settings' ? <SettingsPage /> : null}
          </div>
        </main>
        <footer className="app-footer no-print">
          <span>Thi Đua GDQP&amp;AN · v4.0.0</span>
          <span>Dữ liệu lưu trên thiết bị · Đồng bộ khi bật chia sẻ</span>
        </footer>
      </div>

      <ToolsSheet />
      <GradingDrawer />
      <StudentEditor />
      <CourseModal />
      <SheetImportModal />
      <BackupModal />
      <CloudModal />
      <CollabModal />
      <AuditModal />
      <HelpModal />
      <ConfirmDialog />
      <ToastHost />
    </>
  );
}
