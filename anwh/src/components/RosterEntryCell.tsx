import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, MapPin } from 'lucide-react';
import { RosterEntry } from '../types/roster';
import { StaffSelectionModal } from './StaffSelectionModal';
import { ShiftMarkerModal } from './ShiftMarkerModal';
import ConfirmationModal from './ConfirmationModal';
import FlipCard from './FlipCard';
import { validatePasscode } from '../utils/passcodeAuth';
import { updateRosterEntry } from '../utils/rosterApi';
import { useLongPress } from '../hooks/useLongPress';
import { ScrollingText } from './ScrollingText';
import { supabase } from '../lib/supabase';
import { formatDisplayNameForUI } from '../utils/rosterDisplayName';
import { getUserSession } from '../utils/indexedDB';
import { extractMarkerPrefix } from '../utils/attachedCenters';
import { gsap } from 'gsap';
import SplitText from '../utils/SplitText';

interface RosterEntryCellProps {
  entry: RosterEntry;
  onUpdate?: (updatedEntry: RosterEntry) => void;
  onShowDetails?: (entry: RosterEntry) => void;
  allEntriesForShift?: RosterEntry[];
  isSpecialDate?: boolean;
  specialDateInfo?: string;
  availableStaff?: string[];
  staffNicknames?: Record<string, string>;
  registerRecentEdit?: (entryId: string, updatedData?: Partial<RosterEntry>, applyUpdateLater?: boolean) => void;
  applyPendingUpdate?: (entryId: string, updatedData: Partial<RosterEntry>) => void;
}

