import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import { TotelepepMatch } from '../services/totelepepService';
import MatchTable from './MatchTable';

interface DateGroupedMatchesProps {
  groupedMatches: Record<string, TotelepepMatch[]>;
  loading: boolean;
  onPriceClick: (matchId: string, priceType: string, odds: number) => void;
  selectedPrices: string[];
}

const DateGroupedMatches: React.FC<DateGroupedMatchesProps> = ({ 
  groupedMatches, 
  loading, 
  onPriceClick,
  selectedPrices
}) => {
  const formatDateHeader = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    if (isToday) return 'Today';
    if (isTomorrow) return 'Tomorrow';

    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const sortedDates = Object.keys(groupedMatches).sort();

  if (loading && sortedDates.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading match data from Totelepep...</p>
        </div>
      </div>
    );
  }

  if (sortedDates.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-12 text-center">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No upcoming matches found</p>
          <p className="text-gray-400 text-sm mt-2">Check back later for new fixtures</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {sortedDates.map((date) => {
        const matches = groupedMatches[date];
        const dateHeader = formatDateHeader(date);

        return (
          <div key={date} className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <div className="flex items-center gap-3 text-white">
                <Calendar className="w-5 h-5" />
                <h2 className="text-xl font-semibold">{dateHeader}</h2>
                <span className="text-blue-200 text-sm">
                  ({matches.length} match{matches.length !== 1 ? 'es' : ''})
                </span>
              </div>
              <p className="text-blue-100 text-sm mt-1">
                {new Date(date).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>

            <MatchTable 
              matches={matches} 
              loading={loading}
              onPriceClick={onPriceClick}
              selectedPrices={selectedPrices}
              showDate={false}
            />
          </div>
        );
      })}
    </div>
  );
};

export default DateGroupedMatches;