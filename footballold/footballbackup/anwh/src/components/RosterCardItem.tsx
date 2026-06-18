import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff } from 'lucide-react';
import { RosterEntry } from '../types/roster';
import { StaffSelectionModal } from './StaffSelectionModal';
import { validatePasscode } from '../utils/passcodeAuth';
import { updateRosterEntry } from '../utils/rosterApi';
import { useLongPress } from '../hooks/useLongPress';
import { ScrollingText } from './ScrollingText';
import FlipCard from './FlipCard';
import { formatDisplayNameForUI } from '../utils/rosterDisplayName';
import { getUserSession } from '../utils/indexedDB';
import { supabase } from '../lib/supabase';
import { gsap } from 'gsap';
import SplitText from '../utils/SplitText';

// Get all staff names including (R) variants - using authCodes for now
const getAllStaffNames = (): string[] => {
  // This will be updated later to fetch from database
  return [];
};

interface RosterCardItemProps {
  entry: RosterEntry;
  onUpdate?: (updatedEntry: RosterEntry) => void;
  onShowDetails?: (entry: RosterEntry) => void;
  allEntriesForShift?: RosterEntry[];
  isSpecialDate?: boolean;
  specialDateInfo?: string;
  availableStaff?: string[]; // Add this prop
  registerRecentEdit?: (entryId: string, updatedData?: Partial<RosterEntry>, applyUpdateLater?: boolean) => void;
  applyPendingUpdate?: (entryId: string, updatedData: Partial<RosterEntry>) => void;
}

