import React, { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import ConfirmationModal from './ConfirmationModal'
import { ClearMonthModal } from './ClearMonthModal'
import { RosterPlanner } from './RosterPlanner'
import { RosterMobilePlanner } from './RosterMobilePlanner'
import { StaffManagementModal } from './StaffManagementModal'
import { MonthlyReportsModal } from './MonthlyReportsModal'
import { BatchPrintModal } from './BatchPrintModal'
import { PDFImportModal } from './PDFImportModal'
import { RegistrationApprovalModal } from './RegistrationApprovalModal'
import { PostingSelectorModal } from './PostingSelectorModal'
import { AttachedCentersModal } from './AttachedCentersModal'
import { Notification } from './Notification'
import { clearAllRosterEntries, clearMonthRosterEntries, addRosterEntry } from '../utils/rosterApi'
import { Download, Upload, Trash2, FileText, Printer, Users, Server, Wrench, MapPin, CheckCircle, AlertTriangle, User, LayoutTemplate } from 'lucide-react'
import { RosterEntry } from '../types/roster'
import { pdfExporter } from '../utils/pdfExport';
import { getUserSession } from '../utils/indexedDB';
import { StaffUser } from '../types'

// Helper function to format date as ddd dd-mmm-yyyy HH:MM
const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'never'
  
  try {
    const date = new Date(dateString)
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    const dayName = days[date.getDay()]
    const day = date.getDate().toString().padStart(2, '0')
    const month = months[date.getMonth()]
    const year = date.getFullYear()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    
    return `${dayName} ${day}-${month}-${year} ${hours}:${minutes}`
  } catch {
    return dateString // fallback to original string if parsing fails
  }
}

