import { totelepepExtractor, TotelepepMatch } from './totelepepExtractor';
import { matchSpecificExtractor } from './matchSpecificExtractor';
import { supabaseService } from './supabaseService';

class TotelepepService {
  private calendarList: Array<{entryDate: string, matchCount: number, displayDate: string}> = [];
  
  async getMatches(targetDate?: string): Promise<TotelepepMatch[]> {
    // Clear cache for manual sync to ensure fresh data
    const isManualSync = typeof window !== 'undefined' && (window as any).manualSyncInProgress;
    if (isManualSync) {
      console.log('🔄 Manual sync in progress, clearing cache...');
      this.clearCache();
    }
    
    // First, try to get data from Supabase if available
    // But only use Supabase data if we're not doing a manual sync
    if (supabaseService && !isManualSync) {
      try {
        console.log('🔍 Trying to fetch matches from Supabase...');
        const supabaseMatches = await supabaseService.getMatches(targetDate);
        if (supabaseMatches.length > 0) {
          console.log(`✅ Found ${supabaseMatches.length} matches in Supabase`);
          // Enhance with real odds if needed
          return await this.enhanceWithRealOdds(supabaseMatches);
        } else {
          console.log('⚠️ No matches found in Supabase, falling back to Totelepep');
        }
      } catch (error) {
        console.warn('⚠️ Error fetching from Supabase, falling back to Totelepep:', error);
      }
    }
    
    // Get basic match data for multiple days (next 8 days)
    const allMatches: TotelepepMatch[] = [];
    
    // If a specific date is provided, fetch only that date
    if (targetDate) {
      console.log(`🔍 Fetching matches for specific date: ${targetDate}`);
      console.log(`📄 Target date type: ${typeof targetDate}`);
      console.log(`📄 Target date value:`, targetDate);
      const basicMatches = await totelepepExtractor.extractMatches(targetDate);
      console.log(`🎯 Extracted ${basicMatches.length} matches from Totelepep for ${targetDate}`);
      console.log(`📄 Sample of extracted matches for ${targetDate}:`, basicMatches.slice(0, 3));
      // Enhance with real odds for specific date
      return await this.enhanceWithRealOdds(basicMatches);
    }
    
    // If no specific date is provided, fetch matches for the next 8 days
    console.log('🔍 Fetching matches for the next 8 days...');
    
    // Create a set to track which dates we've already fetched to avoid duplicates
    const fetchedDates = new Set<string>();
    
    // Get the next 8 dates
    const datesToFetch = this.getNextNDates(8);
    console.log(`📅 Will fetch matches for dates:`, datesToFetch);
    
    // Fetch matches for each date
    for (const date of datesToFetch) {
      // Skip if we've already fetched this date
      if (fetchedDates.has(date)) {
        console.log(`⏭️ Skipping ${date} as it's already been fetched`);
        continue;
      }
      
      try {
        console.log(`🔍 Fetching matches for ${date}...`);
        const basicMatches = await totelepepExtractor.extractMatches(date);
        console.log(`🎯 Extracted ${basicMatches.length} matches from Totelepep for ${date}`);
        allMatches.push(...basicMatches);
        fetchedDates.add(date);
        console.log(`✅ Fetched ${basicMatches.length} matches for ${date}`);
      } catch (error) {
        console.warn(`⚠️ Error fetching matches for ${date}:`, error);
      }
    }
    
    // Enhance all matches with real odds
    console.log(`🎯 Enhancing ${allMatches.length} matches with real odds...`);
    
    // Remove duplicates before enhancing to prevent processing the same match multiple times
    const uniqueMatches = allMatches.filter((match, index, self) => 
      index === self.findIndex(m => m.id === match.id)
    );
    
    console.log(`🎯 After deduplication: ${uniqueMatches.length} unique matches`);
    
    return await this.enhanceWithRealOdds(uniqueMatches);
  }
  
