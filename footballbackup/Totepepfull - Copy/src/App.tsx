import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, Calendar, AlertCircle, Calculator, Database, Lightbulb, Trash2, Play, Pause } from 'lucide-react';
import { Target, Ticket } from 'lucide-react';
import DateGroupedMatches from './components/DateGroupedMatches';
import DateSelector from './components/DateSelector';
import Header from './components/Header';
import StatsCards from './components/StatsCards';
import ParlayBuilder, { ParlaySelection } from './components/ParlayBuilder';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import DataExtractor from './components/DataExtractor';
import EndpointDiscovery from './components/EndpointDiscovery';
import ResponseAnalyzer from './components/ResponseAnalyzer';
import AlternativeSolutions from './components/AlternativeSolutions';
import MatchSpecificTester from './components/MatchSpecificTester';
import BetPlacementAnalyzer from './components/BetPlacementAnalyzer';
import BookingDiscoveryGuide from './components/BookingDiscoveryGuide';
import CompetitionExtractor from './components/CompetitionExtractor';
import { totelepepService } from './services/totelepepService';
import type { TotelepepMatch } from './services/totelepepExtractor';
import { supabaseService } from './services/supabaseService';
import { matchSpecificExtractor } from './services/matchSpecificExtractor';
import { realTimeSyncService } from './services/realTimeSyncService';
import { continuousSyncService } from './services/continuousSyncService';
import { registerServiceWorker, requestNotificationPermission, scheduleBackgroundSync } from './utils/pwaUtils';

// Helper function to get today's date in local timezone
const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Add a safety check for React hooks
const useSafeState = <T,>(initialState: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  // Check if we're in a browser environment and React is properly initialized
  if (typeof window === 'undefined' || !React || !React.useState) {
    return [initialState, (() => {}) as React.Dispatch<React.SetStateAction<T>>];
  }
  
  try {
    return React.useState(initialState);
  } catch (error) {
    console.warn('Error initializing state:', error);
    return [initialState, (() => {}) as React.Dispatch<React.SetStateAction<T>>];
  }
};

// Add a safety check for useEffect
const useSafeEffect = (effect: React.EffectCallback, deps?: React.DependencyList) => {
  // Check if we're in a browser environment and React is properly initialized
  if (typeof window === 'undefined' || !React || !React.useEffect) {
    return;
  }
  
  try {
    React.useEffect(effect, deps);
  } catch (error) {
    console.warn('Error initializing effect:', error);
  }
};

