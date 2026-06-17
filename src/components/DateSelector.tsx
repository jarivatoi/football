import React from 'react';

interface DateSelectorProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  availableDates?: Array<{ date: string; matchCount: number; displayName: string }>;
  showAllMatches?: boolean;
  onToggleAllMatches?: () => void;
  totalMatches?: number;
  filteredCounts?: Record<string, number>; // Count of matches matching filter per date
  loadingProgress?: { date: string; loaded: number; total: number } | null; // Loading progress for current date
}

const DateSelector: React.FC<DateSelectorProps> = ({ 
  selectedDate, 
  onDateChange, 
  availableDates = [],
  showAllMatches = false,
  onToggleAllMatches,
  totalMatches = 0,
  filteredCounts = {},
  loadingProgress = null
}) => {
  // Use API data directly - show exact names from totelepep
  const datesToShow = availableDates.length > 0 ? availableDates.slice(0, 8) : [];
  

  return (
    <div className="bg-white shadow-sm border-b border-gray-200">
      {/* Horizontal Scrolling Row */}
      <div className="flex gap-2 overflow-x-auto px-3 py-0 max-w-3xl mx-auto scrollbar-hide">
        {datesToShow.map((dateInfo) => {
          const isSelected = showAllMatches ? false : dateInfo.date === selectedDate;
          
          // Extract date number and month for display
          let dateStr = '';
          const dateObj = new Date(dateInfo.date);
          if (!isNaN(dateObj.getTime())) {
            const day = dateObj.getDate();
            const month = dateObj.toLocaleDateString('en-GB', { month: 'short' });
            dateStr = `${day} ${month}`;
          }
          
          // Get filtered count for this date
          const filteredCount = filteredCounts[dateInfo.date] || 0;
          
          // Check if this date is currently loading
          const isLoading = loadingProgress && loadingProgress.date === dateInfo.date;
          const loadingPercent = isLoading ? Math.round((loadingProgress.loaded / loadingProgress.total) * 100) : 0;
          
          return (
            <button
              key={dateInfo.date}
              onClick={() => onDateChange(dateInfo.date)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-w-[70px] ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="text-center">
                <div className={`font-semibold ${
                  isSelected ? 'text-white' : 'text-gray-900'
                }`}>
                  {isLoading ? `${loadingPercent}%` : dateInfo.displayName}
                </div>
                <div className={`text-[10px] ${
                  isSelected ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {!isLoading && dateStr && `${dateStr} `}
                  {/* Show both total count and filtered count */}
                  <span>({dateInfo.matchCount})</span>
                  {filteredCount > 0 && (
                    <span className="text-black font-semibold ml-0.5">({filteredCount})</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
        
        {/* All Matches Button - After all dates */}
        {onToggleAllMatches && (
          <button
            onClick={onToggleAllMatches}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-w-[90px] ${
              showAllMatches
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <div className="text-center" style={{ minHeight: '28px' }}>
              <div className={`font-semibold ${
                showAllMatches ? 'text-white' : 'text-gray-900'
              }`}>
                All Matches
              </div>
              {showAllMatches && (
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
