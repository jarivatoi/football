import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Server, CheckCircle, Table, Grid, FileText, Upload, Download, Trash2, AlertTriangle, Eye, EyeOff, Printer, User, Wrench } from 'lucide-react';
import { ViewType, ShiftFilterType, RosterEntry } from '../types/roster';
import { useRosterData } from '../hooks/useRosterData';
import { RosterTableView } from './RosterTableView';
import { RosterCardView } from './RosterCardView';
import { RosterLogView } from './RosterLogView';
import { addRosterEntry, clearAllRosterEntries } from '../utils/rosterApi';
import { clearMonthRosterEntries } from '../utils/rosterApi';
import { RosterFormData } from '../types/roster';
import { validatePasscode } from '../utils/passcodeAuth';
import { useLongPress } from '../hooks/useLongPress';
import { pdfExporter } from '../utils/pdfExport';
import { MonthlyReportsModal } from './MonthlyReportsModal';
import { BatchPrintModal } from './BatchPrintModal';
import { StaffManagementModal } from './StaffManagementModal';
import { RosterMobilePlanner } from './RosterMobilePlanner';
import { RosterPlanner } from './RosterPlanner';
import ConfirmationModal from './ConfirmationModal';
import { supabase } from '../lib/supabase';

interface RosterPanelProps {
  setActiveTab: (tab: 'calendar' | 'settings' | 'data' | 'roster') => void;
  onOpenCalendarExportModal: () => void;
  selectedDate?: Date;
  onDateChange?: (date: Date) => void;
  basicSalary?: number;
  hourlyRate?: number;
  maintenanceMode?: boolean;
}

