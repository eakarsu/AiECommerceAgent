import { Modal } from './Modal';

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  confirmStyle = 'danger'
}) => {
  const styles = {
    danger: 'btn btn-danger',
    primary: 'btn btn-primary',
    warning: 'bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600'
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-gray-600">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={() => { onConfirm(); onClose(); }} className={styles[confirmStyle] || styles.danger}>
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};
