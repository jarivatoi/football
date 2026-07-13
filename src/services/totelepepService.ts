import { totelepepExtractor, TotelepepMatch } from './totelepepExtractor';

class TotelepepService {
  private calendarList: Array<{entryDate: string, matchCount: number, displayDate: string}> = [];
  
  async getMatches(targetDate?: string): Promise<TotelepepMatch[]> {
    // Get matches directly from Totelepep API

    // If a specific date is provided, fetch only that date
    if (targetDate) {
      
      const matches = await totelepepExtractor.extractMatches(targetDate);
      
      return matches;
    }
    
    // If no specific date, fetch for today
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const matches = await totelepepExtractor.extractMatches(todayStr);
    
    return matches;
  }
  
  // Method to fetch calendar list data
  public async getCalendarList(): Promise<Array<{entryDate: string, matchCount: number, displayDate: string}>> {
    try {
      
      // Clear cache first to ensure we get fresh data
      totelepepExtractor.clearCache();
      
      // Fetch data for today to get the calendar list
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      await totelepepExtractor.extractMatches(todayStr);
      
      // Store calendar list data
      const extractorCalendarList = (totelepepExtractor as any).calendarList;

      if (extractorCalendarList && Array.isArray(extractorCalendarList)) {
        // Make a deep copy to avoid reference issues
        this.calendarList = JSON.parse(JSON.stringify(extractorCalendarList));

      } else {

        // Try to get calendar list from the extractor directly
        if (totelepepExtractor && (totelepepExtractor as any).calendarList) {
          const directCalendarList = (totelepepExtractor as any).calendarList;
          
          if (directCalendarList && Array.isArray(directCalendarList)) {
            this.calendarList = JSON.parse(JSON.stringify(directCalendarList));
            
          }
        }
      }
    } catch (error) {
      
    }
    
    return this.calendarList;
  }
  
  // Method to get available dates with match counts for DateSelector
  public async getAvailableDatesWithCounts(): Promise<Array<{date: string, matchCount: number, displayName: string}>> {

    // Always fetch fresh calendar list data
    await this.getCalendarList();

    // Log all calendar entries to see if Beyond exists
    this.calendarList.forEach((entry, index) => {
      
    });
    
    // Check if calendarList has the expected structure
    if (this.calendarList.length > 0) {
      // Validate the structure of the first entry
      const firstEntry = this.calendarList[0];

      const result = this.calendarList.map(entry => {

        // Handle "Beyond >>" or non-date entries specially
        if (entry.displayDate && (entry.displayDate.includes('Beyond') || entry.displayDate.includes('>>'))) {
          
          // Use the actual entryDate from API (might be a future date or special value)
          // Don't try to parse it, just use it as-is for display
          return {
            date: entry.entryDate || 'beyond',
            matchCount: entry.matchCount || 0,
            displayName: entry.displayDate
          };
        }
        
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
          
          return null;
        }
        
        dateString = dateObj.toISOString().split('T')[0];

        // ALWAYS use the API's displayDate - it already has "Today", "Beyond >>", etc.
        const displayName = entry.displayDate || dateObj.toLocaleDateString('en-GB', { 
          weekday: 'short', 
          day: 'numeric', 
          month: 'short' 
        });

        return {
          date: dateString,
          matchCount: entry.matchCount || 0,
          displayName
        };
      }).filter(entry => entry !== null) as Array<{date: string, matchCount: number, displayName: string}>;

      return result;
    }
    
    // Fallback to default dates if no calendar list available
    
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
    // No enhancement needed - matches already have all data from API
    return matches;
  }

  // Add a flag to track scraping status (kept for compatibility)
  private scrapingInProgress = false;

  private extractCompetitionId(match: TotelepepMatch): string | null {

    // Try to extract competition ID from the match data
    if (match.competitionId && match.competitionId !== '0' && match.competitionId !== '') {
      
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
        
        return competitionId;
      }
      
      // Try partial matching for league names
      for (const [leaguePattern, competitionId] of Object.entries(leagueToCompetition)) {
        if (match.league.includes(leaguePattern)) {
          
          return competitionId;
        }
      }
    }

    return null;
  }
  
  // Method to sort matches by date and time (only upcoming matches)
  public sortMatchesByDate(matches: TotelepepMatch[]): TotelepepMatch[] {
    const now = new Date();
    
    // Filter out matches that have already started (kickoff time has passed)
    const upcomingMatches = matches.filter(match => {
      if (!match.date || !match.kickoff) return false;
      
      // Parse match date and time
      const [hours, minutes] = match.kickoff.split(':').map(Number);
      const matchDateTime = new Date(match.date);
      matchDateTime.setHours(hours, minutes, 0, 0);
      
      // Only include if match hasn't started yet
      return matchDateTime > now;
    });

    return upcomingMatches.sort((a, b) => {
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
    
    // This would require access to the internal mappings, which we don't have direct access to
    
  }
  
  // Method to clear dynamic mappings
  public clearDynamicMappings(): void {
    
    // This would require access to the internal mappings, which we don't have direct access to
    
  }
  
  // New method to fetch and store all matches for all available dates
  public async fetchAndStoreAllMatches(): Promise<void> {

    try {
      // Clear cache first to ensure fresh data
      this.clearCache();
      
      // Get all matches for all dates
      const allMatches = await this.getMatches();

      // Remove duplicates by ID to prevent issues when storing in Supabase
      const uniqueMatches = allMatches.filter((match, index, self) => 
        index === self.findIndex(m => m.id === match.id)
      );

      if (uniqueMatches.length > 0 && supabaseService) {
        // Store all matches in Supabase

        // Log some sample matches for debugging
        
        const matchesByDate: Record<string, number> = {};
        uniqueMatches.slice(0, 10).forEach(match => {
          const date = match.date || 'unknown';
          if (!matchesByDate[date]) {
            matchesByDate[date] = 0;
          }
          matchesByDate[date]++;
        });
        Object.entries(matchesByDate).forEach(([date, count]) => {
          
        });
        
        const success = await supabaseService.storeMatches(uniqueMatches);
        
        if (success) {
          
        } else {
          
        }
      } else if (!supabaseService) {
        
      } else {
        
      }
    } catch (error) {
      
    }
  }
}

export const totelepepService = new TotelepepService();