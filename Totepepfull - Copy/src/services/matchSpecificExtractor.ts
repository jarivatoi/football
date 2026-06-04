import { TotelepepMatch } from './totelepepExtractor';

interface MatchOddsData {
  matchId: string;
  bttsYes?: number | undefined;
  bttsNo?: number | undefined;
  over25?: number | undefined;
  under25?: number | undefined;
  additionalOdds?: Record<string, number>;
}

class MatchSpecificExtractor {
  private cache: Map<string, { data: MatchOddsData; timestamp: number }> = new Map();
  private cacheTimeout = 10 * 60 * 1000; // 10 minutes
  private rateLimitDelay = 1500; // 1.5 seconds between requests
  private lastRequestTime = 0;
  private scrapingInProgress = false; // Track if scraping is in progress
  private isPaused = false; // Track if scraping is paused

  // Method to pause scraping
  pauseScraping(): void {
    this.isPaused = true;
    console.log('⏸️ Match-specific scraping paused');
  }

  // Method to resume scraping
  resumeScraping(): void {
    this.isPaused = false;
    console.log('▶️ Match-specific scraping resumed');
  }

  async extractMatchOdds(matchId: string, competitionId: string): Promise<MatchOddsData | null> {
    try {
      // Check if scraping is paused
      if (this.isPaused) {
        console.log(`⏸️ Scraping is paused, skipping match ${matchId}`);
        return null;
      }
      
      // Check if scraping is already in progress
      if (this.scrapingInProgress) {
        console.log(`⚠️ Scraping already in progress for match ${matchId}, skipping`);
        return null;
      }
      
      // Check cache first
      const cacheKey = `${matchId}-${competitionId}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        console.log(`📦 Returning cached odds for match ${matchId}`);
        return cached;
      }

      // Rate limiting
      await this.enforceRateLimit();

      console.log(`🔍 Fetching detailed odds for match ${matchId} in competition ${competitionId}...`);
      
      // Set scraping in progress flag
      this.scrapingInProgress = true;
      
      // Try the GetMatch endpoint which should contain detailed odds
      // This is the endpoint that simulates "clicking" on a match
      const endpoint = `/api/webapi/GetMatch?sportId=soccer&competitionId=${competitionId}&matchId=${matchId}&periodCode=all`;
      
      try {
        console.log(`🌐 Trying endpoint: ${endpoint}`);
        
        const response = await fetch(endpoint, {
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.5',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`📄 Match ${matchId} response from ${endpoint}:`, JSON.stringify(data, null, 2));

          // Parse the detailed odds structure
          const oddsData = this.parseDetailedOddsResponse(data, matchId);
          
          if (oddsData) {
            this.setCachedData(oddsData, cacheKey);
            console.log(`✅ Extracted detailed odds for match ${matchId}:`, oddsData);
            return oddsData;
          }
        } else {
          console.warn(`⚠️ Endpoint ${endpoint} returned ${response.status}: ${response.statusText}`);
        }
      } catch (endpointError) {
        console.warn(`⚠️ Error with endpoint ${endpoint}:`, endpointError);
      } finally {
        // Reset scraping flag
        this.scrapingInProgress = false;
      }

      return null;

    } catch (error) {
      console.error(`❌ Error extracting match ${matchId} odds:`, error);
      // Reset scraping flag in case of error
      this.scrapingInProgress = false;
      return null;
    }
  }

  private parseDetailedOddsResponse(data: any, matchId: string): MatchOddsData | null {
    try {
      console.log(`🔧 Parsing detailed odds response for match ${matchId}...`);
      console.log(`📄 Response structure:`, JSON.stringify(data, null, 2));

      // Find the match in the competitions array
      let targetMatch = null;
      if (data.competitions && Array.isArray(data.competitions)) {
        for (const competition of data.competitions) {
          if (competition.matches && Array.isArray(competition.matches)) {
            targetMatch = competition.matches.find((match: any) => match.id.toString() === matchId);
            if (targetMatch) break;
          }
        }
      }

      // If we didn't find the match in competitions, try to find it in the root matches array
      if (!targetMatch && data.matches && Array.isArray(data.matches)) {
        targetMatch = data.matches.find((match: any) => match.id.toString() === matchId);
      }

      if (!targetMatch) {
        console.warn(`⚠️ Match ${matchId} not found in response`);
        return null;
      }

      const oddsData: MatchOddsData = { matchId };

      // Parse the markets structure to find BTTS and Over/Under odds
      if (targetMatch.markets && Array.isArray(targetMatch.markets)) {
        this.parseDetailedMarkets(targetMatch.markets, oddsData);
      } else if (targetMatch.marketList && Array.isArray(targetMatch.marketList)) {
        // Handle alternative market structure
        this.parseDetailedMarkets(targetMatch.marketList, oddsData);
      }

      // Add market count information
      if (targetMatch.markets && Array.isArray(targetMatch.markets)) {
        oddsData.additionalOdds = {
          ...oddsData.additionalOdds,
          marketCount: targetMatch.markets.length
        };
      }

      // Log all found odds
      console.log(`📊 Match ${matchId} extracted odds:`, {
        bttsYes: oddsData.bttsYes,
        bttsNo: oddsData.bttsNo,
        over25: oddsData.over25,
        under25: oddsData.under25,
        additionalOdds: oddsData.additionalOdds
      });

      // Only return odds data if we found at least one relevant odds value
      const hasRelevantOdds = oddsData.bttsYes !== undefined || 
                             oddsData.bttsNo !== undefined || 
                             oddsData.over25 !== undefined || 
                             oddsData.under25 !== undefined;
      
      return hasRelevantOdds ? oddsData : null;

    } catch (error) {
      console.error(`❌ Error parsing match ${matchId} response:`, error);
      return null;
    }
  }

  private parseDetailedMarkets(markets: any[], oddsData: MatchOddsData): void {
    console.log(`🔍 Processing ${markets.length} detailed markets...`);

    markets.forEach((market, index) => {
      const marketCode = market.marketCode;
      const marketName = market.marketDisplayName?.toLowerCase() || market.name?.toLowerCase() || '';
      const periodCode = market.periodCode;
      
      console.log(`   Market ${index + 1}: "${market.marketDisplayName || market.name}" (${marketCode}/${periodCode})`);
      
      // Look for full-time BTTS markets (periodCode 'FT' for full-time)
      if (((marketName.includes('both') && marketName.includes('score')) || 
          (marketName.includes('both') && marketName.includes('team')) ||
          marketName.includes('btts') || marketName.includes('bts') ||
          marketCode === 'BTTS') &&
          (periodCode === 'FT' || periodCode === 'ALL' || !periodCode || 
           marketName.includes('full time') || marketName.includes('fulltime') ||
           marketName.includes('match'))) {
        console.log(`   🎯 Found FULL-TIME BTTS market: ${market.marketDisplayName || market.name} (${periodCode})`);
        this.extractDetailedBTTSOdds(market, oddsData);
      }
      
      // Look for full-time Over/Under markets
      if (((marketName.includes('over') || marketName.includes('under')) ||
          (marketName.includes('total') && marketName.includes('goals')) ||
          marketName.includes('o/u') || marketName.includes('ou') || marketName.includes('over under') ||
          marketCode === 'OU' || marketCode === 'TG' || marketCode === 'O/U') &&
          (periodCode === 'FT' || periodCode === 'ALL' || !periodCode || 
           marketName.includes('full time') || marketName.includes('fulltime') ||
           marketName.includes('match'))) {
        console.log(`   🎯 Found FULL-TIME Over/Under market: ${market.marketDisplayName || market.name} (${periodCode})`);
        this.extractDetailedOverUnderOdds(market, oddsData);
      }
      
      // Log all selections for analysis
      const selectionList = market.selectionList || market.selections || [];
      if (selectionList && Array.isArray(selectionList)) {
        selectionList.forEach((selection: any, selIndex: number) => {
          console.log(`     Selection ${selIndex + 1}: ${selection.name} = ${selection.companyOdds || selection.odds}`);
        });
      }
    });
  }

  private extractDetailedBTTSOdds(market: any, oddsData: MatchOddsData): void {
    const marketName = market.marketDisplayName?.toLowerCase() || market.name?.toLowerCase() || '';
    const periodCode = market.periodCode;
    console.log(`   🎯 Processing detailed BTTS market: "${market.marketDisplayName || market.name}" (Book: ${market.marketBookNo}, Period: ${periodCode})`);
    
    // Skip if this is clearly a second half market
    if (periodCode === '2H' || marketName.includes('second half') || marketName.includes('2nd half')) {
      console.log(`   ⏭️ Skipping second half BTTS market`);
      return;
    }
    
    const selectionList = market.selectionList || market.selections || [];
    if (selectionList && Array.isArray(selectionList)) {
      selectionList.forEach((selection: any) => {
        const selectionName = selection.name?.toLowerCase() || '';
        const oddsValue = selection.companyOdds || selection.odds;
        const odds = parseFloat(oddsValue);
        
        console.log(`     Selection: "${selection.name}" = ${oddsValue} (${odds})`);
        
        if (!isNaN(odds) && odds >= 1.01 && odds <= 50) {
          // Use more flexible matching for BTTS selections
          if (selectionName.includes('yes') || selectionName.includes('both') || 
              selection.name === 'YES' || selection.name === 'Yes' || selection.name === 'Y' ||
              selectionName.includes('y')) {
            oddsData.bttsYes = odds;
            console.log(`   ✅ BTTS Yes extracted: ${odds}`);
          } else if (selectionName.includes('no') || selectionName.includes('not') || 
                     selection.name === 'NO' || selection.name === 'No' || selection.name === 'N' ||
                     selectionName.includes('n')) {
            oddsData.bttsNo = odds;
            console.log(`   ✅ BTTS No extracted: ${odds}`);
          }
        }
      });
    }
    
    // If we couldn't find BTTS odds, set them to undefined so the service can handle them
    if (oddsData.bttsYes === undefined) {
      oddsData.bttsYes = undefined;
    }
    if (oddsData.bttsNo === undefined) {
      oddsData.bttsNo = undefined;
    }
  }

  private extractDetailedOverUnderOdds(market: any, oddsData: MatchOddsData): void {
    const marketName = market.marketDisplayName?.toLowerCase() || market.name?.toLowerCase() || '';
    const periodCode = market.periodCode;
    console.log(`   🎯 Processing detailed O/U market: "${market.marketDisplayName || market.name}" (Book: ${market.marketBookNo}, Period: ${periodCode})`);
    
    // Skip if this is clearly a second half market
    if (periodCode === '2H' || marketName.includes('second half') || marketName.includes('2nd half')) {
      console.log(`   ⏭️ Skipping second half Over/Under market`);
      return;
    }
    
    // Check if this is a 2.5 goals market (more flexible matching)
    const is25Goals = marketName.includes('2.5') || marketName.includes('2 5') || 
                     marketName.includes('25') || marketName.includes('two five') ||
                     marketName.includes('over/under') || marketName.includes('over under') ||
                     marketName.includes('o/u');
    
    const selectionList = market.selectionList || market.selections || [];
    if (selectionList && Array.isArray(selectionList)) {
      selectionList.forEach((selection: any) => {
        const selectionName = selection.name?.toLowerCase() || '';
        const oddsValue = selection.companyOdds || selection.odds;
        const odds = parseFloat(oddsValue);
        
        console.log(`     Selection: "${selection.name}" = ${oddsValue} (${odds})`);
        
        if (!isNaN(odds) && odds >= 1.01 && odds <= 50) {
          // For 2.5 goals markets (more flexible matching)
          if (is25Goals) {
            if (selectionName.includes('over') || selection.name === 'Over' || selection.name === 'OVER' || 
                selection.name === 'O' || selection.name === 'o' || selectionName.includes('o')) {
              oddsData.over25 = odds;
              console.log(`   ✅ Over 2.5 extracted: ${odds}`);
            } else if (selectionName.includes('under') || selection.name === 'Under' || selection.name === 'UNDER' || 
                       selection.name === 'U' || selection.name === 'u' || selectionName.includes('u')) {
              oddsData.under25 = odds;
              console.log(`   ✅ Under 2.5 extracted: ${odds}`);
            }
          }
        }
      });
    }
    
    // If we couldn't find Over/Under odds, set them to undefined so the service can handle them
    if (oddsData.over25 === undefined) {
      oddsData.over25 = undefined;
    }
    if (oddsData.under25 === undefined) {
      oddsData.under25 = undefined;
    }
  }

  private parseNameValueResponse(data: any, matchId: string): MatchOddsData | null {
    try {
      console.log(`🔧 Parsing markets response for match ${matchId}...`);
      console.log(`📄 Response structure:`, JSON.stringify(data, null, 2));

      // Find the match in the competitions array
      let targetMatch = null;
      if (data.competitions && Array.isArray(data.competitions)) {
        for (const competition of data.competitions) {
          if (competition.matches && Array.isArray(competition.matches)) {
            targetMatch = competition.matches.find((match: any) => match.id.toString() === matchId);
            if (targetMatch) break;
          }
        }
      }

      if (!targetMatch) {
        console.warn(`⚠️ Match ${matchId} not found in response`);
        return null;
      }

      const oddsData: MatchOddsData = { matchId };

      // Parse the markets structure
      if (targetMatch.markets && Array.isArray(targetMatch.markets)) {
        // Filter for full-time markets only
        const fullTimeMarkets = targetMatch.markets.filter((market: any) => {
          const periodCode = market.periodCode;
          const marketName = market.marketDisplayName?.toLowerCase() || '';
          // Include markets with periodCode 'FT' (full-time), 'ALL', or no period code
          // Exclude markets with periodCode '2H' (second half)
          return (periodCode === 'FT' || periodCode === 'ALL' || !periodCode || 
                 marketName.includes('full time') || marketName.includes('fulltime')) &&
                 periodCode !== '2H' && 
                 !marketName.includes('second half') && 
                 !marketName.includes('2nd half');
        });
        
        console.log(`📊 Found ${fullTimeMarkets.length} full-time markets out of ${targetMatch.markets.length} total markets`);
        this.parseMarketsArray(fullTimeMarkets, oddsData);
      }

      // Log all found odds
      console.log(`📊 Match ${matchId} extracted odds:`, {
        bttsYes: oddsData.bttsYes,
        bttsNo: oddsData.bttsNo,
        over25: oddsData.over25,
        under25: oddsData.under25,
        additionalOdds: oddsData.additionalOdds
      });

      return Object.keys(oddsData).length > 1 ? oddsData : null;

    } catch (error) {
      console.error(`❌ Error parsing match ${matchId} response:`, error);
      return null;
    }
  }

  private parseMarketsArray(markets: any[], oddsData: MatchOddsData): void {
    console.log(`🔍 Processing ${markets.length} markets...`);

    // Power Query equivalent: List.Transform([markets], each if [marketDisplayName] = "Both Team To Score " then [marketBookNo] else "")
    const bttsBookNumbers: string[] = [];
    const ouBookNumbers: string[] = [];
    
    markets.forEach((market, index) => {
      const marketCode = market.marketCode;
      const marketName = market.marketDisplayName?.toLowerCase() || '';
      const periodCode = market.periodCode;
      
      console.log(`   Market ${index + 1}: "${market.marketDisplayName}" (${marketCode}/${periodCode})`);
      
      // Skip second half markets
      if (periodCode === '2H' || marketName.includes('second half') || marketName.includes('2nd half')) {
        console.log(`   ⏭️ Skipping second half market`);
        return;
      }
      
      // Power Query logic: Extract BookNo for BTTS markets
      if (market.marketDisplayName === "Both Team To Score ") {
        bttsBookNumbers.push(market.marketBookNo.toString());
        console.log(`   📋 BTTS BookNo collected: ${market.marketBookNo}`);
      }
      
      // Extract BookNo for Over/Under 2.5 markets
      if (marketName.includes('under over +2.5')) {
        ouBookNumbers.push(market.marketBookNo.toString());
        console.log(`   📋 O/U 2.5 BookNo collected: ${market.marketBookNo}`);
      }
      
      // Look for BTTS markets with more flexible matching
      if ((marketName.includes('both') && marketName.includes('score')) || 
          (marketName.includes('both') && marketName.includes('team')) ||
          marketName.includes('btts') || marketName.includes('bts') || marketCode === 'BTTS') {
        console.log(`   🎯 Found potential BTTS market: ${market.marketDisplayName}`);
        this.extractDetailedBTTSOdds(market, oddsData);
      }
      
      // Look for Over/Under markets with more flexible matching
      if ((marketName.includes('over') && marketName.includes('under')) ||
          (marketName.includes('total') && marketName.includes('goals')) ||
          marketName.includes('o/u') || marketName.includes('ou') || marketName.includes('over under') ||
          marketCode === 'OU' || marketCode === 'TG' || marketCode === 'O/U') {
        console.log(`   🎯 Found potential Over/Under market: ${market.marketDisplayName}`);
        this.extractDetailedOverUnderOdds(market, oddsData);
      }
      
      // Log all selections for analysis
      if (market.selectionList && Array.isArray(market.selectionList)) {
        market.selectionList.forEach((selection: any, selIndex: number) => {
          console.log(`     Selection ${selIndex + 1}: ${selection.name} = ${selection.companyOdds}`);
        });
      }
    });
  }

  private extractOddsFromSelection(selectionName: string, odds: number, oddsData: MatchOddsData): void {
    // Extract BTTS odds
    if (selectionName.includes('yes') || selectionName.includes('both') || selectionName === 'YES' || selectionName === 'Yes') {
      oddsData.bttsYes = odds;
      console.log(`   ✅ BTTS Yes extracted: ${odds}`);
    } else if (selectionName.includes('no') || selectionName.includes('not') || selectionName === 'NO' || selectionName === 'No') {
      oddsData.bttsNo = odds;
      console.log(`   ✅ BTTS No extracted: ${odds}`);
    }
    
    // Extract Over/Under odds
    if (selectionName.includes('over 2.5') || selectionName === 'Over 2.5' || selectionName === 'OVER 2.5') {
      oddsData.over25 = odds;
      console.log(`   ✅ Over 2.5 extracted: ${odds}`);
    } else if (selectionName.includes('under 2.5') || selectionName === 'Under 2.5' || selectionName === 'UNDER 2.5') {
      oddsData.under25 = odds;
      console.log(`   ✅ Under 2.5 extracted: ${odds}`);
    }
  }

  async extractOddsForMatches(matches: Array<{id: string, competitionId?: string}>): Promise<Map<string, MatchOddsData>> {
    const oddsMap = new Map<string, MatchOddsData>();
    
    console.log(`🚀 Starting detailed odds extraction for ${matches.length} matches...`);

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      
      // Extract competition ID from match data or use default
      const competitionId = match.competitionId || this.extractCompetitionFromMatchId(match.id);
      
      if (competitionId) {
        const odds = await this.extractMatchOdds(match.id, competitionId);
        if (odds) {
          oddsMap.set(match.id, odds);
          console.log(`✅ ${i + 1}/${matches.length}: Got odds for match ${match.id}`);
        } else {
          console.log(`⚠️ ${i + 1}/${matches.length}: No odds for match ${match.id}`);
        }
      }

      // Progress update every 10 matches
      if ((i + 1) % 10 === 0) {
        console.log(`📊 Progress: ${i + 1}/${matches.length} matches processed`);
      }
    }

    console.log(`🎯 Extraction complete: ${oddsMap.size}/${matches.length} matches have detailed odds`);
    return oddsMap;
  }

  private extractCompetitionFromMatchId(matchId: string): string | null {
    // Based on your data, try to map match IDs to competition IDs
    const competitionMappings = {
      '227932': '81',  // Austria Cup
      '227369': '126', // EFL Cup  
      '227375': '163', // La Liga
      '227365': '50',  // Champions League
      '227499': '55',  // Conference League
      '227368': '135', // Europa League
      // Additional mappings
      '227370': '1',   // Premier League
      '227371': '2',   // Championship
      '227372': '7',   // Bundesliga
      '227373': '9',   // La Liga
      '227374': '11',  // Serie A
      '227376': '13',  // Ligue 1
      '227377': '15',  // Eredivisie
      '227378': '5',   // Scotland Premiership
      '227379': '17',  // Iran Pro League
      '227380': '38',  // Lithuania A Lyga
      '227381': '196', // Azerbaijan Premier League
      '227382': '178', // Czechia First League
      '227383': '224'  // U21 European Championship
    };

    return competitionMappings[matchId as keyof typeof competitionMappings] || null;
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

  private getCachedData(cacheKey: string): MatchOddsData | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > this.cacheTimeout;
    if (isExpired) return null;
    
    return cached.data;
  }

  private setCachedData(data: MatchOddsData, cacheKey: string): void {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Match-specific odds cache cleared');
  }
}

export const matchSpecificExtractor = new MatchSpecificExtractor();
export type { MatchOddsData };