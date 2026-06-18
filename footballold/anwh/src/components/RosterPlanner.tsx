import React, { useState, useEffect } from 'react';
import { Settings, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDisplayNameForUI } from '../utils/rosterDisplayName';

interface RosterPlannerProps {
  onClose?: () => void;
  institutionCode?: string;
}

export const RosterPlanner: React.FC<RosterPlannerProps> = ({ onClose, institutionCode }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [staffList, setStaffList] = useState<Array<{ id: string; display_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [draggedStaff, setDraggedStaff] = useState<{ name: string; sourceDate?: string; sourceShift?: string; groupMembers?: string[] } | null>(null);
  
  // Track selected staff for multi-drag
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  
  // Confirmation modal state
  interface ConfirmationModal {
    visible: boolean;
    staffNames: string[];
    dateKey: string;
    shiftId: string;
    shiftLabel: string;
  }
  const [confirmationModal, setConfirmationModal] = useState<ConfirmationModal>({
    visible: false,
    staffNames: [],
    dateKey: '',
    shiftId: '',
    shiftLabel: ''
  });
  
  // Delete all modal state
  interface DeleteAllModal {
    visible: boolean;
    dateKey: string;
    dateDisplay: string;
    availableShifts: Array<{ id: string; label: string; count: number }>;
  }
  const [deleteAllModal, setDeleteAllModal] = useState<DeleteAllModal>({
    visible: false,
    dateKey: '',
    dateDisplay: '',
    availableShifts: []
  });
  
  // Clear roster confirmation modal
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  // Groups state
  interface StaffGroup {
    id: string;
    name: string;
    members: string[]; // Array of staff names
    institution_code: string;
    created_at: string;
  }
  const [groups, setGroups] = useState<StaffGroup[]>([]);
  const [showGroups, setShowGroups] = useState(false); // Toggle between staff and groups view
  const [showReplacing, setShowReplacing] = useState(false); // Show staff with (R) marker
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  
  // Edit group modal state
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [selectedStaffForEdit, setSelectedStaffForEdit] = useState<Set<string>>(new Set());
  const [replacingCount, setReplacingCount] = useState<number>(0);
  
  // Track roster assignments: key = "date-shiftId", value = array of assignments
  interface Assignment {
    staffName: string;
    markers: string[]; // Array of markers: ['*'], ['**'], ['(R)'], ['*', '(R)'], etc.
    center: string | null; // Center badge or null (kept for compatibility but not used in display)
  }
  const [rosterAssignments, setRosterAssignments] = useState<Record<string, Assignment[]>>({});
  
  // Available centers for current user's institution
  const [availableCenters, setAvailableCenters] = useState<Array<{ marker: string; name: string }>>([]);
  
  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  
  // Right-click context menu
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    assignmentKey: string;
    assignmentIndex: number;
  } | null>(null);
  
  // Current month being displayed
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());

  // Shift types matching VH.png format
  const shifts = [
    { id: 'morning', label: '9hrs-16hrs', color: 'bg-blue-50' },
    { id: 'evening', label: '16hrs-22hrs', color: 'bg-orange-50' },
    { id: 'night', label: '22hrs-9hrs', color: 'bg-purple-50' }
  ];

  // Fetch staff list and centers on mount
  useEffect(() => {
    fetchStaffList();
    fetchAvailableCenters();
    fetchGroups(); // Fetch groups on mount
    
    // Test query to see if table has any data
    const testQuery = async () => {
      try {
        console.log('🧪 Testing staff_users table...');
        const { count, error } = await supabase
          .from('staff_users')
          .select('*', { count: 'exact', head: true });
        
        console.log('🧪 Total staff in database:', count);
        if (error) {
          console.error('🧪 Error counting staff:', error);
        }
        
        // Also check what columns exist
        const { data: sampleData, error: sampleError } = await supabase
          .from('staff_users')
          .select('*')
          .limit(1);
        
        if (sampleData && sampleData.length > 0) {
          console.log('🧪 Sample staff record:', sampleData[0]);
          console.log('🧪 Available columns:', Object.keys(sampleData[0]));
        } else if (sampleError) {
          console.error('🧪 Error fetching sample:', sampleError);
        }
      } catch (err) {
        console.error('🧪 Test query failed:', err);
      }
    };
    
    testQuery();
  }, []);

  const fetchAvailableCenters = async () => {
    try {
      if (!institutionCode) return;

      const { data, error } = await supabase
        .from('attached_centers')
        .select('marker, center_name')
        .eq('institution_code', institutionCode)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setAvailableCenters(data?.map((c: any) => ({ marker: c.marker, name: c.center_name })) || []);
    } catch (error) {
      console.error('Error fetching centers:', error);
    }
  };

  const fetchStaffList = async () => {
    try {
      setLoading(true);
      
      // First try with institution filter - select roster_display_name field
      let query = supabase
        .from('staff_users')
        .select('id, roster_display_name, surname, name');

      if (institutionCode) {
        query = query.eq('institution_code', institutionCode);
      }

      let { data, error } = await query.order('surname', { ascending: true });
      
      if (error) throw error;

      // If no results and we had an institution filter, try without filter
      if ((!data || data.length === 0) && institutionCode) {
        const { data: allData, error: allError } = await supabase
          .from('staff_users')
          .select('id, roster_display_name, surname, name')
          .order('surname', { ascending: true });
        
        if (allError) throw allError;
        
        data = allData;
      }

      // Use roster_display_name from database, then strip ID using formatDisplayNameForUI
      // Also filter out admin 5274 from the list BEFORE formatting
      const formattedStaff = (data?.map((staff: any): { id: string; display_name: string } | null => {
        // Check if this is admin 5274 BEFORE formatting (check original roster_display_name)
        const isAdmin5274 = staff.id_number === '5274' || 
                           (staff.roster_display_name && (
                             staff.roster_display_name.includes('_5274') ||
                             staff.roster_display_name.endsWith('5274')
                           ));
        
        if (isAdmin5274) {
          return null; // Mark for removal
        }
        
        // Format non-admin staff
        return {
          id: staff.id,
          display_name: staff.roster_display_name 
            ? formatDisplayNameForUI(staff.roster_display_name)  // Strip ID from roster_display_name
            : `${staff.surname} ${staff.name}`.toUpperCase()
        };
      }) || []).filter((s: { id: string; display_name: string } | null): s is { id: string; display_name: string } => s !== null); // Remove nulls
      
      setStaffList(formattedStaff);
    } catch (error) {
      console.error('❌ Error fetching staff list:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate all dates for current month
  const getDaysInMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    const days = [];
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  const daysInMonth = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());

  // Navigate to previous/next month
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Format date key for storage
  const formatDateKey = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Show toast notification
  const showToast = (message: string, type: 'error' | 'success' = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, staffName: string) => {
    setDraggedStaff({ name: staffName });
    e.dataTransfer.effectAllowed = 'copy';
    
    // If multiple staff are selected, show count in drag image
    if (selectedStaff.size > 1 && selectedStaff.has(staffName)) {
      const dragImage = document.createElement('div');
      dragImage.className = 'bg-blue-600 text-white px-3 py-2 rounded-lg font-bold shadow-lg';
      dragImage.textContent = `${selectedStaff.size} staff`;
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 0, 0);
      setTimeout(() => document.body.removeChild(dragImage), 0);
    }
  };

  const handleDragStartFromCell = (e: React.DragEvent, staffName: string, date: string, shiftId: string) => {
    setDraggedStaff({ name: staffName, sourceDate: date, sourceShift: shiftId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = draggedStaff?.sourceDate ? 'move' : 'copy';
  };

  const handleDrop = (e: React.DragEvent, date: Date, shiftId: string) => {
    e.preventDefault();
    
    if (!draggedStaff) return;

    const dateKey = formatDateKey(date);
    const assignmentKey = `${dateKey}-${shiftId}`;
    const shiftLabel = shifts.find(s => s.id === shiftId)?.label || shiftId;

    // Check if dragging a group (has groupMembers)
    if (draggedStaff.groupMembers && draggedStaff.groupMembers.length > 0) {
      // Add all group members individually
      draggedStaff.groupMembers.forEach(memberName => {
        addStaffToCell(memberName, dateKey, shiftId, undefined, undefined, showReplacing);
      });
      setDraggedStaff(null);
      showToast(`Added ${draggedStaff.groupMembers.length} staff from group${showReplacing ? ' with (R) marker' : ''}`, 'success');
      return;
    }

    // Check if there are multiple selected staff
    if (selectedStaff.size > 1 && selectedStaff.has(draggedStaff.name)) {
      // Show confirmation modal with all selected staff
      setConfirmationModal({
        visible: true,
        staffNames: Array.from(selectedStaff),
        dateKey,
        shiftId,
        shiftLabel
      });
      setDraggedStaff(null);
      return;
    }

    // Single staff assignment - proceed directly
    addStaffToCell(draggedStaff.name, dateKey, shiftId, draggedStaff.sourceDate, draggedStaff.sourceShift, showReplacing);
    setDraggedStaff(null);
  };

  // Add single staff to cell
  const addStaffToCell = (staffName: string, dateKey: string, shiftId: string, sourceDate?: string, sourceShift?: string, replaceMode?: boolean) => {
    const assignmentKey = `${dateKey}-${shiftId}`;

    // Check if already assigned
    const existingAssignments = rosterAssignments[assignmentKey] || [];
    const isDuplicate = existingAssignments.some(a => a.staffName === staffName);

    if (isDuplicate) {
      showToast(`${staffName} is already assigned to this shift`, 'error');
      return;
    }

    // If moving from another cell, remove from source
    if (sourceDate && sourceShift) {
      const sourceKey = `${sourceDate}-${sourceShift}`;
      setRosterAssignments(prev => {
        const updated = { ...prev };
        if (updated[sourceKey]) {
          updated[sourceKey] = updated[sourceKey].filter(a => a.staffName !== staffName);
          if (updated[sourceKey].length === 0) {
            delete updated[sourceKey];
          }
        }
        return updated;
      });
    }

    // Add to target cell with default settings
    // If replaceMode is true, add (R) marker
    const markers = replaceMode ? ['(R)'] : [];
    
    setRosterAssignments(prev => ({
      ...prev,
      [assignmentKey]: [
        ...(prev[assignmentKey] || []),
        { staffName, markers, center: null }
      ]
    }));

    const markerText = replaceMode ? ' with (R) marker' : '';
    showToast(`${staffName} assigned successfully${markerText}`, 'success');
  };

  // Confirm batch assignment from modal
  const confirmBatchAssignment = () => {
    const { staffNames, dateKey, shiftId } = confirmationModal;
    
    staffNames.forEach(staffName => {
      addStaffToCell(staffName, dateKey, shiftId, undefined, undefined, showReplacing);
    });

    setConfirmationModal({
      visible: false,
      staffNames: [],
      dateKey: '',
      shiftId: '',
      shiftLabel: ''
    });
    
    // Clear selection after assignment
    setSelectedStaff(new Set());
  };

  // Cancel batch assignment
  const cancelBatchAssignment = () => {
    setConfirmationModal({
      visible: false,
      staffNames: [],
      dateKey: '',
      shiftId: '',
      shiftLabel: ''
    });
  };

  // Show delete all modal for a specific date
  const showDeleteAllModal = (date: Date, dateDisplay?: string) => {
    const dateKey = formatDateKey(date);
    
    // Use provided dateDisplay or calculate it
    let displayDate = dateDisplay;
    if (!displayDate) {
      const dayNum = String(date.getDate()).padStart(2, '0');
      const monthNum = String(date.getMonth() + 1).padStart(2, '0');
      const yearNum = String(date.getFullYear());
      displayDate = `${dayNum} ${monthNum} ${yearNum}`;
    }
    
    // Check which shifts have staff
    const availableShifts = shifts
      .map(shift => {
        const assignmentKey = `${dateKey}-${shift.id}`;
        const assignments = rosterAssignments[assignmentKey] || [];
        return {
          id: shift.id,
          label: shift.label,
          count: assignments.length
        };
      })
      .filter(shift => shift.count > 0); // Only show shifts with staff
    
    if (availableShifts.length === 0) {
      showToast('No staff assigned on this date', 'error');
      return;
    }
    
    setDeleteAllModal({
      visible: true,
      dateKey,
      dateDisplay: displayDate,
      availableShifts
    });
  };

  // Delete all staff from a specific shift
  const deleteShiftStaff = (shiftId: string) => {
    const { dateKey, dateDisplay } = deleteAllModal;
    const assignmentKey = `${dateKey}-${shiftId}`;
    
    setRosterAssignments(prev => {
      const updated = { ...prev };
      delete updated[assignmentKey];
      
      // Calculate remaining shifts from the updated state
      const remainingShifts = shifts
        .map(shift => {
          if (shift.id === shiftId) return null; // Exclude deleted shift
          const key = `${dateKey}-${shift.id}`;
          const count = (updated[key] || []).length;
          return count > 0 ? { id: shift.id, label: shift.label, count } : null;
        })
        .filter((s): s is { id: string; label: string; count: number } => s !== null);
      
      // Store for use after state update
      (window as any).__remainingShiftsData = remainingShifts;
      
      return updated;
    });
    
    showToast(`Cleared ${shifts.find(s => s.id === shiftId)?.label}`, 'success');
    
    // Update modal after state has updated
    setTimeout(() => {
      const remainingShifts = (window as any).__remainingShiftsData || [];
      
      if (remainingShifts.length === 0) {
        closeDeleteAllModal();
      } else {
        // Update modal with remaining shifts directly
        setDeleteAllModal(prev => ({
          ...prev,
          availableShifts: remainingShifts
        }));
      }
      
      delete (window as any).__remainingShiftsData;
    }, 150);
  };

  // Close delete all modal
  const closeDeleteAllModal = () => {
    setDeleteAllModal({
      visible: false,
      dateKey: '',
      dateDisplay: '',
      availableShifts: []
    });
  };

  // Clear all shifts for the selected date
  const deleteAllShiftsForDate = () => {
    const { dateKey, availableShifts } = deleteAllModal;
    
    // Clear all shifts
    setRosterAssignments(prev => {
      const updated = { ...prev };
      availableShifts.forEach(shift => {
        const assignmentKey = `${dateKey}-${shift.id}`;
        delete updated[assignmentKey];
      });
      return updated;
    });
    
    showToast(`Cleared all shifts for ${deleteAllModal.dateDisplay}`, 'success');
    
    // Close modal after clearing
    setTimeout(() => {
      closeDeleteAllModal();
    }, 100);
  };

  // Print roster to PDF
  const handlePrintRoster = (fitToPage = false) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Please allow popups to print', 'error');
      return;
    }

    const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    // Clone the roster container to remove close buttons before printing
    const rosterContainer = document.querySelector('.flex-1.overflow-auto');
    if (!rosterContainer) {
      showToast('No roster data to print', 'error');
      return;
    }
    
    const clone = rosterContainer.cloneNode(true) as HTMLElement;
    
    // Remove all close buttons (×) from the clone
    const closeButtons = clone.querySelectorAll('button');
    closeButtons.forEach(btn => {
      if (btn.textContent === '×') {
        btn.remove();
      }
    });
    
    // Remove "Drop" placeholder text from empty cells
    const dropTexts = clone.querySelectorAll('.text-gray-400');
    dropTexts.forEach(el => {
      if (el.textContent?.includes('Drop')) {
        el.remove();
      }
    });
    
    const tablesHtml = clone.innerHTML;
    
    // Build complete HTML for printing - optimized for single page
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Roster Planner - ${monthName}</title>
        <style>
          @media print {
            ${fitToPage ? `
            @page {
              size: A4 portrait;
              margin: 3mm;
            }
            
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
              transform: scale(0.55);
              transform-origin: top center;
            }
            
            h1 {
              font-size: 11px !important;
              margin-bottom: 3px !important;
            }
            
            table {
              page-break-after: auto !important;
              page-break-before: auto !important;
              page-break-inside: avoid !important;
              margin-bottom: 2px !important;
            }
            ` : `
            @page {
              size: landscape;
              margin: 5mm;
            }
            
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
            `}
          }
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: Arial, sans-serif;
            padding: 10px;
          }
          
          h1 {
            text-align: center;
            font-size: 18px;
            margin-bottom: 15px;
            color: #1f2937;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8px;
            margin-bottom: 10px;
            page-break-inside: avoid;
            table-layout: fixed;
          }
          
          th, td {
            border: 1px solid #d1d5db;
            padding: 3px;
            vertical-align: middle;
            text-align: center;
          }
          
          /* Fixed column widths for date headers */
          th:first-child {
            width: 70px;
            min-width: 70px;
            max-width: 70px;
          }
          
          th:not(:first-child) {
            width: auto;
          }
          
          th {
            background-color: #f3f4f6 !important;
            font-weight: 600;
            text-align: center;
            font-size: 7px;
          }
          
          .shift-label {
            background-color: #f3f4f6 !important;
            font-weight: bold;
            text-align: center;
            vertical-align: middle;
            width: 60px;
            font-size: 7px;
          }
          
          .morning {
            background-color: #eff6ff !important;
          }
          
          .evening {
            background-color: #fff7ed !important;
          }
          
          .night {
            background-color: #faf5ff !important;
          }
          
          .staff-entry {
            background-color: white;
            padding: 2px 4px;
            margin-bottom: 2px;
            border-radius: 2px;
            font-size: 8px;
            line-height: 1.2;
          }
          
          .marker {
            color: black;
            font-weight: bold;
          }
          
          .replacing {
            color: black;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <h1>Roster Planner - ${monthName}</h1>
        ${tablesHtml}
      </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Wait for content to load then print
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
    
    showToast('Print dialog opened', 'success');
  };

  // Save roster to Supabase
  const handleSaveRoster = async () => {
    if (!institutionCode) {
      showToast('No institution code found', 'error');
      return;
    }

    try {
      setLoading(true);
      
      // Prepare roster data
      const rosterData = Object.entries(rosterAssignments).map(([key, assignments]) => {
        // Key format: "YYYY-MM-DD-shiftId" - need to extract date and shift correctly
        const lastHyphenIndex = key.lastIndexOf('-');
        const dateKey = key.substring(0, lastHyphenIndex);
        const shiftId = key.substring(lastHyphenIndex + 1);
        
        return assignments.map(assignment => ({
          institution_code: institutionCode,
          date: dateKey,
          shift_id: shiftId,
          staff_name: assignment.staffName,
          markers: assignment.markers,
          created_at: new Date().toISOString()
        }));
      }).flat();

      if (rosterData.length === 0) {
        showToast('No roster data to save', 'error');
        return;
      }

      // Delete existing roster for this institution and month
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      await supabase
        .from('roster_assignments')
        .delete()
        .eq('institution_code', institutionCode)
        .gte('date', monthStart.toISOString().split('T')[0])
        .lte('date', monthEnd.toISOString().split('T')[0]);

      // Insert new roster data
      const { error } = await supabase
        .from('roster_assignments')
        .insert(rosterData);

      if (error) throw error;

      showToast(`Saved ${rosterData.length} assignments`, 'success');
    } catch (error: any) {
      console.error('Error saving roster:', error);
      showToast(error.message || 'Failed to save roster', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Import roster from Supabase
  const handleImportRoster = async () => {
    if (!institutionCode) {
      showToast('No institution code found', 'error');
      return;
    }

    try {
      setLoading(true);
      
      // Get current month range
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      // Fetch roster from Supabase
      const { data, error } = await supabase
        .from('roster_assignments')
        .select('*')
        .eq('institution_code', institutionCode)
        .gte('date', monthStart.toISOString().split('T')[0])
        .lte('date', monthEnd.toISOString().split('T')[0]);

      if (error) throw error;

      if (!data || data.length === 0) {
        showToast('No roster data found for this month', 'error');
        return;
      }

      // Convert to roster assignments format
      const newAssignments: Record<string, Assignment[]> = {};
      
      data.forEach((item: any) => {
        const key = `${item.date}-${item.shift_id}`;
        if (!newAssignments[key]) {
          newAssignments[key] = [];
        }
        
        newAssignments[key].push({
          staffName: item.staff_name,
          markers: item.markers || [],
          center: null
        });
      });

      setRosterAssignments(newAssignments);
      showToast(`Imported ${data.length} assignments from database`, 'success');
    } catch (error: any) {
      console.error('Error importing roster:', error);
      showToast(error.message || 'Failed to import roster', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Export roster to actual app roster
  const handleExportToApp = async () => {
    if (!institutionCode) {
      showToast('No institution code found', 'error');
      return;
    }

    try {
      setLoading(true);
      
      // Prepare roster entries for the actual roster table
      const rosterEntries = Object.entries(rosterAssignments).map(([key, assignments]) => {
        const lastHyphenIndex = key.lastIndexOf('-');
        const dateKey = key.substring(0, lastHyphenIndex);
        const shiftId = key.substring(lastHyphenIndex + 1);
        
        return assignments.map(assignment => ({
          institution_code: institutionCode,
          date: dateKey,
          shift_type: shiftId, // morning, evening, night
          staff_name: assignment.staffName,
          markers: assignment.markers.join(','), // Convert array to comma-separated string
          created_at: new Date().toISOString()
        }));
      }).flat();

      if (rosterEntries.length === 0) {
        showToast('No roster data to export', 'error');
        return;
      }

      // Delete existing roster entries for this institution and month
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      await supabase
        .from('roster_entries')
        .delete()
        .eq('institution_code', institutionCode)
        .gte('date', monthStart.toISOString().split('T')[0])
        .lte('date', monthEnd.toISOString().split('T')[0]);

      // Insert new roster entries
      const { error } = await supabase
        .from('roster_entries')
        .insert(rosterEntries);

      if (error) throw error;

      showToast(`Exported ${rosterEntries.length} entries to roster`, 'success');
    } catch (error: any) {
      console.error('Error exporting to app:', error);
      showToast(error.message || 'Failed to export to roster', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Show clear roster confirmation modal
  const handleClearRoster = () => {
    if (!institutionCode) {
      showToast('No institution code found', 'error');
      return;
    }
    
    setShowClearConfirm(true);
  };

  // Execute clear roster after confirmation
  const executeClearRoster = async () => {
    try {
      setLoading(true);
      setShowClearConfirm(false);
      
      // Get current month range
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      // Clear roster assignments from planner
      setRosterAssignments({});
      
      // Also clear from Supabase
      await supabase
        .from('roster_assignments')
        .delete()
        .eq('institution_code', institutionCode)
        .gte('date', monthStart.toISOString().split('T')[0])
        .lte('date', monthEnd.toISOString().split('T')[0]);

      const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      showToast(`Cleared roster for ${monthName}`, 'success');
    } catch (error: any) {
      console.error('Error clearing roster:', error);
      showToast(error.message || 'Failed to clear roster', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Cancel clear roster
  const cancelClearRoster = () => {
    setShowClearConfirm(false);
  };

  // Fetch groups from Supabase
  const fetchGroups = async () => {
    if (!institutionCode) return;
    
    try {
      const { data, error } = await supabase
        .from('staff_groups')
        .select('*')
        .eq('institution_code', institutionCode)
        .order('name', { ascending: true });
      
      if (error) throw error;
      
      setGroups(data || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  // Check if group with same members already exists
  const groupExists = (members: string[]) => {
    const sortedMembers = [...members].sort().join(',');
    return groups.some(group => {
      const groupMembers = [...group.members].sort().join(',');
      return groupMembers === sortedMembers;
    });
  };

  // Add new group
  const handleAddGroup = async () => {
    if (selectedStaff.size < 2) {
      showToast('Please select at least 2 staff members', 'error');
      return;
    }

    if (groupExists(Array.from(selectedStaff))) {
      showToast('A group with these members already exists', 'error');
      return;
    }

    // Auto-generate next group number
    let groupNum = 1;
    while (groups.some(g => g.name === `Group ${groupNum}`)) {
      groupNum++;
    }
    const groupName = `Group ${groupNum}`;

    try {
      const newGroup = {
        name: groupName,
        members: Array.from(selectedStaff),
        institution_code: institutionCode,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('staff_groups')
        .insert(newGroup)
        .select()
        .single();

      if (error) throw error;

      setGroups(prev => [...prev, data]);
      setShowAddGroupModal(false);
      setGroupNameInput('');
      setSelectedStaff(new Set()); // Clear selection after creating group
      showToast(`Group "${data.name}" created`, 'success');
    } catch (error: any) {
      console.error('Error creating group:', error);
      showToast(error.message || 'Failed to create group', 'error');
    }
  };

  // Delete group and renumber remaining groups
  const handleDeleteGroup = async (groupId: string) => {
    try {
      // Delete from Supabase
      const { error } = await supabase
        .from('staff_groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      // Remove from local state
      const updatedGroups = groups.filter(g => g.id !== groupId);
      
      // Renumber all groups to maintain consecutive numbering
      const renumberedGroups = await Promise.all(
        updatedGroups.map(async (group, index) => {
          const newName = `Group ${index + 1}`;
          
          // Update in Supabase if name changed
          if (group.name !== newName) {
            const { error: updateError } = await supabase
              .from('staff_groups')
              .update({ name: newName })
              .eq('id', group.id);
            
            if (updateError) {
              console.error('Error updating group name:', updateError);
            }
            
            return { ...group, name: newName };
          }
          
          return group;
        })
      );

      setGroups(renumberedGroups);
      showToast('Group deleted and renumbered', 'success');
    } catch (error: any) {
      console.error('Error deleting group:', error);
      showToast(error.message || 'Failed to delete group', 'error');
    }
  };

  // Open edit group modal
  const openEditGroup = (group: StaffGroup) => {
    setEditingGroupId(group.id);
    // Filter out (R) markers and count them
    const rCount = group.members.filter(m => m === '(R)').length;
    const actualMembers = group.members.filter(m => m !== '(R)');
    setReplacingCount(rCount);
    setSelectedStaffForEdit(new Set(actualMembers));
  };

  // Toggle staff selection in edit modal
  const toggleStaffInEdit = (staffName: string) => {
    setSelectedStaffForEdit(prev => {
      const newSet = new Set(prev);
      if (newSet.has(staffName)) {
        newSet.delete(staffName);
      } else {
        newSet.add(staffName);
      }
      return newSet;
    });
  };

  // Save edited group
  const saveEditedGroup = async () => {
    if (!editingGroupId) return;
    
    if (selectedStaffForEdit.size < 2) {
      showToast('A group must have at least 2 staff members', 'error');
      return;
    }

    const group = groups.find(g => g.id === editingGroupId);
    if (!group) return;

    // Build members array with (R) markers at the end
    const membersWithR = [
      ...Array.from(selectedStaffForEdit),
      ...Array(replacingCount).fill('(R)')
    ];

    // Check if duplicate group exists
    const sortedMembers = [...selectedStaffForEdit].sort().join(',');
    const isDuplicate = groups.some(g => 
      g.id !== editingGroupId && 
      [...g.members.filter(m => m !== '(R)' )].sort().join(',') === sortedMembers
    );

    if (isDuplicate) {
      showToast('A group with these staff already exists', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('staff_groups')
        .update({ members: membersWithR })
        .eq('id', editingGroupId);

      if (error) throw error;

      setGroups(prev => prev.map(g => 
        g.id === editingGroupId ? { ...g, members: membersWithR } : g
      ));

      setEditingGroupId(null);
      setSelectedStaffForEdit(new Set());
      setReplacingCount(0);
      showToast('Group updated', 'success');
    } catch (error: any) {
      console.error('Error updating group:', error);
      showToast(error.message || 'Failed to update group', 'error');
    }
  };

  // Cancel edit
  const cancelEditGroup = () => {
    setEditingGroupId(null);
    setSelectedStaffForEdit(new Set());
    setReplacingCount(0);
  };

  // Drag group to cell - adds all members individually
  const handleDragGroupStart = (e: React.DragEvent, group: StaffGroup) => {
    // Store all group members for dropping
    setDraggedStaff({ name: group.members[0], groupMembers: group.members });
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Handle drop outside any cell (delete)
  const handleDragEnd = () => {
    // If we were dragging from a cell and didn't drop anywhere valid, remove the assignment
    if (draggedStaff?.sourceDate && draggedStaff?.sourceShift) {
      const sourceKey = `${draggedStaff.sourceDate}-${draggedStaff.sourceShift}`;
      setRosterAssignments(prev => {
        const updated = { ...prev };
        if (updated[sourceKey]) {
          updated[sourceKey] = updated[sourceKey].filter(a => a.staffName !== draggedStaff.name);
          if (updated[sourceKey].length === 0) {
            delete updated[sourceKey];
          }
        }
        return updated;
      });
      showToast('Assignment removed', 'success');
    }
    setDraggedStaff(null);
  };

  // Toggle staff selection for multi-drag
  const toggleStaffSelection = (staffName: string) => {
    setSelectedStaff(prev => {
      const newSet = new Set(prev);
      if (newSet.has(staffName)) {
        newSet.delete(staffName);
      } else {
        newSet.add(staffName);
      }
      return newSet;
    });
  };

  // Remove assignment by clicking
  const removeAssignment = (dateKey: string, shiftId: string, index: number) => {
    const assignmentKey = `${dateKey}-${shiftId}`;
    setRosterAssignments(prev => {
      const updated = { ...prev };
      if (updated[assignmentKey]) {
        updated[assignmentKey] = updated[assignmentKey].filter((_, i) => i !== index);
        if (updated[assignmentKey].length === 0) {
          delete updated[assignmentKey];
        }
      }
      return updated;
    });
  };

  // Right-click context menu handler
  const handleContextMenu = (e: React.MouseEvent, dateKey: string, shiftId: string, index: number) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      assignmentKey: `${dateKey}-${shiftId}`,
      assignmentIndex: index
    });
  };

  // Update assignment markers (toggle on/off)
  const updateAssignment = (markerToAdd: string) => {
    if (!contextMenu) return;

    setRosterAssignments(prev => {
      const updated = { ...prev };
      const assignments = updated[contextMenu.assignmentKey];
      
      if (assignments && assignments[contextMenu.assignmentIndex]) {
        // Create a new assignment object with updated markers (don't mutate)
        const currentAssignment = assignments[contextMenu.assignmentIndex];
        let newMarkers: string[];
        
        if (currentAssignment.markers.includes(markerToAdd)) {
          // Remove marker
          newMarkers = currentAssignment.markers.filter(m => m !== markerToAdd);
        } else {
          // Add marker
          newMarkers = [...currentAssignment.markers, markerToAdd];
        }
        
        // Create new array with updated assignment
        const newAssignments = [...assignments];
        newAssignments[contextMenu.assignmentIndex] = {
          ...currentAssignment,
          markers: newMarkers
        };
        
        updated[contextMenu.assignmentKey] = newAssignments;
      }
      
      return updated;
    });

    setContextMenu(null);
  };

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
      setShowSettings(false);
    };
    if (contextMenu?.visible || showSettings) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu, showSettings]);

  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[95vw] h-[95vh] flex flex-col select-none">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          {/* Month Selector - Centered */}
          <div className="flex items-center gap-2 flex-1 justify-center">
            <button
              onClick={prevMonth}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-gray-800">X-Ray {institutionCode || ''} - {monthName}</h2>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          {/* Settings Button */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSettings(!showSettings);
              }}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <Settings className="w-5 h-5" />
            </button>
            
            {/* Settings Dropdown Menu */}
            {showSettings && (
              <div 
                className="absolute right-0 top-12 bg-white border rounded-lg shadow-lg py-2 z-[50] min-w-[200px]"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    handlePrintRoster();
                    setShowSettings(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                >
                  <span>🖨️</span>
                  <span>Print Roster</span>
                </button>
                
                <button
                  onClick={() => {
                    handlePrintRoster(true);
                    setShowSettings(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                >
                  <span>📄</span>
                  <span>Fit to A4 Page</span>
                </button>
                
                <button
                  onClick={() => {
                    handleSaveRoster();
                    setShowSettings(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                >
                  <span>💾</span>
                  <span>Save Roster</span>
                </button>
                
                <button
                  onClick={() => {
                    handleImportRoster();
                    setShowSettings(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                >
                  <span>📥</span>
                  <span>Import Roster</span>
                </button>
                
                <button
                  onClick={() => {
                    handleClearRoster();
                    setShowSettings(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                >
                  <span>🗑️</span>
                  <span>Clear Roster</span>
                </button>
              </div>
            )}
            
            {onClose && (
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Calendar Grid - Separate table for each week */}
          <div className="flex-1 overflow-auto p-4 space-y-6">
            {(() => {
              // Group days by week
              const weeks: Date[][] = [];
              let currentWeek: Date[] = [];
              
              daysInMonth.forEach((day, index) => {
                currentWeek.push(day);
                
                // Start new week after Saturday or at end of month
                if (day.getDay() === 6 || index === daysInMonth.length - 1) {
                  weeks.push([...currentWeek]);
                  currentWeek = [];
                }
              });

              return weeks.map((week, weekIndex) => {
                // Check if this week has any staff assignments or (R) markers
                const weekHasAssignments = week.some(day => {
                  const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                  // Check all shifts for this day
                  return shifts.some(shift => {
                    const key = `${dateKey}-${shift.id}`;
                    const assignments = rosterAssignments[key] || [];
                    return assignments.length > 0;
                  });
                });
                
                // Skip weeks with no assignments
                if (!weekHasAssignments) {
                  return null;
                }
                
                // Get week date range for header
                const weekStart = week[0];
                const weekEnd = week[week.length - 1];
                const weekHeader = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

                return (
                  <div key={`week-${weekIndex}`} className="mb-8">
                    <table className="w-full min-w-[900px] border-collapse border border-gray-300">
                      {/* Header rows - Day names and dates */}
                      <thead>
                        <tr>
                          <th className="w-[100px] bg-gray-100 border p-2"></th>
                          {/* Always show all 7 days in order: Sun-Sat */}
                          {['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].map((dayName, dayIndex) => {
                            // Find the date for this day in current week
                            const day = week.find(d => d.getDay() === dayIndex);
                            return (
                              <th key={dayIndex} className="bg-gray-100 border p-2 text-xs font-semibold text-gray-700">
                                {dayName}
                              </th>
                            );
                          })}
                        </tr>
                        <tr>
                          <th className="w-[100px] bg-gray-100 border p-2"></th>
                          {/* Date row - aligned with day columns */}
                          {['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].map((_, dayIndex) => {
                            const day = week.find(d => d.getDay() === dayIndex);
                            if (!day) {
                              return <th key={dayIndex} className="bg-gray-50 border p-2"></th>;
                            }
                            const dayNum = String(day.getDate()).padStart(2, '0');
                            const monthNum = String(day.getMonth() + 1).padStart(2, '0');
                            const yearNum = String(day.getFullYear());
                            const dateKey = formatDateKey(day);
                            
                            // Check if any shifts have staff for this date
                            const hasStaff = shifts.some(shift => {
                              const assignmentKey = `${dateKey}-${shift.id}`;
                              return (rosterAssignments[assignmentKey] || []).length > 0;
                            });
                            
                            return (
                              <th 
                                key={dayIndex} 
                                className="bg-gray-50 border p-2 text-xs font-semibold text-gray-700 relative group"
                              >
                                {/* Centered date text */}
                                <div className="text-center">
                                  <span>{dayNum} {monthNum} {yearNum}</span>
                                </div>
                                {/* X button positioned absolute on the right */}
                                {hasStaff && (
                                  <button
                                    onClick={() => {
                                      const dateDisplay = `${dayNum} ${monthNum} ${yearNum}`;
                                      showDeleteAllModal(day, dateDisplay);
                                    }}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 text-xs transition-opacity"
                                    title="Clear all staff for this date"
                                  >
                                    ×
                                  </button>
                                )}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>

                      {/* Body - 3 rows for 3 shifts */}
                      <tbody>
                        {shifts.map((shift, shiftIndex) => (
                          <tr key={`week-${weekIndex}-shift-${shiftIndex}`}>
                            {/* First column - Shift label */}
                            <td 
                              className="bg-gray-100 border p-2 align-middle text-center"
                            >
                              <div className="font-bold text-gray-800 text-xs">{shift.label}</div>
                            </td>

                            {/* Day cells for this shift */}
                            {['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].map((_, dayIndex) => {
                              // Find the date for this day in current week
                              const day = week.find(d => d.getDay() === dayIndex);
                                                      
                              if (!day) {
                                // Empty cell for days outside this month
                                return (
                                  <td 
                                    key={`empty-week${weekIndex}-day${dayIndex}`}
                                    className="bg-gray-50 border min-h-[100px]"
                                  />
                                );
                              }
                            
                              const dateKey = formatDateKey(day);
                              const assignmentKey = `${dateKey}-${shift.id}`;
                              const assignments = rosterAssignments[assignmentKey] || [];
                              
                              return (
                                <td
                                  key={`${dateKey}-${shift.id}`}
                                  className={`${shift.color} border p-2 min-h-[100px] align-top`}
                                  onDragOver={handleDragOver}
                                  onDrop={(e) => handleDrop(e, day, shift.id)}
                                >
                                  {assignments.length > 0 ? (
                                    <div className="space-y-1.5">
                                      {assignments.map((assignment, idx) => (
                                        <div
                                          key={idx}
                                          draggable
                                          onDragStart={(e) => handleDragStartFromCell(e, assignment.staffName, dateKey, shift.id)}
                                          onContextMenu={(e) => handleContextMenu(e, dateKey, shift.id, idx)}
                                          className="group relative cursor-move"
                                        >
                                          {/* Staff name with markers prefix and (R) suffix */}
                                          <div className="text-[11px] font-medium text-gray-900 bg-white px-2 py-1 rounded hover:bg-red-100 transition-colors relative group">
                                            {/* Centered content */}
                                            <div className="text-center">
                                              {/* Center markers as prefix (*, **, etc.) - black, no space */}
                                              {assignment.markers.filter(m => m !== '(R)').map((marker, idx) => (
                                                <span key={idx} className="text-black font-bold">{marker}</span>
                                              ))}
                                              {/* Staff name */}
                                              {assignment.staffName}
                                              {/* (R) as suffix - black, no space */}
                                              {assignment.markers.includes('(R)') && (
                                                <span className="text-black font-semibold">(R)</span>
                                              )}
                                            </div>
                                            {/* X button positioned absolute on the right */}
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                removeAssignment(dateKey, shift.id, idx);
                                              }}
                                              className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 text-base"
                                            >
                                              ×
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="h-full flex items-center justify-center">
                                      <span className="text-[10px] text-gray-400 italic">Drop</span>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }).filter(Boolean);
            })()}
          </div>

          {/* Staff List Panel */}
          <div className="w-64 border-l bg-gray-50 flex flex-col">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-800">
                  {showGroups 
                    ? (groups.length === 1 ? 'Available Group' : 'Available Groups') 
                    : showReplacing 
                      ? 'Available Staff (R)' 
                      : 'Available Staff'}
                </h3>
                <button
                  onClick={() => {
                    if (!showGroups && !showReplacing) {
                      // INDIVIDUAL -> REPLACING
                      setShowReplacing(true);
                    } else if (!showGroups && showReplacing) {
                      // REPLACING -> GROUP
                      setShowReplacing(false);
                      setShowGroups(true);
                    } else {
                      // GROUP -> INDIVIDUAL
                      setShowGroups(false);
                    }
                  }}
                  className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors font-medium"
                >
                  {!showGroups && !showReplacing ? 'INDIVIDUAL' : !showGroups && showReplacing ? 'REPLACING' : 'GROUPS'}
                </button>
              </div>
              <p className="text-xs text-gray-600">
                {showGroups 
                  ? 'Drag to assign all staff in group' 
                  : showReplacing
                    ? selectedStaff.size > 0 
                      ? `${selectedStaff.size} selected - Will add with (R) marker` 
                      : 'Drag names - will add with (R) marker'
                    : selectedStaff.size > 0 
                      ? `${selectedStaff.size} selected - Right-click to create group` 
                      : 'Drag names to cells'}
              </p>
              
              {/* Add Group Button - Only show when multiple staff selected */}
              {!showGroups && selectedStaff.size >= 2 && !groupExists(Array.from(selectedStaff)) && (
                <button
                  onClick={() => setShowAddGroupModal(true)}
                  className="mt-2 w-full text-xs px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors font-medium"
                >
                  + Add Group
                </button>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="text-center text-gray-500 text-sm">Loading...</div>
              ) : showGroups ? (
                // Render Groups
                groups.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm">No groups yet</div>
                ) : (
                  <div className="space-y-2">
                    {groups.map(group => (
                      <div
                        key={group.id}
                        draggable
                        onDragStart={(e) => handleDragGroupStart(e, group)}
                        className="relative bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg px-3 py-3 cursor-move transition-all shadow-sm hover:shadow-md group"
                      >
                        {/* Action buttons - top right */}
                        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Edit button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditGroup(group);
                            }}
                            className="w-6 h-6 flex items-center justify-center text-blue-500 hover:text-blue-700 hover:bg-blue-100 rounded-full transition-colors"
                            title="Edit group staff"
                          >
                            ✏️
                          </button>
                          {/* Delete button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete ${group.name}? This will renumber all groups.`)) {
                                handleDeleteGroup(group.id);
                              }
                            }}
                            className="w-6 h-6 flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full transition-colors text-lg font-bold"
                            title="Delete group"
                          >
                            ×
                          </button>
                        </div>
                        
                        <div className="font-bold text-purple-900 text-sm mb-1 pr-16">{group.name}</div>
                        <div className="text-xs text-gray-700 space-y-0.5">
                          {group.members.map((member, idx) => (
                            <div key={idx}>• {member}</div>
                          ))}
                        </div>
                        <div className="absolute bottom-1 right-2 text-xs text-purple-600 font-semibold">
                          {group.members.length} Staff
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : staffList.length === 0 ? (
                <div className="text-center text-gray-500 text-sm">No staff found</div>
              ) : (
                <div className="space-y-2">
                  {staffList.map(staff => {
                    const isSelected = selectedStaff.has(staff.display_name);
                    // Add (R) suffix in REPLACING mode (no space)
                    const displayName = showReplacing ? `${staff.display_name}(R)` : staff.display_name;
                    
                    return (
                      <div
                        key={staff.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, staff.display_name)}
                        onDragEnd={handleDragEnd}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          toggleStaffSelection(staff.display_name);
                        }}
                        className={`relative bg-white border rounded px-3 py-2 text-sm font-medium cursor-move transition-all active:cursor-grabbing shadow-sm ${
                          isSelected 
                            ? 'bg-green-50 border-green-400 hover:bg-green-100' 
                            : showReplacing
                              ? 'text-purple-800 bg-purple-50 border-purple-300 hover:bg-purple-100 hover:border-purple-400'
                              : 'text-gray-800 hover:bg-blue-50 hover:border-blue-300'
                        }`}
                      >
                        {/* Selection tick badge */}
                        {isSelected && (
                          <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-md">
                            ✓
                          </div>
                        )}
                        {displayName}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Context Menu */}
        {contextMenu?.visible && (
          <div
            className="fixed bg-white border rounded-lg shadow-lg py-2 z-[60] min-w-[200px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="px-3 py-2 text-xs font-semibold text-gray-600 border-b">Toggle Markers</div>
            
            {/* Clear all markers */}
            <button
              onClick={() => {
                if (!contextMenu) return;
                setRosterAssignments(prev => {
                  const updated = { ...prev };
                  const assignment = updated[contextMenu.assignmentKey]?.[contextMenu.assignmentIndex];
                  if (assignment) {
                    assignment.markers = [];
                  }
                  return updated;
                });
                setContextMenu(null);
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
            >
              Clear All Markers
            </button>

            {/* (R) variant - Replacing - toggle */}
            <button
              onClick={() => updateAssignment('(R)')}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
            >
              (R) - Replacing
            </button>

            {/* Center markers - toggle */}
            {availableCenters.map(center => (
              <button
                key={center.marker}
                onClick={() => updateAssignment(center.marker)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              >
                {center.marker} - {center.name}
              </button>
            ))}
          </div>
        )}

        {/* Toast Notification */}
        {toast && (
          <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-[70] ${
            toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
          } text-white`}>
            {toast.message}
          </div>
        )}

        {/* Confirmation Modal for Batch Assignment */}
        {confirmationModal.visible && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Confirm Batch Assignment</h3>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-700 mb-2">
                    You are about to add <span className="font-semibold">{confirmationModal.staffNames.length}</span> staff member(s) to shift <span className="font-semibold">{confirmationModal.shiftLabel}</span>:
                  </p>
                  
                  <div className="bg-gray-50 border rounded-lg p-3 max-h-60 overflow-y-auto">
                    <ol className="list-decimal list-inside space-y-1">
                      {confirmationModal.staffNames.map((name, idx) => (
                        <li key={idx} className="text-sm text-gray-800">{name}</li>
                      ))}
                    </ol>
                  </div>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={cancelBatchAssignment}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmBatchAssignment}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                  >
                    Confirm Assignment
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete All Staff Modal */}
        {deleteAllModal.visible && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Clear Staff Assignments</h3>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-700 mb-3">
                    Select which shift(s) to clear for date <span className="font-semibold">{deleteAllModal.dateDisplay}</span>:
                  </p>
                  
                  <div className="space-y-2">
                    {deleteAllModal.availableShifts.map(shift => (
                      <button
                        key={shift.id}
                        onClick={() => deleteShiftStaff(shift.id)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors group"
                      >
                        <div>
                          <div className="font-semibold text-gray-800">{shift.label}</div>
                          <div className="text-xs text-gray-600">{shift.count} staff member(s)</div>
                        </div>
                        <span className="text-red-600 font-bold text-xl opacity-0 group-hover:opacity-100 transition-opacity">×</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between gap-3">
                  <button
                    onClick={deleteAllShiftsForDate}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={closeDeleteAllModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Clear Roster Confirmation Modal */}
        {showClearConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[90]">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">⚠️ Confirm Clear Roster</h3>
                
                <div className="mb-6">
                  <p className="text-sm text-gray-700 mb-2">
                    Are you sure you want to clear <span className="font-semibold text-red-600">ALL</span> roster assignments for:
                  </p>
                  <p className="text-lg font-bold text-center text-gray-900 bg-red-50 p-3 rounded-lg border border-red-200">
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                  <p className="text-xs text-gray-500 mt-3 text-center">This action cannot be undone.</p>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={cancelClearRoster}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeClearRoster}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                  >
                    Yes, Clear Roster
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Group Modal */}
        {showAddGroupModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[95]">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Create New Group</h3>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-700 mb-3">
                    Selected staff ({selectedStaff.size}):
                  </p>
                  <div className="bg-gray-50 p-3 rounded-lg border max-h-40 overflow-y-auto">
                    {Array.from(selectedStaff).map((name, idx) => (
                      <div key={idx} className="text-sm text-gray-800 py-1">• {name}</div>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Group Name (optional - will auto-generate if empty)
                  </label>
                  <input
                    type="text"
                    value={groupNameInput}
                    onChange={(e) => setGroupNameInput(e.target.value)}
                    placeholder={`e.g., ${(() => {
                      let num = 1;
                      while (groups.some(g => g.name === `Group ${num}`)) num++;
                      return `Group ${num}`;
                    })()}`}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setShowAddGroupModal(false);
                      setGroupNameInput('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddGroup}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
                  >
                    Create Group
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Group Modal */}
        {editingGroupId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[95]">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
              <div className="p-6 flex-1 overflow-y-auto">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Edit Group Staff</h3>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-700 mb-3">
                    Click staff to add/remove from group (minimum 2 required):
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                    {staffList.map(staff => {
                      const isSelected = selectedStaffForEdit.has(staff.display_name);
                      return (
                        <button
                          key={staff.id}
                          onClick={() => toggleStaffInEdit(staff.display_name)}
                          className={`text-left px-3 py-2 rounded border text-sm transition-all ${
                            isSelected
                              ? 'bg-purple-100 border-purple-400 text-purple-900 font-medium'
                              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {isSelected && <span className="mr-2">✓</span>}
                          {staff.display_name}
                        </button>
                      );
                    })}
                  </div>
                  
                  <div className="mt-3 text-sm text-gray-600">
                    Selected: <span className="font-semibold text-purple-700">{selectedStaffForEdit.size}</span> Staff
                  </div>

                  {/* (R) Replacing section */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="text-sm text-gray-700 font-medium mb-3">Replacing (R)</div>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setReplacingCount(prev => Math.max(0, prev - 1))}
                        className="w-12 h-12 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold text-2xl flex items-center justify-center transition-colors">
                        −
                      </button>
                      <div className="flex-1 text-center">
                        <div className="text-3xl font-bold text-purple-700">{replacingCount}</div>
                        <div className="text-xs text-gray-500">{replacingCount === 1 ? 'replacer' : 'replacers'}</div>
                      </div>
                      <button 
                        onClick={() => setReplacingCount(prev => prev + 1)}
                        className="w-12 h-12 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold text-2xl flex items-center justify-center transition-colors">
                        +
                      </button>
                    </div>
                    {replacingCount > 0 && (
                      <div className="mt-3 text-xs text-gray-600">
                        <div className="font-medium mb-1">Will add to group:</div>
                        <div className="flex flex-wrap gap-1">
                          {Array.from({ length: replacingCount }, (_, i) => (
                            <span key={i} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold">(R)</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={cancelEditGroup}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEditedGroup}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