function App() {
  // Add a simple test to see if the component is rendering
  console.log('App component is rendering');
  
  // Log Supabase service status
  console.log(' Supabase service status in App:');
  console.log('  supabaseService:', supabaseService);
  
  // Use safe state initialization
  const [matches, setMatches] = useSafeState<TotelepepMatch[]>([]);
  const [groupedMatches, setGroupedMatches] = useSafeState<Record<string, TotelepepMatch[]>>({});
  const [loading, setLoading] = useSafeState(false);
  const [error, setError] = useSafeState<string | null>(null);
  const [searchTerm, setSearchTerm] = useSafeState('');
  const [lastUpdated, setLastUpdated] = useSafeState<Date>(new Date());
  const [parlaySelections, setParlaySelections] = useSafeState<ParlaySelection[]>([]);
  const [showExtractor, setShowExtractor] = useSafeState(false);
  const [showEndpointDiscovery, setShowEndpointDiscovery] = useSafeState(false);
  const [showResponseAnalyzer, setShowResponseAnalyzer] = useSafeState(false);
  const [showAlternatives, setShowAlternatives] = useSafeState(false);
  const [showMatchTester, setShowMatchTester] = useSafeState(false);
  const [showBetAnalyzer, setShowBetAnalyzer] = useSafeState(false);
  const [showBookingGuide, setShowBookingGuide] = useSafeState(false);
  const [showCompetitionExtractor, setShowCompetitionExtractor] = useSafeState(false);
  const [selectedDate, setSelectedDate] = useSafeState<string>(getTodayDate());
  const [lastScrapeTime, setLastScrapeTime] = useSafeState<number>(0); // Track last scrape time
  const [syncServiceAvailable, setSyncServiceAvailable] = useSafeState<boolean>(false);
  const [isOnline, setIsOnline] = useSafeState<boolean>(true);
  const [availableDates, setAvailableDates] = useSafeState<Array<{date: string, matchCount: number, displayName: string}>>([]);
  const [calendarList, setCalendarList] = useSafeState<Array<{date: string, matchCount: number, displayName: string}>>([]);
  const [supabaseMatchCounts, setSupabaseMatchCounts] = useSafeState<Record<string, number>>({});
  const [supabaseDebugInfo, setSupabaseDebugInfo] = useSafeState<string>('');
  const [isSyncPaused, setIsSyncPaused] = useSafeState<boolean>(false); // New state for pausing sync

  // Initialize online status
  useSafeEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Initialize PWA features and real-time sync service
  useSafeEffect(() => {
    registerServiceWorker();
    requestNotificationPermission();
    scheduleBackgroundSync();
    
    // Start real-time sync
    if (!isSyncPaused) {
      realTimeSyncService?.startRealTimeSync();
    }
    
    // Start continuous sync for all matches
    if (!isSyncPaused) {
      continuousSyncService?.startContinuousSync();
    }
    
    // Clear old matches on startup
    if (supabaseService && !isSyncPaused) {
      console.log('🧹 Clearing old matches on startup...');
      supabaseService.clearOldMatches().catch(console.error);
    }
    
    // Check if sync service is available
    const checkSyncService = async () => {
      // Check if realTimeSyncService exists before calling methods on it
      if (realTimeSyncService) {
        const available = await realTimeSyncService.isSyncServiceAvailable();
        setSyncServiceAvailable(available);
        console.log(`📡 Sync service availability: ${available ? 'Available' : 'Not available'}`);
      } else {
        setSyncServiceAvailable(false);
        console.log('⚠️ Real-time sync service not available');
      }
    };
    
    checkSyncService();
    
    // Listen for real-time updates
    const handleMatchUpdate = (event: CustomEvent) => {
      console.log('📥 Received real-time match update:', event.detail);
      
      // Check if the update is relevant to the currently selected date
      const updateDate = event.detail?.date;
      if (updateDate) {
        // If the update is for the currently selected date, refresh the data
        if (updateDate === selectedDate) {
          console.log(`🔄 Refreshing data for selected date: ${selectedDate}`);
          loadData(selectedDate);
        } else {
          console.log(`ℹ️ Update is for date ${updateDate}, but currently viewing ${selectedDate}. Not refreshing.`);
        }
      } else {
        // If we can't determine the date, do not automatically refresh
        // This prevents unwanted navigation to today's matches
        console.log('⚠️ Date information not available in update. Not refreshing to preserve current view.');
      }
    };
    
    window.addEventListener('matchUpdate', handleMatchUpdate as EventListener);
    
    // Cleanup on unmount
    return () => {
      realTimeSyncService?.stopRealTimeSync();
      continuousSyncService?.stopContinuousSync();
      window.removeEventListener('matchUpdate', handleMatchUpdate as EventListener);
    };
  }, [selectedDate, isSyncPaused]); // Add isSyncPaused to dependencies
  
  const loadData = async (targetDate?: string) => {
    setLoading(true);
    setError(null);
    const dateToFetch = targetDate || selectedDate;
    try {
      console.log('🔍 Fetching data from Supabase for date:', dateToFetch);
      
      // Fetch matches from Supabase
      const fetchedMatches = await supabaseService?.getMatches(dateToFetch) || [];
      
      // Sort matches by date and time
      const sortedMatches = fetchedMatches.sort((a, b) => {
        // First sort by date
        const dateComparison = new Date(a.date || '').getTime() - new Date(b.date || '').getTime();
        if (dateComparison !== 0) return dateComparison;
        
        // Then sort by kickoff time
        return a.kickoff.localeCompare(b.kickoff);
      });
      
      setMatches(sortedMatches);
      
      // Group matches by date
      const grouped = totelepepService.groupMatchesByDate(sortedMatches);
      setGroupedMatches(grouped);
      
      setLastUpdated(new Date());
      console.log(`✅ Loaded ${sortedMatches.length} matches from Supabase for ${dateToFetch}`);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data from Supabase.');
    } finally {
      setLoading(false);
    }
  };

  // Load calendar list data
  const loadCalendarList = async () => {
    try {
      console.log('📅 Fetching calendar list data from Totelepep API...');
      const calendarData = await totelepepService.getAvailableDatesWithCounts();
      setCalendarList(calendarData);
      console.log('📅 Calendar list data loaded:', calendarData);
    } catch (error) {
      console.error('Error loading calendar list:', error);
      setError('Failed to load calendar data from Totelepep API.');
    }
  };

  // Load Supabase match counts
  const loadSupabaseMatchCounts = async () => {
    try {
      console.log('📊 Fetching match counts from Supabase...');
      if (supabaseService) {
        const counts = await supabaseService.getMatchCountsByDate();
        setSupabaseMatchCounts(counts);
        console.log('📊 Supabase match counts loaded:', counts);
      }
    } catch (error) {
      console.error('Error loading Supabase match counts:', error);
    }
  };

  // Function to force a complete data refresh
  const forceCompleteRefresh = async () => {
    try {
      console.log('🔄 Starting complete data refresh...');
      setLoading(true);
      setError(null);
      
      // Clear all caches
      totelepepService.clearCache();
      // matchSpecificExtractor has a clearCache method
      if ((matchSpecificExtractor as any).clearCache) {
        (matchSpecificExtractor as any).clearCache();
      }
      
      // Clear old matches from Supabase
      if (supabaseService) {
        console.log('🧹 Clearing old matches from Supabase...');
        await supabaseService.clearOldMatches();
      }
      
      // Fetch fresh data from Totelepep
      console.log('🔍 Fetching fresh data from Totelepep...');
      const allMatches = await totelepepService.getMatches();
      
      // Debug: Log the fetched matches
      console.log(`📊 Fetched ${allMatches.length} matches from Totelepep`);
      console.log('📄 Sample of fetched matches:', allMatches.slice(0, 5));
      
      // Group matches by date to see the distribution
      const matchesByDate: Record<string, number> = {};
      allMatches.forEach(match => {
        const date = match.date || 'unknown';
        matchesByDate[date] = (matchesByDate[date] || 0) + 1;
      });
      
      console.log('📅 Matches by date from Totelepep:');
      Object.entries(matchesByDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([date, count]) => {
          console.log(`   ${date}: ${count} matches`);
        });
      
      // Remove duplicates
      const uniqueMatches = allMatches.filter((match, index, self) => 
        index === self.findIndex(m => m.id === match.id)
      );
      
      console.log(`📊 After deduplication: ${uniqueMatches.length} unique matches from Totelepep`);
      
      // Store in Supabase
      if (supabaseService && uniqueMatches.length > 0) {
        console.log('🔄 Storing matches in Supabase...');
        const success = await supabaseService.storeMatches(uniqueMatches);
        
        if (success) {
          console.log('✅ Successfully stored matches in Supabase');
        } else {
          console.error('❌ Failed to store matches in Supabase');
          setError('Failed to store matches in Supabase. Please try again.');
          setLoading(false);
          return;
        }
      } else if (!supabaseService) {
        console.log('⚠️ Supabase service not configured, skipping storage');
      } else {
        console.log('ℹ️ No matches to store in Supabase');
      }
      
      // Reload all data
      await loadData(selectedDate);
      await loadCalendarList();
      await loadSupabaseMatchCounts();
      
      console.log('✅ Complete data refresh finished successfully');
    } catch (error) {
      console.error('❌ Error during complete data refresh:', error);
      setError('Failed to refresh data. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  // Load data when selected date changes
  useSafeEffect(() => {
    console.log('📅 Selected date changed to:', selectedDate);
    // Load data when selected date changes
    loadData(selectedDate);
    // Also load calendar list data
    loadCalendarList();
    // Load Supabase match counts
    loadSupabaseMatchCounts();
  }, [selectedDate]); // Only run when selectedDate changes, not on every render

  // Filter matches and maintain grouping
  const filteredGroupedMatches = React.useMemo ? React.useMemo(() => {
    if (!searchTerm) return groupedMatches;
    
    const filtered: Record<string, TotelepepMatch[]> = {};
    
    Object.entries(groupedMatches).forEach(([date, dateMatches]) => {
      const filteredDateMatches = (dateMatches as TotelepepMatch[]).filter(match =>
        match.homeTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
        match.awayTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
        match.league.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      if (filteredDateMatches.length > 0) {
        filtered[date] = filteredDateMatches;
      }
    });
    
    return filtered;
  }, [groupedMatches, searchTerm]) : groupedMatches;

  const totalMatches = matches.length;
  const totalFilteredMatches = Object.values(filteredGroupedMatches)
    .reduce((sum, dateMatches) => sum + (dateMatches as TotelepepMatch[]).length, 0);
  
  // Get available dates with match counts from Totelepep API calendarList data
  const availableDatesWithCounts = React.useMemo ? React.useMemo(() => {
    console.log('📅 Using calendar list data from Totelepep API for date tabs...');
    console.log('📅 Calendar list data:', calendarList);
    
    // Use the calendarList data directly - this is the source of truth
    if (calendarList && calendarList.length > 0) {
      console.log('📅 Using Totelepep calendar list as source of truth');
      return calendarList;
    }
    
    // Fallback to local calculation if calendarList is not available
    console.log('⚠️ Calendar list not available, falling back to local calculation');
    
    // Get all unique dates from the matches
    const dates = new Set<string>();
    matches.forEach(match => {
      if (match.date) {
        dates.add(match.date);
      }
    });
    
    // Convert to array and sort
    const sortedDates = Array.from(dates).sort();
    
    // Create date objects with match counts
    const result = sortedDates.map(dateString => {
      const date = new Date(dateString);
      // Count from local matches as fallback
      const matchCount = matches.filter(match => match.date === dateString).length;
      
      let displayName = '';
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      
      if (date.toDateString() === today.toDateString()) {
        displayName = 'Today';
      } else if (date.toDateString() === tomorrow.toDateString()) {
        displayName = 'Tomorrow';
      } else {
        displayName = date.toLocaleDateString('en-GB', { 
          weekday: 'short', 
          day: 'numeric', 
          month: 'short' 
        });
      }
      
      console.log(`📅 Date ${dateString}: Local count = ${matches.filter(match => match.date === dateString).length}, Final count = ${matchCount}`);
      
      return {
        date: dateString,
        matchCount,
        displayName
      };
    });
    
    console.log('📅 Available dates with counts (fallback):', result);
    return result;
  }, [calendarList, matches]) : [];

  // Debug: Log grouped matches to see what dates we have
  useSafeEffect(() => {
    console.log('📅 Available dates in groupedMatches:', Object.keys(groupedMatches));
    console.log('📊 Matches per date:', Object.entries(groupedMatches).map(([date, matches]) => `${date}: ${(matches as TotelepepMatch[]).length}`));
  }, [groupedMatches]);

  const handlePriceClick = (matchId: string, priceType: string, odds: number | string) => {
    // Find the match details
    const match = matches.find(m => m.id === matchId);
    if (match) {
      // Check if this selection already exists
      const existingIndex = parlaySelections.findIndex(
        s => s.matchId === matchId && s.priceType === priceType
      );
    
      if (existingIndex >= 0) {
        // Remove existing selection
        setParlaySelections(prev => prev.filter((_, index) => index !== existingIndex));
      } else {
        // Log match data for debugging
        console.log('🔍 Adding selection from match:', match);
        console.log(`🔍 Price type: ${priceType}, Odds: ${odds}`);
        
        // Validate market data before adding to parlay
        // Use similar validation logic as in ParlayBuilder
        console.log(`🔍 App.tsx - match data:`, match);
        console.log(`🔍 App.tsx - match.marketBookNo:`, match.marketBookNo);
        console.log(`🔍 App.tsx - match.id:`, match.id);
        const hasUsableMarketBookNo = match.marketBookNo && match.marketBookNo !== 'undefined' && match.marketBookNo !== 'null' && match.marketBookNo.trim() !== '' && match.marketBookNo.trim() !== '0' && !isNaN(Number(match.marketBookNo)) && Number(match.marketBookNo) > 0;
        
        // Additional validation for 7-digit market IDs which are common
        const isLikelyValidMarketId = hasUsableMarketBookNo && match.marketBookNo &&
          ((match.marketBookNo.length === 7 && Number(match.marketBookNo) > 1000000 && Number(match.marketBookNo) < 9999999) ||
           (match.marketBookNo.length === 6 && Number(match.marketBookNo) > 100000 && Number(match.marketBookNo) < 999999) ||
           (match.marketBookNo.length === 8 && Number(match.marketBookNo) > 10000000 && Number(match.marketBookNo) < 99999999));
        
        const marketBookNo = hasUsableMarketBookNo ? match.marketBookNo : (match.id || undefined);
        
        const marketCode = (match.marketCode && match.marketCode !== 'undefined' && match.marketCode !== 'null' && match.marketCode.trim() !== '') 
          ? match.marketCode 
          : 'CP';
        
        // Debug the final values
        console.log(`🔍 App.tsx - hasUsableMarketBookNo: ${hasUsableMarketBookNo}`);
        console.log(`🔍 App.tsx - isLikelyValidMarketId: ${isLikelyValidMarketId}`);
        console.log(`🔍 App.tsx - final marketBookNo:`, marketBookNo);
        console.log(`🔍 App.tsx - final marketCode:`, marketCode);
      
        // Add new selection
        const newSelection: ParlaySelection = {
          matchId,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          priceType,
          odds,
          league: match.league,
          kickoff: match.kickoff,
          competitionId: match.competitionId,
          marketBookNo: marketBookNo,
          marketCode: marketCode,
        };
        
        console.log(`🔍 App.tsx - newSelection with market data:`, newSelection);
        
        // Debug specific match data
        if (match.homeTeam && match.awayTeam) {
          console.log(`🎯 MATCH SELECTION DEBUG: ${match.homeTeam} vs ${match.awayTeam}`);
          console.log(`   matchId:`, match.id);
          console.log(`   marketBookNo:`, match.marketBookNo);
          console.log(`   marketCode:`, match.marketCode);
          console.log(`   competitionId:`, match.competitionId);
          console.log(`   Final selection marketBookNo:`, marketBookNo);
          console.log(`   hasUsableMarketBookNo:`, hasUsableMarketBookNo);
          console.log(`   isLikelyValidMarketId:`, isLikelyValidMarketId);
          
          // Additional validation debugging
          if (match.marketBookNo) {
            console.log(`🔍 MARKETBOOKNO VALIDATION:`, {
              value: match.marketBookNo,
              type: typeof match.marketBookNo,
              length: match.marketBookNo.length,
              isNumeric: !isNaN(Number(match.marketBookNo)),
              numericValue: Number(match.marketBookNo),
              isValid: !isNaN(Number(match.marketBookNo)) && Number(match.marketBookNo) > 0,
              // Special check for the correct value
              isExactMatch: match.marketBookNo === '5160495'
            });
            
            // Special handling for the correct marketBookNo
            if (match.marketBookNo === '5160495') {
              console.log(`🎯 FOUND EXACT MATCH MARKETBOOKNO for match ${match.homeTeam} vs ${match.awayTeam}!`);
            }
          }
        }
      
        console.log('📋 New selection with market data:', newSelection);
        setParlaySelections(prev => [...prev, newSelection]);
      }
    }
  };

  const handleRemoveSelection = (matchId: string) => {
    setParlaySelections(prev => prev.filter(s => s.matchId !== matchId));
  };

  const handleRemoveSelectionByMatch = (matchId: string) => {
    setParlaySelections(prev => prev.filter(s => s.matchId !== matchId));
  };

  const handleClearAll = () => {
    setParlaySelections([]);
  };
  const handleDataExtracted = (extractedData: any[]) => {
    // Convert extracted data to TotelepepMatch format
    const convertedMatches: TotelepepMatch[] = extractedData.map(match => ({
      ...match,
      // Ensure all required fields are present
      overUnder: match.overUnder || { over: 1.85, under: 1.85, line: 2.5 },
      bothTeamsScore: match.bothTeamsScore || { yes: 1.70, no: 2.10 }
    }));

    setMatches(convertedMatches);
    
    // Group matches by date
    const grouped = totelepepService.groupMatchesByDate(convertedMatches);
    setGroupedMatches(grouped);
    
    setLastUpdated(new Date());
    setError(null);
    setShowExtractor(false);
  };

  const handleDateChange = (newDate: string) => {
    console.log('📅 Date changed to:', newDate);
    setSelectedDate(newDate);
    // loadData will be called automatically by useEffect
  };

  // Function to test Supabase operations
  const testSupabaseOperations = async () => {
    try {
      console.log('🔍 Testing Supabase operations...');
      
      if (!supabaseService) {
        console.error('❌ Supabase service not available');
        return;
      }
      
      // Test 1: Get current match count
      console.log('\n--- Test 1: Current match count ---');
      const initialCount = await supabaseService.getMatchCount();
      console.log(`✅ Initial match count: ${initialCount}`);
      
      // Test 2: Try to delete all matches
      console.log('\n--- Test 2: Deleting all matches ---');
      const resetSuccess = await supabaseService.resetMatchesTable();
      if (resetSuccess) {
        console.log('✅ Successfully reset matches table');
      } else {
        console.error('❌ Failed to reset matches table');
      }
      
      // Test 3: Get match count after deletion
      console.log('\n--- Test 3: Match count after deletion ---');
      const afterDeleteCount = await supabaseService.getMatchCount();
      console.log(`✅ Match count after deletion: ${afterDeleteCount}`);
      
      // Test 4: Try to insert a test match
      console.log('\n--- Test 4: Inserting test match ---');
      const testMatch = {
        id: 'test_' + Date.now(),
        homeTeam: 'Test Home Team',
        awayTeam: 'Test Away Team',
        league: 'Test League',
        date: new Date().toISOString().split('T')[0],
        kickoff: '15:00',
        status: 'upcoming',
        competitionId: 'test_competition'
      } as TotelepepMatch;
      
      const storeSuccess = await supabaseService.storeMatches([testMatch]);
      if (storeSuccess) {
        console.log('✅ Successfully stored test match');
      } else {
        console.error('❌ Failed to store test match');
      }
      
      // Test 5: Get match count after insertion
      console.log('\n--- Test 5: Match count after insertion ---');
      const afterInsertCount = await supabaseService.getMatchCount();
      console.log(`✅ Match count after insertion: ${afterInsertCount}`);
      
      // Test 6: Clean up test match
      console.log('\n--- Test 6: Cleaning up test match ---');
      const cleanupSuccess = await supabaseService.resetMatchesTable();
      if (cleanupSuccess) {
        console.log('✅ Successfully cleaned up test match');
      } else {
        console.error('❌ Failed to clean up test match');
      }
      
      console.log('\n🎉 All tests completed!');
      console.log(`📊 Summary: Started with ${initialCount} matches, ended with ${afterInsertCount} matches`);
      
    } catch (error) {
      console.error('❌ Error during Supabase tests:', error);
    }
  };

  // Function to run comprehensive Supabase debug
  const runComprehensiveSupabaseDebug = async () => {
    try {
      console.log('🔍 Running comprehensive Supabase debug...');
      
      if (!supabaseService) {
        console.error('❌ Supabase service not available');
        return;
      }
      
      // Get all matches and show sample
      console.log('\n--- Current Supabase Data ---');
      const allMatches = await supabaseService.getAllMatches();
      console.log(`📊 Total matches in Supabase: ${allMatches.length}`);
      
      if (allMatches.length > 0) {
        console.log('📄 First 3 matches:');
        console.log(JSON.stringify(allMatches.slice(0, 3), null, 2));
        
        // Group by date
        const matchesByDate: Record<string, number> = {};
        allMatches.forEach(match => {
          const date = match.date || 'unknown';
          matchesByDate[date] = (matchesByDate[date] || 0) + 1;
        });
        
        console.log('\n📅 Matches by date:');
        Object.entries(matchesByDate)
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([date, count]) => {
            console.log(`   ${date}: ${count} matches`);
          });
      }
      
      // Test specific operations
      console.log('\n--- Testing Supabase Operations ---');
      
      // Test reset
      console.log('🗑️ Testing table reset...');
      const resetResult = await supabaseService.resetMatchesTable();
      console.log(`✅ Reset result: ${resetResult ? 'Success' : 'Failed'}`);
      
      // Verify reset
      const countAfterReset = await supabaseService.getMatchCount();
      console.log(`📊 Match count after reset: ${countAfterReset}`);
      
      console.log('\n✅ Comprehensive Supabase debug completed!');
      
    } catch (error) {
      console.error('❌ Error during comprehensive Supabase debug:', error);
    }
  };

  // Function to get Supabase debug information
  const getSupabaseDebugInfo = async () => {
    try {
      if (supabaseService) {
        const matchCount = await supabaseService.getMatchCount();
        const dateCounts = await supabaseService.getMatchCountsByDate();
        
        let debugInfo = `Total matches: ${matchCount}\n\nMatches by date:\n`;
        Object.entries(dateCounts)
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([date, count]) => {
            debugInfo += `${date}: ${count} matches\n`;
          });
        
        setSupabaseDebugInfo(debugInfo);
      }
    } catch (error) {
      setSupabaseDebugInfo(`Error fetching debug info: ${error}`);
    }
  };

  // Function to toggle sync pause/resume
  const toggleSyncPause = () => {
    const newPauseState = !isSyncPaused;
    setIsSyncPaused(newPauseState);
    
    if (newPauseState) {
      console.log('⏸️ Pausing sync operations...');
      realTimeSyncService?.stopRealTimeSync();
      continuousSyncService?.stopContinuousSync();
      // Pause match-specific extractor
      if ((matchSpecificExtractor as any).pauseScraping) {
        (matchSpecificExtractor as any).pauseScraping();
      }
    } else {
      console.log('▶️ Resuming sync operations...');
      realTimeSyncService?.startRealTimeSync();
      continuousSyncService?.startContinuousSync();
      // Resume match-specific extractor
      if ((matchSpecificExtractor as any).resumeScraping) {
        (matchSpecificExtractor as any).resumeScraping();
      }
    }
  };

  // Expose services to window for debugging
  useSafeEffect(() => {
    (window as any).totelepepService = totelepepService;
    (window as any).matchSpecificExtractor = matchSpecificExtractor;
    (window as any).realTimeSyncService = realTimeSyncService;
    (window as any).continuousSyncService = continuousSyncService;
    (window as any).supabaseService = supabaseService;
    (window as any).testSupabaseOperations = testSupabaseOperations;
    (window as any).runComprehensiveSupabaseDebug = runComprehensiveSupabaseDebug;
    (window as any).getSupabaseDebugInfo = getSupabaseDebugInfo;
    (window as any).toggleSyncPause = toggleSyncPause;
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <StatsCards 
          matches={matches}
        />
        
        {/* Search and Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search matches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => loadData(selectedDate)}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              {/* Manual sync button */}
              <button
                onClick={async () => {
                  console.log('🔄 Manually triggering sync...');
                  try {
                    await realTimeSyncService.triggerManualSync();
                    console.log('✅ Manual sync completed');
                    // Reload data after sync
                    loadData(selectedDate);
                    loadCalendarList();
                    loadSupabaseMatchCounts();
                  } catch (error) {
                    console.error('❌ Error during manual sync:', error);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Database className="w-4 h-4" />
                Sync Now
              </button>
              {/* Manual clear old matches button */}
              <button
                onClick={async () => {
                  if (supabaseService) {
                    console.log('🧹 Manually clearing old matches...');
                    try {
                      await supabaseService.clearOldMatches();
                      console.log('✅ Finished clearing old matches');
                      // Reload data after clearing
                      loadData(selectedDate);
                      loadCalendarList();
                      loadSupabaseMatchCounts();
                    } catch (error) {
                      console.error('❌ Error clearing old matches:', error);
                    }
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear Old Matches
              </button>
              {/* Force refresh all data button */}
              <button
                onClick={async () => {
                  console.log('🔄 Force refreshing all data...');
                  try {
                    // Clear cache first
                    totelepepService.clearCache();
                    
                    // Trigger manual sync
                    if (realTimeSyncService) {
                      await realTimeSyncService.triggerManualSync();
                    }
                    
                    // Reload all data
                    loadData(selectedDate);
                    loadCalendarList();
                    loadSupabaseMatchCounts();
                    
                    console.log('✅ Force refresh completed');
                  } catch (error) {
                    console.error('❌ Error during force refresh:', error);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Force Refresh
              </button>
              {/* Force cleanup and resync button */}
              <button
                onClick={async () => {
                  console.log('🚀 Starting force cleanup and resync...');
                  try {
                    // Clear cache first
                    totelepepService.clearCache();
                    
                    // Clear old matches
                    if (supabaseService) {
                      await supabaseService.clearOldMatches();
                    }
                    
                    // Trigger manual sync
                    if (realTimeSyncService) {
                      await realTimeSyncService.triggerManualSync();
                    }
                    
                    // Reload all data
                    loadData(selectedDate);
                    loadCalendarList();
                    loadSupabaseMatchCounts();
                    
                    console.log('✅ Force cleanup and resync completed');
                  } catch (error) {
                    console.error('❌ Error during force cleanup and resync:', error);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Force Cleanup & Resync
              </button>
              {/* Force Complete Refresh button */}
              <button
                onClick={forceCompleteRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Force Complete Refresh
              </button>
              {/* Reset Supabase Table button */}
              <button
                onClick={async () => {
                  if (supabaseService) {
                    console.log('🗑️ Resetting Supabase matches table...');
                    try {
                      const success = await supabaseService.resetMatchesTable();
                      if (success) {
                        console.log('✅ Supabase matches table reset successfully');
                        // Reload data after reset
                        loadData(selectedDate);
                        loadCalendarList();
                        loadSupabaseMatchCounts();
                      } else {
                        console.error('❌ Failed to reset Supabase matches table');
                      }
                    } catch (error) {
                      console.error('❌ Error resetting Supabase matches table:', error);
                    }
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Reset Supabase Table
              </button>
              {/* Get Supabase debug info button */}
              <button
                onClick={getSupabaseDebugInfo}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Database className="w-4 h-4" />
                Get Supabase Info
              </button>
              {/* Test Supabase Operations button */}
              <button
                onClick={testSupabaseOperations}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Database className="w-4 h-4" />
                Test Supabase Operations
              </button>
              {/* Comprehensive Supabase Debug button */}
              <button
                onClick={runComprehensiveSupabaseDebug}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Database className="w-4 h-4" />
                Comprehensive Supabase Debug
              </button>
              {/* Pause/Resume Sync button */}
              <button
                onClick={toggleSyncPause}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isSyncPaused 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                }`}
              >
                {isSyncPaused ? (
                  <>
                    <Play className="w-4 h-4" />
                    Resume Sync
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4" />
                    Pause Sync
                  </>
                )}
              </button>
              {/* Competition Extractor button */}
              <button
                onClick={() => setShowCompetitionExtractor(!showCompetitionExtractor)}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                <Database className="w-4 h-4" />
                {showCompetitionExtractor ? 'Hide' : 'Show'} Competition Extractor
              </button>

            </div>
          </div>
        </div>
        
        {/* Supabase Debug Info */}
        {supabaseDebugInfo && (
          <div className="bg-gray-100 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-gray-800 mb-2">Supabase Debug Information</h3>
            <pre className="text-xs text-gray-600 whitespace-pre-wrap">{supabaseDebugInfo}</pre>
            <button 
              onClick={() => setSupabaseDebugInfo('')}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800"
            >
              Close
            </button>
          </div>
        )}
        
        {/* Competition Extractor */}
        {showCompetitionExtractor && (
          <CompetitionExtractor />
        )}
        
        {/* Date Selector */}
        <DateSelector 
          selectedDate={selectedDate} 
          onDateChange={handleDateChange}
          availableDates={availableDatesWithCounts}
        />
        
        {/* Matches Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Error</span>
            </div>
            <p className="mt-1 text-red-700">{error}</p>
          </div>
        )}
        
        <DateGroupedMatches 
          groupedMatches={filteredGroupedMatches}
          loading={loading}
          onPriceClick={handlePriceClick}
          selectedPrices={parlaySelections.map((s, index) => `${s.matchId}-${s.priceType}`)}
        />
      </div>
      
      {/* Parlay Builder */}
      {parlaySelections.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
          <ParlayBuilder 
            selections={parlaySelections}
            onRemoveSelection={handleRemoveSelection}
            onClearAll={handleClearAll}
          />
        </div>
      )}
      
      <PWAInstallPrompt />
    </div>
  );
}

export default App;