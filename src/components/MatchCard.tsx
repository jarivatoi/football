import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, X } from 'lucide-react';
import { TotelepepMatch } from '../services/totelepepExtractor';
import { totelepepExtractor } from '../services/totelepepExtractor';

interface MatchCardProps {
  match: TotelepepMatch;
  onPriceClick: (matchId: string, priceType: string, odds: number | string, marketBookNo?: string, marketCode?: string) => void;
  selectedPrices: string[];
}

const MatchCard: React.FC<MatchCardProps> = ({ match, onPriceClick, selectedPrices }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(false);
  const [expandedMarkets, setExpandedMarkets] = useState<Record<string, boolean>>({});
  const [activeMarketTab, setActiveMarketTab] = useState<string>('ALL'); // ALL, FT, HT, 2H

  // Sync selection state when expanding markets
  React.useEffect(() => {
    if (isExpanded && match.allMarkets && match.allMarkets.length > 0) {
      // Auto-expand the 1X2 market if user has a selection from quick odds
      const homeSelected = selectedPrices.includes(`${match.id}-home`);
      const drawSelected = selectedPrices.includes(`${match.id}-draw`);
      const awaySelected = selectedPrices.includes(`${match.id}-away`);
      
      if (homeSelected || drawSelected || awaySelected) {
        // Find the 1X2 market and expand it
        const x2Market = match.allMarkets.find(m => m.name === '1 X 2' || m.marketCode === 'CP');
        if (x2Market) {
          setExpandedMarkets(prev => ({
            ...prev,
            [x2Market.marketBookNo]: true
          }));
        }
      }
    }
  }, [isExpanded, match.allMarkets, match.id, selectedPrices]);

  const toggleExpand = async () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    
    // Lazy load markets when expanding
    if (newState && (!match.allMarkets || match.allMarkets.length === 0) && !isLoadingMarkets) {
      console.log(`🔄 Lazy loading markets for match ${match.id}...`);
      setIsLoadingMarkets(true);
      await totelepepExtractor.fetchMarketsForMatch(match);
      setIsLoadingMarkets(false);
      // Force a re-render by toggling a dummy state
      setExpandedMarkets(prev => ({ ...prev }));
    }
  };

  const toggleMarket = (marketKey: string) => {
    setExpandedMarkets(prev => ({
      ...prev,
      [marketKey]: !prev[marketKey]
    }));
  };

  const isSelected = (priceType: string) => {
    return selectedPrices.includes(`${match.id}-${priceType}`);
  };

  // Check if a market selection matches a quick 1X2 selection
  const isMarketSelectionSelected = (market: any, selectionName: string) => {
    // Check if this is a 1X2 market
    if (market.name === '1 X 2' || market.marketCode === 'CP') {
      // Map selection names to quick 1X2 price types
      if (selectionName === '1' || selectionName === 'Home') {
        return selectedPrices.includes(`${match.id}-home`);
      }
      if (selectionName === 'X' || selectionName === 'Draw') {
        return selectedPrices.includes(`${match.id}-draw`);
      }
      if (selectionName === '2' || selectionName === 'Away') {
        return selectedPrices.includes(`${match.id}-away`);
      }
    }
    // For non-1X2 markets, use the regular check
    return selectedPrices.includes(`${match.id}-${market.marketBookNo}-${selectionName}`);
  };

  const formatTime = (kickoff: string) => {
    return kickoff;
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Match Header - Compact View */}
      <div 
        onClick={toggleExpand}
        className="px-3 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start justify-between">
          {/* Team Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">⚽</span>
              </div>
              <div className="text-sm text-gray-600">{match.league}</div>
            </div>
            
            <div className="space-y-1 ml-7">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">{match.homeTeam}</span>
                <div className="flex items-center gap-2">
                  {match.marketBookNo && (
                    <span className="bg-yellow-400 text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full">
                      {match.marketBookNo}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">{formatDate(match.date)} {formatTime(match.kickoff)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">{match.awayTeam}</span>
              </div>
            </div>
          </div>

          {/* Markets Button */}
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand();
              }}
              className="flex items-center gap-1 bg-yellow-400 text-gray-900 px-2 py-1 rounded text-xs font-medium hover:bg-yellow-500 transition-colors"
            >
              <span>{match.marketCount || 1} Markets</span>
              {isExpanded ? (
                <X className="w-3 h-3 text-red-600" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        {/* Quick 1X2 Odds - Only visible when NOT expanded - 3 lines layout */}
        {!isExpanded && (
          <div className="ml-7 mt-2 space-y-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPriceClick(match.id, 'home', match.homeOdds, match.marketBookNo, match.marketCode);
              }}
              className={`w-full flex items-center justify-between py-1.5 px-3 rounded text-sm transition-all ${
                isSelected('home')
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <span className="font-medium">{match.homeTeam}</span>
              <span className="font-bold">{match.homeOdds}</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPriceClick(match.id, 'draw', match.drawOdds, match.marketBookNo, match.marketCode);
              }}
              className={`w-full flex items-center justify-between py-1.5 px-3 rounded text-sm transition-all ${
                isSelected('draw')
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <span className="font-medium">Draw</span>
              <span className="font-bold">{match.drawOdds}</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPriceClick(match.id, 'away', match.awayOdds, match.marketBookNo, match.marketCode);
              }}
              className={`w-full flex items-center justify-between py-1.5 px-3 rounded text-sm transition-all ${
                isSelected('away')
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <span className="font-medium">{match.awayTeam}</span>
              <span className="font-bold">{match.awayOdds}</span>
            </button>
          </div>
        )}
      </div>

      {/* Expanded Markets Section */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {isLoadingMarkets ? (
            <div className="px-4 py-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <div className="text-sm text-gray-500 mt-2">Loading markets...</div>
            </div>
          ) : !match.allMarkets || match.allMarkets.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              <div className="text-sm">No markets available</div>
              <div className="text-xs mt-1">Market count: {match.marketCount || 'Not set'}</div>
            </div>
          ) : (
            <>
              {/* Market Period Tabs */}
              <div className="flex gap-2 p-3 bg-gray-50 border-b border-gray-200">
                <button
                  onClick={() => setActiveMarketTab('ALL')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                    activeMarketTab === 'ALL'
                      ? 'bg-yellow-400 text-gray-900'
                      : 'bg-blue-900 text-white hover:bg-blue-800'
                  }`}
                >
                  ALL ({match.allMarkets.length})
                </button>
                <button
                  onClick={() => setActiveMarketTab('FT')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                    activeMarketTab === 'FT'
                      ? 'bg-yellow-400 text-gray-900'
                      : 'bg-blue-900 text-white hover:bg-blue-800'
                  }`}
                >
                  FULL TIME ({match.allMarkets.filter(m => m.periodCode === 'FT' || !m.periodCode).length})
                </button>
                <button
                  onClick={() => setActiveMarketTab('HT')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                    activeMarketTab === 'HT'
                      ? 'bg-yellow-400 text-gray-900'
                      : 'bg-blue-900 text-white hover:bg-blue-800'
                  }`}
                >
                  HALF TIME ({match.allMarkets.filter(m => m.periodCode === 'HT' || m.periodCode === 'H1').length})
                </button>
                <button
                  onClick={() => setActiveMarketTab('2H')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                    activeMarketTab === '2H'
                      ? 'bg-yellow-400 text-gray-900'
                      : 'bg-blue-900 text-white hover:bg-blue-800'
                  }`}
                >
                  2ND HALF ({match.allMarkets.filter(m => m.periodCode === '2H' || m.periodCode === 'H2').length})
                </button>
              </div>

              {/* Markets List - Filtered by active tab */}
              {match.allMarkets
                .filter(market => {
                  if (activeMarketTab === 'ALL') return true;
                  if (activeMarketTab === 'FT') return market.periodCode === 'FT' || !market.periodCode;
                  if (activeMarketTab === 'HT') return market.periodCode === 'HT' || market.periodCode === 'H1';
                  if (activeMarketTab === '2H') return market.periodCode === '2H' || market.periodCode === 'H2';
                  return true;
                })
                .map((market, index) => (
            <div key={index} className="border-b border-gray-100">
              <button
                onClick={() => toggleMarket(market.marketBookNo)}
                className="w-full px-3 py-2 bg-gray-100 flex items-center justify-between hover:bg-gray-200 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {expandedMarkets[market.marketBookNo] ? (
                    <X className="w-4 h-4 text-red-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  )}
                  <span className="text-sm font-medium text-gray-900">{market.name}</span>
                  {market.periodCode && market.periodCode !== 'FT' && (
                    <span className="text-xs text-gray-500">({market.periodCode})</span>
                  )}
                </div>
                <span className="text-xs text-gray-500 bg-yellow-400 px-2 py-1 rounded">{market.marketBookNo}</span>
              </button>
              
              {expandedMarkets[market.marketBookNo] && market.selections && market.selections.length > 0 && (
                <div className="px-3 py-2 space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    {market.selections.map((selection, selIndex) => {
                      // Check if this selection is already selected (either from quick 1X2 or from this market)
                      const isSelectedMarket = isMarketSelectionSelected(market, selection.name);
                      
                      return (
                        <button
                          key={selIndex}
                          onClick={() => {
                            // For 1X2 market, use quick 1X2 price types to maintain sync
                            if (market.name === '1 X 2' || market.marketCode === 'CP') {
                              const priceType = selection.name === '1' || selection.name === 'Home' ? 'home' :
                                               selection.name === 'X' || selection.name === 'Draw' ? 'draw' :
                                               selection.name === '2' || selection.name === 'Away' ? 'away' :
                                               `${market.marketBookNo}-${selection.name}`;
                              onPriceClick(match.id, priceType, selection.odds, market.marketBookNo, match.marketCode);
                            } else {
                              onPriceClick(
                                match.id, 
                                `${market.marketBookNo}-${selection.name}`,
                                selection.odds,
                                market.marketBookNo,
                                match.marketCode
                              );
                            }
                          }}
                          className={`flex-1 min-w-[80px] py-2 px-2 rounded text-sm font-medium transition-all ${
                            isSelectedMarket
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          <div className="text-xs text-gray-600">{selection.name}</div>
                          <div className="font-bold">{selection.odds}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MatchCard;
