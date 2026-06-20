import { saveMatchesChunk, getCachedMatches, getCacheMetadata, getChunkSize, isCacheExpired, deletePastMatches } from '../utils/matchCache';

interface TotelepepMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  competitionId: string;
  categoryId?: string; // Category ID for filtering
  marketBookNo?: string;
  marketId?: string;  // Actual market ID from API (different from marketBookNo!)
  marketCode?: string;
  kickoff: string;
  date: string;
  status: 'upcoming' | 'live' | 'finished';
  homeOdds: number | string;
  drawOdds: number | string;
  awayOdds: number | string;
  overUnder: {
    over: number | string;
    under: number | string;
    line: number;
  };
  bothTeamsScore: {
    yes: number | string;
    no: number | string;
  };
  homeScore?: number;
  awayScore?: number;
  minute?: number;
  marketCount?: number; // Total number of available markets
  availableMarkets?: string[]; // List of all available market names
  isOutright?: boolean; // Flag for outright markets (tournament winners, etc.)
  allMarkets?: Array<{ // Detailed market information
    id?: string;  // Actual market ID from API
    name: string;
    marketDisplayName?: string;  // Full market display name from API
    marketBookNo: string;
    marketCode: string;
    marketLine?: string;  // Market line for handicap/over-under
    periodCode?: string;
    selections: Array<{
      name: string;
      odds: number | string;
      optionCode?: string;
      optionNo?: string;
      selectionId?: string;
    }>;
  }>;
}

class TotelepepExtractor {
  // CORS Proxy fallback list (tries each one in order)
  private corsProxies = [
    'https://zaleugflzamrkrfkrcsa.supabase.co/functions/v1/cors-proxy?url=',  // YOUR Supabase proxy (primary)
    'https://corsproxy.io/?',                    // Fallback 1
    'https://api.allorigins.win/raw?url=',       // Fallback 2
    'https://api.codetabs.com/v1/proxy?quest=',  // Fallback 3
  ];
  private currentProxyIndex = 0;
  private baseUrl = 'https://www.totelepep.mu/webapi/GetSport';
  
  // Get current proxy URL with fallback support
  private getProxyUrl(): string {
    return this.corsProxies[this.currentProxyIndex];
  }
  
  // Fetch with automatic proxy fallback
  private async fetchWithFallback(url: string, options?: RequestInit): Promise<Response> {
    const encodedUrl = encodeURIComponent(url);
    
    // Try each proxy in order
    for (let i = 0; i < this.corsProxies.length; i++) {
      const proxyIndex = (this.currentProxyIndex + i) % this.corsProxies.length;
      const proxy = this.corsProxies[proxyIndex];
      
      try {
        const fetchUrl = `${proxy}${encodedUrl}`;
        const response = await fetch(fetchUrl, options);
        
        if (response.ok) {
          // Update current proxy to the working one
          this.currentProxyIndex = proxyIndex;
          return response;
        }
      } catch (error) {
        continue;
      }
    }
    
    // All proxies failed
    throw new Error('All CORS proxies failed');
  }
  private cache: Map<string, { data: TotelepepMatch[]; timestamp: number }> = new Map();
  private cacheTimeout = 1 * 60 * 1000; // 1 minute instead of 5 minutes
  private rateLimitDelay = 2000; // 2 seconds between requests
  private lastRequestTime = 0;
  private calendarList: Array<{entryDate: string, matchCount: number, displayDate: string}> = [];
  private categoryList: Array<{id: string, name: string}> = [];
  private competitionList: Array<{id: string, name: string, categoryId?: string, matchCount?: number}> = [];
  private competitionToCategoryMap: Map<string, string> = new Map(); // competitionId -> categoryId
  
  // Market loading progress callback
  public onMarketProgress?: (date: string, loaded: number, total: number) => void;
  // Dynamic competition mapping that can be updated based on actual data
  private dynamicCompetitionMap: Record<string, string> = {};
  // Fallback competition mapping based on team names
  private teamBasedCompetitionMap: Record<string, string> = {};
  // Method to update the dynamic competition mapping
  public updateCompetitionMapping(competitionId: string, leagueName: string): void {
    if (competitionId && leagueName && competitionId !== '0') {
      this.dynamicCompetitionMap[competitionId] = leagueName;
      
    }
  }
  
  // Method to update team-based competition mapping
  public updateTeamBasedCompetitionMapping(homeTeam: string, awayTeam: string, leagueName: string): void {
    // Create a key based on team names
    const teamKey = `${homeTeam.toLowerCase()}|${awayTeam.toLowerCase()}`;
    if (leagueName && leagueName !== 'Football League') {
      this.teamBasedCompetitionMap[teamKey] = leagueName;
      
    }
  }
  
  // Method to get league name based on team names
  private getLeagueFromTeams(homeTeam: string, awayTeam: string): string | null {
    const teamKey = `${homeTeam.toLowerCase()}|${awayTeam.toLowerCase()}`;
    return this.teamBasedCompetitionMap[teamKey] || null;
  }
  
