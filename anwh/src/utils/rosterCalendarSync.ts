import { DaySchedule, SpecialDates } from '../types';
import { RosterEntry } from '../types/roster';

export interface RosterCalendarSyncOptions {
  calendarLabel: string;
  schedule: DaySchedule;
  specialDates: SpecialDates;
  setSchedule: (schedule: DaySchedule | ((prev: DaySchedule) => DaySchedule)) => void;
  setSpecialDates: (specialDates: SpecialDates | ((prev: SpecialDates) => SpecialDates)) => void;
  entries?: RosterEntry[]; // Add entries to check for special date status
}

export interface RosterChangeEvent {
  date: string;
  shiftType: string;
  assignedName: string;
  editorName: string;
  action: 'added' | 'updated' | 'removed';
}

/**
 * Validates if a shift is allowed on a specific date
 */
export const validateShiftForDate = (date: string, shiftType: string, isSpecialDate: boolean): boolean => {
  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
  
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
  
  if (validShiftIds.includes(shiftType)) {
    // Already in correct format
    calendarShiftId = shiftType;
  } else if (shiftMapping[shiftType]) {
    // Legacy format - convert to shift ID
    calendarShiftId = shiftMapping[shiftType];
  }
  
  if (!calendarShiftId) {
    return false;
  }
  
  // Validation rules based on day and special status
  if (isSpecialDate) {
    // Special dates allow: 9-4, 4-10, N (but not 12-10)
    const allowedOnSpecial = ['9-4', '4-10', 'N'];
    const isValid = allowedOnSpecial.includes(calendarShiftId);
    return isValid;
  } else {
    // Regular day validation
    if (dayOfWeek === 6) { // Saturday
      const allowedOnSaturday = ['12-10', 'N'];
      const isValid = allowedOnSaturday.includes(calendarShiftId);
      return isValid;
    } else if (dayOfWeek === 0) { // Sunday
      const allowedOnSunday = ['9-4', '4-10', 'N'];
      const isValid = allowedOnSunday.includes(calendarShiftId);
      return isValid;
    } else { // Weekdays (Monday-Friday)
      const allowedOnWeekday = ['4-10', 'N'];
      const isValid = allowedOnWeekday.includes(calendarShiftId);
      return isValid;
    }
  }
};

/**
 * Checks if shift conflicts with existing shifts in calendar
 */
export const checkShiftConflicts = (date: string, newShiftType: string, currentShifts: string[]): boolean => {
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
  let newShiftId: string | null = null;
  
  if (validShiftIds.includes(newShiftType)) {
    // Already in correct format
    newShiftId = newShiftType;
  } else if (shiftMapping[newShiftType]) {
    // Legacy format - convert to shift ID
    newShiftId = shiftMapping[newShiftType];
  }
  
  if (!newShiftId) return true; // Unknown shift = conflict
  
  // Check for conflicts
  // 9-4 and 12-10 cannot overlap
  if (newShiftId === '9-4' && currentShifts.includes('12-10')) return true;
  if (newShiftId === '12-10' && currentShifts.includes('9-4')) return true;
  
  // 12-10 and 4-10 cannot overlap
  if (newShiftId === '12-10' && currentShifts.includes('4-10')) return true;
  if (newShiftId === '4-10' && currentShifts.includes('12-10')) return true;
  
  // Check if shift already exists
  if (currentShifts.includes(newShiftId)) return true;
  
  return false; // No conflicts
};

/**
 * Determines if a date needs to be marked as special for the shift to be valid
 */
export const requiresSpecialDate = (date: string, shiftType: string): boolean => {
  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay();
  
  // Support both legacy full names AND modern shift IDs
  // Convert shift ID to full name for comparison
  const shiftIdToName: Record<string, string> = {
    '9-4': 'Morning Shift (9-4)',
    '4-10': 'Evening Shift (4-10)',
    '12-10': 'Saturday Regular (12-10)',
    'N': 'Night Duty'
  };
  
  // If it's a shift ID, convert to full name for comparison
  const fullShiftType = shiftIdToName[shiftType] || shiftType;
  
  // Saturday with Morning Shift (9-4) requires special marking
  if (dayOfWeek === 6 && fullShiftType === 'Morning Shift (9-4)') {
    return true;
  }
  
  // Weekday with Morning Shift (9-4) requires special marking
  if (dayOfWeek >= 1 && dayOfWeek <= 5 && fullShiftType === 'Morning Shift (9-4)') {
    return true;
  }
  
  return false;
};

