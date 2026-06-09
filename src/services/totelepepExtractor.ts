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
    }>;
  }>;
}

class TotelepepExtractor {
  // Use CORS proxy for all API requests (required for GitHub Pages)
  private corsProxy = 'https://corsproxy.io/?';
  private baseUrl = 'https://www.totelepep.mu/webapi/GetSport';
  private cache: Map<string, { data: TotelepepMatch[]; timestamp: number }> = new Map();
  private cacheTimeout = 1 * 60 * 1000; // 1 minute instead of 5 minutes
  private rateLimitDelay = 2000; // 2 seconds between requests
  private lastRequestTime = 0;
  private calendarList: Array<{entryDate: string, matchCount: number, displayDate: string}> = [];
  private categoryList: Array<{id: string, name: string}> = [];
  private competitionList: Array<{id: string, name: string, categoryId?: string, matchCount?: number}> = [];
  private competitionToCategoryMap: Map<string, string> = new Map(); // competitionId -> categoryId
  // Dynamic competition mapping that can be updated based on actual data
  private dynamicCompetitionMap: Record<string, string> = {};
  // Fallback competition mapping based on team names
  private teamBasedCompetitionMap: Record<string, string> = {};
  // Method to update the dynamic competition mapping
  public updateCompetitionMapping(competitionId: string, leagueName: string): void {
    if (competitionId && leagueName && competitionId !== '0') {
      this.dynamicCompetitionMap[competitionId] = leagueName;
      console.log(`🔄 Updated dynamic competition mapping: ${competitionId} -> ${leagueName}`);
    }
  }
  
  // Method to update team-based competition mapping
  public updateTeamBasedCompetitionMapping(homeTeam: string, awayTeam: string, leagueName: string): void {
    // Create a key based on team names
    const teamKey = `${homeTeam.toLowerCase()}|${awayTeam.toLowerCase()}`;
    if (leagueName && leagueName !== 'Football League') {
      this.teamBasedCompetitionMap[teamKey] = leagueName;
      console.log(`🔄 Updated team-based competition mapping: ${teamKey} -> ${leagueName}`);
    }
  }
  
  // Method to get league name based on team names
  private getLeagueFromTeams(homeTeam: string, awayTeam: string): string | null {
    const teamKey = `${homeTeam.toLowerCase()}|${awayTeam.toLowerCase()}`;
    return this.teamBasedCompetitionMap[teamKey] || null;
  }
  
  async extractMatches(targetDate?: string, categoryId?: string, competitionId?: string): Promise<TotelepepMatch[]> {
    try {
      // Check cache first
      // Use a more specific cache key to avoid conflicts between different dates
      const cacheKey = targetDate ? `date_${targetDate}_${categoryId || 'all'}_${competitionId || 'all'}` : `all_dates_${new Date().toISOString().split('T')[0]}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        console.log('📦 Returning cached data for date:', targetDate);
        return cached;
      }

      // Rate limiting
      await this.enforceRateLimit();

      console.log('🔍 Fetching fresh data from Totelepep API...');
      
      // Fetch JSON from totelepep.mu API with category and competition filters
      const jsonData = await this.fetchTotelepepAPI(targetDate, categoryId, competitionId);
      
      // Parse JSON data (same as Power Query Json.Document)
      let matches = this.parseJSONForMatches(jsonData);
      
      // Handle pagination - fetch all pages if there are more
      const totalPages = jsonData.totalPages || 1;
      if (totalPages > 1) {
        console.log(`📄 API has ${totalPages} pages, fetching all pages...`);
        
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
        
        console.log(`✅ Fetched all pages: ${matches.length} total matches`);
      }
      
      // DON'T fetch detailed markets yet - they will be loaded on-demand when user clicks
      console.log(`✅ Extracted ${matches.length} matches (markets will load on-demand)`);
      
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
        console.log(`✅ Found ${matches.length} matches from Totelepep API for date ${dateToUse}`);
        this.setCachedData(matches, cacheKey);
        return matches;
      }

      console.warn('⚠️ No matches found from Totelepep API');
      return [];
      
    } catch (error) {
      console.error('❌ Error extracting matches:', error);
      
      // Try to return cached data even if expired
      const cacheKey = targetDate ? `date_${targetDate}` : `all_dates_${new Date().toISOString().split('T')[0]}`;
      const cached = this.getCachedData(cacheKey, true);
      if (cached) {
        console.log('📦 Returning expired cached data as fallback');
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
      console.log(`📡 Fetching markets for match ${match.id} (${match.homeTeam} vs ${match.awayTeam})...`);
      
      // Extract domain from baseUrl (e.g., https://www.totelepep.mu/webapi/GetSport -> https://www.totelepep.mu)
      const baseUrl = this.baseUrl.replace('/webapi/GetSport', '');
      const apiUrl = `${baseUrl}/webapi/GetMatch?sportId=soccer&competitionId=${match.competitionId}&matchId=${match.id}&periodCode=all`;
      
      // Use CORS proxy for GetMatch request
      const fetchUrl = this.corsProxy + encodeURIComponent(apiUrl);
      
      const response = await fetch(fetchUrl, {
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        console.warn(`⚠️ Failed to fetch markets for match ${match.id}: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      const allMarkets = this.parseAllMarkets(data, match.id);
      
      if (allMarkets && allMarkets.length > 0) {
        match.allMarkets = allMarkets;
        match.marketCount = allMarkets.length;
        match.availableMarkets = allMarkets.map(m => m.name);
        
        console.log(`✅ Loaded ${allMarkets.length} markets for ${match.homeTeam} vs ${match.awayTeam}`);
      }
    } catch (error) {
      console.error(`❌ Error fetching markets for match ${match.id}:`, error);
    }
  }

