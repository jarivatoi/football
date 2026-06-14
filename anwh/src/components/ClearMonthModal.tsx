import React, { useEffect, useState } from 'react';
import { X, Trash2, Calendar, AlertTriangle } from 'lucide-react';

interface ClearMonthModalProps {
  isOpen: boolean;
  selectedMonth: number;
  selectedYear: number;
  onConfirm: (year: number, month: number) => Promise<void>;
  onCancel: () => void;
}

export const ClearMonthModal: React.FC<ClearMonthModalProps> = ({
  isOpen,
  selectedMonth,
  selectedYear,
  onConfirm,
  onCancel
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = '0';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.bottom = '0';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.bottom = '';
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, isLoading, onCancel]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthYearDisplay = `${monthNames[selectedMonth]} ${selectedYear}`;

  const handleConfirm = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      await onConfirm(selectedYear, selectedMonth);
      onCancel(); // Close modal on success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear month');
      setIsLoading(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onCancel();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]"
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999
      }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full select-none"
        style={{ 
          userSelect: 'none', 
          WebkitUserSelect: 'none'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-6 pb-4 border-b border-gray-200">
          {!isLoading && (
            <button
              onClick={onCancel}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
          </div>

          <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
            Clear Month
          </h3>
          
          <div className="flex items-center justify-center space-x-2 text-gray-600">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">{monthYearDisplay}</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            </div>
          )}

          <div className="text-center mb-6">
            <p className="text-gray-700 mb-4">
              This will clear all shifts for <strong>{monthYearDisplay}</strong>. This action cannot be undone.
            </p>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm text-red-800 font-medium mb-2">
                    This will permanently delete:
                  </p>
                  <ul className="text-sm text-red-700 space-y-1">
                    <li>• All scheduled shifts for the month</li>
                    <li>• All special date markings</li>
                    <li>• All notes added to dates</li>
                    <li>• All shift combinations and data</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Clearing...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Clear All</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};