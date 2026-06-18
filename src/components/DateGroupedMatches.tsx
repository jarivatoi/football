import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, Clock, Loader } from 'lucide-react';
import type { TotelepepMatch } from '../services/totelepepExtractor';
import MatchCard from './MatchCard';

interface DateGroupedMatchesProps {
  groupedMatches: Record<string, TotelepepMatch[]>;
  loading: boolean;
  onPriceClick: (matchId: string, priceType: string, odds: number | string) => void;
  selectedPrices: string[];
  apiSourceName?: string; // API source display name for loading message
  searchMode?: 'matches' | 'eq' | 'gte' | 'lte' | 'between'; // Search filter mode
  searchTerm?: string; // Search term for odds highlighting
  onMarketsLoaded?: (matchId: string, markets: any[]) => void; // Callback when markets load
  initialLoadCount?: number; // Number of matches to show initially
  loadMoreCount?: number; // Number of matches to load each time
}

const DateGroupedMatches: React.FC<DateGroupedMatchesProps> = ({
  groupedMatches, 
  loading,
  onPriceClick,
  selectedPrices,
  apiSourceName = 'Totelepep', // Default to Totelepep if not provided
  searchMode = 'matches',
  searchTerm = '',
  onMarketsLoaded,
  initialLoadCount = 50, // Show 50 matches initially
  loadMoreCount = 50 // Load 50 more each time
}) => {
  const formatDateHeader = (dateString: string): string => {
    const date = new Date(dateString);
    
    // Format: DDD dd mmm yyyy (e.g., Thu 11 Jun 2026)
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).replace(/(\d{2})\s/, '$1 ').replace(/^\w{3}\s/, (match) => match.trim() + ' ');
  };

  const sortedDates = Object.keys(groupedMatches).sort();

  // Flatten all matches with date info for pagination
  const allMatchesWithDates = React.useMemo(() => {
    const flat: Array<{ match: TotelepepMatch; date: string; globalIndex: number }> = [];
    let index = 0;
    
    sortedDates.forEach(date => {
      groupedMatches[date].forEach(match => {
        flat.push({ match, date, globalIndex: index++ });
      });
    });
    
    return flat;
  }, [groupedMatches, sortedDates]);

  // Pagination state
  const [displayCount, setDisplayCount] = useState(initialLoadCount);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggered = useRef(false);

  // Get visible matches based on pagination
  const displayedMatches = allMatchesWithDates.slice(0, displayCount);
  const hasMoreMatches = displayCount < allMatchesWithDates.length;

  // Regroup displayed matches by date for rendering
  const displayedGroupedMatches = React.useMemo(() => {
    const grouped: Record<string, TotelepepMatch[]> = {};
    
    displayedMatches.forEach(({ match, date }) => {
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(match);
    });
    
    return grouped;
  }, [displayedMatches]);

  // Handle scroll for infinite loading
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || !hasMoreMatches || isLoadingMore || loadMoreTriggered.current) {
      return;
    }

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    // Trigger load more when user is within 500px of bottom
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    
    if (distanceFromBottom < 500) {
      loadMoreTriggered.current = true;
      setIsLoadingMore(true);
      
      // Simulate small delay for UX (show loading indicator)
      setTimeout(() => {
        setDisplayCount(prev => Math.min(prev + loadMoreCount, allMatchesWithDates.length));
        setIsLoadingMore(false);
        loadMoreTriggered.current = false;
      }, 300);
    }
  }, [hasMoreMatches, isLoadingMore, loadMoreCount, allMatchesWithDates.length]);

  // Reset pagination when matches change
  useEffect(() => {
    setDisplayCount(initialLoadCount);
    loadMoreTriggered.current = false;
  }, [groupedMatches, initialLoadCount]);

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
    <div 
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="space-y-8 pb-4"
      style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}
    >
      {Object.keys(displayedGroupedMatches).map((date) => {
        const matches = displayedGroupedMatches[date];
        const dateHeader = formatDateHeader(date);

        return (
          <div key={date}>
            {/* Date Header - Sticky */}
            <div className="sticky top-0 z-10 bg-blue-600 text-white px-3 py-2 text-sm font-medium shadow-md">
              {dateHeader}
            </div>

            {/* Match Cards */}
            <div>
              {matches.map((match, index) => (
                <MatchCard
                  key={`${date}-${match.id}-${index}`}
                  match={match}
                  onPriceClick={onPriceClick}
                  selectedPrices={selectedPrices}
                  searchMode={searchMode}
                  searchTerm={searchTerm}
                  onMarketsLoaded={onMarketsLoaded}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Loading more indicator */}
      {isLoadingMore && (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader className="w-8 h-8 animate-spin text-blue-600" />
          <p className="mt-3 text-gray-600 font-medium">Loading more matches...</p>
        </div>
      )}

      {/* End of matches indicator */}
      {!hasMoreMatches && displayedMatches.length > 0 && (
        <div className="text-center py-8">
          <div className="inline-block px-6 py-3 bg-gray-100 rounded-full">
            <p className="text-gray-600 font-medium">
              All {displayedMatches.length} matches loaded
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateGroupedMatches;