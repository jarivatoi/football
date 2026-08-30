/**
 * SMS Pariaz Extractor
 * Fetches match data from SMS Pariaz API and converts to TotelepepMatch format
 * so the rest of the app can use it transparently.
 */

import { saveMatchesChunk, getChunkSize } from '../utils/matchCache';

// Reuse the same match type as totelepep
export interface SmspariazMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  competitionId: string;
  categoryId?: string;
  marketBookNo?: string;
  marketId?: string;
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
  marketCount?: number;
  availableMarkets?: string[];
  allMarkets?: Array<{
    id?: string;
    name: string;
    marketDisplayName?: string;
    marketBookNo: string;
    marketCode: string;
    marketLine?: string;
    periodCode?: string;
    selections: Array<{
      name: string;
      odds: number | string;
      optionCode?: string;
      optionNo?: string;
      selectionId?: string;
      optionName?: string;
    }>;
  }>;
}

// SMS Pariaz market code → display name mapping
const MARKET_NAMES: Record<string, string> = {
  '1': 'Full Time',
  '2': 'Half Time',
  '30': '1 x 2 Second Half',
  '31': 'Over/Under 1.5',
  '20': 'Over/Under 2.5',
  '32': 'Over/Under 3.5',
  '48': 'Over/Under 1.5 - Half Time',
  '49': 'Over/Under 1.5 - Second Half',
  '3': 'Correct Score',
  '29': 'Correct Score - Half Time',
  '37': 'Correct Score - Second Half',
  '38': 'Half Time/Full Time',
  '21': 'Both Teams To Score',
  '39': 'Both Teams To Score - Half Time',
  '40': 'Both Teams To Score - Second Half',
  '41': 'Draw No Bet',
  '42': 'Winning Margin',
  '43': 'Goal Market',
  '44': 'Goal Market - Half Time',
  '45': 'Goal Market - Second Half',
  '15': 'First Team To Score',
  '36': 'Double Chance - Second Half',
  '22': 'Double Chance',
  '35': 'Double Chance - Half Time',
};

// Map SMS Pariaz market code → our internal marketCode + periodCode
function mapMarketCode(spCode: string): { marketCode: string; periodCode: string; marketLine?: string } {
  switch (spCode) {
    case '1': return { marketCode: 'CP', periodCode: 'FT' };
    case '2': return { marketCode: 'CP', periodCode: 'H1' };
    case '30': return { marketCode: 'CP', periodCode: '2H' };
    case '20': return { marketCode: 'UO', periodCode: 'FT', marketLine: '2.5' };
    case '31': return { marketCode: 'UO', periodCode: 'FT', marketLine: '1.5' };
    case '32': return { marketCode: 'UO', periodCode: 'FT', marketLine: '3.5' };
    case '48': return { marketCode: 'UO', periodCode: 'H1', marketLine: '1.5' };
    case '49': return { marketCode: 'UO', periodCode: '2H', marketLine: '1.5' };
    case '21': return { marketCode: 'BTTS', periodCode: 'FT' };
    case '39': return { marketCode: 'BTTS', periodCode: 'H1' };
    case '40': return { marketCode: 'BTTS', periodCode: '2H' };
    case '22': return { marketCode: 'DC', periodCode: 'FT' };
    case '35': return { marketCode: 'DC', periodCode: 'H1' };
    case '36': return { marketCode: 'DC', periodCode: '2H' };
    case '3': return { marketCode: 'CS', periodCode: 'FT' };
    case '29': return { marketCode: 'CS', periodCode: 'H1' };
    case '37': return { marketCode: 'CS', periodCode: '2H' };
    case '38': return { marketCode: 'HTFT', periodCode: 'FT' };
    case '41': return { marketCode: 'DNB', periodCode: 'FT' };
    case '15': return { marketCode: 'FTS', periodCode: 'FT' };
    case '42': return { marketCode: 'WM', periodCode: 'FT' };
    case '43': return { marketCode: 'GM', periodCode: 'FT' };
    case '44': return { marketCode: 'GM', periodCode: 'H1' };
    case '45': return { marketCode: 'GM', periodCode: '2H' };
    default: return { marketCode: spCode, periodCode: 'FT' };
  }
}

