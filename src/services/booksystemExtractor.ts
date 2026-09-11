/**
 * Booksystem Extractor
 * Fetches match data from Booksystem API (football.booksystem.mu) and converts to TotelepepMatch format
 * so the rest of the app can use it transparently.
 * 
 * API structure is similar to SMS Pariaz but with key differences:
 * - All match data (including markets) is in a single odds_json.php response
 * - Selections are objects with {id, code, odds, name} (not comma-separated strings)
 * - Market codes are strings: FT, HT, SH, OU, BS, CS, etc.
 * - Odds are strings like "150" (= 1.50, divided by 100)
 */

import { saveMatchesChunk, getChunkSize, updateMatchesInCache } from '../utils/matchCache';

// Reuse the same match type
export interface BooksystemMatch {
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

// Map Booksystem market code → our internal marketCode + periodCode + marketLine
function mapBooksystemMarketCode(bsCode: string): { marketCode: string; periodCode: string; marketLine?: string } {
  switch (bsCode) {
    case 'FT': return { marketCode: 'CP', periodCode: 'FT' };
    case 'HT': return { marketCode: 'CP', periodCode: 'H1' };
    case 'SH': return { marketCode: 'CP', periodCode: '2H' };
    case 'OU': return { marketCode: 'UO', periodCode: 'FT', marketLine: '2.5' };
    case 'OU1': return { marketCode: 'UO', periodCode: 'FT', marketLine: '1.5' };
    case 'OU3': return { marketCode: 'UO', periodCode: 'FT', marketLine: '3.5' };
    case 'OU1HT': return { marketCode: 'UO', periodCode: 'H1', marketLine: '1.5' };
    case 'ON1SH': return { marketCode: 'UO', periodCode: '2H', marketLine: '1.5' };
    case 'BS': return { marketCode: 'BTTS', periodCode: 'FT' };
    case 'BSHT': return { marketCode: 'BTTS', periodCode: 'H1' };
    case 'BSSH': return { marketCode: 'BTTS', periodCode: '2H' };
    case 'DC': return { marketCode: 'DC', periodCode: 'FT' };
    case 'DCHT': return { marketCode: 'DC', periodCode: 'H1' };
    case 'DCSH': return { marketCode: 'DC', periodCode: '2H' };
    case 'CS': return { marketCode: 'CS', periodCode: 'FT' };
    case 'CH': return { marketCode: 'CS', periodCode: 'H1' };
    case 'CSSH': return { marketCode: 'CS', periodCode: '2H' };
    case 'HTFT': return { marketCode: 'HTFT', periodCode: 'FT' };
    case 'DNB': return { marketCode: 'DNB', periodCode: 'FT' };
    case 'WM': return { marketCode: 'WM', periodCode: 'FT' };
    case 'GM': return { marketCode: 'GM', periodCode: 'FT' };
    case 'GMHT': return { marketCode: 'GM', periodCode: 'H1' };
    case 'GMSH': return { marketCode: 'GM', periodCode: '2H' };
    default: return { marketCode: bsCode, periodCode: 'FT' };
  }
}

class BooksystemExtractor {
  private baseUrl = 'https://football.booksystem.mu/';
  
  // CORS proxies
  private corsProxies = [
    'https://zaleugflzamrkrfkrcsa.supabase.co/functions/v1/cors-proxy?url=',
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url=',
    'https://api.codetabs.com/v1/proxy?quest=',
  ];
  private currentProxyIndex = 0;

  // Cached date list
  private dateList: Array<{ date: string; num: string; text: string }> = [];

