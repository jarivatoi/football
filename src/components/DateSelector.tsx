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
  // Use API data directly - show exact names from totelepep
  const datesToShow = availableDates.length > 0 ? availableDates.slice(0, 8) : [];
  
  console.log('📅 DateSelector - availableDates:', availableDates);
  console.log('📅 DateSelector - datesToShow:', datesToShow);

  return (
    <div className="bg-white shadow-sm border-b border-gray-200">
      {/* Horizontal Scrolling Row */}
      <div className="flex gap-2 overflow-x-auto px-3 py-1 max-w-3xl mx-auto scrollbar-hide">
        {datesToShow.map((dateInfo) => {
          const isSelected = dateInfo.date === selectedDate;
          
          // Extract date number and month for display (except for Beyond)
          let dateStr = '';
          if (!dateInfo.displayName.includes('Beyond') && !dateInfo.displayName.includes('>>')) {
            const dateObj = new Date(dateInfo.date);
            if (!isNaN(dateObj.getTime())) {
              const day = dateObj.getDate();
              const month = dateObj.toLocaleDateString('en-GB', { month: 'short' });
              dateStr = `${day} ${month}`;
            }
          }
          
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
                  {dateInfo.displayName}
                </div>
                <div className={`text-[10px] ${
                  isSelected ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  {dateStr && `${dateStr} `}({dateInfo.matchCount})
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