class SmspariazExtractor {
  private baseUrl = 'https://www.smspariaz.com/smsfootball/';
  private cacheBaseUrl = 'https://www.smspariaz.com/football/cache/';
  
  // CORS proxies (same as totelepep)
  private corsProxies = [
    'https://corsproxy.io/?',                    // Primary - most reliable
    'https://zaleugflzamrkrfkrcsa.supabase.co/functions/v1/cors-proxy?url=',  // Fallback 1
    'https://api.allorigins.win/raw?url=',       // Fallback 2
    'https://api.codetabs.com/v1/proxy?quest=',  // Fallback 3
  ];
  private currentProxyIndex = 0;

  // Cached metadata
  private marketsMap: Record<string, string> = {};
  private selectionsMap: Record<string, string> = {};
  private dateList: Array<{ date: string; num: number; text: string }> = [];

  // Progressive market loading (same pattern as Totelepep)
  public onMarketProgress: ((date: string, loaded: number, total: number) => void) | null = null;
  private _fullMatchesMap = new Map<string, SmspariazMatch>();
  private _progressiveTimerIds: number[] = [];
  private _progressiveCancelled = false;
  
  async fetchWithFallback(url: string): Promise<any> {
    const encodedUrl = encodeURIComponent(url);
    let lastError: Error | null = null;
    
    for (let i = 0; i < this.corsProxies.length; i++) {
      const proxyIndex = (this.currentProxyIndex + i) % this.corsProxies.length;
      const proxy = this.corsProxies[proxyIndex];
      
      try {
        const fetchUrl = `${proxy}${encodedUrl}`;
        const response = await fetch(fetchUrl);
        
        if (response.ok) {
          this.currentProxyIndex = proxyIndex;
          const text = await response.text();
          try {
            return JSON.parse(text);
          } catch {
            return text;
          }
        } else if (response.status === 404) {
          // Real 404 from target (proxy forwarded it) - file doesn't exist
          // Don't try other proxies, fail immediately
          throw new Error(`404 Not Found: ${url}`);
        } else {
          // Other HTTP errors (403, 500, etc) - try next proxy
          lastError = new Error(`HTTP ${response.status} from ${proxy}`);
          continue;
        }
      } catch (e) {
        // If it's a real 404, re-throw immediately (don't try other proxies)
        if (e instanceof Error && e.message.includes('404')) {
          throw e;
        }
        lastError = e instanceof Error ? e : new Error(String(e));
        continue;
      }
    }
    // All proxies failed
    throw lastError || new Error('All CORS proxies failed for SMS Pariaz');
  }

  /**
   * Fetch the odds metadata (markets map, selections map, date list)
   */
  private async fetchOddsMetadata(): Promise<void> {
    try {
      const data = await this.fetchWithFallback(`${this.baseUrl}service/odds_json.php`);
      this.marketsMap = data.markets || {};
      this.selectionsMap = data.selections || {};
      this.dateList = data.date || [];
    } catch (e) {
      // Metadata fetch failed silently
    }
  }

  /**
   * Parse a selection value string "selectionId,oddsX100" → { selectionId, odds }
   */
  private parseSelectionValue(val: string): { selectionId: string; odds: number } {
    const parts = val.split(',');
    return {
      selectionId: parts[0],
      odds: parseInt(parts[1], 10) / 100
    };
  }

  /**
   * Get the display name for a selection ID from the global map
   */
  private getSelectionName(selectionId: string): string {
    return this.selectionsMap[selectionId] || selectionId;
  }

