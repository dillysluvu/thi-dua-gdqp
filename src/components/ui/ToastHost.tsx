import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export function ToastHost() {
  const toast = useAppStore(state => state.toast);
  const dismiss = useAppStore(state => state.dismissToast);
  if (!toast) return null;

  const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? AlertTriangle : Info;

  return (
    <div className={`toast toast-${toast.tone}`} role="status" aria-live="polite">
      <span className="toast-icon"><Icon size={19} /></span>
      <span className="toast-message">{toast.message}</span>
      {toast.action ? (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            const action = toast.action;
            dismiss();
            action?.run();
          }}
        >
          {toast.action.label}
        </button>
      ) : null}
      <button type="button" className="toast-close" onClick={dismiss} aria-label="Đóng thông báo">
        <X size={16} />
      </button>
    </div>
  );
}
