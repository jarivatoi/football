import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, Calendar, AlertCircle, Calculator, Database, Lightbulb, Trash2, Play, Pause, X, Ticket } from 'lucide-react';
import { Target } from 'lucide-react';
import DateGroupedMatches from './components/DateGroupedMatches';
import DateSelector from './components/DateSelector';
import CompetitionFilter from './components/CompetitionFilter';
import Header, { API_SOURCES, ApiSource } from './components/Header';
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
import { totelepepService } from './services/totelepepService';
import { totelepepExtractor } from './services/totelepepExtractor';
import type { TotelepepMatch } from './services/totelepepExtractor';
import { registerServiceWorker, requestNotificationPermission, scheduleBackgroundSync } from './utils/pwaUtils';

// Helper function to get today's date in local timezone
const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function App() {
  // Add a simple test to see if the component is rendering
  console.log('App component is rendering');
  
  
  const [matches, setMatches] = useState<TotelepepMatch[]>([]);
  const [groupedMatches, setGroupedMatches] = useState<Record<string, TotelepepMatch[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMode, setSearchMode] = useState<'matches' | 'eq' | 'gte' | 'lte'>('matches'); // matches, = (eq), >= (gte), <= (lte)
  const [searchOddsValue, setSearchOddsValue] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [parlaySelections, setParlaySelections] = useState<ParlaySelection[]>([]);
  const [showExtractor, setShowExtractor] = useState(false);
  const [showEndpointDiscovery, setShowEndpointDiscovery] = useState(false);
  const [showResponseAnalyzer, setShowResponseAnalyzer] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [showMatchTester, setShowMatchTester] = useState(false);
  const [showBetAnalyzer, setShowBetAnalyzer] = useState(false);
  const [showBookingGuide, setShowBookingGuide] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate());
  const [showAllMatches, setShowAllMatches] = useState<boolean>(false);
  const [lastScrapeTime, setLastScrapeTime] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [availableDates, setAvailableDates] = useState<Array<{date: string, matchCount: number, displayName: string}>>([]);
  const [calendarList, setCalendarList] = useState<Array<{date: string, matchCount: number, displayName: string}>>([]);
  const [showParlayBuilder, setShowParlayBuilder] = useState(false);
  
  // Category and Competition filter states
  const [categories, setCategories] = useState<Array<{id: string, name: string, competitions?: Array<{id: string, name: string, matchCount?: number}>}>>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedCompetition, setSelectedCompetition] = useState<string>('');
  
  // Initialize selected source from localStorage or default to Totelepep
  const [selectedSource, setSelectedSource] = useState<ApiSource>(() => {
    try {
      const savedSource = localStorage.getItem('selectedApiSource');
      if (savedSource) {
        const parsed = JSON.parse(savedSource);
        const found = API_SOURCES.find(s => s.id === parsed.id);
        if (found) {
          console.log('🌐 Restored saved API source:', found.displayName);
          // Update extractor baseUrl immediately to use saved source
          (totelepepExtractor as any).baseUrl = found.baseUrl;
          return found;
        }
      }
    } catch (e) {
      console.warn('Failed to load saved API source:', e);
    }
    return API_SOURCES[0]; // Default to Totelepep
  });
  
  // Handle API source change
  const handleSourceChange = async (source: ApiSource) => {
    console.log('🌐 API Source changed to:', source.displayName);
    setSelectedSource(source);
    
    // Save to localStorage
    localStorage.setItem('selectedApiSource', JSON.stringify(source));
    
    // Update the extractor base URL
    (totelepepExtractor as any).baseUrl = source.baseUrl;
    
    // Clear cache to fetch fresh data from new source
    totelepepExtractor.clearCache();
    
    // Clear current matches immediately to show loading state
    setMatches([]);
    setGroupedMatches({});
    
    // Reset both category and competition filters when switching sources
    // Each source has its own IDs, so start fresh
    console.log('🏆 Resetting all filters for new API source');
    setSelectedCategory('');
    setSelectedCompetition('');
    
    // Clear parlay selections since odds are source-specific
    console.log('🎯 Clearing parlay selections (odds are source-specific)');
    setParlaySelections([]);
    setShowParlayBuilder(false);
    
    // Reload calendar without any filters
    console.log('📅 Reloading calendar from new source (no filters)...');
    await loadCalendarList('', '');
    
    // Reload data with new source (no filters)
    if (showAllMatches) {
      console.log('📋 All Matches is active - reloading all matches from new source');
      loadAllMatches('', '');
    } else if (selectedDate) {
      console.log('🔄 Reloading data from new source...');
      loadData(selectedDate, '', '');
    }
  };
  
  // Function to fetch competitions for a category
  const handleFetchCompetitions = async (categoryName: string) => {
    console.log(`🏆 Fetching competitions for category: ${categoryName}`);
    const competitions = await totelepepExtractor.fetchCompetitionsForCategory(categoryName);
    
    // Update categories state with the fetched competitions
    const categoryId = categoryName.toLowerCase();
    setCategories(prev => prev.map(cat => 
      cat.id === categoryId ? { ...cat, competitions } : cat
    ));
    
    return competitions;
  };
  
  // Handle category change - reload calendar with filters
  const handleCategoryChange = async (categoryId: string) => {
    console.log('📂 Category changed to:', categoryId);
    setSelectedCategory(categoryId);
    setSelectedCompetition('');
    
    // Reload calendar with the category filter and get the first date
    const firstDate = await reloadCalendarWithFilters(categoryId, '');
    console.log('📅 reloadCalendarWithFilters returned:', firstDate);
    
    // If All Matches is active, reload all matches with new category
    if (showAllMatches) {
      console.log('📋 All Matches is active - reloading all matches with new category:', categoryId);
      loadAllMatches(categoryId, '');
    } else if (firstDate) {
      // Load data with the first date from the filtered calendar
      console.log('📅 Loading matches for first calendar date:', firstDate);
      loadData(firstDate, categoryId, '');
    } else {
      console.log('⚠️ No date returned from reloadCalendarWithFilters');
    }
  };
  
  // Handle competition change - reload calendar with filters
  const handleCompetitionChange = async (competitionId: string) => {
    console.log('🏆 Competition changed to:', competitionId);
    setSelectedCompetition(competitionId);
    
    // Don't reload calendar if competition is being reset (empty string)
    // This happens when category changes and resets competition
    if (!competitionId) {
      console.log('🏆 Competition reset - skipping calendar reload');
      // If All Matches is active, reload with reset competition
      if (showAllMatches) {
        console.log('📋 All Matches is active - reloading all matches with reset competition');
        loadAllMatches(selectedCategory, '');
      }
      return;
    }
    
    // Reload calendar with the competition filter to get filtered counts
    // The API DOES return competition-specific calendar counts
    await reloadCalendarWithFilters(selectedCategory, competitionId);
    
    // If All Matches is active, reload all matches with new competition
    if (showAllMatches) {
      console.log('📋 All Matches is active - reloading all matches with new competition');
      loadAllMatches(selectedCategory, competitionId);
    } else if (selectedDate) {
      // Load data with the selected date and competition filter
      console.log('📅 Loading matches for selected date with competition filter:', selectedDate);
      loadData(selectedDate, selectedCategory, competitionId);
    }
  };
  
  // Reload calendar with category/competition filters to update match counts
  const reloadCalendarWithFilters = async (categoryId: string, competitionId: string): Promise<string | null> => {
    console.log('📅 Reloading calendar with filters...', { categoryId, competitionId });
    
    // Load calendar with the filters
    await loadCalendarList(categoryId, competitionId);
    
    // Return the first date that has matches > 0
    const calendarData = (totelepepExtractor as any).calendarList || [];
    console.log('📅 Calendar data after reload:', calendarData.length, 'entries');
    if (calendarData && calendarData.length > 0) {
      // Find first date with matches
      const firstDateWithMatches = calendarData.find((entry: any) => entry.matchCount > 0);
      if (firstDateWithMatches) {
        console.log('📅 First date with matches:', firstDateWithMatches.entryDate, 'count:', firstDateWithMatches.matchCount);
        return firstDateWithMatches.entryDate;
      }
      // Fallback to first date even if it has 0 matches
      console.log('⚠️ No dates with matches found, using first date:', calendarData[0].entryDate);
      return calendarData[0].entryDate;
    }
    console.log('⚠️ No calendar data available');
    return null;
  };

  // Initialize online status
  useEffect(() => {
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

  // Calculate sticky header height and set CSS variable
  useEffect(() => {
    const updateHeaderHeight = () => {
      const header = document.getElementById('main-sticky-header');
      if (header) {
        const height = header.offsetHeight + 0; // Add ?px buffer to prevent overlap
        document.documentElement.style.setProperty('--header-height', `${height}px`);
        console.log('📏 Sticky header height:', height, 'px');
      }
    };
    
    // Run after render
    updateHeaderHeight();
    
    // Update on resize
    window.addEventListener('resize', updateHeaderHeight);
    return () => window.removeEventListener('resize', updateHeaderHeight);
  }, []);

  // Initialize PWA features
  useEffect(() => {
    registerServiceWorker();
    requestNotificationPermission();
    scheduleBackgroundSync();
    
    console.log('🚀 App initialized - Direct API mode (no Supabase)');
  }, [selectedDate]);
  
  const loadData = async (targetDate?: string | null, categoryId?: string, competitionId?: string) => {
    setLoading(true);
    setError(null);
    console.log('🔍 loadData called with targetDate:', targetDate, 'type:', typeof targetDate, 'isNull:', targetDate === null);
    
    // targetDate === null means "no date, get all matches"
    // targetDate === undefined means "use selectedDate"
    // targetDate === string means "use this specific date"
    let dateToFetch: string | undefined;
    if (targetDate === null) {
      dateToFetch = undefined;  // No date = API will use inclusive=1
      console.log('🔍 All Matches mode - no date parameter');
    } else if (targetDate === undefined) {
      dateToFetch = selectedDate;  // Use selected date
      console.log('🔍 Using selectedDate:', selectedDate);
    } else {
      dateToFetch = targetDate;  // Use provided date
      console.log('🔍 Using provided date:', targetDate);
    }
    
    const catId = categoryId !== undefined ? categoryId : selectedCategory;
    const compId = competitionId !== undefined ? competitionId : selectedCompetition;
    try {
      console.log('🔍 Fetching data for date:', dateToFetch);
      console.log('📂 Category to use:', catId);
      console.log('🏆 Competition to use:', compId);
      
      // Fetch matches DIRECTLY from Totelepep API with category/competition filters
      console.log('📡 Fetching from Totelepep API with filters...');
      const fetchedMatches = await totelepepExtractor.extractMatches(dateToFetch, catId, compId);
      
      console.log(`📊 Loaded ${fetchedMatches.length} matches with allMarkets:`, 
        fetchedMatches.slice(0, 3).map((m: TotelepepMatch) => ({
          id: m.id,
          marketCount: m.marketCount,
          hasAllMarkets: !!m.allMarkets,
          allMarketsLength: m.allMarkets?.length || 0
        }))
      );
      
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
      console.log(`✅ Loaded ${sortedMatches.length} matches for ${dateToFetch}`);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Load ALL matches from all dates and combine them
  const loadAllMatches = async (categoryId?: string, competitionId?: string) => {
    setLoading(true);
    setError(null);
    console.log('📋 Loading all matches from all dates...');
    console.log('📋 availableDates:', availableDates);
    console.log('📋 calendarList:', calendarList);
    
    // Use provided params or fall back to state
    const catId = categoryId !== undefined ? categoryId : selectedCategory;
    const compId = competitionId !== undefined ? competitionId : selectedCompetition;
    console.log('📋 Using category:', catId, 'competition:', compId);
    
    try {
      const allMatches: TotelepepMatch[] = [];
      
      // Use calendarList which has all the dates
      const datesToFetch = calendarList.length > 0 ? calendarList : availableDates;
      console.log('📋 Using dates:', datesToFetch);
      
      // Fetch matches from each date
      for (const dateInfo of datesToFetch) {
        console.log(`📅 Fetching matches for ${dateInfo.date} (${dateInfo.displayName})...`);
        try {
          const matches = await totelepepExtractor.extractMatches(dateInfo.date, catId, compId);
          console.log(`  ✅ Got ${matches.length} matches for ${dateInfo.date}`);
          allMatches.push(...matches);
        } catch (error) {
          console.error(`  ❌ Failed to fetch ${dateInfo.date}:`, error);
        }
      }
      
      console.log(`📋 Total matches loaded: ${allMatches.length}`);
      
      // Sort all matches by date and time
      const sortedMatches = allMatches.sort((a, b) => {
        const dateComparison = new Date(a.date || '').getTime() - new Date(b.date || '').getTime();
        if (dateComparison !== 0) return dateComparison;
        return a.kickoff.localeCompare(b.kickoff);
      });
      
      setMatches(sortedMatches);
      
      // Group matches by date
      const grouped = totelepepService.groupMatchesByDate(sortedMatches);
      setGroupedMatches(grouped);
      
      setLastUpdated(new Date());
      console.log(`✅ Loaded ${sortedMatches.length} total matches from all dates`);
    } catch (error) {
      console.error('Error loading all matches:', error);
      setError('Failed to load all matches. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load calendar list data with optional filters
  const loadCalendarList = async (categoryId?: string, competitionId?: string) => {
    try {
      const sourceName = selectedSource?.displayName || 'Totelepep';
      console.log(`📅 Fetching calendar list data from ${sourceName} API...`, { categoryId, competitionId });
      
      // Clear cache to ensure fresh data
      totelepepExtractor.clearCache();
      
      // We need to fetch with a date to get the calendar list
      // Use TODAY (not yesterday) to ensure we get the full calendar with matches
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      console.log('📅 Fetching calendar with date:', dateStr);
      console.log('📅 With filters - category:', categoryId || '(none)', 'competition:', competitionId || '(none)');
      
      // Fetch with a date to get the calendar list
      const matches = await totelepepExtractor.extractMatches(dateStr, categoryId || '', competitionId || '');
      
      // Small delay to ensure calendarList is set
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get calendar list from extractor
      const calendarData = (totelepepExtractor as any).calendarList || [];
      
      console.log('📅 Extractor calendarList after extraction:', calendarData);
      
      if (calendarData && calendarData.length > 0) {
        console.log('📅 Calendar list data loaded:', calendarData);
        
        const formattedCalendar = calendarData.map((entry: any) => ({
          date: entry.entryDate,
          matchCount: entry.matchCount || 0,
          displayName: entry.displayDate || entry.entryDate
        }));
        
        console.log('📅 Formatted calendar with filtered counts:', formattedCalendar);
        setCalendarList(formattedCalendar);
        
        // Set the selected date to the FIRST entry from the API (which is "Today" in API's timezone)
        const firstDate = formattedCalendar[0].date;
        console.log('📅 Setting selected date to API today:', firstDate);
        setSelectedDate(firstDate);
        
        // NOTE: Don't auto-load matches here - let the caller (handleCategoryChange, etc.) do it
        // This prevents race conditions and double-loading
      }
      
      // Fetch categories from the API (only on initial load without filters)
      if (!categoryId) {
        console.log('📂 Fetching categories from API...');
        const categoryList = await totelepepExtractor.fetchCategories();
        
        if (categoryList && categoryList.length > 0) {
          console.log('📂 Categories loaded:', categoryList);
          setCategories(categoryList.map(cat => ({
            id: cat.id,
            name: cat.name,
            competitions: [] // Will be populated when category is selected
          })));
        }
      }
    } catch (error) {
      console.error('Error loading calendar list:', error);
      setError('Failed to load calendar data from Totelepep API.');
    }
  };




  // Load initial data on mount
  useEffect(() => {
    console.log('📅 Initial load...');
    console.log('📅 Local timezone today is:', getTodayDate());
    
    // Clear all caches on initial load
    totelepepExtractor.clearCache();
    
    // Load calendar first - it will set the correct selected date from the API
    loadCalendarList().then(() => {
      // After calendar is loaded, load matches for the first date
      const firstDate = (totelepepExtractor as any).calendarList?.[0]?.entryDate;
      if (firstDate) {
        console.log('📅 Loading initial matches for:', firstDate);
        loadData(firstDate);
      }
    });
  }, []); // Only run once on mount
  
  // NOTE: Removed the useEffect that loaded data when selectedDate changed
  // This was causing race conditions with handleCategoryChange/handleCompetitionChange
  // Those handlers now directly call loadData with the correct date and filters

  // Filter matches by selected date and maintain grouping
  const filteredGroupedMatches = React.useMemo ? React.useMemo(() => {
    console.log('🔍 filteredGroupedMatches computing...', {
      selectedDate,
      selectedCategory,
      selectedCompetition,
      showAllMatches,
      groupedMatchesKeys: Object.keys(groupedMatches)
    });
    
    // Check if this is a Beyond date by checking if displayName contains "Beyond"
    const isBeyondDate = selectedDate && calendarList.find(entry => {
      return entry.date === selectedDate && (entry.displayName.includes('Beyond') || entry.displayName.includes('>>'));
    });
    
    let dateFiltered: Record<string, TotelepepMatch[]> = {};
    
    console.log('📋 Filtering check - showAllMatches:', showAllMatches, 'selectedDate:', selectedDate);
    
    // Check if "All Matches" mode is enabled - this takes priority over date selection
    if (showAllMatches) {
      // Show ALL matches from all dates, sorted by time
      dateFiltered = { ...groupedMatches };
      console.log('📋 All Matches mode: Showing ALL dates, total:', Object.values(groupedMatches).flat().length);
    } else if (isBeyondDate) {
      // For Beyond, show ALL matches from all dates
      dateFiltered = { ...groupedMatches };
    } else {
      // For specific dates, only show matches for that date
      if (groupedMatches[selectedDate]) {
        dateFiltered[selectedDate] = groupedMatches[selectedDate];
      }
    }
    
    // Apply category/competition filters if selected
    let categoryFiltered: Record<string, TotelepepMatch[]> = {};
    
    if (selectedCompetition) {
      // Filter by specific competition
      console.log('🏆 Filtering by competition:', selectedCompetition, 'type:', typeof selectedCompetition);
      Object.entries(dateFiltered).forEach(([date, dateMatches]) => {
        console.log(`📅 Date ${date}: ${dateMatches.length} matches before competition filter`);
        if (dateMatches.length > 0) {
          console.log('🏆 First match competitionId:', dateMatches[0].competitionId, 'type:', typeof dateMatches[0].competitionId);
        }
        const filteredMatches = dateMatches.filter(match => {
          // Convert both to string for comparison to handle type mismatch
          const matches = String(match.competitionId) === String(selectedCompetition);
          if (!matches) {
            console.log(`  ❌ Match ${match.homeTeam} vs ${match.awayTeam}: competitionId=${match.competitionId} !== ${selectedCompetition}`);
          }
          return matches;
        });
        console.log(`📅 Date ${date}: ${filteredMatches.length} matches after competition filter`);
        if (filteredMatches.length > 0) {
          categoryFiltered[date] = filteredMatches;
        }
      });
    } else if (selectedCategory) {
      // Filter by category (all competitions in this category)
      Object.entries(dateFiltered).forEach(([date, dateMatches]) => {
        const filteredMatches = dateMatches.filter(match => match.categoryId === selectedCategory);
        if (filteredMatches.length > 0) {
          categoryFiltered[date] = filteredMatches;
        }
      });
    } else {
      // No category/competition filter applied
      categoryFiltered = dateFiltered;
    }
    
    // Then filter by search term if provided
    if (!searchTerm && searchMode === 'matches') return categoryFiltered;
    
    const filtered: Record<string, TotelepepMatch[]> = {};
    
    Object.entries(categoryFiltered).forEach(([date, dateMatches]) => {
      let filteredDateMatches: TotelepepMatch[];
      
      if (searchMode === 'matches') {
        // Filter by team/league name
        filteredDateMatches = (dateMatches as TotelepepMatch[]).filter(match =>
          match.homeTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
          match.awayTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
          match.league.toLowerCase().includes(searchTerm.toLowerCase())
        );
      } else {
        // Filter by odds value
        let targetOdds = parseFloat(searchTerm);
        let positionFilter: 'home' | 'draw' | 'away' | null = null;
        
        // Check for position suffix (H=Home, D=Draw, A=Away)
        const upperSearch = searchTerm.toUpperCase().trim();
        if (upperSearch.endsWith('H')) {
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
        
        if (isNaN(targetOdds)) {
          filteredDateMatches = [];
        } else {
          filteredDateMatches = (dateMatches as TotelepepMatch[]).filter(match => {
            // Check if any of the match's odds match the filter
            const homeOdds = parseFloat(String(match.homeOdds));
            const drawOdds = parseFloat(String(match.drawOdds));
            const awayOdds = parseFloat(String(match.awayOdds));
            
            if (positionFilter) {
              // Filter by specific position (H, D, or A)
              if (searchMode === 'eq') {
                if (positionFilter === 'home') return homeOdds === targetOdds;
                if (positionFilter === 'draw') return drawOdds === targetOdds;
                if (positionFilter === 'away') return awayOdds === targetOdds;
              } else if (searchMode === 'gte') {
                if (positionFilter === 'home') return homeOdds >= targetOdds;
                if (positionFilter === 'draw') return drawOdds >= targetOdds;
                if (positionFilter === 'away') return awayOdds >= targetOdds;
              } else {
                if (positionFilter === 'home') return homeOdds <= targetOdds;
                if (positionFilter === 'draw') return drawOdds <= targetOdds;
                if (positionFilter === 'away') return awayOdds <= targetOdds;
              }
            } else {
              // Filter any position (no suffix)
              if (searchMode === 'eq') {
                // = (equal to)
                return homeOdds === targetOdds || drawOdds === targetOdds || awayOdds === targetOdds;
              } else if (searchMode === 'gte') {
                // >= (greater than or equal)
                return homeOdds >= targetOdds || drawOdds >= targetOdds || awayOdds >= targetOdds;
              } else {
                // <= (less than or equal)
                return homeOdds <= targetOdds || drawOdds <= targetOdds || awayOdds <= targetOdds;
              }
            }
          });
        }
      }
      
      if (filteredDateMatches.length > 0) {
        filtered[date] = filteredDateMatches;
      }
    });
    
    let result = filtered;
    
    // Sort search results by date and time
    if (Object.keys(result).length > 0) {
      // Sort the date keys chronologically (ascending - earliest first)
      const sortedDates = Object.keys(result).sort((a, b) => {
        // Try to parse as dates
        const dateA = new Date(a);
        const dateB = new Date(b);
        if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
          return (dateB.getTime() - dateA.getTime()) * -1;  // FIX: Multiply by -1 for ascending
        }
        // Fallback to string comparison
        return b.localeCompare(a) * -1;  // FIX: Multiply by -1 for ascending
      });
      
      // Rebuild result with sorted dates
      const sorted: Record<string, TotelepepMatch[]> = {};
      for (const date of sortedDates) {
        sorted[date] = result[date];
      }
      result = sorted;
      
      // If All Matches mode is enabled, also sort within each date by kickoff time
      if (showAllMatches) {
        // Flatten all matches, sort by FULL date+time from kickoff, then regroup by date
        const allMatches = Object.values(result).flat() as TotelepepMatch[];
        
        // Sort by FULL kickoff datetime - parse "DD Mon HH:MM" to actual Date
        allMatches.sort((a, b) => {
          const kickoffA = a.kickoff || '';
          const kickoffB = b.kickoff || '';
          
          // Parse "13 Jun 18:00" format to Date object
          const parseKickoff = (kickoff: string) => {
            const parts = kickoff.split(' ');
            if (parts.length === 3) {
              const [day, month, time] = parts;
              const months: Record<string, number> = {
                'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
              };
              const monthNum = months[month] ?? 0;
              const [hours, minutes] = time.split(':').map(Number);
              // Use year 2026 for all (current season)
              return new Date(2026, monthNum, parseInt(day), hours, minutes);
            }
            return new Date(0); // Fallback
          };
          
          const dateA = parseKickoff(kickoffA);
          const dateB = parseKickoff(kickoffB);
          
          return (dateA.getTime() - dateB.getTime()) * -1;  // FIX: Multiply by -1 to reverse to ascending
        });
        
        // Regroup by date (use the ORIGINAL date from match.date, not kickoff)
        const finalSorted: Record<string, TotelepepMatch[]> = {};
        allMatches.forEach(match => {
          // Use match.date (YYYY-MM-DD format) instead of parsing kickoff
          const matchDate = match.date || match.kickoff?.split(' ')[0] || 'Unknown';
          if (!finalSorted[matchDate]) {
            finalSorted[matchDate] = [];
          }
          finalSorted[matchDate].push(match);
        });
        
        result = finalSorted;
      } else {
        console.log('📋 Search results: Sorted by date');
      }
    }
    
    return result;
  }, [groupedMatches, searchTerm, selectedDate, calendarList, selectedCategory, selectedCompetition, showAllMatches]) : groupedMatches;

  const totalAllMatchesCount = React.useMemo(() => {
    // Calculate total from filtered matches (respects category/competition filters)
    if (showAllMatches) {
      // Use filteredGroupedMatches to get the filtered count
      return Object.values(filteredGroupedMatches).flat().length;
    }
    // For non-All Matches, use the loaded matches
    return matches.length > 0 ? matches.length : Object.values(groupedMatches).flat().length;
  }, [matches, groupedMatches, filteredGroupedMatches, showAllMatches]);
    
    const totalMatches = matches.length;
  const totalFilteredMatches = Object.values(filteredGroupedMatches)
    .reduce((sum, dateMatches) => sum + (dateMatches as TotelepepMatch[]).length, 0);
  
  // Store upcoming match counts by date for debug display
  if (typeof window !== 'undefined') {
    const upcomingCounts: Record<string, number> = {};
    Object.entries(filteredGroupedMatches).forEach(([date, dateMatches]) => {
      upcomingCounts[date] = (dateMatches as TotelepepMatch[]).length;
    });
    (window as any).__upcomingMatchesByDate = upcomingCounts;
  }
  
  // Get available dates with match counts from API calendarList data
  const availableDatesWithCounts = React.useMemo ? React.useMemo(() => {
    const sourceName = selectedSource?.displayName || 'Totelepep';
    console.log(`📅 Using calendar list data from ${sourceName} API for date tabs...`);
    console.log('📅 Calendar list data:', calendarList);
    
    // Use the calendarList data directly - this is the source of truth
    if (calendarList && calendarList.length > 0) {
      const sourceName = selectedSource?.displayName || 'Totelepep';
      console.log(`📅 Using ${sourceName} calendar list as source of truth`);
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
  useEffect(() => {
    console.log('📅 Available dates in groupedMatches:', Object.keys(groupedMatches));
    console.log('📊 Matches per date:', Object.entries(groupedMatches).map(([date, matches]) => `${date}: ${(matches as TotelepepMatch[]).length}`));
  }, [groupedMatches]);

  const handlePriceClick = (matchId: string, priceType: string, odds: number | string, marketBookNo?: string, marketCode?: string, marketId?: string, marketLine?: string, periodCode?: string, marketDisplayName?: string, optionCode?: string, optionNo?: string) => {
    // Find the match details
    const match = matches.find(m => m.id === matchId);
    if (match) {
      // Check if this exact selection already exists
      const existingIndex = parlaySelections.findIndex(
        s => s.matchId === matchId && s.priceType === priceType
      );
      
      if (existingIndex >= 0) {
        // Remove existing selection (toggle off)
        setParlaySelections(prev => prev.filter((_, index) => index !== existingIndex));
      } else {
        // Log match data for debugging
        console.log(' Adding selection from match:', match);
        console.log(` Price type: ${priceType}, Odds: ${odds}`);
        console.log(`🔍 Market data from click - marketBookNo: ${marketBookNo}, marketCode: ${marketCode}, marketId: ${marketId}, optionCode: ${optionCode}, optionNo: ${optionNo}`);
        
        // Use the marketBookNo and marketCode passed from the click event
        const finalMarketBookNo = (marketBookNo && marketBookNo !== 'undefined' && marketBookNo !== 'null') 
          ? marketBookNo 
          : (match.marketBookNo || match.id);
        
        const finalMarketCode = (marketCode && marketCode !== 'undefined' && marketCode !== 'null') 
          ? marketCode 
          : (match.marketCode || 'CP');
        
        // Debug the final values
        console.log(`🔍 App.tsx - final marketBookNo:`, finalMarketBookNo);
        console.log(`🔍 App.tsx - final marketCode:`, finalMarketCode);
      
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
          // CRITICAL: Use the ACTUAL marketId from GetMatch API (e.g., 565968)
          // Priority: 1. marketId from click param, 2. match.marketId, 3. marketBookNo, 4. match.id
          marketId: marketId || (match.marketId && match.marketId !== '0' && match.marketId !== 'undefined' && match.marketId !== 'null' ? match.marketId : (marketBookNo || match.id)),
          marketBookNo: finalMarketBookNo,
          marketCode: finalMarketCode,
          marketLine: marketLine || '',  // Store market line for handicap/over-under markets
          periodCode: periodCode || 'FT',  // Store period code (FT, H1, 2H, etc.)
          marketDisplayName: marketDisplayName || '',  // Store full market display name from API
          optionCode: optionCode || '',  // Store option code from API
          optionNo: optionNo || '',  // Store option number from API
        };
        
        console.log(`🔍 App.tsx - marketId parameter received: ${marketId}`);
        console.log(`🔍 App.tsx - match.marketId: ${match.marketId}`);
        console.log(`🔍 App.tsx - final marketId for selection: ${newSelection.marketId}`);
        
        console.log(`🔍 App.tsx - newSelection with market data:`, newSelection);
        
        // Debug specific match data
        if (match.homeTeam && match.awayTeam) {
          console.log(`🎯 MATCH SELECTION DEBUG: ${match.homeTeam} vs ${match.awayTeam}`);
          console.log(`   matchId:`, match.id);
          console.log(`   marketBookNo:`, match.marketBookNo);
          console.log(`   marketCode:`, match.marketCode);
          console.log(`   competitionId:`, match.competitionId);
          console.log(`   Final selection marketBookNo:`, finalMarketBookNo);
          console.log(`   Final selection marketCode:`, finalMarketCode);
          
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
    setParlaySelections(prev => {
      const updated = prev.filter(s => s.matchId !== matchId);
      // Auto-close parlay builder when last selection is removed
      if (updated.length === 0) {
        setShowParlayBuilder(false);
      }
      return updated;
    });
  };

  const handleRemoveSelectionByMatch = (matchId: string) => {
    setParlaySelections(prev => prev.filter(s => s.matchId !== matchId));
  };

  const handleClearAll = () => {
    setParlaySelections([]);
    setShowParlayBuilder(false); // Close parlay builder when clearing all
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
    console.log('📂 Current category:', selectedCategory);
    console.log('🏆 Current competition:', selectedCompetition);
    
    // Turn off All Matches when a specific date is selected
    if (showAllMatches) {
      setShowAllMatches(false);
      console.log('📋 Turning off All Matches - date selected');
    }
    
    // Clear search when changing dates
    setSearchTerm('');
    setSearchMode('matches');
    setSearchOddsValue('');
    
    setSelectedDate(newDate);
    
    // Handle "beyond" date - check if this date corresponds to Beyond entry
    const isBeyondDate = availableDatesWithCounts.find(d => 
      d.date === newDate && (d.displayName.includes('Beyond') || d.displayName.includes('>>'))
    );
    
    if (isBeyondDate) {
      console.log('📅 Fetching Beyond matches from date:', newDate);
      // Extract just the date part (YYYY-MM-DD) from the ISO string
      const beyondDate = newDate.split('T')[0];
      console.log('📅 Beyond date (extracted):', beyondDate);
      // Pass the date - API will use inclusive=1 to return all matches from that date onwards
      loadData(beyondDate, selectedCategory, selectedCompetition);
    } else {
      // For regular dates, load with current filters
      console.log('📅 Loading regular date with filters:', newDate);
      loadData(newDate, selectedCategory, selectedCompetition);
    }
  };
  
  const toggleParlayBuilder = () => {
    setShowParlayBuilder(prev => !prev);
  };
  
  const toggleAllMatches = () => {
    const newState = !showAllMatches;
    setShowAllMatches(newState);
    console.log(`📋 All Matches toggle: ${newState ? 'ON' : 'OFF'}`);
    
    if (newState) {
      // Turn ON All Matches - fetch matches from ALL dates and combine them
      console.log('📋 Loading ALL matches for All Matches view (fetching all dates)');
      
      // Clear current matches and show loading
      setMatches([]);
      setGroupedMatches({});
      
      // Load all matches with current filters
      loadAllMatches(selectedCategory, selectedCompetition);
    } else {
      // Turn OFF All Matches, restore to today's date
      const today = getTodayDate();
      setSelectedDate(today);
      console.log('📋 Turning off All Matches, restoring to:', today);
      loadData(today, selectedCategory, selectedCompetition);
    }
  };






  return (
    <div className="min-h-screen bg-gray-100">
      {/* Combined Sticky Header: Header + Date Selector + Search */}
      <div className="sticky top-0 z-40" id="main-sticky-header">
        <Header 
          selectionCount={parlaySelections.length}
          onSlipClick={toggleParlayBuilder}
          selectedSource={selectedSource}
          onSourceChange={handleSourceChange}
        />
        
        {/* Date Selector */}
        <DateSelector
          selectedDate={selectedDate} 
          onDateChange={handleDateChange}
          availableDates={availableDatesWithCounts}
          showAllMatches={showAllMatches}
          onToggleAllMatches={toggleAllMatches}
          totalMatches={totalAllMatchesCount}
        />
        
        {/* Search Bar */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-3 py-2 flex items-center gap-2">
            {/* Search Input - Half Width */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder={searchMode === 'matches' ? 'Search matches...' : searchMode === 'eq' ? 'e.g., 130H, 130D, 130A' : 'Enter odds (e.g., 130H, 150A)...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSearchMode('matches');
                    setSearchOddsValue('');
                  }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              )}
            </div>
            
            {/* Filter Mode Dropdown */}
            <select
              value={searchMode}
              onChange={(e) => {
                const mode = e.target.value as 'matches' | 'eq' | 'gte' | 'lte';
                setSearchMode(mode);
                if (mode !== 'matches') {
                  setSearchTerm('');
                }
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-medium"
            >
              <option value="matches">Matches</option>
              <option value="eq">= Equal to</option>
              <option value="gte">≥ Greater or Equal</option>
              <option value="lte">≤ Less or Equal</option>
            </select>
          </div>
        </div>
        
        {/* Competition Filter */}
        <CompetitionFilter
          categories={categories}
          selectedCategory={selectedCategory}
          selectedCompetition={selectedCompetition}
          onCategoryChange={handleCategoryChange}
          onCompetitionChange={handleCompetitionChange}
          onFetchCompetitions={handleFetchCompetitions}
        />
      </div>
      
      <div className="max-w-3xl mx-auto">
        
        {/* Matches Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-4 h-4" />
              <span className="font-medium text-sm">Error</span>
            </div>
            <p className="mt-1 text-red-700 text-sm">{error}</p>
          </div>
        )}
        
        <DateGroupedMatches 
          groupedMatches={filteredGroupedMatches}
          loading={loading}
          onPriceClick={handlePriceClick}
          selectedPrices={parlaySelections.map((s, index) => `${s.matchId}-${s.priceType}`)}
          apiSourceName={selectedSource.displayName}
          searchMode={searchMode}
          searchTerm={searchTerm}
        />
      </div>
      
      {/* Parlay Builder - Slide in from right */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${showParlayBuilder ? 'translate-x-0' : 'translate-x-full'}`}>
        {parlaySelections.length > 0 ? (
          <ParlayBuilder
            selections={parlaySelections}
            onRemoveSelection={handleRemoveSelection}
            onClearAll={handleClearAll}
            onClose={() => setShowParlayBuilder(false)}
            selectedSource={selectedSource}
          />
        ) : (
          // Show empty state when no selections but panel is still open
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <Ticket className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No Selections</h3>
            <p className="text-gray-500 mb-6">Click on odds to add selections to your bet slip</p>
            <button
              onClick={() => setShowParlayBuilder(false)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
      
      <PWAInstallPrompt />
    </div>
  );
}

export default App;