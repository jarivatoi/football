import React from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

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
  console.log('📅 DateSelector received availableDates:', availableDates);
  console.log('📅 DateSelector availableDates length:', availableDates.length);
  console.log('📅 DateSelector selectedDate:', selectedDate);
  
  // Generate next 7 days if no available dates provided
  const getDefaultDates = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      let displayName = '';
      if (i === 0) displayName = 'Today';
      else if (i === 1) displayName = 'Tomorrow';
      else displayName = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      
      dates.push({
        date: dateString,
        matchCount: 0,
        displayName
      });
    }
    return dates;
  };

  const datesToShow = availableDates.length > 0 ? availableDates : getDefaultDates();
  console.log('📅 DateSelector datesToShow:', datesToShow);
  
  const currentIndex = datesToShow.findIndex(d => d.date === selectedDate);
  console.log('📅 DateSelector currentIndex:', currentIndex);
  
  const goToPrevious = () => {
    if (currentIndex > 0) {
      onDateChange(datesToShow[currentIndex - 1].date);
    }
  };
  
  const goToNext = () => {
    if (currentIndex < datesToShow.length - 1) {
      onDateChange(datesToShow[currentIndex + 1].date);
    }
  };

  const formatDisplayDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  };

  // Format date as DD/MM with zero padding
  const formatDateDisplay = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-800">Select Date</h3>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevious}
            disabled={currentIndex <= 0}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="text-center min-w-[200px]">
            <div className="font-semibold text-gray-900">
              {formatDisplayDate(selectedDate)}
            </div>
            <div className="text-sm text-gray-600">
              {new Date(selectedDate).toLocaleDateString('en-GB')}
            </div>
          </div>
          
          <button
            onClick={goToNext}
            disabled={currentIndex >= datesToShow.length - 1}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Date tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {datesToShow.map((dateInfo) => {
          const isSelected = dateInfo.date === selectedDate;
          const date = new Date(dateInfo.date);
          const isToday = date.toDateString() === new Date().toDateString();
          
          return (
            <button
              key={dateInfo.date}
              onClick={() => {
                console.log('📅 Date tab clicked:', dateInfo.date);
                onDateChange(dateInfo.date);
              }}
              className={`flex-shrink-0 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 min-w-[100px] ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:shadow-md'
              }`}
            >
              <div className="text-center">
                <div className={`font-semibold ${isSelected ? 'text-white' : isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                  {dateInfo.displayName || date.toLocaleDateString('en-GB', { weekday: 'short' })}
                </div>
                <div className={`text-xs ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                  {formatDateDisplay(date)}  {/* Using the new formatting function */}
                </div>
                <div className={`text-xs mt-1 px-2 py-0.5 rounded-full ${
                  isSelected ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600'
                }`}>
                  {dateInfo.matchCount} {dateInfo.matchCount === 1 ? 'Match' : 'Matches'}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Manual date input */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">
            Or select custom date:
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              console.log('📅 Manual date input changed to:', e.target.value);
              onDateChange(e.target.value);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
        
        {/* Debug information */}
        <div className="mt-4 p-3 bg-gray-100 rounded-lg">
          <h4 className="font-medium text-gray-800 mb-2">Debug Info:</h4>
          <div className="text-xs text-gray-600">
            <div>Total dates shown: {datesToShow.length}</div>
            <div>Selected date: {selectedDate}</div>
            <div>Today's date: {new Date().toISOString().split('T')[0]}</div>
            <div>Match counts by date (upcoming only):</div>
            <ul className="list-disc pl-5 mt-1">
              {datesToShow.map(dateInfo => {
                // Calculate upcoming matches for this date
                const now = new Date();
                const upcomingCount = (window as any).__upcomingMatchesByDate?.[dateInfo.date] || dateInfo.matchCount;
                return (
                  <li key={dateInfo.date}>
                    {dateInfo.date}: {upcomingCount} matches
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DateSelector;