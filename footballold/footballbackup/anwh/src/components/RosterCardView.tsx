import React, { useState, useEffect } from 'react';
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Edit, FileText, Eye, EyeOff } from 'lucide-react';
import { RosterEntry, ShiftFilterType } from '../types/roster';
import { EditDetailsModal } from './EditDetailsModal';
import { RosterCardItem } from './RosterCardItem';
import { RosterDateHeaderButton } from './RosterDateHeaderButton';
import { ScrollingText } from './ScrollingText';
import { validatePasscode } from '../utils/passcodeAuth';
import { availableNames, shiftTypes, sortByGroup, authCodes, sortRosterEntriesByGroup } from '../utils/rosterAuth';
import { addRosterEntry, deleteRosterEntry } from '../utils/rosterApi';
import { extractBaseSurname } from '../utils/rosterFilters';
import { supabase } from '../lib/supabase';
import { getUserSession } from '../utils/indexedDB';
import { formatDisplayNameForUI } from '../utils/rosterDisplayName';

interface RosterCardViewProps {
  entries: RosterEntry[];
  loading: boolean;
  realtimeStatus: 'connecting' | 'connected' | 'error' | 'disconnected';
  onRefresh: () => Promise<void>;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  staffNicknames?: Record<string, string>;
  registerRecentEdit?: (entryId: string, updatedData?: Partial<RosterEntry>, applyUpdateLater?: boolean) => void;
  applyPendingUpdate?: (entryId: string, updatedData: Partial<RosterEntry>) => void;
}