  /**
   * Get the display name for a market code from the global map
   */
  private getMarketName(marketCode: string): string {
    return this.marketsMap[marketCode] || MARKET_NAMES[marketCode] || `Market ${marketCode}`;
  }

  /**
   * Convert a SMS Pariaz match object to our internal TotelepepMatch format
   * When fullMarkets=false, only the main 1X2 market is included (for progressive loading)
   */
  private convertMatch(match: any, countryName: string, leagueName: string, dateStr: string, fullMarkets = true): SmspariazMatch {
    const matchCode = String(match.c);
    const matchId = String(match.i);
    const kickoff = match.t || '';
    const homeTeam = match.home || '';
    const awayTeam = match.away || '';
    const league = `${countryName} - ${leagueName}`;

    // Parse main odds (1X2 Full Time)
    const mainH = this.parseSelectionValue(match.mainodds.H);
    const mainX = this.parseSelectionValue(match.mainodds.X);
    const mainA = this.parseSelectionValue(match.mainodds.A);

    // Build allMarkets array
    const allMarkets: SmspariazMatch['allMarkets'] = [];

    // Add main 1X2 market from mainodds
    allMarkets.push({
      id: matchCode,
      name: 'Full Time',
      marketDisplayName: '1 X 2',
      marketBookNo: matchCode,
      marketCode: 'CP',
      periodCode: 'FT',
      selections: [
        { name: homeTeam, odds: mainH.odds, optionCode: 'H', optionNo: '1', selectionId: mainH.selectionId, optionName: homeTeam },
        { name: 'Draw', odds: mainX.odds, optionCode: 'D', optionNo: '2', selectionId: mainX.selectionId, optionName: 'Draw' },
        { name: awayTeam, odds: mainA.odds, optionCode: 'A', optionNo: '3', selectionId: mainA.selectionId, optionName: awayTeam },
      ]
    });

    // Add other markets (only when fullMarkets=true for progressive loading)
    if (fullMarkets && match.market) {
      Object.keys(match.market).forEach((spMarketCode) => {
        if (spMarketCode === '1') return; // Skip main market (already added)
        
        const marketData = match.market[spMarketCode];
        const mapped = mapMarketCode(spMarketCode);
        const marketName = this.getMarketName(spMarketCode);
        
        const selections: Array<{name: string; odds: number | string; optionCode?: string; optionNo?: string; selectionId?: string; optionName?: string}> = [];

        if (marketData.s) {
          Object.keys(marketData.s).forEach((selId) => {
            const parsed = this.parseSelectionValue(marketData.s[selId]);
            const selName = this.getSelectionName(selId);
            
            // Determine optionCode based on selection
            let optionCode = '';
            let optionNo = '';
            if (selName === 'Home' || selName === homeTeam) { optionCode = 'H'; optionNo = '1'; }
            else if (selName === 'Draw') { optionCode = 'D'; optionNo = '2'; }
            else if (selName === 'Away' || selName === awayTeam) { optionCode = 'A'; optionNo = '3'; }
            else if (selName === 'Over' || selName.startsWith('Over')) { optionCode = 'O'; optionNo = '1'; }
            else if (selName === 'Under' || selName.startsWith('Under')) { optionCode = 'U'; optionNo = '2'; }
            else if (selName === 'Yes') { optionCode = 'Y'; optionNo = '1'; }
            else if (selName === 'No') { optionCode = 'N'; optionNo = '2'; }
            else { optionCode = selId; optionNo = selId; }

            selections.push({
              name: selName,
              odds: parsed.odds,
              optionCode,
              optionNo,
              selectionId: parsed.selectionId,
              optionName: selName,
            });
          });
        }

        allMarkets.push({
          id: String(marketData[spMarketCode] || matchCode),
          name: marketName,
          marketDisplayName: marketName,
          marketBookNo: String(marketData[spMarketCode] || matchCode),
          marketCode: mapped.marketCode,
          marketLine: mapped.marketLine || '',
          periodCode: mapped.periodCode,
          selections,
        });
      });
    }

    // Extract Over/Under 2.5 from markets
    let overOdds: number | string = 0;
    let underOdds: number | string = 0;
    const ou25Market = allMarkets.find(m => m.marketCode === 'UO' && m.marketLine === '2.5' && m.periodCode === 'FT');
    if (ou25Market) {
      const overSel = ou25Market.selections.find(s => s.optionCode === 'O');
      const underSel = ou25Market.selections.find(s => s.optionCode === 'U');
      overOdds = overSel?.odds || 0;
      underOdds = underSel?.odds || 0;
    }

    // Extract BTTS
    let bttsYes: number | string = 0;
    let bttsNo: number | string = 0;
    const bttsMarket = allMarkets.find(m => m.marketCode === 'BTTS' && m.periodCode === 'FT');
    if (bttsMarket) {
      const yesSel = bttsMarket.selections.find(s => s.optionCode === 'Y');
      const noSel = bttsMarket.selections.find(s => s.optionCode === 'N');
      bttsYes = yesSel?.odds || 0;
      bttsNo = noSel?.odds || 0;
    }

    // Build available markets list
    const availableMarkets = allMarkets.map(m => m.marketDisplayName || m.name).filter(Boolean);

    return {
      id: matchId,
      homeTeam,
      awayTeam,
      league,
      competitionId: matchCode,
      categoryId: matchCode,
      marketBookNo: matchCode,
      marketCode: 'CP',
      kickoff,
      date: dateStr,
      status: 'upcoming',
      homeOdds: mainH.odds,
      drawOdds: mainX.odds,
      awayOdds: mainA.odds,
      overUnder: { over: overOdds, under: underOdds, line: 2.5 },
      bothTeamsScore: { yes: bttsYes, no: bttsNo },
      marketCount: allMarkets.length,
      availableMarkets,
      allMarkets,
    };
  }

