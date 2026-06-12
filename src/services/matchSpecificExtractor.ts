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
  }

  // Method to resume scraping
  resumeScraping(): void {
    this.isPaused = false;
  }

  async extractMatchOdds(matchId: string, competitionId: string): Promise<MatchOddsData | null> {
    try {
      // Check if scraping is paused
      if (this.isPaused) {
        return null;
      }
      
      // Check if scraping is already in progress
      if (this.scrapingInProgress) {
        return null;
      }
      
      // Check cache first
      const cacheKey = `${matchId}-${competitionId}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return cached;
      }

      // Rate limiting
      await this.enforceRateLimit();

      
      // Set scraping in progress flag
      this.scrapingInProgress = true;
      
      // Try the GetMatch endpoint which should contain detailed odds
      // This is the endpoint that simulates "clicking" on a match
      const endpoint = `/api/webapi/GetMatch?sportId=soccer&competitionId=${competitionId}&matchId=${matchId}&periodCode=all`;
      
      try {
        
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

          // Parse the detailed odds structure
          const oddsData = this.parseDetailedOddsResponse(data, matchId);
          
          if (oddsData) {
            this.setCachedData(oddsData, cacheKey);
            return oddsData;
          }
        } else {
        }
      } catch (endpointError) {
      } finally {
        // Reset scraping flag
        this.scrapingInProgress = false;
      }

      return null;

    } catch (error) {
      // Reset scraping flag in case of error
      this.scrapingInProgress = false;
      return null;
    }
  }

  private parseDetailedOddsResponse(data: any, matchId: string): MatchOddsData | null {
    try {

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
      return null;
    }
  }

  private parseDetailedMarkets(markets: any[], oddsData: MatchOddsData): void {

    markets.forEach((market, index) => {
      const marketCode = market.marketCode;
      const marketName = market.marketDisplayName?.toLowerCase() || market.name?.toLowerCase() || '';
      const periodCode = market.periodCode;
      
      
      // Look for full-time BTTS markets (periodCode 'FT' for full-time)
      if (((marketName.includes('both') && marketName.includes('score')) || 
          (marketName.includes('both') && marketName.includes('team')) ||
          marketName.includes('btts') || marketName.includes('bts') ||
          marketCode === 'BTTS') &&
          (periodCode === 'FT' || periodCode === 'ALL' || !periodCode || 
           marketName.includes('full time') || marketName.includes('fulltime') ||
           marketName.includes('match'))) {
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
        this.extractDetailedOverUnderOdds(market, oddsData);
      }
      
      // Log all selections for analysis
      const selectionList = market.selectionList || market.selections || [];
      if (selectionList && Array.isArray(selectionList)) {
        selectionList.forEach((selection: any, selIndex: number) => {
        });
      }
    });
  }

  private extractDetailedBTTSOdds(market: any, oddsData: MatchOddsData): void {
    const marketName = market.marketDisplayName?.toLowerCase() || market.name?.toLowerCase() || '';
    const periodCode = market.periodCode;
    
    // Skip if this is clearly a second half market
    if (periodCode === '2H' || marketName.includes('second half') || marketName.includes('2nd half')) {
      return;
    }
    
    const selectionList = market.selectionList || market.selections || [];
    if (selectionList && Array.isArray(selectionList)) {
      selectionList.forEach((selection: any) => {
        const selectionName = selection.name?.toLowerCase() || '';
        const oddsValue = selection.companyOdds || selection.odds;
        const odds = parseFloat(oddsValue);
        
        
        if (!isNaN(odds) && odds >= 1.01 && odds <= 50) {
          // Use more flexible matching for BTTS selections
          if (selectionName.includes('yes') || selectionName.includes('both') || 
              selection.name === 'YES' || selection.name === 'Yes' || selection.name === 'Y' ||
              selectionName.includes('y')) {
            oddsData.bttsYes = odds;
          } else if (selectionName.includes('no') || selectionName.includes('not') || 
                     selection.name === 'NO' || selection.name === 'No' || selection.name === 'N' ||
                     selectionName.includes('n')) {
            oddsData.bttsNo = odds;
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
    
    // Skip if this is clearly a second half market
    if (periodCode === '2H' || marketName.includes('second half') || marketName.includes('2nd half')) {
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
        
        
        if (!isNaN(odds) && odds >= 1.01 && odds <= 50) {
          // For 2.5 goals markets (more flexible matching)
          if (is25Goals) {
            if (selectionName.includes('over') || selection.name === 'Over' || selection.name === 'OVER' || 
                selection.name === 'O' || selection.name === 'o' || selectionName.includes('o')) {
              oddsData.over25 = odds;
            } else if (selectionName.includes('under') || selection.name === 'Under' || selection.name === 'UNDER' || 
                       selection.name === 'U' || selection.name === 'u' || selectionName.includes('u')) {
              oddsData.under25 = odds;
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
        
        this.parseMarketsArray(fullTimeMarkets, oddsData);
      }

      // Log all found odds
        bttsYes: oddsData.bttsYes,
        bttsNo: oddsData.bttsNo,
        over25: oddsData.over25,
        under25: oddsData.under25,
        additionalOdds: oddsData.additionalOdds
      });

      return Object.keys(oddsData).length > 1 ? oddsData : null;

    } catch (error) {
      return null;
    }
  }

  private parseMarketsArray(markets: any[], oddsData: MatchOddsData): void {

    // Power Query equivalent: List.Transform([markets], each if [marketDisplayName] = "Both Team To Score " then [marketBookNo] else "")
    const bttsBookNumbers: string[] = [];
    const ouBookNumbers: string[] = [];
    
    markets.forEach((market, index) => {
      const marketCode = market.marketCode;
      const marketName = market.marketDisplayName?.toLowerCase() || '';
      const periodCode = market.periodCode;
      
      
      // Skip second half markets
      if (periodCode === '2H' || marketName.includes('second half') || marketName.includes('2nd half')) {
        return;
      }
      
      // Power Query logic: Extract BookNo for BTTS markets
      if (market.marketDisplayName === "Both Team To Score ") {
        bttsBookNumbers.push(market.marketBookNo.toString());
      }
      
      // Extract BookNo for Over/Under 2.5 markets
      if (marketName.includes('under over +2.5')) {
        ouBookNumbers.push(market.marketBookNo.toString());
      }
      
      // Look for BTTS markets with more flexible matching
      if ((marketName.includes('both') && marketName.includes('score')) || 
          (marketName.includes('both') && marketName.includes('team')) ||
          marketName.includes('btts') || marketName.includes('bts') || marketCode === 'BTTS') {
        this.extractDetailedBTTSOdds(market, oddsData);
      }
      
      // Look for Over/Under markets with more flexible matching
      if ((marketName.includes('over') && marketName.includes('under')) ||
          (marketName.includes('total') && marketName.includes('goals')) ||
          marketName.includes('o/u') || marketName.includes('ou') || marketName.includes('over under') ||
          marketCode === 'OU' || marketCode === 'TG' || marketCode === 'O/U') {
        this.extractDetailedOverUnderOdds(market, oddsData);
      }
      
      // Log all selections for analysis
      if (market.selectionList && Array.isArray(market.selectionList)) {
        market.selectionList.forEach((selection: any, selIndex: number) => {
        });
      }
    });
  }

  private extractOddsFromSelection(selectionName: string, odds: number, oddsData: MatchOddsData): void {
    // Extract BTTS odds
    if (selectionName.includes('yes') || selectionName.includes('both') || selectionName === 'YES' || selectionName === 'Yes') {
      oddsData.bttsYes = odds;
    } else if (selectionName.includes('no') || selectionName.includes('not') || selectionName === 'NO' || selectionName === 'No') {
      oddsData.bttsNo = odds;
    }
    
    // Extract Over/Under odds
    if (selectionName.includes('over 2.5') || selectionName === 'Over 2.5' || selectionName === 'OVER 2.5') {
      oddsData.over25 = odds;
    } else if (selectionName.includes('under 2.5') || selectionName === 'Under 2.5' || selectionName === 'UNDER 2.5') {
      oddsData.under25 = odds;
    }
  }

  async extractOddsForMatches(matches: Array<{id: string, competitionId?: string}>): Promise<Map<string, MatchOddsData>> {
    const oddsMap = new Map<string, MatchOddsData>();
    

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      
      // Extract competition ID from match data or use default
      const competitionId = match.competitionId || this.extractCompetitionFromMatchId(match.id);
      
      if (competitionId) {
        const odds = await this.extractMatchOdds(match.id, competitionId);
        if (odds) {
          oddsMap.set(match.id, odds);
        } else {
        }
      }

      // Progress update every 10 matches
      if ((i + 1) % 10 === 0) {
      }
    }

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
  }
}

export const matchSpecificExtractor = new MatchSpecificExtractor();
export type { MatchOddsData };
