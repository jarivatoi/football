import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, Ticket, ChevronDown, Settings, History } from 'lucide-react';
import { gsap } from 'gsap';
import OfflineIndicator from './OfflineIndicator';

export interface ApiSource {
  id: string;
  name: string;
  baseUrl: string;
  displayName: string;
  hasBonus?: boolean;  // Whether this API source provides bonus on payouts
  bonusPercentage?: number;  // Default bonus percentage (if known, e.g., 10 for 10%)
}

export const API_SOURCES: ApiSource[] = [
  {
    id: 'totelepep',
    name: 'Totelepep',
    baseUrl: 'https://www.totelepep.mu/webapi/GetSport',
    displayName: 'Totelepep',
    hasBonus: false  // Totelepep does not provide bonus
  },
  {
    id: 'stevenhills',
    name: 'Stevenhills',
    baseUrl: 'https://www.stevenhills.bet/webapi/GetSport',
    displayName: 'Stevenhills',
    hasBonus: false  // Stevenhills does not provide bonus (update if needed)
  },
  {
    id: 'superscore',
    name: 'Superscore',
    baseUrl: 'https://www.superscore.mu/webapi/GetSport',
    displayName: 'Superscore',
    hasBonus: false  // Superscore does not provide bonus (update if needed)
  },
  {
    id: 'valueplus',
    name: 'Valueplus',
    baseUrl: 'https://www.valueplus.mu/webapi/GetSport',
    displayName: 'Valueplus',
    hasBonus: false  // Valueplus does not provide bonus (update if needed)
  }
];

interface HeaderProps {
  selectionCount: number;
  hasInvalidSelections?: boolean;
  onSlipClick: () => void;
  selectedSource: ApiSource;
  onSourceChange: (source: ApiSource) => void;
  onSettingsClick?: () => void;
  onHistoryClick?: () => void;
  hasSavedBookings?: boolean;
}

