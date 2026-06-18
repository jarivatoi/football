import React, { useState, useEffect } from 'react';
import { Clock, PlayCircle, CheckCircle, ChevronDown } from 'lucide-react';
import { MatchData } from '../types/MatchData';
import PriceButton from './PriceButton';
import { matchSpecificExtractor } from '../services/matchSpecificExtractor';

interface MatchTableProps {
  matches: MatchData[];
  loading: boolean;
  onPriceClick: (matchId: string, priceType: string, odds: number) => void;
  selectedPrices: string[];
  showDate?: boolean;
}

const MatchTable: React.FC<MatchTableProps> = ({ 
  matches, 
  loading, 
  onPriceClick, 
  selectedPrices,
  showDate = true 
}) => {
  const [expandedMarkets, setExpandedMarkets] = useState<Record<string, boolean>>({});
  const [selectedMarketCategories, setSelectedMarketCategories] = useState<Record<string, string>>({});
  const [marketOdds, setMarketOdds] = useState<Record<string, any>>({});
  const [loadingMarkets, setLoadingMarkets] = useState<Record<string, boolean>>({});
  const [fetchedMarkets, setFetchedMarkets] = useState<Record<string, boolean>>({}); // Track which markets have been fetched

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'upcoming':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'live':
        return <PlayCircle className="w-4 h-4 text-red-500" />;
      case 'finished':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return 'text-blue-600 bg-blue-50';
      case 'live':
        return 'text-red-600 bg-red-50';
      case 'finished':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const toggleMarketDropdown = (matchId: string) => {
    setExpandedMarkets(prev => ({
      ...prev,
      [matchId]: !prev[matchId]
    }));
  };

  // Function to fetch market odds when a category is selected
  const fetchMarketOdds = async (match: MatchData, category: string) => {
    const matchId = match.id;
    const competitionId = match.competitionId;
    
    // Only fetch odds for special categories if we have competitionId
    if ((category === 'Both Teams To Score' || category === 'Over/Under 2.5') && competitionId) {
      // Check if we've already fetched odds for this match
      if (fetchedMarkets[matchId]) {
        console.log(`📦 Using cached odds for match ${matchId}`);
        return;
      }
      
      // Set loading state for this match
      setLoadingMarkets(prev => ({ ...prev, [matchId]: true }));
      
      try {
        console.log(`🔍 Fetching ${category} odds for match ${matchId} in competition ${competitionId}`);
        
        // Fetch the detailed odds for this match
        const oddsData = await matchSpecificExtractor.extractMatchOdds(matchId, competitionId);
        
        if (oddsData) {
          console.log(`✅ Fetched odds for match ${matchId}:`, oddsData);
          setMarketOdds(prev => ({
            ...prev,
            [matchId]: {
              ...prev[matchId],
              ...oddsData
            }
          }));
          
          // Mark this match as having fetched odds
          setFetchedMarkets(prev => ({
            ...prev,
            [matchId]: true
          }));
        } else {
          console.log(`⚠️ No odds data returned for match ${matchId}`);
        }
      } catch (error) {
        console.error(`❌ Error fetching odds for match ${matchId}:`, error);
      } finally {
        setLoadingMarkets(prev => ({ ...prev, [matchId]: false }));
      }
    }
  };

  const selectMarketCategory = async (match: MatchData, category: string) => {
    const matchId = match.id;
    
    console.log(`🎯 User selected market category "${category}" for match ${match.homeTeam} vs ${match.awayTeam} (${matchId})`);
    
    // Update selected category
    setSelectedMarketCategories(prev => ({
      ...prev,
      [matchId]: category
    }));
    
    // Close the dropdown after selection
    setExpandedMarkets(prev => ({
      ...prev,
      [matchId]: false
    }));
    
    // Fetch odds for the selected category if it's a special category
    if ((category === 'Both Teams To Score' || category === 'Over/Under 2.5') && match.competitionId) {
      console.log(`🔄 Triggering odds fetch for ${category} market`);
      await fetchMarketOdds(match, category);
    } else {
      console.log(`ℹ️  Using default 1X2 odds for category "${category}"`);
    }
  };

  const getMarketCategories = (match: MatchData) => {
    // Default categories if not provided
    if (!match.availableMarkets || match.availableMarkets.length === 0) {
      return ['1X2', 'Over/Under 2.5', 'Both Teams To Score'];
    }
    return match.availableMarkets;
  };

  const renderMarketOdds = (match: MatchData) => {
    const selectedCategory = selectedMarketCategories[match.id] || '1X2';
    const matchOdds = marketOdds[match.id];
    
    console.log(`📊 Rendering odds for match ${match.id} with category "${selectedCategory}"`, {
      matchOdds,
      bttsYes: matchOdds?.bttsYes,
      bttsNo: matchOdds?.bttsNo,
      over25: matchOdds?.over25,
      under25: matchOdds?.under25
    });
    
    switch (selectedCategory) {
      case '1X2':
        return (
          <div className="flex gap-2 justify-center">
            <PriceButton
              odds={match.homeOdds}
              type="home"
              onClick={() => onPriceClick(match.id, 'home', Number(match.homeOdds))}
              selected={selectedPrices.includes(`${match.id}-home`)}
            />
            <PriceButton
              odds={match.drawOdds}
              type="draw"
              onClick={() => onPriceClick(match.id, 'draw', Number(match.drawOdds))}
              selected={selectedPrices.includes(`${match.id}-draw`)}
            />
            <PriceButton
              odds={match.awayOdds}
              type="away"
              onClick={() => onPriceClick(match.id, 'away', Number(match.awayOdds))}
              selected={selectedPrices.includes(`${match.id}-away`)}
            />
          </div>
        );
      case 'Over/Under 2.5':
        // Use fetched odds if available, otherwise fallback to match data
        const overOdds = matchOdds?.over25 !== undefined ? matchOdds.over25 : match.overUnder?.over;
        const underOdds = matchOdds?.under25 !== undefined ? matchOdds.under25 : match.overUnder?.under;
        
        return (
          <div className="flex gap-2 justify-center">
            {loadingMarkets[match.id] ? (
              <div className="flex items-center justify-center w-full">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-sm text-gray-500">Loading odds...</span>
              </div>
            ) : (
              <>
                <PriceButton
                  odds={overOdds}
                  type="over"
                  onClick={() => overOdds && onPriceClick(match.id, 'over', Number(overOdds))}
                  selected={selectedPrices.includes(`${match.id}-over`)}
                  disabled={!overOdds || overOdds === 'N/A'}
                />
                <PriceButton
                  odds={underOdds}
                  type="under"
                  onClick={() => underOdds && onPriceClick(match.id, 'under', Number(underOdds))}
                  selected={selectedPrices.includes(`${match.id}-under`)}
                  disabled={!underOdds || underOdds === 'N/A'}
                />
              </>
            )}
          </div>
        );
      case 'Both Teams To Score':
        // Use fetched odds if available, otherwise fallback to match data
        const bttsYesOdds = matchOdds?.bttsYes !== undefined ? matchOdds.bttsYes : match.bothTeamsScore?.yes;
        const bttsNoOdds = matchOdds?.bttsNo !== undefined ? matchOdds.bttsNo : match.bothTeamsScore?.no;
        
        return (
          <div className="flex gap-2 justify-center">
            {loadingMarkets[match.id] ? (
              <div className="flex items-center justify-center w-full">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-sm text-gray-500">Loading odds...</span>
              </div>
            ) : (
              <>
                <PriceButton
                  odds={bttsYesOdds}
                  type="yes"
                  onClick={() => bttsYesOdds && onPriceClick(match.id, 'btts_yes', Number(bttsYesOdds))}
                  selected={selectedPrices.includes(`${match.id}-btts_yes`)}
                  disabled={!bttsYesOdds || bttsYesOdds === 'N/A'}
                />
                <PriceButton
                  odds={bttsNoOdds}
                  type="no"
                  onClick={() => bttsNoOdds && onPriceClick(match.id, 'btts_no', Number(bttsNoOdds))}
                  selected={selectedPrices.includes(`${match.id}-btts_no`)}
                  disabled={!bttsNoOdds || bttsNoOdds === 'N/A'}
                />
              </>
            )}
          </div>
        );
      default:
        return (
          <div className="flex gap-2 justify-center">
            <PriceButton
              odds={match.homeOdds}
              type="home"
              onClick={() => onPriceClick(match.id, 'home', Number(match.homeOdds))}
              selected={selectedPrices.includes(`${match.id}-home`)}
            />
            <PriceButton
              odds={match.drawOdds}
              type="draw"
              onClick={() => onPriceClick(match.id, 'draw', Number(match.drawOdds))}
              selected={selectedPrices.includes(`${match.id}-draw`)}
            />
            <PriceButton
              odds={match.awayOdds}
              type="away"
              onClick={() => onPriceClick(match.id, 'away', Number(match.awayOdds))}
              selected={selectedPrices.includes(`${match.id}-away`)}
            />
          </div>
        );
    }
  };

  if (loading && matches.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading match data...</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="p-12 text-center">
        <p className="text-gray-500">No matches found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Match</th>
            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Markets</th>
            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Odds</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {matches.map((match) => (
            <tr key={match.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4">
                <div className="space-y-1">
                  <div className="font-semibold text-gray-900">
                    {match.homeTeam} vs {match.awayTeam}
                  </div>
                  <div className="text-sm text-gray-600">{match.league}</div>
                  {match.competitionId && (
                    <div className="text-xs text-gray-500">ID: {match.competitionId}</div>
                  )}
                  <div className="text-sm text-gray-500">
                    {showDate && match.date && (
                      <span className="mr-2">{new Date(match.date).toLocaleDateString('en-GB')}</span>
                    )}
                    {match.kickoff}
                  </div>
                  {match.status === 'live' && (
                    <div className="text-sm font-medium text-red-600">
                      {match.homeScore} - {match.awayScore} ({match.minute}')
                    </div>
                  )}
                </div>
              </td>
              
              <td className="px-6 py-4">
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(match.status)}`}>
                  {getStatusIcon(match.status)}
                  {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
                </div>
              </td>
              
              <td className="px-6 py-4 text-center">
                <div className="flex items-center justify-center gap-2">
                  {match.marketCount !== undefined && match.marketCount > 0 && (
                    <div className="relative">
                      <button
                        onClick={() => toggleMarketDropdown(match.id)}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium hover:bg-blue-200 transition-colors"
                      >
                        <span>{match.marketCount}</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${expandedMarkets[match.id] ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {expandedMarkets[match.id] && (
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                          <div className="py-1">
                            {getMarketCategories(match).map((category) => (
                              <button
                                key={category}
                                onClick={() => selectMarketCategory(match, category)}
                                className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                                  selectedMarketCategories[match.id] === category ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                                }`}
                              >
                                {category}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </td>
              
              <td className="px-6 py-4">
                {renderMarketOdds(match)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MatchTable;