  // Method to fetch calendar list data
  private async fetchCalendarList(): Promise<void> {
    try {
      console.log('🔍 Fetching calendar list data...');
      // Clear cache first to ensure we get fresh data
      totelepepExtractor.clearCache();
      
      // Fetch data for today to get the calendar list
      await totelepepExtractor.extractMatches();
      
      // Store calendar list data
      const extractorCalendarList = (totelepepExtractor as any).calendarList;
      console.log('📅 Extractor calendar list:', extractorCalendarList);
      console.log('📅 Extractor calendar list type:', typeof extractorCalendarList);
      if (extractorCalendarList && Array.isArray(extractorCalendarList)) {
        // Make a deep copy to avoid reference issues
        this.calendarList = JSON.parse(JSON.stringify(extractorCalendarList));
        console.log('📅 Fetched and stored calendar list:', this.calendarList);
        console.log('📅 Stored calendar list length:', this.calendarList.length);
        
        // Log each entry in the calendar list
        this.calendarList.forEach((entry, index) => {
          console.log(`   Calendar entry ${index}:`, entry);
        });
      } else {
        console.log('⚠️ No calendar list data found in extractor after fetch');
        console.log('⚠️ Extractor calendar list is not an array or is undefined');
      }
    } catch (error) {
      console.warn('⚠️ Error fetching calendar list:', error);
    }
  }
  
