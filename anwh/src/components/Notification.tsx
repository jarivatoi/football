import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

interface NotificationProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
}

export const Notification: React.FC<NotificationProps> = ({
  message,
  type = 'success',
  duration = 4000,
  onClose
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-600" />;
      case 'info':
        return <AlertCircle className="w-6 h-6 text-blue-600" />;
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return 'border-green-200';
      case 'error':
        return 'border-red-200';
      case 'info':
        return 'border-blue-200';
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50';
      case 'error':
        return 'bg-red-50';
      case 'info':
        return 'bg-blue-50';
    }
  };

  const getTextColor = () => {
    switch (type) {
      case 'success':
        return 'text-green-800';
      case 'error':
        return 'text-red-800';
      case 'info':
        return 'text-blue-800';
    }
  };

  return createPortal(
    <div
      className="fixed top-4 right-4 z-[100000] animate-slide-in-top"
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 100000,
        animation: 'slideInTop 0.3s ease-out',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
    >
      <div
        className={`flex items-center space-x-3 px-6 py-4 rounded-lg shadow-2xl border-2 ${getBorderColor()} ${getBackgroundColor()}`}
        style={{
          minWidth: '320px',
          maxWidth: '500px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
      >
        {getIcon()}
        <p className={`flex-1 font-medium ${getTextColor()}`} style={{ margin: 0 }}>
          {message}
        </p>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 rounded transition-colors duration-200"
          style={{ touchAction: 'manipulation' }}
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <style>{`
        @keyframes slideInTop {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>,
    document.body
  );
};