const AdminPanel: React.FC = () => {
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [staffToDelete, setStaffToDelete] = useState<{id: string, name: string} | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Quick Actions state
  const [showQuickActions, setShowQuickActions] = useState(false)
  const [showStaffManagement, setShowStaffManagement] = useState(false)
  const [showMonthlyReports, setShowMonthlyReports] = useState(false)
  const [showBatchPrint, setShowBatchPrint] = useState(false)
  const [showPDFImport, setShowPDFImport] = useState(false)
  const [showRosterPlanner, setShowRosterPlanner] = useState(false)
  const [showRosterMobilePlanner, setShowRosterMobilePlanner] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showInstitutionSelect, setShowInstitutionSelect] = useState(false)
  const [selectedInstitutionForClear, setSelectedInstitutionForClear] = useState<string>('current')
  const [previousInstitution, setPreviousInstitution] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [isExportingPDF, setIsExportingPDF] = useState(false)
  const [showPDFExportConfirm, setShowPDFExportConfirm] = useState(false)
  const [clearType, setClearType] = useState<'all' | 'month'>('all')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [isClearing, setIsClearing] = useState(false)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false)
  const [adminAuthCode, setAdminAuthCode] = useState('')
  const [authError, setAuthError] = useState('')
  const [rosterEntries, setRosterEntries] = useState<RosterEntry[]>([])
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null)
  const [showRegistrationApproval, setShowRegistrationApproval] = useState(false)
  const [showPostingSelector, setShowPostingSelector] = useState(false)
  const [currentPostingInstitution, setCurrentPostingInstitution] = useState<string | null>(null)
  const [showAttachedCenters, setShowAttachedCenters] = useState(false);
    
  // Helper function to detect and format Supabase connectivity errors
  const handleSupabaseError = (error: any, context: string): string => {
    // Error logged for debugging
      
    // Check for network/connectivity related errors
    const errorMessage = error?.message || '';
    const errorName = error?.name || '';
      
    // Common connectivity error patterns
    const connectivityPatterns = [
      'Failed to fetch',
      'NetworkError',
      'Network request failed',
      'Load failed',
      'TypeError',
      'fetch failed',
      'connection',
      'timeout',
      'network'
    ];
      
    const isConnectivityError = 
      connectivityPatterns.some(pattern => 
        errorMessage.toLowerCase().includes(pattern.toLowerCase()) ||
        errorName.toLowerCase().includes(pattern.toLowerCase())
      ) ||
      !navigator.onLine; // Browser reports offline
      
    if (isConnectivityError) {
      return 'Please check your connectivity and try again.';
    }
      
    // For other errors, show a generic message
    return `Failed to ${context}. Please try again.`;
  };
  
  // Sort state for Staff Directory (admin 5274 only)
  const [sortBy, setSortBy] = useState<'last_login' | 'institution'>('last_login')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [filterInstitution, setFilterInstitution] = useState<string>('all')

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      // Get current logged-in user from IndexedDB (not localStorage!)
      const session = await getUserSession();
      
      if (!session) {
        setCurrentUser(null);
        setCurrentPostingInstitution(null);
        return; // Early return if no session
      }
      
      // Fetch current user details from Supabase
      const { data: userData, error: userError } = await supabase
        .from('staff_users')
        .select('*')
        .eq('id', session.userId)
        .single();
      
      if (userError) {
        // Fallback: use session data directly if Supabase fails
        setCurrentUser({
          id: session.userId,
          id_number: session.idNumber,
          surname: session.surname,
          name: session.name,
          is_admin: session.isAdmin
        } as StaffUser);
        // Can't get institution from fallback, but at least button will show for 5274
      } else {
        setCurrentUser(userData || null);
        setCurrentPostingInstitution(userData?.posting_institution || userData?.institution_code || null);
      }
      
      // Fetch staff users - only select columns that exist
      let query = supabase.from('staff_users').select('id, surname, name, id_number, last_login, is_admin, is_active, institution_code');
      
      // Filter by institution for non-main-admin users
      if (userData?.id_number !== '5274') {
        // Institution admins should only see staff from their own institution
        const userInstitution = userData?.institution_code || userData?.posting_institution;
        if (userInstitution) {
          query = query.eq('institution_code', userInstitution);
        }
      }
      
      const { data, error } = await query.order('last_login', { ascending: false });
      if (error) throw error
      if (data) setStaff(data)
      
      // Skip system_settings fetch - login is always enabled
    } catch (err: any) {
      setError(err.message || 'Failed to load admin panel data')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { 
    fetchData() 
  }, [])
  
  // Listen for session changes (login/logout)
  useEffect(() => {
    const handleSessionChange = async () => {
      // Get the current session directly from IndexedDB
      const session = await getUserSession();
      
      await fetchData();
    };
    
    window.addEventListener('sessionChanged', handleSessionChange);
    return () => window.removeEventListener('sessionChanged', handleSessionChange);
  }, []);
  
  // Listen for posting changes and refresh user data
  useEffect(() => {
    const handlePostingChange = async () => {
      await fetchData();
    };
    
    window.addEventListener('userPostingChanged', handlePostingChange);
    return () => window.removeEventListener('userPostingChanged', handlePostingChange);
  }, []);
  
  // Listen for staff list changes (from StaffManagementModal) and refresh
  useEffect(() => {
    const handleStaffListChange = async () => {
      await fetchData();
    };
    
    window.addEventListener('staffListChanged', handleStaffListChange);
    return () => window.removeEventListener('staffListChanged', handleStaffListChange);
  }, []);

  // Refresh roster entries with institution filtering
  const refreshRosterEntries = async () => {
    try {
      const { data } = await supabase
        .from('roster_entries')
        .select('*')
        .order('date', { ascending: true });
      
      if (data) {
        const session = await getUserSession();
        if (session?.idNumber) {
          const { getCurrentInstitutionDetails } = await import('../utils/institutionHelper');
          const institution = await getCurrentInstitutionDetails();
          const userInstitution = institution?.code;
          
          if (userInstitution) {
            // Fetch ALL staff from this institution
            const { data: institutionStaff } = await supabase
              .from('staff_users')
              .select('id, surname, name, roster_display_name')
              .eq('institution_code', userInstitution)
              .eq('is_active', true);
            
            // Create a Set of valid roster_display_names from THIS institution
            const validRosterNames = new Set(
              institutionStaff?.map((s: any) => s.roster_display_name).filter(Boolean) || []
            );
            
            // Filter entries - only keep those where assigned_name matches someone from OUR institution
            const filtered = data.filter((entry: any) => {
              // Strip (R) suffix for matching (no marker to strip since we don't store it)
              const baseAssignedName = entry.assigned_name.replace(/\(R\)$/, '').trim();
              return validRosterNames.has(baseAssignedName);
            });
            
            setRosterEntries(filtered);
            return filtered;
          }
        }
        setRosterEntries(data);
        return data;
      }
    } catch (error) {
      // Error refreshing roster entries
    }
    return [];
  };

  // Add listener for when user re-opens the modal to refresh data
  useEffect(() => {
    const handleFocus = async () => {
      await fetchData();
      // Also refresh roster entries
      const { data } = await supabase
        .from('roster_entries')
        .select('*')
        .order('date', { ascending: true });
      if (data) {
        // Re-apply filtering logic
        const session = await getUserSession();
        if (session?.idNumber) {
          const { getCurrentInstitutionDetails } = await import('../utils/institutionHelper');
          const institution = await getCurrentInstitutionDetails();
          const userInstitution = institution?.code;
          
          if (userInstitution) {
            const { data: institutionStaff } = await supabase
              .from('staff_users')
              .select('id, surname, name, roster_display_name')
              .eq('institution_code', userInstitution)
              .eq('is_active', true);
            
            const institutionStaffIds = new Set(
              institutionStaff?.map((s: any) => s.id) || []
            );
            
            const entryNames = Array.from(new Set(
              data.map((entry: any) => entry.assigned_name.replace(/\(R\)$/, '').trim())
            ));
            
            // Fetch staff_users for these names WITH institution filter
            const { data: matchedStaff } = await supabase
              .from('staff_users')
              .select('id, surname, name, roster_display_name, institution_code')
              .in('roster_display_name', entryNames)
              .eq('institution_code', userInstitution);  // ← CRITICAL: Only match staff from THIS institution
            
            // Create a Set of valid roster_display_names from THIS institution
            const validRosterNames = new Set(
              matchedStaff?.map((s: any) => s.roster_display_name) || []
            );
            
            // Filter entries - only keep those where assigned_name matches someone from OUR institution
            const filtered = data.filter((entry: any) => {
              const baseAssignedName = entry.assigned_name
                .replace(/\(R\)$/, '')  // Remove (R) suffix
                .replace(/^\*+/, '');   // Remove marker prefix (*, **, ***)
              return validRosterNames.has(baseAssignedName);
            });
            
            setRosterEntries(filtered);
          }
        }
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const toggleStaffAccess = async (staffId: string, currentActiveStatus: boolean) => {
    try {
      await supabase.from('staff_users').update({ is_active: !currentActiveStatus }).eq('id', staffId)
      // Refresh the staff list
      fetchData()
    } catch (error) {
      // Error updating staff access
    }
  }

  const deleteStaff = async (staffId: string, staffName: string) => {
    setStaffToDelete({ id: staffId, name: staffName });
    setShowDeleteModal(true);
  }

  const handleDeleteConfirm = async () => {
    if (!staffToDelete) return;
    
    try {
      await supabase.from('staff_users').delete().eq('id', staffToDelete.id)
      // Refresh the staff list
      fetchData()
      setShowDeleteModal(false);
      setStaffToDelete(null);
    } catch (error) {
      // Error deleting staff
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setStaffToDelete(null);
  }

  // Fetch roster entries for reports - only runs once on mount
  // Focus listener handles refresh when tab gains focus
  useEffect(() => {
    const fetchRosterEntries = async () => {
      try {
        const { data, error } = await supabase
          .from('roster_entries')
          .select('*')
          .order('date', { ascending: true });
        
        if (error) throw error;
        
        if (data) {
          // Wait a bit for institution details to load
          setTimeout(async () => {
            const session = await getUserSession();
            if (session?.idNumber) {
              const { getCurrentInstitutionDetails } = await import('../utils/institutionHelper');
              const institution = await getCurrentInstitutionDetails();
              const userInstitution = institution?.code;
              
              if (userInstitution) {
                // Fetch ALL staff from this institution with their ID
                const { data: institutionStaff } = await supabase
                  .from('staff_users')
                  .select('id, surname, name, roster_display_name')
                  .eq('institution_code', userInstitution)
                  .eq('is_active', true);
                
                // Create a Map: roster_display_name -> staff record from THIS institution
                const institutionStaffMap = new Map<string, any>();
                institutionStaff?.forEach((staff: any) => {
                  if (staff.roster_display_name) {
                    institutionStaffMap.set(staff.roster_display_name, staff);
                  }
                });
                
                // Extract unique staff names from roster entries (strip (R) suffix)
                const entryNames = Array.from(new Set(
                  data.map((entry: any) => entry.assigned_name.replace(/\(R\)$/, '').trim())
                ));
                
                // Fetch staff_users for these names WITH institution filter
                const { data: matchedStaff } = await supabase
                  .from('staff_users')
                  .select('id, surname, name, roster_display_name, institution_code')
                  .in('roster_display_name', entryNames)
                  .eq('institution_code', userInstitution);
                
                // Create a Set of valid roster_display_names from THIS institution
                const validRosterNames = new Set(
                  matchedStaff?.map((s: any) => s.roster_display_name) || []
                );
                
                // Filter entries - only keep those where assigned_name matches someone from OUR institution
                const filtered = data.filter((entry: any) => {
                  const baseAssignedName = entry.assigned_name
                    .replace(/\(R\)$/, '')  // Remove (R) suffix
                    .replace(/^\*+/, '');   // Remove marker prefix (*, **, ***)
                  return validRosterNames.has(baseAssignedName);
                });
                
                setRosterEntries(filtered);
              } else {
                setRosterEntries(data);
              }
            } else {
              setRosterEntries(data);
            }
          }, 100); // Small delay to ensure institution is loaded
        }
      } catch (error) {
        // Error fetching roster entries
      }
    };
    
    fetchRosterEntries();
  }, []); // Runs once on mount

  // Quick Actions Handlers
  const handleClearDatabase = async () => {
    setIsClearing(true)
    try {
      // Determine which institution code to use based on selection
      const institutionToUse = selectedInstitutionForClear === 'current' ? currentUser?.institution_code : null
      
      if (clearType === 'all') {
        await clearAllRosterEntries(institutionToUse || undefined)
      } else {
        await clearMonthRosterEntries(selectedYear, selectedMonth, institutionToUse || undefined)
      }
      // Show success toast notification
      const scopeText = selectedInstitutionForClear === 'current' && currentUser?.institution_code 
        ? `${currentUser.institution_code} only` 
        : 'all institutions'
      setNotification({
        message: `✅ Successfully cleared ${clearType === 'all' ? 'all roster data' : 'month data'} for ${scopeText}`,
        type: 'success'
      })
      setShowClearConfirm(false)
      setShowQuickActions(false)
    } catch (error) {
      // Show error toast notification
      setNotification({
        message: '❌ Failed to clear data. Please try again.',
        type: 'error'
      })
    } finally {
      setIsClearing(false)
    }
  }

  const handlePDFImport = async (entries: any[], editorName: string) => {
    try {
      // Enable batch import mode to suppress individual notifications
      (window as any).batchImportMode = true;
      (window as any).disableAutoScroll = true;
      (window as any).batchImportStats = {
        count: 0,
        staffName: editorName || 'Unknown',
        dates: new Set<string>()
      };
      
      let successCount = 0;
      let errorCount = 0;
      let duplicateCount = 0;
      let updatedCount = 0;
      
      // Fetch existing entries for the imported dates to check for duplicates
      const importedDates = new Set(entries.map(e => e.date));
      
      const { data: existingEntries } = await supabase
        .from('roster_entries')
        .select('date, shift_type, assigned_name, change_description')
        .in('date', Array.from(importedDates));
      
      // Create a set of existing entries for quick lookup
      const existingSet = new Set<string>();
      // Track original PDF names that were manually changed
      const changedOriginalNames = new Map<string, string>(); // key: "date-shiftType-originalName" -> "currentName"
      
      if (existingEntries) {
        existingEntries.forEach((entry: any) => {
          const key = `${entry.date}-${entry.shift_type}-${entry.assigned_name}`;
          existingSet.add(key);
          
          // Check if this entry was originally from PDF but manually changed
          if (entry.change_description) {
            const originalPdfMatch = entry.change_description.match(/\(Original PDF: ([^)]+)\)/);
            if (originalPdfMatch) {
              let originalPdfName = originalPdfMatch[1].trim();
              
              // Fix missing closing parenthesis if it exists
              if (originalPdfName.includes('(R') && !originalPdfName.includes('(R)')) {
                originalPdfName = originalPdfName.replace('(R', '(R)');
              }
              
              // Store mapping for exact name match
              const changeKey = `${entry.date}-${entry.shift_type}-${originalPdfName}`;
              changedOriginalNames.set(changeKey, entry.assigned_name);
              
              // ALSO store mapping for base name (without (R) suffix)
              // This handles cases where PDF has "PITTEA" but original was "PITTEA(R)" or vice versa
              const baseName = originalPdfName.replace(/\(R\)$/, '').trim();
              if (baseName !== originalPdfName) {
                const baseChangeKey = `${entry.date}-${entry.shift_type}-${baseName}`;
                changedOriginalNames.set(baseChangeKey, entry.assigned_name);
              }
            }
          }
        });
      }
      
      for (const entry of entries) {
        try {
          // Check if this entry already exists
          const entryKey = `${entry.date}-${entry.shiftType}-${entry.assignedName}`;
          
          // Check if this name was originally from PDF but manually changed to someone else
          const changeCheckKey = `${entry.date}-${entry.shiftType}-${entry.assignedName}`;
          if (changedOriginalNames.has(changeCheckKey)) {
            duplicateCount++;
            continue; // Skip this entry - it was manually replaced
          }
          
          // Pass isPdfImport=true to allow updating existing entries with marker info
          const result = await addRosterEntry(entry, editorName, true);
          
          // Track the result status
          if (result.status === 'skipped') {
            duplicateCount++;
          } else if (result.status === 'updated') {
            updatedCount++;
          } else if (result.status === 'added') {
            successCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }
      
      // Disable batch import mode
      (window as any).batchImportMode = false;
      (window as any).disableAutoScroll = false;
      
      setShowPDFImport(false);
      setShowQuickActions(false);
      
      // Refresh roster to show imported entries
      await refreshRosterEntries();
      
      // Show success notification with duplicate count
      const skippedMessage = duplicateCount > 0 ? ` (${duplicateCount} duplicate${duplicateCount > 1 ? 's' : ''} skipped)` : '';
      const updatedMessage = updatedCount > 0 ? `, ${updatedCount} updated` : '';
      
      setNotification({
        message: `✅ PDF import completed: ${successCount} entries added${updatedMessage}${errorCount > 0 ? `, ${errorCount} failed` : ''}${skippedMessage}`,
        type: errorCount > 0 ? 'error' : 'success'
      });
      

    } catch (error) {
      (window as any).batchImportMode = false;
      (window as any).batchImportStats = null;
      
      setNotification({
        message: 'Failed to import PDF data.',
        type: 'error'
      });
    }
  }

  const handleExportToPDF = async () => {
    setShowPDFExportConfirm(true)
  }

  const handleConfirmPDFExport = async () => {
    setShowPDFExportConfirm(false)
    setIsExportingPDF(true)
    try {
      // Export current month's data by default
      const currentDate = new Date()
      await pdfExporter.exportToPDF({
        entries: rosterEntries,
        month: currentDate.getMonth(),
        year: currentDate.getFullYear(),
        title: 'Roster Schedule'
      })
      setNotification({
        message: '✅ PDF ready! Use Share/Save to download.',
        type: 'success'
      })
      setShowQuickActions(false)
    } catch (error) {
      setNotification({
        message: 'Failed to export PDF.',
        type: 'error'
      })
    } finally {
      setIsExportingPDF(false)
    }
  }

  const handleCancelPDFExport = () => {
    setShowPDFExportConfirm(false)
  }

  const handleToggleMaintenanceMode = async () => {
    setConfirmMaintenanceModal(true)
  }

  const handleConfirmMaintenanceToggle = async () => {
    setConfirmMaintenanceModal(false)
    
    try {
      const { error } = await supabase
        .from('metadata')
        .upsert({ key: 'maintenanceMode', value: !maintenanceMode }, { onConflict: 'key' })
        .eq('key', 'maintenanceMode')
      
      if (error) throw error
      
      // Don't reload - just update local state
      setMaintenanceMode(!maintenanceMode)
      setNotification({
        message: `Maintenance Mode ${!maintenanceMode ? 'ENABLED' : 'DISABLED'}!`,
        type: 'success'
      })
    } catch (error) {
      setNotification({
        message: 'Failed to toggle maintenance mode.',
        type: 'error'
      })
    }
  }

  const handleCancelMaintenanceToggle = () => {
    setConfirmMaintenanceModal(false)
  }

  // Handle posting institution change
  const handlePostingChanged = (newInstitution: string) => {
    setCurrentPostingInstitution(newInstitution);
    setNotification({
      message: `✅ Switched to ${newInstitution} - Refreshing data...`,
      type: 'success'
    });
    
    // Dispatch event to notify other components that user posting changed
    window.dispatchEvent(new CustomEvent('userPostingChanged', { detail: { institution: newInstitution } }));
    
    // No need to reload page - IndexedDB session persists and data will refresh automatically
    // via the userPostingChanged event listener in useRosterData
  };

  // Fetch maintenance mode status and subscribe to realtime changes
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [confirmMaintenanceModal, setConfirmMaintenanceModal] = useState(false)
  
  useEffect(() => {
    // Add pulse animation styles on mount
    const style = document.createElement('style');
    style.id = 'admin-panel-pulse-animation';
    style.textContent = `
      @keyframes pulse {
        0%, 100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.6;
          transform: scale(1.1);
        }
      }
    `;
    document.head.appendChild(style);
    
    const fetchMaintenanceMode = async () => {
      const { data, error } = await supabase
        .from('metadata')
        .select('value')
        .eq('key', 'maintenanceMode')
        .single()
      
      if (data) setMaintenanceMode(data.value)
    }
    
    fetchMaintenanceMode()
    
    // Subscribe to realtime changes for maintenance mode
    const channel = supabase
      .channel('maintenance-mode-admin')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'metadata',
          filter: 'key=eq.maintenanceMode'
        },
        (payload: any) => {
          setMaintenanceMode(payload.new?.value === true)
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
      // Clean up animation styles
      const existingStyle = document.getElementById('admin-panel-pulse-animation');
      if (existingStyle) {
        existingStyle.remove();
      }
    }
  }, [])

  // Sort staff based on selected criteria (all admins)
  const sortedAndFilteredStaff = useMemo(() => {
    // Filter out current user (5274) and admin-5274
    let filtered = staff.filter(s => s.id_number !== '5274' && s.id_number !== 'admin-5274');
    
    // Apply institution filter for non-5274 admins
    if (currentUser?.id_number !== '5274' && currentUser?.institution_code) {
      // For other admins, show only their institution
      filtered = filtered.filter(s => s.institution_code === currentUser.institution_code);
    } else if (currentUser?.id_number === '5274' && filterInstitution !== 'all') {
      // Admin 5274 can filter by specific institution
      filtered = filtered.filter(s => s.institution_code === filterInstitution);
    }
    
    // Apply sorting for ALL admins (not just 5274)
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch(sortBy) {
        case 'last_login':
          // Handle "never" logins - they should always go to the bottom
          const aHasLogin = !!a.last_login;
          const bHasLogin = !!b.last_login;
          
          // If one has login and other doesn't, prioritize the one with login
          if (aHasLogin && !bHasLogin) return -1;
          if (!aHasLogin && bHasLogin) return 1;
          
          // If both have no login, sort by surname
          if (!aHasLogin && !bHasLogin) {
            return a.surname.toLowerCase().localeCompare(b.surname.toLowerCase());
          }
          
          // Both have login - sort by date
          const dateA = new Date(a.last_login!).getTime();
          const dateB = new Date(b.last_login!).getTime();
          comparison = dateA - dateB;
          break;
        case 'institution':
          const instA = (a.institution_code || '').toLowerCase();
          const instB = (b.institution_code || '').toLowerCase();
          comparison = instA.localeCompare(instB);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [staff, currentUser, sortBy, sortOrder, filterInstitution]);

  return (
    <>
      <div style={{ 
        border: '1px solid #e5e7eb', 
        borderRadius: 0, // Remove rounded corners to match other tabs
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        width: 'calc(100% + 2rem)',
        maxWidth: 'calc(100% + 2rem)',
        marginLeft: '-1rem',
        marginRight: '-1rem',
        minHeight: 'calc(100vh - 140px)', // Full height minus header
        background: 'white',
        position: 'relative',
        zIndex: 1,
        boxSizing: 'border-box'
      }}>
        {/* Notification Component */}
        {notification && (
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        )}
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
          <h3 style={{ margin: 0 }}>Admin Panel</h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: '6px',
            backgroundColor: maintenanceMode ? '#fee2e2' : '#dcfce7',
            fontSize: '12px',
            fontWeight: 500
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: maintenanceMode ? '#dc2626' : '#16a34a',
              animation: 'pulse 2s infinite'
            }} />
            <span style={{ color: maintenanceMode ? '#991b1b' : '#166534' }}>
              Maintenance: {maintenanceMode ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
        
        {error && (
          <div style={{ 
            padding: '12px', 
            background: '#fee2e2', 
            color: '#dc2626', 
            borderRadius: 8,
            marginBottom: '12px'
          }}>
            ❌ Error: {error}
          </div>
        )}
        
        <button 
          onClick={() => { 
            // Clear session but keep last_used_id_number for auto-fill convenience
            localStorage.removeItem('staff_session');
            localStorage.removeItem('staff_onboarded');
            localStorage.removeItem('staff_first_run_complete');
            localStorage.removeItem('staff_needs_login');
            // DON'T clear last_used_id_number - keeps auto-fill for convenience
            window.location.reload();
          }} 
          style={{ 
            padding: '12px 14px', 
            borderRadius: 8, 
            border: 'none', 
            background: '#6b7280', 
            color: 'white', 
            fontWeight: 600, 
            cursor: 'pointer', 
            userSelect: 'none', 
            WebkitUserSelect: 'none',
            marginBottom: 12,
            flexShrink: 0
          }}
        >
          Logout
        </button>
        
        {/* Posting Button - Admin 5274 Only - EXACT MATCH */}
        {currentUser?.id_number === '5274' && (
          <button
            onClick={() => setShowPostingSelector(true)}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 8,
              border: 'none',
              background: '#3b82f6',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <MapPin size={18} />
            Posting: {currentPostingInstitution || 'Select Hospital'}
          </button>
        )}
        
        {/* Quick Actions Dropdown */}
        <div style={{ position: 'relative', marginBottom: 12, flexShrink: 0 }}>
          <button
            onClick={() => setShowQuickActions(!showQuickActions)}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: showQuickActions ? '#f3f4f6' : 'white',
              color: '#1f2937',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '14px'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Server className="w-5 h-5" />
              Quick Actions
            </span>
            <span style={{ transform: showQuickActions ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
          </button>
          
          {showQuickActions && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              zIndex: 50,
              overflow: 'hidden'
            }}>
              {/* 1. Import from PDF */}
              <button
                onClick={() => {
                  setShowPDFImport(true)
                  setShowQuickActions(false)
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  textAlign: 'left',
                  background: 'white',
                  border: 'none',
                  borderBottom: '1px solid #f3f4f6',
                  color: '#1f2937',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#eff6ff'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              >
                <Upload className="w-4 h-4" />
                Import from PDF
              </button>
              
              {/* 2. Export to PDF */}
              <button
                onClick={() => {
                  handleExportToPDF()
                  setShowQuickActions(false)
                }}
                disabled={isExportingPDF}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  textAlign: 'left',
                  background: isExportingPDF ? '#f9fafb' : 'white',
                  border: 'none',
                  borderBottom: '1px solid #f3f4f6',
                  color: isExportingPDF ? '#9ca3af' : '#1f2937',
                  cursor: isExportingPDF ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => {
                  if (!isExportingPDF) e.currentTarget.style.background = '#f0fdf4'
                }}
                onMouseLeave={(e) => {
                  if (!isExportingPDF) e.currentTarget.style.background = 'white'
                }}
              >
                {isExportingPDF ? (
                  <>
                    <div style={{ width: 16, height: 16, border: '2px solid #9ca3af', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    Exporting PDF...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Export to PDF
                  </>
                )}
              </button>
              
              {/* 3. Monthly Reports */}
              <button
                onClick={async () => {
                  await refreshRosterEntries();
                  setShowMonthlyReports(true)
                  setShowQuickActions(false)
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  textAlign: 'left',
                  background: 'white',
                  border: 'none',
                  borderBottom: '1px solid #f3f4f6',
                  color: '#1f2937',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#faf5ff'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              >
                <FileText className="w-4 h-4" />
                Monthly Reports
              </button>
              
              {/* 4. Batch Print */}
              <button
                onClick={async () => {
                  await refreshRosterEntries();
                  setShowBatchPrint(true)
                  setShowQuickActions(false)
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  textAlign: 'left',
                  background: 'white',
                  border: 'none',
                  borderBottom: '1px solid #f3f4f6',
                  color: '#1f2937',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#eef2ff'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              >
                <Printer className="w-4 h-4" />
                Batch Print
              </button>
              
              {/* 5. Staff Management */}
              <button
                onClick={() => {
                  setShowStaffManagement(true)
                  setShowQuickActions(false)
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  textAlign: 'left',
                  background: 'white',
                  border: 'none',
                  borderBottom: '1px solid #f3f4f6',
                  color: '#1f2937',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#fffbeb'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              >
                <Users className="w-4 h-4" />
                Staff Management
              </button>
              
              {/* 6. Registration Approval */}
              <button
                onClick={() => {
                  setShowRegistrationApproval(true)
                  setShowQuickActions(false)
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  textAlign: 'left',
                  background: 'white',
                  border: 'none',
                  borderBottom: '1px solid #f3f4f6',
                  color: '#1f2937',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#ecfdf5'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              >
                <CheckCircle className="w-4 h-4" />
                Registration Approval
                {currentUser && !currentUser.id_number?.endsWith('5274') && currentUser.institution_code && (
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#6b7280' }}>
                    ({currentUser.institution_code})
                  </span>
                )}
              </button>
              
              {/* 7. Attached Centers - Manage satellite centers */}
              <button
                onClick={() => {
                  setShowAttachedCenters(true)
                  setShowQuickActions(false)
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  textAlign: 'left',
                  background: 'white',
                  border: 'none',
                  borderBottom: '1px solid #f3f4f6',
                  color: '#1f2937',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#eef2ff'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              >
                <MapPin className="w-4 h-4" />
                Attached Centers
                {currentUser && !currentUser.id_number?.endsWith('5274') && currentUser.institution_code && (
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#6b7280' }}>
                    ({currentUser.institution_code})
                  </span>
                )}
              </button>
              
              {/* 7. Roster Planner - Only visible to admin 5274 */}
              {currentUser?.id_number === '5274' && (
              <button
                onClick={() => {
                  setShowRosterPlanner(true)
                  setShowQuickActions(false)
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  textAlign: 'left',
                  background: 'white',
                  border: 'none',
                  borderBottom: '1px solid #f3f4f6',
                  color: '#1f2937',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#fef3c7'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              >
                <LayoutTemplate className="w-4 h-4" />
                Roster Planner
              </button>
                        )}
              
              {/* 8. Roster Planner (Mobile) - Only visible to admin 5274 */}
              {currentUser?.id_number === '5274' && (
              <button
                onClick={() => {
                  setShowRosterMobilePlanner(true)
                  setShowQuickActions(false)
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  textAlign: 'left',
                  background: 'white',
                  border: 'none',
                  borderBottom: '1px solid #f3f4f6',
                  color: '#1f2937',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#ccfbf1'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              >
                <LayoutTemplate className="w-4 h-4" />
                Roster Planner (Mobile)
              </button>
                        )}
              
              {/* 9. Maintenance Mode - Only visible to admin 5274 */}
              {currentUser?.id_number === '5274' && (
                <button
                  onClick={() => {
                    handleToggleMaintenanceMode()
                    setShowQuickActions(false)
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    textAlign: 'left',
                    background: 'white',
                    border: 'none',
                    borderBottom: '1px solid #f3f4f6',
                    color: maintenanceMode ? '#dc2626' : '#ea580c',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '14px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#fff7ed'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                >
                  <Wrench className="w-4 h-4" />
                  {maintenanceMode ? 'Disable Maintenance Mode' : 'Enable Maintenance Mode (Currently OFF)'}
                </button>
                )}
              {/* 9. Clear Database */}
              <button
                onClick={() => {
                  setShowClearConfirm(true)
                  setShowQuickActions(false)
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  textAlign: 'left',
                  background: 'white',
                  border: 'none',
                  color: '#dc2626',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
              >
                <Trash2 className="w-4 h-4" />
                Clear Database
              </button>
            </div>
          )}
        </div>
        <div style={{ 
          flex: 1, 
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0, // Critical for nested scrollable content
          overflow: 'hidden',
          opacity: showQuickActions ? 0 : 1,
          pointerEvents: showQuickActions ? 'none' : 'auto',
          transition: 'opacity 0.2s ease-in-out'
        }}>
          <strong style={{ 
            marginBottom: 6, 
            textAlign: 'center',
            display: 'block',
            width: '100%'
          }}>Staff Directory{currentUser?.id_number === '5274' && (
            <>
              <select
                value={filterInstitution}
                onChange={(e) => setFilterInstitution(e.target.value)}
                style={{
                  marginLeft: '8px',
                  padding: '4px 8px',
                  fontSize: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: 'white'
                }}
                title="Filter by institution..."
              >
                <option value="all">All Institutions</option>
                {Array.from(new Set(staff.map(s => s.institution_code).filter(Boolean))).sort().map(inst => (
                  <option key={inst} value={inst}>{inst}</option>
                ))}
              </select>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [newSortBy, newSortOrder] = e.target.value.split('-');
                  setSortBy(newSortBy as any);
                  setSortOrder(newSortOrder as any);
                }}
                style={{
                  marginLeft: '8px',
                  padding: '4px 8px',
                  fontSize: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: 'white'
                }}
                title="Sort staff by..."
              >
                <option value="last_login-desc">Last Login (Newest)</option>
                <option value="last_login-asc">Last Login (Oldest)</option>
              </select>
            </>
          ) || ''}</strong>
          {loading ? (
            <div style={{ padding: 12, textAlign: 'center', color: '#6b7280' }}>Loading...</div>
          ) : (
            <ul style={{ 
              marginTop: 0, 
              paddingLeft: 0, 
              listStyle: 'none', 
              flex: 1,
              overflowY: 'auto',
              margin: 0,
              padding: 0,
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y'
            }}>
              {/* Show ALL staff except current user 5274 */}
              {sortedAndFilteredStaff.map(s => {
                  // Determine background color based on access and admin status
                  let backgroundColor = '#ffffff'; // default white
                  if (!s.is_active) {
                    backgroundColor = '#fee2e2'; // light red for disabled users (highest priority)
                  } else if (s.is_admin) {
                    backgroundColor = '#d1fae5'; // light green for active admins
                  }
                  
                  return (
                    <li key={s.id} style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      padding: '12px 16px', 
                      borderBottom: '1px solid #e5e7eb',
                      position: 'relative',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      backgroundColor
                    }}>
                      {/* Staff name - Line 1 */}
                      <div style={{ 
                        fontSize: '14px', 
                        fontWeight: 500, 
                        color: '#1f2937', 
                        marginBottom: '4px',
                        userSelect: 'text',
                        WebkitUserSelect: 'text',
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px'
                      }}>
                        <span>{s.surname} {s.name}</span>
                        {currentUser?.id_number === '5274' && s.institution_code && (
                          <span style={{ 
                            fontSize: '12px', 
                            color: '#6b7280', 
                            fontWeight: 400,
                            whiteSpace: 'nowrap'
                          }}>
                            ({s.institution_code})
                          </span>
                        )}
                      </div>
                      
                      {/* ID Number - Line 2 */}
                      <div style={{ 
                        fontSize: '13px', 
                        color: '#6b7280', 
                        marginBottom: '4px',
                        userSelect: 'none',
                        WebkitUserSelect: 'none'
                      }}>
                        ID number (<span style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>{s.id_number === '5274' || s.id_number === 'admin-5274' ? '••••' : s.id_number}</span>)
                      </div>
                      
                      {/* Last Login - Line 3 */}
                      <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px' }}>
                        Last login: {formatDate(s.last_login)}
                      </div>
                      
                      {/* Status Badge - Only visible to admin 5274 */}
                      {currentUser?.id_number === '5274' && (
                        <div style={{ marginBottom: '8px' }}>
                          {s.is_admin ? (
                            <span className="text-xs font-medium bg-green-600 text-white px-2 py-1 rounded">
                              Status: Admin
                            </span>
                          ) : (
                            <span className="text-xs font-medium bg-gray-600 text-white px-2 py-1 rounded">
                              Status: User
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Access and Delete buttons on same line */}
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        width: '100%'
                      }}>
                        {/* Access control on left - Only visible to admin 5274 */}
                        {currentUser?.id_number === '5274' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', color: '#4b5563' }}>Access:</span>
                            <input 
                              type="checkbox" 
                              checked={s.is_active} 
                              onChange={() => toggleStaffAccess(s.id, s.is_active)} 
                              title={`Toggle access for ${s.name} ${s.surname}`}
                              style={{ cursor: 'pointer' }}
                            />
                          </div>
                        )}
                        
                        {/* Delete button on extreme right */}
                        <button 
                          onClick={() => deleteStaff(s.id, `${s.name} ${s.surname}`)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            marginLeft: 'auto',
                            userSelect: 'none',
                            WebkitUserSelect: 'none'
                          }}
                          title={`Delete ${s.name} ${s.surname}`}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      </div>
      
      {/* All modals outside the main container */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Delete Staff Member"
        message={`Are you sure you want to delete ${staffToDelete?.name}? This will permanently remove the user and they will need to register again.`}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        confirmText="Delete"
        cancelText="Cancel"
        isDanger={true}
      />
      
      <StaffManagementModal
        isOpen={showStaffManagement}
        onClose={() => setShowStaffManagement(false)}
        isAdminAuthenticated={true}
        adminName="Admin"
      />
      
      <MonthlyReportsModal
        isOpen={showMonthlyReports}
        onClose={() => setShowMonthlyReports(false)}
        entries={rosterEntries}
        basicSalary={35000}
        hourlyRate={201.92}
        shiftCombinations={[
          { id: '9-4', combination: 'Morning Shift (9-4)', hours: 6.5 },
          { id: '4-10', combination: 'Evening Shift (4-10)', hours: 5.5 },
          { id: '12-10', combination: 'Saturday Regular (12-10)', hours: 9.5 },
          { id: 'N', combination: 'Night Duty', hours: 12.5 },
          { id: '9-4', combination: 'Sunday/Public Holiday/Special', hours: 6.5 }
        ]}
      />
      
      <BatchPrintModal
        isOpen={showBatchPrint}
        onClose={() => setShowBatchPrint(false)}
        entries={rosterEntries}
        basicSalary={35000}
        hourlyRate={201.92}
        shiftCombinations={[
          { id: '9-4', combination: 'Morning Shift (9-4)', hours: 6.5 },
          { id: '4-10', combination: 'Evening Shift (4-10)', hours: 5.5 },
          { id: '12-10', combination: 'Saturday Regular (12-10)', hours: 9.5 },
          { id: 'N', combination: 'Night Duty', hours: 12.5 },
          { id: '9-4', combination: 'Sunday/Public Holiday/Special', hours: 7 }
        ]}
      />
      
      <PDFImportModal
        isOpen={showPDFImport}
        onClose={() => setShowPDFImport(false)}
        onImport={handlePDFImport}
        isAdminAuthenticated={true}
        adminName="Admin"
      />
      
      {/* Roster Planner Modal */}
      {showRosterPlanner && createPortal(
        <div 
          className="fixed inset-0 bg-white z-[9999]"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2147483647
          }}
        >
          <RosterPlanner onClose={() => setShowRosterPlanner(false)} institutionCode={currentUser?.institution_code} />
        </div>,
        document.body
      )}
      
      {/* Clear Database Confirmation Modal */}
      {showClearConfirm && createPortal(
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-[9999]"
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
            padding: '16px',
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowClearConfirm(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
            style={{
              maxHeight: '90vh',
              overflowY: 'auto',
              userSelect: 'none',
              WebkitUserSelect: 'none'
            }}
          >
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Clear Database
              </h3>
              
              {/* Clear Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What do you want to clear?
                </label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-3 p-3 border-2 border-blue-200 rounded-lg cursor-pointer hover:bg-blue-50">
                    <input
                      type="radio"
                      name="clearType"
                      checked={clearType === 'all'}
                      onChange={() => setClearType('all')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm font-medium text-gray-900">All Data</span>
                  </label>
                  <label className="flex items-center space-x-3 p-3 border-2 border-orange-200 rounded-lg cursor-pointer hover:bg-orange-50">
                    <input
                      type="radio"
                      name="clearType"
                      checked={clearType === 'month'}
                      onChange={() => setClearType('month')}
                      className="w-4 h-4 text-orange-600"
                    />
                    <span className="text-sm font-medium text-gray-900">Specific Month</span>
                  </label>
                </div>
              </div>

{/* Institution Selection - Admin 5274 Only */}
{currentUser?.id_number === '5274' && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-blue-900">
                      Institution Scope
                    </label>
                    <button
                      onClick={() => {
                        setPreviousInstitution(selectedInstitutionForClear)
                        setShowInstitutionSelect(true)
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
                <div className="mb-6 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Month
                    </label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      {[
                        'January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'
                      ].map((month, index) => (
                        <option key={month} value={index}>{month}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Year
                    </label>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
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
                  onClick={() => setShowClearConfirm(false)}
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
                    setSelectedInstitutionForClear('current')
                    setShowInstitutionSelect(false)
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
                    setSelectedInstitutionForClear('all')
                    setShowInstitutionSelect(false)
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
                    setShowInstitutionSelect(false)
                    // Restore previous institution if exists
                    if (previousInstitution) {
                      setSelectedInstitutionForClear(previousInstitution)
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

      {/* Maintenance Mode Confirmation Modal */}
      {confirmMaintenanceModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div className="text-center mb-6">
              <div style={{
                width: '64px',
                height: '64px',
                margin: '0 auto 16px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: maintenanceMode ? '#fee2e2' : '#ffedd5'
              }}>
                <Wrench 
                  className="w-8 h-8" 
                  style={{ color: maintenanceMode ? '#dc2626' : '#ea580c' }} 
                />
              </div>
              <h3 style={{
                fontSize: '20px',
                fontWeight: 'bold',
                color: '#1f2937',
                marginBottom: '8px'
              }}>
                Toggle Maintenance Mode?
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                lineHeight: '1.5'
              }}>
                {maintenanceMode 
                  ? 'This will DISABLE maintenance mode and make the app visible to all users.'
                  : 'This will ENABLE maintenance mode and show a maintenance screen to all users.'
                }
              </p>
              <p style={{
                fontSize: '12px',
                color: maintenanceMode ? '#dc2626' : '#16a34a',
                marginTop: '12px',
                fontWeight: 500
              }}>
                Current Status: <strong>{maintenanceMode ? '🔴 ENABLED' : '🟢 DISABLED (OFF)'}</strong>
              </p>
            </div>
            
            <div style={{
              display: 'flex',
              gap: '12px'
            }}>
              <button
                onClick={handleCancelMaintenanceToggle}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMaintenanceToggle}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: maintenanceMode ? '#dc2626' : '#ea580c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = maintenanceMode ? '#b91c1c' : '#c2410c'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = maintenanceMode ? '#dc2626' : '#ea580c'}
              >
                {maintenanceMode ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        </div>
      )}
      
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
      
      {/* Registration Approval Modal */}
      {showRegistrationApproval && (
        <RegistrationApprovalModal
          isOpen={showRegistrationApproval}
          onClose={() => setShowRegistrationApproval(false)}
          adminUser={currentUser}
        />
      )}
      
      {/* Posting Selector Modal */}
      {showPostingSelector && (
        <PostingSelectorModal
          isOpen={showPostingSelector}
          onClose={() => setShowPostingSelector(false)}
          adminUserId={currentUser?.id || ''}
          currentPostingInstitution={currentPostingInstitution}
          onPostingChanged={handlePostingChanged}
          currentUser={currentUser}
        />
      )}
      
      {/* Attached Centers Modal */}
      <AttachedCentersModal
        isOpen={showAttachedCenters}
        onClose={() => setShowAttachedCenters(false)}
      />
      
      {/* Roster Mobile Planner Modal */}
      {showRosterMobilePlanner && createPortal(
        <RosterMobilePlanner
          onClose={() => setShowRosterMobilePlanner(false)}
          institutionCode={currentUser?.institution_code || null}
        />,
        document.body
      )}
    </>
  )
}

export default AdminPanel