  // Method to fetch calendar list data
  public async getCalendarList(): Promise<Array<{entryDate: string, matchCount: number, displayDate: string}>> {
    try {
      console.log('🔍 Fetching calendar list data...');
      // Clear cache first to ensure we get fresh data
      totelepepExtractor.clearCache();
      
      // Fetch data for today to get the calendar list
      await totelepepExtractor.extractMatches();
      
      // Store calendar list data
      const extractorCalendarList = (totelepepExtractor as any).calendarList;
      console.log('📅 Extractor calendar list:', extractorCalendarList);
      console.log('📅 Extractor calendar list type:', typeof extractorCalendarList);
      if (extractorCalendarList && Array.isArray(extractorCalendarList)) {
        // Make a deep copy to avoid reference issues
        this.calendarList = JSON.parse(JSON.stringify(extractorCalendarList));
        console.log('📅 Fetched and stored calendar list:', this.calendarList);
        console.log('📅 Stored calendar list length:', this.calendarList.length);
      } else {
        console.log('⚠️ No calendar list data found in extractor after fetch');
        console.log('⚠️ Extractor calendar list is not an array or is undefined');
        // Try to get calendar list from the extractor directly
        if (totelepepExtractor && (totelepepExtractor as any).calendarList) {
          const directCalendarList = (totelepepExtractor as any).calendarList;
          console.log('📅 Direct calendar list from extractor:', directCalendarList);
          if (directCalendarList && Array.isArray(directCalendarList)) {
            this.calendarList = JSON.parse(JSON.stringify(directCalendarList));
            console.log('📅 Using direct calendar list:', this.calendarList);
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Error fetching calendar list:', error);
    }
    
    return this.calendarList;
  }
  
  // Method to get available dates with match counts for DateSelector
  public async getAvailableDatesWithCounts(): Promise<Array<{date: string, matchCount: number, displayName: string}>> {
    console.log('📅 Getting available dates with counts...');
    
    // Always fetch fresh calendar list data
    await this.fetchCalendarList();
    
    console.log('📅 Calendar list data after fetch:', this.calendarList);
    console.log('📅 Calendar list length:', this.calendarList.length);
    
    // Check if calendarList has the expected structure
    if (this.calendarList.length > 0) {
      // Validate the structure of the first entry
      const firstEntry = this.calendarList[0];
      console.log('📅 First calendar entry:', firstEntry);
      
      const result = this.calendarList.map(entry => {
        console.log('📅 Processing calendar entry:', entry);
        
        // Handle different possible date formats
        let dateObj: Date;
        let dateString: string;
        
        if (typeof entry.entryDate === 'string') {
          // Try to parse as ISO date string
          dateObj = new Date(entry.entryDate);
          // If invalid, try other formats
          if (isNaN(dateObj.getTime())) {
            // Try parsing as YYYY-MM-DD format
            const parts = entry.entryDate.split('-');
            if (parts.length === 3) {
              dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            }
          }
        } else if (typeof entry.entryDate === 'number') {
          // Unix timestamp
          dateObj = new Date(entry.entryDate);
        } else {
          // Fallback to today
          dateObj = new Date();
        }
        
        // If we still don't have a valid date, skip this entry
        if (isNaN(dateObj.getTime())) {
          console.warn('⚠️ Invalid date in calendar entry:', entry);
          return null;
        }
        
        dateString = dateObj.toISOString().split('T')[0];
        console.log(`📅 Converting calendar entry date: ${entry.entryDate} -> ${dateString}`);
        
        let displayName = '';
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        
        if (dateObj.toDateString() === today.toDateString()) {
          displayName = 'Today';
        } else if (dateObj.toDateString() === tomorrow.toDateString()) {
          displayName = 'Tomorrow';
        } else {
          displayName = dateObj.toLocaleDateString('en-GB', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short' 
          });
        }
        
        return {
          date: dateString,
          matchCount: entry.matchCount || 0,
          displayName
        };
      }).filter(entry => entry !== null) as Array<{date: string, matchCount: number, displayName: string}>;
      
      console.log('📅 Available dates with counts (from calendarList):', result);
      return result;
    }
    
    // Fallback to default dates if no calendar list available
    console.log('⚠️ Using fallback dates as no calendar list available');
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < 8; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      
      let displayName = '';
      if (i === 0) displayName = 'Today';
      else if (i === 1) displayName = 'Tomorrow';
      else displayName = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      
      dates.push({
        date: dateString,
        matchCount: 0,
        displayName
      });
    }
    
    console.log('📅 Available dates with counts (fallback):', dates);
    return dates;
  }

  private getNextNDates(n: number): string[] {
    const dates: string[] = [];
    const today = new Date();
    
    for (let i = 0; i < n; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }
    
    return dates;
  }

  private async enhanceWithRealOdds(matches: TotelepepMatch[]): Promise<TotelepepMatch[]> {
    console.log(`🎯 Enhancing ${matches.length} matches with real BTTS/Over-Under odds...`);
    
    const enhanced: TotelepepMatch[] = [];
    
    // Add a flag to prevent continuous scraping
    const shouldEnhance = !this.scrapingInProgress;
    if (!shouldEnhance) {
      console.log('⚠️ Scraping already in progress, skipping enhancement');
      return matches;
    }
    
    this.scrapingInProgress = true;
    
    try {
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        
        // Log original match data for debugging
        console.log(`🔍 Original match data for ${match.homeTeam} vs ${match.awayTeam}:`, {
          id: match.id,
          marketBookNo: match.marketBookNo,
          marketCode: match.marketCode,
          competitionId: match.competitionId,
          league: match.league
        });
        
        try {
          // Extract competition ID from match data
          const competitionId = this.extractCompetitionId(match);
          
          console.log(`🔍 Match: ${match.homeTeam} vs ${match.awayTeam}`);
          console.log(`   Match competitionId: ${match.competitionId}`);
          console.log(`   Extracted competitionId: ${competitionId}`);
          console.log(`   Match league: ${match.league}`);
          
          if (competitionId) {
            console.log(`🔍 Getting real odds for ${match.homeTeam} vs ${match.awayTeam} (Match ${match.id})`);
            
            const realOdds = await matchSpecificExtractor.extractMatchOdds(match.id, competitionId);
            
            if (realOdds && (realOdds.bttsYes || realOdds.over25)) {
              // Use real odds
              const enhancedMatch: TotelepepMatch = {
                ...match, // Preserve all original properties including market data
                bothTeamsScore: {
                  yes: realOdds.bttsYes !== undefined ? realOdds.bttsYes : 'N/A',
                  no: realOdds.bttsNo !== undefined ? realOdds.bttsNo : 'N/A',
                },
                overUnder: {
                  over: realOdds.over25 !== undefined ? realOdds.over25 : 'N/A',
                  under: realOdds.under25 !== undefined ? realOdds.under25 : 'N/A',
                  line: 2.5,
                },
                // Update market count and available markets based on real odds
                marketCount: realOdds.bttsYes !== undefined || realOdds.over25 !== undefined ? 
                  (match.marketCount || 3) + (realOdds.bttsYes !== undefined ? 1 : 0) + (realOdds.over25 !== undefined ? 1 : 0) : 
                  match.marketCount,
                availableMarkets: [
                  '1X2',
                  ...(realOdds.bttsYes !== undefined ? ['Both Teams To Score'] : []),
                  ...(realOdds.over25 !== undefined ? ['Over/Under 2.5'] : [])
                ]
              };
              
              // Ensure market data is properly preserved
              if (!enhancedMatch.marketBookNo || enhancedMatch.marketBookNo === 'undefined' || enhancedMatch.marketBookNo === 'null') {
                console.warn(`⚠️ MarketBookNo was lost during enhancement for match ${match.id}, restoring from matchId`);
                enhancedMatch.marketBookNo = match.id;
              }
              
              if (!enhancedMatch.marketCode || enhancedMatch.marketCode === 'undefined' || enhancedMatch.marketCode === 'null') {
                console.warn(`⚠️ MarketCode was lost during enhancement for match ${match.id}, restoring to default`);
                enhancedMatch.marketCode = 'CP';
              }
            
              // Log enhanced match data for debugging
              console.log(`✅ Enhanced match data for ${match.homeTeam} vs ${match.awayTeam}:`, {
                id: enhancedMatch.id,
                marketBookNo: enhancedMatch.marketBookNo,
                marketCode: enhancedMatch.marketCode,
                competitionId: enhancedMatch.competitionId,
                league: enhancedMatch.league,
                bothTeamsScore: enhancedMatch.bothTeamsScore,
                overUnder: enhancedMatch.overUnder
              });
            
              enhanced.push(enhancedMatch);
              console.log(`✅ Enhanced ${match.homeTeam} vs ${match.awayTeam} with real odds`);
            } else {
              // Use N/A for missing odds instead of mock odds
              const enhancedMatch: TotelepepMatch = {
                ...match, // Preserve all original properties including market data
                bothTeamsScore: {
                  yes: 'N/A',
                  no: 'N/A',
                },
                overUnder: {
                  over: 'N/A',
                  under: 'N/A',
                  line: 2.5,
                },
                // Ensure market data is properly initialized
                marketCount: match.marketCount || 3,
                availableMarkets: match.availableMarkets || ['1X2']
              };
              
              // Ensure market data is properly preserved
              if (!enhancedMatch.marketBookNo || enhancedMatch.marketBookNo === 'undefined' || enhancedMatch.marketBookNo === 'null') {
                console.warn(`⚠️ MarketBookNo was lost during enhancement for match ${match.id}, restoring from matchId`);
                enhancedMatch.marketBookNo = match.id;
              }
              
              if (!enhancedMatch.marketCode || enhancedMatch.marketCode === 'undefined' || enhancedMatch.marketCode === 'null') {
                console.warn(`⚠️ MarketCode was lost during enhancement for match ${match.id}, restoring to default`);
                enhancedMatch.marketCode = 'CP';
              }
            
              // Log enhanced match data for debugging
              console.log(`⚠️ Enhanced match data (no real odds) for ${match.homeTeam} vs ${match.awayTeam}:`, {
                id: enhancedMatch.id,
                marketBookNo: enhancedMatch.marketBookNo,
                marketCode: enhancedMatch.marketCode,
                competitionId: enhancedMatch.competitionId,
                league: enhancedMatch.league
              });
            
              enhanced.push(enhancedMatch);
              console.log(`⚠️ No real odds found for ${match.homeTeam} vs ${match.awayTeam}, using N/A`);
            }
          } else {
            // Keep original match
            // Log original match data for debugging
            console.log(`⚠️ Original match data (no competition ID) for ${match.homeTeam} vs ${match.awayTeam}:`, {
              id: match.id,
              marketBookNo: match.marketBookNo,
              marketCode: match.marketCode,
              competitionId: match.competitionId,
              league: match.league
            });
            
            enhanced.push(match);
            console.log(`⚠️ No competition ID for ${match.homeTeam} vs ${match.awayTeam}`);
          }
          
          // Small delay to respect rate limits
          if (i < matches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
        } catch (error) {
          console.warn(`⚠️ Error enhancing match ${match.id}:`, error);
          enhanced.push(match); // Keep original match
        }
      }
      
      console.log(`🎯 Enhanced ${enhanced.length} matches with real odds data`);
      
      // Store enhanced matches in Supabase if available
      if (supabaseService && enhanced.length > 0) {
        try {
          console.log('🔄 Storing enhanced matches in Supabase...');
          await supabaseService.storeMatches(enhanced);
          console.log(`✅ Stored ${enhanced.length} enhanced matches in Supabase`);
        } catch (error) {
          console.warn('⚠️ Error storing matches in Supabase:', error);
        }
      }
      
      return enhanced;
    } finally {
      // Reset the scraping flag after a delay to prevent continuous triggering
      setTimeout(() => {
        this.scrapingInProgress = false;
      }, 5000); // 5 second cooldown
    }
  }

  // Add a flag to track scraping status
  private scrapingInProgress = false;

  private extractCompetitionId(match: TotelepepMatch): string | null {
    console.log(`🔍 Extracting competition ID for match: ${match.homeTeam} vs ${match.awayTeam}`);
    console.log(`   Match competitionId: ${match.competitionId}`);
    console.log(`   Match league: ${match.league}`);
    
    // Try to extract competition ID from the match data
    if (match.competitionId && match.competitionId !== '0' && match.competitionId !== '') {
      console.log(`   ✅ Using match.competitionId: ${match.competitionId}`);
      return match.competitionId;
    }
    
    // Extended competition mappings
    const leagueToCompetition: Record<string, string> = {
      'Austria - OFB Cup': '81',
      'England - EFL Cup': '126',
      'Spain - LaLiga': '163',
      'International Clubs - UEFA Champions League': '50',
      'International Clubs - UEFA Conference League': '55',
      'International Clubs - UEFA Europa League': '135',
      'Lithuania - A Lyga': '38',
      'Japan - Emperor Cup': '52',
      'Czechia - Czech Cup': '112',
      'Croatia - Croatian Cup': '234',
      'Egypt - Premier League': '35',
      'Germany - DFB Pokal': '138',
      'Iran - Pro League': '17',
      'England - Premier League': '1',
      'England - Championship': '2',
      'Germany - Bundesliga': '7',
      'Spain - La Liga': '9',
      'Italy - Serie A': '11',
      'France - Ligue 1': '13',
      'Netherlands - Eredivisie': '15',
      'Scotland - Premiership': '5',
      'UEFA Champions League': '50',
      'UEFA Europa League': '51',
      'UEFA Conference League': '55',
      // Added mapping for U21 European Championship
      'U21 European Championship': '140',
      'European Championship': '140',
      'Africa Cup of Nations': '142',
      'Copa America': '144',
      'World Cup': '146'
    };
    
    // Try to find competition ID by league name
    if (match.league) {
      const competitionId = leagueToCompetition[match.league];
      if (competitionId) {
        console.log(`   ✅ Found competition ID ${competitionId} for league: ${match.league}`);
        return competitionId;
      }
      
      // Try partial matching for league names
      for (const [leaguePattern, competitionId] of Object.entries(leagueToCompetition)) {
        if (match.league.includes(leaguePattern)) {
          console.log(`   ✅ Found competition ID ${competitionId} for partial match: ${match.league} includes ${leaguePattern}`);
          return competitionId;
        }
      }
    }
    
    console.log(`   ⚠️ No competition ID found for match: ${match.homeTeam} vs ${match.awayTeam}`);
    return null;
  }
  
  // Method to sort matches by date and time
  public sortMatchesByDate(matches: TotelepepMatch[]): TotelepepMatch[] {
    return matches.sort((a, b) => {
      // Sort by date first
      const dateA = new Date(a.date || new Date().toISOString().split('T')[0]);
      const dateB = new Date(b.date || new Date().toISOString().split('T')[0]);
      
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime();
      }
      
      // Then sort by kickoff time
      const timeA = a.kickoff || '00:00';
      const timeB = b.kickoff || '00:00';
      
      return timeA.localeCompare(timeB);
    });
  }
  