const Header: React.FC<HeaderProps> = ({ selectionCount, hasInvalidSelections = false, onSlipClick, selectedSource, onSourceChange, onSettingsClick, onHistoryClick, hasSavedBookings = false }) => {
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const textRef = useRef<HTMLSpanElement>(null);
  const settingsRef = useRef<HTMLButtonElement>(null);
  const historyRef = useRef<HTMLButtonElement>(null);
  const slipRef = useRef<HTMLButtonElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevSelectionCountRef = useRef<number>(0);

  // Elastic snap animation on mount and when source changes
  useEffect(() => {
    if (textRef.current) {
      gsap.fromTo(textRef.current, 
        { x: -50, opacity: 0 },
        { x: 0, opacity: 1, duration: 1.5, ease: "elastic.out(1, 0.3)" }
      );
    }
  }, [selectedSource.id]);

  // Animate betslip, settings, and history buttons
  useEffect(() => {
    const prevCount = prevSelectionCountRef.current;
    const currentCount = selectionCount;

    // Only animate when transitioning from 0 to >0 (initial appearance)
    if (prevCount === 0 && currentCount > 0) {
      // Betslip button animation - slides in from right
      if (slipRef.current) {
        gsap.fromTo(slipRef.current,
          { x: 100, opacity: 0 },
          { x: 0, opacity: 1, duration: 1.5, ease: "elastic.out(1, 0.4)" }
        );
      }

      // Settings button animation - same elastic effect
      if (settingsRef.current && onSettingsClick) {
        gsap.fromTo(settingsRef.current,
          { x: 100, opacity: 0 },
          { x: 0, opacity: 1, duration: 1.5, ease: "elastic.out(1, 0.4)" }
        );
      }

      // History button animation - same elastic effect
      if (historyRef.current && onHistoryClick && hasSavedBookings) {
        gsap.fromTo(historyRef.current,
          { x: 100, opacity: 0 },
          { x: 0, opacity: 1, duration: 1.5, ease: "elastic.out(1, 0.4)" }
        );
      }
    }

    // Reverse animation when transitioning from >0 to 0 (removal)
    if (prevCount > 0 && currentCount === 0) {
      if (slipRef.current) {
        gsap.to(slipRef.current, {
          x: 300,
          opacity: 0,
          duration: 0.8,
          ease: "power2.in"
        });
      }

      // Settings button: slide back to original position but stay visible
      if (settingsRef.current && onSettingsClick) {
        gsap.to(settingsRef.current, {
          x: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power2.inOut"
        });
      }

      // History button: slide back to original position but stay visible
      if (historyRef.current && onHistoryClick && hasSavedBookings) {
        gsap.to(historyRef.current, {
          x: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power2.inOut"
        });
      }
    }

    // Update previous count
    prevSelectionCountRef.current = currentCount;
  }, [selectionCount, onSettingsClick, onHistoryClick, hasSavedBookings]);

  // Auto-scroll to show betslip button when it appears
  useEffect(() => {
    if (selectionCount > 0 && scrollContainerRef.current) {
      // Small delay to ensure the button is rendered
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft = 0;
        }
      }, 100);
    }
  }, [selectionCount]);

  const handleSourceSelect = (source: ApiSource) => {
    onSourceChange(source);
    setShowSourceDropdown(false);
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-source-dropdown]')) {
        setShowSourceDropdown(false);
      }
    };

    if (showSourceDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showSourceDropdown]);

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-3xl mx-auto px-4 py-3">
        <div className="flex items-center gap-0 w-full">
          <div className="flex items-center gap-1 -ml-1.5 shrink-0">
            {/* API Source Dropdown */}
            <div className="relative flex items-center gap-2" data-source-dropdown>
              <button
                onClick={() => setShowSourceDropdown(!showSourceDropdown)}
                className="flex items-center gap-2 p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors relative z-10"
              >
                <TrendingUp className="w-6 h-6 text-white" />
                <ChevronDown className="w-4 h-4 text-white" />
              </button>
              <span ref={textRef} className="text-xl font-bold text-gray-900 relative z-0 pr-2">{selectedSource.displayName}</span>

              {showSourceDropdown && (
                <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[180px]">
                  {API_SOURCES.map((source) => (
                    <button
                      key={source.id}
                      onClick={() => handleSourceSelect(source)}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                        selectedSource.id === source.id
                          ? 'bg-blue-50 text-blue-600 font-semibold'
                          : 'text-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{source.displayName}</span>
                        {selectedSource.id === source.id && (
                          <span className="text-blue-600">✓</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Scrollable buttons container */}
          <div ref={scrollContainerRef} className="flex gap-2 overflow-x-auto scrollbar-hide min-w-0 flex-1 pt-2 pr-2">
            {/* Spacer to push buttons right */}
            <div className="ml-auto"></div>
            
            {/* History Button - Only show if there are saved bookings */}
            {onHistoryClick && hasSavedBookings && (
              <button
                ref={historyRef}
                onClick={onHistoryClick}
                className="flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-lg transition-colors shrink-0"
                title="View booking history"
              >
                <History className="w-5 h-5" />
              </button>
            )}
            
            {/* Settings Button */}
            {onSettingsClick && (
              <button
                ref={settingsRef}
                onClick={onSettingsClick}
                className="flex items-center justify-center bg-gray-600 hover:bg-gray-700 text-white p-2 rounded-lg transition-colors shrink-0"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
            
            {/* Slip Counter Button */}
            {selectionCount > 0 && (
              <button
                ref={slipRef}
                onClick={onSlipClick}
                className={`relative flex items-center gap-2 pl-3 pr-4.5 py-2 rounded-lg font-semibold transition-colors shrink-0 ${
                  hasInvalidSelections
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-yellow-400 hover:bg-yellow-500 text-gray-900'
                }`}
              >
                <Ticket className="w-5 h-5" />
                <span className="text-sm">Slip</span>
                <span className={`absolute -top-2 -right-2 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${
                  hasInvalidSelections
                    ? 'bg-white text-red-600 border-2 border-red-500'
                    : 'bg-red-600 text-white'
                }`}>
                  {selectionCount}
                </span>
              </button>
            )}
            
            {/* Offline indicator - inside scrollable container */}
            <div className="shrink-0">
              <OfflineIndicator />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;