  /**
   * Main method: Extract matches for a given date
   * Returns matches with main 1X2 market immediately, then progressively loads additional markets
   * (same pattern as Totelepep's progressive market loading)
   */
  async extractMatches(targetDate?: string, categoryId?: string, competitionId?: string): Promise<SmspariazMatch[]> {
    try {
      // Cancel any previous progressive loading
      this.cancelProgressiveLoading();

      // Construct cache key (same format as Totelepep)
      const sourceId = 'smspariaz';
      const cacheKey = targetDate ? `date_${targetDate}_${categoryId || 'all'}_${competitionId || 'all'}_${sourceId}` : `all_dates_${new Date().toISOString().split('T')[0]}_${sourceId}`;

      // Step 1: Fetch metadata (markets map, selections map, date list)
      await this.fetchOddsMetadata();

      // Step 2: Fetch odds data with optional date filter
      let oddsUrl = `${this.baseUrl}service/odds_json.php`;
      if (targetDate) {
        oddsUrl += `?date=${targetDate}`;
      }
      const oddsData = await this.fetchWithFallback(oddsUrl);
      
      // Update metadata from this response
      if (oddsData.markets) this.marketsMap = oddsData.markets;
      if (oddsData.selections) this.selectionsMap = oddsData.selections;
      if (oddsData.date) this.dateList = oddsData.date;

      const numFiles = oddsData.nf || 0;
      const forDate = targetDate || new Date().toISOString().split('T')[0];

      if (numFiles === 0) {
        return [];
      }

      // Step 3: Fetch all cache files and parse FULL matches (stored for progressive loading)
      const fullMatches: SmspariazMatch[] = [];
      const fetchPromises: Promise<void>[] = [];

      for (let i = 1; i <= numFiles; i++) {
        const cacheUrl = `${this.cacheBaseUrl}odds_${i}`;
        fetchPromises.push(
          this.fetchWithFallback(cacheUrl).then((cacheData) => {
            if (!cacheData || typeof cacheData !== 'object') return;
            
            const countryKeys = Object.keys(cacheData).filter(k => k !== 'pos');
            
            countryKeys.forEach((key) => {
              const countryBlock = cacheData[key];
              if (!countryBlock || !countryBlock.name) return;
              
              const countryName = countryBlock.name || '';
              
              if (countryBlock.league && Array.isArray(countryBlock.league)) {
                countryBlock.league.forEach((league: any) => {
                  const leagueName = league.name || '';
                  
                  if (league.match && Array.isArray(league.match)) {
                    league.match.forEach((match: any) => {
                      if (match.mainodds) {
                        const matchDate = match.d || forDate;
                        // Parse with ALL markets
                        const converted = this.convertMatch(match, countryName, leagueName, matchDate, true);
                        fullMatches.push(converted);
                      }
                    });
                  }
                });
              }
            });
          }).catch(() => {
            // Cache file not found (404) - expected for some indices
          })
        );
      }

      await Promise.all(fetchPromises);

      // Step 4: Store full matches for progressive loading, return basic matches (1X2 only)
      this._fullMatchesMap.clear();
      const basicMatches: SmspariazMatch[] = fullMatches.map(full => {
        this._fullMatchesMap.set(full.id, full);
        // Create basic version with only main 1X2 market
        const basic = this.convertMatchFromFull(full);
        return basic;
      });

      // Step 5: Save basic matches to IndexedDB (same as Totelepep)
      if (basicMatches.length > 0) {
        const chunkSize = getChunkSize();
        const totalMatches = basicMatches.length;
        for (let i = 0; i < totalMatches; i += chunkSize) {
          const chunk = basicMatches.slice(i, i + chunkSize);
          const loadedCount = Math.min(i + chunkSize, totalMatches);
          const isComplete = loadedCount >= totalMatches;
          await saveMatchesChunk(chunk, cacheKey, loadedCount, totalMatches, isComplete);
        }
      }

      // Step 6: Start progressive background loading of additional markets
      if (basicMatches.length > 0 && targetDate) {
        this.startProgressiveMarketLoad(basicMatches, targetDate, cacheKey);
      }

      return basicMatches;
    } catch (error) {
      return [];
    }
  }