export const RosterEntryCell: React.FC<RosterEntryCellProps> = ({
  entry,
  onUpdate,
  onShowDetails,
  allEntriesForShift = [],
  isSpecialDate = false,
  specialDateInfo,
  availableStaff: propAvailableStaff,
  staffNicknames: propStaffNicknames,
  registerRecentEdit,
  applyPendingUpdate
}) => {
  // Use staff from props if provided, otherwise fetch internally (fallback)
  const [localStaffNames] = useState<string[]>([]);
  const staffNames = propAvailableStaff && propAvailableStaff.length > 0 ? propAvailableStaff : localStaffNames;
  
  // Use nicknames from parent or empty object
  const staffNicknames = propStaffNicknames || {};

  const [showStaffModal, setShowStaffModal] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [overrideNameTrigger, setOverrideNameTrigger] = useState(false); // Trigger re-render for override name
  
  // SplitText animation refs and state
  const nameDisplayRef = useRef<HTMLDivElement>(null);
  const [animateNameChange, setAnimateNameChange] = useState(false);
  const [oldName, setOldName] = useState('');
  const [newName, setNewName] = useState('');
  const [pendingNewAssignedName, setPendingNewAssignedName] = useState('');
  const hasAnimatedRef = useRef(false); // Track if we've already animated this change
  const overrideNameRef = useRef<string | null>(null); // Override name to display after animation
  const animationOldNameRef = useRef<string | null>(null); // Store old name during animation

  // Remove individual cell nickname loading - will be passed from parent instead
  // Load staff nicknames on mount - REMOVED, handled by RosterPanel now

  // Shift marker modal states
  const [showShiftMarkerModal, setShowShiftMarkerModal] = useState(false);
  const [longPressStage, setLongPressStage] = useState<'idle' | 'stage1' | 'stage2'>('idle');
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [showRipple, setShowRipple] = useState(false);
  const [ripplePosition, setRipplePosition] = useState({ x: 0, y: 0 });
  
  // Refs for measuring asterisk and name widths
  const asteriskRef = useRef<HTMLSpanElement>(null);
  const nameContainerRef = useRef<HTMLDivElement>(null);
  const [shouldApplyOffset, setShouldApplyOffset] = useState(false);
  const [offsetWidth, setOffsetWidth] = useState(0);

  // Add marker badge based on change_description (center information)
  // Only show if the LAST action was adding a marker (not removing)
  const hasCenterRemark = entry.change_description && (() => {
    // Split by | and check the LAST entry (most recent action)
    const logEntries = entry.change_description.split('|').map(e => e.trim());
    
    // Check the LAST log entry to see what the most recent action was
    const lastEntry = logEntries[logEntries.length - 1];
    
    // Check if last entry has a marker (new format: "- Marker: *")
    const markerMatch = lastEntry.match(/- Marker:\s*(\*+)/);
    if (markerMatch) {
      return true; // Last action was setting a marker
    }
    
    // Check if last entry is center removal (new format)
    const centerRemoveMatch = lastEntry.match(/\[([^\]]+)\]\s+([^:]+):\s+Center (Added|Removed):/);
    if (centerRemoveMatch && centerRemoveMatch[3] === 'Removed') {
      return false; // Last action was removing center
    }
    
    // Check if last entry is center add (new format)
    if (centerRemoveMatch && centerRemoveMatch[3] === 'Added') {
      return true; // Last action was adding center
    }
    
    // Fallback to old format: Check last entry for center/marker patterns
    if (lastEntry.includes('- Marker:') || lastEntry.includes('Center Added:') || lastEntry.includes('- Center:')) {
      return true;
    }
    
    if (lastEntry.includes('Center Removed:') || lastEntry.includes('- Removed:')) {
      return false;
    }
    
    return false;
  })();
  
  const centerRemark = hasCenterRemark ? entry.change_description?.match(/(?:Center Added:|- Center:)\s*([^;-]+)/)?.[1]?.trim() : null;
  
  // Extract the actual marker (*, **, ***) from change_description - get the LAST marker (most recent)
  const logEntries = entry.change_description?.split('|').map(e => e.trim()) || [];
  let displayMarker = '*'; // Default to *
  
  // Find the last marker entry by processing from end to beginning
  for (let i = logEntries.length - 1; i >= 0; i--) {
    const markerMatch = logEntries[i].match(/- Marker:\s*(\*+)/);
    if (markerMatch) {
      displayMarker = markerMatch[1];
      break; // Found the last marker, stop searching
    }
  }
  
  // Determine badge color based on marker count
  const getBadgeColor = () => {
    if (displayMarker === '**') return 'bg-red-600';
    if (displayMarker === '***') return 'bg-green-600';
    return 'bg-indigo-600'; // Default for single *
  };
  const badgeColorClass = getBadgeColor();
  
  // Display name without any marker (clean format)
  const baseDisplayName = formatDisplayNameForUI(entry.assigned_name);
  
  // Check if there's a nickname for this staff member
  const displayNickname = staffNicknames[entry.assigned_name] || staffNicknames[baseDisplayName] || null;
  
  // Check if entry has a shift marker and should flip
  const hasShiftMarker = !!entry.shift_marker;
  const shouldFlip = hasShiftMarker;
  
  // Use override name ONLY after animation completes (not during animation)
  // When animating, use the stored old name so animation can play properly
  const displayAssignedName = animateNameChange 
    ? (animationOldNameRef.current || entry.assigned_name) 
    : (overrideNameRef.current || entry.assigned_name);
  const displayName = displayNickname || formatDisplayNameForUI(displayAssignedName);
  
  // Gesture controls (dual long-press):
  // - First long press (1.5s): Opens shift marker modal
  // - Second long press (2.5s): Opens staff selection modal (name change)
  // - Counter resets after 3 seconds of inactivity

  // Prevent body scroll when auth modal is open
  React.useEffect(() => {
    if (showAuthModal) {
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
  }, [showAuthModal]);

  // SplitText animation effect for name change
  useEffect(() => {
    // Skip if we've already animated this change
    if (hasAnimatedRef.current) {
      return;
    }
    
    if (animateNameChange && nameDisplayRef.current && oldName && newName) {
      // Mark as animated to prevent re-running
      hasAnimatedRef.current = true;
      
      SplitText.register(gsap);
      
      const element = nameDisplayRef.current;
      
      // Create SplitText instance
      const split = new SplitText(element, {
        type: 'chars',
        wordsClass: 'split-word',
        charsClass: 'split-char'
      });
      
      // Set initial state - show old name
      element.textContent = oldName;
      
      gsap.set(split.chars, {
        opacity: 1,
        x: 0,
        scale: 1,
        display: 'inline-block'
      });
      
      // Create animation timeline
      const tl = gsap.timeline({
        onComplete: () => {
          split.revert();
          
          // Set override name so component displays new name without parent state update
          overrideNameRef.current = pendingNewAssignedName;
          
          // Clear the old name ref
          animationOldNameRef.current = null;
          
          // Reset animation state
          setAnimateNameChange(false);
          setIsEditing(false);
          setOldName('');
          setNewName('');
          setPendingNewAssignedName('');
          
          // Force re-render to use override name
          setOverrideNameTrigger(prev => !prev);
          
          // Reset the animation flag
          setTimeout(() => {
            hasAnimatedRef.current = false;
          }, 100);
        }
      });
      
      // Animate old name out
      tl.to(split.chars, {
        opacity: 0,
        x: -30,
        scale: 0.8,
        duration: 0.3,
        stagger: 0.02,
        ease: 'power2.in'
      });
      
      // Update text to new name
      tl.call(() => {
        element.textContent = newName;
        
        // Create new SplitText for the new name
        const newSplit = new SplitText(element, {
          type: 'chars',
          wordsClass: 'split-word',
          charsClass: 'split-char'
        });
        
        gsap.set(newSplit.chars, {
          opacity: 0,
          x: 30,
          scale: 0.8,
          display: 'inline-block'
        });
        
        // Animate new name in
        tl.to(newSplit.chars, {
          opacity: 1,
          x: 0,
          scale: 1,
          duration: 0.4,
          stagger: 0.03,
          ease: 'back.out(1.7)'
        });
        
        // Cleanup will happen in onComplete
      });
      
      return () => {
        tl.kill();
        split.revert();
      };
    }
  }, [animateNameChange, oldName, newName]); // Removed entry.id and pendingNewAssignedName from dependencies

  // Listen for realtime name change animations from other users
  useEffect(() => {
    const handleRealtimeAnimation = (event: CustomEvent) => {
      const { entryId, oldName: eventOldName, newName: eventNewName } = event.detail;
      
      // Only animate if this is the entry being updated
      if (entryId === entry.id && eventOldName && eventNewName) {
        // CRITICAL: Reset the animation flag to allow realtime animation to play
        hasAnimatedRef.current = false;
        
        // Format names to strip ID before animation
        const formattedOldName = formatDisplayNameForUI(eventOldName);
        const formattedNewName = formatDisplayNameForUI(eventNewName);
        
        // CRITICAL: Set refs to match the editing user's flow
        // This prevents double animation when entry.assigned_name updates
        animationOldNameRef.current = formattedOldName;
        setPendingNewAssignedName(eventNewName); // Store raw name for override ref
        
        setOldName(formattedOldName);
        setNewName(formattedNewName);
        setAnimateNameChange(true);
      }
    };
    
    window.addEventListener('rosterNameChangeAnimation', handleRealtimeAnimation as EventListener);
    return () => window.removeEventListener('rosterNameChangeAnimation', handleRealtimeAnimation as EventListener);
  }, [entry.id]);

  // Check if entry has been edited (name changed)
  const hasBeenEdited = (entry: RosterEntry) => {
    return entry.change_description && 
           entry.change_description.includes('Name changed from') &&
           entry.last_edited_by;
  };

  // Check if entry has been reverted to original
  const hasBeenReverted = (entry: RosterEntry) => {
    if (!entry.change_description) return false;
    
    // Check if we have original PDF assignment stored
    const originalPdfMatch = entry.change_description.match(/\(Original PDF: ([^)]+)\)/);
    if (originalPdfMatch) {
      let originalPdfAssignment = originalPdfMatch[1].trim();
      
      // Fix missing closing parenthesis if it exists
      if (originalPdfAssignment.includes('(R') && !originalPdfAssignment.includes('(R)')) {
        originalPdfAssignment = originalPdfAssignment.replace('(R', '(R)');
      }
      
      // Check if current assignment matches original PDF assignment (reverted to original)
      return entry.assigned_name === originalPdfAssignment;
    }
    
    return false;
  };

  // Get text color based on edit status
  const getTextColor = () => {
    // HIGHEST PRIORITY: Admin-set text color
    if (entry.text_color) {
      return entry.text_color;
    }
    
    if (hasBeenReverted(entry)) {
      return '#059669'; // Green for reverted entries (back to original PDF)
    } else if (hasBeenEdited(entry)) {
      return '#dc2626'; // Red for edited entries
    } else {
      return '#000000'; // Black for original entries
    }
  };

  const longPressHandlers = useLongPress({
    onLongPress: () => {
      setShowAuthModal(true);
    },
    onDoublePress: () => {
      if (hasBeenEdited(entry) && onShowDetails) {
        onShowDetails(entry);
      }
    },
    delay: 2500
  });

  // Handle double-click for desktop (opens edit details modal)
  const handleDoubleClick = () => {
    if (!hasBeenEdited(entry)) {
      return;
    }
    
    if (!onShowDetails) {
      return;
    }
    
    onShowDetails(entry);
  };

  // Long-press handler with ripple animation:
  // - Hold for 1.5s → RED Ripple animation appears under finger
  // - Release between 1.5s-2.5s → Opens staff selection modal
  // - Continue holding past 2.5s → GREEN ripple appears, opens shift marker modal on release
  // - If still holding at 4s → Reset everything (no second green ripple)
  let longPressInterval: NodeJS.Timeout | null = null;
  
  const handleLongPressStart = (e: React.TouchEvent | React.MouseEvent) => {
    // Prevent default to avoid conflicts with normal clicking
    e.preventDefault();
    e.stopPropagation();
    
    setLongPressStage('idle');
    setShowRipple(false);
    
    // Get touch/click position
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setRipplePosition({ x: clientX, y: clientY });
    
    // Clear any existing timer
    if (longPressTimer) {
      clearTimeout(longPressTimer);
    }
    
    // Start the long press timer
    const timer = setTimeout(() => {
      setShowRipple(true);
      setLongPressStage('stage1');
      
      // Stage 2: 2.5s - Toggle ripple to GREEN
      longPressInterval = setTimeout(() => {
        // Set stage IMMEDIATELY so release detection is accurate
        setLongPressStage('stage2');
        
        // Then update visual with brief toggle
        setShowRipple(false);
        setTimeout(() => {
          setShowRipple(true);
        }, 50); // Brief 50ms delay for visual toggle
        
        // Stage 3: 4s - Reset if still holding (no second green ripple)
        const resetTimer = setTimeout(() => {
          setShowRipple(false);
          setLongPressStage('idle');
        }, 1500); // 1.5 seconds after stage 2 (total 4s)
        
        // Update the interval reference to the reset timer
        longPressInterval = resetTimer;
      }, 1000); // 1 second after stage 1 (total 2.5s)
      
    }, 1500); // 1.5 seconds
    
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    
    // Clear all timers immediately
    if (longPressInterval) {
      clearTimeout(longPressInterval);
      longPressInterval = null;
    }
    if (longPressTimer) {
      clearTimeout(longPressTimer);
    }
    
    // Determine action based on stage
    if (longPressStage === 'stage1') {
      // Released between 1.5s-2.5s → Open staff selection modal
      setShowAuthModal(true);
      // Stop and reset - user committed to action
      setShowRipple(false);
      setLongPressStage('idle');
    } else if (longPressStage === 'stage2') {
      // Released after 2.5s → Open shift marker modal, then reset
      setShowShiftMarkerModal(true);
      setShowRipple(false);
      setLongPressStage('idle');
    } else {
      // Released before 1.5s → Just reset (no animation should be visible)
      setShowRipple(false);
      setLongPressStage('idle');
    }
  };

  const handleAuthSubmit = async () => {
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
    
    // Wait a bit to ensure staff data is loaded
    setTimeout(() => {
      setShowAuthModal(false);
      setShowStaffModal(true);
      setAuthError('');
    }, 100);
  };

  const handleStaffSelect = async (newStaffName: string) => {
    await handleStaffSelectWithColor(newStaffName);
  };

  const handleStaffSelectWithColor = async (newStaffName: string, textColor?: string) => {
    // Use override name if available for comparison
    const currentAssignedName = overrideNameRef.current || entry.assigned_name;
    
    if (newStaffName === currentAssignedName) {
      // For ADMIN: Allow color-only changes even if name is the same
      if (textColor && textColor !== getTextColor()) {
        // Continue with the update for color change
      } else {
        setShowStaffModal(false);
        return;
      }
    }

    if (newStaffName === currentAssignedName && !textColor) {
      setShowStaffModal(false);
      return;
    }

    setIsUpdating(true);
    setIsEditing(true);
    try {
      // Get the currently logged-in user from session
      const session = await getUserSession();
      
      if (!session) {
        setAuthError('No active session found. Please log in first.');
        return;
      }
      
      const editorResult = await validatePasscode(authCode);
      
      if (!editorResult || !editorResult.isValid) return;
      
      // CRITICAL: Verify the passcode belongs to the logged-in user by comparing ID NUMBERS
      // With duplicate passcodes, validatePasscode returns the FIRST match from DB
      // So we need to check if the logged-in user's ID matches any user with this passcode
      const { data: userData } = await supabase
        .from('staff_users')
        .select('id_number, surname, name')
        .eq('passcode', authCode)
        .eq('id', session.userId);
      
      if (!userData || userData.length === 0) {
        setAuthError('Invalid passcode');
        return;
      }
      
      // MASTER ADMIN CHECK: 5274 can edit for everyone
      const isMasterAdmin = session.idNumber === '5274';
      
      // Note: All authenticated users can now edit any roster entry
      // The security check has been removed to allow collaborative editing

      // Use the LOGGED-IN USER's name as the editor (based on session ID)
      const editorName = `${session.surname}, ${session.name}`;

      // Preserve center information from original change_description if present
      const hasCenterInfo = entry.change_description && (entry.change_description.includes('- Center:') || entry.change_description.includes('Center Added:'));
      let centerInfo = '';
      
      if (hasCenterInfo && entry.change_description) {
        // Extract center name from either format
        const centerMatch = entry.change_description.match(/(?:- Center:|Center Added:)\s*([^;|]+)/);
        if (centerMatch && centerMatch[1]) {
          centerInfo = centerMatch[1].trim();
        }
      }
      
      // Register this edit BEFORE database update to block realtime immediately
      // Pass the updated data so it applies immediately to local state (including color changes)
      if (registerRecentEdit) {
        registerRecentEdit(entry.id, {
          assigned_name: newStaffName,
          text_color: textColor,
          change_description: centerInfo 
            ? `Name changed from "${entry.assigned_name}" to "${newStaffName}" | [${(() => {
                const now = new Date();
                const day = now.getDate().toString().padStart(2, '0');
                const month = (now.getMonth() + 1).toString().padStart(2, '0');
                const year = now.getFullYear();
                const hour = now.getHours().toString().padStart(2, '0');
                const minute = now.getMinutes().toString().padStart(2, '0');
                const second = now.getSeconds().toString().padStart(2, '0');
                return `${day}-${month}-${year} ${hour}:${minute}:${second}`;
              })()} USER, Admin: Center Added: ${centerInfo}`
            : `Name changed from "${entry.assigned_name}" to "${newStaffName}"`,
        }, false); // false = apply immediately, not later
      }

      const updatedEntry = await updateRosterEntry(entry.id, {
        date: entry.date,
        shiftType: entry.shift_type,
        assignedName: newStaffName,
        changeDescription: centerInfo 
          ? `Name changed from "${entry.assigned_name}" to "${newStaffName}" | [${(() => {
              const now = new Date();
              const day = now.getDate().toString().padStart(2, '0');
              const month = (now.getMonth() + 1).toString().padStart(2, '0');
              const year = now.getFullYear();
              const hour = now.getHours().toString().padStart(2, '0');
              const minute = now.getMinutes().toString().padStart(2, '0');
              const second = now.getSeconds().toString().padStart(2, '0');
              return `${day}-${month}-${year} ${hour}:${minute}:${second}`;
            })()} USER, Admin: Center Added: ${centerInfo}`
          : `Name changed from "${entry.assigned_name}" to "${newStaffName}"`,
        textColor: textColor
      }, editorName);

      // Reset the animation flag to allow new animation
      hasAnimatedRef.current = false;
      
      // Store the old name for display during animation
      // IMPORTANT: Use overrideNameRef if it exists (from previous animation), otherwise use entry.assigned_name
      // This handles the case where parent state has already been updated but we need the previously displayed name
      const oldNameToAnimate = overrideNameRef.current || entry.assigned_name;
      animationOldNameRef.current = oldNameToAnimate;
      
      // Store the new assigned_name to apply after animation completes
      setPendingNewAssignedName(newStaffName);
      
      // Trigger SplitText animation ONLY after successful Supabase update
      setOldName(formatDisplayNameForUI(oldNameToAnimate));
      setNewName(formatDisplayNameForUI(newStaffName));
      setAnimateNameChange(true);
      
      if (onUpdate) {
        await onUpdate(updatedEntry);
      }

      // Close modal immediately after triggering animation
      setShowStaffModal(false);
      setAuthCode('');

    } catch (error) {
      setErrorMessage('Failed to update entry. Please try again.');
      // Stop animation on error too
      setIsEditing(false);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelAuth = () => {
    setShowAuthModal(false);
    setAuthCode('');
    setAuthError('');
    // Reset all long-press states
    setShowRipple(false);
    setLongPressStage('idle');
    if (longPressTimer) {
      clearTimeout(longPressTimer);
    }
    if (longPressInterval) {
      clearTimeout(longPressInterval);
      longPressInterval = null;
    }
  };

  const handleCancelStaffSelection = () => {
    setShowStaffModal(false);
    setAuthCode('');
    // Reset all long-press states
    setShowRipple(false);
    setLongPressStage('idle');
    if (longPressTimer) {
      clearTimeout(longPressTimer);
    }
    if (longPressInterval) {
      clearTimeout(longPressInterval);
      longPressInterval = null;
    }
  };

  const handleMarkerSelect = async (marker: 'Early' | 'Late' | 'First' | 'Second' | 'AM' | 'FULL' | null, passcode: string) => {
    // Get session to verify user
    const session = await getUserSession();
    
    if (!session) {
      throw new Error('No active session found');
    }
    
    // MASTER ADMIN CHECK: 5274 can add markers for everyone
    const isMasterAdmin = session.idNumber === '5274';
    
    // Validate passcode belongs to logged-in user
    const passcodeResult = await validatePasscode(passcode);
    
    if (!passcodeResult || !passcodeResult.isValid) {
      throw new Error('Invalid passcode');
    }
    
    // Verify passcode belongs to logged-in user
    const { data: userData } = await supabase
      .from('staff_users')
      .select('id_number')
      .eq('passcode', passcode)
      .eq('id', session.userId);
    
    if (!userData || userData.length === 0) {
      throw new Error('Passcode does not belong to logged-in user');
    }
    
    // Note: All authenticated users can now add shift markers for any entry
    // The security check has been removed to allow collaborative editing

    // Format timestamp without comma and without seconds
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');
    const formattedTimestamp = `${day}-${month}-${year} ${hour}:${minute}`;
    
    // Create log entry
    const editorName = `${session.surname}, ${session.name}`;
    const logEntry = marker === null
      ? `[${formattedTimestamp}] ${editorName}: Removed "${entry.shift_marker}" as marker for his shift`
      : `[${formattedTimestamp}] ${editorName}: Added "${marker}" as marker for his shift (Night Duty)`;
    
    // Append to existing change_description or create new one
    const newChangeDescription = entry.change_description 
      ? `${entry.change_description} | ${logEntry}`
      : logEntry;
    
    // Create the updated entry object for immediate local state update
    const updatedEntry = {
      ...entry,
      shift_marker: marker || undefined,
      change_description: newChangeDescription,
      last_edited_by: editorName,
      last_edited_at: formattedTimestamp
    };
    
    // CRITICAL: Register this edit AND update local state immediately to avoid needing refresh
    if (registerRecentEdit) {
      // Pass the updated data so it applies immediately (applyUpdateLater = false)
      registerRecentEdit(entry.id, updatedEntry, false);
    }
    
    // Update roster entry with shift_marker field (null clears it)
    const { error } = await supabase
      .from('roster_entries')
      .update({
        shift_marker: marker, // null will clear it
        change_description: newChangeDescription,
        last_edited_by: editorName,
        last_edited_at: formattedTimestamp
      })
      .eq('id', entry.id);
    
    if (error) {
      throw new Error('Failed to update shift marker');
    }
    
    // Notify parent to refresh
    if (onUpdate) {
      onUpdate({
        ...entry,
        shift_marker: marker || undefined,
        change_description: newChangeDescription,
        last_edited_by: editorName,
        last_edited_at: formattedTimestamp
      });
    }
  };

  // Check if (asterisk width + name width) exceeds container width
  useEffect(() => {
    if (!hasCenterRemark || !asteriskRef.current || !nameContainerRef.current) {
      setShouldApplyOffset(false);
      setOffsetWidth(0);
      return;
    }
    
    // Measure widths after render
    const checkWidths = () => {
      const asteriskWidth = asteriskRef.current?.offsetWidth || 0;
      const nameWidth = nameContainerRef.current?.scrollWidth || 0;
      const nameContainerWidth = nameContainerRef.current?.offsetWidth || 0;
      
      // The key insight: In flexbox, nameContainer gets reduced space due to asterisk
      // We need to pass asterisk width as offset so ScrollingText knows visual space is reduced
      // Only apply offset if text actually overflows the name container
      const textOverflows = nameWidth > nameContainerWidth;
      
      setShouldApplyOffset(textOverflows);
      // Always pass asterisk width when there's an asterisk and text overflows
      if (textOverflows) {
        setOffsetWidth(asteriskWidth);
      } else {
        setOffsetWidth(0);
      }
    };
    
    // Check immediately and on resize
    const timeoutId = setTimeout(checkWidths, 50); // Small delay to ensure render
    window.addEventListener('resize', checkWidths);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', checkWidths);
    };
  }, [hasCenterRemark, displayName]);

  return (
    <>
      <div
        onMouseDown={handleLongPressStart}
        onMouseUp={handleLongPressEnd}
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
        style={{
          padding: '0px 2px',
          margin: 0,
          textAlign: 'center',
          fontSize: window.innerWidth > window.innerHeight ? '10px' : '12px',
          fontWeight: '500',
          color: getTextColor(),
          cursor: 'pointer',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
          outline: 'none',
          background: 'transparent',
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '32px',
          position: 'relative',
          zIndex: 60,
          // Add pulsing animation only for special dates with actual info
         animation: isEditing ? 'goldenPulse 1.2s ease-in-out infinite' :
                   (isSpecialDate && specialDateInfo && specialDateInfo.trim()) ? 'pulse 2s ease-in-out infinite' : 'none',
         transform: isEditing ? 'scale(1.05)' : 'scale(1)',
         transformOrigin: 'center center',
         transition: 'all 0.4s ease-out',
         boxShadow: isEditing ? '0 0 20px rgba(255, 215, 0, 0.8), 0 0 40px rgba(255, 215, 0, 0.4), inset 0 0 10px rgba(255, 215, 0, 0.2)' : 'none',
         backgroundColor: isEditing ? 'rgba(255, 215, 0, 0.15)' : 'transparent',
         borderRadius: isEditing ? '6px' : '0',
         border: isEditing ? '2px solid #ffd700' : 'none'
        }}
      >
        {/* Ripple animation - RED at stage 1 (staff selection), GREEN at stage 2 (marker modal) */}
        {showRipple ? createPortal(
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              pointerEvents: 'none',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div 
              style={{
                position: 'absolute',
                left: ripplePosition.x,
                top: ripplePosition.y,
                transform: 'translate(-50%, -50%)',
                width: '300vmax',
                height: '300vmax',
                borderRadius: '50%',
                border: longPressStage === 'stage1' ? '8px solid rgba(239, 68, 68, 1)' : '8px solid rgba(34, 197, 94, 1)',
                backgroundColor: longPressStage === 'stage1' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                animation: 'ripple-expand-large 1.5s ease-out infinite',
              }}
            />
            <style>{`
              @keyframes ripple-expand-large {
                0% { 
                  transform: translate(-50%, -50%) scale(0);
                  opacity: 1;
                }
                100% { 
                  transform: translate(-50%, -50%) scale(1);
                  opacity: 0;
                }
              }
            `}</style>
          </div>,
          document.body
        ) : null}

        <div 
          className="flex justify-center w-full min-w-0"
          onDoubleClick={handleDoubleClick}
        >
          <div className="flex items-start gap-0.5 max-w-full min-w-0">
            {hasCenterRemark && (
              <span 
                ref={asteriskRef}
                className="text-red-600 font-bold flex-shrink-0"
                style={{ fontSize: window.innerWidth > window.innerHeight ? '14px' : '16px', lineHeight: 1, marginTop: '3px' }}
              >
                {displayMarker}
              </span>
            )}
            <div ref={nameContainerRef} className="relative flex-1 min-w-0" style={{ minHeight: '20px' }}>
              {animateNameChange ? (
                <div
                  ref={nameDisplayRef}
                  style={{
                    color: getTextColor(),
                    fontWeight: '500',
                    fontSize: window.innerWidth > window.innerHeight ? '10px' : '12px',
                    textAlign: 'center',
                    width: '100%',
                    maxWidth: '100%',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                />
              ) : shouldFlip ? (
                <FlipCard
                  frontContent={
                    <ScrollingText 
                      text={displayName}
                      className="text-left"
                      pauseDuration={0.5}
                      scrollDuration={3.5}
                      leftOffset={offsetWidth}
                      style={{}}
                    />
                  }
                  backContent={
                    <span style={{ fontSize: window.innerWidth > window.innerHeight ? '10px' : '12px', fontWeight: '500', lineHeight: 1, color: getTextColor(), whiteSpace: 'nowrap' }}>
                      ({entry.shift_marker?.toUpperCase()})
                    </span>
                  }
                  shouldFlip={true}
                  flipDuration={0.6}
                  flipDelay={2}
                  className="w-full"
                />
              ) : (
                <ScrollingText 
                  text={displayName}
                  className="text-left"
                  pauseDuration={0.5}
                  scrollDuration={3.5}
                  leftOffset={offsetWidth}
                  style={{}}
                />
              )}
            </div>
          </div>
        </div>
        
        {/* Center name tooltip on hover */}
        {hasCenterRemark && centerRemark && (
          <div 
            className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-70"
            style={{
              maxWidth: '200px'
            }}
          >
            {centerRemark}
          </div>
        )}
        
        {/* Golden sparkle effects */}
        {isEditing && (
          <>
            <div
              style={{
                position: 'absolute',
                top: '2px',
                left: '2px',
                width: '4px',
                height: '4px',
                backgroundColor: '#ffd700',
                borderRadius: '50%',
                animation: 'sparkle1 2s ease-in-out infinite',
                zIndex: 65
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: '2px',
                right: '8px',
                width: '3px',
                height: '3px',
                backgroundColor: '#ffed4e',
                borderRadius: '50%',
                animation: 'sparkle2 2.5s ease-in-out infinite',
                zIndex: 65
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '1px',
                width: '2px',
                height: '2px',
                backgroundColor: '#fbbf24',
                borderRadius: '50%',
                animation: 'sparkle3 1.8s ease-in-out infinite',
                zIndex: 65
              }}
            />
          </>
        )}
      </div>
      
      {/* Add CSS animations */}
      <style>{`
        @keyframes goldenPulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1.05);
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.8), 0 0 40px rgba(255, 215, 0, 0.4);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.1);
            box-shadow: 0 0 30px rgba(255, 215, 0, 1), 0 0 60px rgba(255, 215, 0, 0.6);
          }
        }
        
        @keyframes goldenDot {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
            box-shadow: 0 0 8px rgba(255, 215, 0, 0.8);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.3);
            box-shadow: 0 0 15px rgba(255, 215, 0, 1);
          }
        }
        
        @keyframes sparkle1 {
          0%, 100% {
            opacity: 0;
            transform: scale(0) rotate(0deg);
          }
          25% {
            opacity: 1;
            transform: scale(1) rotate(90deg);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.2) rotate(180deg);
          }
          75% {
            opacity: 0.6;
            transform: scale(0.8) rotate(270deg);
          }
        }
        
        @keyframes sparkle2 {
          0%, 100% {
            opacity: 0;
            transform: scale(0);
          }
          30% {
            opacity: 1;
            transform: scale(1.5);
          }
          60% {
            opacity: 0.7;
            transform: scale(1);
          }
        }
        
        @keyframes sparkle3 {
          0%, 100% {
            opacity: 0;
            transform: scale(0) translateY(0);
          }
          40% {
            opacity: 1;
            transform: scale(1.8) translateY(-2px);
          }
          80% {
            opacity: 0.5;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>

      {/* Authentication Modal */}
      {showAuthModal && createPortal(
        <div 
          className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center p-4"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999999999,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            pointerEvents: 'auto'
          }}
          onWheel={(e) => e.preventDefault()}
          onScroll={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.target === e.currentTarget) {
              handleCancelAuth();
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6">
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
                            const completeCode = newCode.join('');
                            setAuthCode(completeCode);
                            
                            // Clear error when user is editing (backspacing)
                            if (authError && newValue === '') {
                              setAuthError('');
                            }
                            
                            // Auto-focus next input
                            if (newValue && index < 3) {
                              const nextInput = document.querySelector(`input[data-index="${index + 1}"]`) as HTMLInputElement;
                              if (nextInput) nextInput.focus();
                            }
                            
                            // Auto-submit when 4th digit is entered
                            if (completeCode.length === 4) {
                              setTimeout(() => {
                                const confirmButton = document.querySelector('button[data-auth-confirm]') as HTMLButtonElement;
                                if (confirmButton) {
                                  confirmButton.click();
                                  // Blur all inputs to dismiss keyboard
                                  document.querySelectorAll('input[data-index]').forEach(input => {
                                    (input as HTMLInputElement).blur();
                                  });
                                }
                              }, 100);
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
                        // Add numerical keyboard support
                        inputMode="numeric"
                        pattern="[0-9]*"
                        onInput={(e) => {
                          // Ensure only numbers are entered
                          const target = e.target as HTMLInputElement;
                          target.value = target.value.replace(/[^0-9]/g, '');
                        }}
                      />
                    ))}
                  </div>
                  {authCode.length === 4 && (
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
                  )}
                </div>
              </div>
              
              {/* Only show error when all 4 digits are entered */}
              {authError && authCode.length === 4 && (
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
                  data-auth-confirm
                  onClick={handleAuthSubmit}
                  disabled={authCode.length < 4}
                  className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors duration-200"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Staff Selection Modal */}
      <StaffSelectionModal
        isOpen={showStaffModal}
        entry={overrideNameRef.current ? { ...entry, assigned_name: overrideNameRef.current } : entry}
        availableStaff={staffNames}
        allEntriesForShift={allEntriesForShift}
        onSelectStaff={handleStaffSelect}
        onSelectStaffWithColor={handleStaffSelectWithColor}
        onClose={handleCancelStaffSelection}
        authCode={authCode}
      />

      {/* Shift Marker Modal */}
      <ShiftMarkerModal
        isOpen={showShiftMarkerModal}
        onClose={() => setShowShiftMarkerModal(false)}
        onSelectMarker={handleMarkerSelect}
        currentMarker={entry.shift_marker as 'EARLY' | 'LATE' | 'FIRST' | 'SECOND' | 'FULL' | undefined}
      />

      {/* Error Confirmation Modal */}
      <ConfirmationModal
        isOpen={errorMessage !== null}
        title="Error"
        message={errorMessage || ''}
        onConfirm={() => setErrorMessage(null)}
        onCancel={() => setErrorMessage(null)}
        confirmText="OK"
        cancelText=""
        isDanger={true}
      />
    </>
  );
};