  // Progressive market loading (same pattern as SMS Pariaz)
  public onMarketProgress: ((date: string, loaded: number, total: number) => void) | null = null;
  public onDateComplete: ((date: string) => void) | null = null;
  private _fullMatchesMap = new Map<string, BooksystemMatch>();
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
          throw new Error(`404 Not Found: ${url}`);
        } else {
          lastError = new Error(`HTTP ${response.status} from ${proxy}`);
          continue;
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes('404')) {
          throw e;
        }
        lastError = e instanceof Error ? e : new Error(String(e));
        continue;
      }
    }
    throw lastError || new Error('All CORS proxies failed for Booksystem');
  }

  /**
   * Parse odds string to decimal odds (e.g., "150" → 1.50)
   */
  private parseOdds(oddsStr: string): number {
    const raw = parseInt(oddsStr, 10);
    return isNaN(raw) ? 0 : raw / 100;
  }

  /**
   * Determine optionCode/optionNo from selection data
   */
  private getOptionInfo(sel: any, marketCode: string, homeTeam: string, awayTeam: string): { optionCode: string; optionNo: string } {
    const code = (sel.code || '').toUpperCase();
    const name = (sel.name || '').toLowerCase();
    
    // Use explicit code if available
    if (code === 'H' || code === '1') return { optionCode: 'H', optionNo: '1' };
    if (code === 'X' || code === 'D' || code === '2') return { optionCode: 'D', optionNo: '2' };
    if (code === 'A' || code === '3') return { optionCode: 'A', optionNo: '3' };
    if (code === 'OV' || name.startsWith('over')) return { optionCode: 'O', optionNo: '1' };
    if (code === 'UN' || name.startsWith('under')) return { optionCode: 'U', optionNo: '2' };
    if (name === 'yes') return { optionCode: 'Y', optionNo: '1' };
    if (name === 'no') return { optionCode: 'N', optionNo: '2' };
    
    // Fallback: use the selection's code and number
    return { optionCode: sel.code || '', optionNo: sel.number || '' };
  }

  /**
   * Convert a Booksystem market object to our internal allMarkets format
   */
  private convertMarket(market: any, homeTeam: string, awayTeam: string): NonNullable<BooksystemMatch['allMarkets']>[number] {
    const mapped = mapBooksystemMarketCode(market.code || '');
    
    const selections = (market.selection || []).map((sel: any) => {
      const optionInfo = this.getOptionInfo(sel, market.code, homeTeam, awayTeam);
      return {
        name: sel.name || '',
        odds: this.parseOdds(sel.odds || '0'),
        optionCode: optionInfo.optionCode,
        optionNo: optionInfo.optionNo,
        selectionId: sel.id || '',
        optionName: sel.name || '',
      };
    });

    return {
      id: market.bookcode || '',
      name: market.name || '',
      marketDisplayName: market.name || '',
      marketBookNo: market.bookcode || '',
      marketCode: mapped.marketCode,
      marketLine: mapped.marketLine || '',
      periodCode: mapped.periodCode,
      selections,
    };
  }

  /**
   * Convert a Booksystem match object to our internal format
   */
  private convertMatch(match: any, countryName: string, leagueName: string, dateStr: string): BooksystemMatch {
    const matchCode = String(match.code || match.maincode || '');
    const eventId = String(match.eventid || matchCode);
    const kickoff = match.time || '';
    const homeTeam = match.home || '';
    const awayTeam = match.away || '';
    const league = `${countryName} - ${leagueName}`;

    // Parse main odds (1X2 Full Time)
    const mainH = match.mainodds?.H;
    const mainX = match.mainodds?.X;
    const mainA = match.mainodds?.A;
    const homeOdds = mainH ? this.parseOdds(mainH.odds || '0') : 0;
    const drawOdds = mainX ? this.parseOdds(mainX.odds || '0') : 0;
    const awayOdds = mainA ? this.parseOdds(mainA.odds || '0') : 0;

    // Convert all markets
    const allMarkets: BooksystemMatch['allMarkets'] = [];
    
    if (match.market && Array.isArray(match.market)) {
      match.market.forEach((market: any) => {
        const converted = this.convertMarket(market, homeTeam, awayTeam);
        if (converted) {
          allMarkets.push(converted);
        }
      });
    }

    // If no markets array but we have mainodds, create at least the main 1X2 market
    if (allMarkets.length === 0 && mainH && mainX && mainA) {
      allMarkets.push({
        id: matchCode,
        name: 'Full Time',
        marketDisplayName: '1 X 2',
        marketBookNo: match.maincode || matchCode,
        marketCode: 'CP',
        periodCode: 'FT',
        selections: [
          { name: homeTeam, odds: homeOdds, optionCode: 'H', optionNo: '1', selectionId: mainH.id || '', optionName: homeTeam },
          { name: 'Draw', odds: drawOdds, optionCode: 'D', optionNo: '2', selectionId: mainX.id || '', optionName: 'Draw' },
          { name: awayTeam, odds: awayOdds, optionCode: 'A', optionNo: '3', selectionId: mainA.id || '', optionName: awayTeam },
        ]
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
      id: eventId,
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
      homeOdds,
      drawOdds,
      awayOdds,
      overUnder: { over: overOdds, under: underOdds, line: 2.5 },
      bothTeamsScore: { yes: bttsYes, no: bttsNo },
      marketCount: allMarkets.length,
      availableMarkets,
      allMarkets,
    };
  }

  /**
   * Main method: Extract matches for a given date
   * Booksystem returns all data in a single API call (no separate cache files)
   */
  async extractMatches(targetDate?: string, categoryId?: string, competitionId?: string): Promise<BooksystemMatch[]> {
    try {
      // Cancel any previous progressive loading
      this.cancelProgressiveLoading();

      const sourceId = 'booksystem';
      const cacheKey = targetDate
        ? `date_${targetDate}_${categoryId || 'all'}_${competitionId || 'all'}_${sourceId}`
        : `all_dates_${new Date().toISOString().split('T')[0]}_${sourceId}`;

      // Fetch odds data with date filter
      let oddsUrl = `${this.baseUrl}service/odds_json.php`;
      if (targetDate) {
        oddsUrl += `?date=${targetDate}`;
      }
      const oddsData = await this.fetchWithFallback(oddsUrl);
      
      // Update date list
      if (oddsData.date) {
        this.dateList = oddsData.date;
      }

      const forDate = targetDate || new Date().toISOString().split('T')[0];
      const countries = oddsData.country || [];
      
      if (countries.length === 0) {
        return [];
      }

      // Parse all matches from all countries/leagues
      const fullMatches: BooksystemMatch[] = [];
      
      countries.forEach((countryBlock: any) => {
        const countryName = countryBlock.name || '';
        
        if (countryBlock.league && Array.isArray(countryBlock.league)) {
          countryBlock.league.forEach((league: any) => {
            const leagueName = league.name || '';
            
            if (league.match && Array.isArray(league.match)) {
              league.match.forEach((match: any) => {
                if (match.mainodds) {
                  // Use the API date for the match (not the display date like "11 Sep")
                  const converted = this.convertMatch(match, countryName, leagueName, forDate);
                  fullMatches.push(converted);
                }
              });
            }
          });
        }
      });

      if (fullMatches.length === 0) {
        return [];
      }

      // Store full matches for progressive loading
      this._fullMatchesMap.clear();
      
      // Create basic matches (1X2 only) for immediate display
      const basicMatches: BooksystemMatch[] = fullMatches.map(full => {
        this._fullMatchesMap.set(full.id, full);
        return this.convertMatchFromFull(full);
      });

      // Save basic matches to IndexedDB
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

      // Start progressive background loading of additional markets
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
  private convertMatchFromFull(full: BooksystemMatch): BooksystemMatch {
    const mainMarket = full.allMarkets?.[0];
    return {
      ...full,
      allMarkets: mainMarket ? [mainMarket] : [],
      marketCount: 1,
      availableMarkets: mainMarket ? [mainMarket.marketDisplayName || mainMarket.name] : [],
    };
  }

  /**
   * Progressively populate additional markets in batches (same pattern as SMS Pariaz)
   */
  private startProgressiveMarketLoad(matches: BooksystemMatch[], date: string, cacheKey: string): void {
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
            match.allMarkets = full.allMarkets;
            match.marketCount = full.marketCount;
            match.availableMarkets = full.availableMarkets;
            match.overUnder = full.overUnder;
            match.bothTeamsScore = full.bothTeamsScore;
          }
          loadedCount++;
        }

        // Report progress
        if (this.onMarketProgress) {
          this.onMarketProgress(date, loadedCount, totalMatches);
        }

        // Update this chunk in IndexedDB
        try {
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
          // Fire onDateComplete AFTER final save — triggers autoLoadNextDate
          if (this.onDateComplete) {
            this.onDateComplete(date);
          }
        }
      }, 30);

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
    // Fetch odds metadata to get date list
    try {
      const data = await this.fetchWithFallback(`${this.baseUrl}service/odds_json.php`);
      if (data.date) {
        this.dateList = data.date;
      }
    } catch {
      // Use cached date list if fetch fails
    }
    
    return this.dateList.map(d => ({
      date: d.date,
      matchCount: parseInt(d.num, 10) || 0,
      displayName: d.text || d.date,
    }));
  }

  clearCache(): void {
    this.cancelProgressiveLoading();
    this.dateList = [];
  }
}

export const booksystemExtractor = new BooksystemExtractor();