  /**
   * Create a basic match (1X2 only) from a full match
   */
  private convertMatchFromFull(full: SmspariazMatch): SmspariazMatch {
    const mainMarket = full.allMarkets?.[0];
    return {
      ...full,
      allMarkets: mainMarket ? [mainMarket] : [],
      marketCount: 1,
      availableMarkets: mainMarket ? [mainMarket.marketDisplayName || mainMarket.name] : [],
    };
  }

  /**
   * Progressively populate additional markets in batches (same pattern as Totelepep)
   */
  private startProgressiveMarketLoad(matches: SmspariazMatch[], date: string, cacheKey: string): void {
    this._progressiveCancelled = false;
    const totalMatches = matches.length;
    const chunkSize = 10;
    let loadedCount = 0;

    const processChunk = (startIndex: number) => {
      if (this._progressiveCancelled) return;

      const timerId = window.setTimeout(async () => {
        if (this._progressiveCancelled) return;

        const chunk = matches.slice(startIndex, startIndex + chunkSize);
        for (const match of chunk) {
          const full = this._fullMatchesMap.get(match.id);
          if (full && full.allMarkets && full.allMarkets.length > 1) {
            // Copy all markets from full match to basic match
            match.allMarkets = full.allMarkets;
            match.marketCount = full.marketCount;
            match.availableMarkets = full.availableMarkets;
            // Also update overUnder and bothTeamsScore from full data
            match.overUnder = full.overUnder;
            match.bothTeamsScore = full.bothTeamsScore;
          }
          loadedCount++;
        }

        // Report progress
        if (this.onMarketProgress) {
          this.onMarketProgress(date, loadedCount, totalMatches);
        }

        // Update this chunk in IndexedDB with markets (same as Totelepep)
        try {
          const { updateMatchesInCache } = await import('../utils/matchCache');
          await updateMatchesInCache(chunk, cacheKey, totalMatches);
        } catch {
          // Cache update failed - non-critical
        }

        // Process next chunk
        const nextIndex = startIndex + chunkSize;
        if (nextIndex < totalMatches) {
          processChunk(nextIndex);
        } else {
          // Final progress update (ensure complete)
          if (this.onMarketProgress) {
            this.onMarketProgress(date, totalMatches, totalMatches);
          }
        }
      }, 30); // 30ms delay between chunks

      this._progressiveTimerIds.push(timerId);
    };

    if (totalMatches > 0) {
      processChunk(0);
    }
  }