  // Method to group matches by date
  public groupMatchesByDate(matches: TotelepepMatch[]): Record<string, TotelepepMatch[]> {
    const grouped: Record<string, TotelepepMatch[]> = {};
    
    matches.forEach(match => {
      const date = match.date || new Date().toISOString().split('T')[0];
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(match);
    });
    
    // Sort matches within each date group
    Object.keys(grouped).forEach(date => {
      grouped[date] = this.sortMatchesByDate(grouped[date]);
    });
    
    return grouped;
  }
  
  // Method to clear cache
  public clearCache(): void {
    console.log('🧹 Clearing Totelepep service cache');
    this.calendarList = [];
    // Clear extractor caches
    if ((totelepepExtractor as any).clearCache) {
      (totelepepExtractor as any).clearCache();
    }
    if ((matchSpecificExtractor as any).clearCache) {
      (matchSpecificExtractor as any).clearCache();
    }
  }
  
  // Method to log competition mappings
  public logCompetitionMappings(): void {
    console.log('📋 Current competition mappings:');
    // This would require access to the internal mappings, which we don't have direct access to
    console.log('⚠️ Cannot access internal competition mappings directly');
  }
  
  // Method to clear dynamic mappings
  public clearDynamicMappings(): void {
    console.log('🧹 Clearing dynamic mappings');
    // This would require access to the internal mappings, which we don't have direct access to
    console.log('⚠️ Cannot clear dynamic mappings directly');
  }
  
