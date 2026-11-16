import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Modal } from './Modal';

export function ConfirmDialog() {
  const confirm = useAppStore(state => state.confirm);
  const resolve = useAppStore(state => state.resolveConfirm);
  if (!confirm) return null;

  return (
    <Modal
      open
      onClose={() => resolve(false)}
      title={confirm.title}
      size="sm"
      icon={confirm.danger ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={() => resolve(false)}>Hủy</button>
          <button
            type="button"
            className={`btn ${confirm.danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => resolve(true)}
            data-autofocus
            autoFocus
          >
            {confirm.confirmLabel}
          </button>
        </>
      }
    >
      <p className="confirm-message">{confirm.message}</p>
    </Modal>
  );
}
