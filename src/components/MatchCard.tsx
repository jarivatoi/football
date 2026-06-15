import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, X, ChevronsRight } from 'lucide-react';
import { TotelepepMatch } from '../services/totelepepExtractor';
import { totelepepExtractor } from '../services/totelepepExtractor';

interface MatchCardProps {
  match: TotelepepMatch;
  onPriceClick: (matchId: string, priceType: string, odds: number | string, marketBookNo?: string, marketCode?: string, marketId?: string, marketLine?: string, periodCode?: string, marketDisplayName?: string, optionCode?: string, optionNo?: string) => void;
  selectedPrices: string[];
  searchMode?: 'matches' | 'eq' | 'gte' | 'lte' | 'between'; // Search filter mode
  searchTerm?: string; // Search term for odds highlighting
}

const MatchCard: React.FC<MatchCardProps> = ({ match, onPriceClick, selectedPrices, searchMode = 'matches', searchTerm = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(false);
  const [expandedMarkets, setExpandedMarkets] = useState<Record<string, boolean>>({});
  const [activeMarketTab, setActiveMarketTab] = useState<string>('ALL'); // ALL, FT, HT, 2H
  const hasClearedRef = React.useRef(false); // Track if we've already handled the clear

  // Parse advanced filter code (e.g., 120FT, 150H1BTTS, 120FTUO2.5, 150-180H1BTTS)
  const parseFilterCode = (code: string) => {
    if (!code || searchMode === 'matches' && !/\d/.test(code)) return null;
    
    const upper = code.toUpperCase().trim();
    
    // Check for range pattern (e.g., 150-180H1BTTS)
    const isRange = searchMode === 'between' && upper.includes('-');
    let oddsMin: number | undefined;
    let oddsMax: number | undefined;
    let odds: number;
    let afterOdds: string;
    
    if (isRange) {
      // Parse range: 150-180H1BTTS
      const rangeMatch = upper.match(/^(\d{2,3})-(\d{2,3})/);
      if (!rangeMatch) return null;
      
      oddsMin = parseFloat(rangeMatch[1]);
      oddsMax = parseFloat(rangeMatch[2]);
      if (oddsMin > 10) oddsMin = oddsMin / 100;
      if (oddsMax > 10) oddsMax = oddsMax / 100;
      odds = oddsMin; // Use min for compatibility
      afterOdds = upper.slice(rangeMatch[0].length);
    } else {
      // Single odds: 120FT
      const oddsMatch = upper.match(/^(\d{2,3})/);
      if (!oddsMatch) return null;
      
      odds = parseFloat(oddsMatch[1]);
      if (odds > 10) odds = odds / 100;
      afterOdds = upper.slice(oddsMatch[1].length);
    }
    
    // Parse period and market
    let period = 'FT';
    let marketType = '1X2';
    let option: string | undefined;
    let line: string | undefined;
    
    // Check for period codes
    if (afterOdds.startsWith('H1')) {
      period = 'H1';
    } else if (afterOdds.startsWith('H2') || afterOdds.startsWith('2H')) {
      period = 'H2';
    }
    
    const afterPeriod = afterOdds.startsWith('H1') ? afterOdds.slice(2) : 
                        afterOdds.startsWith('H2') ? afterOdds.slice(2) :
                        afterOdds.startsWith('2H') ? afterOdds.slice(2) : afterOdds;
    
    // Check for market types
    if (afterPeriod.startsWith('DC')) {
      marketType = 'DC';
    } else if (afterPeriod.startsWith('UO')) {
      marketType = 'UO';
      // Check for line (e.g., 2.5, 3.5)
      const lineMatch = afterPeriod.slice(2).match(/^(\d+\.\d+)/);
      if (lineMatch) {
        line = lineMatch[1];
      }
    } else if (afterPeriod.startsWith('BTTS')) {
      marketType = 'BTTS';
    } else if (afterPeriod.startsWith('GM')) {
      marketType = 'GM';
    } else if (afterPeriod.startsWith('CS')) {
      marketType = 'CS';
    } else if (afterPeriod.startsWith('WM')) {
      marketType = 'WM';
    } else if (afterPeriod.startsWith('OE')) {
      marketType = 'OE';
    }
    
    // Check for option (H, D, A, O, U)
    const afterMarket = afterPeriod.startsWith('DC') ? afterPeriod.slice(2) :
                        afterPeriod.startsWith('UO') ? (line ? afterPeriod.slice(2 + line.length + 1) : afterPeriod.slice(2)) :
                        afterPeriod.startsWith('BTTS') ? afterPeriod.slice(4) :
                        afterPeriod.startsWith('GM') ? afterPeriod.slice(2) :
                        afterPeriod.startsWith('CS') ? afterPeriod.slice(2) :
                        afterPeriod.startsWith('WM') ? afterPeriod.slice(2) :
                        afterPeriod.startsWith('OE') ? afterPeriod.slice(2) : afterPeriod;
    
    if (afterMarket) {
      if (afterMarket === 'H' || afterMarket === '1') option = 'H';
      else if (afterMarket === 'D' || afterMarket === 'X') option = 'D';
      else if (afterMarket === 'A' || afterMarket === '2') option = 'A';
      else if (afterMarket === 'O' || afterMarket.startsWith('OVER')) option = 'O';
      else if (afterMarket === 'U' || afterMarket.startsWith('UNDER')) option = 'U';
    }
    
    return { 
      odds, 
      oddsMin, 
      oddsMax, 
      isRange, 
      period, 
      marketType, 
      option, 
      line, 
      rawCode: code 
    };
  };

  // Market type detection helpers
  const is1X2Market = (market: any) => {
    return market.name === '1 X 2' || market.name === '1X2' || market.marketCode === 'CP';
  };

  const isDoubleChanceMarket = (market: any) => {
    return market.name.includes('Double Chance') || market.name.includes('DC') || market.marketCode === 'DC';
  };

  const isOverUnderMarket = (market: any) => {
    return market.name.includes('Over/Under') || market.name.includes('O/U') || 
           market.name.includes('Total Goals') || market.marketCode === 'OU';
  };

  const isBTTSMarket = (market: any) => {
    return market.name.includes('Both Teams') || market.name.includes('BTTS') || 
           market.name.includes('GG/NG') || market.marketCode === 'BTTS';
  };

  const isGoalMarket = (market: any) => {
    return market.name.includes('Goal Market') || market.name.includes('GM');
  };

  const isCorrectScoreMarket = (market: any) => {
    return market.name.includes('Correct Score') || market.name.includes('CS');
  };

  const isWinningMarginMarket = (market: any) => {
    return market.name.includes('Winning Margin') || market.name.includes('WM');
  };

  const isOddEvenMarket = (market: any) => {
    return market.name.includes('Odd/Even') || market.name.includes('OE') || 
           market.name.includes('Odd Even');
  };

  const marketMatchesFilter = (market: any, parsed: any) => {
    // Check period
    if (parsed.period === 'FT' && market.periodCode !== 'FT' && !market.periodCode) return false;
    if (parsed.period === 'H1' && market.periodCode !== 'H1') return false;
    if (parsed.period === 'H2' && market.periodCode !== 'H2' && market.periodCode !== '2H') return false;
    
    // Check market type
    switch (parsed.marketType) {
      case '1X2':
        if (!is1X2Market(market)) return false;
        break;
      case 'DC':
        if (!isDoubleChanceMarket(market)) return false;
        break;
      case 'UO':
        if (!isOverUnderMarket(market)) return false;
        // Check line if specified
        if (parsed.line) {
          const marketLine = market.line || market.name.match(/(\d+\.\d+)/)?.[1];
          if (marketLine !== parsed.line) return false;
        }
        break;
      case 'BTTS':
        if (!isBTTSMarket(market)) return false;
        break;
      case 'GM':
        if (!isGoalMarket(market)) return false;
        break;
      case 'CS':
        if (!isCorrectScoreMarket(market)) return false;
        break;
      case 'WM':
        if (!isWinningMarginMarket(market)) return false;
        break;
      case 'OE':
        if (!isOddEvenMarket(market)) return false;
        break;
    }
    
    return true;
  };

  // Sync selection state when expanding markets
  React.useEffect(() => {
    if (isExpanded && match.allMarkets && match.allMarkets.length > 0) {
      
      // Auto-expand the 1X2 market if user has a selection from quick odds
      const homeSelected = selectedPrices.includes(`${match.id}-home`);
      const drawSelected = selectedPrices.includes(`${match.id}-draw`);
      const awaySelected = selectedPrices.includes(`${match.id}-away`);
      
      
      if (homeSelected || drawSelected || awaySelected) {
        // Find the 1X2 market and expand it
        const x2Market = match.allMarkets.find(m => m.name === '1 X 2' || m.name === '1X2' || m.marketCode === 'CP');
        if (x2Market) {
          setExpandedMarkets(prev => ({
            ...prev,
            [x2Market.marketBookNo]: true
          }));
        } else {
        }
      }
    }
  }, [isExpanded, match.allMarkets, match.id, selectedPrices]);

  // Auto-expand markets based on advanced filter code
  React.useEffect(() => {
    if (isExpanded && match.allMarkets && match.allMarkets.length > 0) {
      // If no search term, collapse all auto-expanded markets
      if (!searchTerm || searchMode !== 'matches') {
        setExpandedMarkets({});
        return;
      }
      
      // Try to parse as advanced filter code
      const parsed = parseFilterCode(searchTerm);
      
      if (parsed) {
        // Advanced filter mode
        const newExpandedMarkets: Record<string, boolean> = {};
        
        // Auto-switch market tab based on period
        if (parsed.period === 'H1' && activeMarketTab !== 'HT') {
          setActiveMarketTab('HT');
        } else if (parsed.period === 'H2' && activeMarketTab !== '2H') {
          setActiveMarketTab('2H');
        } else if (parsed.period === 'FT' && activeMarketTab !== 'ALL') {
          setActiveMarketTab('ALL');
        }
        
        // Find and expand matching markets
        const matchingMarkets = match.allMarkets.filter(m => 
          m.selections && m.selections.length > 0 && marketMatchesFilter(m, parsed)
        );
        
        for (const market of matchingMarkets) {
          // Check if this market has any selection matching the target odds
          const hasMatchingOdds = market.selections.some((sel: any) => {
            const selOdds = parseFloat(String(sel.odds));
            if (isNaN(selOdds)) return false;
            
            // Range mode: check if odds fall within range
            if (parsed.isRange && parsed.oddsMin !== undefined && parsed.oddsMax !== undefined) {
              return selOdds >= parsed.oddsMin && selOdds <= parsed.oddsMax;
            }
            
            // Single odds mode: exact match with tolerance
            return Math.abs(selOdds - parsed.odds) < 0.001;
          });
          
          if (hasMatchingOdds) {
            newExpandedMarkets[market.marketBookNo] = true;
          }
        }
        
        setExpandedMarkets(newExpandedMarkets);
      } else {
        // Fall back to old behavior for simple odds filtering
        setExpandedMarkets({});
      }
    }
  }, [isExpanded, match.allMarkets, searchTerm, searchMode, activeMarketTab]);

  // Auto-expand/collapse match card when period filter changes
  React.useEffect(() => {
    if (searchTerm) {
      // Reset the flag when there's a search term
      hasClearedRef.current = false;
      
      const upperSearch = searchTerm.toUpperCase().trim();
      const hasPeriodFilter = upperSearch.endsWith('H1') || upperSearch.endsWith('H2') || 
                              upperSearch.endsWith('H1H') || upperSearch.endsWith('H1D') || upperSearch.endsWith('H1A') ||
                              upperSearch.endsWith('H2H') || upperSearch.endsWith('H2D') || upperSearch.endsWith('H2A');
      
      if (hasPeriodFilter && !isExpanded) {
        // Expand match card when period filter is added
        toggleExpand();
      } else if (!hasPeriodFilter && isExpanded && searchMode !== 'matches') {
        // Collapse match card when period filter is removed (but keep expanded for text search)
        setIsExpanded(false);
        setExpandedMarkets({});
      }
    } else if (!searchTerm && !hasClearedRef.current) {
      // Only collapse ONCE when search is cleared
      hasClearedRef.current = true;
      setIsExpanded(false);
      setExpandedMarkets({});
    }
  }, [searchTerm, searchMode]); // Removed isExpanded from dependencies

  const toggleExpand = async () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    
    // When collapsing, reset all expanded markets
    if (!newState) {
      setExpandedMarkets({});
    }
    
    // Lazy load markets when expanding
    if (newState && (!match.allMarkets || match.allMarkets.length === 0) && !isLoadingMarkets) {
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

  // Check if a market has any selections matching the filter
  const marketHasMatchingOdds = (market: any): boolean => {
    if (searchMode === 'matches' || !searchTerm || !market.selections) return false;
    return market.selections.some((sel: any) => oddsMatchFilter(sel.odds, undefined, market.periodCode));
  };

  // Check if a market selection matches a quick 1X2 selection
  const isMarketSelectionSelected = (market: any, selectionName: string) => {
    // Check if this is a 1X2 market
    if (market.name === '1 X 2' || market.name === '1X2' || market.marketCode === 'CP') {
      const periodCode = market.periodCode || 'FT';
      
      // For Full Time, check quick 1X2 selections
      if (periodCode === 'FT') {
        if (selectionName === '1' || selectionName === 'Home' || selectionName === '1 (Home)' || 
            selectionName === match.homeTeam) {
          return selectedPrices.includes(`${match.id}-home`);
        }
        if (selectionName === 'X' || selectionName === 'Draw' || selectionName === 'X (Draw)') {
          return selectedPrices.includes(`${match.id}-draw`);
        }
        if (selectionName === '2' || selectionName === 'Away' || selectionName === '2 (Away)' ||
            selectionName === match.awayTeam) {
          return selectedPrices.includes(`${match.id}-away`);
        }
      } else {
        // For H1, 2H, etc., check with period-specific priceType
        if (selectionName === '1' || selectionName === 'Home' || selectionName === '1 (Home)' || 
            selectionName === match.homeTeam) {
          return selectedPrices.includes(`${match.id}-home-${periodCode}`);
        }
        if (selectionName === 'X' || selectionName === 'Draw' || selectionName === 'X (Draw)') {
          return selectedPrices.includes(`${match.id}-draw-${periodCode}`);
        }
        if (selectionName === '2' || selectionName === 'Away' || selectionName === '2 (Away)' ||
            selectionName === match.awayTeam) {
          return selectedPrices.includes(`${match.id}-away-${periodCode}`);
        }
      }
    }
    // For non-1X2 markets, check both formats
    return selectedPrices.includes(`${match.id}-${market.marketBookNo}-${selectionName}`) ||
           selectedPrices.includes(`${match.id}-${selectionName}`);
  };

  const formatTime = (kickoff: string) => {
    return kickoff;
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const formatOdds = (odds: number | string) => {
    const num = typeof odds === 'string' ? parseFloat(odds) : odds;
    return num.toFixed(2);
  };

  // Check if an odds value matches the current search filter
  const oddsMatchFilter = (odds: number | string, position?: 'home' | 'draw' | 'away', period?: string): boolean => {
    if (searchMode === 'matches' || !searchTerm) return false;
    
    let targetOdds = parseFloat(searchTerm);
    let positionFilter: 'home' | 'draw' | 'away' | null = null;
    let periodFilter: 'H1' | 'H2' | null = null;
    
    // Check for position suffix (H=Home, D=Draw, A=Away) and period (H1=1st Half, H2=2nd Half)
    const upperSearch = searchTerm.toUpperCase().trim();
    
    // Check for period + position suffix FIRST (H1H, H1D, H1A, H2H, H2D, H2A)
    if (upperSearch.endsWith('H1H') || upperSearch.endsWith('H1D') || upperSearch.endsWith('H1A')) {
      periodFilter = 'H1';
      const withoutPeriodAndPosition = upperSearch.slice(0, -3);
      if (upperSearch.endsWith('H1H')) {
        positionFilter = 'home';
        targetOdds = parseFloat(withoutPeriodAndPosition);
      } else if (upperSearch.endsWith('H1D')) {
        positionFilter = 'draw';
        targetOdds = parseFloat(withoutPeriodAndPosition);
      } else if (upperSearch.endsWith('H1A')) {
        positionFilter = 'away';
        targetOdds = parseFloat(withoutPeriodAndPosition);
      }
    } else if (upperSearch.endsWith('H2H') || upperSearch.endsWith('H2D') || upperSearch.endsWith('H2A')) {
      periodFilter = 'H2';
      const withoutPeriodAndPosition = upperSearch.slice(0, -3);
      if (upperSearch.endsWith('H2H')) {
        positionFilter = 'home';
        targetOdds = parseFloat(withoutPeriodAndPosition);
      } else if (upperSearch.endsWith('H2D')) {
        positionFilter = 'draw';
        targetOdds = parseFloat(withoutPeriodAndPosition);
      } else if (upperSearch.endsWith('H2A')) {
        positionFilter = 'away';
        targetOdds = parseFloat(withoutPeriodAndPosition);
      }
    } else if (upperSearch.endsWith('H1') || upperSearch.endsWith('H2')) {
      // Period only (e.g., 190H1)
      periodFilter = upperSearch.endsWith('H1') ? 'H1' : 'H2';
      targetOdds = parseFloat(upperSearch.slice(0, -2));
    } else if (upperSearch.endsWith('H')) {
      positionFilter = 'home';
      targetOdds = parseFloat(upperSearch.slice(0, -1));
    } else if (upperSearch.endsWith('D')) {
      positionFilter = 'draw';
      targetOdds = parseFloat(upperSearch.slice(0, -1));
    } else if (upperSearch.endsWith('A')) {
      positionFilter = 'away';
      targetOdds = parseFloat(upperSearch.slice(0, -1));
    }
    
    // Handle input like "130" as "1.30" for decimal odds
    if (!isNaN(targetOdds) && targetOdds > 10) {
      targetOdds = targetOdds / 100;
    }
    
    const oddsValue = typeof odds === 'string' ? parseFloat(odds) : odds;
    
    if (isNaN(targetOdds) || isNaN(oddsValue)) return false;
    
    // If period filter is specified (H1/H2), only match All Markets (not quick 1X2)
    // Quick 1X2 has no period parameter, so it should not match period-specific filters
    if (periodFilter && !period) {
      return false; // Quick 1X2 shouldn't match H1/H2 filters
    }
    
    // If period filter is specified, check if it matches
    if (periodFilter && period) {
      const marketPeriod = period.toUpperCase();
      if (periodFilter === 'H1' && marketPeriod !== 'H1') return false;
      // For H2, accept both '2H' and 'H2'
      if (periodFilter === 'H2' && marketPeriod !== '2H' && marketPeriod !== 'H2') return false;
    }
    
    // If position filter is specified, check if it matches
    // For All Markets (position=undefined), we need to check the period+position context
    if (positionFilter) {
      // If position is provided, check directly
      if (position) {
        if (positionFilter !== position) return false;
      }
      // If position is undefined (All Markets), the caller should ensure only the correct position is being checked
      // For now, we allow it to match if odds value matches (the period check above should filter correctly)
    }
    
    if (searchMode === 'eq') {
      return oddsValue === targetOdds;
    } else if (searchMode === 'gte') {
      return oddsValue >= targetOdds;
    } else if (searchMode === 'lte') {
      return oddsValue <= targetOdds;
    } else if (searchMode === 'between') {
      // Parse range for "between" mode
      if (searchTerm.includes('-')) {
        const rangeParts = searchTerm.split('-');
        if (rangeParts.length === 2) {
          let minStr = rangeParts[0].trim();
          let maxStr = rangeParts[1].trim();
          
          // Remove period/position suffixes
          if (maxStr.toUpperCase().endsWith('H1H') || maxStr.toUpperCase().endsWith('H1D') || maxStr.toUpperCase().endsWith('H1A') ||
              maxStr.toUpperCase().endsWith('H2H') || maxStr.toUpperCase().endsWith('H2D') || maxStr.toUpperCase().endsWith('H2A')) {
            maxStr = maxStr.slice(0, -3);
          } else if (maxStr.toUpperCase().endsWith('H1') || maxStr.toUpperCase().endsWith('H2')) {
            maxStr = maxStr.slice(0, -2);
          } else if (maxStr.toUpperCase().endsWith('H') || maxStr.toUpperCase().endsWith('D') || maxStr.toUpperCase().endsWith('A')) {
            maxStr = maxStr.slice(0, -1);
          }
          
          const minOdds = parseFloat(minStr);
          const maxOdds = parseFloat(maxStr);
          
          const adjustedMin = minOdds > 10 ? minOdds / 100 : minOdds;
          const adjustedMax = maxOdds > 10 ? maxOdds / 100 : maxOdds;
          
          return oddsValue >= adjustedMin && oddsValue <= adjustedMax;
        }
      }
      return false;
    }
    
    return false;
  };

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Match Header - Compact View */}
      <div 
        onClick={toggleExpand}
        className="px-3 py-3 cursor-pointer hover:bg-gray-50 transition-colors bg-gray-100"
      >
        {/* League and Markets Button */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">⚽</span>
            </div>
            <div className="text-sm text-gray-700 font-medium">{match.league}</div>
          </div>
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
              
        {/* Match Title */}
        <div className="text-sm font-semibold text-gray-900 mb-1">
          {match.isOutright 
            ? (match.awayTeam ? `${match.homeTeam} - ${match.awayTeam}` : match.homeTeam)
            : `${match.homeTeam} v/s ${match.awayTeam}`}
        </div>
              
        {/* Date/Time and Market Code */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Clock className="w-3 h-3" />
            <span>{formatDate(match.date)} {formatTime(match.kickoff)}</span>
          </div>
          {match.marketBookNo && (
            <span className="bg-yellow-400 text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full">
              {match.marketBookNo}
            </span>
          )}
        </div>
      </div>

        {/* Quick 1X2 Odds - Only visible when NOT expanded and NOT an outright market */}
        {!isExpanded && !match.isOutright && (
          <div className="mt-2 space-y-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPriceClick(match.id, 'home', match.homeOdds, match.marketBookNo, match.marketCode);
              }}
              className={`w-full flex items-center justify-between py-2 px-4 rounded text-sm font-medium transition-all ${
                isSelected('home')
                  ? 'bg-blue-600 text-white'
                  : oddsMatchFilter(match.homeOdds, 'home')
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <span className="flex-1 text-left">{match.homeTeam}</span>
              <span className="font-bold">{formatOdds(match.homeOdds)}</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPriceClick(match.id, 'draw', match.drawOdds, match.marketBookNo, match.marketCode);
              }}
              className={`w-full flex items-center justify-between py-2 px-4 rounded text-sm font-medium transition-all ${
                isSelected('draw')
                  ? 'bg-blue-600 text-white'
                  : oddsMatchFilter(match.drawOdds, 'draw')
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <span className="flex-1 text-left">Draw</span>
              <span className="font-bold">{formatOdds(match.drawOdds)}</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPriceClick(match.id, 'away', match.awayOdds, match.marketBookNo, match.marketCode);
              }}
              className={`w-full flex items-center justify-between py-2 px-4 rounded text-sm font-medium transition-all ${
                isSelected('away')
                  ? 'bg-blue-600 text-white'
                  : oddsMatchFilter(match.awayOdds, 'away')
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <span className="flex-1 text-left">{match.awayTeam}</span>
              <span className="font-bold">{formatOdds(match.awayOdds)}</span>
            </button>
          </div>
        )}

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
            <div key={index} className="border-b border-gray-200 last:border-b-0">
              <button
                onClick={() => toggleMarket(market.marketBookNo)}
                className="w-full px-3 py-2 bg-red-50 flex items-center justify-between hover:bg-red-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {expandedMarkets[market.marketBookNo] ? (
                    <X className={`w-4 h-4 ${marketHasMatchingOdds(market) ? 'text-orange-600' : 'text-red-600'}`} />
                  ) : marketHasMatchingOdds(market) ? (
                    <ChevronsRight className="w-4 h-4 text-orange-600" />
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
                            if (market.name === '1 X 2' || market.name === '1X2' || market.marketCode === 'CP') {
                              const periodCode = market.periodCode || 'FT';
                              
                              // For FT, use simple priceTypes (home, draw, away) for backward compatibility with quick 1X2
                              // For H1, 2H, etc., use period-specific priceTypes
                              const priceTypeSuffix = periodCode === 'FT' ? '' : `-${periodCode}`;
                              
                              const priceType = selection.name === '1' || selection.name === 'Home' || selection.name === '1 (Home)' || selection.name === match.homeTeam ? `home${priceTypeSuffix}` :
                                               selection.name === 'X' || selection.name === 'Draw' || selection.name === 'X (Draw)' ? `draw${priceTypeSuffix}` :
                                               selection.name === '2' || selection.name === 'Away' || selection.name === '2 (Away)' || selection.name === match.awayTeam ? `away${priceTypeSuffix}` :
                                               `${market.marketBookNo}-${selection.name}`;
                              onPriceClick(match.id, priceType, selection.odds, market.marketBookNo, market.marketCode, market.id, market.marketLine, market.periodCode, market.marketDisplayName, selection.optionCode, selection.optionNo);
                            } else {
                              onPriceClick(
                                match.id, 
                                `${market.marketBookNo}-${selection.name}`,
                                selection.odds,
                                market.marketBookNo,
                                market.marketCode,
                                market.id,
                                market.marketLine,
                                market.periodCode,
                                market.marketDisplayName,
                                selection.optionCode,
                                selection.optionNo
                              );
                            }
                          }}
                          className={`flex-1 min-w-[80px] py-2 px-2 rounded text-sm font-medium transition-all ${
                            isSelectedMarket
                              ? 'bg-blue-600 text-white'
                              : oddsMatchFilter(
                                  selection.odds,
                                  selection.name === '1' || selection.name === 'Home' || selection.name === '1 (Home)' || selection.name === match.homeTeam ? 'home' :
                                  selection.name === 'X' || selection.name === 'Draw' || selection.name === 'X (Draw)' ? 'draw' :
                                  selection.name === '2' || selection.name === 'Away' || selection.name === '2 (Away)' || selection.name === match.awayTeam ? 'away' :
                                  undefined,
                                  market.periodCode
                                )
                              ? 'bg-orange-500 text-white'
                              : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          <div className={`text-xs ${isSelectedMarket ? 'text-white' : oddsMatchFilter(
                              selection.odds,
                              selection.name === '1' || selection.name === 'Home' || selection.name === '1 (Home)' || selection.name === match.homeTeam ? 'home' :
                              selection.name === 'X' || selection.name === 'Draw' || selection.name === 'X (Draw)' ? 'draw' :
                              selection.name === '2' || selection.name === 'Away' || selection.name === '2 (Away)' || selection.name === match.awayTeam ? 'away' :
                              undefined,
                              market.periodCode
                            ) ? 'text-white' : 'text-gray-600'}`}>{selection.name}</div>
                          <div className="font-bold">{formatOdds(selection.odds)}</div>
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
