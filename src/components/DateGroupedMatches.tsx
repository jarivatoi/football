import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import type { TotelepepMatch } from '../services/totelepepExtractor';
import MatchCard from './MatchCard';

interface DateGroupedMatchesProps {
  groupedMatches: Record<string, TotelepepMatch[]>;
  loading: boolean;
  onPriceClick: (matchId: string, priceType: string, odds: number | string) => void;
  selectedPrices: string[];
  apiSourceName?: string; // API source display name for loading message
}

const DateGroupedMatches: React.FC<DateGroupedMatchesProps> = ({ 
  groupedMatches, 
  loading,
  onPriceClick,
  selectedPrices,
  apiSourceName = 'Totelepep' // Default to Totelepep if not provided
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
          <p className="mt-4 text-gray-600">Loading match data from {apiSourceName}...</p>
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
          <div key={date}>
            {/* League Header */}
            <div className="bg-blue-600 text-white px-3 py-2 text-sm font-medium">
              All Soccer
            </div>

            {/* Match Cards */}
            <div>
              {matches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  onPriceClick={onPriceClick}
                  selectedPrices={selectedPrices}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DateGroupedMatches;