  /**
   * Cancel any ongoing progressive market loading
   */
  cancelProgressiveLoading(): void {
    this._progressiveCancelled = true;
    this._progressiveTimerIds.forEach(id => window.clearTimeout(id));
    this._progressiveTimerIds = [];
    this._fullMatchesMap.clear();
  }

  /**
   * Get available dates with match counts (for date selector)
   */
  async getAvailableDates(): Promise<Array<{ date: string; matchCount: number; displayName: string }>> {
    await this.fetchOddsMetadata();
    
    return this.dateList.map(d => ({
      date: d.date,
      matchCount: d.num,
      displayName: d.text,
    }));
  }

  /**
   * Place a bet via SMS Pariaz validatebet.php
   */
  async placeBet(params: {
    selections: Array<{ selectionId: string; odds: number }>;
    stake: number;
    betType?: 's' | 'a' | 'c'; // s=single, a=accumulator, c=full cover
  }): Promise<{ success: boolean; message: string; ticketNo?: string; response?: any }> {
    try {
      const { selections, stake, betType = 's' } = params;
      
      // Calculate payout
      let totalOdds = 1;
      selections.forEach(s => { totalOdds *= s.odds; });
      const rawPayout = stake * totalOdds;
      
      // Calculate tax (14%)
      const taxAmount = (stake / 1.14) * 0.14;
      const netStake = stake - taxAmount;
      const payoutAfterTax = netStake * totalOdds;
      
      const selectionIds = selections.map(s => s.selectionId).join(',');
      
      const formData = new URLSearchParams();
      formData.append('bet-game', betType);
      formData.append('bet-selection', selectionIds);
      formData.append('bet-numselection', String(selections.length));
      formData.append('bet-stake', String(stake));
      formData.append('bet-staketax', taxAmount.toFixed(2));
      formData.append('bet-payout', payoutAfterTax.toFixed(2));
      
      const response = await fetch(`${this.baseUrl}service/validatebet.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });
      
      const html = await response.text();
      
      // Parse response - SMS Pariaz returns HTML with ticket info
      const ticketMatch = html.match(/ticket[_-]?(?:no|number|id|code)[:\s]*(\w+)/i) ||
                          html.match(/booking[:\s]*(\w+)/i) ||
                          html.match(/(\d{5,})/);
      
      const ticketNo = ticketMatch ? ticketMatch[1] : undefined;
      const success = response.ok && !html.toLowerCase().includes('error') && !html.toLowerCase().includes('invalid');
      
      return {
        success,
        message: success ? 'Bet placed successfully' : 'Bet placement failed',
        ticketNo,
        response: { html, rawPayout, taxAmount, payoutAfterTax },
      };
    } catch (error) {
      return {
        success: false,
        message: `Bet placement failed: ${error}`,
      };
    }
  }

  clearCache(): void {
    this.cancelProgressiveLoading();
    this.marketsMap = {};
    this.selectionsMap = {};
    this.dateList = [];
  }
}

export const smspariazExtractor = new SmspariazExtractor();