export const RosterCardItem: React.FC<RosterCardItemProps> = ({
  entry,
  onUpdate,
  onShowDetails,
  allEntriesForShift = [],
  isSpecialDate = false,
  specialDateInfo,
  availableStaff: propAvailableStaff, // Accept staff from parent
  registerRecentEdit,
  applyPendingUpdate
}) => {
  // Use staff from props if provided, otherwise fetch internally (fallback)
  const [localStaffNames] = useState<string[]>([]);
  const staffNames = propAvailableStaff && propAvailableStaff.length > 0 ? propAvailableStaff : localStaffNames;
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
  }, [animateNameChange, oldName, newName]);

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
  
  // Use override name ONLY after animation completes (not during animation)
  // When animating, use the stored old name so animation can play properly
  const displayAssignedName = animateNameChange 
    ? (animationOldNameRef.current || entry.assigned_name) 
    : (overrideNameRef.current || entry.assigned_name);
  
  // Check if entry has center assignment from change_description
  // Only show if the LAST action was adding a marker (not removing) - MATCHES RosterEntryCell logic
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
  
  // Extract the actual marker (*, **, ***) from change_description ONLY
  // Per spec: center affiliation must be detected exclusively from change_description field
  const logEntriesForMarker = entry.change_description?.split('|').map(e => e.trim()) || [];
  let displayMarker = '*'; // Default to *
  let markerFromDescription = false;
  
  // Find the last marker entry by processing from end to beginning
  for (let i = logEntriesForMarker.length - 1; i >= 0; i--) {
    const markerMatch = logEntriesForMarker[i].match(/- Marker:\s*(\*+)/);
    if (markerMatch) {
      displayMarker = markerMatch[1];
      markerFromDescription = true;
      break; // Found the last marker, stop searching
    }
  }
  
  // Determine if we should show the marker badge
  // Match table view logic: show if hasCenterRemark is true
  const shouldShowMarker = hasCenterRemark;

  const longPressHandlers = useLongPress({
    onLongPress: () => {
      setShowAuthModal(true);
    },
    onDoublePress: () => {
      if (hasBeenEdited(entry) && onShowDetails && entry.last_edited_by !== 'ADMIN') {
        onShowDetails(entry);
      }
    },
    delay: 2500
  });

  const handleAuthSubmit = async () => {
    const result = await validatePasscode(authCode);
    if (!result || !result.isValid) {
      setAuthError('Invalid passcode');
      return;
    }
    
    setShowAuthModal(false);
    setShowStaffModal(true);
    setAuthError('');
  };

  const handleStaffSelect = async (newStaffName: string) => {
    await handleStaffSelectWithColor(newStaffName);
  };

  const handleStaffSelectWithColor = async (newStaffName: string, textColor?: string) => {
    // Use override name if available for comparison
    const currentAssignedName = overrideNameRef.current || entry.assigned_name;
    
    if (newStaffName === currentAssignedName) {
      setShowStaffModal(false);
      return;
    }

    setIsUpdating(true);
    setIsEditing(true);
    try {
      // Get the currently logged-in user from session
      const session = await getUserSession();
      
      if (!session) {
        return;
      }
      
      const editorResult = await validatePasscode(authCode);
      if (!editorResult || !editorResult.isValid) return;
      
      // CRITICAL: Verify the passcode belongs to the logged-in user by comparing ID NUMBERS
      // With duplicate passcodes, validatePasscode returns the FIRST match from DB
      // So we need to check if the logged-in user's ID matches any user with this passcode
      const { data: userData } = await supabase
        .from('staff_users')
        .select('id_number')
        .eq('passcode', authCode)
        .eq('id', session.userId);
      
      if (!userData || userData.length === 0) {
        return;
      }
      
      // Use the LOGGED-IN USER's name as the editor (based on session ID)
      const editorName = `${session.surname}, ${session.name}`;

      // Register this edit BEFORE database update to block realtime immediately
      // Pass the updated data so it applies immediately to local state (including color changes)
      if (registerRecentEdit) {
        registerRecentEdit(entry.id, {
          assigned_name: newStaffName,
          text_color: textColor,
          change_description: `Name changed from "${entry.assigned_name}" to "${newStaffName}"`,
        }, false); // false = apply immediately, not later
      }

      const updatedEntry = await updateRosterEntry(entry.id, {
        date: entry.date,
        shiftType: entry.shift_type,
        assignedName: newStaffName,
        changeDescription: `Name changed from "${entry.assigned_name}" to "${newStaffName}"`,
        textColor: textColor
      }, editorName);

      // Reset the animation flag to allow new animation
      hasAnimatedRef.current = false;
      
      // Store the old name for display during animation
      // IMPORTANT: Use overrideNameRef if it exists (from previous animation), otherwise use entry.assigned_name
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
      alert('Failed to update entry. Please try again.');
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
  };

  const handleCancelStaffSelection = () => {
    setShowStaffModal(false);
    setAuthCode('');
  };

  return (
    <>
      <div
        {...longPressHandlers}
        style={{
          padding: '4px 2px',
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
         transition: 'all 0.4s ease-out',
         boxShadow: isEditing ? '0 0 20px rgba(255, 215, 0, 0.8), 0 0 40px rgba(255, 215, 0, 0.4), inset 0 0 10px rgba(255, 215, 0, 0.2)' : 'none',
         backgroundColor: isEditing ? 'rgba(255, 215, 0, 0.15)' : 'transparent',
         borderRadius: isEditing ? '6px' : '0',
         border: isEditing ? '2px solid #ffd700' : 'none'
        }}
      >
        <div className="flex items-center gap-0.5 max-w-full min-w-0">
          {/* Show marker (*) if it exists - from center assignment OR from name prefix */}
          {shouldShowMarker && (
            <span 
              className="text-red-600 font-bold flex-shrink-0"
              style={{ fontSize: window.innerWidth > window.innerHeight ? '14px' : '16px', lineHeight: 1, marginTop: '3px' }}
            >
              {displayMarker}
            </span>
          )}
          <div
            className="relative flex-1 min-w-0"
          >
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
            ) : entry.shift_marker ? (
              <FlipCard
                frontContent={
                  <ScrollingText 
                    text={formatDisplayNameForUI(displayAssignedName)}
                    className="text-center w-full"
                    pauseDuration={0.5}
                    scrollDuration={3.5}
                    style={{
                      color: getTextColor(),
                      fontWeight: '500',
                      fontSize: window.innerWidth > window.innerHeight ? '10px' : '12px',
                      textAlign: 'center',
                      width: '100%',
                      maxWidth: '100%',
                      border: 'none',
                      outline: 'none',
                      filter: isEditing ? 'brightness(1.2) contrast(1.1)' : 'none',
                      textShadow: isEditing ? '0 0 8px rgba(255, 215, 0, 0.6)' : 'none',
                      textDecoration: 'none'
                    }}
                  />
                }
                backContent={
                  <span style={{ fontSize: window.innerWidth > window.innerHeight ? '9px' : '11px', fontWeight: '500', lineHeight: 1, color: getTextColor(), whiteSpace: 'nowrap' }}>
                    ({entry.shift_marker.toUpperCase()})
                  </span>
                }
                shouldFlip={true}
                flipDuration={0.6}
                flipDelay={1.5}
                className="w-full"
              />
            ) : (
              <ScrollingText 
                text={formatDisplayNameForUI(displayAssignedName)}
                className="text-center w-full"
                pauseDuration={0.5}
                scrollDuration={3.5}
                style={{
                  color: getTextColor(),
                  fontWeight: '500',
                  fontSize: window.innerWidth > window.innerHeight ? '10px' : '12px',
                  textAlign: 'center',
                  width: '100%',
                  maxWidth: '100%',
                  border: 'none',
                  outline: 'none',
                  filter: isEditing ? 'brightness(1.2) contrast(1.1)' : 'none',
                  textShadow: isEditing ? '0 0 8px rgba(255, 215, 0, 0.6)' : 'none',
                  textDecoration: 'none'
                }}
              />
            )}
          </div>
        </div>
        
        {/* Golden sparkle effects */}

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
    </>
  );
};