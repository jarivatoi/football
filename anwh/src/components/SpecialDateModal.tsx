import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Star, Calendar, FileText, AlertTriangle } from 'lucide-react';
import { updateAllStaffRemarksForDate } from '../utils/rosterApi';
import { validatePasscode } from '../utils/passcodeAuth';

interface SpecialDateModalProps {
  isOpen: boolean;
  date: string | null;
  currentSpecialInfo?: { isSpecial: boolean; info: string };
  onSave: (isSpecial: boolean, info: string) => Promise<void>;
  onClose: () => void;
  authCode?: string;
}

export const SpecialDateModal: React.FC<SpecialDateModalProps> = ({
  isOpen,
  date,
  currentSpecialInfo,
  onSave,
  onClose,
  authCode
}) => {
  const [isSpecial, setIsSpecial] = useState(false);
  const [info, setInfo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Initialize state when modal opens
  useEffect(() => {
    if (isOpen && currentSpecialInfo) {
      setIsSpecial(currentSpecialInfo.isSpecial);
      setInfo(currentSpecialInfo.info || '');
    } else if (isOpen) {
      setIsSpecial(false);
      setInfo('');
    }
  }, [isOpen]); // Only re-run when modal opens, not when currentSpecialInfo changes

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
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !date) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    const dayName = dayNames[date.getDay()];
    const day = date.getDate();
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    
    return `${dayName}, ${month} ${day}, ${year}`;
  };

  const handleSave = () => {
    if (isSaving) return;
    
    setIsSaving(true);
    setSaveError(null);
    
    onSave(isSpecial, isSpecial ? info : '') // Clear info when removing special status
      .then(() => {
        onClose();
      })
      .catch((error) => {
        console.error('Failed to save special date:', error);
        setSaveError(error instanceof Error ? error.message : 'Failed to save special date');
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      e.stopPropagation();
      onClose();
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y'
      }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full"
        style={{ 
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-6 pb-4 border-b border-gray-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors duration-200"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isSpecial ? 'bg-red-100' : 'bg-blue-100'
            }`}>
              <Star className={`w-6 h-6 ${isSpecial ? 'text-red-600' : 'text-blue-600'}`} />
            </div>
          </div>

          <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
            Mark Special Date
          </h3>
          
          <div className="flex items-center justify-center space-x-2 text-gray-600">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">{formatDate(date)}</span>
          </div>
        </div>

        {/* Content */}
        <div 
          className="flex-1 overflow-y-auto p-6"
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y'
          }}
        >
          <div className="space-y-6">
            {saveError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-red-700">{saveError}</span>
                </div>
              </div>
            )}
            
            {/* Special Date Toggle */}
            <div className="flex items-center justify-center space-x-3 p-4 bg-gray-50 rounded-lg">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSpecial}
                  onChange={(e) => {
                    e.stopPropagation();
                    setIsSpecial(e.target.checked);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="w-5 h-5 text-red-600 focus:ring-red-500 focus:ring-2 rounded"
                />
                <span className="text-lg font-medium text-gray-800">
                  Mark as Special Date
                </span>
              </label>
            </div>

            {/* Info about special dates */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-blue-800 mb-2">Special Date Effects:</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Date will appear red and pulsating in the table</li>
                    <li>• Info text will be added to all staff remarks for this date</li>
                    <li>• Helps identify important dates (holidays, events, etc.)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Info Field - Only show when special is checked */}
            {isSpecial && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="w-4 h-4 inline mr-2" />
                  Special Date Information
                </label>
                <textarea
                  value={info}
                  onChange={(e) => setInfo(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                  rows={5}
                  placeholder="Enter information about this special date (e.g., 'Public Holiday - Independence Day')"
                  maxLength={200}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {info.length}/200 characters • This will be added to all staff remarks for this date
                </div>
              </div>
            )}

            {/* Preview */}
            {isSpecial && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-medium text-red-800 mb-2">Preview:</h4>
                <div className="text-sm text-red-700">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-4 h-4 bg-red-500 rounded animate-pulse" />
                    <span className="font-medium">{formatDate(date)} - Special Date</span>
                  </div>
                  {info && (
                    <div className="bg-white p-2 rounded border">
                      <span className="text-gray-700">Staff remarks: "{info}"</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 flex-shrink-0">
          <div className="flex space-x-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              disabled={isSaving}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSave();
              }}
              disabled={isSaving}
              className={`flex-1 px-4 py-3 ${
                isSpecial ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
              } text-white rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 flex items-center justify-center space-x-2`}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Star className="w-4 h-4" />
                  <span>{isSpecial ? 'Mark Special' : 'Remove Special'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};