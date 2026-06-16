import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Calculator, Edit3, TrendingUp, Trash2, AlertTriangle, X } from 'lucide-react';
import { Download } from 'lucide-react';
import { gsap } from 'gsap';
import { SHIFTS } from '../constants';
import { DaySchedule, SpecialDates, DateNotes } from '../types';
import { ClearDateModal } from './ClearDateModal';
import { ClearMonthModal } from './ClearMonthModal';
import { MonthClearModal } from './MonthClearModal';
import { CalendarExportModal } from './CalendarExportModal';
import { ScrollingText } from './ScrollingText';
import { formatMauritianRupees } from '../utils/currency';
import { useLongPress } from '../hooks/useLongPress';
import { validatePasscode } from '../utils/passcodeAuth';
import { fetchRosterEntries } from '../utils/rosterApi';
import { syncRosterToCalendar } from '../utils/rosterCalendarSync';

interface CalendarProps {
  currentDate: Date;
  schedule: DaySchedule;
  specialDates: SpecialDates;
  dateNotes?: DateNotes;
  specialDateTexts?: Record<string, string>; // Actual special date text from roster
  onDateClick: (day: number) => void;
  onNavigateMonth: (direction: 'prev' | 'next') => void;
  totalAmount: number;
  monthToDateAmount: number;
  onDateChange: (date: Date) => void;
  scheduleTitle: string;
  onTitleUpdate: (title: string) => void;
  onResetMonth?: (year: number, month: number) => void;
  setSchedule: React.Dispatch<React.SetStateAction<DaySchedule>>;
  setSpecialDates: React.Dispatch<React.SetStateAction<SpecialDates>>;
  setDateNotes?: React.Dispatch<React.SetStateAction<DateNotes>>;
  monthlySalary?: number;
  onMonthlySalaryChange?: (year: number, month: number, salary: number) => void;
  globalSalary?: number;
}

