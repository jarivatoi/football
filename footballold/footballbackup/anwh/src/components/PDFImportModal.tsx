import React, { useState, useRef } from 'react';
import { X, Upload, FileText, AlertTriangle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { pdfRosterParser, ParsedRosterData } from '../utils/pdfParser';
import { RosterFormData } from '../types/roster';
import { validatePasscode } from '../utils/passcodeAuth';
import { supabase } from '../lib/supabase';

interface PDFImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (entries: RosterFormData[], editorName: string) => Promise<void>;
  isAdminAuthenticated?: boolean;
  adminName?: string | null;
}

export const PDFImportModal: React.FC<PDFImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  isAdminAuthenticated = false,
  adminName = null
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedRosterData | null>(null);
  const [importing, setImporting] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setParsedData(null);
      setAuthError('');
    } else {
      alert('Please select a valid PDF file');
    }
  };

  const handleParsePDF = async () => {
    if (!file) return;

    setParsing(true);
    try {

      // Get institution-filtered staff list for PDF parsing
      const { workScheduleDB } = await import('../utils/indexedDB');
      await workScheduleDB.init();
      const userSession = await workScheduleDB.getUserSession();
      
      let institutionStaffNames: string[] = [];
      
      if (userSession?.userId) {
        const { data: userData } = await supabase
          .from('staff_users')
          .select('id_number, institution_code, posting_institution')
          .eq('id', userSession.userId)
          .single();
        
        if (userData) {
          const isAdmin5274 = userData.id_number === '5274' || userData.id_number === 'admin-5274';
          // Use institution_code as primary (posting_institution is null for most users)
          const userInstitution = userData.institution_code;
          

          // Fetch staff from user's institution for PDF name matching
          // This applies to ALL users including Admin 5274 to ensure correct staff matching
          if (userInstitution) {
            const { data: staffData } = await supabase
              .from('staff_users')
              .select('roster_display_name, surname, name')
              .eq('institution_code', userInstitution)
              .eq('is_active', true);
            
            if (staffData) {
              staffData.forEach((staff: any) => {
                if (staff.roster_display_name) {
                  institutionStaffNames.push(staff.roster_display_name);
                  institutionStaffNames.push(`${staff.roster_display_name}(R)`);
                }
              });
              console.log('✅ Loaded', institutionStaffNames.length, 'staff names for institution', userInstitution);
              console.log('📋 Institution staff list:', institutionStaffNames);
            }
          }
        }
      }
      
      // Set institution-filtered staff list for PDF parser BEFORE parsing
      if (institutionStaffNames.length > 0) {
}
      
      const result = await pdfRosterParser.parsePDF(file);
      setParsedData(result);
    } catch (error) {
      console.error('PDF parsing error:', error);
      alert('Failed to parse PDF. Please try again.');
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!parsedData?.entries || parsedData.entries.length === 0) return;

    // Log to localStorage so we can see what happened even after reload
    const logEntry = {
      timestamp: new Date().toISOString(),
      step: 'PDF_IMPORT_START',
      entriesCount: parsedData.entries.length,
      editorName: isAdminAuthenticated && adminName ? adminName : 'passcode-user'
    };

    // Also persist to localStorage
    const logs = JSON.parse(localStorage.getItem('pdfImportLogs') || '[]');
    logs.push(logEntry);
    localStorage.setItem('pdfImportLogs', JSON.stringify(logs.slice(-10))); // Keep last 10
    
    let editorName: string;
    
    if (isAdminAuthenticated && adminName) {
      editorName = adminName;
    } else {
      if (!authCode) {
const errorLog = { timestamp: new Date().toISOString(), step: 'NO_AUTH_CODE' };
        logs.push(errorLog);
        localStorage.setItem('pdfImportLogs', JSON.stringify(logs.slice(-10)));
        return;
      }
      const result = await validatePasscode(authCode);
      if (!result || !result.isValid || !result.isAdmin) {
        setAuthError(!result || !result.isValid ? 'Invalid passcode' : 'Admin access required for PDF import');
        const errorLog = { timestamp: new Date().toISOString(), step: 'INVALID_ADMIN_CODE', result };
        logs.push(errorLog);
        localStorage.setItem('pdfImportLogs', JSON.stringify(logs.slice(-10)));
        return;
      }
      editorName = `${result.surname}, ${result.name}`;
    }

const importStartLog = { timestamp: new Date().toISOString(), step: 'CALLING_ON_IMPORT', editorName };
    logs.push(importStartLog);
    localStorage.setItem('pdfImportLogs', JSON.stringify(logs.slice(-10)));
    
    setImporting(true);
    try {
      await onImport(parsedData.entries, editorName);

      const successLog = { timestamp: new Date().toISOString(), step: 'IMPORT_SUCCESS', message: 'Resetting state and scheduling close' };
      logs.push(successLog);
      localStorage.setItem('pdfImportLogs', JSON.stringify(logs.slice(-10)));
      
      // Don't close immediately - let parent handle the closing
      // Reset local state only
      setFile(null);
      setParsedData(null);
      setAuthCode('');
      setAuthError('');
      
const closeLog = { timestamp: new Date().toISOString(), step: 'SCHEDULING_CLOSE' };
      logs.push(closeLog);
      localStorage.setItem('pdfImportLogs', JSON.stringify(logs.slice(-10)));
      
      // Close modal after a short delay to ensure import completes
      setTimeout(() => {
const closingLog = { timestamp: new Date().toISOString(), step: 'MODAL_CLOSING' };
        logs.push(closingLog);
        localStorage.setItem('pdfImportLogs', JSON.stringify(logs.slice(-10)));
        
        onClose();
      }, 500);
    } catch (error) {
      console.error('❌ Import failed:', error);
      const errorLog = { 
        timestamp: new Date().toISOString(), 
        step: 'IMPORT_ERROR', 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      };
      logs.push(errorLog);
      localStorage.setItem('pdfImportLogs', JSON.stringify(logs.slice(-10)));
      
      alert('Failed to import roster data. Please try again.');
      // Don't reset state on error - let user retry
    } finally {
      setImporting(false);
      const finallyLog = { timestamp: new Date().toISOString(), step: 'FINALLY_BLOCK', importing: false };
      logs.push(finallyLog);
      localStorage.setItem('pdfImportLogs', JSON.stringify(logs.slice(-10)));
    }
  };

  const handleClose = () => {
    if (parsing || importing) return;
    setFile(null);
    setParsedData(null);
    setAuthCode('');
    setAuthError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999]" style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: window.innerWidth > window.innerHeight ? '4px' : '16px',
      paddingTop: window.innerWidth > window.innerHeight ? '2px' : '16px',
      overflow: 'auto',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      touchAction: 'pan-y'
    }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col" style={{
        maxWidth: window.innerWidth > window.innerHeight ? '98vw' : '32rem',
        maxHeight: window.innerWidth > window.innerHeight ? '98vh' : '90vh',
        margin: window.innerWidth > window.innerHeight ? '2px 0' : '16px 0',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none'
      }}>
        {/* Header */}
        <div className="relative pb-4 border-b border-gray-200 flex-shrink-0" style={{
          padding: window.innerWidth > window.innerHeight ? '8px' : '24px',
          userSelect: 'none',
          WebkitUserSelect: 'none'
        }}>
          {!parsing && !importing && (
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors duration-200"
              style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
            >
              <X className="w-5 h-5" />
            </button>
          )}
          
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>

          <h3 className="text-xl font-bold text-gray-900 mb-2 text-center" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
            Import Roster from PDF
          </h3>
          
          <p className="text-sm text-gray-600 text-center" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
            Upload a PDF file to automatically extract roster data
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto" style={{
          padding: window.innerWidth > window.innerHeight ? '8px' : '24px',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
          userSelect: 'none',
          WebkitUserSelect: 'none'
        }}>
          {/* File Upload */}
          {!file && (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                Select PDF File
              </h4>
              <p className="text-gray-600 mb-4">
                Choose a PDF file containing roster data
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
              >
                Choose PDF File
              </button>
            </div>
          )}

          {/* File Selected */}
          {file && !parsedData && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <FileText className="w-8 h-8 text-blue-600" />
                  <div>
                    <h4 className="font-medium text-gray-900">{file.name}</h4>
                    <p className="text-sm text-gray-600">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h5 className="font-medium text-amber-800 mb-1">
                      PDF Import Requirements
                    </h5>
                    <ul className="text-sm text-amber-700 space-y-1">
                      <li>• PDF should contain dates in DD/MM/YYYY format</li>
                      <li>• Shift types should be clearly mentioned (Morning, Evening, Night, etc.)</li>
                      <li>• Staff names should match the available names in the system</li>
                      <li>• Only admin users can import PDF data</li>
                    </ul>
                  </div>
                </div>
              </div>

              <button
                onClick={handleParsePDF}
                disabled={parsing}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
              >
                {parsing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Parsing PDF...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    <span>Parse PDF</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Parsed Results */}
          {parsedData && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Parsing Results</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {parsedData.entries.length}
                    </div>
                    <div className="text-sm text-gray-600">Entries Found</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-amber-600">
                      {parsedData.warnings.length}
                    </div>
                    <div className="text-sm text-gray-600">Warnings</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {parsedData.errors.length}
                    </div>
                    <div className="text-sm text-gray-600">Errors</div>
                  </div>
                </div>
              </div>

              {/* Errors */}
              {parsedData.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h5 className="font-medium text-red-800 mb-2 flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Errors ({parsedData.errors.length})
                  </h5>
                  <ul className="text-sm text-red-700 space-y-1">
                    {parsedData.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {parsedData.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h5 className="font-medium text-amber-800 mb-2 flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Warnings ({parsedData.warnings.length})
                  </h5>
                  <ul className="text-sm text-amber-700 space-y-1">
                    {parsedData.warnings.map((warning, index) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview Entries */}
              {parsedData.entries.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h5 className="font-medium text-green-800 mb-3 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Found Entries ({parsedData.entries.length})
                  </h5>
                  <div className="max-h-40 overflow-y-auto">
                    {parsedData.entries.slice(0, 10).map((entry, index) => (
                      <div key={index} className="text-sm text-green-700 py-1 border-b border-green-200 last:border-b-0">
                        <span className="font-medium">{entry.date}</span> - 
                        <span className="mx-1">{entry.shiftType}</span> - 
                        <span className="font-medium">{entry.assignedName}</span>
                      </div>
                    ))}
                    {parsedData.entries.length > 10 && (
                      <div className="text-sm text-green-600 py-1 italic">
                        ... and {parsedData.entries.length - 10} more entries
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Authentication */}
              {parsedData?.entries.length > 0 && !isAdminAuthenticated && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Admin Authentication Code (Required)
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
                          onFocus={() => setAuthError('')}
                          className="w-12 h-12 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center font-mono text-lg"
                          maxLength={1}
                          autoComplete="off"
                          autoFocus={index === 0}
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
                  
                  {authError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
                      <p className="text-sm text-red-700 text-center" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>{authError}</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Show admin status if authenticated */}
              {parsedData?.entries.length > 0 && isAdminAuthenticated && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700 text-center">
                    ✅ Authenticated as: <strong>{adminName}</strong>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {parsedData && parsedData.entries.length > 0 && (
          <div className="flex-shrink-0 pt-0" style={{
            padding: window.innerWidth > window.innerHeight ? '8px' : '24px'
          }}>
            <div className="flex space-x-3">
              <button
                onClick={handleClose}
                disabled={importing}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing || (!isAdminAuthenticated && authCode.length < 4)}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
              >
                {importing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Import PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};