  async extractMatches(
    targetDate?: string, 
    categoryId?: string, 
    competitionId?: string,
    onProgress?: (loaded: number, total: number) => void,
    forceFresh: boolean = false // Bypass cache (for calendar loading)
  ): Promise<TotelepepMatch[]> {
    try {
      // Check cache first
      // Include baseUrl in cache key to prevent mixing data from different sources
      const sourceId = this.baseUrl.includes('superscore') ? 'superscore' : 
                       this.baseUrl.includes('stevenhills') ? 'stevenhills' : 
                       this.baseUrl.includes('valueplus') ? 'valueplus' : 'totelepep';
      const cacheKey = targetDate ? `date_${targetDate}_${categoryId || 'all'}_${competitionId || 'all'}_${sourceId}` : `all_dates_${new Date().toISOString().split('T')[0]}_${sourceId}`;
      
      // Try IndexedDB cache first (skip if forceFresh)
      const { matches: cachedMatches, metadata } = await getCachedMatches(cacheKey);
      
      // Check if cache is valid (not expired and has data)
      const cacheExpired = await isCacheExpired(cacheKey);
      
      if (!forceFresh && cachedMatches && cachedMatches.length > 0 && metadata?.isComplete && !cacheExpired) {
        const cacheAge = metadata?.lastUpdated ? Math.round((Date.now() - metadata.lastUpdated) / 60000) : 0;
        console.log(`[IndexedDB Cache] Loaded ${cachedMatches.length} matches (${cacheAge}min old)`);
        
        // Delete past matches in background (non-blocking)
        deletePastMatches(cacheKey).then(deleted => {
          if (deleted > 0) {
          }
        }).catch(err => console.error('Failed to cleanup past matches:', err));
        
        // Also store in memory cache for fast access
        this.setCachedData(cachedMatches, cacheKey);
        
        // Check if all matches already have markets loaded (from previous session)
        const matchesWithMarkets = cachedMatches.filter(m => m.allMarkets && m.allMarkets.length > 0).length;
        const allMarketsLoaded = matchesWithMarkets === cachedMatches.length;
        
        if (allMarketsLoaded && cachedMatches.length > 0) {
          // All markets already loaded - report 100% complete
          
          // Extract date from cacheKey (e.g., "date_2026-06-19_all_all_totelepep" -> "2026-06-19")
          const date = cacheKey.split('_')[1];
          
          // Report complete progress to App.tsx
          if (this.onMarketProgress && date) {
            this.onMarketProgress(date, cachedMatches.length, cachedMatches.length);
          }
        } else if (matchesWithMarkets > 0) {
          // Some markets loaded - report partial progress
          
          // Extract date from cacheKey
          const date = cacheKey.split('_')[1];
          
          if (this.onMarketProgress && date) {
            this.onMarketProgress(date, matchesWithMarkets, cachedMatches.length);
          }
        }
        
        return cachedMatches;
      }
      
      if (forceFresh) {
        console.log('[Force Fresh] Bypassing cache, fetching from API...');
      }
      
      // Cache expired or incomplete - fetch fresh data
      if (cacheExpired) {
        console.log('[Cache] Data expired (>10min), fetching fresh data from API');
      }
      
      // Check in-memory cache
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        console.log(`[Memory Cache] Found ${cached.length} matches in memory`);
        return cached;
      }

      // Rate limiting
      await this.enforceRateLimit();

      // Fetch JSON from totelepep.mu API with category and competition filters
      const jsonData = await this.fetchTotelepepAPI(targetDate, categoryId, competitionId);
      
      // Parse JSON data (same as Power Query Json.Document)
      let matches = this.parseJSONForMatches(jsonData);
      
      // Handle pagination - fetch all pages if there are more
      const totalPages = jsonData.totalPages || 1;
      if (totalPages > 1) {

        // Fetch remaining pages
        const allMatchesPromises = [];
        for (let page = 2; page <= totalPages; page++) {
          allMatchesPromises.push(this.fetchTotelepepAPI(targetDate, categoryId, competitionId, page));
        }
        
        const additionalResponses = await Promise.all(allMatchesPromises);
        
        // Parse matches from additional pages
        for (const response of additionalResponses) {
          const pageMatches = this.parseJSONForMatches(response);
          matches = matches.concat(pageMatches);
        }

      }
      
      // DON'T fetch detailed markets yet - they will be loaded on-demand when user clicks

      // Ensure all matches have the correct date
      const dateToUse = targetDate || this.getTodayDate();
      matches.forEach(match => {
        // Only override the date if it wasn't set from the API
        // When fetching "Beyond" or all dates, keep the API's actual date
        if (!match.date) {
          match.date = dateToUse;
        }
        // Set initial market count from the API response if available
        if (!match.marketCount) {
          match.marketCount = 1; // Will be updated when markets are fetched
          match.availableMarkets = ['1X2'];
        }
      });
      
      if (matches.length > 0) {
        
        this.setCachedData(matches, cacheKey);
        
        // Save to IndexedDB in chunks for persistence and memory management
        // BUT skip if forceFresh (for calendar loading - don't overwrite existing markets!)
        if (!forceFresh) {
          const chunkSize = getChunkSize();
          const totalMatches = matches.length;
          
          // Return matches immediately (don't wait for market fetching)
          // Market fetching will happen in background for lazy loading
          
          // Save basic match data to IndexedDB quickly (without allMarkets)
          for (let i = 0; i < totalMatches; i += chunkSize) {
            const chunk = matches.slice(i, i + chunkSize);
            const loadedCount = Math.min(i + chunkSize, totalMatches);
            const isComplete = loadedCount >= totalMatches;
            
            // Save chunk to IndexedDB (basic data only, fast)
            await saveMatchesChunk(chunk, cacheKey, loadedCount, totalMatches, isComplete);
            
            // Report progress
            if (onProgress) {
              onProgress(loadedCount, totalMatches);
            }
          }
          
          
          // Fetch ALL markets in background (non-blocking, rate limited)
          // This will update the cache progressively as markets are loaded
          this.fetchMarketsInBackground(matches, cacheKey, totalMatches, chunkSize);
        } else {
        }
        
        return matches;
      }

      return [];
      
    } catch (error) {

      // Try to return cached data even if expired
      const sourceId = this.baseUrl.includes('superscore') ? 'superscore' : 
                       this.baseUrl.includes('stevenhills') ? 'stevenhills' : 
                       this.baseUrl.includes('valueplus') ? 'valueplus' : 'totelepep';
      const cacheKey = targetDate ? `date_${targetDate}_${sourceId}` : `all_dates_${new Date().toISOString().split('T')[0]}_${sourceId}`;
      const cached = this.getCachedData(cacheKey, true);
      if (cached) {
        
        return cached;
      }
      
      return [];
    }
  }

  // Public method to fetch markets for a single match (for lazy loading)
  async fetchMarketsForMatch(match: TotelepepMatch): Promise<void> {
    // Don't fetch if already loaded
    if (match.allMarkets && match.allMarkets.length > 0) {
      return;
    }
    
    try {

      // Extract domain from baseUrl (e.g., https://www.totelepep.mu/webapi/GetSport -> https://www.totelepep.mu)
      const baseUrl = this.baseUrl.replace('/webapi/GetSport', '');
      const apiUrl = `${baseUrl}/webapi/GetMatch?sportId=soccer&competitionId=${match.competitionId}&matchId=${match.id}&periodCode=all`;
      
      // Use CORS proxy for GetMatch request
      const response = await this.fetchWithFallback(apiUrl, {
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        
        return;
      }

      const data = await response.json();
      
      // Parse all markets
      const allMarkets = this.parseAllMarkets(data, match.id);
      if (allMarkets) {
        match.allMarkets = allMarkets;
        match.marketCount = allMarkets.length;
        match.availableMarkets = [...new Set(allMarkets.map(m => m.name))];
      }
    } catch (error) {
      
      match.marketCount = 1;
      match.availableMarkets = ['1X2'];
    }
  }

  // Fetch markets for all matches in background (non-blocking)
  private async fetchMarketsInBackground(
    matches: TotelepepMatch[],
    cacheKey: string,
    totalMatches: number,
    chunkSize: number
  ): Promise<void> {
    // Extract date from cacheKey (e.g., "date_2026-06-19_all_all_totelepep" -> "2026-06-19")
    const date = cacheKey.split('_')[1];
    
    // Count how many matches already have markets loaded (from cache)
    const alreadyLoaded = matches.filter(m => m.allMarkets && m.allMarkets.length > 0).length;
    const needLoading = totalMatches - alreadyLoaded;
    
    console.log(`[Background Market Loading] ${date}: ${alreadyLoaded}/${totalMatches} already loaded, fetching markets for ${needLoading} matches...`);
    
    // Run in background - don't await this
    (async () => {
      
      // Start progress from already loaded count (not from 0!)
      let loadedCount = alreadyLoaded;
      
      // Report initial progress
      if (this.onMarketProgress && loadedCount > 0) {
        this.onMarketProgress(date, loadedCount, totalMatches);
      }
      
      for (let i = 0; i < totalMatches; i += chunkSize) {
        const chunk = matches.slice(i, i + chunkSize);
        const chunkStart = i;
        const chunkEnd = i + chunk.length;
        
        
        // Fetch markets with rate limiting
        for (const match of chunk) {
          // Skip if already has markets (from cache)
          if (match.allMarkets && match.allMarkets.length > 0) {
            continue;
          }
          
          try {
            await this.enforceRateLimit();
            await this.fetchMarketsForMatch(match);
            loadedCount++;
            
            // Report progress every 10 matches or on last match
            if (this.onMarketProgress && (loadedCount % 10 === 0 || loadedCount === totalMatches)) {
              const percentage = Math.round((loadedCount/totalMatches)*100);
              this.onMarketProgress(date, loadedCount, totalMatches);
            }
          } catch (error) {
            loadedCount++; // Still count as processed (even if failed)
            
            // Report progress
            if (this.onMarketProgress && (loadedCount % 10 === 0 || loadedCount === totalMatches)) {
              this.onMarketProgress(date, loadedCount, totalMatches);
            }
          }
        }
        
        // Update this chunk in IndexedDB with markets
        const { updateMatchesInCache } = await import('../utils/matchCache');
        await updateMatchesInCache(chunk, cacheKey, totalMatches);
        
        // Delay between chunks
        if (i + chunkSize < totalMatches) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      // Final progress update (ensure complete)
      if (this.onMarketProgress) {
        console.log(`[Background Market Loading] ${date}: Complete! ${totalMatches}/${totalMatches} markets loaded (100%)`);
        this.onMarketProgress(date, totalMatches, totalMatches);
      }
    })(); // Self-executing async function
  }

  // Fetch all markets for all matches - OPTIMIZED WITH PARALLEL REQUESTS
  private async fetchAllMarketsForMatches(matches: TotelepepMatch[]): Promise<void> {

    // Process matches in batches of 5 to avoid overwhelming the server
    const batchSize = 5;
    const batches: TotelepepMatch[][] = [];
    
    for (let i = 0; i < matches.length; i += batchSize) {
      batches.push(matches.slice(i, i + batchSize));
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      // Fetch all matches in this batch IN PARALLEL
      const fetchPromises = batch.map(async (match) => {
        try {
          // Extract domain from baseUrl (e.g., https://www.totelepep.mu/webapi/GetSport -> https://www.totelepep.mu)
          const baseUrl = this.baseUrl.replace('/webapi/GetSport', '');
          const apiUrl = `${baseUrl}/webapi/GetMatch?sportId=soccer&competitionId=${match.competitionId}&matchId=${match.id}&periodCode=all`;
          
          // Use CORS proxy
          const response = await this.fetchWithFallback(apiUrl, {
            headers: {
              'Accept': 'application/json',
            }
          });
          
          if (!response.ok) {
            
            match.marketCount = 1;
            match.availableMarkets = ['1X2'];
            return;
          }
          
          const data = await response.json();
          const allMarkets = this.parseAllMarkets(data, match.id);
          
          if (allMarkets && allMarkets.length > 0) {
            match.allMarkets = allMarkets;
            match.marketCount = allMarkets.length;
            match.availableMarkets = allMarkets.map(m => m.name);
          } else {
            match.marketCount = 1;
            match.availableMarkets = ['1X2'];
          }
        } catch (error) {
          
          match.marketCount = 1;
          match.availableMarkets = ['1X2'];
        }
      });
      
      // Wait for all requests in this batch to complete
      await Promise.all(fetchPromises);

      // Small delay between batches (500ms instead of 1000ms)
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

  }

  // Parse all markets from GetMatch response
  private parseAllMarkets(data: any, matchId: string): Array<{
    id?: string;  // Actual market ID from API (different from marketBookNo!)
    name: string;
    marketBookNo: string;
    marketCode: string;
    periodCode?: string;
    selections: Array<{
      name: string;
      odds: number | string;
      optionCode?: string;
    }>;
  }> | null {
    try {

      // Find the match in the response - try multiple strategies
      let targetMatch = null;
      
      // Strategy 1: Look in competitions array
      if (data.competitions && Array.isArray(data.competitions)) {
        
        for (const competition of data.competitions) {
          if (competition.matches && Array.isArray(competition.matches)) {
            
            targetMatch = competition.matches.find((m: any) => {
              const matchIdStr = m.id?.toString();
              const searchId = matchId.toString();
              return matchIdStr === searchId;
            });
            if (targetMatch) {
              
              break;
            }
          }
        }
      }
      
      // Strategy 2: Look in root matches array
      if (!targetMatch && data.matches && Array.isArray(data.matches)) {
        
        targetMatch = data.matches.find((m: any) => m.id?.toString() === matchId.toString());
        if (targetMatch) {
          
        }
      }
      
      // Strategy 3: Check if data itself is the match
      if (!targetMatch && data.id?.toString() === matchId.toString()) {
        
        targetMatch = data;
      }
      
      if (!targetMatch) {

        return null;
      }
      
      // Try to find markets in different locations
      let marketsArray = null;
      
      if (targetMatch.markets && Array.isArray(targetMatch.markets)) {
        marketsArray = targetMatch.markets;
        
      } else if (targetMatch.marketList && Array.isArray(targetMatch.marketList)) {
        marketsArray = targetMatch.marketList;
        
      } else if (targetMatch.odds && Array.isArray(targetMatch.odds)) {
        marketsArray = targetMatch.odds;
        
      }
      
      if (!marketsArray || marketsArray.length === 0) {

        return null;
      }

      const markets: any[] = [];
      
      marketsArray.forEach((market: any, index: number) => {
        const marketName = market.marketDisplayName || market.name || 'Unknown';
        const marketBookNo = String(market.marketBookNo || market.id || market.marketId || index);
        const marketCode = market.marketCode || '';
        const periodCode = market.periodCode || '';

        // Parse selections - extract ALL data from API
        const selections: any[] = [];
        if (market.selectionList && Array.isArray(market.selectionList)) {
          market.selectionList.forEach((selection: any, selIndex: number) => {
            selections.push({
              name: selection.name || selection.optionCode || 'Unknown',
              odds: selection.companyOdds || selection.odds || 'N/A',
              optionCode: selection.optionCode || '',
              optionNo: selection.optionNo || String(selIndex + 1),  // Store optionNo from API
              selectionId: selection.id || selection.selectionId || ''  // Store selection ID if available
            });
          });
        } else if (market.selections && Array.isArray(market.selections)) {
          market.selections.forEach((selection: any, selIndex: number) => {
            selections.push({
              name: selection.name || selection.optionCode || 'Unknown',
              odds: selection.companyOdds || selection.odds || 'N/A',
              optionCode: selection.optionCode || '',
              optionNo: selection.optionNo || String(selIndex + 1),  // Store optionNo from API
              selectionId: selection.id || selection.selectionId || ''  // Store selection ID if available
            });
          });
        }

        markets.push({
          id: market.marketId || market.id || marketBookNo,  // Store actual marketId (e.g., 565968)
          name: marketName,
          marketDisplayName: market.marketDisplayName || marketName,  // Store full display name from API
          marketBookNo,
          marketCode,
          marketLine: market.marketLine || market.line || '',  // Extract market line
          periodCode,
          selections
        });
      });

      return markets;
      
    } catch (error) {
      
      return null;
    }
  }

  private async fetchTotelepepAPI(targetDate?: string, categoryId?: string, competitionId?: string, pageNo?: number): Promise<any> {
    // Build API URL with current date (same as Power Query)
    const dateToFetch = targetDate !== undefined ? targetDate : this.getTodayDate(); // YYYY-MM-DD format or null for all dates

    // Build API URL with filters
    const compId = competitionId || 0;
    const inclusive = competitionId ? 1 : 1; // Always 1 for now
    const categoryParam = categoryId || '';
    const page = pageNo || 1;
    
    let apiUrl;
    if (targetDate) {
      // Has a date: use it with inclusive=0 to get only that date's matches
      const dateObj = new Date(targetDate);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = months[dateObj.getMonth()];
      const year = dateObj.getFullYear();
      const formattedDate = `${day} ${month} ${year}`;
      apiUrl = `${this.baseUrl}?sportId=soccer&date=${encodeURIComponent(formattedDate)}&category=${encodeURIComponent(categoryParam)}&competitionId=${compId}&pageNo=${page}&inclusive=0&matchid=0&periodCode=all`;
      
    } else {
      // No date: get all matches with inclusive=1
      apiUrl = `${this.baseUrl}?sportId=soccer&category=${encodeURIComponent(categoryParam)}&competitionId=${compId}&pageNo=${page}&inclusive=1&matchid=0&periodCode=all`;
      
    }
    
    // Use CORS proxy for browser requests
    const response = await this.fetchWithFallback(apiUrl, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.5',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const jsonData = await response.json();

    return jsonData;
  }

  private parseJSONForMatches(jsonData: any): TotelepepMatch[] {
    const matches: TotelepepMatch[] = [];
    
    try {

      // Store calendar list data for date selector
      if (jsonData && jsonData.calendarList && Array.isArray(jsonData.calendarList)) {

        // Log each entry's keys and values to see what fields exist
        jsonData.calendarList.forEach((entry: any, index: number) => {
          
        });
        
        // Validate and normalize calendarList entries
        const normalizedCalendarList = jsonData.calendarList.map((entry: any) => {
          // Handle different possible structures
          if (entry && typeof entry === 'object') {
            // Check if it has date/matchCount properties with different names
            let entryDate = entry.entryDate || entry.date || entry.matchDate || entry.gameDate;
            let matchCount = entry.matchCount || entry.count || entry.matches || entry.totalMatches || 0;
            let displayDate = entry.displayDate || entry.displayName || entry.name || '';

            // If we don't have entryDate, try to find it in other properties
            if (!entryDate) {
              // Look for any property that looks like a date
              for (const key in entry) {
                if (key.toLowerCase().includes('date') && typeof entry[key] === 'string') {
                  entryDate = entry[key];
                  break;
                }
              }
            }
            
            // If we don't have matchCount, try to find it in other properties
            if (!matchCount) {
              // Look for any property that looks like a count
              for (const key in entry) {
                if ((key.toLowerCase().includes('count') || key.toLowerCase().includes('match')) && 
                    typeof entry[key] === 'number') {
                  matchCount = entry[key];
                  break;
                }
              }
            }
            
            // Convert date to YYYY-MM-DD format if it's not already
            if (entryDate && typeof entryDate === 'string') {
              // Try to parse the date
              const dateObj = new Date(entryDate);
              if (!isNaN(dateObj.getTime())) {
                // Format as YYYY-MM-DD
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');
                entryDate = `${year}-${month}-${day}`;
              } else {
                // Try parsing with different formats
                const formats = [
                  entryDate, // Original
                  entryDate.replace(/\//g, '-'), // Replace / with -
                  entryDate.replace(/\./g, '-')  // Replace . with -
                ];
                
                for (const format of formats) {
                  const parsedDate = new Date(format);
                  if (!isNaN(parsedDate.getTime())) {
                    const year = parsedDate.getFullYear();
                    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
                    const day = String(parsedDate.getDate()).padStart(2, '0');
                    entryDate = `${year}-${month}-${day}`;
                    break;
                  }
                }
              }
            }
            
            return {
              entryDate: entryDate || new Date().toISOString().split('T')[0],
              matchCount: matchCount || 0,
              displayDate: displayDate || ''
            };
          }
          return null;
        }).filter((entry: any) => entry !== null);
        
        // Store this for use in the DateSelector
        (this as any).calendarList = normalizedCalendarList;
        
      } else {
        
        if (jsonData) {
          
        }
      }
      
      // Debug: Log all top-level keys in the API response

      // Extract categoryList if available
      if (jsonData && jsonData.categoryList && Array.isArray(jsonData.categoryList)) {
        
        this.categoryList = jsonData.categoryList.map((cat: any) => ({
          id: cat.id || cat.categoryId || '',
          name: cat.name || cat.categoryName || cat.displayName || ''
        }));
        
      } else if (jsonData && jsonData.categories && Array.isArray(jsonData.categories)) {
        // Fallback: try 'categories' key
        
        this.categoryList = jsonData.categories.map((cat: any) => ({
          id: cat.id || cat.categoryId || '',
          name: cat.name || cat.categoryName || cat.displayName || ''
        }));
        
      } else if (jsonData && jsonData.category && Array.isArray(jsonData.category)) {
        // Fallback: try 'category' key
        
        this.categoryList = jsonData.category.map((cat: any) => ({
          id: cat.id || cat.categoryId || '',
          name: cat.name || cat.categoryName || cat.displayName || ''
        }));
        
      } else {
        
      }
      
      // Extract competitionList if available
      if (jsonData && jsonData.competitionList && Array.isArray(jsonData.competitionList)) {
        
        this.competitionList = jsonData.competitionList.map((comp: any) => {
          const compId = comp.id || comp.competitionId || '';
          const catId = comp.categoryId || comp.catId || '';
          
          // Build mapping from competitionId to categoryId
          if (compId && catId) {
            this.competitionToCategoryMap.set(compId, catId);
          }
          
          return {
            id: compId,
            name: comp.name || comp.competitionName || comp.displayName || '',
            categoryId: catId,
            matchCount: comp.matchCount || comp.count || 0
          };
        });
      }
      
      // Check if there's competition data in the response
      if (jsonData && jsonData.competitions && Array.isArray(jsonData.competitions)) {
        
        // Log competition data for analysis
        jsonData.competitions.forEach((competition: any, index: number) => {
          
        });
        
        // Create a map of competition IDs to names for direct use
        const competitionMap: Record<string, string> = {};
        jsonData.competitions.forEach((competition: any) => {
          if (competition.id && competition.name) {
            competitionMap[competition.id.toString()] = competition.name;
          }
        });

        // Store this map for use in match parsing
        (this as any).apiCompetitionMap = competitionMap;
      }
      
      // ALSO parse competitionData field (pipe-delimited format) if available
      if (jsonData && jsonData.competitionData && typeof jsonData.competitionData === 'string') {

        // Parse the pipe-delimited competition data
        const competitionEntries = jsonData.competitionData.split('|').filter((entry: string) => entry.trim());

        // Initialize or update the competition map
        if (!(this as any).apiCompetitionMap) {
          (this as any).apiCompetitionMap = {};
        }
        
        for (const entry of competitionEntries) {
          const fields = entry.split(';');
          if (fields.length >= 2) {
            const competitionId = fields[0]?.trim();
            const competitionName = fields[1]?.trim();
            const categoryId = fields[2]?.trim().toLowerCase(); // Field 2 is the category ID
            
            if (competitionId && competitionName) {
              (this as any).apiCompetitionMap[competitionId] = competitionName;
              
              // Also populate competitionToCategoryMap
              if (categoryId) {
                this.competitionToCategoryMap.set(competitionId, categoryId);
                
              } else {
                
              }
            }
          }
        }
        
      } else {

        if (jsonData) {
          
        }
        
        // Even if we don't have competitions in this response, we might have them from a previous response
        // So don't overwrite the existing apiCompetitionMap
      }
      
      // Parse JSON structure (equivalent to Power Query Json.Document)
      // Totelepep uses a special matchData field with pipe-delimited format
      if (jsonData && jsonData.matchData && typeof jsonData.matchData === 'string') {

        // Parse the pipe-delimited match data
        const parsedMatches = this.parseTotelepepMatchData(jsonData.matchData);
        matches.push(...parsedMatches);

      } else {

      }

      // Remove duplicates and validate
      return this.deduplicateAndValidate(matches);
      
    } catch (error) {
      
      return [];
    }
  }

  private parseTotelepepMatchData(matchDataString: string): TotelepepMatch[] {
    const matches: TotelepepMatch[] = [];
    
    try {
      // Split by pipe separator to get individual matches
      const matchEntries = matchDataString.split('|').filter(entry => entry.trim());

      // Log the first few complete entries to see the full structure
      
      matchEntries.slice(0, 3).forEach((entry, index) => {

        const fields = entry.split(';');

        // Log ALL fields with their positions
        fields.forEach((field, fieldIndex) => {
          
        });
        
        // Look for additional odds patterns in the complete entry
        const allOddsInEntry = this.findAllOddsInEntry(entry);
        
        allOddsInEntry.forEach((odds, oddsIndex) => {
          
        });
      });
      
      for (let i = 0; i < matchEntries.length; i++) {
        const entry = matchEntries[i];
        const match = this.parseTotelepepMatchEntry(entry, i);
        if (match) {
          matches.push(match);
          
        }
      }
      
    } catch (error) {
      
    }
    
    return matches;
  }

  private findAllOddsInEntry(entry: string): Array<{value: number, position: number, context: string}> {
    const allOdds: Array<{value: number, position: number, context: string}> = [];
    const fields = entry.split(';');
    
    fields.forEach((field, index) => {
      const trimmedField = field.trim();
      
      // Look for decimal odds patterns
      const oddsPatterns = [
        /^\d{1,3}\.\d{1,3}$/,  // 1.50, 2.25
        /^\d{1,3}$/,           // 150, 225 (could be 1.50, 2.25)
        /^\d{4}$/,             // 1500, 2250 (could be 1.500, 2.250)
      ];
      
      const isOddsLike = oddsPatterns.some(pattern => pattern.test(trimmedField));
      
      if (isOddsLike) {
        let oddsValue = parseFloat(trimmedField);
        
        // Convert formats: 150 -> 1.50, 1500 -> 1.500
        if (oddsValue >= 100 && oddsValue <= 9999 && !trimmedField.includes('.')) {
          if (oddsValue >= 1000) {
            oddsValue = oddsValue / 1000; // 1.5 -> 1.5
          } else {
            oddsValue = oddsValue / 100;  // 150 -> 1.5
          }
        }
        
        // Only realistic betting odds
        if (oddsValue >= 1.01 && oddsValue <= 50.0) {
          const context = `${fields[index-2] || ''} | ${fields[index-1] || ''} | [${trimmedField}] | ${fields[index+1] || ''} | ${fields[index+2] || ''}`;
          
          allOdds.push({
            value: oddsValue,
            position: index,
            context: context.trim()
          });
        }
      }
    });
    
    return allOdds;
  }

  private parseTotelepepMatchEntry(entry: string, index: number): TotelepepMatch | null {
    try {
      // Split by semicolon to get match fields
      const fields = entry.split(';');
      
      if (fields.length < 10) {
        
        return null;
      }

      // Extract ALL possible odds from the entry
      const allOdds = this.extractAllOddsFromEntry(fields, index);

      // Parse Totelepep match entry format:
      // Based on the logs, the format appears to be:
      // 0: matchId, 1: competitionId, 2: teams, 3: datetime, 4: homeScore, 5: awayScore, 
      // 6: homeTeamShort, 7: homeOdds, 8: "Draw", 9: drawOdds, 10: awayTeamShort, 11: awayOdds, ...
      
      const matchId = fields[0];
      const competitionId = fields[1] || '0'; // Extract competitionId from field 1, default to '0'
      const teamsString = fields[2]; // e.g., "Austria Lustenau v Kapfenberger SV"
      const datetime = fields[3]; // e.g., "26 Aug 20:30"

      // Use comprehensive odds extraction
      const homeOdds = allOdds.homeOdds || parseFloat(fields[7]) || this.generateRealisticOdds();
      const drawOdds = allOdds.drawOdds || parseFloat(fields[9]) || this.generateRealisticOdds();
      const awayOdds = allOdds.awayOdds || parseFloat(fields[11]) || this.generateRealisticOdds();
      
      // Extract team names from teams string
      const teamNames = this.extractTeamNamesFromTotelepepString(teamsString);
      if (!teamNames) {
        
        return null;
      }
      
      // Parse datetime
      const { date, time } = this.parseTotelepepDateTime(datetime);
      
      // Get competition name from competitionData if available
      // Extract marketId from field 12 (the actual market ID from API)
      let marketId = undefined;
      if (fields.length > 12) {
        const potentialMarketId = fields[12];
        if (potentialMarketId && typeof potentialMarketId === 'string' && 
            potentialMarketId.trim() !== '' && !isNaN(Number(potentialMarketId)) && Number(potentialMarketId) > 0) {
          marketId = potentialMarketId;
          
        }
      }
      
      // Extract marketBookNo from field 13
      let marketBookNo = undefined;
      if (fields.length > 13) {
        const potentialMarketBookNo = fields[13];
        if (potentialMarketBookNo && typeof potentialMarketBookNo === 'string' && 
            potentialMarketBookNo.trim() !== '' && !isNaN(Number(potentialMarketBookNo)) && Number(potentialMarketBookNo) > 0) {
          marketBookNo = potentialMarketBookNo;
          
        }
      }
      
      // Extract marketCode from field 15
      let marketCode = undefined;
      if (fields.length > 15) {
        marketCode = fields[15];
        if (marketCode && typeof marketCode === 'string' && marketCode.trim() !== '') {
          
        } else {
          marketCode = undefined;
        }
      }

      // Get the league name directly from the API competition data
      let league = 'Football League';
      
      // Try to get the competition name from the API data

      if ((this as any).apiCompetitionMap && competitionId !== '0') {
        const apiLeague = (this as any).apiCompetitionMap[competitionId];
        if (apiLeague) {
          league = apiLeague;
          
        } else {
          
        }
      } else {
        
      }
      
      // If we don't have a league name from the API, look for it in the match data itself
      // This is the key fix - look for league information directly in the match data fields
      if (league === 'Football League' || !league) {
        // Look for league information in the match data fields
        for (let i = 0; i < fields.length; i++) {
          const field = fields[i].trim();
          // Look for common league name patterns in field content
          if (field.length > 3 && 
              (field.includes('League') || field.includes('Cup') || field.includes('Championship') || 
               field.includes('World Cup') || field.includes('Euro') || field.includes('Nations League') ||
               field.includes('Qualification') || field.includes('Tournament') || field.includes('U21'))) {
            // Make sure it's not just a generic term
            if (field !== 'League' && field !== 'Cup' && field !== 'Championship') {
              league = field;
              
              break;
            }
          }
        }
      }
      
      // If we still don't have a league name, try to extract it from the teams string
      // Some APIs include the competition name in the teams string
      if (league === 'Football League' || !league) {
        // Check if teams string contains competition info
        const teamsAndCompetition = teamsString.split(',');
        if (teamsAndCompetition.length > 1) {
          // The competition might be after the teams
          const possibleCompetition = teamsAndCompetition.slice(1).join(',').trim();
          if (possibleCompetition.length > 3) {
            league = possibleCompetition;
            
          }
        }
      }

      // Extract market count from field 14 (actual market count from API)
      let marketCount = 1; // Default value
      if (fields.length > 14) {
        const potentialMarketCount = fields[14];
        if (potentialMarketCount && typeof potentialMarketCount === 'string' && 
            potentialMarketCount.trim() !== '' && !isNaN(Number(potentialMarketCount))) {
          marketCount = parseInt(potentialMarketCount);
          
        }
      }
      
      let availableMarkets: string[] = ['1X2', 'Over/Under 2.5', 'Both Teams To Score']; // Default markets
      
      const match: TotelepepMatch = {
        id: matchId,
        homeTeam: teamNames.home,
        awayTeam: teamNames.away,
        league,
        competitionId,
        categoryId: this.competitionToCategoryMap.get(competitionId), // Map competition to category
        marketId,  // Actual market ID from API (field 12)
        marketBookNo,  // Market book number from API (field 13)
        marketCode,  // Market code from API (field 15)
        kickoff: time,
        date,
        status: 'upcoming' as const,
        homeOdds: isNaN(homeOdds) ? this.generateRealisticOdds() : homeOdds,
        drawOdds: isNaN(drawOdds) ? this.generateRealisticOdds() : drawOdds,
        awayOdds: isNaN(awayOdds) ? this.generateRealisticOdds() : awayOdds,
        overUnder: {
          over: allOdds.overOdds || this.generateRealisticOdds(),
          under: allOdds.underOdds || this.generateRealisticOdds(),
          line: 2.5,
        },
        bothTeamsScore: {
          yes: allOdds.bttsYes || this.generateRealisticOdds(),
          no: allOdds.bttsNo || this.generateRealisticOdds(),
        },
        marketCount, // Add market count
        availableMarkets, // Add available markets
        isOutright: marketCode === 'OT', // Detect outright markets by OT marketCode
      };
      
      // Debug specific matches like PSV Eindhoven vs ZFK Minsk
      if (teamNames.home && teamNames.away) {

      }
      
      // Only add marketBookNo and marketCode if they exist and are valid

      if (marketBookNo !== undefined && marketBookNo !== null && 
          typeof marketBookNo === 'string' && marketBookNo.trim() !== '' && 
          marketBookNo !== 'undefined' && marketBookNo !== 'null') {
        match.marketBookNo = marketBookNo;
        
      } else {
        
      }

      if (marketCode !== undefined && marketCode !== null && 
          typeof marketCode === 'string' && marketCode.trim() !== '' && 
          marketCode !== 'undefined' && marketCode !== 'null') {
        match.marketCode = marketCode;
        
      } else {
        
      }

      return this.isValidMatch(match) ? match : null;
      
    } catch (error) {
      
      return null;
    }
  }

  private extractAllOddsFromEntry(fields: string[], entryIndex: number): any {
    const odds: any = {
      homeOdds: null,
      drawOdds: null,
      awayOdds: null,
      overOdds: null,
      underOdds: null,
      bttsYes: null,
      bttsNo: null,
      allFoundOdds: []
    };

    // Extract all numeric values that could be odds
    fields.forEach((field, index) => {
      const trimmedField = field.trim();
      
      const oddsPatterns = [
        /^\d{1,3}\.\d{1,3}$/, // 1.50, 2.25
        /^\d{1,3}$/, // 150, 225 (to be converted)
        /^\d{4}$/, // 1500, 2250 (to be converted)
        /^\d{1,2}\.\d{1}$/, // 1.5, 2.2
        /^\d{1,3}\.\d{4}$/, // 1.5000, 2.2500
        // Additional patterns for better odds detection
        /^\d+\.\d+$/, // General decimal pattern
        /^\d{3,4}$/ // 3-4 digit integers (to be converted to decimals)
      ];
      
      const oddsMatch = oddsPatterns.some(pattern => pattern.test(trimmedField));
      
      if (oddsMatch) {
        let oddsValue = parseFloat(trimmedField);
        
        // Convert formats: 150 -> 1.50, 1500 -> 1.500, 225 -> 2.25
        // Only convert values that are likely to be in the "multiplied" format
        // Be more conservative to avoid converting legitimate high odds
        if (oddsValue >= 100 && oddsValue <= 9999 && !trimmedField.includes('.')) {
          // Only convert 3-digit numbers that are likely to be multiplied format
          // e.g., 150 -> 1.50, 225 -> 2.25, 375 -> 3.75
          if (oddsValue >= 100 && oddsValue <= 999) {
            oddsValue = oddsValue / 100;  // 150 -> 1.50, 225 -> 2.25
          }
          // For 4-digit numbers, be more conservative
          // Only convert if they're in the typical range for multiplied odds (1000-2000)
          else if (oddsValue >= 1000 && oddsValue <= 2000) {
            oddsValue = oddsValue / 1000; // 1500 -> 1.500
          }
          // Values above 2000 are likely actual high odds and should remain as-is
          // e.g., 270 should remain 270, not become 2.70
        }
        
        // Only consider realistic betting odds
        // Increase the upper limit to accommodate high odds
        if (oddsValue >= 1.01 && oddsValue <= 1000.0) {
          odds.allFoundOdds.push({
            index,
            field: trimmedField,
            value: oddsValue,
            prevField: fields[index - 1] || '',
            nextField: fields[index + 1] || '',
            prev2Field: fields[index - 2] || '',
            next2Field: fields[index + 2] || ''
          });

        }
      }
    });

    // Map 1X2 odds based on known positions from your data
    this.identifyOddsTypes(odds, fields);

    return odds;
  }

  private identifyOddsTypes(odds: any, fields: string[]): void {

    odds.allFoundOdds.forEach((odd: any, i: number) => {
      const prevField = odd.prevField.toLowerCase();
      const nextField = odd.nextField.toLowerCase();
      const prev2Field = odd.prev2Field.toLowerCase();
      const next2Field = odd.next2Field.toLowerCase();
      
      // Create context string for better matching
      
      // Based on your data: Field 7=Home, Field 9=Draw, Field 11=Away
      if (odd.index === 7 && !odds.homeOdds) {
        odds.homeOdds = odd.value;
        
      }
      if (odd.index === 9 && !odds.drawOdds) {
        odds.drawOdds = odd.value;
        
      }
      if (odd.index === 11 && !odds.awayOdds) {
        odds.awayOdds = odd.value;
        
      }
    });
    
    // Look for additional odds beyond 1X2 in the remaining fields
    const remainingOdds = odds.allFoundOdds.filter((odd: any) => 
      odd.index !== 7 && odd.index !== 9 && odd.index !== 11
    );
    
    // Pattern 1: BTTS odds detection with improved logic
    if (!odds.bttsYes || !odds.bttsNo) {
      // Look for BTTS indicators in field context
      for (let i = 0; i < odds.allFoundOdds.length; i++) {
        const odd = odds.allFoundOdds[i];
        const prevField = odd.prevField.toLowerCase();
        const nextField = odd.nextField.toLowerCase();
        const prev2Field = odd.prev2Field.toLowerCase();
        const next2Field = odd.next2Field.toLowerCase();
        
        // Check for BTTS related keywords in surrounding fields
        const bttsIndicators = ['btts', 'both teams', 'both team', 'both to score', 'yes', 'no'];
        const hasBttsIndicator = bttsIndicators.some(indicator => 
          prevField.includes(indicator) || nextField.includes(indicator) || 
          prev2Field.includes(indicator) || next2Field.includes(indicator)
        );
        
        // If we find BTTS indicators and the odds are in a realistic range
        if (hasBttsIndicator && odd.value >= 1.20 && odd.value <= 5.00) {
          // Look for the paired odds (usually consecutive)
          const pairedOdd = odds.allFoundOdds.find((otherOdd: any) => 
            otherOdd.index > odd.index && 
            Math.abs(otherOdd.index - odd.index) <= 3 &&
            otherOdd.value >= 1.20 && otherOdd.value <= 5.00
          );
          
          if (pairedOdd) {
            // Determine which is Yes and which is No based on common patterns
            // BTTS Yes is often the lower odds (more likely)
            if (odd.value <= pairedOdd.value) {
              odds.bttsYes = odd.value;
              odds.bttsNo = pairedOdd.value;
              
            } else {
              odds.bttsYes = pairedOdd.value;
              odds.bttsNo = odd.value;
              
            }
            break;
          }
        }
      }
      
      // Fallback: Look for consecutive odds pairs in BTTS range
      if (!odds.bttsYes || !odds.bttsNo) {
        for (let i = 0; i < remainingOdds.length - 1; i++) {
          const odd1 = remainingOdds[i];
          const odd2 = remainingOdds[i + 1];
          
          // Check if they are consecutive and in BTTS range
          if (odd2.index === odd1.index + 1 && 
              odd1.value >= 1.40 && odd1.value <= 3.50 &&
              odd2.value >= 1.40 && odd2.value <= 3.50) {
            
            // BTTS Yes is usually lower odds than BTTS No
            if (odd1.value < odd2.value) {
              odds.bttsYes = odd1.value;
              odds.bttsNo = odd2.value;
            } else {
              odds.bttsYes = odd2.value;
              odds.bttsNo = odd1.value;
            }
            
            break;
          }
        }
      }
    }
    
    // Pattern 2: Over/Under odds detection
    if (!odds.overOdds || !odds.underOdds) {
      // Look for Over/Under indicators in field context
      for (let i = 0; i < odds.allFoundOdds.length; i++) {
        const odd = odds.allFoundOdds[i];
        const prevField = odd.prevField.toLowerCase();
        const nextField = odd.nextField.toLowerCase();
        const prev2Field = odd.prev2Field.toLowerCase();
        const next2Field = odd.next2Field.toLowerCase();
        
        // Check for Over/Under related keywords
        const overIndicators = ['over', 'o ', 'o/', '>'];
        const underIndicators = ['under', 'u ', 'u/', '<'];
        
        const isOver = overIndicators.some(indicator => 
          prevField.includes(indicator) || nextField.includes(indicator) || 
          prev2Field.includes(indicator) || next2Field.includes(indicator)
        );
        
        const isUnder = underIndicators.some(indicator => 
          prevField.includes(indicator) || nextField.includes(indicator) || 
          prev2Field.includes(indicator) || next2Field.includes(indicator)
        );
        
        // If we find Over/Under indicators and the odds are in a realistic range
        if ((isOver || isUnder) && odd.value >= 1.20 && odd.value <= 5.00) {
          // Look for the paired odds
          const pairedOdd = odds.allFoundOdds.find((otherOdd: any) => 
            otherOdd.index > odd.index && 
            Math.abs(otherOdd.index - odd.index) <= 3 &&
            otherOdd.value >= 1.20 && otherOdd.value <= 5.00
          );
          
          if (pairedOdd) {
            // Determine which is Over and which is Under
            if (isOver) {
              odds.overOdds = odd.value;
              odds.underOdds = pairedOdd.value;
              
            } else if (isUnder) {
              odds.underOdds = odd.value;
              odds.overOdds = pairedOdd.value;
              
            }
            break;
          }
        }
      }
      
      // Fallback: Look for consecutive odds pairs in O/U range
      if (!odds.overOdds || !odds.underOdds) {
        const remainingOdds = odds.allFoundOdds.filter((odd: any) => 
          odd.index > 15 && // After BTTS typically
          odd.value >= 1.50 && odd.value <= 3.00 // O/U range
        );
        
        if (remainingOdds.length >= 2 && !odds.overOdds && !odds.underOdds) {
          odds.overOdds = remainingOdds[0].value;
          odds.underOdds = remainingOdds[1].value;
          
        }
      }
    }
    
    // Pattern 3: Fill missing 1X2 odds if not found in standard positions
    const mainOdds = odds.allFoundOdds.filter((odd: any) => 
      odd.index >= 6 && odd.index <= 12 && // Around standard 1X2 positions
      odd.value >= 1.10 && odd.value <= 20.00 // 1X2 range
    );
    
    if (!odds.homeOdds && mainOdds.length > 0) {
      odds.homeOdds = mainOdds[0].value;
      
    }
    if (!odds.drawOdds && mainOdds.length > 1) {
      odds.drawOdds = mainOdds[1].value;
      
    }
    if (!odds.awayOdds && mainOdds.length > 2) {
      odds.awayOdds = mainOdds[2].value;
      
    }
    
    // Ensure all odds have values
    if (!odds.overOdds) odds.overOdds = this.generateRealisticOdds();
    if (!odds.underOdds) odds.underOdds = this.generateRealisticOdds();
    if (!odds.bttsYes) odds.bttsYes = this.generateRealisticOdds();
    if (!odds.bttsNo) odds.bttsNo = this.generateRealisticOdds();
  }

  private extractTeamNamesFromTotelepepString(teamsString: string): { home: string; away: string } | null {
    // Totelepep uses " v " as separator
    if (teamsString.includes(' v ')) {
      const parts = teamsString.split(' v ');
      if (parts.length === 2) {
        return {
          home: parts[0].trim(),
          away: parts[1].trim()
        };
      }
    }
    
    // Fallback to other separators
    const separators = [' vs ', ' - ', ' x '];
    for (const separator of separators) {
      if (teamsString.includes(separator)) {
        const parts = teamsString.split(separator);
        if (parts.length === 2) {
          return {
            home: parts[0].trim(),
            away: parts[1].trim()
          };
        }
      }
    }
    
    // For outright markets (no separator), use the entire string as homeTeam and empty awayTeam
    // This allows outright markets like "Top Goalscorer" to be displayed
    if (teamsString.trim().length > 0) {
      
      return {
        home: teamsString.trim(),
        away: '' // Will be handled by isOutright logic
      };
    }
    
    return null;
  }

  private parseTotelepepDateTime(datetime: string): { date: string; time: string } {
    try {
      // Format: "26 Aug 20:30"
      const parts = datetime.split(' ');
      if (parts.length >= 3) {
        const day = parts[0];
        const month = parts[1];
        const time = parts[2];
        
        // Convert month name to number
        const monthMap: Record<string, string> = {
          'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
          'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
          'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        };
        
        const monthNum = monthMap[month] || '01';
        
        // Determine year - use current year for current and future months
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        
        // For simplicity, use current year (matches are typically within current year)
        const year = currentYear;
        
        const date = `${year}-${monthNum}-${day.padStart(2, '0')}`;
        
        return { date, time };
      }
    } catch (error) {
      
    }
    
    return {
      date: new Date().toISOString().split('T')[0],
      time: this.generateRealisticTime()
    };
  }
  
  // Method to get league name with dynamic mapping as first priority
  private getLeagueFromCompetitionId(competitionId: string): string | null {

    // Check dynamic mapping first
    if (this.dynamicCompetitionMap[competitionId]) {
      const dynamicLeague = this.dynamicCompetitionMap[competitionId];
      
      return dynamicLeague;
    }
    
    // Then check our static mapping
    const competitionMap: Record<string, string> = {
      '1': 'England - Premier League',
      '2': 'England - Championship',
      '3': 'England - League One',
      '4': 'England - League Two',
      '5': 'Scotland - Premiership',
      '6': 'Scotland - Championship',
      '7': 'Germany - Bundesliga',
      '8': 'Germany - 2. Bundesliga',
      '9': 'Spain - La Liga',
      '10': 'Spain - Segunda Division',
      '11': 'Italy - Serie A',
      '12': 'Italy - Serie B',
      '13': 'France - Ligue 1',
      '14': 'France - Ligue 2',
      '15': 'Netherlands - Eredivisie',
      '16': 'Netherlands - Eerste Divisie',
      '17': 'Iran - Pro League',
      '18': 'Turkey - Super Lig',
      '19': 'Turkey - 1. Lig',
      '20': 'Belgium - First Division A',
      '21': 'Belgium - First Division B',
      '22': 'Portugal - Primeira Liga',
      '23': 'Portugal - Liga Portugal 2',
      '24': 'Greece - Super League',
      '25': 'Greece - Super League 2',
      '26': 'Denmark - Superliga',
      '27': 'Denmark - 1st Division',
      '28': 'Norway - Eliteserien',
      '29': 'Norway - 1. Division',
      '30': 'Sweden - Allsvenskan',
      '31': 'Sweden - Superettan',
      '32': 'Japan - J1 League',
      '33': 'Japan - J2 League',
      '34': 'China - Super League',
      '35': 'Egypt - Premier League',
      '36': 'Saudi Arabia - Pro League',
      '37': 'South Korea - K League 1',
      '38': 'Lithuania - A Lyga',
      '39': 'Croatia - First Football League',
      '40': 'Czechia - First League',
      '41': 'Austria - Bundesliga',
      '42': 'Switzerland - Super League',
      '43': 'Switzerland - Challenge League',
      '44': 'Poland - Ekstraklasa',
      '45': 'Poland - I Liga',
      '46': 'Russia - Premier League',
      '47': 'Ukraine - Premier League',
      '48': 'Israel - Premier League',
      '49': 'Romania - Liga I',
      '50': 'UEFA Champions League',
      '51': 'UEFA Europa League',
      '52': 'Japan - Emperor Cup',
      '53': 'England - FA Cup',
      '54': 'England - EFL Trophy',
      '55': 'UEFA Conference League',
      '56': 'Copa Libertadores',
      '57': 'Copa Sudamericana',
      '58': 'Argentina - Primera Division',
      '59': 'Brazil - Serie A',
      '60': 'Mexico - Liga MX',
      '61': 'USA - MLS',
      '62': 'Australia - A-League',
      '63': 'South Africa - Premier Soccer League',
      '64': 'India - ISL',
      '65': 'Thailand - Thai League 1',
      '66': 'Malaysia - Super League',
      '67': 'Singapore - Premier League',
      '68': 'Hong Kong - Premier League',
      '69': 'Indonesia - Liga 1',
      '70': 'Philippines - Philippines Football League',
      '71': 'Vietnam - V.League 1',
      '72': 'Myanmar - National League',
      '73': 'Cambodia - C-League',
      '74': 'Laos - Lao League',
      '75': 'Brunei - Premier League',
      '76': 'Maldives - Dhivehi Premier League',
      '77': 'Nepal - Nepal Super League',
      '78': 'Bhutan - Bhutan Premier League',
      '79': 'Bangladesh - Bangladesh Premier League',
      '80': 'Sri Lanka - Sri Lanka Premier League',
      '81': 'Austria - OFB Cup',
      '82': 'Switzerland - Swiss Cup',
      '83': 'Poland - Polish Cup',
      '84': 'Russia - Russian Cup',
      '85': 'Ukraine - Ukrainian Cup',
      '86': 'Israel - Israeli Cup',
      '87': 'Romania - Romanian Cup',
      '88': 'Croatia - Croatian Cup',
      '89': 'Czechia - Czech Cup',
      '90': 'Slovakia - Slovak Cup',
      '91': 'Slovenia - Slovenian Cup',
      '92': 'Hungary - Hungarian Cup',
      '93': 'Bulgaria - Bulgarian Cup',
      '94': 'Serbia - Serbian Cup',
      '95': 'Bosnia and Herzegovina - Bosnian Cup',
      '96': 'Montenegro - Montenegrin Cup',
      '97': 'North Macedonia - Macedonian Cup',
      '98': 'Albania - Albanian Cup',
      '99': 'Kosovo - Kosovan Cup',
      '100': 'Belarus - Belarusian Cup',
      '101': 'Estonia - Estonian Cup',
      '102': 'Latvia - Latvian Cup',
      '103': 'Lithuania - Lithuanian Cup',
      '104': 'Moldova - Moldovan Cup',
      '105': 'Armenia - Armenian Cup',
      '106': 'Azerbaijan - Azerbaijani Cup',
      '107': 'Georgia - Georgian Cup',
      '108': 'Kazakhstan - Kazakhstani Cup',
      '109': 'Uzbekistan - Uzbekistani Cup',
      '110': 'Turkmenistan - Turkmenistani Cup',
      '111': 'Kyrgyzstan - Kyrgyzstani Cup',
      '112': 'Czechia - Czech Cup',
      '113': 'Slovakia - Slovak Cup',
      '114': 'Slovenia - Slovenian Cup',
      '115': 'Hungary - Hungarian Cup',
      '116': 'Bulgaria - Bulgarian Cup',
      '117': 'Serbia - Serbian Cup',
      '118': 'Bosnia and Herzegovina - Bosnian Cup',
      '119': 'Montenegro - Montenegrin Cup',
      '120': 'North Macedonia - Macedonian Cup',
      '121': 'Albania - Albanian Cup',
      '122': 'Kosovo - Kosovan Cup',
      '123': 'Belarus - Belarusian Cup',
      '124': 'Estonia - Estonian Cup',
      '125': 'Latvia - Latvian Cup',
      '126': 'England - EFL Cup',
      '127': 'Germany - DFB-Pokal',
      '128': 'Spain - Copa del Rey',
      '129': 'Italy - Coppa Italia',
      '130': 'France - Coupe de France',
      '131': 'Netherlands - KNVB Cup',
      '132': 'Belgium - Belgian Cup',
      '133': 'Portugal - Taça de Portugal',
      '134': 'Greece - Greek Cup',
      '135': 'UEFA Europa League',
      '136': 'UEFA Champions League Qualifying',
      '137': 'UEFA Europa League Qualifying',
      '138': 'Germany - DFB Pokal',
      '139': 'France - Coupe de la Ligue',
      '140': 'Scotland - Scottish Cup',
      '141': 'Scotland - League Cup',
      '142': 'Republic of Ireland - FAI Cup',
      '143': 'Northern Ireland - Irish Cup',
      '144': 'Wales - Welsh Cup',
      '145': 'Finland - Finnish Cup',
      '146': 'Iceland - Icelandic Cup',
      '147': 'Faroe Islands - Faroe Islands Cup',
      '148': 'Luxembourg - Luxembourg Cup',
      '149': 'Malta - Maltese Cup',
      '150': 'Andorra - Andorran Cup',
      '151': 'San Marino - Sammarinese Cup',
      '152': 'Liechtenstein - Liechtenstein Cup',
      '153': 'Monaco - Monégasque Cup',
      '154': 'Vatican City - Vatican City Cup',
      '155': 'England - Community Shield',
      '156': 'Germany - DFL-Supercup',
      '157': 'Spain - Supercopa de España',
      '158': 'Italy - Supercoppa Italiana',
      '159': 'France - Trophée des Champions',
      '160': 'Netherlands - Johan Cruyff Shield',
      '161': 'Belgium - Belgian Supercup',
      '162': 'Portugal - Supertaça Cândido de Oliveira',
      '163': 'Spain - LaLiga',
      '164': 'Italy - Serie A',
      '165': 'Germany - Bundesliga',
      '166': 'France - Ligue 1',
      '167': 'England - Premier League',
      '168': 'Netherlands - Eredivisie',
      '169': 'Belgium - First Division A',
      '170': 'Portugal - Primeira Liga',
      '171': 'Greece - Super League',
      '172': 'Turkey - Super Lig',
      '173': 'Denmark - Superliga',
      '174': 'Norway - Eliteserien',
      '175': 'Sweden - Allsvenskan',
      '176': 'Switzerland - Super League',
      '177': 'Austria - Bundesliga',
      '178': 'Czechia - First League',
      '179': 'Croatia - First Football League',
      '180': 'Slovakia - First League',
      '181': 'Slovenia - PrvaLiga',
      '182': 'Hungary - Nemzeti Bajnokság I',
      '183': 'Bulgaria - First League',
      '184': 'Serbia - SuperLiga',
      '185': 'Bosnia and Herzegovina - Premier League',
      '186': 'Montenegro - First League',
      '187': 'North Macedonia - First League',
      '188': 'Albania - Superliga',
      '189': 'Kosovo - Superliga',
      '190': 'Belarus - Premier League',
      '191': 'Estonia - Meistriliiga',
      '192': 'Latvia - Virslīga',
      '193': 'Lithuania - A Lyga',
      '194': 'Moldova - National Division',
      '195': 'Armenia - Premier League',
      '196': 'Azerbaijan - Premier League',
      '197': 'Georgia - Erovnuli Liga',
      '198': 'Kazakhstan - Premier League',
      '199': 'Uzbekistan - Super League',
      '200': 'Turkmenistan - Ýokary Liga',
      '201': 'Kyrgyzstan - Premier League',
      '202': 'Tajikistan - Vysshaya Liga',
      '203': 'Kuwait - Premier League',
      '204': 'Bahrain - Premier League',
      '205': 'Qatar - Stars League',
      '206': 'United Arab Emirates - Pro League',
      '207': 'Oman - Professional League',
      '208': 'Yemen - Yemeni League',
      '209': 'Jordan - Jordanian Pro League',
      '210': 'Lebanon - Lebanese Premier League',
      '211': 'Syria - Syrian Premier League',
      '212': 'Palestine - West Bank Premier League',
      '213': 'Iraq - Iraqi Premier League',
      '214': 'Iran - Pro League',
      '215': 'Afghanistan - Afghan Premier League',
      '216': 'Pakistan - Pakistan Premier League',
      '217': 'India - ISL',
      '218': 'Bangladesh - Bangladesh Premier League',
      '219': 'Sri Lanka - Sri Lanka Premier League',
      '220': 'Maldives - Dhivehi Premier League',
      '221': 'Nepal - Nepal Super League',
      '222': 'Bhutan - Bhutan Premier League',
      '223': 'Myanmar - National League',
      '224': 'International Youth - U21 UEFA European Championship, Qualification',
      '225': 'Vietnam - V.League 1',
      '226': 'Laos - Lao League',
      '227': 'Cambodia - C-League',
      '228': 'Indonesia - Liga 1',
      '229': 'Malaysia - Super League',
      '230': 'Brunei - Premier League',
      '231': 'Singapore - Premier League',
      '232': 'Philippines - Philippines Football League',
      '233': 'East Timor - Liga Primeira',
      '234': 'Croatia - Croatian Cup',
      '235': 'Czechia - Czech Cup',
      '236': 'Slovakia - Slovak Cup',
      '237': 'Slovenia - Slovenian Cup',
      '238': 'Hungary - Hungarian Cup',
      '239': 'Bulgaria - Bulgarian Cup',
      '240': 'Serbia - Serbian Cup',
      '241': 'Bosnia and Herzegovina - Bosnian Cup',
      '242': 'Montenegro - Montenegrin Cup',
      '243': 'North Macedonia - Macedonian Cup',
      '244': 'Albania - Albanian Cup',
      '245': 'Kosovo - Kosovan Cup',
      '246': 'Belarus - Belarusian Cup',
      '247': 'Estonia - Estonian Cup',
      '248': 'Latvia - Latvian Cup',
      '249': 'Lithuania - Lithuanian Cup',
      '250': 'Moldova - Moldovan Cup',
      '398': 'International Youth - U21 UEFA European Championship, Qualification',
      '399': 'International Youth - U21 UEFA European Championship, Qualification',
      '400': 'International Youth - U21 UEFA European Championship, Qualification'
    };
    
    const leagueName = competitionMap[competitionId] || null;
    
    return leagueName;
  }
  
  // Alternative method to get a more generic league name if the specific one is not found
  private getGenericLeagueFromCompetitionId(competitionId: string): string {
    // If we can't find a specific mapping, try to provide a more generic name
    const genericMap: Record<string, string> = {
      // Generic mappings for common patterns
      '1': 'England - Premier League',
      '2': 'England - Championship',
      '3': 'England - League One',
      '4': 'England - League Two',
      '5': 'Scotland - Premiership',
      '7': 'Germany - Bundesliga',
      '9': 'Spain - La Liga',
      '11': 'Italy - Serie A',
      '13': 'France - Ligue 1',
      '15': 'Netherlands - Eredivisie',
      '17': 'Iran - Pro League',
      '38': 'Lithuania - A Lyga',
      '41': 'Austria - Bundesliga',
      '42': 'Switzerland - Super League',
      '44': 'Poland - Ekstraklasa',
      '50': 'UEFA Champions League',
      '51': 'UEFA Europa League',
      '52': 'Japan - Emperor Cup',
      '55': 'UEFA Conference League',
      '65': 'Thailand - Thai League 1',
      '75': 'Brunei - Premier League',
      '79': 'Bangladesh - Bangladesh Premier League',
      '81': 'Austria - OFB Cup',
      '126': 'England - EFL Cup',
      '135': 'UEFA Europa League',
      '138': 'Germany - DFB Pokal',
      '149': 'Malta - Maltese Cup',
      '163': 'Spain - LaLiga',
      '178': 'Czechia - First League',
      '196': 'Azerbaijan - Premier League',
      '224': 'International Youth - U21 UEFA European Championship, Qualification',
      '398': 'International Youth - U21 UEFA European Championship, Qualification'
    };
    
    return genericMap[competitionId] || 'Football League';
  }

  private convertAPIMatchToTotelepepMatch(apiMatch: any, index: number): TotelepepMatch | null {
    try {

      // Map API fields to our TotelepepMatch structure
      // This will depend on the actual API response structure
      
      // Extract team names
      const homeTeam = apiMatch.homeTeam || apiMatch.home || apiMatch.team1 || apiMatch.homeTeamName || apiMatch.participant1 || 'Home Team';
      const awayTeam = apiMatch.awayTeam || apiMatch.away || apiMatch.team2 || apiMatch.awayTeamName || apiMatch.participant2 || 'Away Team';
      
      // Extract competition ID
      const competitionId = apiMatch.competitionId || '0';
      
      // Get the league name directly from the API
      let league = apiMatch.league || apiMatch.competition || apiMatch.tournament || apiMatch.competitionName || apiMatch.categoryName || 'Football League';
      
      // If we don't have a league name from the API, try to get it from our API competition map
      if ((league === 'Football League' || !league) && (this as any).apiCompetitionMap && competitionId !== '0') {
        const apiLeague = (this as any).apiCompetitionMap[competitionId];
        if (apiLeague) {
          league = apiLeague;
          
        } else {
          
        }
      }
      
      // If we still don't have a league name, look for it in other API fields
      if (league === 'Football League' || !league) {
        // Look for league information in other API fields
        const possibleLeagueFields = [
          apiMatch.competitionName, apiMatch.category, apiMatch.tournamentName, 
          apiMatch.eventName, apiMatch.groupName, apiMatch.leagueName
        ];
        
        for (const field of possibleLeagueFields) {
          if (field && field.length > 3) {
            // Check if it looks like a real league name
            if (field.includes('League') || field.includes('Cup') || field.includes('Championship') || 
                field.includes('World Cup') || field.includes('Euro') || field.includes('Nations League') ||
                field.includes('Qualification') || field.includes('Tournament') || field.includes('U21')) {
              league = field;
              
              break;
            }
          }
        }
      }
      
      const match: TotelepepMatch = {
        id: apiMatch.id || apiMatch.matchId || apiMatch.eventId || `api-${index}`,
        homeTeam,
        awayTeam,
        league,
        competitionId: competitionId || '0', // Ensure we always have a competitionId
        categoryId: competitionId ? this.competitionToCategoryMap.get(competitionId) : undefined,
        kickoff: this.formatTime(apiMatch.time || apiMatch.kickoff || apiMatch.startTime),
        date: this.formatDate(apiMatch.date || apiMatch.matchDate || apiMatch.gameDate),
        status: this.parseStatus(apiMatch.status || apiMatch.state || apiMatch.matchStatus) as 'upcoming' | 'live' | 'finished',
        
        // Extract odds from API response
        homeOdds: this.parseOdds(apiMatch.homeOdds || apiMatch.odds?.home || apiMatch.odds?.['1'] || apiMatch.homeWinOdds),
        drawOdds: this.parseOdds(apiMatch.drawOdds || apiMatch.odds?.draw || apiMatch.odds?.['X'] || apiMatch.drawOdds),
        awayOdds: this.parseOdds(apiMatch.awayOdds || apiMatch.odds?.away || apiMatch.odds?.['2'] || apiMatch.awayWinOdds),
        
        overUnder: {
          over: this.parseOdds(apiMatch.overOdds || apiMatch.odds?.over || apiMatch.totals?.over || apiMatch.over25),
          under: this.parseOdds(apiMatch.underOdds || apiMatch.odds?.under || apiMatch.totals?.under || apiMatch.under25),
          line: apiMatch.line || apiMatch.totals?.line || 2.5,
        },
        
        bothTeamsScore: {
          yes: this.parseOdds(apiMatch.bttsYes || apiMatch.odds?.bttsYes || apiMatch.btts?.yes || apiMatch.bothTeamsScoreYes),
          no: this.parseOdds(apiMatch.bttsNo || apiMatch.odds?.bttsNo || apiMatch.btts?.no || apiMatch.bothTeamsScoreNo),
        },
        
        // Live match data
        homeScore: apiMatch.homeScore || apiMatch.score?.home,
        awayScore: apiMatch.awayScore || apiMatch.score?.away,
        minute: apiMatch.minute || apiMatch.time?.minute,
      };

      return this.isValidMatch(match) ? match : null;
      
    } catch (error) {
      
      return null;
    }
  }

  private convertTotelepepMatchToJSON(data: any): any | null {
    try {
      return JSON.stringify(data);
    } catch (err) {
      
    }

    return null;
  }

  private extractTotelepepMatches(pageBody: any): TotelepepMatch[] {
    const matches = new Array<TotelepepMatch>();
    
    // Parse page HTML, use this DOM tree as it was
    const parser = new DOMParser();
    const doc = parser.parseFromString(pageBody, "text/html");

    if (doc.body.children[1] && (doc.body.children[1] as HTMLElement).innerText && (doc.body.children[1] as HTMLElement).innerText.trim() !== "") {
      const divs = doc.querySelectorAll('div');
      for (let i = 0; i < divs.length; i++) {
        const match = this.extractMatchFromTotelepepContainer(divs[i].outerHTML, `div-${i}`);
        if (match) {
          matches.push(match);
        }
      }
    }
    
    return matches;
  }
  
  private extractTotelepepMatchesFromHTML(pageBody: any): TotelepepMatch[] {
    const matches = new Array<TotelepepMatch>();
    
    // Parse page HTML, use this DOM tree as it was
    const parser = new DOMParser();
    const doc = parser.parseFromString(pageBody, "text/html");

    if (doc.body.children[1] && (doc.body.children[1] as HTMLElement).innerText && (doc.body.children[1] as HTMLElement).innerText.trim() !== "") {
      const divs = doc.querySelectorAll('div');
      for (let i = 0; i < divs.length; i++) {
        const match = this.extractMatchFromTotelepepContainer(divs[i].outerHTML, `div-${i}`);
        if (match) {
          matches.push(match);
        }
      }
    }
    
    return matches;
  }

  private extractFromTotelepepTables(html: string): TotelepepMatch[] {
    const matches: TotelepepMatch[] = [];
    
    // Find tables with betting/match data - Totelepep specific patterns
    const tableRegex = /<table[^>]*(?:class="[^"]*(?:match|bet|odds|fixture|game)[^"]*"|id="[^"]*(?:match|bet|odds|fixture|game)[^"]*")[^>]*>(.*?)<\/table>/gis;
    let tables = html.match(tableRegex) || [];
    
    // Also check for tables without specific classes but containing betting data
    if (tables.length === 0) {
      const allTablesRegex = /<table[^>]*>(.*?)<\/table>/gis;
      const allTables = html.match(allTablesRegex) || [];

      // Filter tables that contain betting-related content
      const filteredTables: (string | RegExpMatchArray[number])[] = [];
      for (const table of allTables) {
        if (this.containsBettingData(table)) {
          filteredTables.push(table);
        }
      }
      tables = filteredTables as RegExpMatchArray;
    }

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      
      // Extract table rows - skip header rows
      const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
      const rows = table.match(rowRegex) || [];
      
      for (let j = 0; j < rows.length; j++) {
        const row = rows[j];
        
        // Skip header rows and empty rows
        if (this.isHeaderRow(row) || this.isEmptyRow(row)) continue;
        
        const match = this.extractMatchFromTotelepepRow(row, `table-${i}-row-${j}`);
        if (match) {
          matches.push(match);
          
        }
      }
    }
    
    return matches;
  }

  private containsBettingData(table: string): boolean {
    const bettingIndicators = [
      'odds', 'bet', 'match', 'fixture', 'game', 'team', 'vs', 'v ',
      '1.', '2.', '3.', '4.', '5.', // Decimal odds patterns
      'home', 'away', 'draw', 'over', 'under', 'btts',
      'premier', 'league', 'championship', 'cup', 'division'
    ];
    
    const tableText = table.toLowerCase();
    return bettingIndicators.some(indicator => tableText.includes(indicator));
  }

  private isEmptyRow(row: string): boolean {
    const cellContent = this.cleanHtmlContent(row);
    return cellContent.trim().length < 5; // Very short rows are likely empty
  }

  private extractFromTotelepepContainers(html: string): TotelepepMatch[] {
    const matches: TotelepepMatch[] = [];
    
    // Look for Totelepep-specific div containers with match data
    const divPatterns = [
      // Totelepep specific patterns
      /<div[^>]*class="[^"]*(?:match|fixture|game|event|bet|odds)[^"]*"[^>]*>(.*?)<\/div>/gis,
      /<div[^>]*id="[^"]*(?:match|fixture|game|event|bet|odds)[^"]*"[^>]*>(.*?)<\/div>/gis,
      // Generic containers that might hold match data
      /<article[^>]*>(.*?)<\/article>/gis,
      /<section[^>]*class="[^"]*(?:match|sport|bet)[^"]*"[^>]*>(.*?)<\/section>/gis,
      // List items that might contain matches
      /<li[^>]*class="[^"]*(?:match|fixture|game)[^"]*"[^>]*>(.*?)<\/li>/gis
    ];
    
    for (const pattern of divPatterns) {
      const divs = html.match(pattern) || [];

      for (let i = 0; i < divs.length; i++) {
        const match = this.extractMatchFromTotelepepContainer(divs[i], `div-${i}`);
        if (match) {
          matches.push(match);
          
        }
      }
    }
    
    return matches;
  }

  private extractFromTotelepepJavaScript(html: string): TotelepepMatch[] {
    const matches: TotelepepMatch[] = [];
    
    // Look for Totelepep-specific JavaScript variables containing match data
    const jsPatterns = [
      // Common variable names for match data
      /var\s+matches\s*=\s*(\[.*?\]);/s,
      /const\s+matches\s*=\s*(\[.*?\]);/s,
      /let\s+matches\s*=\s*(\[.*?\]);/s,
      /var\s+fixtures\s*=\s*(\[.*?\]);/s,
      /var\s+games\s*=\s*(\[.*?\]);/s,
      /var\s+events\s*=\s*(\[.*?\]);/s,
      // JSON data patterns
      /"matches"\s*:\s*(\[.*?\])/s,
      /"fixtures"\s*:\s*(\[.*?\])/s,
      /"games"\s*:\s*(\[.*?\])/s,
      /"events"\s*:\s*(\[.*?\])/s,
      // Window object patterns
      /window\.matchData\s*=\s*(\[.*?\]);/s,
      /window\.fixtures\s*=\s*(\[.*?\]);/s,
      /window\.bettingData\s*=\s*(\[.*?\]);/s,
      // Framework-specific patterns
      /matchData\s*=\s*(\[.*?\]);/s,
      /__INITIAL_STATE__\s*=\s*({.*?});/s,
      /window\.__NUXT__\s*=\s*({.*?});/s,
      /__NEXT_DATA__\s*=\s*({.*?});/s,
      // API response patterns
      /apiData\s*=\s*({.*?});/s,
      /responseData\s*=\s*({.*?});/s
    ];
    
    for (const pattern of jsPatterns) {
      const match = html.match(pattern);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          if (Array.isArray(data)) {
            
            const jsMatches = this.parseJavaScriptMatches(data);
            matches.push(...jsMatches);
          } else if (data.matches && Array.isArray(data.matches)) {
            
            const jsMatches = this.parseJavaScriptMatches(data.matches);
            matches.push(...jsMatches);
          }
        } catch (e) {
          
        }
      }
    }
    
    return matches;
  }

  private isHeaderRow(row: string): boolean {
    const headerIndicators = [
      '<th', 'thead', 'header', 'Header', 'HEADER',
      'Time', 'Team', 'Teams', 'Match', 'Odds', 'League',
      'Competition', 'Event', 'Fixture', 'Home', 'Away', 'Draw'
    ];
    
    return headerIndicators.some(indicator => 
      row.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  private extractMatchFromTotelepepRow(row: string, id: string): TotelepepMatch | null {
    try {
      // Extract cell contents from table row
      const cellRegex = /<td[^>]*>(.*?)<\/td>/gis;
      const cells: string[] = [];
      let cellMatch;
      
      while ((cellMatch = cellRegex.exec(row)) !== null) {
        const cellContent = this.cleanHtmlContent(cellMatch[1]);
        if (cellContent.trim()) {
          cells.push(cellContent.trim());
        }
      }
      
      // Also try th elements for header-like content that might contain data
      const headerCellRegex = /<th[^>]*>(.*?)<\/th>/gis;
      while ((cellMatch = headerCellRegex.exec(row)) !== null) {
        const cellContent = this.cleanHtmlContent(cellMatch[1]);
        if (cellContent.trim()) {
          cells.push(cellContent.trim());
        }
      }
      
      if (cells.length < 2) {
        return null; // Not enough data for a match
      }

      // Extract team names
      const teamInfo = this.extractTeamNames(cells);
      if (!teamInfo) {
        
        return null;
      }
      
      // Extract other data
      const matchTime = this.extractTime(cells);
      let league = this.extractLeague(cells);
      const odds = this.extractOdds(cells);
      
      // If we couldn't get a league name, look for it in the cell data
      if (!league || league === 'Football League') {
        // Look for league information in the cell data
        for (const cell of cells) {
          if (cell.length > 3 && 
              (cell.includes('League') || cell.includes('Cup') || cell.includes('Championship') || 
               cell.includes('World Cup') || cell.includes('Euro') || cell.includes('Nations League') ||
               cell.includes('Qualification') || cell.includes('Tournament'))) {
            league = cell;
            
            break;
          }
        }
      }
      
      return {
        id,
        homeTeam: teamInfo.home,
        awayTeam: teamInfo.away,
        league: league || 'Football League',
        competitionId: '0', // Default competition ID for HTML parsing
        kickoff: matchTime || this.generateRealisticTime(),
        date: this.getTodayDate(),
        status: 'upcoming' as const,
        homeOdds: odds.home || this.generateRealisticOdds(),
        drawOdds: odds.draw || this.generateRealisticOdds(),
        awayOdds: odds.away || this.generateRealisticOdds(),
        overUnder: {
          over: odds.over || this.generateRealisticOdds(),
          under: odds.under || this.generateRealisticOdds(),
          line: 2.5,
        },
        bothTeamsScore: {
          yes: odds.bttsYes || this.generateRealisticOdds(),
          no: odds.bttsNo || this.generateRealisticOdds(),
        },
      };
      
    } catch (error) {
      
      return null;
    }
  }

  private extractMatchFromTotelepepContainer(divContent: string, id: string): TotelepepMatch | null {
    const textContent = this.cleanHtmlContent(divContent);

    // Extract team names
    const teamInfo = this.extractTeamNamesFromText(textContent);
    if (!teamInfo) {
      
      return null;
    }
    
    // Extract time
    const timeMatch = textContent.match(/(\d{1,2}:\d{2})/);
    const matchTime = timeMatch ? timeMatch[1] : null;
    
    // Extract odds
    const odds = this.extractOddsFromText(textContent);
    
    // Try to extract league from text content
    let league = 'Football League';
    const leagueIndicators = [
      // Major leagues
      'Premier League', 'Championship', 'League One', 'League Two',
      'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1', 'Eredivisie',
      // Competitions
      'Champions League', 'Europa League', 'Conference League',
      'FA Cup', 'EFL Cup', 'Copa del Rey', 'Coppa Italia',
      // Generic terms
      'League', 'Liga', 'Serie', 'Cup', 'Champions', 'Europa',
      'Premier', 'Division', 'Championship', 'Tournament',
      // International
      'World Cup', 'Euro', 'Nations League', 'Qualifiers'
    ];
    
    for (const indicator of leagueIndicators) {
      if (textContent.toLowerCase().includes(indicator.toLowerCase())) {
        league = indicator;
        break;
      }
    }
    
    // If we couldn't get a league name, look for it in the text content
    if (league === 'Football League') {
      // Look for league information in the text content
      for (const indicator of leagueIndicators) {
        if (textContent.toLowerCase().includes(indicator.toLowerCase()) && indicator.length > 3) {
          league = indicator;
          
          break;
        }
      }
    }
    
    return {
      id,
      homeTeam: teamInfo.home,
      awayTeam: teamInfo.away,
      league,
      competitionId: '0', // Default competition ID for container parsing
      kickoff: matchTime || this.generateRealisticTime(),
      date: this.getTodayDate(),
      status: 'upcoming' as const,
      homeOdds: odds.home || this.generateRealisticOdds(),
      drawOdds: odds.draw || this.generateRealisticOdds(),
      awayOdds: odds.away || this.generateRealisticOdds(),
      overUnder: {
        over: odds.over || this.generateRealisticOdds(),
        under: odds.under || this.generateRealisticOdds(),
        line: 2.5,
      },
      bothTeamsScore: {
        yes: odds.bttsYes || this.generateRealisticOdds(),
        no: odds.bttsNo || this.generateRealisticOdds(),
      },
    };
  }

  private parseJavaScriptMatches(data: any[]): TotelepepMatch[] {
    return data.map((item, index) => {
      // Extract team names
      const homeTeam = item.homeTeam || item.home || item.team1 || 'Home Team';
      const awayTeam = item.awayTeam || item.away || item.team2 || 'Away Team';
      
      // Extract competition ID
      const competitionId = item.competitionId || '0';
      
      // Get the league name directly from the API
      let league = item.league || item.competition || item.tournament || 'Football League';
      
      // If we don't have a league name from the API, try to get it from our API competition map
      if (league === 'Football League' && (this as any).apiCompetitionMap && competitionId !== '0') {
        league = (this as any).apiCompetitionMap[competitionId] || league;
        
      }
      
      // If we still don't have a league name, look for it in other API fields
      if (league === 'Football League') {
        // Look for league information in other API fields
        const possibleLeagueFields = [
          item.competitionName, item.category, item.tournamentName, 
          item.eventName, item.groupName
        ];
        
        for (const field of possibleLeagueFields) {
          if (field && field.length > 3) {
            league = field;
            
            break;
          }
        }
      }
      
      return {
        id: `js-${index}`,
        homeTeam,
        awayTeam,
        league,
        competitionId, // Ensure we always have a competitionId
        kickoff: this.formatTime(item.time || item.kickoff || item.start),
        date: this.formatDate(item.date || item.matchDate),
        status: this.parseStatus(item.status || item.state) as 'upcoming' | 'live' | 'finished',
        homeOdds: this.parseOdds(item.homeOdds || item.odds?.home),
        drawOdds: this.parseOdds(item.drawOdds || item.odds?.draw),
        awayOdds: this.parseOdds(item.awayOdds || item.odds?.away),
        overUnder: {
          over: this.parseOdds(item.overOdds || item.odds?.over),
          under: this.parseOdds(item.underOdds || item.odds?.under),
          line: 2.5,
        },
        bothTeamsScore: {
          yes: this.parseOdds(item.bttsYes || item.odds?.bttsYes),
          no: this.parseOdds(item.bttsNo || item.odds?.bttsNo),
        },
      };
    });
  }

  private cleanHtmlContent(html: string): string {
    return html
      .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
      .replace(/&nbsp;/g, ' ')   // Replace &nbsp; with space
      .replace(/&amp;/g, '&')   // Replace &amp; with &
      .replace(/&lt;/g, '<')    // Replace &lt; with <
      .replace(/&gt;/g, '>')    // Replace &gt; with >
      .replace(/\s+/g, ' ')     // Replace multiple spaces with single space
      .trim();
  }

  private extractTeamNames(cells: string[]): { home: string; away: string } | null {
    // Look for cells containing team names with separators
    for (const cell of cells) {
      const teamSeparators = [' vs ', ' v ', ' - ', ' x ', ' VS ', ' V ', ' X ', ' against ', ' @ ', ' at '];
      
      for (const separator of teamSeparators) {
        if (cell.includes(separator)) {
          const parts = cell.split(separator);
          if (parts.length === 2) {
            return {
              home: parts[0].trim(),
              away: parts[1].trim()
            };
          }
        }
      }
    }
    
    // Look for team names in adjacent cells with common patterns
    for (let i = 0; i < cells.length - 1; i++) {
      const cell1 = cells[i];
      const cell2 = cells[i + 1];
      
      // Check if both look like team names and aren't odds/times
      if (this.looksLikeTeamName(cell1) && this.looksLikeTeamName(cell2) && 
          !this.looksLikeOdds(cell1) && !this.looksLikeOdds(cell2)) {
        return { home: cell1, away: cell2 };
      }
    }
    
    // Look for team names in separate cells
    for (let i = 0; i < cells.length - 1; i++) {
      if (this.looksLikeTeamName(cells[i]) && this.looksLikeTeamName(cells[i + 1])) {
        return {
          home: cells[i],
          away: cells[i + 1]
        };
      }
    }
    
    return null;
  }

  private extractTeamNamesFromText(text: string): { home: string; away: string } | null {
    const separators = [' vs ', ' v ', ' - ', ' x ', ' VS ', ' V ', ' X ', ' against '];
    
    for (const separator of separators) {
      if (text.includes(separator)) {
        const parts = text.split(separator);
        if (parts.length >= 2) {
          return {
            home: parts[0].trim(),
            away: parts[1].trim()
          };
        }
      }
    }
    
    return null;
  }

  private looksLikeTeamName(text: string): boolean {
    // Team name indicators
    const teamIndicators = [
      // Common football team suffixes/prefixes
      'FC', 'United', 'City', 'Town', 'Rovers', 'Wanderers', 'Athletic',
      'SC', 'CF', 'AC', 'Real', 'Club', 'Sports', 'Football',
      // Famous teams (helps identify legitimate team names)
      'Barcelona', 'Madrid', 'Liverpool', 'Arsenal', 'Chelsea', 'Manchester',
      'Tottenham', 'Bayern', 'Juventus', 'Milan', 'Inter', 'Roma', 'Napoli',
      'Dortmund', 'Ajax', 'PSG', 'Valencia', 'Sevilla', 'Atletico',
      // International teams
      'Brazil', 'Argentina', 'France', 'Germany', 'Spain', 'Italy', 'England'
    ];
    
    // Check length and format
    if (text.length < 2 || text.length > 50) return false;
    
    // Contains team indicators
    if (teamIndicators.some(indicator => text.toLowerCase().includes(indicator.toLowerCase()))) {
      return true;
    }
    
    // Looks like a team name (letters, spaces, common punctuation)
    if (/^[A-Za-z\s\-'\.0-9]+$/.test(text)) {
      // Exclude obvious non-team content
      const excludePatterns = [
        /^\d+$/, // Just numbers
        /^\d+:\d+$/, // Time format
        /^\d+\.\d+$/, // Decimal odds
        /^(home|away|draw|over|under|yes|no|btts)$/i, // Betting terms
        /^(win|lose|tie|goal|score)$/i, // Match terms
        /^(today|tomorrow|yesterday)$/i, // Date terms
        /^(live|finished|upcoming)$/i // Status terms
      ];
      
      return !excludePatterns.some(pattern => pattern.test(text.trim()));
    }
    
    return false;
  }

  private looksLikeOdds(text: string): boolean {
    // Check if text looks like betting odds
    const oddsPattern = /^\d+\.\d+$/;
    if (oddsPattern.test(text.trim())) {
      const oddsValue = parseFloat(text.trim());
      // Realistic betting odds range
      return oddsValue >= 1.01 && oddsValue <= 50.0;
    }
    return false;
  }

  private extractTime(cells: string[]): string | null {
    // Look for time patterns in cells
    const timePattern = /^(\d{1,2}:\d{2})$/;
    
    for (const cell of cells) {
      if (timePattern.test(cell.trim())) {
        return cell.trim();
      }
    }
    
    return null;
  }

  private extractLeague(cells: string[]): string | null {
    // Look for league names in cells
    for (const cell of cells) {
      if (cell.length > 3 && 
          (cell.includes('League') || cell.includes('Cup') || cell.includes('Championship') || 
           cell.includes('World Cup') || cell.includes('Euro') || cell.includes('Nations League') ||
           cell.includes('Qualification') || cell.includes('Tournament'))) {
        return cell;
      }
    }
    
    return null;
  }

  private extractOdds(cells: string[]): any {
    const odds: any = {
      home: null,
      draw: null,
      away: null,
      over: null,
      under: null,
      bttsYes: null,
      bttsNo: null
    };
    
    // Look for decimal odds patterns
    const oddsPattern = /^\d{1,2}\.\d{2}$/;
    const foundOdds: number[] = [];
    
    for (const cell of cells) {
      if (oddsPattern.test(cell.trim())) {
        const oddsValue = parseFloat(cell.trim());
        if (oddsValue >= 1.01 && oddsValue <= 50.0) {
          foundOdds.push(oddsValue);
        }
      }
    }
    
    if (foundOdds.length >= 3) {
      odds.home = foundOdds[0];
      odds.draw = foundOdds[1];
      odds.away = foundOdds[2];
    }
    
    return odds;
  }

  private extractTotelepepSpecificData(html: string): TotelepepMatch[] {
    const matches: TotelepepMatch[] = [];
    
    // Look for Totelepep-specific data structures
    // This would be customized based on actual site inspection
    
    // Example: Look for specific CSS selectors or data attributes
    const specificPatterns = [
      // Match cards or containers
      /<div[^>]*data-match[^>]*>(.*?)<\/div>/gis,
      /<div[^>]*data-fixture[^>]*>(.*?)<\/div>/gis,
      // Betting grids
      /<div[^>]*class="[^"]*betting-grid[^"]*"[^>]*>(.*?)<\/div>/gis,
      /<div[^>]*class="[^"]*odds-grid[^"]*"[^>]*>(.*?)<\/div>/gis,
    ];
    
    for (const pattern of specificPatterns) {
      const elements = html.match(pattern) || [];

      // Process each element for match data
      // Implementation would depend on actual site structure
    }
    
    return matches;
  }

  private extractOddsFromText(text: string): any {
    const odds: any = {
      home: null,
      draw: null,
      away: null,
      over: null,
      under: null,
      bttsYes: null,
      bttsNo: null
    };
    
    // Look for decimal odds patterns in text
    const oddsPattern = /\b\d{1,2}\.\d{2}\b/g;
    const foundOdds = text.match(oddsPattern);
    
    if (foundOdds && foundOdds.length >= 3) {
      const oddsValues = foundOdds.map(oddsStr => parseFloat(oddsStr))
        .filter(oddsValue => oddsValue >= 1.01 && oddsValue <= 50.0);
      
      if (oddsValues.length >= 3) {
        odds.home = oddsValues[0];
        odds.draw = oddsValues[1];
        odds.away = oddsValues[2];
      }
    }
    
    return odds;
  }

  private parseStatus(status: string): string {
    if (!status) return 'upcoming';
    
    const statusLower = status.toLowerCase();
    if (statusLower.includes('live') || statusLower.includes('playing') || statusLower.includes('in play')) {
      return 'live';
    }
    if (statusLower.includes('finished') || statusLower.includes('ended') || statusLower.includes('ft')) {
      return 'finished';
    }
    return 'upcoming';
  }

  private parseOdds(odds: any): number {
    if (typeof odds === 'number') return Math.max(odds, 1.01);
    if (typeof odds === 'string') {
      const parsed = parseFloat(odds);
      return isNaN(parsed) ? this.generateRealisticOdds() : Math.max(parsed, 1.01);
    }
    return this.generateRealisticOdds();
  }

  private formatTime(time: any): string {
    if (!time) return this.generateRealisticTime();
    
    if (typeof time === 'string') {
      const timeMatch = time.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
      if (timeMatch) return timeMatch[1];
    }
    
    try {
      return new Date(time).toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return this.generateRealisticTime();
    }
  }

  private formatDate(date: any): string {
    if (!date) return this.getTodayDate();
    
    try {
      return new Date(date).toISOString().split('T')[0];
    } catch {
      return this.getTodayDate();
    }
  }

  private generateRealisticTime(): string {
    const times = ['15:00', '17:30', '20:00', '12:30', '19:45', '16:00', '18:30', '21:00', '14:00', '20:45'];
    return times[Math.floor(Math.random() * times.length)];
  }

  private generateRealisticOdds(): number {
    // Generate realistic betting odds between 1.20 and 15.00
    const min = 120; // 1.20
    const max = 1500; // 15.00
    const randomInt = Math.floor(Math.random() * (max - min + 1)) + min;
    return randomInt / 100;
  }

  private getTodayDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private deduplicateAndValidate(matches: TotelepepMatch[]): TotelepepMatch[] {
    const seen = new Set<string>();
    const unique: TotelepepMatch[] = [];
    
    for (const match of matches) {
      // Create a unique key for deduplication
      const key = `${match.homeTeam}-${match.awayTeam}-${match.kickoff}`.toLowerCase();
      
      if (!seen.has(key) && this.isValidMatch(match)) {
        seen.add(key);
        unique.push(match);
        
      }
    }
    
    return unique;
  }

  private isValidMatch(match: TotelepepMatch): boolean {
    // Convert odds to numbers for comparison
    const homeOdds = typeof match.homeOdds === 'string' ? parseFloat(match.homeOdds) : match.homeOdds;
    const drawOdds = typeof match.drawOdds === 'string' ? parseFloat(match.drawOdds) : match.drawOdds;
    const awayOdds = typeof match.awayOdds === 'string' ? parseFloat(match.awayOdds) : match.awayOdds;
    
    // For outright markets, relax validation (allow single teams, empty odds)
    if (match.isOutright) {
      return (
        match.homeTeam.length > 0 &&
        !match.homeTeam.toLowerCase().includes('odds')
        // Outright markets may not have standard 1X2 odds
      );
    }
    
    // For regular matches, apply strict validation
    return (
      match.homeTeam.length > 1 &&
      match.awayTeam.length > 1 &&
      match.homeTeam !== match.awayTeam &&
      !match.homeTeam.toLowerCase().includes('odds') &&
      !match.awayTeam.toLowerCase().includes('odds') &&
      homeOdds >= 1.01 &&
      drawOdds >= 1.01 &&
      awayOdds >= 1.01
    );
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastRequest;
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  private getCachedData(cacheKey: string, ignoreExpiry = false): TotelepepMatch[] | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > this.cacheTimeout;
    if (isExpired && !ignoreExpiry) return null;
    
    return cached.data;
  }

  private setCachedData(matches: TotelepepMatch[], cacheKey: string): void {
    this.cache.set(cacheKey, {
      data: matches,
      timestamp: Date.now()
    });
  }

  // Clear cache for fresh extraction
  clearCache(): void {
    this.cache.clear();
    // Don't clear calendarList - it's needed for date selection
    
  }

  // Sort matches by date and time
  sortMatchesByDate(matches: TotelepepMatch[]): TotelepepMatch[] {
    return matches
      .filter(match => match.status === 'upcoming' || match.status === 'live')
      .sort((a, b) => {
        const dateComparison = a.date.localeCompare(b.date);
        if (dateComparison !== 0) return dateComparison;
        return a.kickoff.localeCompare(b.kickoff);
      });
  }

  // Group matches by date
  groupMatchesByDate(matches: TotelepepMatch[]): Record<string, TotelepepMatch[]> {
    const grouped: Record<string, TotelepepMatch[]> = {};
    
    matches.forEach(match => {
      const date = match.date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(match);
    });
    
    return grouped;
  }
  
  // Get category list
  public getCategoryList() {
    return this.categoryList;
  }
  
  // Get competition list
  public getCompetitionList() {
    return this.competitionList;
  }
  
  // Fetch all categories for soccer
  public async fetchCategories(): Promise<Array<{id: string, name: string}>> {
    try {

      // Extract domain from baseUrl (e.g., https://www.totelepep.mu/webapi/GetSport -> https://www.totelepep.mu)
      const baseUrl = this.baseUrl.replace('/webapi/GetSport', '');
      const apiUrl = `${baseUrl}/webapi/getcategories?SportId=1`;

      // Use CORS proxy
      const response = await this.fetchWithFallback(apiUrl, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const jsonData = await response.json();

      // Extract categories from response
      let categories: Array<{id: string, name: string}> = [];
      
      // Response should be an array
      if (Array.isArray(jsonData)) {
        categories = jsonData.map((cat: any) => ({
          id: cat.name.toLowerCase(), // Use lowercase name as ID
          name: cat.name
        }));
      }

      return categories;
      
    } catch (error) {
      
      return [];
    }
  }
  
  // Fetch competitions for a specific category
  public async fetchCompetitionsForCategory(categoryName: string): Promise<Array<{id: string, name: string, matchCount?: number}>> {
    try {

      // Extract domain from baseUrl (e.g., https://www.totelepep.mu/webapi/GetSport -> https://www.totelepep.mu)
      const baseUrl = this.baseUrl.replace('/webapi/GetSport', '');
      const apiUrl = `${baseUrl}/webapi/GetCompetitions?CategoryName=${encodeURIComponent(categoryName)}&SportId=1`;

      // Use CORS proxy
      const response = await this.fetchWithFallback(apiUrl, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const jsonData = await response.json();

      // Extract competitions from response
      let competitions: Array<{id: string, name: string, matchCount?: number}> = [];
      
      // Response might be array or have competitions array
      if (Array.isArray(jsonData)) {
        competitions = jsonData.map((comp: any) => ({
          id: comp.id || comp.CompetitionId || comp.competitionId || '',
          name: comp.name || comp.CompetitionName || comp.competitionName || comp.displayName || '',
          matchCount: comp.matchCount || comp.count || comp.MatchCount || 0
        }));
      } else if (jsonData && jsonData.competitions) {
        competitions = jsonData.competitions.map((comp: any) => ({
          id: comp.id || comp.CompetitionId || comp.competitionId || '',
          name: comp.name || comp.CompetitionName || comp.competitionName || comp.displayName || '',
          matchCount: comp.matchCount || comp.count || comp.MatchCount || 0
        }));
      }

      return competitions;
      
    } catch (error) {
      
      return [];
    }
  }
}

export const totelepepExtractor = new TotelepepExtractor();
export type { TotelepepMatch };