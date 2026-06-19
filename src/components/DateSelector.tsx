import React, { useState, useEffect } from 'react';

interface DateSelectorProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  availableDates?: Array<{ date: string; matchCount: number; displayName: string }>;
  showAllMatches?: boolean;
  onToggleAllMatches?: () => void;
  totalMatches?: number;
  dateProgress?: Record<string, {
    loaded: number;
    total: number;
    isComplete: boolean;
  }>;
  allMatchesProgress?: {
    loaded: number;
    total: number;
    isComplete: boolean;
    percentage: number;
  };
  onClearCache?: (date: string) => void; // Long-press callback
}

const DateSelector: React.FC<DateSelectorProps> = ({ 
  selectedDate, 
  onDateChange, 
  availableDates = [],
  showAllMatches = false,
  onToggleAllMatches,
  totalMatches = 0,
  dateProgress = {},
  allMatchesProgress,
  onClearCache
}) => {
  // Long-press state
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [longPressDate, setLongPressDate] = useState<string | null>(null);
  
  // Use API data directly - show exact names from totelepep
  const datesToShow = availableDates.length > 0 ? availableDates.slice(0, 8) : [];
  
  // Long-press handlers
  const handlePressStart = (date: string) => {
    setLongPressDate(date);
    const timer = setTimeout(() => {
      // Long press detected (3 seconds)
      if (onClearCache) {
        onClearCache(date);
      }
      setLongPressDate(null);
    }, 3000);
    setPressTimer(timer);
  };
  
  const handlePressEnd = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
    setLongPressDate(null);
  };

  return (
    <div className="bg-white shadow-sm border-b border-gray-200">
      {/* Horizontal Scrolling Row */}
      <div className="flex gap-2 overflow-x-auto px-3 pr-4 py-0 w-full scrollbar-hide">
        {datesToShow.map((dateInfo) => {
          // When All Matches is active, no date should be selected
          const isSelected = showAllMatches ? false : dateInfo.date === selectedDate;
          
          // Get progress for this date
          const progress = dateProgress[dateInfo.date];
          const percentage = progress ? (progress.loaded / progress.total) * 100 : 0;
          const isComplete = progress?.isComplete;
          
          // Extract date number and month for display
          let dateStr = '';
          const dateObj = new Date(dateInfo.date);
          if (!isNaN(dateObj.getTime())) {
            const day = dateObj.getDate();
            const month = dateObj.toLocaleDateString('en-GB', { month: 'short' });
            dateStr = `${day} ${month}`;
          }
          
          return (
            <button
              key={dateInfo.date}
              onClick={() => onDateChange(dateInfo.date)}
              onTouchStart={() => handlePressStart(dateInfo.date)}
              onTouchEnd={handlePressEnd}
              onMouseDown={() => handlePressStart(dateInfo.date)}
              onMouseUp={handlePressEnd}
              onMouseLeave={handlePressEnd}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-w-[70px] relative overflow-hidden ${
                isSelected && isComplete
                  ? 'bg-green-600 text-white shadow-md' // ✅ Complete - GREEN
                  : isSelected
                    ? 'bg-blue-600 text-white shadow-md' // Selected, loading - BLUE
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              } ${longPressDate === dateInfo.date ? 'animate-pulse' : ''}`}
            >
              <div className="text-center">
                <div className={`font-semibold ${
                  isSelected && isComplete ? 'text-white' : isSelected ? 'text-white' : 'text-gray-900'
                }`}>
                  {dateInfo.displayName}
                </div>
                <div className={`text-[10px] ${
                  isSelected && isComplete ? 'text-green-100' : isSelected ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {dateStr && `${dateStr} `}({dateInfo.matchCount})
                </div>
              </div>
              
              {/* 🟢 Progress Bar (only on selected date while loading) */}
              {isSelected && !isComplete && percentage > 0 && percentage < 100 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-800/30">
                  <div 
                    className="h-full bg-green-400 transition-all duration-500 ease-out"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              )}
            </button>
          );
        })}
        
        {/* All Matches Button - After all dates */}
        {onToggleAllMatches && (
          <button
            onClick={onToggleAllMatches}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all w-auto ml-2 relative overflow-hidden ${
              showAllMatches && allMatchesProgress?.isComplete
                ? 'bg-green-600 text-white shadow-md' // Complete - GREEN
                : showAllMatches
                  ? 'bg-blue-600 text-white shadow-md' // Loading - BLUE
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
          >
            {/* Progress Bar (only when All Matches is active and loading) */}
            {showAllMatches && allMatchesProgress && !allMatchesProgress.isComplete && allMatchesProgress.percentage > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-800/30">
                <div 
                  className="h-full bg-green-400 transition-all duration-500 ease-out"
                  style={{ width: `${allMatchesProgress.percentage}%` }}
                />
              </div>
            )}
            
            <div className="text-center" style={{ minHeight: '28px' }}>
              <div className={`font-semibold ${
                showAllMatches && allMatchesProgress?.isComplete ? 'text-white' :
                showAllMatches ? 'text-white' : 'text-gray-900'
              }`}>
                All Matches
              </div>
              {showAllMatches && allMatchesProgress && (
                <div className={`text-[10px] ${
                  allMatchesProgress.isComplete ? 'text-green-100' : 'text-blue-100'
                }`}>
                  ({allMatchesProgress.loaded}/{allMatchesProgress.total})
                </div>
              )}
              {showAllMatches && !allMatchesProgress && (
                <div className="text-[10px] text-blue-100">
                  ({totalMatches})
                </div>
              )}
            </div>
          </button>
        )}
      </div>
    </div>
  );
};

export default DateSelector;
