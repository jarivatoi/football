import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Calendar, User, Clock, CheckCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { validatePasscode } from '../utils/passcodeAuth';
import { fetchRosterEntries } from '../utils/rosterApi';
import { calendarExportManager, ExportResult } from '../utils/calendarExport';
import { getUserSession } from '../utils/indexedDB';
import { supabase } from '../lib/supabase';

interface CalendarExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMonth: number;
  currentYear: number;
}

export const CalendarExportModal: React.FC<CalendarExportModalProps> = ({
  isOpen,
  onClose,
  currentMonth,
  currentYear
}) => {
  const [authCode, setAuthCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [step, setStep] = useState<'auth' | 'exporting' | 'result'>('auth');
  const [showPassword, setShowPassword] = useState(false);

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
      if (e.key === 'Escape' && isOpen && !isExporting) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, isExporting]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setAuthCode('');
      setAuthError('');
      setIsExporting(false);
      setExportResult(null);
      setStep('auth');
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isExporting) return;
    onClose();
  };

  const handleExport = async () => {
    if (!authCode || authCode.length < 4) {
      setAuthError('Please enter your authentication code');
      return;
    }

    // FIRST: Get the currently logged-in user from session
    const session = await getUserSession();
    
    if (!session) {
      setAuthError('No active session found. Please log in first.');
      return;
    }
    
    // SECOND: Validate passcode and ensure it belongs to the logged-in user
    const passcodeResult = await validatePasscode(authCode);
    
    if (!passcodeResult || !passcodeResult.isValid) {
      setAuthError('Invalid passcode');
      return;
    }
    
    // With duplicate passcodes allowed, we need to verify the passcode
    // belongs to the logged-in user by checking their staff record
    // The validatePasscode returns first match, so we need additional verification
    const { data: userData } = await supabase
      .from('staff_users')
      .select('passcode')
      .eq('id', session.userId)
      .single();
    
    if (!userData || userData.passcode !== authCode) {
      setAuthError('Invalid passcode');
      return;
    }
    
    // Use the LOGGED-IN USER's details for roster matching
    const authenticatedStaffName = `${session.surname}, ${session.name}`;
    const authenticatedSurname = session.surname;
    const authenticatedIdNumber = session.idNumber; // Use ID number for unique matching
    const isAdmin = session.isAdmin;

    setIsExporting(true);
    setStep('exporting');
    setAuthError('');

    try {
      // Fetch all roster entries
      const allEntries = await fetchRosterEntries();
      
      // Build the expected roster_display_name format: SURNAME_IDNUMBER
      const expectedRosterName = `${(authenticatedSurname || '').toUpperCase()}_${(authenticatedIdNumber || '').toUpperCase()}`;
      
      // Filter entries - For ADMIN, show all entries; for others, only their own
      const staffEntries = allEntries.filter(entry => {
        const entryDate = new Date(entry.date);
        const isCorrectMonth = entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear;
        
        if (!isCorrectMonth) return false;
        
        // If user is ADMIN, include all entries
        if (authenticatedStaffName === 'ADMIN') {
          return true;
        }
        
        // For regular users, match by ID-based roster_display_name
        // Format: SURNAME_IDNUMBER or SURNAME_(Name)_IDNUMBER
        // We need to check if the entry's assigned_name starts with SURNAME_ and ends with _IDNUMBER
        const entryAssignedName = entry.assigned_name.trim().toUpperCase();
        
        // Simple approach: Check if assigned_name contains both surname and ID number
        const hasSurname = entryAssignedName.startsWith(`${(authenticatedSurname || '').toUpperCase()}_`);
        const hasIdNumber = entryAssignedName.endsWith(`_${(authenticatedIdNumber || '').toUpperCase()}`);
        
        // Also handle (R) variants - strip (R) before comparison
        const entryWithoutR = entryAssignedName.replace('(R)', '');
        const expectedWithoutR = expectedRosterName.replace('(R)', '');
        const exactMatch = entryWithoutR === expectedWithoutR;
        
        const matches = exactMatch || (hasSurname && hasIdNumber);
        
        return matches;
      });
      
      if (staffEntries.length === 0) {
        setExportResult({
          success: false,
          filename: '',
          entriesExported: 0,
          errors: [`No shifts found for ${authenticatedStaffName} in ${formatMonthYear()}`]
        });
        setStep('result');
        return;
      }
      
      // Now convert to calendar format and update the calendar
      const calendarUpdates: Record<string, string[]> = {};
      const specialDateUpdates: Record<string, boolean> = {};
      
      // First, check for special dates in ALL entries (not just staff entries)
      allEntries.forEach(entry => {
        if (entry.change_description && entry.change_description.includes('Special Date:')) {
          const match = entry.change_description.match(/Special Date:\s*([^;]+)/);
          if (match && match[1].trim()) {
            specialDateUpdates[entry.date] = true;
          }
        }
      });
      
      staffEntries.forEach(entry => {
        const date = entry.date;
        
        // Map roster shift types to calendar shift IDs
        // Support both legacy full names AND modern shift IDs
        const shiftMapping: Record<string, string> = {
          'Morning Shift (9-4)': '9-4',
          'Evening Shift (4-10)': '4-10',
          'Saturday Regular (12-10)': '12-10',
          'Night Duty': 'N',
          'Sunday/Public Holiday/Special': '9-4'
        };
        
        // First check if it's already a shift ID (modern format)
        const validShiftIds = ['9-4', '4-10', '12-10', 'N'];
        let calendarShiftId: string | null = null;
        
        if (validShiftIds.includes(entry.shift_type)) {
          // Already in correct format
          calendarShiftId = entry.shift_type;
        } else if (shiftMapping[entry.shift_type]) {
          // Legacy format - convert to shift ID
          calendarShiftId = shiftMapping[entry.shift_type];
        }
        
        if (calendarShiftId) {
          if (!calendarUpdates[date]) {
            calendarUpdates[date] = [];
          }
          
          // Check if this base shift ID already exists (prevent duplicates)
          // Since manual shifts now also have staff suffix, we need to check base ID
          const existingShifts = calendarUpdates[date];
          const hasBaseShift = existingShifts.some((existingShift: string) => {
            const parts = existingShift.split('-');
            if (parts.length >= 2 && parts[0].match(/^\d+$/) && parts[1].match(/^\d+$/)) {
              // Format like '9-4' or '9-4-NARAYYA'
              const baseId = `${parts[0]}-${parts[1]}`;
              return baseId === calendarShiftId;
            }
            // Simple format like 'N' or 'N-NARAYYA'
            if (parts.length > 1) {
              return parts[0] === calendarShiftId;
            }
            return existingShift === calendarShiftId;
          });
          
          if (!hasBaseShift) {
            // Create unique shift ID by combining shift type + staff name
            // This ensures both NARAYYA and NARAYYA(R) can have shifts on the same date
            const uniqueShiftId = `${calendarShiftId}-${entry.assigned_name.replace(/[^a-zA-Z0-9]/g, '')}`;
            calendarUpdates[date].push(uniqueShiftId);
          }
          
          // Check if this shift requires special date marking
          const dateObj = new Date(date);
          const dayOfWeek = dateObj.getDay();
          
          if ((dayOfWeek === 6 && entry.shift_type === 'Morning Shift (9-4)') || // Saturday with 9-4
              (dayOfWeek >= 1 && dayOfWeek <= 5 && entry.shift_type === 'Morning Shift (9-4)')) { // Weekday with 9-4
            specialDateUpdates[date] = true;
          }
        }
      });
      
      // Dispatch bulk update event to App.tsx
      window.dispatchEvent(new CustomEvent('bulkCalendarUpdate', {
        detail: {
          calendarUpdates,
          specialDateUpdates,
          editorName: authenticatedStaffName,
          source: 'calendar_export',
          entries: allEntries // Pass ALL entries for special date checking
        }
      }));
      
      // Show success - NO file download needed
      setExportResult({
        success: true,
        filename: '',
        entriesExported: staffEntries.length,
        errors: []
      });
      setStep('result');
    } catch (error) {
      setExportResult({
        success: false,
        filename: '',
        entriesExported: 0,
        errors: [error instanceof Error ? error.message : 'Unknown export error']
      });
      setStep('result');
    } finally {
      setIsExporting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isExporting) {
      handleClose();
    }
  };

  const formatMonthYear = () => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[currentMonth]} ${currentYear}`;
  };

  if (!isOpen) return null;

  const modalContent = (
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
        touchAction: 'pan-y',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        padding: '0'
      }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full select-none"
        style={{ 
          userSelect: 'none', 
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          height: '100vh',
          maxWidth: '100vw',
          borderRadius: '0',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative pb-4 border-b border-gray-200 flex-shrink-0 p-6">
          {!isExporting && (
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors duration-200 select-none"
              style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
            >
              <X className="w-5 h-5" />
            </button>
          )}
          
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Download className="w-6 h-6 text-green-600" />
            </div>
          </div>

          <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
            Export to Calendar
          </h3>
          
          <div className="flex items-center justify-center space-x-2 text-gray-600">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">{formatMonthYear()}</span>
          </div>
        </div>

        {/* Content */}
        <div 
          className="flex-1 overflow-y-auto"
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            overscrollBehavior: 'contain',
            padding: '24px'
          }}
        >
          {step === 'auth' && (
            <div className="space-y-6">
              {/* Authentication */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Authentication Code
                </label>
                <div className="flex justify-center space-x-3 mb-3">
                  {[0, 1, 2, 3].map((index) => (
                    <input
                      key={index}
                      type={showPassword ? "text" : "password"}
                      value={authCode[index] || ''}
                      onChange={(e) => {
                        const newValue = e.target.value.toUpperCase();
                        if (newValue.length <= 1) {
                          const newCode = authCode.split('');
                          newCode[index] = newValue;
                          setAuthCode(newCode.join(''));
                          
                          // Clear error when user is editing (backspacing)
                          if (authError && newValue === '') {
                            setAuthError('');
                          }
                          
                          // Auto-focus next input
                          if (newValue && index < 3) {
                            const nextInput = document.querySelector(`input[data-index="${index + 1}"]`) as HTMLInputElement;
                            if (nextInput) nextInput.focus();
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        // Handle backspace to go to previous input
                        if (e.key === 'Backspace' && !authCode[index] && index > 0) {
                          const prevInput = document.querySelector(`input[data-index="${index - 1}"]`) as HTMLInputElement;
                          if (prevInput) prevInput.focus();
                        }
                      }}
                      data-index={index}
                      className="w-12 h-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center font-mono text-lg"
                      maxLength={1}
                      autoComplete="off"
                      autoFocus={index === 0}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      // Disable browser's built-in password reveal and autocomplete
                      spellCheck="false"
                      autoCorrect="off"
                      autoCapitalize="off"
                      // Additional attributes to prevent browser-specific controls
                      data-lpignore="true"
                      data-form-type="other"
                    />
                  ))}
                  <button
                    type="button"
                    onTouchStart={() => setShowPassword(true)}
                    onTouchEnd={() => setShowPassword(false)}
                    onMouseDown={() => setShowPassword(true)}
                    onMouseUp={() => setShowPassword(false)}
                    onMouseLeave={() => setShowPassword(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200 rounded-lg ml-2"
                    style={{
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent'
                    }}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              {/* Only show error when all 4 digits are entered */}
              {authError && authCode.length === 4 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-red-700">{authError}</span>
                  </div>
                </div>
              )}

              {/* Info Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-blue-800 mb-2">What happens next:</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• Enter your authentication code</li>
                      <li>• Your shifts for {formatMonthYear()} will be found</li>
                      <li>• They will automatically appear in your calendar tab</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'exporting' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                Exporting to Calendar
              </h4>
              <p className="text-gray-600 mb-4">
                Converting roster data for {formatMonthYear()}...
              </p>
              <div className="space-y-2 text-sm text-gray-500">
                <p>• Fetching your roster entries</p>
                <p>• Converting to calendar format</p>
                <p>• Updating calendar view</p>
              </div>
            </div>
          )}

          {step === 'result' && exportResult && (
            <div className="space-y-6">
              {exportResult.success ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    Calendar Updated Successfully!
                  </h4>
                  <p className="text-gray-600 mb-4">
                    Your shifts have been added to the calendar
                  </p>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-green-700">Shifts exported:</span>
                        <span className="text-green-800 font-medium">{exportResult.entriesExported}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-700">Month:</span>
                        <span className="text-green-800 font-medium">{formatMonthYear()}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* View in Calendar Button */}
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        // Close this modal and switch to calendar tab
                        onClose();
                        // Add small delay to ensure modal closes first
                        setTimeout(() => {
                          console.log('🔄 CALENDAR EXPORT: Switching to calendar tab after export');
                          window.dispatchEvent(new CustomEvent('switchToCalendarTab'));
                          // Also force a calendar refresh
                          window.dispatchEvent(new CustomEvent('forceCalendarRefresh'));
                        }, 100);
                      }}
                      className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
                    >
                      <span>View in Calendar</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-8 h-8 text-red-600" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    Export Failed
                  </h4>
                  <p className="text-gray-600 mb-4">
                    Unable to export your calendar
                  </p>
                  
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <div className="space-y-2 text-sm text-red-700">
                      {exportResult.errors.map((error, index) => (
                        <div key={index} className="flex items-start space-x-2">
                          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>{error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* What happened */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h5 className="font-medium text-blue-800 mb-2">What happened:</h5>
                <ul className="text-sm text-blue-700 space-y-1">
                  {exportResult.success ? (
                    <>
                      <li>• Found {exportResult.entriesExported} of your shifts for {formatMonthYear()}</li>
                      <li>• Shifts have been added to your calendar tab</li>
                      <li>• Click "View in Calendar" to see them</li>
                    </>
                  ) : (
                    <>
                      <li>• Check your authentication code</li>
                      <li>• Ensure you have shifts in {formatMonthYear()}</li>
                      <li>• Try again or contact support</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Add extra padding at bottom */}
          <div className="h-8" />
        </div>

        {/* Footer */}
        {/* Footer - ALWAYS VISIBLE */}
        <div className="border-t border-gray-200 bg-gray-50 p-6 flex-shrink-0">
          <div className="flex space-x-3">
            <button
              onClick={handleClose}
              disabled={isExporting}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting || authCode.length < 4 || step !== 'auth'}
              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Export To Calendar</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default CalendarExportModal;