import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Calendar, AlertTriangle } from 'lucide-react';

interface ClearDateModalProps {
  isOpen: boolean;
  selectedDate: string | null;
  schedule: Record<string, string[]>;
  specialDates: Record<string, boolean>;
  dateNotes?: Record<string, string>;
  onConfirm: (dateKey: string) => Promise<void>;
  onCancel: () => void;
}

export const ClearDateModal: React.FC<ClearDateModalProps> = ({
  isOpen,
  selectedDate,
  schedule,
  specialDates,
  dateNotes = {},
  onConfirm,
  onCancel
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prevent body scroll when modal is open - CRITICAL for iOS
  useEffect(() => {
    if (isOpen) {
      console.log('📱 ClearDateModal: Opening modal, locking body scroll');
      const originalStyle = window.getComputedStyle(document.body).overflow;
      const originalPosition = window.getComputedStyle(document.body).position;
      const originalTop = window.getComputedStyle(document.body).top;
      
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = '0';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.bottom = '0';
      
      return () => {
        console.log('📱 ClearDateModal: Closing modal, restoring body scroll');
        document.body.style.overflow = originalStyle;
        document.body.style.position = originalPosition;
        document.body.style.top = originalTop;
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.bottom = '';
      };
    }
  }, [isOpen]);

  // Close on escape key - EXACTLY LIKE SHIFT MODAL
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

  if (!isOpen || !selectedDate) return null;

  // Close modal when clicking outside - moved before modalContent
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onCancel();
    }
  };

  // Format date for display
  const formatDateDisplay = (dateString: string) => {
    const date = new Date(dateString);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    const dayName = dayNames[date.getDay()];
    const day = date.getDate();
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    
    return `${dayName}, ${month} ${day}, ${year}`;
  };

  const handleConfirm = async () => {
    if (!selectedDate || isLoading) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      await onConfirm(selectedDate);
      onCancel(); // Close modal on success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear date');
      setIsLoading(false);
    }
  };

  // Get content summary for display
  const getContentSummary = () => {
    const shifts = schedule[selectedDate] || [];
    const isSpecial = specialDates[selectedDate] === true;
    const note = dateNotes[selectedDate] || '';
    
    const items = [];
    if (shifts.length > 0) {
      items.push(`${shifts.length} shift${shifts.length !== 1 ? 's' : ''}`);
    }
    if (isSpecial) {
      items.push('special date marking');
    }
    if (note && note.trim() !== '') {
      items.push('note');
    }
    
    return items.join(' and ');
  };

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        // CRITICAL: Enable touch scrolling on the backdrop - EXACTLY LIKE SHIFT MODAL
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
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full my-8 select-none" 
        style={{ 
          userSelect: 'none', 
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          marginTop: window.innerWidth > window.innerHeight ? '2px' : '2rem',
          marginBottom: window.innerWidth > window.innerHeight ? '2px' : '2rem',
          maxWidth: window.innerWidth > window.innerHeight ? '95vw' : '28rem',
          maxHeight: window.innerWidth > window.innerHeight ? '98vh' : 'none'
        }}
        onClick={(e) => {
          // Prevent modal from closing when clicking inside - EXACTLY LIKE SHIFT MODAL
          e.stopPropagation();
        }}
      >
        {/* Header with close button - EXACTLY LIKE SHIFT MODAL */}
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
            Clear Date
          </h3>
          
          <div className="flex items-center justify-center space-x-2 text-gray-600">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">{formatDateDisplay(selectedDate)}</span>
          </div>
        </div>

        {/* Scrollable content with ENHANCED TOUCH SUPPORT - EXACTLY LIKE SHIFT MODAL */}
        <div 
          className="overflow-y-auto flex-1"
          style={{
            // CRITICAL: Enable smooth touch scrolling - EXACTLY LIKE SHIFT MODAL
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y', // Allow vertical panning (scrolling)
            overscrollBehavior: 'contain', // Prevent scroll chaining to parent
            maxHeight: window.innerWidth > window.innerHeight ? 'calc(98vh - 100px)' : '70vh',
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

          {/* Content Summary */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-2 text-center">Content to be cleared:</h4>
            <p className="text-sm text-gray-700 text-center">
              {getContentSummary()}
            </p>
          </div>

          <div className="text-center mb-6">
            <p className="text-gray-700 mb-4">
              Are you sure you want to clear all content for <strong>{formatDateDisplay(selectedDate)}</strong>?
            </p>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center justify-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-amber-800 font-medium">
                  This action cannot be undone
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
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
                  <span>Clear</span>
                </>
              )}
            </button>
          </div>

          {/* Add extra padding at bottom to ensure all content is accessible - EXACTLY LIKE SHIFT MODAL */}
          <div className="h-8" />
        </div>
      </div>
    </div>
  );

  // Use createPortal to render modal at document root level
  return createPortal(modalContent, document.body);
};