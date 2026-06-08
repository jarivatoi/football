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
      <div className="flex gap-2 overflow-x-auto px-3 py-2 max-w-3xl mx-auto scrollbar-hide">
        {datesToShow.map((dateInfo) => {
          const isSelected = dateInfo.date === selectedDate;
          
          // Parse date for compact display
          let dayName = '';
          let dateNum = '';
          let monthName = '';
          
          if (dateInfo.date !== 'beyond') {
            const dateObj = new Date(dateInfo.date);
            dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'short' }); // Mon, Tue, etc.
            dateNum = dateObj.getDate().toString();
            monthName = dateObj.toLocaleDateString('en-GB', { month: 'short' }); // Jun, Jul, etc.
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
                {dateInfo.date === 'beyond' ? (
                  <div className="font-semibold truncate">{dateInfo.displayName}</div>
                ) : (
                  <>
                    <div className={`font-semibold ${
                      isSelected ? 'text-white' : 'text-gray-900'
                    }`}>
                      {dayName}
                    </div>
                    <div className={`text-[10px] ${
                      isSelected ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {dateNum} {monthName} ({dateInfo.matchCount})
                    </div>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DateSelector;
