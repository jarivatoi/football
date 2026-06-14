import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface DeleteMonthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  monthYear: string;
}

const DeleteMonthModal: React.FC<DeleteMonthModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  monthYear
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      // Restore body scroll when modal is closed
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Define functions before using them in modalContent
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        transform: 'translate3d(0, 0, 0)',
      }}
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl"
        onClick={handleModalClick}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Reset {monthYear}?
        </h3>
        <p className="text-gray-600 mb-6">
          This will permanently delete all shifts and data for {monthYear}. This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Reset Month
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};


export { DeleteMonthModal }