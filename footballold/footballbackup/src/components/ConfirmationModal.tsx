import React from 'react';
import { createPortal } from 'react-dom';

type ConfirmationModalProps = {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
};

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div 
      data-test-modal="true"
      style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      overflow: 'auto',
      WebkitOverflowScrolling: 'touch',
      touchAction: 'pan-y'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 24,
        maxWidth: '400px',
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        margin: '16px',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y'
      }}>
        <h3 style={{ 
          marginTop: 0, 
          marginBottom: 16, 
          fontSize: 18, 
          fontWeight: 600,
          color: '#1f2937'
        }}>
          {title}
        </h3>
        <div style={{ 
          marginBottom: 24, 
          color: '#6b7280',
          lineHeight: 1.5
        }}>
          {typeof message === 'string' ? (
            <p style={{ margin: 0 }}>{message}</p>
          ) : (
            message
          )}
        </div>
        <div style={{ 
          display: 'flex', 
          gap: 12, 
          justifyContent: 'flex-end',
          marginTop: '20px'
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              borderRadius: 6,
              border: '2px solid #ef4444',
              background: '#ef4444',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
              minWidth: '100px',
              opacity: 1,
              visibility: 'visible'
            }}
            data-button="cancel"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 20px',
              borderRadius: 6,
              border: 'none',
              background: isDanger ? '#ef4444' : '#2563eb',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
              minWidth: '100px',
              opacity: 1,
              visibility: 'visible'
            }}
            data-button="confirm"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmationModal;
