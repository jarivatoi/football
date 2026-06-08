import React from 'react';

interface DateSelectorProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  availableDates?: Array<{ date: string; matchCount: number; displayName: string }>;
}

const DateSelector: React.FC<DateSelectorProps> = ({ 
  selectedDate, 
  onDateChange, 
  availableDates = [] 
}) => {
  // Use API data directly - show exact names from totelepep, max 8 dates for 2x4 grid
  const datesToShow = availableDates.length > 0 ? availableDates.slice(0, 8) : [];

  return (
    <div className="sticky top-14 z-30 bg-white shadow-sm border-b border-gray-200">
      {/* 2x4 Grid Layout */}
      <div className="grid grid-cols-4 gap-1.5 px-3 py-2 max-w-3xl mx-auto">
        {datesToShow.map((dateInfo) => {
          const isSelected = dateInfo.date === selectedDate;
          const dateObj = new Date(dateInfo.date);
          const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          
          return (
            <button
              key={dateInfo.date}
              onClick={() => onDateChange(dateInfo.date)}
              className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="text-center">
                <div className={`font-semibold truncate ${
                  isSelected ? 'text-white' : 'text-gray-900'
                }`}>
                  {dateInfo.displayName}
                </div>
                <div className={`text-[10px] mt-0.5 ${
                  isSelected ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {dateStr}
                </div>
                <div className={`text-[10px] mt-0.5 ${
                  isSelected ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  ({dateInfo.matchCount})
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DateSelector;