export const RosterPanel: React.FC<RosterPanelProps> = ({
  setActiveTab,
  onOpenCalendarExportModal,
  selectedDate: propSelectedDate,
  onDateChange: propOnDateChange,
  basicSalary = 35000,
  hourlyRate = 201.92,
  maintenanceMode = false
}) => {
  const [activeView, setActiveView] = useState<ViewType>('table');
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<ShiftFilterType>('all');
  const [selectedDate, setSelectedDate] = useState(propSelectedDate || new Date());
  // Sync with parent date state
  useEffect(() => {
    if (propSelectedDate) {
      setSelectedDate(propSelectedDate);
    }
  }, [propSelectedDate]);

  // Handle date changes and propagate to parent
  const handleDateChange = (newDate: Date) => {
    setSelectedDate(newDate);
    if (propOnDateChange) {
      propOnDateChange(newDate);
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showInstitutionSelect, setShowInstitutionSelect] = useState(false);
  const [selectedInstitutionForClear, setSelectedInstitutionForClear] = useState<string>('current');
  const [previousInstitution, setPreviousInstitution] = useState<string | null>(null);
  const [isAdmin5274, setIsAdmin5274] = useState(false);
  const [clearAuthCode, setClearAuthCode] = useState('');
  const [clearAuthError, setClearAuthError] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [clearType, setClearType] = useState<'all' | 'month'>('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [showPDFExportConfirm, setShowPDFExportConfirm] = useState(false);
  const [showMonthlyReports, setShowMonthlyReports] = useState(false);
  const [showBatchPrint, setShowBatchPrint] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showStaffManagement, setShowStaffManagement] = useState(false);
  const [showRosterMobilePlanner, setShowRosterMobilePlanner] = useState(false);
  const [showRosterPlanner, setShowRosterPlanner] = useState(false);
  const [showMaintenanceConfirm, setShowMaintenanceConfirm] = useState(false);
  const [maintenanceSecretAccess, setMaintenanceSecretAccess] = useState(false);
  const [staffNicknames, setStaffNicknames] = useState<Record<string, string>>({});
  
  // Platform detection
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkPlatform = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
      setIsMobile(mobile);
    };
    
    checkPlatform();
    window.addEventListener('resize', checkPlatform);
    
    return () => window.removeEventListener('resize', checkPlatform);
  }, []);

  const { entries, loading, error, removeEntry, loadEntries, realtimeStatus, registerRecentEdit, applyPendingUpdate } = useRosterData();

  // Load staff nicknames once when component mounts - BEFORE roster renders
  useEffect(() => {
    supabase.from('staff_users').select('surname,name,nickname,roster_display_name').then(({ data, error }) => {
      if (error) return;
      const n: Record<string,string> = {};
      data?.forEach((s:any)=>{ if(s.nickname){ n[s.roster_display_name||`${s.surname}_${s.name}`]=s.nickname; }});
      setStaffNicknames(n);
    });
  }, []);

  // Filter entries by current user's institution
  const [institutionFilteredEntries, setInstitutionFilteredEntries] = useState<RosterEntry[]>([]);
  const [isFiltering, setIsFiltering] = useState(true);
  
  useEffect(() => {
    const filterEntriesByInstitution = async () => {
      // Set filtering to true at start
      setIsFiltering(true);
      
      // Don't filter if entries haven't changed
      if (entries.length === 0) {
        setInstitutionFilteredEntries([]);
        setIsFiltering(false);
        return;
      }
      
      try {
        const { getCurrentInstitutionDetails } = await import('../utils/institutionHelper');
        const institution = await getCurrentInstitutionDetails();
        const userInstitution = institution?.code;
        
        if (!userInstitution) {
          setInstitutionFilteredEntries(entries);
          setIsFiltering(false);
          return;
        }
        
        // Extract all unique surnames from entries (strip (R) suffix)
        const entryNames = Array.from(new Set(
          entries.map(entry => entry.assigned_name.replace(/\(R\)$/, '').trim())
        ));
        
        if (entryNames.length === 0) {
          setInstitutionFilteredEntries([]);
          setIsFiltering(false);
          return;
        }
        
        // Fetch ALL staff from this institution with their IDs
        const { data: institutionStaff, error: instError } = await supabase
          .from('staff_users')
          .select('id, surname, roster_display_name')
          .eq('institution_code', userInstitution)
          .eq('is_active', true);
        
        if (instError) {
          setInstitutionFilteredEntries(entries);
          setIsFiltering(false);
          return;
        }
        
        // Create a Set of staff IDs from THIS institution
        const institutionStaffIds = new Set(
          institutionStaff?.map((s: any) => s.id) || []
        );
        
        // Fetch staff_users for these names WITH institution filter
        const { data: matchedStaff, error: matchError } = await supabase
          .from('staff_users')
          .select('id, surname, name, roster_display_name')
          .in('roster_display_name', entryNames)
          .eq('institution_code', userInstitution);  // ← CRITICAL: Only match staff from THIS institution
        
        if (matchError) {
          setInstitutionFilteredEntries(entries);
          setIsFiltering(false);
          return;
        }
        
        // Create a Set of valid roster_display_names from THIS institution
        const validRosterNames = new Set(
          matchedStaff?.map((s: any) => s.roster_display_name) || []
        );
        
        // Filter entries - keep only those whose assigned_name matches someone from THIS institution
        const filtered = entries.filter(entry => {
          const baseAssignedName = entry.assigned_name
            .replace(/\(R\)$/, '')  // Remove (R) suffix
            .replace(/^\*+/, '');   // Remove marker prefix (*, **, ***)
          return validRosterNames.has(baseAssignedName);
        });
        
        setInstitutionFilteredEntries(filtered);
      } catch (err) {
        setInstitutionFilteredEntries(entries);
        setIsFiltering(false);
      } finally {
        setIsFiltering(false);
      }
    };
    
    filterEntriesByInstitution();
  }, [entries, selectedDate]);


  // Reset all loading states on component mount
  useEffect(() => {
    setIsClearing(false);
    setShowClearConfirm(false);
    setClearAuthCode('');
    setClearAuthError('');
    setShowAuthModal(false);
    setAuthCode('');
    setAuthError('');
    // Force loading to false on mount
  }, []);

  // Initialize Admin 5274 status on mount
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const { workScheduleDB } = await import('../utils/indexedDB');
        await workScheduleDB.init();
        const userSession = await workScheduleDB.getUserSession();
        
        if (userSession?.userId) {
          const { data: userData } = await supabase
            .from('staff_users')
            .select('id_number')
            .eq('id', userSession.userId)
            .single();
          
          if (userData) {
            const adminStatus = userData.id_number === '5274' || userData.id_number === 'admin-5274';
            setIsAdmin5274(adminStatus);
          }
        }
      } catch (err) {
        // Could not determine admin status
      }
    };
    
    checkAdminStatus();
  }, []);

  // Prevent body scroll when auth modal is open
  useEffect(() => {
    if (showAuthModal || showClearConfirm) {
      // Disable body scroll
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = '0';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.bottom = '0';
      
      // Don't disable any other scrolling - let modals handle their own scroll prevention
    }

    return () => {
      // Re-enable body scroll
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.bottom = '';
    };
  }, [showAuthModal, showClearConfirm]);

  // Listen for maintenance secret access event
  useEffect(() => {
    const handleShowMaintenanceAuth = () => {
      setMaintenanceSecretAccess(true);
      setShowAuthModal(true);
    };
    
    window.addEventListener('showMaintenanceAuth', handleShowMaintenanceAuth);
    
    // Check if there's a pending auth request from sessionStorage
    const checkPendingAuth = () => {
      const pendingAuth = sessionStorage.getItem('showMaintenanceAuth');
      if (pendingAuth === 'true') {
        sessionStorage.removeItem('showMaintenanceAuth');
        setMaintenanceSecretAccess(true);
        setShowAuthModal(true);
      }
    };
    
    // Check immediately on mount
    checkPendingAuth();
    
    // Also check periodically in case component wasn't mounted when event fired
    const pollInterval = setInterval(checkPendingAuth, 500);
    
    return () => {
      window.removeEventListener('showMaintenanceAuth', handleShowMaintenanceAuth);
      clearInterval(pollInterval);
    };
  }, []);


  // Admin validation - only N002 (NARAYYA) can clear database
  // Import admin validation from rosterAuth
  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  const handleDeleteEntry = (id: string) => {
    setShowDeleteConfirm(id);
  };

  const handleConfirmDelete = async (id: string) => {
    try {
      await removeEntry(id);
      setShowDeleteConfirm(null);
      showSuccess('Roster entry deleted successfully!');
    } catch (err) {
      alert('Failed to delete entry. Please try again.');
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(null);
  };

  const handleClearDatabase = async () => {
    setIsClearing(true);
    setClearAuthError('');
    
    try {
      // Get current user's institution
      let institutionCode: string | null = null;
      try {
        const { workScheduleDB } = await import('../utils/indexedDB');
        await workScheduleDB.init();
        const userSession = await workScheduleDB.getUserSession();
        
        if (userSession?.userId) {
          const { data: userData } = await supabase
            .from('staff_users')
            .select('id_number, institution_code, posting_institution')
            .eq('id', userSession.userId)
            .single();
          
          // Admin 5274 uses posting_institution, others use institution_code
          // For attached centers filtering, always use institution_code first
          institutionCode = userData?.institution_code || userData?.posting_institution || null;
        }
      } catch (err) {
        // Could not determine user institution
      }
      
      // Determine which institution code to use based on selection
      const institutionToUse = selectedInstitutionForClear === 'current' ? institutionCode : null;
      
      if (clearType === 'all') {
        await clearAllRosterEntries(institutionToUse || undefined);
      } else {
        await clearMonthRosterEntries(selectedYear, selectedMonth, institutionToUse || undefined);
      }
      
      // Wait for the operation to complete
      await loadEntries();
      setRefreshKey(prev => prev + 1);
      
      // CRITICAL: Reset loading state IMMEDIATELY after success
      setIsClearing(false);
      
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const scopeText = selectedInstitutionForClear === 'current' && institutionCode 
        ? `${institutionCode} only` 
        : 'all institutions';
      const message = clearType === 'all' 
        ? `Database cleared successfully for ${scopeText}!` 
        : `${monthNames[selectedMonth]} ${selectedYear} data cleared successfully for ${scopeText}!`;
      showSuccess(message);
      
      // Reset states and close modal after success
      setTimeout(() => {
        setShowClearConfirm(false);
        setClearAuthCode('');
        setClearType('all');
        // Double-check loading state is false
        setIsClearing(false);
      }, 100);
      
    } catch (error) {
      // Failed to clear database
      setIsClearing(false);
      setClearAuthError('Failed to clear database. Please try again.');
    }
  };

  const handleCancelClear = () => {
    // CRITICAL: Reset loading state when cancelling
    setIsClearing(false);
    setShowClearConfirm(false);
    setClearType('all');
    setClearAuthCode('');
    setClearAuthError('');
  };

  // Handle authentication for long press
  const handleAuthSubmit = async () => {
    const result = await validatePasscode(authCode);
    if (!result || !result.isValid) {
      setAuthError('Invalid passcode');
      return;
    }
    
    if (!result.isAdmin) {
      setAuthError('Admin access required');
      return;
    }
    
    setIsAdminAuthenticated(true);
    setAdminName(`${result.surname}, ${result.name}`);
    setShowAuthModal(false);
    setAuthError('');
    setAuthCode('');
  };

  const handleCancelAuth = () => {
    setShowAuthModal(false);
    setAuthCode('');
    setAuthError('');
  };

  // Handle maintenance mode toggle
  const handleToggleMaintenanceMode = () => {
    setShowMaintenanceConfirm(true);
  };

  const handleConfirmMaintenanceToggle = async () => {
    const currentState = maintenanceMode;
    const newState = !currentState;
    
    if (supabase) {
      try {
        const { error } = await supabase
          .from('metadata')
          .upsert({ key: 'maintenanceMode', value: newState }, { onConflict: 'key' })
          .eq('key', 'maintenanceMode');
        
        if (error) throw error;
      } catch (error: any) {
        alert('Failed to update');
        return;
      }
    }
    
    setShowMaintenanceConfirm(false);
    window.location.reload();
  };

  const handleCancelMaintenance = () => {
    setShowMaintenanceConfirm(false);
  };

  // Handle secret maintenance mode access from wheel tapping
  const handleShowMaintenanceAuth = () => {
    setMaintenanceSecretAccess(true);
    setShowAuthModal(true); // Show the existing admin auth modal
  };

  // Override auth submit when coming from maintenance secret access
  const handleAuthSubmitWithMaintenance = async () => {
    const result = await validatePasscode(authCode);
    if (!result || !result.isValid) {
      setAuthError('Invalid passcode');
      return;
    }
    
    if (!result.isAdmin) {
      setAuthError('Admin access required');
      return;
    }
    
    // If this is from maintenance secret access, disable maintenance mode
    if (maintenanceSecretAccess) {
      if (supabase) {
        try {
          const { error } = await supabase
            .from('metadata')
            .upsert({ key: 'maintenanceMode', value: false }, { onConflict: 'key' })
            .eq('key', 'maintenanceMode');
          
          if (error) throw error;
          
          // Dispatch event to notify app of change
          window.dispatchEvent(new CustomEvent('maintenanceModeChanged', { detail: { enabled: false } }));
        } catch (error: any) {
          setAuthError('Failed to disable maintenance');
          return;
        }
      }
      
      setMaintenanceSecretAccess(false);
      // Don't reload - just close the modal and continue
      setIsAdminAuthenticated(true);
      setAdminName(`${result.surname}, ${result.name}`);
      setShowAuthModal(false);
      setAuthError('');
      setAuthCode('');
        return;
    }
    
    // Normal admin auth flow
    setIsAdminAuthenticated(true);
    setAdminName(`${result.surname}, ${result.name}`);
    setShowAuthModal(false);
    setAuthError('');
    setAuthCode('');
  };

  const handleExportToPDF = async () => {
    setShowPDFExportConfirm(true);
  };

  const handleConfirmPDFExport = async () => {
    setShowPDFExportConfirm(false);
    setIsExportingPDF(true);
    
    try {
      // Use current selected date for month/year
      const month = selectedDate.getMonth();
      const year = selectedDate.getFullYear();
      
      await pdfExporter.exportToPDF({
        entries: entries,
        month: month,
        year: year,
        title: 'X-ray ANWH Roster'
      });
      
      showSuccess('PDF exported successfully! Check your downloads folder.');
      
    } catch (error) {
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleCancelPDFExport = () => {
    setShowPDFExportConfirm(false);
  };

  return (
    <div className="bg-white" style={{
      width: '100vw',
      marginLeft: 'calc(-50vw + 50%)',
      marginRight: 'calc(-50vw + 50%)',
      paddingTop: '0px'
    }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-center">
          <h2 className="text-2xl font-bold text-gray-900">Roster Management</h2>
        </div>
      </div>
        
      {/* Success Message */}
      {showSuccessMessage && (
        <div className="mx-2 mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-green-800 font-medium">{successMessage}</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mx-2 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* View Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveView('table')}
            className={`flex-1 px-6 py-4 font-medium transition-colors duration-200 flex items-center justify-center space-x-2 ${
              activeView === 'table'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                : 'text-gray-600'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>Table View</span>
          </button>
          <button
            onClick={() => setActiveView('card')}
            className={`flex-1 px-6 py-4 font-medium transition-colors duration-200 flex items-center justify-center space-x-2 ${
              activeView === 'card'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                : 'text-gray-600'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>Card View</span>
          </button>
          <button
            onClick={() => setActiveView('log')}
            className={`flex-1 px-6 py-4 font-medium transition-colors duration-200 flex items-center justify-center space-x-2 ${
              activeView === 'log'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                : 'text-gray-600'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Log View</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-0">
        {(() => {
          const isLoading = institutionFilteredEntries.length === 0;
          
          if (activeView === 'table') {
            return (
              <RosterTableView
                entries={institutionFilteredEntries}
                loading={isLoading}
                realtimeStatus={realtimeStatus}
                onRefresh={loadEntries}
                selectedDate={selectedDate}
                onDateChange={handleDateChange}
                onExportToCalendar={onOpenCalendarExportModal}
                setActiveTab={setActiveTab}
                staffNicknames={staffNicknames}
                registerRecentEdit={registerRecentEdit}
                applyPendingUpdate={applyPendingUpdate}
              />
            );
          } else if (activeView === 'card') {
            return (
              <RosterCardView
                entries={institutionFilteredEntries}
                loading={isLoading}
                realtimeStatus={realtimeStatus}
                onRefresh={loadEntries}
                selectedDate={selectedDate}
                onDateChange={handleDateChange}
                registerRecentEdit={registerRecentEdit}
                applyPendingUpdate={applyPendingUpdate}
              />
            );
          } else if (activeView === 'log') {
            return (
              <RosterLogView
                entries={institutionFilteredEntries}
                loading={isLoading}
                selectedDate={selectedDate}
              />
            );
          }
          return null;
        })()}
      </div>
      
      {/* Clear Database Confirmation Modal */}
      {showClearConfirm && createPortal(
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
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{
            maxWidth: window.innerWidth > window.innerHeight ? '98vw' : '28rem',
            maxHeight: window.innerWidth > window.innerHeight ? '98vh' : 'none',
            margin: window.innerWidth > window.innerHeight ? '2px 0' : '16px 0'
          }}>
            <div style={{
              padding: window.innerWidth > window.innerHeight ? '8px' : '24px'
            }}>
              <div className="flex items-center justify-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
                {clearType === 'all' ? 'Clear Entire Database' : 'Clear Month Data'}
              </h3>
              
              {/* Clear Type Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Clear Type
                </label>
                <div className="flex space-x-3">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="all"
                      checked={clearType === 'all'}
                      onChange={(e) => setClearType(e.target.value as 'all' | 'month')}
                      className="mr-2"
                    />
                    <span className="text-sm">All Data</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="month"
                      checked={clearType === 'month'}
                      onChange={(e) => setClearType(e.target.value as 'all' | 'month')}
                      className="mr-2"
                    />
                    <span className="text-sm">Specific Month</span>
                  </label>
                </div>
              </div>

{/* Institution Selection - Admin 5274 Only */}
{isAdmin5274 && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-blue-900">
                      Institution Scope
                    </label>
                    <button
                      onClick={() => {
                        setPreviousInstitution(selectedInstitutionForClear);
                        setShowInstitutionSelect(true);
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1"
                    >
                      <User className="w-4 h-4" />
                      <span>Change</span>
                    </button>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <div className={`w-3 h-3 rounded-full ${selectedInstitutionForClear === 'current' ? 'bg-blue-500' : 'bg-red-500'}`} />
                    <span className="text-blue-900">
                      {selectedInstitutionForClear === 'current' 
                        ? 'Current institution only' 
                        : 'All institutions (Admin 5274)'}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Month/Year Selection - Only show when clearType is 'month' */}
              {clearType === 'month' && (
                <div className="mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Month
                      </label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      >
                        {[
                          'January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'
                        ].map((month, index) => (
                          <option key={index} value={index}>{month}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Year
                      </label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      >
                        {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-red-800 font-medium mb-2">
                      ⚠️ DANGER: This will permanently delete {clearType === 'all' ? 'ALL roster entries' : `all entries for ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][selectedMonth]} ${selectedYear}`}!
                    </p>
                    <ul className="text-sm text-red-700 space-y-1">
                      {clearType === 'all' ? (
                        <>
                          <li>• All dates and shift assignments</li>
                          <li>• All edit history and logs</li>
                          <li>• All imported data</li>
                        </>
                      ) : (
                        <>
                          <li>• All shifts for {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][selectedMonth]} {selectedYear}</li>
                          <li>• All edit history for that month</li>
                          <li>• All staff assignments for that month</li>
                        </>
                      )}
                      <li>• This action CANNOT be undone!</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleCancelClear}
                  disabled={isClearing}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearDatabase}
                  disabled={isClearing}
                  className={`flex-1 px-4 py-3 ${clearType === 'all' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'} disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors duration-200 flex items-center justify-center space-x-2`}
                >
                  {isClearing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{clearType === 'all' ? 'Clearing all data...' : 'Clearing month...'}</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>{clearType === 'all' ? 'Clear Database' : 'Clear Month'}</span>
                    </>
                  )}
                </button>
              </div>
              
              {/* Show auth error in the modal */}
              {clearAuthError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700 text-center">{clearAuthError}</p>
                </div>
              )}
            </div>
          </div>
        </div>
        , document.body
      )}

{/* Institution Selection Modal for Admin 5274 */}
{showInstitutionSelect && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999]" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
                Select Institution
              </h3>
              
              <div className="space-y-3 mb-6">
                <button
                  onClick={() => {
                    setSelectedInstitutionForClear('current');
                    setShowInstitutionSelect(false);
                  }}
                  className="w-full px-4 py-3 bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 rounded-lg text-left transition-colors duration-200"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full" />
                    <div>
                      <div className="font-semibold text-gray-900">Current Institution Only</div>
                      <div className="text-sm text-gray-600">Clear data for your institution only</div>
                    </div>
                  </div>
                </button>
                
                <button
                  onClick={() => {
                    setSelectedInstitutionForClear('all');
                    setShowInstitutionSelect(false);
                  }}
                  className="w-full px-4 py-3 bg-red-50 hover:bg-red-100 border-2 border-red-200 rounded-lg text-left transition-colors duration-200"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-red-500 rounded-full" />
                    <div>
                      <div className="font-semibold text-gray-900">All Institutions</div>
                      <div className="text-sm text-gray-600">Clear data across all institutions (Admin 5274 only)</div>
                    </div>
                  </div>
                </button>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowInstitutionSelect(false);
                    // Restore previous institution if exists
                    if (previousInstitution) {
                      setSelectedInstitutionForClear(previousInstitution);
                    }
                  }}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Authentication Modal for Long Press */}
      {showAuthModal && createPortal(
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-[9999]"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2147483647, // Maximum z-index
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            display: 'flex',
            alignItems: window.innerWidth > window.innerHeight ? 'flex-start' : 'center',
            justifyContent: 'center',
            padding: window.innerWidth > window.innerHeight ? '8px' : '16px',
            paddingTop: window.innerWidth > window.innerHeight ? '4px' : '16px',
            // CRITICAL: Prevent all scrolling
            overflow: 'auto',
            overflowY: 'auto',
            touchAction: 'pan-y',
            WebkitOverflowScrolling: 'touch'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCancelAuth();
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full"
            style={{
              userSelect: 'none',
              WebkitUserSelect: 'none',
              maxHeight: window.innerWidth > window.innerHeight ? '95vh' : '90vh',
              maxWidth: window.innerWidth > window.innerHeight ? '90vw' : '28rem',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#ffffff',
              zIndex: 2147483647,
              // Enable touch interactions within modal
              touchAction: 'auto',
              overflow: 'hidden',
              margin: window.innerWidth > window.innerHeight ? '4px 0' : '16px 0'
            }}
            onClick={(e) => {
              // Prevent modal from closing when clicking inside
              e.stopPropagation();
            }}
          >
            <div style={{
              padding: window.innerWidth > window.innerHeight ? '12px' : '24px'
            }}>
              <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
                Admin Authentication Required
              </h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Authentication Code
                </label>
                <div className="flex flex-col items-center">
                  <div className="flex space-x-3 mb-3">
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
                        className="w-12 h-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center font-mono text-lg"
                        maxLength={1}
                        autoComplete="off"
                        autoFocus={index === 0}
                        // Disable browser's built-in password reveal and autocomplete
                        spellCheck="false"
                        autoCorrect="off"
                        autoCapitalize="off"
                        inputMode="numeric"
                        // Additional attributes to prevent browser-specific controls
                        data-lpignore="true"
                        data-form-type="other"
                      />
                    ))}
                  </div>
                  <div className="mt-2">
                    <button
                      type="button"
                      onTouchStart={() => setShowPassword(true)}
                      onTouchEnd={() => setShowPassword(false)}
                      onMouseDown={() => setShowPassword(true)}
                      onMouseUp={() => setShowPassword(false)}
                      onMouseLeave={() => setShowPassword(false)}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200 rounded-lg"
                      style={{
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent'
                      }}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
              
              {authError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700 text-center">{authError}</p>
                </div>
              )}
              
              <div className="flex space-x-3">
                <button
                  onClick={handleCancelAuth}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={maintenanceSecretAccess ? handleAuthSubmitWithMaintenance : handleAuthSubmit}
                  disabled={authCode.length < 4}
                  className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors duration-200"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
        , document.body
      )}
      
      {/* Monthly Reports Modal */}
      <MonthlyReportsModal
        isOpen={showMonthlyReports}
        onClose={() => setShowMonthlyReports(false)}
        entries={institutionFilteredEntries}
        basicSalary={basicSalary}
        hourlyRate={hourlyRate}
        shiftCombinations={[
          { id: '9-4', combination: '9-4', hours: 6.5 },
          { id: '4-10', combination: '4-10', hours: 5.5 },
          { id: '12-10', combination: '12-10', hours: 9.5 },
          { id: 'N', combination: 'N', hours: 12.5 }
        ]}
      />

      {/* Batch Print Modal */}
      <BatchPrintModal
        isOpen={showBatchPrint}
        onClose={() => setShowBatchPrint(false)}
        entries={entries}
        basicSalary={basicSalary}
        hourlyRate={hourlyRate}
        shiftCombinations={[
          { id: '9-4', combination: '9-4', hours: 6.5 },
          { id: '4-10', combination: '4-10', hours: 5.5 },
          { id: '12-10', combination: '12-10', hours: 9.5 },
          { id: 'N', combination: 'N', hours: 12.5 }
        ]}
      />
      
      {/* Staff Management Modal */}
      <StaffManagementModal
        isOpen={showStaffManagement}
        onClose={() => setShowStaffManagement(false)}
        isAdminAuthenticated={isAdminAuthenticated}
        adminName={adminName}
      />
      
      {/* PDF Export Confirmation Modal */}
      <ConfirmationModal
        isOpen={showPDFExportConfirm}
        title="Export to PDF"
        message="Do you want to export the current month's roster data to PDF?"
        onConfirm={handleConfirmPDFExport}
        onCancel={handleCancelPDFExport}
        confirmText="Export"
        cancelText="Cancel"
        isDanger={false}
      />
      
      {/* Maintenance Mode Confirmation Modal */}
      {showMaintenanceConfirm && createPortal(
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[100001]"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 100001
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Wrench className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Toggle Maintenance Mode?
              </h3>
              <p className="text-sm text-gray-600">
                {maintenanceMode 
                  ? 'This will DISABLE maintenance mode and make the app visible to all users.'
                  : 'This will ENABLE maintenance mode and show a maintenance screen to all users.'
                }
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={handleCancelMaintenance}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMaintenanceToggle}
                className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors duration-200"
              >
                {maintenanceMode ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Roster Mobile Planner Modal */}
      {showRosterMobilePlanner && (
        <RosterMobilePlanner
          onClose={() => setShowRosterMobilePlanner(false)}
          institutionCode={null}
        />
      )}
      
      {/* Roster Planner (Desktop) Modal */}
      {showRosterPlanner && (
        <RosterPlanner
          onClose={() => setShowRosterPlanner(false)}
        />
      )}
    </div>
  );
};