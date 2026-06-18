import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, Clock } from 'lucide-react';
import type { TotelepepMatch } from '../services/totelepepExtractor';
import MatchCard from './MatchCard';
import { VirtualScrollManager } from '../utils/virtualScroll';

interface DateGroupedMatchesProps {
  groupedMatches: Record<string, TotelepepMatch[]>;
  loading: boolean;
  onPriceClick: (matchId: string, priceType: string, odds: number | string) => void;
  selectedPrices: string[];
  apiSourceName?: string; // API source display name for loading message
  searchMode?: 'matches' | 'eq' | 'gte' | 'lte' | 'between'; // Search filter mode
  searchTerm?: string; // Search term for odds highlighting
  onMarketsLoaded?: (matchId: string, markets: any[]) => void; // Callback when markets load
}

const DateGroupedMatches: React.FC<DateGroupedMatchesProps> = ({
  groupedMatches, 
  loading,
  onPriceClick,
  selectedPrices,
  apiSourceName = 'Totelepep', // Default to Totelepep if not provided
  searchMode = 'matches',
  searchTerm = '',
  onMarketsLoaded
}) => {
  // Virtualization state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight - 200 : 800; // Subtract header height
  
  // Create virtual scroll manager
  const scrollManagerRef = useRef<VirtualScrollManager | null>(null);
  if (!scrollManagerRef.current) {
    scrollManagerRef.current = new VirtualScrollManager({
      itemHeight: 150, // Average height of match card (px)
      viewportHeight,
      bufferSize: 5 // Load 5 extra above/below viewport
    });
  }

  // Flatten all matches with date info
  const allMatchesWithDates = React.useMemo(() => {
    const sortedDates = Object.keys(groupedMatches).sort();
    const flat: Array<{ match: TotelepepMatch; date: string; globalIndex: number }> = [];
    let index = 0;
    
    sortedDates.forEach(date => {
      groupedMatches[date].forEach(match => {
        flat.push({ match, date, globalIndex: index++ });
      });
    });
    
    // Update scroll manager with total count
    scrollManagerRef.current?.setTotalItems(flat.length);
    
    return flat;
  }, [groupedMatches]);

  // Handle scroll event
  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const newScrollTop = scrollContainerRef.current.scrollTop;
      setScrollTop(newScrollTop);
      scrollManagerRef.current?.handleScroll(newScrollTop);
    }
  }, []);

  // Get visible matches
  const visibleRange = scrollManagerRef.current?.getVisibleRange() || { start: 0, end: 20 };
  const visibleMatches = allMatchesWithDates.slice(visibleRange.start, visibleRange.end + 1);
  
  // Calculate total height for scrollbar
  const totalHeight = scrollManagerRef.current?.getTotalHeight() || 0;
  const startOffset = visibleRange.start * 150; // itemHeight

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
      style={{ height: viewportHeight, overflowY: 'auto', position: 'relative' }}
      className="bg-white rounded-xl shadow-lg"
    >
      {/* Total height spacer for scrollbar */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* Visible matches only */}
        <div style={{ transform: `translateY(${startOffset}px)` }}>
          {visibleMatches.map(({ match, date, globalIndex }) => (
            <MatchCard
              key={`${date}-${match.id}-${globalIndex}`}
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
      
      {/* Loading indicator at bottom */}
      {loading && (
        <div className="p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading more matches...</p>
        </div>
      )}
    </div>
  );
};

export default DateGroupedMatches;