  // New method to fetch and store all matches for all available dates
  public async fetchAndStoreAllMatches(): Promise<void> {
    console.log('🔄 Fetching and storing all matches for all available dates...');
    
    try {
      // Clear cache first to ensure fresh data
      this.clearCache();
      
      // Get all matches for all dates
      const allMatches = await this.getMatches();
      
      console.log(`📊 Total matches fetched: ${allMatches.length}`);
      
      // Remove duplicates by ID to prevent issues when storing in Supabase
      const uniqueMatches = allMatches.filter((match, index, self) => 
        index === self.findIndex(m => m.id === match.id)
      );
      
      console.log(`📊 After deduplication: ${uniqueMatches.length} unique matches`);
      
      if (uniqueMatches.length > 0 && supabaseService) {
        // Store all matches in Supabase
        console.log(`🔄 Storing ${uniqueMatches.length} matches in Supabase...`);
        
        // Log some sample matches for debugging
        console.log('📅 Sample matches by date before storing:');
        const matchesByDate: Record<string, number> = {};
        uniqueMatches.slice(0, 10).forEach(match => {
          const date = match.date || 'unknown';
          if (!matchesByDate[date]) {
            matchesByDate[date] = 0;
          }
          matchesByDate[date]++;
        });
        Object.entries(matchesByDate).forEach(([date, count]) => {
          console.log(`   ${date}: ${count} matches`);
        });
        
        const success = await supabaseService.storeMatches(uniqueMatches);
        
        if (success) {
          console.log(`✅ Successfully stored ${uniqueMatches.length} matches in Supabase`);
        } else {
          console.error('❌ Failed to store matches in Supabase');
        }
      } else if (!supabaseService) {
        console.log('⚠️ Supabase service not available, skipping storage');
      } else {
        console.log('ℹ️ No matches to store');
      }
    } catch (error) {
      console.error('❌ Error fetching and storing all matches:', error);
    }
  }
}

export const totelepepService = new TotelepepService();