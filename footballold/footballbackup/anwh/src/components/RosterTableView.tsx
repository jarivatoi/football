import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Edit, FileText, Download, RefreshCw, Star, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Eye, EyeOff } from 'lucide-react';
import { RosterEntry, ShiftFilterType } from '../types/roster';
import { EditDetailsModal } from './EditDetailsModal';
import { SpecialDateModal } from './SpecialDateModal';
import { RosterEntryCell } from './RosterEntryCell';
import { RosterDateCell } from './RosterDateCell';
import { ScrollingText } from './ScrollingText';
import { validatePasscode } from '../utils/passcodeAuth';
import { availableNames, shiftTypes, sortByGroup, authCodes, sortRosterEntriesByGroup } from '../utils/rosterAuth';
import { addRosterEntry, deleteRosterEntry, updateAllStaffRemarksForDate } from '../utils/rosterApi';
import { supabase } from '../lib/supabase';
import { formatDisplayNameForUI } from '../utils/rosterDisplayName';

interface RosterTableViewProps {
  entries: RosterEntry[];
  loading: boolean;
  realtimeStatus: 'connecting' | 'connected' | 'error' | 'disconnected';
  onRefresh: () => Promise<void>;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onExportToCalendar: () => void;
  setActiveTab: (tab: 'calendar' | 'settings' | 'data' | 'roster') => void;
  staffNicknames?: Record<string, string>;
  registerRecentEdit?: (entryId: string, updatedData?: Partial<RosterEntry>, applyUpdateLater?: boolean) => void;
  applyPendingUpdate?: (entryId: string, updatedData: Partial<RosterEntry>) => void;
}