/**
 * Handle removal synchronization - remove shift from calendar
 */
const handleRemovalSync = (
  date: string,
  shiftType: string,
  assignedName: string,
  options: Pick<RosterCalendarSyncOptions, 'calendarLabel' | 'schedule' | 'specialDates' | 'setSchedule' | 'setSpecialDates'>
): boolean => {
  const { calendarLabel, schedule, specialDates, setSchedule, setSpecialDates } = options;
  
  // CRITICAL: Only sync removal if the assigned name matches the calendar label
  // Handle both NARAYYA and NARAYYA(R) as the same person
  // ALSO handle ID-based names like NARAYYA_N280881240162C -> extract NARAYYA
  
  // Extract base name for comparison (handles ID-based format: SURNAME_IDNUMBER)
  const extractBaseName = (name: string): string => {
    // Remove (R) suffix first
    let baseName = name.replace(/\(R\)$/, '').trim().toUpperCase();
    
    // If name contains underscore (ID-based format), extract only the surname part
    if (baseName.includes('_')) {
      const parts = baseName.split('_');
      baseName = parts[0]; // Take only the surname part before the underscore
    }
    
    return baseName;
  };
  
  const assignedBaseName = extractBaseName(assignedName);
  const calendarBaseName = extractBaseName(calendarLabel);
  
  // If names don't match, don't sync removal to calendar
  if (assignedBaseName !== calendarBaseName) {
    return false;
  }
  
  // Map roster shift type to calendar shift ID
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
  
  if (validShiftIds.includes(shiftType)) {
    // Already in correct format
    calendarShiftId = shiftType;
  } else if (shiftMapping[shiftType]) {
    // Legacy format - convert to shift ID
    calendarShiftId = shiftMapping[shiftType];
  }
  
  if (!calendarShiftId) {
    return false;
  }
  
  // Get current shifts for this date
  const currentShifts = schedule[date] || [];
  
  // Find shifts that match the base shift ID (handles staff suffix format)
  const matchingShifts = currentShifts.filter((existingShift: string) => {
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
  
  // Check if the shift exists in calendar
  if (matchingShifts.length === 0) {
    return false;
  }
  
  // Remove ALL matching shifts from calendar (including staff-suffixed versions)
  setSchedule(prev => {
    const newSchedule = { ...prev };
    const updatedShifts = currentShifts.filter((shift: string) => {
      const parts = shift.split('-');
      if (parts.length >= 2 && parts[0].match(/^\d+$/) && parts[1].match(/^\d+$/)) {
        const baseId = `${parts[0]}-${parts[1]}`;
        return baseId !== calendarShiftId;
      }
      if (parts.length > 1) {
        return parts[0] !== calendarShiftId;
      }
      return shift !== calendarShiftId;
    });
    
    if (updatedShifts.length === 0) {
      // If no shifts left, remove the date entry completely
      delete newSchedule[date];
    } else {
      // Otherwise, update with remaining shifts
      newSchedule[date] = updatedShifts;
    }
    
    return newSchedule;
  });
  
  // Note: We don't remove special date marking when removing shifts
  // because the person might have special activities without any shifts
  
  // Delay removal notification to check if this is part of a name update
  const removalKey = `${date}-${shiftType}`;
  setTimeout(() => {
    // Check if this removal was part of an update (tracked removal was deleted)
    if (!recentRemovals.has(removalKey)) {
      // This was part of an update, don't show removal toast
      return;
    }
    
    // Show enhanced removal notification with person's name
    // Extract display name from ID-based format for clean notifications
    let displayName = assignedName;
    if (assignedName.includes('_')) {
      const parts = assignedName.split('_');
      const surname = parts[0];
      const hasDisambiguation = parts[1]?.startsWith('(') && parts[1]?.endsWith(')');
      if (hasDisambiguation) {
        const withoutId = parts.slice(0, -1).join('_');
        displayName = withoutId.replace(/_\(([^)]+)\)/, ' ($1)');
      } else {
        displayName = surname;
      }
    } else {
      displayName = assignedName.replace(/\(R\)$/, '').trim();
    }
    
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 8px 25px rgba(239, 68, 68, 0.4);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
      font-weight: 500;
      max-width: 320px;
      animation: slideInRight 0.3s ease-out;
      border: 2px solid rgba(255, 255, 255, 0.2);
    `;
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <div style="width: 8px; height: 8px; background: white; border-radius: 50%; opacity: 0.9;"></div>
        <strong style="font-size: 15px;">Calendar Updated</strong>
      </div>
      <div style="font-size: 13px; line-height: 1.4; opacity: 0.95;">
        <strong>${displayName}</strong> removed from <strong>${calendarLabel}</strong>'s calendar<br>
        📅 <strong>${date}</strong> - ${shiftType}
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 300);
      }
    }, 4000);
  }, REMOVAL_TRACKING_WINDOW + 50); // Wait longer than the tracking window
  
  return true;
};

// Add CSS for notification animations
const addNotificationStyles = () => {
  if (!document.querySelector('#roster-sync-styles')) {
    const style = document.createElement('style');
    style.id = 'roster-sync-styles';
    style.textContent = `
      @keyframes slideInRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }
};

// Initialize styles
addNotificationStyles();

// Track recent removal events to detect name updates
const recentRemovals = new Map<string, { name: string, timestamp: number }>();
const REMOVAL_TRACKING_WINDOW = 200; // ms - if add follows removal within this window, it's an update

// Track recent update toasts to prevent duplicate green toast
const recentUpdateToasts = new Set<string>();
const UPDATE_TOAST_WINDOW = 500; // ms

/**
 * Main synchronization function
 */
export const syncRosterToCalendar = (
  rosterChange: RosterChangeEvent,
  options: RosterCalendarSyncOptions
): boolean => {
  const { calendarLabel, schedule, specialDates, setSchedule, setSpecialDates } = options;
  const { date, shiftType, assignedName, editorName, action } = rosterChange;
  
  // Check if we're in batch import mode
  const isBatchImport = (window as any).batchImportMode === true;
  
  // CRITICAL: Only sync if the assigned name matches the calendar label
  // This prevents other people's roster changes from affecting your personal calendar
  // Handle both NARAYYA and NARAYYA(R) as the same person
  // ALSO handle ID-based names like NARAYYA_N280881240162C -> extract NARAYYA
  
  // Extract base name for comparison (handles ID-based format: SURNAME_IDNUMBER)
  const extractBaseName = (name: string): string => {
    // Remove (R) suffix first
    let baseName = name.replace(/\(R\)$/, '').trim().toUpperCase();
    
    // If name contains underscore (ID-based format), extract only the surname part
    if (baseName.includes('_')) {
      const parts = baseName.split('_');
      baseName = parts[0]; // Take only the surname part before the underscore
    }
    
    return baseName;
  };
  
  const assignedBaseName = extractBaseName(assignedName);
  const calendarBaseName = extractBaseName(calendarLabel);
  
  // If names don't match, don't sync to calendar
  if (assignedBaseName !== calendarBaseName) {
    return false;
  }
  
  // Track imports for batch notification
  if (isBatchImport) {
    if (!(window as any).batchImportStats) {
      (window as any).batchImportStats = {
        count: 0,
        staffName: calendarLabel,
        dates: new Set<string>()
      };
    }
    (window as any).batchImportStats.count++;
    (window as any).batchImportStats.dates.add(date);
  }
  
  // Handle removal action
  if (action === 'removed') {
    // Track this removal to detect name updates
    const removalKey = `${date}-${shiftType}`;
    recentRemovals.set(removalKey, { name: assignedName, timestamp: Date.now() });
    
    // Clean up old removals (older than tracking window)
    const now = Date.now();
    for (const [key, value] of recentRemovals.entries()) {
      if (now - value.timestamp > REMOVAL_TRACKING_WINDOW * 2) {
        recentRemovals.delete(key);
      }
    }
    
    return handleRemovalSync(date, shiftType, assignedName, { calendarLabel, schedule, specialDates, setSchedule, setSpecialDates });
  }
  
  // Check if this is part of a name update (removal + addition within short window)
  if (action === 'added' || action === 'updated') {
    const removalKey = `${date}-${shiftType}`;
    const recentRemoval = recentRemovals.get(removalKey);
    
    if (recentRemoval && (Date.now() - recentRemoval.timestamp) <= REMOVAL_TRACKING_WINDOW) {
      // This is a name update! Show yellow "updated" toast instead
      // Extract display names for notification
      let oldDisplayName = recentRemoval.name;
      let newDisplayName = assignedName;
      
      // Simplify names for display (remove ID suffix)
      if (oldDisplayName.includes('_')) {
        const parts = oldDisplayName.split('_');
        const surname = parts[0];
        const hasDisambiguation = parts[1]?.startsWith('(') && parts[1]?.endsWith(')');
        oldDisplayName = hasDisambiguation 
          ? parts.slice(0, -1).join('_').replace(/_\(([^)]+)\)/, ' ($1)')
          : surname;
      } else {
        oldDisplayName = oldDisplayName.replace(/\(R\)$/, '').trim();
      }
      
      if (newDisplayName.includes('_')) {
        const parts = newDisplayName.split('_');
        const surname = parts[0];
        const hasDisambiguation = parts[1]?.startsWith('(') && parts[1]?.endsWith(')');
        newDisplayName = hasDisambiguation 
          ? parts.slice(0, -1).join('_').replace(/_\(([^)]+)\)/, ' ($1)')
          : surname;
      } else {
        newDisplayName = newDisplayName.replace(/\(R\)$/, '').trim();
      }
      
      // Show yellow update notification
      if (!isBatchImport) {
        const notification = document.createElement('div');
        notification.style.cssText = `
          position: fixed;
          top: 80px;
          right: 20px;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          padding: 16px 20px;
          border-radius: 12px;
          box-shadow: 0 8px 25px rgba(245, 158, 11, 0.4);
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 14px;
          font-weight: 500;
          max-width: 320px;
          animation: slideInRight 0.3s ease-out;
          border: 2px solid rgba(255, 255, 255, 0.2);
        `;
        
        notification.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <div style="width: 8px; height: 8px; background: white; border-radius: 50%; opacity: 0.9;"></div>
            <strong style="font-size: 15px;">Calendar Updated</strong>
          </div>
          <div style="font-size: 13px; line-height: 1.4; opacity: 0.95;">
            <strong>${oldDisplayName}</strong> calendar updated<br>
            📅 <strong>${date}</strong> - ${shiftType}<br>
            <span style="font-size: 11px; opacity: 0.8;">${oldDisplayName} → ${newDisplayName}</span>
          </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
          if (document.body.contains(notification)) {
            notification.style.animation = 'slideInRight 0.3s ease-out reverse';
            setTimeout(() => {
              if (document.body.contains(notification)) {
                document.body.removeChild(notification);
              }
            }, 300);
          }
        }, 3000);
      }
      
      // Remove the tracked removal to prevent duplicate toast
      recentRemovals.delete(removalKey);
      
      // Track that we showed an update toast to prevent green toast
      const updateKey = `${date}-${shiftType}`;
      recentUpdateToasts.add(updateKey);
      setTimeout(() => recentUpdateToasts.delete(updateKey), UPDATE_TOAST_WINDOW);
      
      // Still need to ensure the shift exists in calendar
      // Continue with normal sync logic below
    }
  }
  
  // Get all entries to check for special date status
  const allEntries = options.entries || [];
  const isRosterSpecialDate = checkIfRosterDateIsSpecial(date, allEntries);
  
  // Check if this date needs special marking for the shift to be valid
  const needsSpecial = requiresSpecialDate(date, shiftType);
  const currentIsSpecial = specialDates[date] === true;
  
  // Determine final special date status
  const finalSpecialStatus = needsSpecial || currentIsSpecial || isRosterSpecialDate;
  
  // Validate the shift for this date
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
  
  if (validShiftIds.includes(shiftType)) {
    // Already in correct format
    calendarShiftId = shiftType;
  } else if (shiftMapping[shiftType]) {
    // Legacy format - convert to shift ID
    calendarShiftId = shiftMapping[shiftType];
  }
  
  if (!calendarShiftId) {
    return false;
  }
  
  // Get current shifts for this date
  const currentShifts = schedule[date] || [];
  
  // Check if base shift ID already exists (prevent duplicates)
  // Manual shifts now have staff suffix (e.g., 'N-NARAYYA...'), roster sync adds base ID (e.g., 'N')
  const hasBaseShift = currentShifts.some((existingShift: string) => {
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
  
  // If base shift already exists, skip conflict check and proceed to show toast
  if (!hasBaseShift) {
    // Check for conflicts only if shift doesn't already exist
    if (checkShiftConflicts(date, shiftType, currentShifts)) {
      return false; // Don't sync if there are conflicts
    }
  }
  
  // Apply changes to calendar
  let calendarUpdated = false;
  let shiftAlreadyExisted = false;
  
  // Mark as special if roster date is special OR if shift requires special marking
  if ((needsSpecial || isRosterSpecialDate) && !currentIsSpecial) {
    setSpecialDates(prev => ({
      ...prev,
      [date]: true
    }));
    calendarUpdated = true;
  }
  
  // Add shift to calendar if not already present
  if (!hasBaseShift) {
    setSchedule(prev => ({
      ...prev,
      [date]: [...currentShifts, calendarShiftId]
    }));
    calendarUpdated = true;
  } else {
    shiftAlreadyExisted = true;
  }
  
  // Show toast notification if calendar was updated OR if shift already existed (sync confirmation)
  if (calendarUpdated || shiftAlreadyExisted) {
    // Check if we already showed an update toast for this date/shift
    const updateKey = `${date}-${shiftType}`;
    if (recentUpdateToasts.has(updateKey)) {
      // Skip green toast - yellow update toast already shown
      return calendarUpdated;
    }
    
    // Only show individual notifications if NOT in batch import mode
    if (!isBatchImport) {
      // Extract display name from ID-based format for clean notifications
      // Handles: NARAYYA_N280881240162C → NARAYYA
      //          NARAYYA_(T)_N280881240162C → NARAYYA (T)
      //          NARAYYA_(THOMAS)_N280881240162C → NARAYYA (THOMAS)
      let displayName = assignedName;
      if (assignedName.includes('_')) {
        const parts = assignedName.split('_');
        const surname = parts[0];
        
        // Check if there's a disambiguation part in parentheses
        const hasDisambiguation = parts[1]?.startsWith('(') && parts[1]?.endsWith(')');
        
        if (hasDisambiguation) {
          // Remove trailing underscore and ID number
          const withoutId = parts.slice(0, -1).join('_'); // Remove last part (ID)
          // Convert NARAYYA_(T) → NARAYYA (T)
          displayName = withoutId.replace(/_\(([^)]+)\)/, ' ($1)');
        } else {
          // Simple format: just surname
          displayName = surname;
        }
      } else {
        // Fallback: just remove (R) suffix
        displayName = assignedName.replace(/\(R\)$/, '').trim();
      }
      
      // Show enhanced addition notification
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 14px;
        font-weight: 500;
        max-width: 320px;
        animation: slideInRight 0.3s ease-out;
        border: 2px solid rgba(255, 255, 255, 0.2);
      `;
      
      notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <div style="width: 8px; height: 8px; background: white; border-radius: 50%; opacity: 0.9;"></div>
          <strong style="font-size: 15px;">Calendar ${shiftAlreadyExisted ? 'Synced' : 'Updated'}</strong>
        </div>
        <div style="font-size: 13px; line-height: 1.4; opacity: 0.95;">
          <strong>${displayName}</strong> ${shiftAlreadyExisted ? 'synced to' : 'added to'} <strong>${calendarLabel}</strong>'s calendar<br>
          📅 <strong>${date}</strong> - ${shiftType}
          ${(needsSpecial || isRosterSpecialDate) ? '<br>📌 Date marked as special' : ''}
          ${shiftAlreadyExisted ? '<br><span style="font-size: 11px; opacity: 0.8;">(Shift already existed)</span>' : ''}
        </div>
      `;
      
      document.body.appendChild(notification);
      
      // Auto-remove after 3 seconds
      setTimeout(() => {
        if (document.body.contains(notification)) {
          notification.style.animation = 'slideInRight 0.3s ease-out reverse';
          setTimeout(() => {
            if (document.body.contains(notification)) {
              document.body.removeChild(notification);
            }
          }, 300);
        }
      }, 3000);
    }
  }
  
  return calendarUpdated;
};

/**
 * Check if a date is marked as special in the roster entries
 */
const checkIfRosterDateIsSpecial = (date: string, entries: RosterEntry[]): boolean => {
  // Get all entries for this date
  const dateEntries = entries.filter(entry => entry.date === date);
  
  // Check if any entry has special date info in change_description
  for (const entry of dateEntries) {
    if (entry.change_description && entry.change_description.includes('Special Date:')) {
      const match = entry.change_description.match(/Special Date:\s*([^;]+)/);
      if (match && match[1].trim()) {
        return true;
      }
    }
  }
  
  return false;
};
