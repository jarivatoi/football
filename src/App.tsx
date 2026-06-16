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
import UserLogin from './components/UserLogin';
import UserProfile from './components/UserProfile';
import { MaintenanceMode } from './components/MaintenanceMode';
import { totelepepService } from './services/totelepepService';
import { totelepepExtractor } from './services/totelepepExtractor';
import type { TotelepepMatch } from './services/totelepepExtractor';
import { registerServiceWorker, requestNotificationPermission, scheduleBackgroundSync } from './utils/pwaUtils';
import { getUserSession, removeUserSession } from './utils/userSessionDB';
import { supabase } from './lib/supabase';

// Helper function to get today's date in local timezone
const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function App() {
  // ========================================
  // ALL HOOKS MUST BE AT THE TOP - BEFORE ANY RETURNS
  // ========================================
  
  // Authentication state
  const [userSession, setUserSession] = useState<{
    userId: string;
    idNumber: string;
    isAdmin: boolean;
    surname?: string;
    name?: string;
  } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Maintenance mode state
  const [isMaintenanceEnabled, setIsMaintenanceEnabled] = useState(false);
  
  // Add a simple test to see if the component is rendering
  
  
  
  const [matches, setMatches] = useState<TotelepepMatch[]>([]);
  const [groupedMatches, setGroupedMatches] = useState<Record<string, TotelepepMatch[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMode, setSearchMode] = useState<'matches' | 'eq' | 'gte' | 'lte' | 'between'>('matches'); // matches, = (eq), >= (gte), <= (lte), between
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
          
          // Update extractor baseUrl immediately to use saved source
          (totelepepExtractor as any).baseUrl = found.baseUrl;
          return found;
        }
      }
    } catch (e) {
      
    }
    return API_SOURCES[0]; // Default to Totelepep
  });
  
  // Handle API source change
  const handleSourceChange = async (source: ApiSource) => {
    
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
    
    setSelectedCategory('');
    setSelectedCompetition('');
    
    // Clear parlay selections since odds are source-specific
    
    setParlaySelections([]);
    setShowParlayBuilder(false);
    
    // Reload calendar without any filters
    
    await loadCalendarList('', '');
    
    // Reload data with new source (no filters)
    if (showAllMatches) {
      
      loadAllMatches('', '');
    } else if (selectedDate) {
      
      loadData(selectedDate, '', '');
    }
  };
  
  // Function to fetch competitions for a category
  const handleFetchCompetitions = async (categoryName: string) => {
    
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
    
    setSelectedCategory(categoryId);
    setSelectedCompetition('');
    
    // Reload calendar with the category filter and get the first date
    const firstDate = await reloadCalendarWithFilters(categoryId, '');
    
    
    // If All Matches is active, reload all matches with new category
    if (showAllMatches) {
      
      loadAllMatches(categoryId, '');
    } else if (firstDate) {
      // Load data with the first date from the filtered calendar
      
      loadData(firstDate, categoryId, '');
    } else {
      
    }
  };
  
  // Handle competition change - reload calendar with filters
  const handleCompetitionChange = async (competitionId: string) => {
    
    setSelectedCompetition(competitionId);
    
    // Don't reload calendar if competition is being reset (empty string)
    // This happens when category changes and resets competition
    if (!competitionId) {
      
      // If All Matches is active, reload with reset competition
      if (showAllMatches) {
        
        loadAllMatches(selectedCategory, '');
      }
      return;
    }
    
    // Reload calendar with the competition filter to get filtered counts
    // The API DOES return competition-specific calendar counts
    await reloadCalendarWithFilters(selectedCategory, competitionId);
    
    // If All Matches is active, reload all matches with new competition
    if (showAllMatches) {
      
      loadAllMatches(selectedCategory, competitionId);
    } else if (selectedDate) {
      // Load data with the selected date and competition filter
      
      loadData(selectedDate, selectedCategory, competitionId);
    }
  };
  
  // Reload calendar with category/competition filters to update match counts
  const reloadCalendarWithFilters = async (categoryId: string, competitionId: string): Promise<string | null> => {
    
    
    // Load calendar with the filters
    await loadCalendarList(categoryId, competitionId);
    
    // Return the first date that has matches > 0
    const calendarData = (totelepepExtractor as any).calendarList || [];
    
    if (calendarData && calendarData.length > 0) {
      // Find first date with matches
      const firstDateWithMatches = calendarData.find((entry: any) => entry.matchCount > 0);
      if (firstDateWithMatches) {
        
        return firstDateWithMatches.entryDate;
      }
      // Fallback to first date even if it has 0 matches
      
      return calendarData[0].entryDate;
    }
    
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
    
    
  }, [selectedDate]);
  
  const loadData = async (targetDate?: string | null, categoryId?: string, competitionId?: string) => {
    setLoading(true);
    setError(null);
    
    
    // targetDate === null means "no date, get all matches"
    // targetDate === undefined means "use selectedDate"
    // targetDate === string means "use this specific date"
    let dateToFetch: string | undefined;
    if (targetDate === null) {
      dateToFetch = undefined;  // No date = API will use inclusive=1
      
    } else if (targetDate === undefined) {
      dateToFetch = selectedDate;  // Use selected date
      
    } else {
      dateToFetch = targetDate;  // Use provided date
      
    }
    
    const catId = categoryId !== undefined ? categoryId : selectedCategory;
    const compId = competitionId !== undefined ? competitionId : selectedCompetition;
    try {
      
      
      
      
      // Fetch matches DIRECTLY from Totelepep API with category/competition filters
      
      const fetchedMatches = await totelepepExtractor.extractMatches(dateToFetch, catId, compId);
      
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
      
    } catch (error) {
      
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Load ALL matches from all dates and combine them
  const loadAllMatches = async (categoryId?: string, competitionId?: string) => {
    setLoading(true);
    setError(null);
    
    
    
    
    // Use provided params or fall back to state
    const catId = categoryId !== undefined ? categoryId : selectedCategory;
    const compId = competitionId !== undefined ? competitionId : selectedCompetition;
    
    
    try {
      const allMatches: TotelepepMatch[] = [];
      
      // Use calendarList which has all the dates
      const datesToFetch = calendarList.length > 0 ? calendarList : availableDates;
      
      
      // Fetch matches from each date
      for (const dateInfo of datesToFetch) {
        
        try {
          const matches = await totelepepExtractor.extractMatches(dateInfo.date, catId, compId);
          
          allMatches.push(...matches);
        } catch (error) {
          
        }
      }
      
      
      
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
      
    } catch (error) {
      
      setError('Failed to load all matches. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load calendar list data with optional filters
  const loadCalendarList = async (categoryId?: string, competitionId?: string) => {
    try {
      const sourceName = selectedSource?.displayName || 'Totelepep';
      
      
      // Clear cache to ensure fresh data
      totelepepExtractor.clearCache();
      
      // We need to fetch with a date to get the calendar list
      // Use TODAY (not yesterday) to ensure we get the full calendar with matches
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      
      
      
      // Fetch with a date to get the calendar list
      const matches = await totelepepExtractor.extractMatches(dateStr, categoryId || '', competitionId || '');
      
      // Small delay to ensure calendarList is set
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get calendar list from extractor
      const calendarData = (totelepepExtractor as any).calendarList || [];
      
      
      
      if (calendarData && calendarData.length > 0) {
        
        
        const formattedCalendar = calendarData.map((entry: any) => ({
          date: entry.entryDate,
          matchCount: entry.matchCount || 0,
          displayName: entry.displayDate || entry.entryDate
        }));
        
        
        setCalendarList(formattedCalendar);
        
        // Set the selected date to the FIRST entry from the API (which is "Today" in API's timezone)
        const firstDate = formattedCalendar[0].date;
        
        setSelectedDate(firstDate);
        
        // NOTE: Don't auto-load matches here - let the caller (handleCategoryChange, etc.) do it
        // This prevents race conditions and double-loading
      }
      
      // Fetch categories from the API (only on initial load without filters)
      if (!categoryId) {
        
        const categoryList = await totelepepExtractor.fetchCategories();
        
        if (categoryList && categoryList.length > 0) {
          
          setCategories(categoryList.map(cat => ({
            id: cat.id,
            name: cat.name,
            competitions: [] // Will be populated when category is selected
          })));
        }
      }
    } catch (error) {
      
      setError('Failed to load calendar data from Totelepep API.');
    }
  };




  // Load initial data on mount
  useEffect(() => {
    
    
    
    // Clear all caches on initial load
    totelepepExtractor.clearCache();
    
    // Load calendar first - it will set the correct selected date from the API
    loadCalendarList().then(() => {
      // After calendar is loaded, load matches for the first date
      const firstDate = (totelepepExtractor as any).calendarList?.[0]?.entryDate;
      if (firstDate) {
        
        loadData(firstDate);
      }
    });
  }, []); // Only run once on mount
  
  // NOTE: Removed the useEffect that loaded data when selectedDate changed
  // This was causing race conditions with handleCategoryChange/handleCompetitionChange
  // Those handlers now directly call loadData with the correct date and filters

  // Filter matches by selected date and maintain grouping
  const filteredGroupedMatches = React.useMemo ? React.useMemo(() => {
    
    
    // Check if this is a Beyond date by checking if displayName contains "Beyond"
    const isBeyondDate = selectedDate && calendarList.find(entry => {
      return entry.date === selectedDate && (entry.displayName.includes('Beyond') || entry.displayName.includes('>>'));
    });
    
    let dateFiltered: Record<string, TotelepepMatch[]> = {};
    
    
    
    // Check if "All Matches" mode is enabled - this takes priority over date selection
    if (showAllMatches) {
      // Show ALL matches from all dates, sorted by time
      dateFiltered = { ...groupedMatches };
      
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
      
      Object.entries(dateFiltered).forEach(([date, dateMatches]) => {
        
        if (dateMatches.length > 0) {
          
        }
        const filteredMatches = dateMatches.filter(match => {
          // Convert both to string for comparison to handle type mismatch
          const matches = String(match.competitionId) === String(selectedCompetition);
          if (!matches) {
            
          }
          return matches;
        });
        
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
        console.log(`[App Filter] Starting odds filter for searchTerm: ${searchTerm}, searchMode: ${searchMode}`);
        
        // Check if this is an advanced filter with market type (DC, BTTS, UO, etc)
        // If so, filter to only matches that have the market type in the correct period
        const hasMarketType = /\d{2,3}(H1|H2|2H|FT|ALL)(DC|UO|BTTS|GM|CS|WM|OE|FTTS|LTTS|AH|HTFT|HSH)/i.test(searchTerm);
        
        let targetOdds = parseFloat(searchTerm);
        let positionFilter: 'home' | 'draw' | 'away' | null = null;
        let periodFilter: 'H1' | 'H2' | null = null;
        
        // Check for position suffix (H=Home, D=Draw, A=Away) and period (H1=1st Half, H2=2nd Half)
        const upperSearch = searchTerm.toUpperCase().trim();
        
        // Check for period + position suffix FIRST (H1H, H1D, H1A, H2H, H2D, H2A)
        if (upperSearch.endsWith('H1H') || upperSearch.endsWith('H1D') || upperSearch.endsWith('H1A')) {
          periodFilter = 'H1';
          const withoutPeriodAndPosition = upperSearch.slice(0, -3); // Remove H1H, H1D, or H1A (3 chars)
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
          const withoutPeriodAndPosition = upperSearch.slice(0, -3); // Remove H2H, H2D, or H2A (3 chars)
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
          // Incomplete period filter (e.g., "190H1" without H/D/A) - mark as invalid
          periodFilter = upperSearch.endsWith('H1') ? 'H1' : 'H2';
          positionFilter = null; // No position = incomplete
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
        
        // Parse range for "between" mode (e.g., "100-200", "100-200H1", "100-200H1H")
        let targetOddsMin = targetOdds;
        let targetOddsMax = targetOdds;
        if (searchMode === 'between' && searchTerm.includes('-')) {
          const rangeParts = searchTerm.split('-');
          if (rangeParts.length === 2) {
            let minStr = rangeParts[0].trim();
            let maxStr = rangeParts[1].trim();
            
            // Remove period/position suffixes from max value
            if (maxStr.toUpperCase().endsWith('H1H') || maxStr.toUpperCase().endsWith('H1D') || maxStr.toUpperCase().endsWith('H1A') ||
                maxStr.toUpperCase().endsWith('H2H') || maxStr.toUpperCase().endsWith('H2D') || maxStr.toUpperCase().endsWith('H2A')) {
              maxStr = maxStr.slice(0, -3);
            } else if (maxStr.toUpperCase().endsWith('H1') || maxStr.toUpperCase().endsWith('H2')) {
              maxStr = maxStr.slice(0, -2);
            } else if (maxStr.toUpperCase().endsWith('H') || maxStr.toUpperCase().endsWith('D') || maxStr.toUpperCase().endsWith('A')) {
              maxStr = maxStr.slice(0, -1);
            }
            
            targetOddsMin = parseFloat(minStr);
            targetOddsMax = parseFloat(maxStr);
            
            // Handle input like "100" as "1.00" for decimal odds
            if (!isNaN(targetOddsMin) && targetOddsMin > 10) {
              targetOddsMin = targetOddsMin / 100;
            }
            if (!isNaN(targetOddsMax) && targetOddsMax > 10) {
              targetOddsMax = targetOddsMax / 100;
            }
          }
        }
        
        if (isNaN(targetOdds) && searchMode !== 'between') {
          filteredDateMatches = [];
        } else if (hasMarketType) {
          // For market type filters, check if match has the required market in the correct period
          const upperSearch = searchTerm.toUpperCase().trim();
          const periodMatch = upperSearch.match(/\d{2,3}(H1|H2|2H|FT|ALL)/);
          const marketTypeMatch = upperSearch.match(/(DC|UO|BTTS|GM|CS|WM|OE)/);
          
          const periodCode = periodMatch ? periodMatch[1] : null;
          const marketType = marketTypeMatch ? marketTypeMatch[1] : null;
          
          filteredDateMatches = (dateMatches as TotelepepMatch[]).filter(match => {
            // If allMarkets not loaded yet, let it through temporarily
            if (!match.allMarkets || match.allMarkets.length === 0) {
              console.log(`[App Filter] allMarkets not loaded for ${match.homeTeam} vs ${match.awayTeam}, letting through`);
              return true;
            }
            
            return match.allMarkets.some(m => {
              // Check period
              if (periodCode === 'FT' && m.periodCode !== 'FT' && m.periodCode) return false;
              if (periodCode === 'H1' && m.periodCode !== 'H1' && m.periodCode !== 'HT') return false;
              if (periodCode === 'H2' && m.periodCode !== 'H2' && m.periodCode !== '2H') return false;
              
              // Check market type
              let isMatchingMarket = false;
              const marketName = m.marketDisplayName || m.name || '';
              
              if (marketType === 'DC') {
                isMatchingMarket = marketName.includes('Double Chance') || m.marketCode === 'DC';
              } else if (marketType === 'BTTS') {
                // API returns: "Both Team To Score " (with trailing space)
                isMatchingMarket = marketName.includes('Both Team To Score') || marketName.includes('BTTS');
              } else if (marketType === 'UO') {
                // API returns: "Under Over +2.5", "Under Over +3.5", etc.
                isMatchingMarket = marketName.includes('Under Over') || marketName.includes('Over/Under') || marketName.includes('Total Goals') || m.marketCode === 'OU';
                // Check line if specified
                if (isMatchingMarket) {
                  const lineMatch = searchTerm.toUpperCase().match(/UO([+-]?\d+\.\d+)/);
                  if (lineMatch) {
                    const searchLine = lineMatch[1];
                    const marketLine = m.marketLine || marketName.match(/([+-]?\d+\.\d+)/)?.[1];
                    console.log(`[App Filter] UO line check: searchLine=${searchLine}, marketLine=${marketLine}, marketName=${marketName}`);
                    if (marketLine !== searchLine) {
                      console.log(`[App Filter] ❌ Line mismatch, filtering out`);
                      isMatchingMarket = false;
                    } else {
                      console.log(`[App Filter] ✅ Line match`);
                    }
                  }
                }
              } else if (marketType === 'GM') {
                isMatchingMarket = marketName.includes('Goal Market');
              } else if (marketType === 'CS') {
                isMatchingMarket = marketName.includes('Correct Score');
              } else if (marketType === 'WM') {
                isMatchingMarket = marketName.includes('Winning Margin');
              } else if (marketType === 'OE') {
                isMatchingMarket = marketName.includes('Odd Even');
              } else if (marketType === 'FTTS') {
                isMatchingMarket = marketName.includes('First Team');
              } else if (marketType === 'LTTS') {
                isMatchingMarket = marketName.includes('Last Team');
              } else if (marketType === 'AH') {
                isMatchingMarket = marketName.includes('Asian Handicap') || m.marketCode === 'AH';
              } else if (marketType === 'HTFT') {
                isMatchingMarket = marketName.includes('Half Time/Full Time') || marketName.includes('HT/FT');
              } else if (marketType === 'HSH') {
                isMatchingMarket = marketName.includes('Highest Scoring Half');
              }
              
              if (!isMatchingMarket) return false;
              
              // Check if this market has selections with matching odds
              if (!m.selections || m.selections.length === 0) return false;
              
              return m.selections.some((sel: any) => {
                const selOdds = parseFloat(String(sel.odds));
                if (isNaN(selOdds)) return false;
                
                if (searchMode === 'eq') {
                  return Math.abs(selOdds - targetOdds) < 0.001;
                } else if (searchMode === 'gte') {
                  return selOdds >= targetOdds;
                } else if (searchMode === 'lte') {
                  return selOdds <= targetOdds;
                } else if (searchMode === 'between' && targetOddsMin !== undefined && targetOddsMax !== undefined) {
                  return selOdds >= targetOddsMin && selOdds <= targetOddsMax;
                }
                
                return false;
              });
            });
          });
        } else {
          filteredDateMatches = (dateMatches as TotelepepMatch[]).filter(match => {
            // Check if any of the match's odds match the filter
            const homeOdds = parseFloat(String(match.homeOdds));
            const drawOdds = parseFloat(String(match.drawOdds));
            const awayOdds = parseFloat(String(match.awayOdds));
            
            // If period filter is specified (H1 or H2) but no position, it means ANY position in that period
            // Check allMarkets if available
            if (periodFilter && !positionFilter) {
              if (match.allMarkets && match.allMarkets.length > 0) {
                // Try both '2H' and 'H2' for second half
                const possiblePeriodCodes = periodFilter === 'H1' ? ['H1'] : ['2H', 'H2'];
                
                if (searchTerm.includes('210')) {
                  console.log(`[App Filter] Checking match ${match.homeTeam} vs ${match.awayTeam} for 210H2, targetOdds: ${targetOdds}`);
                }
                
                // Check ALL markets in the specified period for matching odds
                for (const periodCode of possiblePeriodCodes) {
                  const periodMarkets = match.allMarkets.filter(m => 
                    m.periodCode === periodCode && m.selections && m.selections.length > 0
                  );
                  
                  for (const market of periodMarkets) {
                    const hasMatchingOdds = market.selections.some((sel: any) => {
                      const selOdds = parseFloat(String(sel.odds));
                      if (isNaN(selOdds)) return false;
                      
                      let matches = false;
                      if (searchMode === 'between') {
                        matches = selOdds >= targetOddsMin && selOdds <= targetOddsMax;
                      } else if (searchMode === 'gte') {
                        matches = selOdds >= targetOdds;
                      } else if (searchMode === 'lte') {
                        matches = selOdds <= targetOdds;
                      } else {
                        // Default: exact match
                        matches = Math.abs(selOdds - targetOdds) < 0.001;
                      }
                      
                      if (matches && searchTerm.includes('210')) {
                        console.log(`[App Filter] MATCH! Market: ${market.name}, Selection: ${sel.name}, Odds: ${selOdds}, Target: ${targetOdds}, Mode: ${searchMode}`);
                      }
                      
                      return matches;
                    });
                    
                    if (hasMatchingOdds) return true;
                  }
                }
                
                // No matching odds found in any period market
                return false;
              }
              // allMarkets not loaded yet - don't show match until we can verify
              return false;
            }
            
            // If period filter is specified with position, check allMarkets if available
            if (periodFilter && positionFilter) {
              // Try to check allMarkets if available
              if (match.allMarkets && match.allMarkets.length > 0) {
                // Try both '2H' and 'H2' for second half
                const possiblePeriodCodes = periodFilter === 'H1' ? ['H1'] : ['2H', 'H2'];
                let periodMarket = null;
                
                for (const periodCode of possiblePeriodCodes) {
                  periodMarket = match.allMarkets.find(m => 
                    (m.name === '1 X 2' || m.name === '1X2' || m.marketCode === 'CP') && 
                    m.periodCode === periodCode
                  );
                  if (periodMarket) break;
                }
                
                if (periodMarket && periodMarket.selections) {
                  // Find the specific position selection
                  const positionIndex = positionFilter === 'home' ? 0 : positionFilter === 'draw' ? 1 : 2;
                  const selection = periodMarket.selections[positionIndex];
                  
                  if (selection) {
                    const selOdds = parseFloat(String(selection.odds));
                    if (searchMode === 'eq') return selOdds === targetOdds;
                    if (searchMode === 'gte') return selOdds >= targetOdds;
                    if (searchMode === 'lte') return selOdds <= targetOdds;
                    if (searchMode === 'between') return selOdds >= targetOddsMin && selOdds <= targetOddsMax;
                  }
                }
              }
              // If allMarkets not available or no match, don't show
              return false;
            }
            
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
              } else if (searchMode === 'lte') {
                if (positionFilter === 'home') return homeOdds <= targetOdds;
                if (positionFilter === 'draw') return drawOdds <= targetOdds;
                if (positionFilter === 'away') return awayOdds <= targetOdds;
              } else if (searchMode === 'between') {
                if (positionFilter === 'home') return homeOdds >= targetOddsMin && homeOdds <= targetOddsMax;
                if (positionFilter === 'draw') return drawOdds >= targetOddsMin && drawOdds <= targetOddsMax;
                if (positionFilter === 'away') return awayOdds >= targetOddsMin && awayOdds <= targetOddsMax;
              }
            } else {
              // Filter any position (no suffix)
              if (searchMode === 'eq') {
                // = (equal to)
                return homeOdds === targetOdds || drawOdds === targetOdds || awayOdds === targetOdds;
              } else if (searchMode === 'gte') {
                // >= (greater than or equal)
                return homeOdds >= targetOdds || drawOdds >= targetOdds || awayOdds >= targetOdds;
              } else if (searchMode === 'lte') {
                // <= (less than or equal)
                return homeOdds <= targetOdds || drawOdds <= targetOdds || awayOdds <= targetOdds;
              } else if (searchMode === 'between') {
                // In between range
                return (homeOdds >= targetOddsMin && homeOdds <= targetOddsMax) ||
                       (drawOdds >= targetOddsMin && drawOdds <= targetOddsMax) ||
                       (awayOdds >= targetOddsMin && awayOdds <= targetOddsMax);
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
        
      }
    }
    
    return result;
  }, [groupedMatches, searchTerm, searchMode, selectedDate, calendarList, selectedCategory, selectedCompetition, showAllMatches]) : groupedMatches;

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
    
    
    
    // Use the calendarList data directly - this is the source of truth
    if (calendarList && calendarList.length > 0) {
      const sourceName = selectedSource?.displayName || 'Totelepep';
      
      return calendarList;
    }
    
    // Fallback to local calculation if calendarList is not available
    
    
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
      
      
      
      return {
        date: dateString,
        matchCount,
        displayName
      };
    });
    
    
    return result;
  }, [calendarList, matches]) : [];

  // Create filtered date counts based on active search filters
  const filteredAvailableDates = React.useMemo(() => {
    // If no active filter, return original counts
    if (searchMode === 'matches' && !searchTerm) {
      return availableDatesWithCounts;
    }
    
    // When search filter is active, calculate filtered counts
    const filteredCounts: Record<string, number> = {};
    
    // Get filtered counts from filteredGroupedMatches (contains the filtered matches)
    Object.entries(filteredGroupedMatches).forEach(([date, dateMatches]) => {
      filteredCounts[date] = dateMatches?.length || 0;
    });
    
    // Merge with availableDatesWithCounts
    // - For loaded dates (selected date or All Matches): shows filtered count
    // - For unloaded dates: shows original count (can't filter unloaded data)
    return availableDatesWithCounts.map(dateEntry => ({
      ...dateEntry,
      // Use filtered count if available (loaded date), otherwise show original count
      matchCount: filteredCounts[dateEntry.date] !== undefined 
        ? filteredCounts[dateEntry.date] 
        : dateEntry.matchCount
    }));
  }, [filteredGroupedMatches, availableDatesWithCounts, searchMode, searchTerm, showAllMatches]);

  // Debug: Log grouped matches to see what dates we have
  useEffect(() => {
    
  }, [groupedMatches]);

  // ========================================
  // AUTHENTICATION HANDLERS (AFTER ALL HOOKS)
  // ========================================
  
  // Check for existing session on mount
  useEffect(() => {
    // Don't auto-login - always show login screen on refresh (like anwh)
    // Session will be created when user logs in
    setUserSession(null);
    setIsLoading(false);
  }, []);

  const checkMaintenanceMode = async () => {
    try {
      const { data, error } = await supabase
        .from('metadata')
        .select('value')
        .eq('key', 'maintenanceMode')
        .single();
      
      if (error) {
        // If no metadata record exists, default to false
        if (error.code === 'PGRST116') {
          setIsMaintenanceEnabled(false);
        } else {
          // Silently fail
        }
      } else {
        setIsMaintenanceEnabled(data?.value === true);
      }
    } catch (err) {
      // Silently fail
    }
  };

  const handleLoginSuccess = (session: any) => {
    // Check if this is a logout (empty session)
    if (!session || !session.userId) {
      setUserSession(null);
      // Re-check maintenance mode on logout
      checkMaintenanceMode();
    } else {
      setUserSession(session);
      // Re-check maintenance mode on login
      checkMaintenanceMode();
    }
  };

  const handleLogout = async () => {
    await removeUserSession();
    setUserSession(null);
    setShowSettings(false);
  };
  
  const handleSettingsClick = () => {
    setShowSettings(true);
  };
  
  const handleCloseSettings = () => {
    setShowSettings(false);
  };
  
  // ========================================
  // EARLY RETURNS (AFTER ALL HOOKS AND HANDLERS)
  // ========================================
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated (ALWAYS show login, even during maintenance)
  if (!userSession) {
    return <UserLogin onLoginSuccess={handleLoginSuccess} />;
  }

  // Show maintenance mode screen (for non-admin users AFTER login)
  if (isMaintenanceEnabled && !userSession.isAdmin) {
    return <MaintenanceMode isEnabled={true} />;
  }

  // Show settings/profile if clicked
  if (showSettings) {
    return (
      <UserProfile 
        user={{
          id: userSession.userId,
          idNumber: userSession.idNumber,
          surname: userSession.surname || '',
          name: userSession.name || '',
          isAdmin: userSession.isAdmin
        }}
        onLoginSuccess={handleLoginSuccess}
        onClose={handleCloseSettings}
      />
    );
  }

  const handlePriceClick = (matchId: string, priceType: string, odds: number | string, marketBookNo?: string, marketCode?: string, marketId?: string, marketLine?: string, periodCode?: string, marketDisplayName?: string, optionCode?: string, optionNo?: string) => {
    // Find the match details
    const match = matches.find(m => m.id === matchId);
    if (match) {
      // Check if this exact selection already exists
      const existingIndex = parlaySelections.findIndex(
        s => s.matchId === matchId && s.priceType === priceType
      );
      
      if (existingIndex >= 0) {
        // Remove existing selection (toggle off) and revalidate remaining selections
        setParlaySelections(prev => {
          // Remove the toggled selection
          const filtered = prev.filter((_, index) => index !== existingIndex);
          
          // Revalidate: clear errors on remaining selections from same match
          // (since the duplicate is now gone)
          return filtered.map(s => 
            s.matchId === matchId ? { ...s, hasError: false } : s
          );
        });
      } else {
        // Validate the selection
        let hasError = false;
        let errorMessage = '';

        // Check 1: Match has already started
        if (match.kickoff) {
          const now = new Date();
          const [hours, minutes] = match.kickoff.split(':').map(Number);
          const matchTime = new Date();
          matchTime.setHours(hours, minutes, 0, 0);
          
          console.log('⏰ Time Check:', {
            kickoff: match.kickoff,
            now: now.toLocaleTimeString(),
            matchTime: matchTime.toLocaleTimeString(),
            isPast: matchTime < now,
            differenceMinutes: (now.getTime() - matchTime.getTime()) / 60000
          });
          
          // If match time is more than 5 minutes in the past, consider it started
          if (matchTime < new Date(now.getTime() - 5 * 60000)) {
            hasError = true;
            errorMessage = 'Match has already started';
            console.log('❌ Match started error');
          }
        }

        // Check 2: Duplicate match (any selection from same match)
        if (!hasError) {
          const isDuplicate = parlaySelections.some(s => 
            s.matchId === matchId
          );
          
          console.log('🔄 Duplicate Check:', {
            matchId,
            priceType,
            existingSelections: parlaySelections.map(s => ({ matchId: s.matchId, priceType: s.priceType })),
            isDuplicate
          });
          
          if (isDuplicate) {
            hasError = true;
            errorMessage = 'Duplicate match detected';
            console.log('❌ Duplicate error');
          }
        }

        console.log('✅ Final hasError:', hasError, errorMessage);

        // Use the marketBookNo and marketCode passed from the click event
        const finalMarketBookNo = (marketBookNo && marketBookNo !== 'undefined' && marketBookNo !== 'null') 
          ? marketBookNo 
          : (match.marketBookNo || match.id);
        
        const finalMarketCode = (marketCode && marketCode !== 'undefined' && marketCode !== 'null') 
          ? marketCode 
          : (match.marketCode || 'CP');
      
        // Add new selection with error flag
        const newSelection: ParlaySelection = {
          matchId,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          priceType,
          odds,
          league: match.league,
          kickoff: match.kickoff,
          matchDate: match.date,
          competitionId: match.competitionId,
          // Ensure marketId is always set - fallback chain
          marketId: marketId || 
                    (match.marketId && match.marketId !== '0' && match.marketId !== 'undefined' && match.marketId !== 'null' 
                      ? match.marketId 
                      : marketBookNo || match.id || '0'),
          marketBookNo: finalMarketBookNo,
          marketCode: finalMarketCode,
          marketLine: marketLine || '',
          periodCode: periodCode || 'FT',
          marketDisplayName: marketDisplayName || '',
          optionCode: optionCode || '',
          optionNo: optionNo || '',
          hasError: hasError, // Mark if this selection has an error
        };
        
        console.log('📝 New Selection:', {
          matchId,
          marketId: newSelection.marketId,
          priceType,
          hasError
        });
        
        // If this is a duplicate, mark BOTH selections with error
        if (hasError && errorMessage === 'Duplicate match detected') {
          setParlaySelections(prev => {
            // Mark ALL selections from same matchId as error
            const updated = prev.map(s => 
              s.matchId === matchId
                ? { ...s, hasError: true }
                : s
            );
            // Add the new selection (which also has hasError: true)
            return [...updated, newSelection];
          });
        } else {
          setParlaySelections(prev => [...prev, newSelection]);
        }
      }
    }
  };

  const handleRemoveSelection = (matchId: string, priceType?: string) => {
    setParlaySelections(prev => {
      // Remove the specific selection
      const updated = priceType 
        ? prev.filter(s => !(s.matchId === matchId && s.priceType === priceType))
        : prev.filter(s => s.matchId !== matchId);
      
      // If we removed one of a duplicate pair, clear the error on the remaining one
      if (priceType) {
        const remainingMatchSelections = updated.filter(s => s.matchId === matchId);
        if (remainingMatchSelections.length === 1 && remainingMatchSelections[0].hasError) {
          // Clear the error since the duplicate is gone
          return updated.map(s => 
            s.matchId === matchId ? { ...s, hasError: false } : s
          );
        }
      }
      
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
    
    
    
    
    // Turn off All Matches when a specific date is selected
    if (showAllMatches) {
      setShowAllMatches(false);
      
    }
    
    // Keep search filters when changing dates
    // setSearchTerm, setSearchMode, and setSearchOddsValue are NOT reset
    
    setSelectedDate(newDate);
    
    // Handle "beyond" date - check if this date corresponds to Beyond entry
    const isBeyondDate = availableDatesWithCounts.find(d => 
      d.date === newDate && (d.displayName.includes('Beyond') || d.displayName.includes('>>'))
    );
    
    if (isBeyondDate) {
      
      // Extract just the date part (YYYY-MM-DD) from the ISO string
      const beyondDate = newDate.split('T')[0];
      
      // Pass the date - API will use inclusive=1 to return all matches from that date onwards
      loadData(beyondDate, selectedCategory, selectedCompetition);
    } else {
      // For regular dates, load with current filters
      
      loadData(newDate, selectedCategory, selectedCompetition);
    }
  };
  
  const toggleParlayBuilder = () => {
    setShowParlayBuilder(prev => !prev);
  };
  
  const toggleAllMatches = () => {
    const newState = !showAllMatches;
    setShowAllMatches(newState);
    
    
    if (newState) {
      // Turn ON All Matches - fetch matches from ALL dates and combine them
      
      
      // Clear current matches and show loading
      setMatches([]);
      setGroupedMatches({});
      
      // Load all matches with current filters
      loadAllMatches(selectedCategory, selectedCompetition);
    } else {
      // Turn OFF All Matches, restore to today's date
      const today = getTodayDate();
      setSelectedDate(today);
      
      loadData(today, selectedCategory, selectedCompetition);
    }
  };






  return (
    <div className="min-h-screen bg-gray-100">
      {/* Combined Sticky Header: Header + Date Selector + Search */}
      <div className="sticky top-0 z-40" id="main-sticky-header">
        <Header
          selectionCount={parlaySelections.length}
          hasInvalidSelections={parlaySelections.some(s => s.hasError)}
          onSlipClick={toggleParlayBuilder}
          selectedSource={selectedSource}
          onSourceChange={handleSourceChange}
          onSettingsClick={handleSettingsClick}
        />
        
        {/* Date Selector */}
        <DateSelector
          selectedDate={selectedDate} 
          onDateChange={handleDateChange}
          availableDates={filteredAvailableDates}
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
                placeholder={searchMode === 'matches' ? 'Search matches...' : searchMode === 'eq' ? 'e.g., 130H, 130D, 130A, 130H1H' : 'Enter odds (e.g., 130H, 150H2A)...'}
                value={searchTerm}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchTerm(value);
                  
                  // If search is cleared (backspace to empty), reset to matches mode
                  if (value === '' && searchMode !== 'matches') {
                    setSearchMode('matches');
                    setSearchOddsValue('');
                  }
                }}
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
                
                // Only clear search when switching TO "Matches" mode
                if (mode === 'matches') {
                  setSearchTerm('');
                  setSearchOddsValue('');
                }
                // When switching between odds modes (=, >=, <=), keep the search text
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-medium"
            >
              <option value="matches">Matches</option>
              {/* Show odds filters only if NOT a range pattern */}
              {(() => {
                const hasDash = searchTerm.includes('-');
                // Check if it's a valid range: two numbers (3+ digits each) separated by -
                const rangeMatch = searchTerm.match(/^(\d{3,})-(\d{3,})/);
                const isValidRange = rangeMatch !== null;
                
                // Auto-switch searchMode based on pattern
                if (searchMode === 'between' && !isValidRange) {
                  // Was "In Between" but no longer valid - switch to "Equal to"
                  if (hasDash) {
                    // Invalid range like "55-130" - switch to matches mode
                    setSearchMode('matches');
                  } else {
                    // No dash - switch to equal
                    setSearchMode('eq');
                  }
                } else if (searchMode !== 'between' && searchMode !== 'matches' && isValidRange) {
                  // Is single-value mode but now has valid range - switch to "In Between"
                  setSearchMode('between');
                }
                
                if (hasDash && !isValidRange) {
                  // Has dash but invalid range (e.g., "55-130") - show nothing except Matches
                  return null;
                } else if (isValidRange) {
                  // Valid range (e.g., "120-155H") - show only "In Between"
                  return <option value="between">↔ In Between</option>;
                } else {
                  // No dash - show all single-value operators
                  return (
                    <>
                      <option value="eq">= Equal to</option>
                      <option value="gte">≥ Greater or Equal</option>
                      <option value="lte">≤ Less or Equal</option>
                    </>
                  );
                }
              })()}
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