export const RosterTableView: React.FC<RosterTableViewProps> = ({
  entries,
  loading,
  realtimeStatus = 'disconnected',
  onRefresh,
  selectedDate,
  onDateChange,
  onExportToCalendar,
  setActiveTab,
  staffNicknames,
  registerRecentEdit,
  applyPendingUpdate
}) => {
  // Listen for navigation events from parent components
  useEffect(() => {
    const handleNavigateToMonth = (event: CustomEvent) => {
      const { month, year } = event.detail;
      console.log(`📅 RosterTableView: Received navigation event to ${month + 1}/${year}`);
      const newDate = new Date(year, month, 1);
      onDateChange(newDate);
    };

    window.addEventListener('navigateToMonth', handleNavigateToMonth as EventListener);
    return () => window.removeEventListener('navigateToMonth', handleNavigateToMonth as EventListener);
  }, [onDateChange]);

  // All state declarations
  const [selectedEntry, setSelectedEntry] = useState<RosterEntry | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState('');
  const [refreshingDate, setRefreshingDate] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [showMonthYearSelector, setShowMonthYearSelector] = useState(false);
  const [hasTabSwitched, setHasTabSwitched] = useState(false);
  
  // Special date modal states
  const [showSpecialDateModal, setShowSpecialDateModal] = useState(false);
  const [selectedSpecialDate, setSelectedSpecialDate] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [actionType, setActionType] = useState<'special' | 'addStaff' | null>(null);
  const [selectedShiftForAdd, setSelectedShiftForAdd] = useState<string>('');
  const [selectedStaffForAdd, setSelectedStaffForAdd] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [availableStaff, setAvailableStaff] = useState<string[]>([]);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  
  const isMountedRef = useRef(true);

  // Track if we've loaded data at least once (prevents "no entries" flicker)
  useEffect(() => {
    if (!loading) {
      setHasLoadedData(true);
    }
    // Don't reset hasLoadedData to false - keep it true once we've loaded data
    // This prevents the flicker on initial load AND keeps spinner during refreshes
  }, [loading]);

  // Fetch staff data once for all cells
  useEffect(() => {
    const fetchStaffData = async () => {
      try {
        // Get current user's institution - either from session or by fetching user data
        const { workScheduleDB } = await import('../utils/indexedDB');
        await workScheduleDB.init();
        const userSession = await workScheduleDB.getUserSession();
        let userInstitution: string | undefined = userSession?.institution_code;
        
        // If institution not in session, fetch user data from Supabase
        if (!userInstitution && userSession?.userId) {
          try {
            const { data: userData, error } = await supabase
              .from('staff_users')
              .select('institution_code')
              .eq('id', userSession.userId)
              .single();
            
            if (error) {
              console.error('Error fetching user institution:', error);
            } else {
              userInstitution = userData?.institution_code;
            }
          } catch (err) {
            console.error('Failed to fetch user institution:', err);
          }
        }
        
        // Fetch staff filtered by institution if user has one
        let query = supabase
          .from('staff_users')
          .select('*')
          .eq('is_active', true)
          .order('surname', { ascending: true });
        
        if (userInstitution) {
          query = query.eq('institution_code', userInstitution);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          // Build staff list similar to old rosterAuth.ts system
          // Include both base names and (R) variants for each staff member
          const names: string[] = [];
          
          data.forEach((staff: any) => {
            // Skip only the specific user with ID 5274 (main admin)
            // Other admin users should still appear in the list
            const isMainAdmin = staff.id_number === '5274' || staff.id_number === 'admin-5274';
            
            if (isMainAdmin || staff.is_active === false) {
              return;
            }
            
            // Use roster_display_name which contains the ID-based format
            // e.g., "NARAYYA_N280881240162C" instead of just "NARAYYA"
            // Fallback to surname if roster_display_name is null/undefined
            const baseName = staff.roster_display_name || `${staff.surname}_${staff.id_number}`;
            
            // Skip if we still can't build a name (deleted staff)
            if (!baseName || baseName === 'null_null' || baseName === 'undefined_undefined') {
              return;
            }
            
            // Add base name
            names.push(baseName);
            
            // Add (R) variant for each staff member (like old system)
            const rVariant = `${baseName}(R)`;
            names.push(rVariant);
          });
          
          // CRITICAL: Also include assigned names from current entries
          // This ensures staff who are already assigned show up even if their roster_display_name changed
          const assignedNamesFromEntries = new Set<string>();
          entries.forEach(entry => {
            if (entry.assigned_name) {
              assignedNamesFromEntries.add(entry.assigned_name);
              // Also add the base name (without (R))
              const baseName = entry.assigned_name.replace(/\(R\)$/, '').trim();
              assignedNamesFromEntries.add(baseName);
            }
          });
          
          // Add any assigned names that aren't already in the list
          assignedNamesFromEntries.forEach(name => {
            if (!names.includes(name)) {
              names.push(name);
            }
          });
          
          // Remove ADMIN and sort: (*) at bottom always, then seniority
          const filteredNames = names.filter(name => name !== 'ADMIN');
          
          const sortedNames = filteredNames.sort((a, b) => {
            // CRITICAL PRIORITY 1: Check asterisks FIRST - names with * ALWAYS go to bottom
            const aStartsWithAsterisk = a.startsWith('*');
            const bStartsWithAsterisk = b.startsWith('*');
            
            if (!aStartsWithAsterisk && bStartsWithAsterisk) return -1;
            if (aStartsWithAsterisk && !bStartsWithAsterisk) return 1;
            
            // If both have same asterisk status, then check seniority
            const authA = authCodes.find(auth => auth.name === a);
            const authB = authCodes.find(auth => auth.name === b);
            
            const titleA = authA?.title || 'MIT';
            const titleB = authB?.title || 'MIT';
            
            // Priority 2: SMIT (senior) comes first
            if (titleA === 'SMIT' && titleB !== 'SMIT') return -1;
            if (titleA !== 'SMIT' && titleB === 'SMIT') return 1;
            
            // Priority 3: Within same title and asterisk status, (R) comes first
            if (titleA === titleB) {
              const aHasR = a.includes('(R)');
              const bHasR = b.includes('(R)');
              
              // Names WITH (R) come first
              if (aHasR && !bHasR) return -1;
              if (!aHasR && bHasR) return 1;
              
              return a.localeCompare(b);
            }
            
            return titleA.localeCompare(titleB);
          });
          
          setAvailableStaff(sortedNames);
        }
      } catch (error) {
        console.error('❌ RosterTableView: Error fetching staff:', error);
      }
    };
    
    fetchStaffData();
  }, []);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    onDateChange(newDate);
  };

  const formatMonthYear = () => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
  };

  const handleMonthYearChange = (month: number, year: number) => {
    const newDate = new Date(year, month, 1);
    onDateChange(newDate);
    setShowMonthYearSelector(false);
  };

  // Track mounted status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Filter entries based on selected date
  const filteredEntries = entries.filter(entry => {
    const entryDate = new Date(entry.date);
    return entryDate.getMonth() === selectedDate.getMonth() && 
           entryDate.getFullYear() === selectedDate.getFullYear();
  });

  // Listen for real-time updates
  useEffect(() => {
    const handleRealtimeUpdate = (event: CustomEvent) => {
      // Force re-render to re-apply sorting when realtime update received
      setRefreshKey(prev => prev + 1);
    };

    window.addEventListener('rosterRealtimeUpdate', handleRealtimeUpdate as EventListener);
    return () => window.removeEventListener('rosterRealtimeUpdate', handleRealtimeUpdate as EventListener);
  }, []);

  // Handle manual refresh
  const handleManualRefresh = async (clickedDate?: string) => {
    setIsRefreshing(true);
    const refreshDate = clickedDate || new Date().toISOString().split('T')[0];
    setRefreshingDate(refreshDate);
    
    try {
      console.log('🔄 Manual refresh triggered in table view');
      // Actually call the onRefresh function to reload data from database
      if (onRefresh) {
        await onRefresh();
      }
      setLastUpdateTime(new Date().toLocaleTimeString());
      console.log('✅ Manual refresh completed');
    } catch (error) {
      console.error('Manual refresh error:', error);
    } finally {
      setIsRefreshing(false);
      setRefreshingDate(null);
    }
  };

  // Auto-scroll to today's date only when switching to this tab
  useEffect(() => {
    // Skip auto-scroll if we're in the middle of a PDF import
    if ((window as any).disableAutoScroll) {
      return;
    }
    
    // Only auto-scroll if we haven't done it yet for this tab switch
    if (!hasTabSwitched && !loading && filteredEntries.length > 0) {
      const today = new Date();
      const isCurrentMonth = selectedDate.getMonth() === today.getMonth() && 
                             selectedDate.getFullYear() === today.getFullYear();
      
      if (isCurrentMonth) {
        const todayString = today.toISOString().split('T')[0];
        const todayEntry = filteredEntries.find(entry => entry.date === todayString);
        
        if (todayEntry) {
          setTimeout(() => {
            const todaySection = document.querySelector(`[data-date="${todayString}"]`) ||
                                document.querySelector(`tr[data-date="${todayString}"]`);
            
            if (todaySection) {
              todaySection.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
              });
            }
          }, 500); // Delay to ensure DOM is ready
        }
      }
      
      // Mark that we've done the tab switch auto-scroll
      setHasTabSwitched(true);
    }
  }, [loading, filteredEntries, selectedDate, hasTabSwitched]);

  // Reset tab switch flag when component mounts (new tab switch)
  useEffect(() => {
    setHasTabSwitched(false);
  }, []);

  // Listen for roster updates
  useEffect(() => {
    const handleRosterUpdate = (event: CustomEvent) => {
      console.log('🔄 Table view: Roster updated, refreshing data...');
      if (onRefresh) {
        onRefresh();
      }
    };

    window.addEventListener('rosterUpdated', handleRosterUpdate as EventListener);
    return () => window.removeEventListener('rosterUpdated', handleRosterUpdate as EventListener);
  }, [onRefresh]);

  // Sort entries by date in ascending order
  const sortedEntries = [...filteredEntries].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Group entries by date for sticky headers
  const groupedEntries = sortedEntries.reduce((groups, entry) => {
    const date = entry.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(entry);
    return groups;
  }, {} as Record<string, typeof sortedEntries>);

  // Handle showing details modal
  const handleShowDetails = (entry: RosterEntry) => {
    setSelectedEntry(entry);
    setShowModal(true);
  };

  const handleEntryUpdate = (updatedEntry: RosterEntry) => {
    if (!isMountedRef.current) {
      console.warn('Component unmounted, skipping update');
      return;
    }
    
    // No need to manually refresh - Supabase realtime updates will handle it
  };

  // Handle special date long press
  const handleSpecialDateDoublePress = (date: string) => {
    console.log('🌟 SPECIAL DATE: Double tap detected on date:', date);
    setSelectedSpecialDate(date);
    setActionType('special');
    setSelectedShiftForAdd('');
    setSelectedStaffForAdd([]);
    setShowAuthModal(true);
    setAuthCode('');
    setAuthError('');
  };
  
  // Handle add staff long press (admin only)
  const handleDateCellLongPress = (date: string) => {
    console.log('👥 ADD STAFF: Long press detected on date:', date);
    setSelectedSpecialDate(date);
    setActionType('addStaff');
    setSelectedShiftForAdd(''); // Reset shift selection
    setSelectedStaffForAdd([]);
    setShowAuthModal(true);
    setAuthCode('');
    setAuthError('');
  };

  // Handle add staff long press
  const handleShiftCellLongPress = (date: string, shiftType: string) => {
    console.log('👥 ADD STAFF: Long press detected on shift:', { date, shiftType });
    setSelectedSpecialDate(date);
    setSelectedShiftForAdd(shiftType);
    setActionType('addStaff');
    
    // Get current staff for this shift
    const dateEntries = groupedEntries[date] || [];
    const currentEntries = dateEntries.filter(entry => entry.shift_type === shiftType);
    const currentStaff = currentEntries.map(entry => entry.assigned_name);
    setSelectedStaffForAdd(currentStaff);
    
    setShowAuthModal(true);
    setAuthCode('');
    setAuthError('');
  };

  // Handle authentication submit
  const handleAuthSubmit = async () => {
    console.log('🔐 AUTH: Submit clicked with:', {
      authCode,
      actionType,
      selectedSpecialDate
    });

    const result = await validatePasscode(authCode);
    if (!result || !result.isValid) {
      setAuthError('Invalid passcode');
      return;
    }
    
    if (!result.isAdmin) {
      setAuthError('Admin access required for special date marking');
      return;
    }

    const editorName = `${result.surname}, ${result.name}`;
    console.log('✅ AUTH: Validation successful, editor:', editorName);

    if (actionType === 'special' && selectedSpecialDate) {
      console.log('🌟 AUTH: Opening special date modal for:', selectedSpecialDate);
      
      // Close auth modal first
      setShowAuthModal(false);
      setAuthCode('');
      setAuthError('');
      
      // Open special date modal with delay
      setTimeout(() => {
        console.log('🌟 AUTH: Actually opening special date modal now');
        setShowSpecialDateModal(true);
      }, 100);
    } else {
      // For addStaff action, close auth modal and let the separate staff modal handle it
      setShowAuthModal(false);
      setAuthError('');
    }
  };

  // Handle special date save
  const handleSpecialDateSave = async (isSpecial: boolean, info: string) => {
    if (!selectedSpecialDate) return;

    try {
      const result = await validatePasscode(authCode);
      const editorName = result ? `${result.surname}, ${result.name}` : 'ADMIN';
      
      // Always update staff remarks - either with new info or empty string to clear
      await updateAllStaffRemarksForDate(selectedSpecialDate, isSpecial ? info.trim() : '', editorName);
      
      // Refresh data
      if (onRefresh) {
        await onRefresh();
      }
      
      // Force refresh key to trigger re-render
      setRefreshKey(prev => prev + 1);
      
      console.log('✅ SPECIAL DATE: Saved successfully');
    } catch (error) {
      console.error('❌ SPECIAL DATE: Save failed:', error);
      throw error;
    }
  };

  // Handle closing special date modal
  const handleCloseSpecialDateModal = () => {
    console.log('🌟 SPECIAL DATE: Closing modal');
    setShowSpecialDateModal(false);
    setSelectedSpecialDate(null);
    setActionType(null);
  };

  // Handle staff toggle for add staff
  const handleStaffToggle = (staffName: string) => {
    setSelectedStaffForAdd(prev => 
      prev.includes(staffName) 
        ? prev.filter(name => name !== staffName)
        : [...prev, staffName]
    );
  };

  // Handle save staff changes
  const handleSaveStaffChanges = async () => {
    if (!selectedSpecialDate || !selectedShiftForAdd || !authCode) return;
    
    setIsUpdating(true);
    
    try {
      const result = await validatePasscode(authCode);
      if (!result || !result.isValid) return;
      const editorName = `${result.surname}, ${result.name}`;

      // Get current entries for this date and shift
      const dateEntries = groupedEntries[selectedSpecialDate] || [];
      const currentEntries = dateEntries.filter(entry => entry.shift_type === selectedShiftForAdd);
      const currentStaff = currentEntries.map(entry => entry.assigned_name);
      
      // Find staff to add and remove
      const staffToAdd = selectedStaffForAdd.filter(name => !currentStaff.includes(name));
      const staffToRemove = currentStaff.filter(name => !selectedStaffForAdd.includes(name));
      
      // Remove staff
      for (const entry of currentEntries) {
        if (staffToRemove.includes(entry.assigned_name)) {
          await deleteRosterEntry(entry.id);
        }
      }
      
      // Add new staff
      for (const staffName of staffToAdd) {
        await addRosterEntry({
          date: selectedSpecialDate,
          shiftType: selectedShiftForAdd,
          assignedName: staffName,
          changeDescription: `Added by ${editorName}`
        }, editorName);
      }
      
      // Skip manual refresh - Supabase real-time subscriptions will update automatically
      
      // Close modal and reset states
      handleCloseAuthModal();
      
    } catch (error) {
      console.error('Failed to update roster:', error);
      alert('Failed to update roster. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle closing auth modal
  const handleCloseAuthModal = () => {
    console.log('🔐 AUTH: Closing modal');
    setShowAuthModal(false);
    setAuthCode('');
    setAuthError('');
    setActionType(null);
    setSelectedSpecialDate(null);
    setSelectedShiftForAdd('');
    setSelectedStaffForAdd([]);
  };

  // Get the base name without (R) suffix
  const getBaseName = (name: string): string => {
    return name.replace(/\(R\)$/, '').trim();
  };

  // Get all staff for the multi-select interface
  const getFilteredAvailableStaff = (): string[] => {
    if (!selectedSpecialDate || !selectedShiftForAdd) {
      return availableStaff.filter(name => name !== 'ADMIN');
    }

    // For the multi-select interface, show all staff members
    // (they will be checked if already assigned)
    return sortByGroup(availableStaff.filter(name => name !== 'ADMIN'));
  };

  // Get filtered staff list
  const filteredAvailableStaff = getFilteredAvailableStaff();

  // Check if date is today
  const isToday = (dateString: string) => {
    const now = new Date();
    const today = now.getFullYear() + '-' + 
                  String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(now.getDate()).padStart(2, '0');
    return dateString === today;
  };
  
  // Check if date is in the past
  const isPastDate = (dateString: string) => {
    const now = new Date();
    const today = now.getFullYear() + '-' + 
                  String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(now.getDate()).padStart(2, '0');
    return dateString < today;
  };

  // Check if date is in the future
  const isFutureDate = (dateString: string) => {
    const now = new Date();
    const today = now.getFullYear() + '-' + 
                  String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(now.getDate()).padStart(2, '0');
    return dateString > today;
  };

  // Format date for table display
  const formatTableDate = (dateString: string) => {
    const date = new Date(dateString);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    
    return {
      dayName,
      dateString: `${day}-${month}-${year}`
    };
  };

  // Check if date has special info
  const getSpecialDateInfo = (date: string): string | undefined => {
    const dateEntries = groupedEntries[date] || [];
    for (const entry of dateEntries) {
      if (entry.change_description && entry.change_description.includes('Special Date:')) {
        const match = entry.change_description.match(/Special Date:\s*([^;]+)/);
        if (match && match[1].trim()) {
          return match[1].trim();
        }
      }
    }
    return undefined;
  };

  // Check if date is marked as special
  const isSpecialDate = (date: string) => {
    return getSpecialDateInfo(date) !== undefined;
  };


  return (
    <>
      {/* Month Navigation Header */}
      <div className="bg-white rounded-lg mb-4 px-2 py-3 shadow-md sticky top-[60px] z-[999]" style={{ borderBottom: '1px solid #e5e7eb', width: '100%' }}>
        <div className="flex items-center justify-between">
          {/* Export Button - Left edge */}
          <div className="flex items-center justify-center flex-shrink-0">
            <button
              onClick={onExportToCalendar}
              className="p-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors duration-200"
              title="Export to Calendar"
            >
              <Download className="w-3 h-3" />
            </button>
          </div>
          
          {/* Center Content - Calendar and Month (clickable) */}
          <div className="flex items-center justify-center flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors duration-200"
                title="Previous month"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <Calendar className="w-6 h-6 text-indigo-600 pointer-events-none" />
              
              {/* Clickable Month/Year Display */}
              <div className="ml-2 relative">
                <button
                  onClick={() => setShowMonthYearSelector(true)}
                  disabled={isRefreshing}
                  className="text-sm font-semibold text-gray-900 bg-transparent border-none outline-none cursor-pointer rounded px-2 py-1 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  style={{
                    minWidth: 'fit-content',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '140px',
                    fontSize: window.innerWidth <= 375 ? '12px' : '14px' // Smaller on iPhone SE and similar
                  }}
                >
                  {formatMonthYear()}
                </button>
              </div>
              <button
                onClick={() => navigateMonth('next')}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors duration-200"
                title="Next month"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Spinner/Dot - Right edge */}
          <div className="flex items-center justify-center flex-shrink-0">
            <button
              onClick={() => handleManualRefresh()}
              disabled={isRefreshing}
              className="p-2 rounded-lg text-gray-600 transition-colors duration-200 relative z-50 flex items-center justify-center"
              style={{
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                position: 'relative',
                zIndex: 50,
                // Force proper rendering after orientation change
                transform: 'translate3d(0,0,0)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                WebkitTransform: 'translate3d(0,0,0)',
                // iPhone specific fixes
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Manual refresh"
            >
              {/* Spinner Container */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                width: '20px',
                height: '20px',
                position: 'relative'
              }}>
                {/* Refresh icon with rotation animation when loading */}
                <svg 
                  style={{
                    width: '18px',
                    height: '18px',
                    animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                    transform: 'translate3d(0,0,0)',
                    backfaceVisibility: 'hidden'
                  }}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                  />
                </svg>
              </div>
              
              {/* Status Dot Container */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '12px',
                height: '12px',
                position: 'relative'
              }}>
                {/* Real-time status indicator */}
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: realtimeStatus === 'connected' ? '#10b981' : 
                                  realtimeStatus === 'connecting' ? '#f59e0b' :
                                  realtimeStatus === 'error' ? '#ef4444' : '#6b7280',
                  animation: realtimeStatus === 'connecting' ? 'pulse 1.5s ease-in-out infinite' : 'none',
                  boxShadow: realtimeStatus === 'connected' ? '0 0 8px rgba(16, 185, 129, 0.8)' : 'none',
                  backfaceVisibility: 'hidden'
                }} />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Table Content */}
      {loading || !hasLoadedData ? (
        <div className="bg-white" style={{
          width: '100vw',
          marginLeft: 'calc(-50vw + 50%)',
          marginRight: 'calc(-50vw + 50%)',
          overflowX: 'hidden'
        }}>
          <div className="flex flex-col items-center justify-center py-12" style={{ 
            height: window.innerWidth > window.innerHeight ? '60vh' : '70vh',
            minHeight: '400px',
            maxHeight: '80vh'
          }}>
            {/* Realistic Hourglass GIF */}
            <img 
              src="/anwh/RosterLoader.gif" 
              alt="Loading..."
              className="w-48 h-48 object-contain mb-4"
            />
            
            <p className="text-gray-500 text-sm font-medium animate-pulse">Loading roster entries...</p>
            <p className="text-gray-400 text-xs mt-2">Fetching latest data</p>
          </div>
        </div>
      ) : sortedEntries.length === 0 ? (
       <div className="text-center py-12 px-4" style={{ height: '70vh', minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg font-medium">No roster entries found</p>
          <p className="text-gray-400 text-sm mt-2">No entries available for this month</p>
        </div>
      ) : (
        <div className="bg-white" style={{
          width: '100%',
          padding: '16px 4px'
        }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'fixed'
            }}>
              <thead>
                <tr>
                  <th style={{
                    position: 'sticky',
                    top: '120px',
                    zIndex: 1000,
                    backgroundColor: '#000000',
                    color: 'white',
                    padding: '8px',
                    textAlign: 'center',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    border: '2px solid #374151',
                    width: '15%'
                  }}>
                    Date
                  </th>
                  <th style={{
                    position: 'sticky',
                    top: '120px',
                    zIndex: 1000,
                    backgroundColor: '#000000',
                    color: 'white',
                    padding: '8px',
                    textAlign: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    border: '2px solid #374151',
                    width: '21.25%'
                  }}>
                    9-4
                  </th>
                  <th style={{
                    position: 'sticky',
                    top: '120px',
                    zIndex: 1000,
                    backgroundColor: '#000000',
                    color: 'white',
                    padding: '8px',
                    textAlign: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    border: '2px solid #374151',
                    width: '21.25%'
                  }}>
                    12-10
                  </th>
                  <th style={{
                    position: 'sticky',
                    top: '120px',
                    zIndex: 1000,
                    backgroundColor: '#000000',
                    color: 'white',
                    padding: '8px',
                    textAlign: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    border: '2px solid #374151',
                    width: '21.25%'
                  }}>
                    4-10
                  </th>
                  <th style={{
                    position: 'sticky',
                    top: '120px',
                    zIndex: 1000,
                    backgroundColor: '#000000',
                    color: 'white',
                    padding: '8px',
                    textAlign: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    border: '2px solid #374151',
                    width: '21.25%'
                  }}>
                    N
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedEntries).map(([date, dateEntries]) => (
                  <tr key={date} data-date={date} style={{
                    backgroundColor: isToday(date) ? '#bbf7d0' : 
                                   isSpecialDate(date) ? '#fecaca' : 
                                   isPastDate(date) ? '#fef2f2' :
                                   isFutureDate(date) ? '#f0fdf4' : '#ffffff',
                    background: isToday(date) ? '#bbf7d0' : 
                               isSpecialDate(date) ? '#fecaca' : 
                               isPastDate(date) ? '#fef2f2' :
                               isFutureDate(date) ? '#f0fdf4' : '#ffffff'
                  }}>
                    <RosterDateCell
                      date={date}
                      isToday={isToday(date)}
                      isPastDate={isPastDate(date)}
                      isFutureDate={isFutureDate(date)}
                      onDoublePress={() => handleSpecialDateDoublePress(date)}
                      onLongPress={() => handleDateCellLongPress(date)}
                      isSpecialDate={isSpecialDate(date) && getSpecialDateInfo(date) !== undefined}
                      specialDateInfo={getSpecialDateInfo(date)}
                    />
                    
                    {shiftTypes.map(shiftType => {
                      const shiftEntries = dateEntries.filter(entry => entry.shift_type === shiftType);
                     
                     // Sort entries by center affiliation (from change_description), then seniority
                     const sortedShiftEntries = sortRosterEntriesByGroup(shiftEntries);
                      
                      return (
                        <td key={shiftType} style={{
                          padding: '0',
                          margin: '0',
                          textAlign: 'center',
                          minHeight: '50px',
                          border: '2px solid #374151',
                          position: 'relative',
                          width: '21.25%',
                          overflow: 'hidden',
                          cursor: 'pointer'
                        }}>
                          <div
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              zIndex: 5,
                              touchAction: 'manipulation',
                              backgroundColor: 'transparent',
                              border: 'none',
                              outline: 'none'
                            }}
                          />
                          
                          <div className="space-y-1 relative z-60" style={{ 
                            minHeight: '50px',
                            padding: '4px 2px'
                          }}>
                            {/* X watermark - only show for past dates AND when there are entries */}
                            {isPastDate(date) && shiftEntries.length > 0 && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                <div className="font-bold select-none" style={{
                                  fontSize: window.innerWidth > window.innerHeight ? 'clamp(1.5rem, 6vw, 3rem)' : 'clamp(3rem, 10vw, 6rem)',
                                  lineHeight: '1',
                                  color: '#fca5a5',
                                  opacity: 0.2,
                                  transform: 'scale(1.5)'
                                }}>
                                  X
                                </div>
                              </div>
                            )}
                            
                            {sortedShiftEntries.map((entry, index) => (
                              <RosterEntryCell
                                key={entry.id}
                                entry={entry}
                                onUpdate={handleEntryUpdate}
                                onShowDetails={handleShowDetails}
                                allEntriesForShift={sortedShiftEntries}
                                isSpecialDate={isSpecialDate(date)}
                                specialDateInfo={getSpecialDateInfo(date)}
                                availableStaff={availableStaff}
                                staffNicknames={staffNicknames}
                                registerRecentEdit={registerRecentEdit}
                                applyPendingUpdate={applyPendingUpdate}
                              />
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      )}

      {/* Authentication Modal */}
      {showAuthModal && createPortal(
        <div 
          className="fixed inset-0 bg-black bg-opacity-50"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2147483647, // Maximum z-index value
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            // CRITICAL: Prevent all scrolling
            overflow: 'auto',
            overflowY: 'auto',
            touchAction: 'pan-y',
            WebkitOverflowScrolling: 'touch',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseAuthModal();
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full"
            style={{
              userSelect: 'none',
              WebkitUserSelect: 'none',
              maxHeight: '90vh',
              maxWidth: '28rem',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#ffffff',
              zIndex: 2147483647,
              // Enable touch interactions within modal
              touchAction: 'auto',
              overflow: 'hidden',
              margin: '0'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '24px'
            }}>
              <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
                Authentication Required
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
                        inputMode="numeric"
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
              
              {/* Shift Selection - Show when admin code is valid and action is addStaff */}
              {actionType === 'addStaff' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Shift Type
                  </label>
                  <select
                    value={selectedShiftForAdd}
                    onChange={(e) => {
                      setSelectedShiftForAdd(e.target.value);
                      // Get current staff for this shift when selection changes
                      if (e.target.value && selectedSpecialDate) {
                        const dateEntries = groupedEntries[selectedSpecialDate] || [];
                        const currentEntries = dateEntries.filter(entry => entry.shift_type === e.target.value);
                        const currentStaff = currentEntries.map(entry => entry.assigned_name);
                        setSelectedStaffForAdd(currentStaff);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  >
                    <option value="">Select shift type</option>
                    {shiftTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="flex space-x-3">
                <button
                  onClick={handleCloseAuthModal}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={actionType === 'special' ? handleAuthSubmit : handleAuthSubmit}
                  disabled={authCode.length < 4 || isUpdating || (actionType === 'addStaff' && !selectedShiftForAdd)}
                  className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors duration-200"
                >
                  {actionType === 'special' ? 'Continue' : 'Continue'}
                </button>
              </div>
            </div>
          </div>
        </div>
        , document.body
      )}

      {/* Staff Selection Modal - Show after shift is selected */}
      {actionType === 'addStaff' && selectedSpecialDate && selectedShiftForAdd && authCode && !showAuthModal && createPortal(
        <div 
          className="fixed inset-0 bg-black bg-opacity-50"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2147483647, // Maximum z-index value
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            overflow: 'auto',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            userSelect: 'none',
            WebkitUserSelect: 'none'
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col" style={{
            maxWidth: '28rem',
            maxHeight: '90vh',
            margin: '0',
            userSelect: 'none',
            WebkitUserSelect: 'none'
          }}>
            <div className="border-b border-gray-200 flex-shrink-0" style={{
              padding: '24px',
              userSelect: 'none',
              WebkitUserSelect: 'none'
            }}>
              <h3 className="text-xl font-bold text-gray-900 mb-2 text-center select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
                Edit Staff Assignment
              </h3>
              <p className="text-sm text-gray-600 text-center select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
                {formatTableDate(selectedSpecialDate).dateString} ({new Date(selectedSpecialDate).toLocaleDateString('en-US', { weekday: 'long' })}) - {selectedShiftForAdd}
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto" style={{
              padding: '24px',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
              userSelect: 'none',
              WebkitUserSelect: 'none'
            }}>
              <div className="space-y-3">
                {filteredAvailableStaff.map(name => (
                  <label key={name} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={selectedStaffForAdd.includes(name)}
                      onChange={() => handleStaffToggle(name)}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <ScrollingText 
                        text={formatDisplayNameForUI(name)} 
                        className="text-sm font-medium text-gray-900 select-none"
                        scrollDuration={4}
                      />
                    </div>
                  </label>
                ))}
              </div>

            </div>
            
            <div className="border-t border-gray-200 flex-shrink-0" style={{
              padding: '24px',
              userSelect: 'none',
              WebkitUserSelect: 'none'
            }}>
              <div className="flex space-x-33">
                <button
                  onClick={handleCloseAuthModal}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 select-none"
                  style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveStaffChanges}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 flex items-center justify-center space-x-2 select-none"
                  style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                >
                  {isUpdating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span className="select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>Saving...</span>
                    </>
                  ) : (
                    <span className="select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>Save Changes</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
        , document.body
      )}

      {/* Month/Year Selector Modal */}
      {showMonthYearSelector && createPortal(
        <div 
          className="fixed inset-0 bg-black bg-opacity-50"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2147483647,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowMonthYearSelector(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full"
            style={{
              maxWidth: '28rem',
              userSelect: 'none',
              WebkitUserSelect: 'none'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">
                Select Month and Year
              </h3>
              
              <div className="space-y-4">
                {/* Month Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Month
                  </label>
                  <select
                    value={selectedDate.getMonth()}
                    onChange={(e) => {
                      const newMonth = parseInt(e.target.value);
                      handleMonthYearChange(newMonth, selectedDate.getFullYear());
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center"
                  >
                    {[
                      'January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'
                    ].map((month, index) => (
                      <option key={index} value={index}>{month}</option>
                    ))}
                  </select>
                </div>
                
                {/* Year Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Year
                  </label>
                  <select
                    value={selectedDate.getFullYear()}
                    onChange={(e) => {
                      const newYear = parseInt(e.target.value);
                      handleMonthYearChange(selectedDate.getMonth(), newYear);
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center"
                  >
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="mt-6">
                <button
                  onClick={() => setShowMonthYearSelector(false)}
                  className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
        , document.body
      )}

      {/* Special Date Modal */}
      <SpecialDateModal
        isOpen={showSpecialDateModal}
        date={selectedSpecialDate}
        currentSpecialInfo={{
          isSpecial: selectedSpecialDate ? isSpecialDate(selectedSpecialDate) : false,
          info: selectedSpecialDate ? (getSpecialDateInfo(selectedSpecialDate) || '') : ''
        }}
        onSave={handleSpecialDateSave}
        onClose={handleCloseSpecialDateModal}
        authCode={authCode}
      />

      {/* Edit Details Modal */}
      <EditDetailsModal
        isOpen={showModal}
        entry={selectedEntry}
        onClose={() => {
          setShowModal(false);
          setSelectedEntry(null);
        }}
      />
    </>
  );
};

