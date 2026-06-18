import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Calendar, AlertTriangle, Clock } from 'lucide-react';

interface MonthData {
  month: number;
  year: number;
  totalShifts: number;
  totalAmount: number;
}

interface MonthClearModalProps {
  isOpen: boolean;
  monthData: MonthData | null;
  onConfirm: (month: number, year: number) => Promise<void>;
  onCancel: () => void;
}

export const MonthClearModal: React.FC<MonthClearModalProps> = ({
  isOpen,
  monthData,
  onConfirm,
  onCancel
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationText, setConfirmationText] = useState('');

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

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
      setConfirmationText('');
    }
  }, [isOpen]);

  // Early return if modal should not be shown
  if (!isOpen || !monthData) return null;

  const monthYearDisplay = `${monthNames[monthData.month]} ${monthData.year}`;
  const expectedConfirmation = monthYearDisplay.toUpperCase();
  const isConfirmationValid = confirmationText.toUpperCase() === expectedConfirmation;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onCancel();
    }
  };

  const handleConfirm = async () => {
    if (!isConfirmationValid || isLoading) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      await onConfirm(monthData.year, monthData.month);
      onCancel(); // Close modal on success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear month data');
      setIsLoading(false);
    }
  };

  // Modal content JSX
  const modalContent = (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[99999]"
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        // CRITICAL: Enable touch scrolling on the backdrop
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y', // Allow vertical panning (scrolling)
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: window.innerWidth > window.innerHeight ? '4px' : '16px',
        paddingTop: window.innerWidth > window.innerHeight ? '2px' : '16px'
      }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full my-4 select-none"
        style={{ 
          userSelect: 'none', 
          WebkitUserSelect: 'none',
          maxHeight: window.innerWidth > window.innerHeight ? '98vh' : '90vh',
          maxWidth: window.innerWidth > window.innerHeight ? '95vw' : '28rem',
          display: 'flex',
          flexDirection: 'column',
          margin: window.innerWidth > window.innerHeight ? '2px 0' : '16px 0'
        }}
        onClick={(e) => {
          // Prevent modal from closing when clicking inside
          e.stopPropagation();
        }}
      >
        {/* Header - Fixed */}
        <div className="relative pb-4 border-b border-gray-200 flex-shrink-0" style={{
          padding: window.innerWidth > window.innerHeight ? '8px' : '24px'
        }}>
          {!isLoading && (
            <button
              onClick={onCancel}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors duration-200 select-none"
              style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
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
            Clear Entire Month
          </h3>
          
          <div className="flex items-center justify-center space-x-2 text-gray-600">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">{monthYearDisplay}</span>
          </div>
        </div>

        {/* Scrollable content - Flexible */}
        <div 
          className="overflow-y-auto flex-1"
          style={{
            // CRITICAL: Enable smooth touch scrolling
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y', // Allow vertical panning (scrolling)
            overscrollBehavior: 'contain',
            padding: window.innerWidth > window.innerHeight ? '8px' : '24px'
          }}
        >
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            </div>
          )}

          {/* Month Statistics */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-3 text-center">Month Summary</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-center">
                <div className="text-gray-600">Total Shifts</div>
                <div className="font-bold text-gray-900">{monthData.totalShifts}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-600">Total Amount</div>
                <div className="font-bold text-gray-900">Rs {monthData.totalAmount.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm text-red-800 font-medium mb-2">
                  This action will permanently delete:
                </p>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>• All scheduled shifts for {monthYearDisplay}</li>
                  <li>• All special date markings</li>
                  <li>• All shift combinations and data</li>
                  <li>• All calculated amounts and totals</li>
                </ul>
                <p className="text-sm text-red-800 font-medium mt-3">
                  This action cannot be undone!
                </p>
              </div>
            </div>
          </div>

          {/* Confirmation Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type <span className="font-bold text-red-600">{expectedConfirmation}</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder={expectedConfirmation}
            />
            {confirmationText && !isConfirmationValid && (
              <p className="text-sm text-red-600 mt-1">
                Please type the exact text: {expectedConfirmation}
              </p>
            )}
          </div>

          {/* Long-press info */}

          {/* Add extra padding at bottom to ensure all content is accessible */}
          <div className="h-20" />
        </div>

        {/* Action Buttons - Fixed at bottom */}
        <div className="flex-shrink-0 pt-0" style={{
          padding: window.innerWidth > window.innerHeight ? '8px' : '24px'
        }}>
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
              disabled={isLoading || !isConfirmationValid}
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
                  <span>Clear Month</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Use createPortal to render modal at document root level
  return createPortal(modalContent, document.body);
};