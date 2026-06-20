import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, Calendar, AlertCircle, Calculator, Database, Lightbulb, Trash2, Play, Pause, X, Ticket } from 'lucide-react';
import { Target } from 'lucide-react';
import DateGroupedMatches from './components/DateGroupedMatches';
import DateSelector from './components/DateSelector';
import CompetitionFilter from './components/CompetitionFilter';
import Header, { API_SOURCES, ApiSource } from './components/Header';
import StatsCards from './components/StatsCards';
import ParlayBuilder, { ParlaySelection } from './components/ParlayBuilder';
import BookingHistory from './components/BookingHistory';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import DataExtractor from './components/DataExtractor';
import EndpointDiscovery from './components/EndpointDiscovery';
import ResponseAnalyzer from './components/ResponseAnalyzer';
import AlternativeSolutions from './components/AlternativeSolutions';
import MatchSpecificTester from './components/MatchSpecificTester';
import { getAllBookingsFromDB } from './utils/bookingStorage';
import BetPlacementAnalyzer from './components/BetPlacementAnalyzer';
import BookingDiscoveryGuide from './components/BookingDiscoveryGuide';
import UserLogin from './components/UserLogin';
import UserProfile from './components/UserProfile';
import { MaintenanceMode } from './components/MaintenanceMode';
import { totelepepService } from './services/totelepepService';
import { totelepepExtractor } from './services/totelepepExtractor';
import type { TotelepepMatch } from './services/totelepepExtractor';
import { saveBetslip, loadBetslip, clearBetslip } from './utils/matchCache';
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
  const [showBookingHistory, setShowBookingHistory] = useState(false);
  const [savedBookingsCount, setSavedBookingsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Load booking count on mount
  useEffect(() => {
    const loadBookingCount = async () => {
      try {
        const bookings = await getAllBookingsFromDB();
        setSavedBookingsCount(bookings.length);
      } catch (error) {
      }
    };
    
    loadBookingCount();
  }, []);
  
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
  const [showClearAllModal, setShowClearAllModal] = useState(false); // Confirmation modal
  
  // Market loading progress per date
  const [dateProgress, setDateProgress] = useState<Record<string, {
    loaded: number;
    total: number;
    isComplete: boolean;
  }>>({});
  
  // Progress for "All Matches" view (combined across all dates)
  const [allMatchesProgress, setAllMatchesProgress] = useState<{
    loaded: number;
    total: number;
    isComplete: boolean;
    percentage: number;
  } | null>(null);
  
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
    
    // Cancel ALL background loading tasks from previous source
    totelepepExtractor.cancelAllBackgroundLoading();
    
    // Clear in-memory cache
    totelepepExtractor.clearCache();
    
    // Clear ALL IndexedDB caches (old source data)
    try {
      const { clearCacheMatches, cleanupStaleDateCaches } = await import('./utils/matchCache');
      const oldSourceId = selectedSource?.id || 'totelepep';
      
      // Clear all date caches for old source
      const datesToClear = availableDates.length > 0 ? availableDates : [];
      for (const date of datesToClear) {
        const cacheKey = `date_${date}_all_all_${oldSourceId}`;
        await clearCacheMatches(cacheKey);
      }
      
      // Clear All Matches cache for old source
      const allMatchesCacheKey = `all_matches_all_all_${oldSourceId}`;
      await clearCacheMatches(allMatchesCacheKey);
      
      console.log(`[Source Change] Cleared all IndexedDB caches for source: ${oldSourceId}`);
    } catch (error) {
      console.error('[Source Change] Error clearing IndexedDB:', error);
    }
    
    // Set loading state FIRST (prevents "No matches" flash)
    setLoading(true);
    
    // Clear current matches immediately
    setMatches([]);
    setGroupedMatches({});
    
    // Reset progress state
    setDateProgress({});
    
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
      
      loadData(selectedDate, '', '', true); // forceFresh=true to ensure API fetch
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
  
  const loadData = async (targetDate?: string | null, categoryId?: string, competitionId?: string, forceFresh: boolean = false) => {
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
    
    // Check if date is already complete in cache before setting to loading state
    // This prevents green buttons from turning blue when clicked again
    const sourceId = selectedSource?.id || 'totelepep';
    const cacheKey = `date_${dateToFetch}_${catId || 'all'}_${compId || 'all'}_${sourceId}`;
    
    // Only set to loading state if cache is expired or incomplete
    const { getCachedMatches: checkCached, isCacheExpired: checkExpired } = await import('./utils/matchCache');
    const { matches: existingCache, metadata: existingMetadata } = await checkCached(cacheKey);
    const isExpired = await checkExpired(cacheKey);
    const isAlreadyComplete = existingCache && existingCache.length > 0 && 
                              existingMetadata?.isComplete && 
                              !isExpired &&
                              existingCache.every((m: any) => m.allMarkets && m.allMarkets.length > 0);
    
    console.log(`[LoadData] ${dateToFetch}: isAlreadyComplete=${isAlreadyComplete}, cache=${existingCache?.length || 0}, expired=${isExpired}, complete=${existingMetadata?.isComplete}`);
    
    if (dateToFetch && !isAlreadyComplete) {
      // Set progress to loading state (BLUE) only if not already complete
      setDateProgress(prev => ({
        ...prev,
        [dateToFetch]: {
          loaded: prev[dateToFetch]?.loaded || 0,
          total: prev[dateToFetch]?.total || 0,
          isComplete: false // Force to loading state
        }
      }));
    } else if (dateToFetch && isAlreadyComplete) {
      // Cache is already complete - ensure progress state reflects this
      setDateProgress(prev => ({
        ...prev,
        [dateToFetch]: {
          loaded: existingCache.length,
          total: existingCache.length,
          isComplete: true // Force to complete state (GREEN)
        }
      }));
    }
    
    // Prevent duplicate loads for the same date with same filters
    const loadKey = `${dateToFetch}_${catId}_${compId}_${sourceId}`;
    if ((window as any).__loadingDate === loadKey) {
      console.log(`[LoadData] ${dateToFetch}: Already loading, skipping duplicate call`);
      setLoading(false);
      return;
    }
    (window as any).__loadingDate = loadKey;
    
    try {
      const { getCachedMatches, isCacheExpired } = await import('./utils/matchCache');
      console.log(`[Cache Check] Reading cache with key: ${cacheKey}`);
      const { matches: cachedMatches, metadata } = await getCachedMatches(cacheKey);
      const expired = await isCacheExpired(cacheKey);
      
      // Log cache status
      if (cachedMatches && cachedMatches.length > 0) {
        const cacheAge = metadata?.lastUpdated ? Math.round((Date.now() - metadata.lastUpdated) / 60000) : 0;
        const matchesWithMarkets = cachedMatches.filter((m: any) => m.allMarkets && m.allMarkets.length > 0).length;
        console.log(`[Cache] ${dateToFetch}: ${cachedMatches.length} matches found (${matchesWithMarkets} with markets), ${expired ? 'EXPIRED' : 'VALID'} (${cacheAge}min old)`);
      } else {
        console.log(`[Cache] ${dateToFetch}: NO CACHE - will fetch from API`);
      }
      
      // STEP 1: Load from cache immediately (even if expired)
      // This ensures data is always available
      // BUT skip if forceFresh - always fetch fresh data
      // ALSO skip if cache is incomplete - wait for API to get full data
      if (cachedMatches && cachedMatches.length > 0 && !forceFresh && metadata?.isComplete) {
        
        // Filter out matches that already started (kickoff passed)
        const now = new Date();
        
        const validMatches = cachedMatches.filter((m: any) => {
          if (!m.kickoff) return true;
          
          // Handle different kickoff formats:
          // 1. "23:00" (time only) - need to combine with match date
          // 2. "2026-06-19T23:00:00" (full ISO datetime)
          let kickoffTime: Date;
          if (m.kickoff.includes('T')) {
            // Full ISO datetime
            kickoffTime = new Date(m.kickoff);
          } else {
            // Time only (e.g., "23:00") - combine with match date
            const matchDate = m.date || dateToFetch;
            kickoffTime = new Date(`${matchDate}T${m.kickoff}`);
          }
          
          const isFuture = kickoffTime > now;
          if (!isFuture) {
          }
          return isFuture;
        });
        
        
        const sortedMatches = validMatches.sort((a, b) => {
          const dateComparison = new Date(a.date || '').getTime() - new Date(b.date || '').getTime();
          if (dateComparison !== 0) return dateComparison;
          return a.kickoff.localeCompare(b.kickoff);
        });
        
        setMatches(sortedMatches);
        const grouped = totelepepService.groupMatchesByDate(sortedMatches);
        setGroupedMatches(grouped);
        
        // If cache is valid, mark as complete
        if (!expired && metadata?.isComplete) {
          const matchesWithMarkets = validMatches.filter((m: any) => m.allMarkets && m.allMarkets.length > 0).length;
          console.log(`[Cache] ${dateToFetch}: Using cached data (${matchesWithMarkets}/${validMatches.length} markets loaded)`);
          
          // Only update progress if NOT currently loading in background
          // This prevents overwriting the live progress from background market loading
          const currentProgress = dateProgress[dateToFetch!];
          const isBackgroundLoading = currentProgress && currentProgress.total > 0 && !currentProgress.isComplete;
          
          if (!isBackgroundLoading) {
            setDateProgress(prev => ({
              ...prev,
              [dateToFetch!]: {
                loaded: matchesWithMarkets,
                total: cachedMatches.length, // Use ORIGINAL total (matches background loader expectation)
                isComplete: matchesWithMarkets === cachedMatches.length
              }
            }));
          } else {
            console.log(`[Cache] ${dateToFetch}: Background loading in progress, preserving current progress state`);
          }
          
          setLoading(false);
          return;
        }
      }
      
      // STEP 2: Fetch fresh data from API (in background if we have cache)
      console.log(`[API] Fetching from Totelepep for ${dateToFetch}...`);
      
      // Capture source ID and filters at load START to prevent stale values during auto-merge
      const loadSourceId = selectedSource?.id || 'totelepep';
      const loadCategory = catId || 'all';
      const loadCompetition = compId || 'all';
      
      // Set up market progress callback before fetching
      totelepepExtractor.onMarketProgress = async (date, loaded, total) => {
        const percentage = Math.round((loaded / total) * 100);
        console.log(`[Progress] ${date}: ${loaded}/${total} markets loaded (${percentage}%)`);
        setDateProgress(prev => ({
          ...prev,
          [date]: {
            loaded,
            total,
            isComplete: loaded >= total
          }
        }));
        
        // When date completes (turns GREEN), auto-merge into All Matches cache
        if (loaded >= total) {
          console.log(`[Auto-Merge] ${date} complete! Merging into All Matches cache...`);
          // Use captured values from load start, not current state
          await mergeDateIntoAllMatches(date, loadSourceId, loadCategory, loadCompetition);
          
          // Refresh UI from IndexedDB now that loading is complete
          console.log(`[Refresh] ${date}: Background loading complete, refreshing UI from IndexedDB...`);
          try {
            const cacheKey = `date_${date}_${loadCategory}_${loadCompetition}_${loadSourceId}`;
            const { getCachedMatches } = await import('./utils/matchCache');
            const { matches: completeCache } = await getCachedMatches(cacheKey);
            
            if (completeCache && completeCache.length > 0) {
              // Filter out past matches
              const now = new Date();
              const validMatches = completeCache.filter((m: any) => {
                if (!m.kickoff) return true;
                let kickoffTime: Date;
                if (m.kickoff.includes('T')) {
                  kickoffTime = new Date(m.kickoff);
                } else {
                  const matchDate = m.date || date;
                  kickoffTime = new Date(`${matchDate}T${m.kickoff}`);
                }
                return kickoffTime > now;
              });
              
              // Sort and display
              const sortedMatches = validMatches.sort((a, b) => {
                const dateComparison = new Date(a.date || '').getTime() - new Date(b.date || '').getTime();
                if (dateComparison !== 0) return dateComparison;
                return a.kickoff.localeCompare(b.kickoff);
              });
              
              setMatches(sortedMatches);
              const grouped = totelepepService.groupMatchesByDate(sortedMatches);
              setGroupedMatches(grouped);
              console.log(`[Refresh] ${date}: UI refreshed with ${sortedMatches.length} matches from IndexedDB`);
            }
          } catch (error) {
            console.error(`[Refresh] ${date}: Error refreshing UI from IndexedDB:`, error);
          }
        }
      };

      // Fetch matches DIRECTLY from Totelepep API with category/competition filters
      const fetchedMatches = await totelepepExtractor.extractMatches(dateToFetch, catId, compId, undefined, forceFresh);
      console.log(`[API] ${dateToFetch}: Received ${fetchedMatches.length} matches from API`);
      if (fetchedMatches.length === 0) {
        console.warn(`[API] ${dateToFetch}: WARNING - API returned 0 matches!`);
        
        // If API returns 0 but we have partial cache, use the cache instead
        if (cachedMatches && cachedMatches.length > 0) {
          console.log(`[Fallback] ${dateToFetch}: API returned 0, using ${cachedMatches.length} partial matches from cache`);
          fetchedMatches.length = 0; // Clear the array
          fetchedMatches.push(...cachedMatches); // Use cached data
        }
      }
      
      // STEP 3: Merge cached data with fresh data
      // Add new matches, update existing ones
      let mergedMatches = fetchedMatches;
      
      if (cachedMatches && cachedMatches.length > 0) {
        console.log(`[Merge] ${dateToFetch}: Merging ${fetchedMatches.length} fresh matches with ${cachedMatches.length} cached matches`);
        // Create a map of existing matches by ID
        const existingMap = new Map();
        cachedMatches.forEach((m: any) => existingMap.set(m.id, m));
        
        // Merge: update existing or add new
        fetchedMatches.forEach((freshMatch: any) => {
          if (existingMap.has(freshMatch.id)) {
            // Update existing match (new odds, markets)
            existingMap.set(freshMatch.id, freshMatch);
          } else {
            // Add new match
            existingMap.set(freshMatch.id, freshMatch);
          }
        });
        
        mergedMatches = Array.from(existingMap.values());
      }
      
      // Filter out matches that already started
      const now = new Date();
      
      const validMatches = mergedMatches.filter((m: any) => {
        if (!m.kickoff) return true;
        
        // Handle different kickoff formats
        let kickoffTime: Date;
        if (m.kickoff.includes('T')) {
          kickoffTime = new Date(m.kickoff);
        } else {
          const matchDate = m.date || dateToFetch;
          kickoffTime = new Date(`${matchDate}T${m.kickoff}`);
        }
        
        const isFuture = kickoffTime > now;
        if (!isFuture) {
        }
        return isFuture;
      });
      
      
      // Sort matches by date and time
      const sortedMatches = validMatches.sort((a, b) => {
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
      setError('Failed to load data. Please try again.');
    } finally {
      // Clear the loading guard
      console.log(`[LoadData] ${dateToFetch}: Load complete, clearing guard`);
      (window as any).__loadingDate = null;
      setLoading(false);
    }
  };
  
  // Auto-merge completed date matches into All Matches cache
  const mergeDateIntoAllMatches = async (date: string, sourceId?: string, categoryId?: string, competitionId?: string) => {
    try {
      const { getCachedMatches, saveMatchesChunk } = await import('./utils/matchCache');
      
      // Use provided source ID and filters (captured at load start), or fall back to current state
      const mergeSourceId = sourceId || selectedSource?.id || 'totelepep';
      const mergeCategoryId = categoryId !== undefined ? categoryId : selectedCategory;
      const mergeCompetitionId = competitionId !== undefined ? competitionId : selectedCompetition;
      
      // Get matches for this specific date
      const dateCacheKey = `date_${date}_${mergeCategoryId || 'all'}_${mergeCompetitionId || 'all'}_${mergeSourceId}`;
      const { matches: dateMatches } = await getCachedMatches(dateCacheKey);
      
      if (!dateMatches || dateMatches.length === 0) {
        console.log(`[Auto-Merge] ${date}: No matches to merge`);
        return;
      }
      
      console.log(`[Auto-Merge] ${date}: ${dateMatches.length} matches ready to merge`);
      
      // Get existing All Matches cache
      const allMatchesCacheKey = `all_matches_${mergeCategoryId || 'all'}_${mergeCompetitionId || 'all'}_${mergeSourceId}`;
      const { matches: existingAllMatches, metadata } = await getCachedMatches(allMatchesCacheKey);
      
      // Merge logic: add new, update existing
      let mergedMatches = dateMatches;
      
      if (existingAllMatches && existingAllMatches.length > 0) {
        console.log(`[Auto-Merge] Merging with ${existingAllMatches.length} existing All Matches`);
        
        // Create map of existing matches
        const existingMap = new Map();
        existingAllMatches.forEach((m: any) => existingMap.set(m.id, m));
        
        // Merge: update existing or add new
        dateMatches.forEach((newMatch: any) => {
          if (existingMap.has(newMatch.id)) {
            // Update existing match with new data (markets, odds)
            existingMap.set(newMatch.id, newMatch);
          } else {
            // Add new match
            existingMap.set(newMatch.id, newMatch);
          }
        });
        
        mergedMatches = Array.from(existingMap.values());
        console.log(`[Auto-Merge] Result: ${mergedMatches.length} total matches`);
      }
      
      // Save merged matches to All Matches cache
      const chunkSize = (await import('./utils/matchCache')).getChunkSize();
      for (let i = 0; i < mergedMatches.length; i += chunkSize) {
        const chunk = mergedMatches.slice(i, i + chunkSize);
        const loadedCount = Math.min(i + chunkSize, mergedMatches.length);
        const isComplete = loadedCount >= mergedMatches.length;
        await saveMatchesChunk(chunk, allMatchesCacheKey, loadedCount, mergedMatches.length, isComplete);
      }
      
      console.log(`[Auto-Merge] ${date}: Successfully merged into All Matches cache`);
      
      // If All Matches is currently active, reload it to show new data
      if (showAllMatches) {
        console.log('[Auto-Merge] All Matches is active, reloading...');
        loadAllMatches(selectedCategory, selectedCompetition);
      }
      
      // AUTO-LOAD NEXT DATE: Sequential loading after current date completes
      console.log(`[Auto-Load] ${date} complete, checking for next date to load...`);
      autoLoadNextDate(date, mergeSourceId, mergeCategoryId, mergeCompetitionId);
    } catch (error) {
      console.error('[Auto-Merge] Error merging date into All Matches:', error);
    }
  };
  
  // Auto-load next date in sequence (sequential loading)
  const autoLoadNextDate = async (completedDate: string, sourceId: string, categoryId: string, competitionId: string) => {
    try {
      // Check if we already auto-loaded this date (prevent duplicate auto-loads)
      const autoLoadKey = `autoLoad_${completedDate}`;
      if ((window as any).__autoLoadCompleted === autoLoadKey) {
        console.log(`[Auto-Load] ${completedDate} already triggered auto-load, skipping`);
        return;
      }
      (window as any).__autoLoadCompleted = autoLoadKey;
      
      const calendarList = (totelepepExtractor as any).calendarList || [];
      
      // Find the index of the completed date
      const completedIndex = calendarList.findIndex((d: any) => d.entryDate === completedDate);
      
      if (completedIndex === -1) {
        console.log('[Auto-Load] Completed date not found in calendar');
        return;
      }
      
      // Get next date
      const nextDateEntry = calendarList[completedIndex + 1];
      
      if (!nextDateEntry) {
        console.log('[Auto-Load] No more dates to load - all dates complete!');
        return;
      }
      
      const nextDate = nextDateEntry.entryDate;
      console.log(`[Auto-Load] Loading next date: ${nextDate}`);
      
      // Check if next date is already complete
      const { getCachedMatches, isCacheExpired } = await import('./utils/matchCache');
      const nextCacheKey = `date_${nextDate}_${categoryId || 'all'}_${competitionId || 'all'}_${sourceId}`;
      const { matches: nextCache, metadata: nextMetadata } = await getCachedMatches(nextCacheKey);
      const nextExpired = await isCacheExpired(nextCacheKey);
      
      const isNextComplete = nextCache && nextCache.length > 0 && 
                            nextMetadata?.isComplete && 
                            !nextExpired &&
                            nextCache.every((m: any) => m.allMarkets && m.allMarkets.length > 0);
      
      if (isNextComplete) {
        console.log(`[Auto-Load] ${nextDate} already complete, skipping to next...`);
        // Recursively try the next date
        autoLoadNextDate(nextDate, sourceId, categoryId, competitionId);
        return;
      }
      
      // Load the next date
      loadData(nextDate, categoryId === 'all' ? undefined : categoryId, 
               competitionId === 'all' ? undefined : competitionId, true);
    } catch (error) {
      console.error('[Auto-Load] Error loading next date:', error);
    }
  };
  
  // Load ALL matches from progressive cache (auto-built as dates complete)
  const loadAllMatches = async (categoryId?: string, competitionId?: string) => {
    setLoading(true);
    setError(null);

    // Use provided params or fall back to state
    const catId = categoryId !== undefined ? categoryId : selectedCategory;
    const compId = competitionId !== undefined ? competitionId : selectedCompetition;

    try {
      // Load from All Matches progressive cache
      const sourceId = selectedSource?.id || 'totelepep';
      const cacheKey = `all_matches_${catId || 'all'}_${compId || 'all'}_${sourceId}`;
      const { getCachedMatches, isCacheExpired } = await import('./utils/matchCache');
      const { matches: cachedAllMatches, metadata } = await getCachedMatches(cacheKey);
      const expired = await isCacheExpired(cacheKey);
      
      console.log(`[All Matches] Cache check: ${cachedAllMatches?.length || 0} matches, ${expired ? 'EXPIRED' : 'VALID'}`);
      
      if (!cachedAllMatches || cachedAllMatches.length === 0 || expired) {
        console.log('[All Matches] No valid cache - please load individual dates first');
        setMatches([]);
        setGroupedMatches({});
        setAllMatchesProgress({
          loaded: 0,
          total: 0,
          isComplete: false,
          percentage: 0
        });
        setLoading(false);
        return;
      }
      
      // Filter out kickoff-passed matches
      const now = new Date();
      const validMatches = cachedAllMatches.filter((m: any) => {
        if (!m.kickoff) return true;
        
        let kickoffTime: Date;
        if (m.kickoff.includes('T')) {
          kickoffTime = new Date(m.kickoff);
        } else {
          const matchDate = m.date;
          kickoffTime = new Date(`${matchDate}T${m.kickoff}`);
        }
        
        return kickoffTime > now;
      });
      
      console.log(`[All Matches] ${validMatches.length} matches after filtering kickoff-passed (was ${cachedAllMatches.length})`);
      
      // Sort matches by date and time
      const sortedMatches = validMatches.sort((a, b) => {
        const dateComparison = new Date(a.date || '').getTime() - new Date(b.date || '').getTime();
        if (dateComparison !== 0) return dateComparison;
        return a.kickoff.localeCompare(b.kickoff);
      });
      
      setMatches(sortedMatches);
      
      // Group matches by date
      const grouped = totelepepService.groupMatchesByDate(sortedMatches);
      setGroupedMatches(grouped);
      
      // Check how many have markets loaded
      const matchesWithMarkets = sortedMatches.filter((m: any) => m.allMarkets && m.allMarkets.length > 0).length;
      const isComplete = matchesWithMarkets === sortedMatches.length;
      
      console.log(`[All Matches] ${matchesWithMarkets}/${sortedMatches.length} have markets loaded`);
      
      // Mark as complete if all have markets
      setAllMatchesProgress({
        loaded: matchesWithMarkets,
        total: sortedMatches.length,
        isComplete,
        percentage: sortedMatches.length > 0 ? (matchesWithMarkets / sortedMatches.length) * 100 : 0
      });
      
      setLastUpdated(new Date());
      
    } catch (error) {
      console.error('[All Matches] Error loading:', error);
      setError('Failed to load all matches. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load calendar list data with optional filters
  const loadCalendarList = async (categoryId?: string, competitionId?: string) => {
    try {
      const sourceName = selectedSource?.displayName || 'Totelepep';

      // Clear in-memory cache ONLY (keep IndexedDB for matches)
      (totelepepExtractor as any).cache = new Map();
      
      // We need to fetch with a date to get the calendar list
      // Use TODAY (not yesterday) to ensure we get the full calendar with matches
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      // IMPORTANT: Pass a callback to force fresh API fetch (bypass IndexedDB for calendar)
      // This ensures we get the FULL calendar list, not just cached date
      const matches = await totelepepExtractor.extractMatches(
        dateStr, 
        categoryId || '', 
        competitionId || '',
        undefined, // onProgress callback
        true // forceFresh = true (bypass cache for calendar)
      );
      
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

    // Cancel ALL existing background loading tasks first
    // This prevents multiple tasks from running simultaneously on app reload
    totelepepExtractor.cancelAllBackgroundLoading();
    
    // Clear ALL caches on initial load (both in-memory and IndexedDB)
    totelepepExtractor.clearCache();
    
    // Also clear IndexedDB cache SYNCHRONOUSLY (wait for it to complete)
    // This prevents race condition where clearing happens during save
    (async () => {
      try {
        const { clearCacheMatches, cleanupStaleDateCaches } = await import('./utils/matchCache');
        
        // First, clean up stale date caches (older than today)
        await cleanupStaleDateCaches();
        
        // Clear any existing date caches (use correct cache key with source ID)
        const sourceId = selectedSource?.id || 'totelepep';
        const datesToClear = availableDates.length > 0 ? availableDates : [];
        for (const date of datesToClear) {
          const cacheKey = `date_${date}_all_all_${sourceId}`;
          await clearCacheMatches(cacheKey);
        }
        // Clear All Matches cache
        const allMatchesCacheKey = `all_matches_all_all_${sourceId}`;
        await clearCacheMatches(allMatchesCacheKey);
        console.log('[Initial Load] Cleared all IndexedDB caches');
        
        // NOW it's safe to load data
        loadCalendarList().then(() => {
          const firstDate = (totelepepExtractor as any).calendarList?.[0]?.entryDate;
          if (firstDate) {
            (totelepepExtractor as any).cache = new Map();
            loadData(firstDate, selectedCategory, selectedCompetition, true);
          }
          
          // Initialize progress state for all dates
          const calendarList = (totelepepExtractor as any).calendarList || [];
          const sourceId = selectedSource?.id || 'totelepep';
          const currentCategory = selectedCategory || 'all';
          const currentCompetition = selectedCompetition || 'all';
          
          const progressChecks = calendarList.map(async (dateEntry: any) => {
            const cacheKey = `date_${dateEntry.entryDate}_${currentCategory}_${currentCompetition}_${sourceId}`;
            const { getCachedMatches, isCacheExpired } = await import('./utils/matchCache');
            const { matches: cachedMatches, metadata } = await getCachedMatches(cacheKey);
            const expired = await isCacheExpired(cacheKey);
            
            if (cachedMatches && cachedMatches.length > 0 && metadata?.isComplete) {
              const matchesWithMarkets = cachedMatches.filter((m: any) => m.allMarkets && m.allMarkets.length > 0).length;
              const marketsLoaded = matchesWithMarkets === cachedMatches.length;
              const isComplete = expired ? false : marketsLoaded;
              
              return {
                date: dateEntry.entryDate,
                loaded: matchesWithMarkets,
                total: cachedMatches.length,
                isComplete
              };
            }
            
            return {
              date: dateEntry.entryDate,
              loaded: 0,
              total: dateEntry.matchCount || 0,
              isComplete: false
            };
          });
          
          Promise.all(progressChecks).then(results => {
            const newProgress: Record<string, {loaded: number, total: number, isComplete: boolean}> = {};
            results.forEach(result => {
              if (result) {
                newProgress[result.date] = {
                  loaded: result.loaded,
                  total: result.total,
                  isComplete: result.isComplete
                };
              }
            });
            setDateProgress(newProgress);
          });
        });
      } catch (error) {
        console.error('[Initial Load] Error clearing IndexedDB cache:', error);
      }
    })();
    
    // Load saved betslip from IndexedDB
    loadBetslip().then(savedSelections => {
      if (savedSelections && savedSelections.length > 0) {
        setParlaySelections(savedSelections);
      }
    });
  }, []); // Only run once on mount
  
  // Save betslip to IndexedDB when selections change
  useEffect(() => {
    if (parlaySelections.length > 0) {
      saveBetslip(parlaySelections);
    } else {
      // Clear betslip if no selections
      clearBetslip();
    }
  }, [parlaySelections]);
  
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
        // Quick 1X2 odds filtering (e.g., 130H, 150D, 200A, 110-125H)
        // OR advanced filter (e.g., 130ALL, 150H1BTTS)
        let targetOdds = parseFloat(searchTerm);
        let positionFilter: 'home' | 'draw' | 'away' | null = null;
        
        // Check for position suffix (H=Home, D=Draw, A=Away)
        const upperSearch = searchTerm.toUpperCase().trim();
        
        // Detect if this is an advanced filter (has period code like ALL, H1, H2, FT)
        const hasAdvancedFilter = /\d{2,3}(H1|H2|2H|FT|ALL)/.test(upperSearch);
        
        if (upperSearch.endsWith('H') && !hasAdvancedFilter) {
          positionFilter = 'home';
          targetOdds = parseFloat(upperSearch.slice(0, -1));
        } else if (upperSearch.endsWith('D') && !hasAdvancedFilter) {
          positionFilter = 'draw';
          targetOdds = parseFloat(upperSearch.slice(0, -1));
        } else if (upperSearch.endsWith('A') && !hasAdvancedFilter) {
          positionFilter = 'away';
          targetOdds = parseFloat(upperSearch.slice(0, -1));
        }
        
        // Handle input like "130" as "1.30" for decimal odds
        if (!isNaN(targetOdds) && targetOdds > 10) {
          targetOdds = targetOdds / 100;
        }
        
        // Parse range for "between" mode (e.g., "100-200", "100-200H")
        let targetOddsMin = targetOdds;
        let targetOddsMax = targetOdds;
        if (searchMode === 'between' && searchTerm.includes('-')) {
          const rangeParts = searchTerm.split('-');
          if (rangeParts.length === 2) {
            let minStr = rangeParts[0].trim();
            let maxStr = rangeParts[1].trim();
            
            // Remove position suffix from max value
            if (maxStr.toUpperCase().endsWith('H') || maxStr.toUpperCase().endsWith('D') || maxStr.toUpperCase().endsWith('A')) {
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
            
            // Validate: left number must be strictly less than right number
            if (targetOddsMin >= targetOddsMax) {
              filteredDateMatches = [];
              // Skip filtering - invalid range (can't be equal or greater)
              return filtered;
            }
          }
        }
        
        if (isNaN(targetOdds) && searchMode !== 'between') {
          filteredDateMatches = [];
        } else if (!hasAdvancedFilter) {
          // Quick 1X2 filtering ONLY - not for advanced filters
          // Advanced filters (H1, H2, FT, ALL) should pass through and be filtered by MatchCard
          filteredDateMatches = (dateMatches as TotelepepMatch[]).filter(match => {
            // If match is outright/special, skip quick 1X2 filter
            // Outright matches should only show with advanced filters (e.g., 130ALL)
            if (match.isOutright && !hasAdvancedFilter) {
              return false;
            }
            
            const homeOdds = parseFloat(String(match.homeOdds));
            const drawOdds = parseFloat(String(match.drawOdds));
            const awayOdds = parseFloat(String(match.awayOdds));
            
            // Skip matches with invalid odds (NaN) - but allow outrights with advanced filters
            if (isNaN(homeOdds) && isNaN(drawOdds) && isNaN(awayOdds)) {
              // Outrights with advanced filter should still pass (will be filtered by market search later)
              if (match.isOutright && hasAdvancedFilter) {
                return true; // Let through for advanced market filtering
              }
              return false;
            }
            
            if (positionFilter) {
              // Filter by specific position (H, D, or A)
              if (searchMode === 'eq') {
                if (positionFilter === 'home') return Math.abs(homeOdds - targetOdds) < 0.001;
                if (positionFilter === 'draw') return Math.abs(drawOdds - targetOdds) < 0.001;
                if (positionFilter === 'away') return Math.abs(awayOdds - targetOdds) < 0.001;
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
                return Math.abs(homeOdds - targetOdds) < 0.001 || 
                       Math.abs(drawOdds - targetOdds) < 0.001 || 
                       Math.abs(awayOdds - targetOdds) < 0.001;
              } else if (searchMode === 'gte') {
                return homeOdds >= targetOdds || drawOdds >= targetOdds || awayOdds >= targetOdds;
              } else if (searchMode === 'lte') {
                return homeOdds <= targetOdds || drawOdds <= targetOdds || awayOdds <= targetOdds;
              } else if (searchMode === 'between') {
                return (homeOdds >= targetOddsMin && homeOdds <= targetOddsMax) ||
                       (drawOdds >= targetOddsMin && drawOdds <= targetOddsMax) ||
                       (awayOdds >= targetOddsMin && awayOdds <= targetOddsMax);
              }
            }
            
            return false;
          });
        } else {
          // Advanced filter (H1, H2, FT, ALL) - filter matches based on expanded markets
          // This ensures matches without matching markets are filtered out
          filteredDateMatches = (dateMatches as TotelepepMatch[]).filter(match => {
            // Parse the advanced filter code to extract criteria
            const upperSearch = searchTerm.toUpperCase().trim();
            const oddsMatch = upperSearch.match(/^(\d{2,3})/);
            if (!oddsMatch) return true; // Can't parse, let through
            
            let targetOdds = parseFloat(oddsMatch[1]);
            if (targetOdds > 10) targetOdds = targetOdds / 100;
            
            // Extract period (H1, H2, FT, ALL)
            let targetPeriod = 'ALL';
            if (upperSearch.includes('H1')) targetPeriod = 'H1';
            else if (upperSearch.includes('H2') || upperSearch.includes('2H')) targetPeriod = 'H2';
            else if (upperSearch.includes('FT')) targetPeriod = 'FT';
            
            // Extract market type (UO, BTTS, DC, etc.)
            let targetMarketType: string | null = null;
            if (upperSearch.includes('UO')) targetMarketType = 'UO';
            else if (upperSearch.includes('BTTS')) targetMarketType = 'BTTS';
            else if (upperSearch.includes('DC')) targetMarketType = 'DC';
            else if (upperSearch.includes('AH')) targetMarketType = 'AH';
            else if (upperSearch.includes('CS')) targetMarketType = 'CS';
            
            // If match doesn't have allMarkets loaded yet, filter it out for market-specific filters
            // (UO, BTTS, DC, AH, CS) - we can't verify the filter without markets
            if (!match.allMarkets || match.allMarkets.length === 0) {
              if (targetMarketType) {
                return false; // Market-specific filter but no markets loaded = filter out
              }
              return true; // No market filter, let through (will filter by period/odds only)
            }
            
            // Extract line for UO/AH markets (e.g., +1.5, -0.5, 2.5)
            let targetLine: string | null = null;
            const lineMatch = upperSearch.match(/UO([+-]?\d+\.?\d*)/);
            if (lineMatch) {
              targetLine = lineMatch[1];
            }
            
            // Extract option (O=Over, U=Under, Y=Yes, N=No)
            let targetOption: string | null = null;
            if (upperSearch.includes('UO+')) targetOption = 'O';
            else if (upperSearch.includes('UO-')) targetOption = 'U';
            else if (upperSearch.includes('BTTSY') || upperSearch.includes('BTTSYES')) targetOption = 'Y';
            else if (upperSearch.includes('BTTSN') || upperSearch.includes('BTTSNO')) targetOption = 'N';
            
            // Check if match has ANY market matching the criteria
            const hasMatchingMarket = match.allMarkets.some(market => {
              // Check period
              if (targetPeriod !== 'ALL') {
                if (targetPeriod === 'H1' && market.periodCode !== 'H1' && market.periodCode !== 'HT') {
                  return false;
                }
                if (targetPeriod === 'H2' && market.periodCode !== 'H2' && market.periodCode !== '2H') {
                  return false;
                }
                if (targetPeriod === 'FT' && market.periodCode && market.periodCode !== 'FT' && 
                    market.periodCode !== 'H1' && market.periodCode !== 'H2') {
                  return false;
                }
              }
              
              // Check market type
              if (targetMarketType) {
                const marketName = (market.name || '').toUpperCase();
                if (targetMarketType === 'UO' && !marketName.includes('OVER') && !marketName.includes('UNDER') && !marketName.includes('UO')) {
                  return false;
                }
                if (targetMarketType === 'BTTS' && !marketName.includes('BTTS') && !marketName.includes('BOTH')) {
                  return false;
                }
              }
              
              // Check line for UO markets
              if (targetMarketType === 'UO' && targetLine) {
                const marketLine = market.marketLine || '';
                // Normalize line comparison (remove +/- prefix for matching)
                const normalizedTarget = targetLine.replace(/[+-]/, '');
                const normalizedMarket = String(marketLine).replace(/[+-]/, '');
                if (normalizedMarket !== normalizedTarget) {
                  return false;
                }
              }
              
              // Check if any selection has matching odds
              if (market.selections && market.selections.length > 0) {
                return market.selections.some(sel => {
                  const selOdds = parseFloat(String(sel.odds));
                  if (isNaN(selOdds)) return false;
                  
                  // Check option (Over/Under, Yes/No)
                  if (targetOption) {
                    const selName = (sel.name || '').toUpperCase();
                    if (targetOption === 'O' && !selName.includes('OVER')) return false;
                    if (targetOption === 'U' && !selName.includes('UNDER')) return false;
                    if (targetOption === 'Y' && !selName.includes('YES')) return false;
                    if (targetOption === 'N' && !selName.includes('NO')) return false;
                  }
                  
                  // Check odds based on searchMode
                  if (searchMode === 'eq') {
                    return Math.abs(selOdds - targetOdds) < 0.001;
                  } else if (searchMode === 'gte') {
                    return selOdds >= targetOdds;
                  } else if (searchMode === 'lte') {
                    return selOdds <= targetOdds;
                  } else if (searchMode === 'between') {
                    return selOdds >= targetOddsMin && selOdds <= targetOddsMax;
                  }
                  
                  return false;
                });
              }
              
              return false;
            });
            
            return hasMatchingMarket;
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

  const handleHistoryClick = () => {
    setShowBookingHistory(true);
  };

  const handleCloseBookingHistory = () => {
    setShowBookingHistory(false);
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
          
          // Create match time using BOTH date and kickoff time
          const matchTime = new Date();
          if (match.date) {
            // Use match date (YYYY-MM-DD format)
            const [year, month, day] = match.date.split('-').map(Number);
            matchTime.setFullYear(year, month - 1, day);
          }
          matchTime.setHours(hours, minutes, 0, 0);
          
          
          // If match time is more than 5 minutes in the past, consider it started
          if (matchTime < new Date(now.getTime() - 5 * 60000)) {
            hasError = true;
            errorMessage = 'Match has already started';
          }
        }

        // Check 2: Duplicate match (any selection from same match)
        if (!hasError) {
          const isDuplicate = parlaySelections.some(s => 
            s.matchId === matchId
          );
          
          
          if (isDuplicate) {
            hasError = true;
            errorMessage = 'Duplicate match detected';
          }
        }
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
    // Show confirmation modal instead of clearing immediately
    setShowClearAllModal(true);
  };
  
  // Execute clear all after confirmation
  const confirmClearAll = () => {
    setParlaySelections([]);
    clearBetslip(); // Clear from IndexedDB
    setShowParlayBuilder(false); // Close parlay builder when clearing all
    setShowClearAllModal(false); // Close modal
  };
  
  // Cancel clear all
  const cancelClearAll = () => {
    setShowClearAllModal(false);
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
  
  // Handle long-press to clear cache for a specific date
  const handleClearCache = async (date: string) => {
    const { clearCacheMatches } = await import('./utils/matchCache');
    const sourceId = selectedSource?.id || 'totelepep';
    const cacheKey = `date_${date}_${selectedCategory || 'all'}_${selectedCompetition || 'all'}_${sourceId}`;
    
    // Clear cache for this date
    await clearCacheMatches(cacheKey);
    // Clear current matches immediately
    setMatches([]);
    setGroupedMatches({});
    
    // Reset progress for this date
    setDateProgress(prev => ({
      ...prev,
      [date]: {
        loaded: 0,
        total: 0,
        isComplete: false
      }
    }));
    
    // Show toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #3b82f6;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideDown 0.3s ease-out;
    `;
    toast.textContent = `Cache cleared for ${date}. Reloading...`;
    document.body.appendChild(toast);
    
    // Remove toast after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slideUp 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
    
    // Reload data from API
    if (selectedDate === date) {
      loadData(date, selectedCategory, selectedCompetition);
    }
  };
  
  // Handle long-press on All Matches to clear ALL date caches
  const handleClearAllCache = async () => {
    console.log('[Clear All Cache] Long press detected on All Matches');
    
    const { clearCacheMatches } = await import('./utils/matchCache');
    const sourceId = selectedSource?.id || 'totelepep';
    
    // Clear all date caches for current source
    const datesToClear = calendarList.length > 0 ? calendarList : availableDates;
    
    console.log(`[Clear All Cache] Clearing ${datesToClear.length} dates...`);
    
    for (const dateEntry of datesToClear) {
      const date = dateEntry.date;
      if (!date) continue;
      
      const cacheKey = `date_${date}_${selectedCategory || 'all'}_${selectedCompetition || 'all'}_${sourceId}`;
      await clearCacheMatches(cacheKey);
      console.log(`[Clear All Cache] Cleared ${date}`);
    }
    
    // Clear All Matches cache too
    const allMatchesCacheKey = `all_matches_${selectedCategory || 'all'}_${selectedCompetition || 'all'}_${sourceId}`;
    await clearCacheMatches(allMatchesCacheKey);
    console.log('[Clear All Cache] Cleared All Matches cache');
    
    // Clear current matches immediately
    setMatches([]);
    setGroupedMatches({});
    
    // Reset all progress
    setDateProgress({});
    setAllMatchesProgress(null);
    
    // Cancel all active background loading tasks
    totelepepExtractor.cancelAllBackgroundLoading();
    
    // Turn off All Matches view
    if (showAllMatches) {
      setShowAllMatches(false);
    }
    
    // Show toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #ef4444;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideDown 0.3s ease-out;
    `;
    toast.textContent = `All caches cleared! Reload calendar to fetch fresh data.`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideUp 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
    
    // Reload calendar to start fresh
    loadCalendarList(selectedCategory, selectedCompetition);
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
          onHistoryClick={handleHistoryClick}
          hasSavedBookings={savedBookingsCount > 0}
        />
        
        {/* Date Selector */}
        <DateSelector
          selectedDate={selectedDate} 
          onDateChange={handleDateChange}
          availableDates={filteredAvailableDates}
          showAllMatches={showAllMatches}
          onToggleAllMatches={toggleAllMatches}
          totalMatches={totalAllMatchesCount}
          dateProgress={dateProgress}
          allMatchesProgress={allMatchesProgress || undefined}
          onClearCache={handleClearCache}
          onClearAllCache={handleClearAllCache}
        />
        
        {/* Search Bar */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-3 py-2 flex items-center gap-2">
            {/* Search Input - Half Width */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder={loading ? 'Loading markets...' : searchMode === 'matches' ? 'Search matches...' : searchMode === 'eq' ? 'e.g., 130H, 130D, 130A, 130H1H' : 'Enter odds (e.g., 130H, 150H2A)...'}
                value={searchTerm}
                disabled={loading}
                className={`w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                onChange={(e) => {
                  if (loading) return; // Don't allow input while loading
                  const value = e.target.value;
                  setSearchTerm(value);
                  
                  // If search is cleared (backspace to empty), reset to matches mode
                  if (value === '' && searchMode !== 'matches') {
                    setSearchMode('matches');
                    setSearchOddsValue('');
                  }
                }}
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
                // But NOT if it's ONLY a market line prefix (e.g., UO-2.5, AH-0.5)
                // Allow ranges WITH market lines: 130-155FTUO-2.5
                const rangeMatch = searchTerm.match(/^(\d{3,})-(\d{3,})/);
                const isOnlyMarketLineWithDash = /^(\d{2,3})(FT|H1|H2|2H|ALL)(UO|AH)-/i.test(searchTerm);
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
                
                if (hasDash && !isValidRange && !isOnlyMarketLineWithDash) {
                  // Has dash but invalid range (e.g., "55-130") - show nothing except Matches
                  // But NOT for market lines like UO-2.5 or AH-0.5
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
      
      <div className="max-w-3xl mx-auto" style={{ overflowX: 'hidden' }}>
        
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
          onMarketsLoaded={(matchId, markets) => {
            // Trigger re-filter by updating a dummy state
            // This forces the useMemo to re-run with the updated allMarkets
            setMatches(prev => [...prev]);
          }}
        />
      </div>
      
      {/* Parlay Builder - Slide in from right */}
      {showParlayBuilder && (
        <>
          {/* Backdrop to prevent background scroll */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setShowParlayBuilder(false)}
          />
          <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${showParlayBuilder ? 'translate-x-0' : 'translate-x-full'}`}>
        {parlaySelections.length > 0 ? (
          <ParlayBuilder
            selections={parlaySelections}
            onRemoveSelection={handleRemoveSelection}
            onClearAll={handleClearAll}
            onClose={() => setShowParlayBuilder(false)}
            selectedSource={selectedSource}
            showHistoryModal={showBookingHistory}
            onHideHistoryModal={handleCloseBookingHistory}
            onBookingsCountChange={setSavedBookingsCount}
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
        </>
      )}
      
      <PWAInstallPrompt />
      
      {/* Booking History Modal */}
      <BookingHistory
        showHistory={showBookingHistory}
        onClose={handleCloseBookingHistory}
        onBookingsCountChange={setSavedBookingsCount}
      />
      
      {/* Clear All Confirmation Modal */}
      {showClearAllModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm mx-4 overflow-hidden animate-modal-fade-in">
            {/* Header */}
            <div className="bg-red-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white">Clear All Selections?</h3>
              </div>
            </div>
            
            {/* Content */}
            <div className="px-6 py-4">
              <p className="text-gray-700">
                Are you sure you want to clear all {parlaySelections.length} selection{parlaySelections.length !== 1 ? 's' : ''} from your betslip?
              </p>
              <p className="text-sm text-gray-500 mt-2">
                This action cannot be undone.
              </p>
            </div>
            
            {/* Actions */}
            <div className="px-6 py-4 bg-gray-50 flex gap-3">
              <button
                onClick={cancelClearAll}
                className="flex-1 px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmClearAll}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;