export const Calendar: React.FC<CalendarProps> = ({
  currentDate,
  schedule,
  specialDates,
  dateNotes = {},
  specialDateTexts = {},
  onDateClick,
  onNavigateMonth,
  totalAmount,
  monthToDateAmount,
  onDateChange,
  scheduleTitle,
  onTitleUpdate,
  setSchedule,
  setSpecialDates,
  setDateNotes = () => {},
  monthlySalary = 0,
  onMonthlySalaryChange,
  globalSalary = 0
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(scheduleTitle);
  const [showClearDateModal, setShowClearDateModal] = useState(false);
  const [showClearMonthModal, setShowClearMonthModal] = useState(false);
  const [showMonthClearModal, setShowMonthClearModal] = useState(false);
  const [showCalendarExportModal, setShowCalendarExportModal] = useState(false);
  const [dateToDelete, setDateToDelete] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [isLongPressActive, setIsLongPressActive] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importAuthCode, setImportAuthCode] = useState('');
  const [importAuthError, setImportAuthError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{added: number, skipped: number, errors: number} | null>(null);
  const [tempMonthlySalary, setTempMonthlySalary] = useState('');
  const calendarGridRef = useRef<HTMLDivElement>(null);
  const animatedElementsRef = useRef<Set<HTMLElement>>(new Set());
  
  const today = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  const firstDayWeekday = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  // Only apply global salary to current year ONLY (not past or future)
  // This prevents past years from changing when global salary is updated
  const isFutureYear = currentYear > today.getFullYear();
  const isPastYear = currentYear < today.getFullYear();
  const shouldUseGlobalSalary = monthlySalary === 0 && !isFutureYear && !isPastYear;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Auto-refresh effect for month-to-date calculation
  useEffect(() => {
    // Set up interval to refresh every minute
    const interval = setInterval(() => {
      // This will trigger a re-render by updating a dummy state or through other means
      // In this case, we'll just log that a refresh check happened
    }, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, []);

  // Prevent body scroll when date picker modal is open - EXACTLY LIKE OTHER MODALS
  useEffect(() => {
    if (showDatePicker || showImportModal) {
      // Disable body scroll
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = '0';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.bottom = '0';
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
  }, [showDatePicker, showImportModal]);

  // Enhanced TweenMax animations with smooth easing
  // NOTE: Only run on mount and when currentDate changes (month navigation)
  useEffect(() => {
    if (calendarGridRef.current) {
      // Clear previous animated elements
      animatedElementsRef.current.clear();
      
      // Get all day boxes and sort them by day number
      const dayBoxes = Array.from(calendarGridRef.current.querySelectorAll('.day-box'))
        .filter(box => box.getAttribute('data-day') !== null)
        .sort((a, b) => {
          const dayA = parseInt(a.getAttribute('data-day') || '0');
          const dayB = parseInt(b.getAttribute('data-day') || '0');
          return dayA - dayB;
        });
      
      if (dayBoxes.length === 0) {
          console.warn('⚠️ Calendar: No day boxes found, skipping animation');
        return;
      }
      
      // Set initial state with hardware acceleration
      gsap.set(dayBoxes, {
        opacity: 0,
        x: 30,  // Slide from right
        scale: 0.95,
        force3D: true,  // Force hardware acceleration
        transformOrigin: "center center"
      });

      // Set initial state for shift texts (avoid interfering with ScrollingText)
      const shiftTexts = calendarGridRef.current.querySelectorAll('.shift-text');
      if (shiftTexts.length > 0) {
        gsap.set(shiftTexts, {
          opacity: 0,
          x: 10,  // Slide from right
          scale: 0.9,
          force3D: true
        });
      }

      // Set initial state for special text (avoid interfering with ScrollingText)
      const specialTexts = calendarGridRef.current.querySelectorAll('.special-text');
      if (specialTexts.length > 0) {
        gsap.set(specialTexts, {
          opacity: 0,
          scale: 0.9,
          x: 15,  // Slide from right
          force3D: true
        });
      }

      // Create master timeline with smooth TweenMax-style easing
      const masterTl = gsap.timeline({
        defaults: {
          ease: "power2.out",  // Smooth TweenMax-style easing
          force3D: true
        }
      });

      // Animate boxes with staggered entrance
      dayBoxes.forEach((box) => {
        const dayNumber = parseInt(box.getAttribute('data-day') || '0');
        const shiftElements = box.querySelectorAll('.shift-text');
        const specialElements = box.querySelectorAll('.special-text');
        
        // Add to animated elements tracking
        animatedElementsRef.current.add(box as HTMLElement);
        
        // Smooth sequence timing
        const delay = (dayNumber - 1) * 0.04; // 40ms between each day
        
        // Animate the main box with smooth entrance
        masterTl.to(box, {
          opacity: 1,
          x: 0,  // Slide to final position
          scale: 1,
          duration: 0.6,
          delay: delay,
          ease: "back.out(1.2)" // Smooth bounce-back effect
        }, 0);

        // Animate shift texts (without interfering with ScrollingText)
        if (shiftElements.length > 0) {
          shiftElements.forEach(el => animatedElementsRef.current.add(el as HTMLElement));
          masterTl.to(shiftElements, {
            opacity: 1,
            x: 0,  // Slide to final position
            scale: 1,
            duration: 0.4,
            stagger: 0.06,
            ease: "power2.out"
          }, delay + 0.1);
        }

        // Animate special texts (without interfering with ScrollingText)
        if (specialElements.length > 0) {
          specialElements.forEach(el => animatedElementsRef.current.add(el as HTMLElement));
          masterTl.to(specialElements, {
            opacity: 1,
            x: 0,  // Slide to final position
            scale: 1,
            duration: 0.4,
            ease: "elastic.out(1, 0.5)" // Gentle elastic effect
          }, delay + 0.15);
        }
      });
      
      // Add hover animations for interactive elements
      const hoverHandlers = new Map<HTMLElement, { enter: () => void, leave: () => void, click: () => void }>();
      
      dayBoxes.forEach(box => {
        const dayElement = box as HTMLElement;
        
        // Hover enter animation
        const handleMouseEnter = () => {
          if (animatedElementsRef.current.has(dayElement)) {
            gsap.to(dayElement, {
              scale: 1.02,
              duration: 0.2,
              ease: "power2.out"
            });
          }
        };
        
        // Hover leave animation
        const handleMouseLeave = () => {
          if (animatedElementsRef.current.has(dayElement)) {
            gsap.to(dayElement, {
              scale: 1,
              duration: 0.2,
              ease: "power2.out"
            });
          }
        };
        
        // Click animation
        const handleClick = () => {
          if (animatedElementsRef.current.has(dayElement)) {
            gsap.to(dayElement, {
              scale: 0.98,
              duration: 0.1,
              ease: "power2.out",
              yoyo: true,
              repeat: 1
            });
          }
        };
        
        // Store handlers
        hoverHandlers.set(dayElement, {
          enter: handleMouseEnter,
          leave: handleMouseLeave,
          click: handleClick
        });
        
        // Add event listeners
        dayElement.addEventListener('mouseenter', handleMouseEnter);
        dayElement.addEventListener('mouseleave', handleMouseLeave);
        dayElement.addEventListener('click', handleClick);
      });
      
      // Cleanup function
      return () => {
        // Kill the timeline
        masterTl.kill();
        
        // Remove all event listeners
        dayBoxes.forEach(box => {
          const dayElement = box as HTMLElement;
          const handlers = hoverHandlers.get(dayElement);
          if (handlers) {
            dayElement.removeEventListener('mouseenter', handlers.enter);
            dayElement.removeEventListener('mouseleave', handlers.leave);
            dayElement.removeEventListener('click', handlers.click);
          }
        });
        
        hoverHandlers.clear();
        animatedElementsRef.current.clear();
        
        // Reset all animated elements to their final state
        gsap.set(dayBoxes, {
          clearProps: "all"
        });
      };
    }
  }, [currentDate]); // ✅ ONLY depend on currentDate (month navigation), NOT schedule/specialDates

  // Close modal on escape key - EXACTLY LIKE SHIFT MODAL
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDatePicker(false);
        setShowImportModal(false);
      }
    };

    if (showDatePicker || showImportModal) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showDatePicker, showImportModal]);

  // Close date picker when clicking outside - EXACTLY LIKE OTHER MODALS
  const handleDatePickerBackdropClick = (e: React.MouseEvent) => {
    // Prevent immediate closing on Android
    e.preventDefault();
    e.stopPropagation();
    
    if (e.target === e.currentTarget) {
      setShowDatePicker(false);
    }
  };

  const formatDateKey = (day: number) => {
    return `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  };

  const isToday = (day: number) => {
    const now = new Date();
    return now.getDate() === day && 
           now.getMonth() === currentMonth && 
           now.getFullYear() === currentYear;
  };

  const isPastDate = (day: number) => {
    const now = new Date();
    const dateToCheck = new Date(currentYear, currentMonth, day);
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return dateToCheck < todayDate;
  };

  const getDayOfWeek = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    return date.getDay(); // 0 = Sunday, 6 = Saturday
  };

  const isSunday = (day: number) => {
    return getDayOfWeek(day) === 0;
  };

  const isSpecialDate = (day: number) => {
    const dateKey = formatDateKey(day);
    return specialDates[dateKey] === true;
  };

  const getDateNote = (day: number) => {
    const dateKey = formatDateKey(day);
    return dateNotes[dateKey] || '';
  };

  const getDayShifts = (day: number) => {
    const dateKey = formatDateKey(day);
    const shifts = schedule[dateKey] || [];
    
    // Sort shifts in the desired display order: 9-4, 4-10, 12-10, N
    const shiftOrder = ['9-4', '4-10', '12-10', 'N'];
    return shifts.sort((a, b) => {
      // Extract base shift code (e.g., '9-4' from '9-4-NARAYYA')
      const getBaseShift = (shiftId: string) => {
        const parts = shiftId.split('-');
        if (parts.length >= 2 && !isNaN(Number(parts[parts.length - 1]))) {
          // Format: 9-4-NARAYYA -> take first two parts: 9-4
          return parts.slice(0, 2).join('-');
        }
        // Format: N-NARAYYA -> take first part: N
        return parts[0];
      };
      
      const baseA = getBaseShift(a);
      const baseB = getBaseShift(b);
      
      const indexA = shiftOrder.indexOf(baseA);
      const indexB = shiftOrder.indexOf(baseB);
      
      // If shift not found in order array, put it at the end
      const orderA = indexA === -1 ? 999 : indexA;
      const orderB = indexB === -1 ? 999 : indexB;
      
      return orderA - orderB;
    });
  };

  const getShiftDisplay = (shiftId: string) => {
    // Extract base shift code (e.g., '9-4' from '9-4-NARAYYA', or 'N' from 'N-NARAYYA')
    const getBaseShift = (id: string) => {
      const parts = id.split('-');
      
      // Handle formats like '9-4-NARAYYA' -> '9-4'
      if (parts.length >= 2 && parts[0].match(/^\d+$/) && parts[1].match(/^\d+$/)) {
        return `${parts[0]}-${parts[1]}`;
      }
      // Handle formats like 'N-NARAYYA' -> 'N'
      if (parts.length > 1) {
        return parts[0];
      }
      // Plain shift IDs like 'N', '9-4', '4-10', '12-10'
      return id;
    };
    
    const baseShiftCode = getBaseShift(shiftId);
    return SHIFTS.find(shift => shift.id === baseShiftCode);
  };

  const getDateTextColor = (day: number) => {
    if (isToday(day)) {
      return 'text-green-700 font-bold'; // Current date in green
    } else if (isSunday(day) || isSpecialDate(day)) {
      return 'text-red-600 font-bold'; // Sunday and special dates in red
    } else {
      return 'text-gray-900'; // Regular dates
    }
  };

  const formatCurrency = (amount: number) => {
    const result = formatMauritianRupees(amount);
    return result.formatted;
  };

  // Calculate month statistics for the modal
  const getMonthStatistics = () => {
    let totalShifts = 0;
    let totalAmount = 0;
    
    Object.entries(schedule).forEach(([dateKey, dayShifts]) => {
      const workDate = new Date(dateKey);
      if (workDate.getMonth() === currentMonth && workDate.getFullYear() === currentYear) {
        totalShifts += dayShifts.length;
      }
    });
    
    return {
      month: currentMonth,
      year: currentYear,
      totalShifts,
      totalAmount: totalAmount
    };
  };

  // Check if current month has any data (shifts or special dates)
  const hasMonthData = () => {
    // Check for shifts in current month
    const hasShifts = Object.entries(schedule).some(([dateKey, dayShifts]) => {
      const workDate = new Date(dateKey);
      return workDate.getMonth() === currentMonth && 
             workDate.getFullYear() === currentYear && 
             dayShifts.length > 0 && 
             dayShifts.some(shiftId => shiftId.trim() !== '');
    });
    
    // Check for special dates in current month
    const hasSpecialDates = Object.entries(specialDates).some(([dateKey, isSpecial]) => {
      const workDate = new Date(dateKey);
      return workDate.getMonth() === currentMonth && 
             workDate.getFullYear() === currentYear && 
             isSpecial === true;
    });
    
    return hasShifts || hasSpecialDates;
  };

  // Long-press handlers for month header
  const longPressHandlers = useLongPress({
    onLongPress: () => {
      setIsLongPressActive(true);
      // Only show modal if month has data to clear
      if (hasMonthData()) {
        setShowMonthClearModal(true);
      }
      // Reset flag after a delay
      setTimeout(() => setIsLongPressActive(false), 500);
    },
    onPress: () => {
      // Only trigger single press if long press wasn't active
      if (!isLongPressActive) {
        setTimeout(() => {
          if (!isLongPressActive) {
            setShowDatePicker(true);
            setTempMonthlySalary(monthlySalary > 0 ? monthlySalary.toString() : (shouldUseGlobalSalary ? globalSalary.toString() : '0'));
          }
        }, 50);
      }
    },
    delay: 500
  });

  // Fallback click handler for Android devices
  const handleMonthYearFallbackClick = (e: React.MouseEvent) => {
    // Only handle if it's a mouse click (not touch) and no long press is active
    if (e.type === 'click' && !isLongPressActive) {
      setTimeout(() => {
        if (!isLongPressActive && !showDatePicker) {
          setShowDatePicker(true);
        }
      }, 100);
    }
  };

  const handleDatePickerChange = (year: number, month: number) => {
    onDateChange(new Date(year, month, 1));
    setShowDatePicker(false);
  };

  const handleTitleClick = () => {
    setIsEditingTitle(true);
    setTempTitle(scheduleTitle);
  };

  const handleTitleSave = () => {
    onTitleUpdate(tempTitle.trim() || 'Work Schedule');
    setIsEditingTitle(false);
  };

  const handleTitleCancel = () => {
    setTempTitle(scheduleTitle);
    setIsEditingTitle(false);
  };

  const handleTitleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      handleTitleCancel();
    }
  };

  const handleDateClick = (day: number) => {
    onDateClick(day);
  };

  // Long press handlers for date clearing
  const handleDateLongPressStart = (day: number, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const dateKey = formatDateKey(day);
    
    // Check if date has content before showing modal
    const hasShifts = schedule[dateKey] && schedule[dateKey].length > 0;
    const isSpecial = specialDates[dateKey] === true;
    const hasNote = dateNotes[dateKey] && dateNotes[dateKey].trim() !== '';
    const hasContent = hasShifts || isSpecial || hasNote;
    
    // Only show modal if date has content to clear
    if (!hasContent) {
      return;
    }
    
    const timer = setTimeout(() => {
      setDateToDelete(dateKey);
      setShowClearDateModal(true);
      setLongPressTimer(null);
    }, 800); // 800ms long press
    
    setLongPressTimer(timer);
  };

  const handleDateLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // Clear date function - PRESERVES ROSTER SPECIAL DATES
  const handleClearDate = async (dateKey: string): Promise<void> => {
    try {
      console.log(`🗑️ Starting clear operation for ${dateKey}`);
      
      // Clear schedule data for this specific date
      setSchedule(prev => {
        const newSchedule = { ...prev };
        delete newSchedule[dateKey];
        return newSchedule;
      });
      
      // Clear special date marking ONLY if NOT a roster special date
      setSpecialDates(prev => {
        const newSpecialDates = { ...prev };
        // Only delete if there's no roster text for this date (preserve roster special dates)
        if (!specialDateTexts[dateKey]) {
          delete newSpecialDates[dateKey];
        }
        return newSpecialDates;
      });
      
      // Clear note for this specific date - AUTOMATICALLY SAVED BY HOOK
      setDateNotes(prev => {
        const newDateNotes = { ...prev };
        newDateNotes[dateKey] = '';
        return newDateNotes;
      });
      
      console.log(`✅ Successfully cleared date ${dateKey}`);
    } catch (error) {
      console.error(`❌ Error clearing date ${dateKey}:`, error);
      throw error;
    }
  };

  // Clear month function - PRESERVES ROSTER SPECIAL DATES
  const handleClearMonth = async (year: number, month: number): Promise<void> => {
    try {
      console.log(`🗑️ Starting clear operation for month ${month + 1}/${year}`);
      
      // Create date keys for the entire month
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const monthDateKeys: string[] = [];
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        monthDateKeys.push(dateKey);
      }
      
      // Clear schedule data for the month
      setSchedule(prev => {
        const newSchedule = { ...prev };
        monthDateKeys.forEach(dateKey => {
          delete newSchedule[dateKey];
        });
        return newSchedule;
      });
      
      // Clear special dates for the month - PRESERVE ROSTER SPECIAL DATES
      setSpecialDates(prev => {
        const newSpecialDates = { ...prev };
        monthDateKeys.forEach(dateKey => {
          // Only delete if there's no roster text for this date (preserve roster special dates)
          if (!specialDateTexts[dateKey]) {
            delete newSpecialDates[dateKey];
          }
        });
        return newSpecialDates;
      });
      
      // Clear notes for the entire month - AUTOMATICALLY SAVED BY HOOK
      setDateNotes(prev => {
        const newDateNotes = { ...prev };
        monthDateKeys.forEach(dateKey => {
          newDateNotes[dateKey] = '';
        });
        return newDateNotes;
      });
      
      console.log(`✅ Successfully cleared month ${month + 1}/${year}`);
    } catch (error) {
      console.error(`❌ Error clearing month ${month + 1}/${year}:`, error);
      throw error;
    }
  };

  // Handle roster import
  const handleImportFromRoster = async () => {
    if (!importAuthCode || importAuthCode.length < 4) {
      setImportAuthError('Please enter your authentication code');
      return;
    }

    const result = await validatePasscode(importAuthCode);
    if (!result || !result.isValid) {
      setImportAuthError('Invalid passcode');
      return;
    }
    const userName = `${result.surname}, ${result.name}`;

    setIsImporting(true);
    setImportAuthError('');
    
    try {
      console.log(`📥 Importing roster entries for ${userName}...`);
      
      // Fetch all roster entries
      const allRosterEntries = await fetchRosterEntries();
      
      // Filter entries for this user (match base name)
      const userBaseName = userName.replace(/\(R\)$/, '').trim().toUpperCase();
      const userEntries = allRosterEntries.filter(entry => {
        const entryBaseName = entry.assigned_name.replace(/\(R\)$/, '').trim().toUpperCase();
        return entryBaseName === userBaseName;
      });
      
      console.log(`📊 Found ${userEntries.length} roster entries for ${userName}`);
      
      let addedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      
      // Process each entry
      for (const entry of userEntries) {
        try {
          // Create roster change event for sync
          const rosterChange = {
            date: entry.date,
            shiftType: entry.shift_type,
            assignedName: entry.assigned_name,
            editorName: userName,
            action: 'added' as const
          };
          
          // Use the sync function to add to calendar
          const syncResult = syncRosterToCalendar(rosterChange, {
            calendarLabel: userName, // Use the authenticated user's name as calendar label
            schedule,
            specialDates,
            setSchedule,
            setSpecialDates
          });
          
          if (syncResult) {
            addedCount++;
            console.log(`✅ Added ${entry.shift_type} on ${entry.date}`);
          } else {
            skippedCount++;
            console.log(`⏭️ Skipped ${entry.shift_type} on ${entry.date} (conflict or already exists)`);
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ Error processing entry for ${entry.date}:`, error);
        }
      }
      
      setImportResults({ added: addedCount, skipped: skippedCount, errors: errorCount });
      
      // Show success message
      if (addedCount > 0) {
        console.log(`✅ Import completed: ${addedCount} added, ${skippedCount} skipped, ${errorCount} errors`);
      }
      
    } catch (error) {
      console.error('❌ Import failed:', error);
      setImportAuthError('Failed to import roster data. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCloseImportModal = () => {
    setShowImportModal(false);
    setImportAuthCode('');
    setImportAuthError('');
    setImportResults(null);
  };

  // Debug function to log current calendar state - DISABLED to prevent console spam
  // Only enable when actively debugging specific issues
  // useEffect(() => {
  //   console.log('📅 CALENDAR DEBUG: Current calendar state:', {
  //     currentMonth: currentMonth + 1,
  //     currentYear,
  //     scheduleKeys: Object.keys(schedule),
  //     scheduleEntries: Object.entries(schedule).slice(0, 5),
  //     specialDatesKeys: Object.keys(specialDates),
  //     totalScheduleEntries: Object.keys(schedule).length,
  //     totalSpecialDates: Object.keys(specialDates).length,
  //     sampleScheduleData: Object.entries(schedule).slice(0, 3).map(([date, shifts]) => ({
  //       date,
  //       shifts,
  //       dayOfWeek: new Date(date).getDay()
  //     }))
  //   });
  // }, [schedule, specialDates, currentMonth, currentYear]);
  
  const handleMonthNavigation = (direction: 'prev' | 'next') => {
    onNavigateMonth(direction);
  };

  // Check if current month/year matches today's month/year for month-to-date display
  const isCurrentMonth = today.getMonth() === currentMonth && today.getFullYear() === currentYear;

  // Generate calendar days
  const calendarDays = [];
  
  // Empty cells for days before the first day of the month
  for (let i = 0; i < firstDayWeekday; i++) {
    calendarDays.push(null);
  }
  
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Calculate number of rows needed
  const totalCells = calendarDays.length;
  const numberOfRows = Math.ceil(totalCells / 7);
  
  // Calculate square cell size based on viewport width
  const getCellSize = () => {
    const isDesktop = window.innerWidth >= 640;
    const availableWidth = isDesktop ? window.innerWidth - 96 : window.innerWidth - 32; // Account for padding
    const cellWidth = availableWidth / 7; // 7 columns
    // Return actual cell width for perfect square, with reasonable minimums
    return cellWidth < 50 ? 50 : cellWidth; // Only enforce minimum if extremely small
  };

  return (
    <div className="bg-white overflow-hidden select-none" style={{
      userSelect: 'none', 
      WebkitUserSelect: 'none',
      width: '100vw',
      marginLeft: 'calc(-50vw + 50%)',
      marginRight: 'calc(-50vw + 50%)',
    }}>
      {/* Header */}
      <div className="border-b border-gray-200" style={{ 
        padding: window.innerWidth >= 640 ? '24px' : '16px',
        paddingTop: window.innerWidth >= 640 ? '24px' : '16px'
      }}>
        <div className="flex items-center justify-center space-x-3 mb-4">
          <CalendarIcon className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" />
          {isEditingTitle ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value.toUpperCase())}
                onKeyDown={handleTitleKeyPress}
                onBlur={handleTitleSave}
                className="text-xl sm:text-3xl font-bold text-gray-900 text-center bg-transparent border-b-2 border-indigo-500 focus:outline-none min-w-[250px] sm:min-w-[300px]"
                autoFocus
              />
            </div>
          ) : (
            <button
              onClick={handleTitleClick}
              className="flex items-center space-x-2 text-xl sm:text-3xl font-bold text-gray-900 text-center hover:text-indigo-600 transition-colors duration-200 group select-none"
              style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
            >
              <span className="select-none">{scheduleTitle}</span>
              <Edit3 className="w-4 h-4 sm:w-5 sm:h-5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </button>
          )}
        </div>
        
        {/* Month/Year Navigation */}
        <div className="flex items-center justify-center space-x-3 sm:space-x-4">
          <button
            onClick={() => handleMonthNavigation('prev')}
            className="w-10 h-10 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-600 transition-colors duration-200 active:scale-95 select-none"
            style={{ 
              userSelect: 'none', 
              WebkitUserSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0',
              margin: '0',
              border: 'none',
              outline: 'none'
            }}
          >
            <ChevronLeft 
              className="w-5 h-5" 
              style={{
                display: 'block',
                margin: '0 auto'
              }}
            />
          </button>
          
          {/* Month/Year Button */}
          <div className="flex-1 flex justify-center">
            <button
              {...longPressHandlers}
              onClick={handleMonthYearFallbackClick}
             className="text-lg sm:text-xl font-bold text-gray-700 text-center px-3 sm:px-4 py-2 rounded-lg select-none"
              style={{ 
                userSelect: 'none', 
                WebkitUserSelect: 'none',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              <span className="select-none">{monthNames[currentMonth]} {currentYear}</span>
            </button>
          </div>
          
          <button
            onClick={() => handleMonthNavigation('next')}
            className="w-10 h-10 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-600 transition-colors duration-200 active:scale-95 select-none"
            style={{ 
              userSelect: 'none', 
              WebkitUserSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0',
              margin: '0',
              border: 'none',
              outline: 'none'
            }}
          >
            <ChevronRight 
              className="w-5 h-5" 
              style={{
                display: 'block',
                margin: '0 auto'
              }}
            />
          </button>
        </div>
      </div>

      {/* Date Picker Modal - NOW CENTERED VERTICALLY LIKE OTHER MODALS */}
      {showDatePicker && (
        createPortal(
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: window.innerWidth > window.innerHeight ? 'flex-start' : 'center',
              justifyContent: 'center',
              zIndex: 99999,
              padding: window.innerWidth > window.innerHeight ? '8px' : '16px', // Less padding in landscape
              paddingTop: window.innerWidth > window.innerHeight ? '4px' : '16px', // Minimal top padding in landscape
              overflow: 'auto',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
              // Critical: Fix Android touch issues
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none'
            }}
            onClick={handleDatePickerBackdropClick}
            onTouchStart={(e) => {
              // Prevent touch conflicts on Android
              e.stopPropagation();
            }}
            onTouchEnd={(e) => {
              // Handle touch end properly on Android
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div 
              style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                maxWidth: window.innerWidth > window.innerHeight ? '90vw' : '400px', // Use more width in landscape
                width: '100%',
                maxHeight: window.innerWidth > window.innerHeight ? '95vh' : '90vh', // Use more height in landscape
                display: 'flex',
                flexDirection: 'column',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                // Critical: Prevent Android touch issues
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                margin: window.innerWidth > window.innerHeight ? '4px 0' : '16px 0' // Less margin in landscape
              }}
              onClick={(e) => {
                // Prevent modal from closing when clicking inside
                e.stopPropagation();
                e.preventDefault();
              }}
              onTouchStart={(e) => {
                // Prevent touch propagation to backdrop
                e.stopPropagation();
              }}
              onTouchEnd={(e) => {
                // Prevent touch propagation to backdrop
                e.stopPropagation();
              }}
            >
              {/* Header with close button */}
              <div style={{ 
                position: 'relative', 
                padding: window.innerWidth > window.innerHeight ? '12px' : '24px', // Less padding in landscape
                paddingBottom: window.innerWidth > window.innerHeight ? '8px' : '16px', 
                borderBottom: '1px solid #e5e7eb', 
                flexShrink: 0 
              }}>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowDatePicker(false);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowDatePicker(false);
                  }}
                  style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    padding: '8px',
                    borderRadius: '8px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#6b7280',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                >
                  <X style={{ width: '20px', height: '20px' }} />
                </button>
                
                {/* Export to Calendar Button */}
                <button
                  onClick={() => {
                    setShowDatePicker(false); // Close month/year selector first
                    setShowCalendarExportModal(true); // Then open export modal
                  }}
                  className="p-2 rounded-lg hover:bg-green-100 text-green-600 hover:text-green-700 transition-colors duration-200"
                  title="Export shifts to external calendar"
                  style={{
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                >
                  <Download className="w-5 h-5" />
                </button>
                
                <div style={{ textAlign: 'center' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', marginBottom: '4px', margin: 0 }}>
                    Select Month & Year
                  </h3>
                </div>
              </div>

              {/* Content */}
              <div style={{
                padding: window.innerWidth > window.innerHeight ? '12px' : '24px', // Less padding in landscape
                flex: 1,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-y'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px', textAlign: 'center' }}>Year</label>
                    <select
                      value={currentYear}
                      onChange={(e) => handleDatePickerChange(Number(e.target.value), currentMonth)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        textAlign: 'center',
                        fontSize: '14px',
                        touchAction: 'manipulation'
                      }}
                    >
                      {Array.from({ length: 10 }, (_, i) => currentYear - 5 + i).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px', textAlign: 'center' }}>Month</label>
                    <select
                      value={currentMonth}
                      onChange={(e) => handleDatePickerChange(currentYear, Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        textAlign: 'center',
                        fontSize: '14px',
                        touchAction: 'manipulation'
                      }}
                    >
                      {monthNames.map((month, index) => (
                        <option key={index} value={index}>{month}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px', textAlign: 'center' }}>
                    Salary for {monthNames[currentMonth]} {currentYear}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={tempMonthlySalary}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d]/g, '');
                        setTempMonthlySalary(value);
                      }}
                      onBlur={() => {
                        if (onMonthlySalaryChange && tempMonthlySalary) {
                          const salary = parseInt(tempMonthlySalary, 10) || 0;
                          onMonthlySalaryChange(currentYear, currentMonth, salary);
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        paddingRight: shouldUseGlobalSalary ? '40px' : '16px',
                        border: shouldUseGlobalSalary ? '2px solid #10b981' : '2px solid #d1d5db',
                        borderRadius: '8px',
                        textAlign: 'center',
                        fontSize: '16px',
                        fontFamily: 'monospace',
                        touchAction: 'manipulation',
                        backgroundColor: shouldUseGlobalSalary ? '#f0fdf4' : 'white',
                        color: shouldUseGlobalSalary ? '#059669' : '#111827'
                      }}
                    />
                    {shouldUseGlobalSalary && (
                      <div style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#10b981',
                        fontSize: '18px'
                      }}>
                        🔒
                      </div>
                    )}
                  </div>
                  <p style={{
                    fontSize: '12px',
                    color: shouldUseGlobalSalary ? '#059669' : (monthlySalary === 0 ? '#6b7280' : '#6b7280'),
                    marginTop: '8px',
                    textAlign: 'center',
                    fontWeight: shouldUseGlobalSalary ? '600' : '400'
                  }}>
                    {shouldUseGlobalSalary
                      ? '🔒 Using global salary from Settings. Edit to set custom salary for this month.'
                      : (monthlySalary === 0
                          ? 'No salary set for this month. Enter a value to set custom salary.'
                          : 'Custom salary for this month. Won\'t change when you update global salary.')}
                  </p>
                </div>
              </div>
              
              {/* Footer with close button */}
              <div style={{ 
                padding: window.innerWidth > window.innerHeight ? '12px' : '24px', // Less padding in landscape
                paddingTop: 0, 
                flexShrink: 0 
              }}>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowDatePicker(false);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowDatePicker(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#4f46e5',
                    color: 'white',
                    fontWeight: '600',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '16px',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      )}

      {/* Calendar Body */}
      <div className="p-3 sm:p-6">
        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-3 sm:mb-4">
          {weekDays.map((day, index) => (
            <div key={day} className={`p-2 sm:p-3 text-center font-semibold text-xs sm:text-sm select-none ${
              index === 0 ? 'text-red-600' : 'text-gray-600'
            }`} style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid - MOBILE OPTIMIZED ANIMATIONS */}
        <div 
          className="mb-4 sm:mb-6 select-none w-full mx-auto"
          ref={calendarGridRef}
          style={{
            userSelect: 'none',
            WebkitUserSelect: 'none',
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: window.innerWidth >= 640 ? '8px' : '4px',
            // Center the grid in portrait mode
            justifyContent: 'center',
            alignContent: 'start',
            maxWidth: '100%',
            margin: '0 auto'
          }}
        >
          {calendarDays.map((day, index) => {
            const rowIndex = Math.floor(index / 7);
            const dayShifts = day ? getDayShifts(day) : [];
            const hasSpecialDate = day ? isSpecialDate(day) : false;
            const todayDate = day ? isToday(day) : false;
            const pastDate = day ? isPastDate(day) : false;

            return (
              <div
                key={index}
                data-day={day}
                className={`day-box p-1 sm:p-2 rounded-lg border-2 transition-colors duration-200 overflow-hidden relative select-none ${
                  day 
                    ? todayDate
                      ? `cursor-pointer border-indigo-400 shadow-lg bg-yellow-100 hover:bg-yellow-200 active:bg-yellow-200` // TODAY: Permanent hover state
                      : `cursor-pointer hover:border-indigo-400 hover:shadow-lg bg-yellow-50 border-yellow-200 hover:bg-yellow-100 active:bg-yellow-200`
                    : 'border-transparent'
                }`}
                style={{
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: `${getCellSize()}px` // Square size (width = height) but can grow with content
                }}
                onClick={() => day && handleDateClick(day)}
               onMouseDown={(e) => day && handleDateLongPressStart(day, e)}
               onMouseUp={handleDateLongPressEnd}
               onMouseLeave={handleDateLongPressEnd}
               onTouchStart={(e) => day && handleDateLongPressStart(day, e)}
               onTouchEnd={handleDateLongPressEnd}
              >
                {day && (
                  <div className="flex flex-col select-none h-full">
                    {/* BIG X WATERMARK for past dates */}
                    {isPastDate(day) && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                        <div className="text-gray-300 text-4xl sm:text-5xl font-bold opacity-30 select-none">
                          ✕
                        </div>
                      </div>
                    )}
                    
   
                    
                    {/* Date header with special indicator and TODAY CIRCLE */}
                    <div className={`flex-shrink-0 mb-1.5 sm:mb-2 relative ${isPastDate(day) ? 'z-30' : ''}`}>
                      <div className={`text-sm sm:text-base text-center font-semibold ${getDateTextColor(day)} relative select-none`}>
                        {/* TODAY CIRCLE - PERFECT SIZE FOR 2-DIGIT DATES */}
                        {todayDate && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div 
                              className="w-6 h-6 sm:w-7 sm:h-7 border-2 border-green-500 rounded-full animate-pulse"
                              style={{
                                boxShadow: '0 0 0 1px rgba(34, 197, 94, 0.2), 0 0 10px rgba(34, 197, 94, 0.3)',
                                animation: 'todayPulse 2s ease-in-out infinite'
                              }}
                            />
                          </div>
                        )}
                        <span className="relative z-10 select-none">{day}</span>
                        
                        {/* TICK INDICATOR for dates with shifts */}
                        {dayShifts.length > 0 && dayShifts.some(shiftId => shiftId.trim() !== '') && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-green-500 rounded-full flex items-center justify-center">
                            <svg 
                              className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-white" 
                              fill="currentColor" 
                              viewBox="0 0 20 20"
                            >
                              <path 
                                fillRule="evenodd" 
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                                clipRule="evenodd" 
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Content container - only takes needed space */}
                    <div className={`flex flex-col items-center justify-start space-y-0.5 sm:space-y-1 px-0.5 select-none min-w-0 ${isPastDate(day) ? 'z-30' : ''}`}>
                      {/* Special date indicator with actual roster text */}
                      {(() => {
                        const dateKey = formatDateKey(day);
                        const hasSpecialDateFlag = specialDates[dateKey] === true;
                        const hasRosterSpecialText = specialDateTexts[dateKey];
                        // Only treat as roster text if it exists AND is NOT the 'SPECIAL' placeholder
                        const isActualRosterText = hasRosterSpecialText && hasRosterSpecialText !== 'SPECIAL';
                        // Show if EITHER manually marked OR has roster text
                        return (hasSpecialDateFlag || hasRosterSpecialText) ? (
                          <div 
                            className="special-text text-[8px] sm:text-[9px] text-red-500 font-bold leading-none mt-0.5 flex justify-center select-none transition-all duration-500 ease-in-out"
                            style={{ 
                              opacity: 1,
                              // Only apply width constraints for roster-sourced text (to enable scrolling)
                              // Manual special dates should NOT have width constraints
                              ...(isActualRosterText ? {
                                width: '100%',
                                maxWidth: '100%',
                                overflow: 'hidden'
                              } : {})
                            }}
                          >
                            {isActualRosterText ? (
                              // Roster special text - enable scrolling
                              <ScrollingText 
                                text={hasRosterSpecialText} 
                                pauseDuration={2}
                                scrollDuration={4}
                                className="text-center select-none animate-fadeIn"
                              >
                                <div className="text-center select-none transition-colors duration-300 whitespace-nowrap">{hasRosterSpecialText}</div>
                              </ScrollingText>
                            ) : (
                              // Manual special date - NO scrolling, just plain text
                              <div className="text-center select-none transition-colors duration-300 whitespace-nowrap">SPECIAL</div>
                            )}
                          </div>
                        ) : null;
                      })()}
                      
                      {/* All shifts displayed */}
                      {dayShifts.map((shiftId, idx) => {
                        const shift = getShiftDisplay(shiftId);
                        return shift ? (
                          <div
                            key={`${shiftId}-${idx}`}
                            className={`shift-text text-[8px] sm:text-[11px] font-bold leading-tight text-black flex-shrink-0 w-full select-none whitespace-nowrap overflow-hidden ${isPastDate(day) ? 'opacity-60' : ''}`}
                          >
                            <ScrollingText 
                              text={shift.time} 
                              pauseDuration={2}
                              scrollDuration={4}
                              className="text-center select-none truncate px-0.5"
                            >
                              <div className="text-center select-none truncate px-0.5">{shift.time}</div>
                            </ScrollingText>
                          </div>
                        ) : null;
                      })}
                      
                      {/* Note display */}
                      {getDateNote(day) && getDateNote(day).trim() !== '' && (
                        <div className="note-text text-[8px] sm:text-[10px] font-medium leading-tight text-indigo-600 flex-shrink-0 w-full select-none mt-0.5">
                          <ScrollingText 
                            text={getDateNote(day)} 
                            pauseDuration={2}
                            scrollDuration={3}
                            className="text-center select-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Amount Display Section - NO ANIMATION */}
        <div 
          className={`space-y-3 sm:space-y-4 select-none ${isCurrentMonth ? 'mt-4 sm:mt-6' : 'mt-4 sm:mt-6'}`}
          style={{ 
            userSelect: 'none', 
            WebkitUserSelect: 'none',
            // FIXED: Dynamic padding based on content
            paddingBottom: isCurrentMonth ? '30px' : '20px', // Extra padding when Month-to-Date is shown
            marginBottom: '10px'
          }}
        >
          {/* Month to Date Total - Only show if viewing current month */}
          {isCurrentMonth && (
            <div 
              className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 mb-4"
              style={{
                // FIXED: Ensure proper touch scrolling
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-y'
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  <span className="text-base sm:text-lg font-semibold text-green-800 select-none">Month to Date</span>
                </div>
                <span className="text-lg sm:text-2xl font-bold text-green-900 select-none">
                  {formatCurrency(monthToDateAmount)}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-green-600 mt-2 text-center select-none">
                Amount earned from start of month to today ({today.getDate()}/{currentMonth + 1}/{currentYear})
              </p>
            </div>
          )}

          {/* Monthly Total */}
          <div 
            className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 sm:p-4"
            style={{
              // FIXED: Ensure proper touch scrolling
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y'
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calculator className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                <span className="text-base sm:text-lg font-semibold text-indigo-800 select-none">Monthly Total</span>
              </div>
              <span className="text-lg sm:text-2xl font-bold text-indigo-900 select-none">
                {formatCurrency(totalAmount)}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-indigo-600 mt-2 text-center select-none">
              Total amount for all scheduled shifts in {monthNames[currentMonth]} {currentYear}
            </p>
          </div>
        </div>
      </div>

      {/* Clear Date Modal */}
      <ClearDateModal
        isOpen={showClearDateModal}
        selectedDate={dateToDelete}
        schedule={schedule}
        specialDates={specialDates}
        dateNotes={dateNotes}
        onConfirm={handleClearDate}
        onCancel={() => {
          setShowClearDateModal(false);
          setDateToDelete(null);
        }}
      />

      {/* Clear Month Modal */}
      <ClearMonthModal
        isOpen={showClearMonthModal}
        selectedMonth={currentMonth}
        selectedYear={currentYear}
        onConfirm={handleClearMonth}
        onCancel={() => setShowClearMonthModal(false)}
      />

      {/* Month Clear Modal (Long-press triggered) */}
      <MonthClearModal
        isOpen={showMonthClearModal}
        monthData={getMonthStatistics()}
        onConfirm={handleClearMonth}
        onCancel={() => setShowMonthClearModal(false)}
      />

      {/* Calendar Export Modal */}
      <CalendarExportModal
        isOpen={showCalendarExportModal}
        onClose={() => setShowCalendarExportModal(false)}
        currentMonth={currentDate.getMonth()}
        currentYear={currentDate.getFullYear()}
      />

      {/* Import from Roster Modal */}
      {showImportModal && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseImportModal();
            }
          }}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              maxWidth: window.innerWidth > window.innerHeight ? '90vw' : '400px',
              width: '100%',
              maxHeight: window.innerWidth > window.innerHeight ? '95vh' : '90vh',
              display: 'flex',
              flexDirection: 'column',
              margin: window.innerWidth > window.innerHeight ? '4px 0' : '16px 0'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ 
              position: 'relative', 
              padding: window.innerWidth > window.innerHeight ? '12px' : '24px',
              paddingBottom: window.innerWidth > window.innerHeight ? '8px' : '16px',
              borderBottom: '1px solid #e5e7eb',
              flexShrink: 0
            }}>
              <button
                onClick={handleCloseImportModal}
                disabled={isImporting}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  padding: '8px',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#6b7280',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
              
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  backgroundColor: '#dbeafe', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 16px auto'
                }}>
                  <Download style={{ width: '24px', height: '24px', color: '#2563eb' }} />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', marginBottom: '8px', margin: 0 }}>
                  Import Your Roster
                </h3>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                  Import your assigned shifts from the roster database
                </p>
              </div>
            </div>

            {/* Content */}
            <div style={{ 
              padding: window.innerWidth > window.innerHeight ? '12px' : '24px',
              flex: 1,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y'
            }}>
              {!importResults ? (
                <>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                      Your Authentication Code
                    </label>
                    <input
                      type="text"
                      value={importAuthCode}
                      onChange={(e) => setImportAuthCode(e.target.value.toUpperCase())}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #d1d5db',
                        borderRadius: '8px',
                        textAlign: 'center',
                        fontFamily: 'monospace',
                        fontSize: '18px',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        touchAction: 'manipulation'
                      }}
                      placeholder="Enter your code"
                      maxLength={4}
                      autoComplete="off"
                      autoFocus
                    />
                  </div>
                  
                  {importAuthError && (
                    <div style={{ 
                      marginBottom: '16px', 
                      padding: '12px', 
                      backgroundColor: '#fef2f2', 
                      border: '1px solid #fecaca', 
                      borderRadius: '8px' 
                    }}>
                      <p style={{ fontSize: '14px', color: '#dc2626', textAlign: 'center', margin: 0 }}>
                        {importAuthError}
                      </p>
                    </div>
                  )}
                  
                  <div style={{ 
                    padding: '16px', 
                    backgroundColor: '#f0f9ff', 
                    border: '1px solid #bae6fd', 
                    borderRadius: '8px',
                    marginBottom: '24px'
                  }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#0369a1', marginBottom: '8px', margin: '0 0 8px 0' }}>
                      How it works:
                    </h4>
                    <ul style={{ fontSize: '12px', color: '#0c4a6e', margin: 0, paddingLeft: '16px' }}>
                      <li>Enter your authentication code</li>
                      <li>System finds all your roster assignments</li>
                      <li>Adds them to your personal calendar</li>
                      <li>Skips dates that already have shifts</li>
                      <li>Marks special dates automatically</li>
                    </ul>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    backgroundColor: '#dcfce7', 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    margin: '0 auto 16px auto'
                  }}>
                    <svg style={{ width: '24px', height: '24px', color: '#16a34a' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  
                  <h4 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', marginBottom: '16px', margin: '0 0 16px 0' }}>
                    Import Complete!
                  </h4>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(3, 1fr)', 
                    gap: '16px', 
                    marginBottom: '24px' 
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}>
                        {importResults.added}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Added</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
                        {importResults.skipped}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Skipped</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
                        {importResults.errors}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Errors</div>
                    </div>
                  </div>
                  
                  {importResults.added > 0 && (
                    <p style={{ fontSize: '14px', color: '#16a34a', marginBottom: '16px', margin: '0 0 16px 0' }}>
                      ✅ {importResults.added} shifts added to your calendar!
                    </p>
                  )}
                  
                  {importResults.skipped > 0 && (
                    <p style={{ fontSize: '12px', color: '#f59e0b', marginBottom: '16px', margin: '0 0 16px 0' }}>
                      ⏭️ {importResults.skipped} shifts skipped (conflicts or already exist)
                    </p>
                  )}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div style={{ 
              padding: window.innerWidth > window.innerHeight ? '12px' : '24px',
              paddingTop: 0,
              flexShrink: 0
            }}>
              {!importResults ? (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={handleCloseImportModal}
                    disabled={isImporting}
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                      fontWeight: '600',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '16px',
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                      opacity: isImporting ? 0.5 : 1
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImportFromRoster}
                    disabled={isImporting || importAuthCode.length < 4}
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: isImporting || importAuthCode.length < 4 ? '#d1d5db' : '#2563eb',
                      color: 'white',
                      fontWeight: '600',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: isImporting || importAuthCode.length < 4 ? 'not-allowed' : 'pointer',
                      fontSize: '16px',
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {isImporting ? (
                      <>
                        <div style={{
                          width: '16px',
                          height: '16px',
                          border: '2px solid white',
                          borderTop: '2px solid transparent',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                        <span>Importing...</span>
                      </>
                    ) : (
                      <>
                        <Download style={{ width: '16px', height: '16px' }} />
                        <span>Import</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleCloseImportModal}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#2563eb',
                    color: 'white',
                    fontWeight: '600',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '16px',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Custom CSS for today's circle animation */}
      <style>{`
        @keyframes todayPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.8;
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}; 