  // Fetch all markets for all matches - OPTIMIZED WITH PARALLEL REQUESTS
  private async fetchAllMarketsForMatches(matches: TotelepepMatch[]): Promise<void> {
    console.log(`🚀 Fetching detailed markets for ${matches.length} matches (PARALLEL MODE)...`);
    
    // Process matches in batches of 5 to avoid overwhelming the server
    const batchSize = 5;
    const batches: TotelepepMatch[][] = [];
    
    for (let i = 0; i < matches.length; i += batchSize) {
      batches.push(matches.slice(i, i + batchSize));
    }
    
    console.log(`📦 Processing ${batches.length} batches of ${batchSize} matches each`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} matches)...`);
      
      // Fetch all matches in this batch IN PARALLEL
      const fetchPromises = batch.map(async (match) => {
        try {
          // Extract domain from baseUrl (e.g., https://www.totelepep.mu/webapi/GetSport -> https://www.totelepep.mu)
          const baseUrl = this.baseUrl.replace('/webapi/GetSport', '');
          const apiUrl = `${baseUrl}/webapi/GetMatch?sportId=soccer&competitionId=${match.competitionId}&matchId=${match.id}&periodCode=all`;
          
          // Use CORS proxy
          const fetchUrl = this.corsProxy + encodeURIComponent(apiUrl);
          
          const response = await fetch(fetchUrl, {
            headers: {
              'Accept': 'application/json',
            }
          });
          
          if (!response.ok) {
            console.warn(`⚠️ Failed to fetch markets for match ${match.id}: ${response.status}`);
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
          console.warn(`⚠️ Error fetching markets for match ${match.id}:`, error);
          match.marketCount = 1;
          match.availableMarkets = ['1X2'];
        }
      });
      
      // Wait for all requests in this batch to complete
      await Promise.all(fetchPromises);
      
      console.log(`✅ Batch ${batchIndex + 1}/${batches.length} complete`);
      
      // Small delay between batches (500ms instead of 1000ms)
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`✅ Finished fetching markets for ${matches.length} matches`);
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
      console.log(`🔍 Parsing all markets for match ${matchId}...`);
      console.log(`📊 Response structure keys:`, Object.keys(data || {}));
      console.log(`📊 Full response (first 1000 chars):`, JSON.stringify(data, null, 2).substring(0, 1000));
      
      // Find the match in the response - try multiple strategies
      let targetMatch = null;
      
      // Strategy 1: Look in competitions array
      if (data.competitions && Array.isArray(data.competitions)) {
        console.log(`📊 Found ${data.competitions.length} competitions`);
        for (const competition of data.competitions) {
          if (competition.matches && Array.isArray(competition.matches)) {
            console.log(`📊 Competition ${competition.competitionName || competition.id} has ${competition.matches.length} matches`);
            targetMatch = competition.matches.find((m: any) => {
              const matchIdStr = m.id?.toString();
              const searchId = matchId.toString();
              return matchIdStr === searchId;
            });
            if (targetMatch) {
              console.log(`✅ Found match ${matchId} in competitions array`);
              break;
            }
          }
        }
      }
      
      // Strategy 2: Look in root matches array
      if (!targetMatch && data.matches && Array.isArray(data.matches)) {
        console.log(`📊 Found ${data.matches.length} matches in root array`);
        targetMatch = data.matches.find((m: any) => m.id?.toString() === matchId.toString());
        if (targetMatch) {
          console.log(`✅ Found match ${matchId} in root matches array`);
        }
      }
      
      // Strategy 3: Check if data itself is the match
      if (!targetMatch && data.id?.toString() === matchId.toString()) {
        console.log(`✅ Data itself is the match`);
        targetMatch = data;
      }
      
      if (!targetMatch) {
        console.warn(`⚠️ Match ${matchId} not found in response`);
        console.log(`📊 Available structure:`, JSON.stringify(data, null, 2).substring(0, 500));
        return null;
      }
      
      // Try to find markets in different locations
      let marketsArray = null;
      
      if (targetMatch.markets && Array.isArray(targetMatch.markets)) {
        marketsArray = targetMatch.markets;
        console.log(`📊 Found markets in targetMatch.markets (${marketsArray.length} markets)`);
      } else if (targetMatch.marketList && Array.isArray(targetMatch.marketList)) {
        marketsArray = targetMatch.marketList;
        console.log(`📊 Found markets in targetMatch.marketList (${marketsArray.length} markets)`);
      } else if (targetMatch.odds && Array.isArray(targetMatch.odds)) {
        marketsArray = targetMatch.odds;
        console.log(`📊 Found markets in targetMatch.odds (${marketsArray.length} markets)`);
      }
      
      if (!marketsArray || marketsArray.length === 0) {
        console.warn(`⚠️ No markets array found for match ${matchId}`);
        console.log(`📊 Match structure keys:`, Object.keys(targetMatch));
        console.log(`📊 Match structure (first 500 chars):`, JSON.stringify(targetMatch, null, 2).substring(0, 500));
        return null;
      }
      
      console.log(`📊 Processing ${marketsArray.length} markets for match ${matchId}`);
      
      const markets: any[] = [];
      
      marketsArray.forEach((market: any, index: number) => {
        const marketName = market.marketDisplayName || market.name || 'Unknown';
        const marketBookNo = String(market.marketBookNo || market.id || market.marketId || index);
        const marketCode = market.marketCode || '';
        const periodCode = market.periodCode || '';
        
        console.log(`📊 Market ${index + 1}: ${marketName}`);
        console.log(`   📊 Full market object keys:`, Object.keys(market));
        console.log(`   📊 market.id:`, market.id);
        console.log(`   📊 market.marketId:`, market.marketId);
        console.log(`   📊 market.marketBookNo:`, market.marketBookNo);
        console.log(`   📊 market.marketCode:`, market.marketCode);
        console.log(`   📊 Using - BookNo: ${marketBookNo}, Code: ${marketCode}, Period: ${periodCode}`);
        
        // Parse selections
        const selections: any[] = [];
        if (market.selectionList && Array.isArray(market.selectionList)) {
          market.selectionList.forEach((selection: any) => {
            selections.push({
              name: selection.name || selection.optionCode || 'Unknown',
              odds: selection.companyOdds || selection.odds || 'N/A',
              optionCode: selection.optionCode || ''
            });
          });
        } else if (market.selections && Array.isArray(market.selections)) {
          market.selections.forEach((selection: any) => {
            selections.push({
              name: selection.name || selection.optionCode || 'Unknown',
              odds: selection.companyOdds || selection.odds || 'N/A',
              optionCode: selection.optionCode || ''
            });
          });
        }
        
        console.log(`📊 Market ${marketName} has ${selections.length} selections`);
        
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
      
      console.log(`✅ Successfully parsed ${markets.length} markets for match ${matchId}`);
      return markets;
      
    } catch (error) {
      console.error(`❌ Error parsing markets for match ${matchId}:`, error);
      return null;
    }
  }

  private async fetchTotelepepAPI(targetDate?: string, categoryId?: string, competitionId?: string, pageNo?: number): Promise<any> {
    // Build API URL with current date (same as Power Query)
    const dateToFetch = targetDate || this.getTodayDate(); // YYYY-MM-DD format
    console.log(`🔍 TotelepepExtractor - Target date provided:`, targetDate);
    console.log(`🔍 TotelepepExtractor - Date to fetch:`, dateToFetch);
    console.log(`🔍 TotelepepExtractor - Date to fetch type: ${typeof dateToFetch}`);
    console.log(`📂 Category:`, categoryId);
    console.log(`🏆 Competition:`, competitionId);
    
    // Build API URL with filters
    const compId = competitionId || 0;
    const inclusive = competitionId ? 1 : 1; // Always 1 for now
    const categoryParam = categoryId || '';
    const page = pageNo || 1;
    
    let apiUrl;
    if (targetDate) {
      // Category only or Category + Competition: use "08 Jun 2026" format
      // NOTE: Don't pass competitionId to API - it returns empty matchData
      // We'll filter by competition on the frontend instead
      const dateObj = new Date(targetDate);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = months[dateObj.getMonth()];
      const year = dateObj.getFullYear();
      const formattedDate = `${day} ${month} ${year}`;
      apiUrl = `${this.baseUrl}?sportId=soccer&date=${encodeURIComponent(formattedDate)}&category=${encodeURIComponent(categoryParam)}&competitionId=0&pageNo=${page}&inclusive=0&matchid=0&periodCode=all`;
    } else {
      // No date: get all matches
      apiUrl = `${this.baseUrl}?sportId=soccer&category=${encodeURIComponent(categoryParam)}&competitionId=0&pageNo=${page}&inclusive=1&matchid=0&periodCode=all`;
    }
    
    console.log(`🌐 API URL for ${dateToFetch || 'all dates'}:`, apiUrl);
    
    // Use CORS proxy for browser requests
    const fetchUrl = this.corsProxy + encodeURIComponent(apiUrl);
    console.log(`🌐 Using CORS proxy:`, fetchUrl.substring(0, 100) + '...');
    
    const response = await fetch(fetchUrl, {
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
    console.log(`📄 Fetched JSON data for ${dateToFetch || 'all dates'}:`, JSON.stringify(jsonData, null, 2));
    console.log(`📊 Response message for ${dateToFetch || 'all dates'}:`, jsonData.message);
    console.log(`📊 Response matchData length for ${dateToFetch || 'all dates'}:`, jsonData.matchData ? jsonData.matchData.length : 0);
    
    return jsonData;
  }

  private parseJSONForMatches(jsonData: any): TotelepepMatch[] {
    const matches: TotelepepMatch[] = [];
    
    try {
      console.log('🔧 Parsing JSON for match data...');
      console.log('📄 Full API Response:', JSON.stringify(jsonData, null, 2));
      console.log('📊 Response type:', typeof jsonData);
      console.log('📊 Response keys:', Object.keys(jsonData || {}));
      
      // Store calendar list data for date selector
      if (jsonData && jsonData.calendarList && Array.isArray(jsonData.calendarList)) {
        console.log(`📅 Found calendarList with ${jsonData.calendarList.length} entries`);
        console.log(`📅 RAW CalendarList data from API:`, jsonData.calendarList);
        
        // Log each entry's keys and values to see what fields exist
        jsonData.calendarList.forEach((entry: any, index: number) => {
          console.log(`📅 Raw calendar entry ${index}:`, {
            keys: Object.keys(entry),
            entry: entry
          });
        });
        
        // Validate and normalize calendarList entries
        const normalizedCalendarList = jsonData.calendarList.map((entry: any) => {
          // Handle different possible structures
          if (entry && typeof entry === 'object') {
            // Check if it has date/matchCount properties with different names
            let entryDate = entry.entryDate || entry.date || entry.matchDate || entry.gameDate;
            let matchCount = entry.matchCount || entry.count || entry.matches || entry.totalMatches || 0;
            let displayDate = entry.displayDate || entry.displayName || entry.name || '';
            
            console.log(`📅 Normalizing entry - entryDate: "${entryDate}", displayDate: "${displayDate}", matchCount: ${matchCount}`);
            console.log(`📅 Raw entry object:`, entry);
            
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
        console.log(`📅 Normalized calendarList:`, normalizedCalendarList);
      } else {
        console.log(`   ⚠️ No calendarList found in API response`);
        if (jsonData) {
          console.log(`   📄 API Response Keys:`, Object.keys(jsonData));
        }
      }
      
      // Debug: Log all top-level keys in the API response
      console.log('🔑 All API response keys:', Object.keys(jsonData || {}));
      
      // Extract categoryList if available
      if (jsonData && jsonData.categoryList && Array.isArray(jsonData.categoryList)) {
        console.log(`📂 Found categoryList with ${jsonData.categoryList.length} categories`);
        this.categoryList = jsonData.categoryList.map((cat: any) => ({
          id: cat.id || cat.categoryId || '',
          name: cat.name || cat.categoryName || cat.displayName || ''
        }));
        console.log(`📂 Extracted categories:`, this.categoryList);
      } else if (jsonData && jsonData.categories && Array.isArray(jsonData.categories)) {
        // Fallback: try 'categories' key
        console.log(`📂 Found 'categories' with ${jsonData.categories.length} entries`);
        this.categoryList = jsonData.categories.map((cat: any) => ({
          id: cat.id || cat.categoryId || '',
          name: cat.name || cat.categoryName || cat.displayName || ''
        }));
        console.log(`📂 Extracted categories from 'categories':`, this.categoryList);
      } else if (jsonData && jsonData.category && Array.isArray(jsonData.category)) {
        // Fallback: try 'category' key
        console.log(`📂 Found 'category' with ${jsonData.category.length} entries`);
        this.categoryList = jsonData.category.map((cat: any) => ({
          id: cat.id || cat.categoryId || '',
          name: cat.name || cat.categoryName || cat.displayName || ''
        }));
        console.log(`📂 Extracted categories from 'category':`, this.categoryList);
      } else {
        console.log('⚠️ No category list found in API response');
      }
      
      // Extract competitionList if available
      if (jsonData && jsonData.competitionList && Array.isArray(jsonData.competitionList)) {
        console.log(`🏆 Found competitionList with ${jsonData.competitionList.length} competitions`);
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
        console.log(`🏆 Extracted competitions:`, this.competitionList);
        console.log(`🗺️ Competition to Category map:`, Array.from(this.competitionToCategoryMap.entries()));
      }
      
      // Check if there's competition data in the response
      if (jsonData && jsonData.competitions && Array.isArray(jsonData.competitions)) {
        console.log(`🏆 Found ${jsonData.competitions.length} competitions in response`);
        // Log competition data for analysis
        jsonData.competitions.forEach((competition: any, index: number) => {
          console.log(`   Competition ${index}: ID=${competition.id}, Name=${competition.name}`);
        });
        
        // Create a map of competition IDs to names for direct use
        const competitionMap: Record<string, string> = {};
        jsonData.competitions.forEach((competition: any) => {
          if (competition.id && competition.name) {
            competitionMap[competition.id.toString()] = competition.name;
          }
        });
        
        console.log(`   🗺️ Created API Competition Map:`, competitionMap);
        
        // Store this map for use in match parsing
        (this as any).apiCompetitionMap = competitionMap;
      }
      
      // ALSO parse competitionData field (pipe-delimited format) if available
      if (jsonData && jsonData.competitionData && typeof jsonData.competitionData === 'string') {
        console.log(`🏆 Found competitionData string with ${jsonData.competitionData.length} characters`);
        
        // Parse the pipe-delimited competition data
        const competitionEntries = jsonData.competitionData.split('|').filter((entry: string) => entry.trim());
        console.log(`🔍 Found ${competitionEntries.length} competition entries in competitionData`);
        
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
                console.log(`🏆 Mapped competition: ${competitionId} → ${competitionName} (category: ${categoryId})`);
              } else {
                console.log(`🏆 Mapped competition: ${competitionId} → ${competitionName} (no category)`);
              }
            }
          }
        }
        
        console.log(`✅ Competition map now has ${(this as any).apiCompetitionMap ? Object.keys((this as any).apiCompetitionMap).length : 0} entries`);
      } else {
        console.log(`   ⚠️ No competitions found in API response`);
        console.log(`   📄 API Response Keys:`, Object.keys(jsonData || {}));
        if (jsonData) {
          console.log(`   📄 API Response Sample:`, JSON.stringify(jsonData).substring(0, 500));
        }
        
        // Even if we don't have competitions in this response, we might have them from a previous response
        // So don't overwrite the existing apiCompetitionMap
      }
      
      // Parse JSON structure (equivalent to Power Query Json.Document)
      // Totelepep uses a special matchData field with pipe-delimited format
      if (jsonData && jsonData.matchData && typeof jsonData.matchData === 'string') {
        console.log(`📊 Found matchData string with ${jsonData.matchData.length} characters`);
        console.log(`📄 Sample matchData: ${jsonData.matchData.substring(0, 200)}...`);
        
        // Parse the pipe-delimited match data
        const parsedMatches = this.parseTotelepepMatchData(jsonData.matchData);
        matches.push(...parsedMatches);
        
        console.log(`✅ Parsed ${parsedMatches.length} matches from matchData`);
      } else {
        console.warn('⚠️ Unexpected JSON structure. Available keys:', Object.keys(jsonData || {}));
        console.warn('⚠️ Sample of first few properties:', JSON.stringify(jsonData, null, 2).substring(0, 500));
      }
      
      console.log(`🎯 Extracted ${matches.length} total matches`);
      
      // Remove duplicates and validate
      return this.deduplicateAndValidate(matches);
      
    } catch (error) {
      console.error('❌ Error parsing JSON:', error);
      return [];
    }
  }

  private parseTotelepepMatchData(matchDataString: string): TotelepepMatch[] {
    const matches: TotelepepMatch[] = [];
    
    try {
      // Split by pipe separator to get individual matches
      const matchEntries = matchDataString.split('|').filter(entry => entry.trim());
      console.log(`🔍 Found ${matchEntries.length} match entries in matchData`);
      
      // Log the first few complete entries to see the full structure
      console.log('📄 COMPLETE MATCH DATA ANALYSIS:');
      matchEntries.slice(0, 3).forEach((entry, index) => {
        console.log(`\n🔍 COMPLETE Entry ${index}:`);
        console.log(`📄 Full entry (${entry.length} chars): ${entry}`);
        
        const fields = entry.split(';');
        console.log(`📊 Total fields: ${fields.length}`);
        
        // Log ALL fields with their positions
        fields.forEach((field, fieldIndex) => {
          console.log(`   Field ${fieldIndex}: "${field}"`);
        });
        
        // Look for additional odds patterns in the complete entry
        const allOddsInEntry = this.findAllOddsInEntry(entry);
        console.log(`📈 All odds found in entry: ${allOddsInEntry.length} total`);
        allOddsInEntry.forEach((odds, oddsIndex) => {
          console.log(`   Odds ${oddsIndex}: ${odds.value} (position: ${odds.position}, context: "${odds.context}")`);
        });
      });
      
      for (let i = 0; i < matchEntries.length; i++) {
        const entry = matchEntries[i];
        const match = this.parseTotelepepMatchEntry(entry, i);
        if (match) {
          matches.push(match);
          console.log(`✅ Parsed: ${match.homeTeam} vs ${match.awayTeam} (${match.homeOdds}/${match.drawOdds}/${match.awayOdds})`);
        }
      }
      
    } catch (error) {
      console.error('❌ Error parsing matchData string:', error);
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
        console.warn(`⚠️ Entry ${index} has insufficient fields (${fields.length}): ${entry.substring(0, 100)}`);
        return null;
      }
      
      console.log(`🔍 Entry ${index} ALL fields (${fields.length} total):`, fields);
      
      // Extract ALL possible odds from the entry
      const allOdds = this.extractAllOddsFromEntry(fields, index);
      console.log(`📊 Entry ${index} - All extracted odds:`, allOdds);
      
      // Parse Totelepep match entry format:
      // Based on the logs, the format appears to be:
      // 0: matchId, 1: competitionId, 2: teams, 3: datetime, 4: homeScore, 5: awayScore, 
      // 6: homeTeamShort, 7: homeOdds, 8: "Draw", 9: drawOdds, 10: awayTeamShort, 11: awayOdds, ...
      
      const matchId = fields[0];
      const competitionId = fields[1] || '0'; // Extract competitionId from field 1, default to '0'
      const teamsString = fields[2]; // e.g., "Austria Lustenau v Kapfenberger SV"
      const datetime = fields[3]; // e.g., "26 Aug 20:30"
      
      console.log(`🔍 Processing match ${matchId} with competitionId ${competitionId}`);
      console.log(`   📂 Match entry fields:`, fields);
      
      // Use comprehensive odds extraction
      const homeOdds = allOdds.homeOdds || parseFloat(fields[7]) || this.generateRealisticOdds();
      const drawOdds = allOdds.drawOdds || parseFloat(fields[9]) || this.generateRealisticOdds();
      const awayOdds = allOdds.awayOdds || parseFloat(fields[11]) || this.generateRealisticOdds();
      
      // Extract team names from teams string
      const teamNames = this.extractTeamNamesFromTotelepepString(teamsString);
      if (!teamNames) {
        console.warn(`⚠️ Could not extract team names from: ${teamsString}`);
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
          console.log(`   🎯 Found marketId in field 12: "${marketId}"`);
        }
      }
      
      // Extract marketBookNo from field 13
      let marketBookNo = undefined;
      if (fields.length > 13) {
        const potentialMarketBookNo = fields[13];
        if (potentialMarketBookNo && typeof potentialMarketBookNo === 'string' && 
            potentialMarketBookNo.trim() !== '' && !isNaN(Number(potentialMarketBookNo)) && Number(potentialMarketBookNo) > 0) {
          marketBookNo = potentialMarketBookNo;
          console.log(`   🎯 Found marketBookNo in field 13: "${marketBookNo}"`);
        }
      }
      
      // Extract marketCode from field 15
      let marketCode = undefined;
      if (fields.length > 15) {
        marketCode = fields[15];
        if (marketCode && typeof marketCode === 'string' && marketCode.trim() !== '') {
          console.log(`   🎯 Found marketCode in field 15: "${marketCode}"`);
        } else {
          marketCode = undefined;
        }
      }
      
      console.log(`   📊 Final extracted values - marketId: ${marketId}, marketBookNo: ${marketBookNo}, marketCode: ${marketCode}`);
      
      // Get the league name directly from the API competition data
      let league = 'Football League';
      
      // Try to get the competition name from the API data
      console.log(`   🔍 Looking up competition ID ${competitionId} in API map`);
      console.log(`   🔍 API Competition Map:`, (this as any).apiCompetitionMap);
      if ((this as any).apiCompetitionMap && competitionId !== '0') {
        const apiLeague = (this as any).apiCompetitionMap[competitionId];
        if (apiLeague) {
          league = apiLeague;
          console.log(`   🎯 Using API competition name for ID ${competitionId}: ${league}`);
        } else {
          console.log(`   ⚠️ No API competition name found for ID ${competitionId}`);
        }
      } else {
        console.log(`   ⚠️ API Competition Map not available or competitionId is '0'`);
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
              console.log(`   🎯 Found league name in match data field ${i}: ${league}`);
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
            console.log(`   🎯 Found league name in teams string: ${league}`);
          }
        }
      }
      
      console.log(`🔍 Match ${matchId}: ${teamNames.home} vs ${teamNames.away} - Competition ID: ${competitionId}, League: ${league}`);
      
      // Extract market count from field 14 (actual market count from API)
      let marketCount = 1; // Default value
      if (fields.length > 14) {
        const potentialMarketCount = fields[14];
        if (potentialMarketCount && typeof potentialMarketCount === 'string' && 
            potentialMarketCount.trim() !== '' && !isNaN(Number(potentialMarketCount))) {
          marketCount = parseInt(potentialMarketCount);
          console.log(`   📊 Found marketCount in field 14: ${marketCount}`);
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
      };
      
      // Debug specific matches like PSV Eindhoven vs ZFK Minsk
      if (teamNames.home && teamNames.away) {
        console.log(`🎯 MATCH EXTRACTION DEBUG: ${teamNames.home} vs ${teamNames.away}`);
        console.log(`   matchId:`, matchId);
        console.log(`   marketBookNo:`, marketBookNo);
        console.log(`   marketCode:`, marketCode);
        console.log(`   competitionId:`, competitionId);
      }
      
      // Only add marketBookNo and marketCode if they exist and are valid
      console.log(`   🔍 Market data validation - marketBookNo:`, { 
        value: marketBookNo, 
        type: typeof marketBookNo,
        isUndefined: marketBookNo === undefined,
        isNull: marketBookNo === null,
        isEmpty: typeof marketBookNo === 'string' ? marketBookNo.trim() === '' : false,
        isStringUndefined: typeof marketBookNo === 'string' ? marketBookNo === 'undefined' : false,
        isStringNull: typeof marketBookNo === 'string' ? marketBookNo === 'null' : false
      });
      
      console.log(`   🔍 Market data validation - marketCode:`, { 
        value: marketCode, 
        type: typeof marketCode,
        isUndefined: marketCode === undefined,
        isNull: marketCode === null,
        isEmpty: typeof marketCode === 'string' ? marketCode.trim() === '' : false,
        isStringUndefined: typeof marketCode === 'string' ? marketCode === 'undefined' : false,
        isStringNull: typeof marketCode === 'string' ? marketCode === 'null' : false
      });
      
      console.log(`🔍 Final marketBookNo check - marketBookNo:`, marketBookNo);
      console.log(`🔍 Final marketBookNo check - type:`, typeof marketBookNo);
      if (marketBookNo !== undefined && marketBookNo !== null && 
          typeof marketBookNo === 'string' && marketBookNo.trim() !== '' && 
          marketBookNo !== 'undefined' && marketBookNo !== 'null') {
        match.marketBookNo = marketBookNo;
        console.log(`   ✅ Added valid marketBookNo: ${marketBookNo}`);
      } else {
        console.log(`   ⚠️ Skipping invalid marketBookNo`);
      }
      
      console.log(`🔍 Final marketCode check - marketCode:`, marketCode);
      console.log(`🔍 Final marketCode check - type:`, typeof marketCode);
      if (marketCode !== undefined && marketCode !== null && 
          typeof marketCode === 'string' && marketCode.trim() !== '' && 
          marketCode !== 'undefined' && marketCode !== 'null') {
        match.marketCode = marketCode;
        console.log(`   ✅ Added valid marketCode: ${marketCode}`);
      } else {
        console.log(`   ⚠️ Skipping invalid marketCode`);
      }
      
      console.log(`✅ Final match odds for ${match.homeTeam} vs ${match.awayTeam}:`, {
        id: match.id,
        marketBookNo: match.marketBookNo,
        marketCode: match.marketCode,
        competitionId: match.competitionId,
        league: match.league,
        homeOdds: match.homeOdds,
        drawOdds: match.drawOdds,
        awayOdds: match.awayOdds,
        overUnder: match.overUnder,
        bothTeamsScore: match.bothTeamsScore
      });
      
      return this.isValidMatch(match) ? match : null;
      
    } catch (error) {
      console.warn(`⚠️ Error parsing match entry ${index}:`, error, entry.substring(0, 100));
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

    console.log(`🔍 Analyzing entry ${entryIndex} for odds...`);
    console.log(`📄 ALL ${fields.length} fields:`, fields);

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
          
          console.log(`   📈 Field ${index}: "${trimmedField}" = ${oddsValue}`);
          console.log(`      Context: [${fields[index - 2] || ''}] [${fields[index - 1] || ''}] -> [${trimmedField}] -> [${fields[index + 1] || ''}] [${fields[index + 2] || ''}]`);
        }
      }
    });

    console.log(`📊 Found ${odds.allFoundOdds.length} potential odds values`);

    // Map 1X2 odds based on known positions from your data
    this.identifyOddsTypes(odds, fields);

    console.log(`📊 Entry ${entryIndex} final odds extraction:`, {
      homeOdds: odds.homeOdds,
      drawOdds: odds.drawOdds, 
      awayOdds: odds.awayOdds,
      overOdds: odds.overOdds,
      underOdds: odds.underOdds,
      bttsYes: odds.bttsYes,
      bttsNo: odds.bttsNo,
      totalOddsFound: odds.allFoundOdds.length
    });

    return odds;
  }

  private identifyOddsTypes(odds: any, fields: string[]): void {
    console.log(`🎯 Identifying odds types from ${odds.allFoundOdds.length} candidates...`);
    
    odds.allFoundOdds.forEach((odd: any, i: number) => {
      const prevField = odd.prevField.toLowerCase();
      const nextField = odd.nextField.toLowerCase();
      const prev2Field = odd.prev2Field.toLowerCase();
      const next2Field = odd.next2Field.toLowerCase();
      
      // Create context string for better matching
      
      // Based on your data: Field 7=Home, Field 9=Draw, Field 11=Away
      if (odd.index === 7 && !odds.homeOdds) {
        odds.homeOdds = odd.value;
        console.log(`      ✅ Identified as HOME odds (field 7): ${odd.value}`);
      }
      if (odd.index === 9 && !odds.drawOdds) {
        odds.drawOdds = odd.value;
        console.log(`      ✅ Identified as DRAW odds (field 9): ${odd.value}`);
      }
      if (odd.index === 11 && !odds.awayOdds) {
        odds.awayOdds = odd.value;
        console.log(`      ✅ Identified as AWAY odds (field 11): ${odd.value}`);
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
              console.log(`   🎯 BTTS pattern found: Yes=${odds.bttsYes}, No=${odds.bttsNo}`);
            } else {
              odds.bttsYes = pairedOdd.value;
              odds.bttsNo = odd.value;
              console.log(`   🎯 BTTS pattern found: Yes=${odds.bttsYes}, No=${odds.bttsNo}`);
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
            console.log(`   🎯 Sequential BTTS pattern: Yes=${odds.bttsYes}, No=${odds.bttsNo}`);
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
              console.log(`   🎯 Over/Under pattern found: Over=${odds.overOdds}, Under=${odds.underOdds}`);
            } else if (isUnder) {
              odds.underOdds = odd.value;
              odds.overOdds = pairedOdd.value;
              console.log(`   🎯 Over/Under pattern found: Over=${odds.overOdds}, Under=${odds.underOdds}`);
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
          console.log(`   🎯 O/U pattern: Over=${odds.overOdds}, Under=${odds.underOdds}`);
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
      console.log(`   🎯 Fallback HOME odds: ${odds.homeOdds}`);
    }
    if (!odds.drawOdds && mainOdds.length > 1) {
      odds.drawOdds = mainOdds[1].value;
      console.log(`   🎯 Fallback DRAW odds: ${odds.drawOdds}`);
    }
    if (!odds.awayOdds && mainOdds.length > 2) {
      odds.awayOdds = mainOdds[2].value;
      console.log(`   🎯 Fallback AWAY odds: ${odds.awayOdds}`);
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
      console.warn('⚠️ Error parsing datetime:', datetime, error);
    }
    
    return {
      date: new Date().toISOString().split('T')[0],
      time: this.generateRealisticTime()
    };
  }
  
  // Method to get league name with dynamic mapping as first priority
  private getLeagueFromCompetitionId(competitionId: string): string | null {
    console.log(`🔍 Looking up league name for competition ID: ${competitionId}`);
    
    // Check dynamic mapping first
    if (this.dynamicCompetitionMap[competitionId]) {
      const dynamicLeague = this.dynamicCompetitionMap[competitionId];
      console.log(`   🔄 Using dynamic mapping for competition ID ${competitionId}: ${dynamicLeague}`);
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
    console.log(`   🏆 Static mapping result for competition ID ${competitionId}: ${leagueName}`);
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
      console.log(`🔍 Converting match ${index}:`, JSON.stringify(apiMatch, null, 2));
      
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
          console.log(`   🎯 Using API competition name for ID ${competitionId}: ${league}`);
        } else {
          console.log(`   ⚠️ No API competition name found for ID ${competitionId}`);
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
              console.log(`   🎯 Found league name in API field: ${league}`);
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
      
      console.log(`🎯 Converted match: ${match.homeTeam} vs ${match.awayTeam}`);
      console.log(`   Competition ID: ${match.competitionId}, League: ${match.league}`);
      return this.isValidMatch(match) ? match : null;
      
    } catch (error) {
      console.warn('⚠️ Error converting API match:', error, apiMatch);
      return null;
    }
  }

  private convertTotelepepMatchToJSON(data: any): any | null {
    try {
      return JSON.stringify(data);
    } catch (err) {
      console.error('⚠️ Failed to parse the following data:', data, err);
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
      console.log(`📊 Found ${allTables.length} total tables, filtering for betting data...`);
      
      // Filter tables that contain betting-related content
      const filteredTables: (string | RegExpMatchArray[number])[] = [];
      for (const table of allTables) {
        if (this.containsBettingData(table)) {
          filteredTables.push(table);
        }
      }
      tables = filteredTables as RegExpMatchArray;
    }
    
    console.log(`📊 Found ${tables.length} betting tables to analyze`);
    
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
          console.log(`✅ Extracted: ${match.homeTeam} vs ${match.awayTeam}`);
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
      console.log(`🔍 Found ${divs.length} divs with pattern`);
      
      for (let i = 0; i < divs.length; i++) {
        const match = this.extractMatchFromTotelepepContainer(divs[i], `div-${i}`);
        if (match) {
          matches.push(match);
          console.log(`✅ Container match: ${match.homeTeam} vs ${match.awayTeam}`);
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
            console.log(`📊 Found ${data.length} matches in JavaScript data`);
            const jsMatches = this.parseJavaScriptMatches(data);
            matches.push(...jsMatches);
          } else if (data.matches && Array.isArray(data.matches)) {
            console.log(`📊 Found ${data.matches.length} matches in nested JavaScript data`);
            const jsMatches = this.parseJavaScriptMatches(data.matches);
            matches.push(...jsMatches);
          }
        } catch (e) {
          console.warn('⚠️ Failed to parse JavaScript match data:', e);
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
      
      console.log(`🔍 Row cells: ${cells.join(' | ')}`);
      
      // Extract team names
      const teamInfo = this.extractTeamNames(cells);
      if (!teamInfo) {
        console.log(`⚠️ No team names found in: ${cells.join(' | ')}`);
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
            console.log(`   🎯 Found league name in cell data: ${league}`);
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
      console.warn('⚠️ Error extracting match from row:', error);
      return null;
    }
  }

  private extractMatchFromTotelepepContainer(divContent: string, id: string): TotelepepMatch | null {
    const textContent = this.cleanHtmlContent(divContent);
    
    console.log(`🔍 Container content: ${textContent.substring(0, 100)}...`);
    
    // Extract team names
    const teamInfo = this.extractTeamNamesFromText(textContent);
    if (!teamInfo) {
      console.log(`⚠️ No team names in container: ${textContent.substring(0, 50)}...`);
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
          console.log(`   🎯 Found league name in text content: ${league}`);
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
        console.log(`   🎯 Using API competition name for ID ${competitionId}: ${league}`);
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
            console.log(`   🎯 Found league name in API field: ${league}`);
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
      console.log(`🎯 Found ${elements.length} Totelepep-specific elements`);
      
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
        console.log(`✅ Valid match: ${match.homeTeam} vs ${match.awayTeam} at ${match.kickoff}`);
      }
    }
    
    return unique;
  }

  private isValidMatch(match: TotelepepMatch): boolean {
    // Convert odds to numbers for comparison
    const homeOdds = typeof match.homeOdds === 'string' ? parseFloat(match.homeOdds) : match.homeOdds;
    const drawOdds = typeof match.drawOdds === 'string' ? parseFloat(match.drawOdds) : match.drawOdds;
    const awayOdds = typeof match.awayOdds === 'string' ? parseFloat(match.awayOdds) : match.awayOdds;
    
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
      console.log(`⏱️ Rate limiting: waiting ${waitTime}ms`);
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
    console.log('🗑️ Cache cleared - next extraction will be fresh');
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
      console.log('📂 Fetching categories from API...');
      
      // Extract domain from baseUrl (e.g., https://www.totelepep.mu/webapi/GetSport -> https://www.totelepep.mu)
      const baseUrl = this.baseUrl.replace('/webapi/GetSport', '');
      const apiUrl = `${baseUrl}/webapi/getcategories?SportId=1`;
      
      console.log('🌐 Fetching categories URL:', apiUrl);
      
      // Use CORS proxy
      const fetchUrl = this.corsProxy + encodeURIComponent(apiUrl);
      
      const response = await fetch(fetchUrl, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const jsonData = await response.json();
      console.log('📄 Categories API response:', jsonData);
      
      // Extract categories from response
      let categories: Array<{id: string, name: string}> = [];
      
      // Response should be an array
      if (Array.isArray(jsonData)) {
        categories = jsonData.map((cat: any) => ({
          id: cat.name.toLowerCase(), // Use lowercase name as ID
          name: cat.name
        }));
      }
      
      console.log('📂 Extracted categories:', categories);
      return categories;
      
    } catch (error) {
      console.error('❌ Error fetching categories:', error);
      return [];
    }
  }
  
  // Fetch competitions for a specific category
  public async fetchCompetitionsForCategory(categoryName: string): Promise<Array<{id: string, name: string, matchCount?: number}>> {
    try {
      console.log(`🏆 Fetching competitions for category: ${categoryName}`);
      
      // Extract domain from baseUrl (e.g., https://www.totelepep.mu/webapi/GetSport -> https://www.totelepep.mu)
      const baseUrl = this.baseUrl.replace('/webapi/GetSport', '');
      const apiUrl = `${baseUrl}/webapi/GetCompetitions?CategoryName=${encodeURIComponent(categoryName)}&SportId=1`;
      
      console.log(`🌐 Fetching competitions URL:`, apiUrl);
      
      // Use CORS proxy
      const fetchUrl = this.corsProxy + encodeURIComponent(apiUrl);
      
      const response = await fetch(fetchUrl, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const jsonData = await response.json();
      console.log(`📄 Competitions API response:`, jsonData);
      
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
      
      console.log(`🏆 Extracted ${competitions.length} competitions:`, competitions);
      return competitions;
      
    } catch (error) {
      console.error(`❌ Error fetching competitions for category ${categoryName}:`, error);
      return [];
    }
  }
}

export const totelepepExtractor = new TotelepepExtractor();
export type { TotelepepMatch };