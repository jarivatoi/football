import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Calendar, Clock, Loader, ArrowUpDown, Shuffle } from 'lucide-react';
import type { TotelepepMatch } from '../services/totelepepExtractor';
import MatchCard from './MatchCard';

interface DateGroupedMatchesProps {
  groupedMatches: Record<string, TotelepepMatch[]>;
  loading: boolean;
  onPriceClick: (matchId: string, priceType: string, odds: number | string, marketBookNo?: string, marketCode?: string, marketId?: string, marketLine?: string, periodCode?: string, marketDisplayName?: string, optionCode?: string, optionNo?: string, optionName?: string, selectionId?: string) => void;
  onLongPress?: (matchId: string, priceType: string, odds: number, marketBookNo?: string, marketCode?: string, marketId?: string, marketLine?: string, periodCode?: string, marketDisplayName?: string, optionCode?: string, optionNo?: string, optionName?: string, selectionId?: string) => void;
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
  onLongPress,
  selectedPrices,
  apiSourceName = 'Totelepep', // Default to Totelepep if not provided
  searchMode = 'matches',
  searchTerm = '',
  onMarketsLoaded,
  initialLoadCount = 50, // Show 50 matches initially
  loadMoreCount = 50 // Load 50 more each time
}) => {
  // Sort mode: chronological (by kickoff time) or random
  const [sortMode, setSortMode] = useState<'chronological' | 'random'>('chronological');
  const randomOrderRef = useRef<Map<string, number>>(new Map());

  // Generate stable random order for matches (keyed by match ID)
  const getRandomOrder = (matchId: string): number => {
    if (!randomOrderRef.current.has(matchId)) {
      randomOrderRef.current.set(matchId, Math.random());
    }
    return randomOrderRef.current.get(matchId)!;
  };

  // Regenerate random order when toggling to random
  const handleSortToggle = () => {
    if (sortMode === 'chronological') {
      // Generate new random order
      randomOrderRef.current.clear();
      setSortMode('random');
    } else {
      setSortMode('chronological');
    }
  };
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

  // Flatten all matches with date info for pagination (with sorting applied)
  const allMatchesWithDates = useMemo(() => {
    const flat: Array<{ match: TotelepepMatch; date: string; globalIndex: number }> = [];
    let index = 0;
    
    if (sortMode === 'chronological') {
      // Grouped by date, sorted by kickoff time within each date
      sortedDates.forEach(date => {
        const dateMatches = [...groupedMatches[date]];
        dateMatches.sort((a, b) => (a.kickoff || '').localeCompare(b.kickoff || ''));
        dateMatches.forEach(match => {
          flat.push({ match, date, globalIndex: index++ });
        });
      });
    } else {
      // Random: shuffle ALL matches across ALL dates together
      const allMatches: Array<{ match: TotelepepMatch; date: string }> = [];
      sortedDates.forEach(date => {
        groupedMatches[date].forEach(match => {
          allMatches.push({ match, date });
        });
      });
      // Fisher-Yates shuffle using stable random values
      for (let i = allMatches.length - 1; i > 0; i--) {
        const rA = getRandomOrder(allMatches[i].match.id + '_shuffle');
        const j = Math.floor(rA * (i + 1));
        [allMatches[i], allMatches[j]] = [allMatches[j], allMatches[i]];
      }
      allMatches.forEach(({ match, date }) => {
        flat.push({ match, date: '', globalIndex: index++ }); // date='' for flat rendering
      });
    }
    
    return flat;
  }, [groupedMatches, sortedDates, sortMode]);

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
    
    if (sortMode === 'random') {
      // All matches under a single group (no date separation)
      grouped['_random'] = displayedMatches.map(({ match }) => match);
    } else {
      displayedMatches.forEach(({ match, date }) => {
        if (!grouped[date]) {
          grouped[date] = [];
        }
        grouped[date].push(match);
      });
    }
    
    return grouped;
  }, [displayedMatches, sortMode]);

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
      style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto', overflowX: 'hidden' }}
    >
      {Object.keys(displayedGroupedMatches).map((date) => {
        const matches = displayedGroupedMatches[date];
        const isRandomGroup = date === '_random';
        const dateHeader = isRandomGroup ? '' : formatDateHeader(date);

        return (
          <div key={date}>
            {/* Date Header - Sticky */}
            <div className="sticky top-0 z-10 bg-blue-600 text-white px-3 py-2 text-sm font-medium shadow-md flex items-center justify-between">
              <span>{isRandomGroup ? 'All Matches (Random)' : dateHeader}</span>
              <button
                onClick={handleSortToggle}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-700 hover:bg-blue-800 text-white text-xs transition-colors"
                title={sortMode === 'chronological' ? 'Sort by time' : 'Shuffle randomly'}
              >
                {sortMode === 'chronological' ? (
                  <>
                    <Clock className="w-3.5 h-3.5" />
                    <span>Time</span>
                  </>
                ) : (
                  <>
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Random</span>
                  </>
                )}
              </button>
            </div>

            {/* Match Cards */}
            <div>
              {matches.map((match, index) => (
                <MatchCard
                  key={`${date}-${match.id}-${index}`}
                  match={match}
                  onPriceClick={onPriceClick}
                  onLongPress={onLongPress}
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