export const RosterCardView: React.FC<RosterCardViewProps> = ({
  entries,
  loading,
  realtimeStatus = 'disconnected',
  onRefresh,
  selectedDate,
  onDateChange,
  staffNicknames,
  registerRecentEdit,
  applyPendingUpdate
}) => {
  // Listen for navigation events from parent components
  useEffect(() => {
    const handleNavigateToMonth = (event: CustomEvent) => {
      const { month, year } = event.detail;
      const newDate = new Date(year, month, 1);
      onDateChange(newDate);
    };

    window.addEventListener('navigateToMonth', handleNavigateToMonth as EventListener);
    return () => window.removeEventListener('navigateToMonth', handleNavigateToMonth as EventListener);
  }, [onDateChange]);


  // All hooks must be declared at the top level before any conditional returns
  const [selectedEntry, setSelectedEntry] = useState<RosterEntry | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [selectedShift, setSelectedShift] = useState<string>('');
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState('');
  const [refreshingDate, setRefreshingDate] = useState<string | null>(null);
  const [hasTabSwitched, setHasTabSwitched] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // For auth code visibility
  const [availableStaff, setAvailableStaff] = useState<string[]>([]);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const [actionType, setActionType] = useState<'special' | 'addStaff' | null>(null);

  const isMountedRef = useRef(true);

  // Track if we've loaded data at least once (prevents "no entries" flicker)
  useEffect(() => {
    if (!loading && entries.length > 0) {
      setHasLoadedData(true);
    }
    // Don't reset hasLoadedData to false - keep it true once we've loaded data
    // This prevents the flicker on initial load AND keeps spinner during refreshes
  }, [loading, entries.length]);

  // Filter entries based on selected date (show entries for the selected month)
  const filteredEntries = entries.filter(entry => {
    const entryDate = new Date(entry.date);
    return entryDate.getMonth() === selectedDate.getMonth() && 
           entryDate.getFullYear() === selectedDate.getFullYear();
  });

  // Track mounted status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch staff data once - EXCLUDE user 5274 (main admin) and filter by institution
  useEffect(() => {
    const fetchStaffData = async () => {
      try {
        // Get current user's institution - either from session or by fetching user data
        const { workScheduleDB } = await import('../utils/indexedDB');
        await workScheduleDB.init();
        const userSession = await workScheduleDB.getUserSession();
        let institutionCode: string | undefined = userSession?.institution_code;
        
        // If institution not in session, fetch user data from Supabase
        if (!institutionCode && userSession?.userId) {
          try {
            const { data: userData, error } = await supabase
              .from('staff_users')
              .select('institution_code')
              .eq('id', userSession.userId)
              .single();
            
            if (error) {
              // Error handled silently
            } else {
              institutionCode = userData?.institution_code;
            }
          } catch (err) {
            // Error handled silently
          }
        }
        
        // Build query with optional institution filter
        let query = supabase
          .from('staff_users')
          .select('*')
          .eq('is_active', true)
          .order('surname', { ascending: true });
        
        if (institutionCode) {
          query = query.eq('institution_code', institutionCode);
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
                        
            // Use roster_display_name if available, otherwise build from surname + ID
            // This ensures uniqueness for staff with same surname and matches table view
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
        // Error handled silently
      }
    };
    
    fetchStaffData();
  }, []);

  // Get the loadEntries function from the parent component
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
    
    // Set the clicked date as the refreshing date (or today if not specified)
    const refreshDate = clickedDate || new Date().toISOString().split('T')[0];
    setRefreshingDate(refreshDate);
    
    try {
      // Actually call the onRefresh function to reload data from database
      if (onRefresh) {
        await onRefresh();
      }
      setLastUpdateTime(new Date().toLocaleTimeString());
    } catch (error) {
      // Error handled silently
    } finally {
      setIsRefreshing(false);
      setRefreshingDate(null);
    }
  };

  // Add orientation change handler for card view
  useEffect(() => {
    const handleOrientationChange = () => {
      // Simple orientation change handling
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    return () => window.removeEventListener('orientationchange', handleOrientationChange);
  }, []);



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
            const todaySection = document.querySelector(`[data-date="${todayString}"]`);
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
      // Also refresh from server
      if (onRefresh) {
        onRefresh();
      }
    };

    window.addEventListener('rosterUpdated', handleRosterUpdate as EventListener);
    return () => window.removeEventListener('rosterUpdated', handleRosterUpdate as EventListener);
  }, [onRefresh]);

  // Sort entries by date in ascending order (oldest first)
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

  // Custom sorting function to sort entries with center attachments to bottom
  // Per spec: center affiliation must be detected exclusively from change_description field
  const sortStaffNames = (entries: RosterEntry[]): RosterEntry[] => {
    // Use sortRosterEntriesByGroup which handles center attachments from change_description
    return sortRosterEntriesByGroup(entries);
  };

  const getShiftColor = (shiftType: string) => {
    const colorMap: Record<string, string> = {
      'Morning Shift (9-4)': 'bg-red-100 text-red-800 border-red-200',
      'Evening Shift (4-10)': 'bg-blue-100 text-blue-800 border-blue-200',
      'Saturday Regular (12-10)': 'bg-gray-100 text-gray-800 border-gray-200',
      'Night Duty': 'bg-green-100 text-green-800 border-green-200',
      'Sunday/Public Holiday/Special': 'bg-purple-100 text-purple-800 border-purple-200'
    };
    return colorMap[shiftType] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // Format date for display (01-07-25)
  const formatCardDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${day}-${month}-${year}`;
  };

  // Group entries by shift type for each date
  const groupEntriesByShift = (dateEntries: RosterEntry[]) => {
    const shiftGroups: Record<string, RosterEntry[]> = {};
    
    dateEntries.forEach(entry => {
      if (!shiftGroups[entry.shift_type]) {
        shiftGroups[entry.shift_type] = [];
      }
      shiftGroups[entry.shift_type].push(entry);
    });
    
    // Sort each shift group to prioritize (R) names first
    Object.keys(shiftGroups).forEach(shiftType => {
      shiftGroups[shiftType] = sortStaffNames(shiftGroups[shiftType]);
    });
    
    return shiftGroups;
  };

  // Define shift order for consistent display
  const shiftOrder = [
    'Morning Shift (9-4)',
    'Saturday Regular (12-10)',
    'Evening Shift (4-10)',
    'Night Duty',
    'Sunday/Public Holiday/Special'
  ];

  // Handle showing details modal
  const handleShowDetails = (entry: RosterEntry) => {
    setSelectedEntry(entry);
    setShowModal(true);
  };

  const handleEntryUpdate = (updatedEntry: RosterEntry) => {
    // Check if component is still mounted before calling loadEntries
    if (!isMountedRef.current) {
      return;
    }
    
    // No need to manually refresh - Supabase realtime updates will handle it
  };

  // Handle edit button click
  const handleEditClick = (date: string) => {
    setEditingDate(date);
    setShowAuthModal(true);
  };

  // Handle authentication
  const handleAuthSubmit = async () => {
    const result = await validatePasscode(authCode);
    if (!result || !result.isValid) {
      setAuthError('Invalid passcode');
      return;
    }
    
    if (!result.isAdmin) {
      setAuthError('Admin access required for date editing');
      return;
    }
    
    setShowAuthModal(false);
    setAuthError('');
    
    // Get current staff for the selected date and shift (or all shifts if no specific shift)
    if (editingDate) {
      const dateEntries = groupedEntries[editingDate] || [];
      const currentEntries = selectedShift 
        ? dateEntries.filter(entry => entry.shift_type === selectedShift)
        : dateEntries; // All shifts if no specific shift selected
      const currentStaff = currentEntries.map(entry => entry.assigned_name);
      setSelectedStaff(currentStaff);
    }
  };

  // Handle staff selection change
  const handleStaffToggle = (staffName: string) => {
    setSelectedStaff(prev => 
      prev.includes(staffName) 
        ? prev.filter(name => name !== staffName)
        : [...prev, staffName]
    );
  };

  // Handle save changes
  const handleSaveChanges = async () => {
    if (!editingDate || !selectedShift || !authCode) return;
    
    setIsUpdating(true);
    
    try {
      const result = await validatePasscode(authCode);
      if (!result || !result.isValid) return;
      const editorName = `${result.surname}, ${result.name}`;

      // Get current entries for this date and shift
      const dateEntries = groupedEntries[editingDate] || [];
      const currentEntries = dateEntries.filter(entry => entry.shift_type === selectedShift);
      const currentStaff = currentEntries.map(entry => entry.assigned_name);
      
      // Find staff to add and remove
      const staffToAdd = selectedStaff.filter(name => !currentStaff.includes(name));
      const staffToRemove = currentStaff.filter(name => !selectedStaff.includes(name));
      
      // Remove staff
      for (const entry of currentEntries) {
        if (staffToRemove.includes(entry.assigned_name)) {
          await deleteRosterEntry(entry.id);
        }
      }
      
      // Add new staff
      for (const staffName of staffToAdd) {
        await addRosterEntry({
          date: editingDate,
          shiftType: selectedShift,
          assignedName: staffName,
          changeDescription: `Added by ${editorName}`
        }, editorName);
      }
      
      // Force immediate refresh and re-render
      if (onRefresh) {
        await onRefresh();
      }
      setRefreshKey(prev => prev + 1);
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('rosterUpdated', { 
        detail: { 
          type: 'bulk_edit',
          date: editingDate,
          shift: selectedShift,
          staffAdded: staffToAdd,
          staffRemoved: staffToRemove
        }
      }));
      
      handleCancelEdit();
      
    } catch (error) {
      alert('Failed to update roster. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingDate(null);
    setSelectedShift('');
    setSelectedStaff([]);
    setAuthCode('');
    setAuthError('');
    setShowAuthModal(false);
  };
  // Check if entry has been edited
  const hasBeenEdited = (entry: RosterEntry) => {
    // Simple logic: if last_edited_by exists, the entry has been edited
    return entry.change_description && 
           entry.change_description.includes('Name changed from') &&
           entry.last_edited_by;
  };

  // Check if date is today
  const isToday = (dateString: string) => {
    const now = new Date();
    // Force local timezone calculation to avoid iPhone timezone issues
    const today = now.getFullYear() + '-' + 
                  String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(now.getDate()).padStart(2, '0');
    return dateString === today;
  };
  
  // Check if date is in the past
  const isPastDate = (dateString: string) => {
    const now = new Date();
    // Force local timezone calculation to avoid iPhone timezone issues
    const today = now.getFullYear() + '-' + 
                  String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(now.getDate()).padStart(2, '0');
    return dateString < today;
  };

  // Check if date has special info
  const getSpecialDateInfo = (date: string) => {
    const dateEntries = groupedEntries[date] || [];
    for (const entry of dateEntries) {
      if (entry.change_description && entry.change_description.includes('Special Date:')) {
        const match = entry.change_description.match(/Special Date:\s*([^;]+)/);
        if (match && match[1].trim()) {
          return match[1].trim();
        }
      }
    }
    return null;
  };

  // Check if date is marked as special
  const isSpecialDate = (date: string) => {
    return getSpecialDateInfo(date) !== null;
  };

  // Get the base name without (R) suffix or roster display name suffix
  const getBaseName = (name: string): string => {
    return extractBaseSurname(name);
  };

  // Get filtered available staff for the current shift
  const getFilteredAvailableStaff = (): string[] => {
    // For the multi-select interface, show all staff members
    // (they will be checked if already assigned)
    return sortByGroup(availableStaff.filter(name => name !== 'ADMIN'));
  };

  // Get filtered staff list
  const filteredAvailableStaff = getFilteredAvailableStaff();

  return (
    <div className="bg-white rounded-lg overflow-hidden" style={{ 
      height: window.innerWidth > window.innerHeight ? '60vh' : '70vh', // Shorter in landscape
      minHeight: '400px',
      maxHeight: '80vh'
    }}>
        {loading || !hasLoadedData ? (
          <div className="flex flex-col items-center justify-center py-12 h-full" style={{ 
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
        ) : sortedEntries.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">
              {loading ? 'Loading roster entries...' : 'No roster entries found'}
            </p>
            <p className="text-gray-400 text-sm mt-2">
              {loading ? 'Please wait while we fetch the data' : 'No entries available'}
            </p>
          </div>
        ) : (
          <div className="h-full overflow-y-auto" style={{ 
            height: '100%',
            WebkitOverflowScrolling: 'touch' // Better mobile scrolling
          }}>
            {Object.entries(groupedEntries).map(([date, dateEntries]) => {
              const shiftGroups = groupEntriesByShift(dateEntries);
              
              return (
                <div key={date} data-date={date}>
                  {/* Sticky Date Header */}
                  <RosterDateHeaderButton
                    date={date}
                    onLongPress={() => {
                      setEditingDate(date);
                      setActionType('addStaff');
                      setSelectedShift(''); // Reset shift selection (like table view)
                      setSelectedStaff([]); // Reset staff selection
                      setShowAuthModal(true);
                      setAuthCode('');
                      setAuthError('');
                    }}
                    isToday={isToday}
                    realtimeStatus={realtimeStatus}
                   onManualRefresh={() => handleManualRefresh(date)}
                   isRefreshing={isRefreshing && refreshingDate === date}
                  />
                  
                  {/* Shift Tabs for this date */}
                  <div className="grid gap-2" style={{
                    gridTemplateColumns: window.innerWidth > window.innerHeight ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', // 4 columns in landscape
                    padding: window.innerWidth > window.innerHeight ? '8px' : '16px' // Less padding in landscape
                  }}>
                    {shiftOrder.map(shiftType => {
                      const shiftEntries = shiftGroups[shiftType];
                      if (!shiftEntries || shiftEntries.length === 0) return null;
                      
                      return (
                        <div key={shiftType} className="bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm min-w-0 flex-1 relative">
                          {/* Shift Header */}
                          <div className={`text-center font-bold ${getShiftColor(shiftType)}`} style={{
                            padding: window.innerWidth > window.innerHeight ? '4px' : '8px', // Less padding in landscape
                            fontSize: window.innerWidth > window.innerHeight ? '10px' : '12px' // Smaller text in landscape
                          }}>
                            <ScrollingText 
                              text={shiftType === 'Morning Shift (9-4)' ? 'Shift 9-4' :
                                   shiftType === 'Saturday Regular (12-10)' ? 'Shift 12-10' :
                                   shiftType === 'Evening Shift (4-10)' ? 'Shift 4-10' :
                                   shiftType === 'Night Duty' ? 'Night Duty' :
                                   shiftType === 'Sunday/Public Holiday/Special' ? 'Special 9-4' : shiftType}
                              className="font-bold"
                            />
                          </div>
                          
                          {/* Names List */}
                          <div className="space-y-1 relative" style={{ 
                            zIndex: 30, 
                            minHeight: window.innerWidth > window.innerHeight ? '60px' : '80px', // Shorter in landscape
                            position: 'relative',
                            padding: window.innerWidth > window.innerHeight ? '4px' : '8px' // Less padding in landscape
                          }}>
                            {/* X watermark - centered over names area only */}
                            {isPastDate(date) && (
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
                            
                            {shiftEntries.map((entry, index) => (
                             <div key={entry.id} className="relative" style={{ zIndex: 30 }}>
                                <RosterCardItem
                                  entry={entry}
                                  onShowDetails={handleShowDetails}
                                  onUpdate={handleEntryUpdate}
                                  allEntriesForShift={shiftEntries}
                                  isSpecialDate={isSpecialDate(date)}
                                  specialDateInfo={getSpecialDateInfo(date)}
                                  availableStaff={availableStaff}
                                  staffNicknames={staffNicknames}
                                  registerRecentEdit={registerRecentEdit}
                                  applyPendingUpdate={applyPendingUpdate}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {/* Add CSS for refresh animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 0.8;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
        }
        @keyframes scroll-text {
          0% { transform: translateX(0%); }
          25% { transform: translateX(0%); }
          75% { transform: translateX(-100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>

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
            alignItems: window.innerWidth > window.innerHeight ? 'flex-start' : 'center',
            justifyContent: 'center',
            padding: window.innerWidth > window.innerHeight ? '8px' : '16px',
            paddingTop: window.innerWidth > window.innerHeight ? '4px' : '16px',
            overflow: 'auto',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y'
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{
            maxWidth: window.innerWidth > window.innerHeight ? '90vw' : '28rem',
            maxHeight: window.innerWidth > window.innerHeight ? '95vh' : 'none',
            margin: window.innerWidth > window.innerHeight ? '4px 0' : '16px 0'
          }}>
            <div style={{
              padding: window.innerWidth > window.innerHeight ? '12px' : '24px'
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
                        // Disable browser's built-in password reveal
                        spellCheck="false"
                        autoCorrect="off"
                        autoCapitalize="off"
                        inputMode="numeric"
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
                    value={selectedShift}
                    onChange={(e) => {
                      setSelectedShift(e.target.value);
                      // Get current staff for this shift when selection changes
                      if (e.target.value && editingDate) {
                        const dateEntries = groupedEntries[editingDate] || [];
                        const currentEntries = dateEntries.filter(entry => entry.shift_type === e.target.value);
                        const currentStaff = currentEntries.map(entry => entry.assigned_name);
                        setSelectedStaff(currentStaff);
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                  onClick={handleCancelEdit}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAuthSubmit}
                  disabled={authCode.length < 4 || !selectedShift}
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

      {/* Staff Selection Modal - Show after shift is selected */}
      {actionType === 'addStaff' && editingDate && selectedShift && authCode && !showAuthModal && createPortal(
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
            alignItems: window.innerWidth > window.innerHeight ? 'flex-start' : 'center',
            justifyContent: 'center',
            padding: window.innerWidth > window.innerHeight ? '8px' : '16px',
            paddingTop: window.innerWidth > window.innerHeight ? '4px' : '16px',
            overflow: 'auto',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            userSelect: 'none',
            WebkitUserSelect: 'none'
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col" style={{
            maxWidth: window.innerWidth > window.innerHeight ? '90vw' : '28rem',
            maxHeight: window.innerWidth > window.innerHeight ? '95vh' : '90vh',
            margin: window.innerWidth > window.innerHeight ? '4px 0' : '16px 0',
            userSelect: 'none',
            WebkitUserSelect: 'none'
          }}>
            <div className="border-b border-gray-200 flex-shrink-0" style={{
              padding: window.innerWidth > window.innerHeight ? '12px' : '24px',
              userSelect: 'none',
              WebkitUserSelect: 'none'
            }}>
              <h3 className="text-xl font-bold text-gray-900 mb-2 text-center select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
                Edit Staff Assignment
              </h3>
              <p className="text-sm text-gray-600 text-center select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
                {formatCardDate(editingDate)} ({new Date(editingDate).toLocaleDateString('en-US', { weekday: 'long' })}){selectedShift ? ` - ${selectedShift}` : ''}
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto" style={{
              padding: window.innerWidth > window.innerHeight ? '12px' : '24px',
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
                      checked={selectedStaff.includes(name)}
                      onChange={() => handleStaffToggle(name)}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-900 select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>{formatDisplayNameForUI(name)}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="border-t border-gray-200 flex-shrink-0" style={{
              padding: window.innerWidth > window.innerHeight ? '12px' : '24px',
              userSelect: 'none',
              WebkitUserSelect: 'none'
            }}>
              <div className="flex space-x-3">
                <button
                  onClick={handleCancelEdit}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 select-none"
                  style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveChanges}
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

      {/* Edit Details Modal */}
      <EditDetailsModal
        isOpen={showModal}
        entry={selectedEntry}
        onClose={() => {
          setShowModal(false);
          setSelectedEntry(null);
        }}
      />
    </div>
  );
};