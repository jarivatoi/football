import { supabase } from './supabaseClient';
import { TotelepepMatch } from './totelepepExtractor';

// Check if Supabase is configured
const isSupabaseConfigured = !!supabase;

// Log Supabase configuration status
console.log(' Supabase configuration status:');
console.log('  isSupabaseConfigured:', isSupabaseConfigured);
if (supabase) {
  console.log('  Supabase client created successfully');
} else {
  console.log('  Supabase client creation failed');
}

interface SupabaseMatch {
  id: string;
  home_team: string;
  away_team: string;
  league: string;
  date: string;
  kickoff: string;
  status: 'upcoming' | 'live' | 'finished';
  home_score?: number;
  away_score?: number;
  minute?: number;
  competition_id: string;
  market_book_no?: string;
  market_code?: string;
  home_odds?: number;
  draw_odds?: number;
  away_odds?: number;
  over_25_odds?: number;
  under_25_odds?: number;
  btts_yes_odds?: number;
  btts_no_odds?: number;
  market_count?: number;
  available_markets?: string[];
  created_at: string;
  updated_at: string;
}

class SupabaseService {
  // Convert TotelepepMatch to SupabaseMatch format
  private convertToSupabaseMatch(match: TotelepepMatch): SupabaseMatch {
    return {
      id: match.id,
      home_team: match.homeTeam,
      away_team: match.awayTeam,
      league: match.league,
      date: match.date || new Date().toISOString().split('T')[0],
      kickoff: match.kickoff,
      status: match.status as 'upcoming' | 'live' | 'finished',
      home_score: match.homeScore,
      away_score: match.awayScore,
      minute: match.minute,
      competition_id: match.competitionId || '',
      market_book_no: match.marketBookNo,
      market_code: match.marketCode,
      home_odds: match.homeOdds ? Number(match.homeOdds) : undefined,
      draw_odds: match.drawOdds ? Number(match.drawOdds) : undefined,
      away_odds: match.awayOdds ? Number(match.awayOdds) : undefined,
      over_25_odds: match.overUnder?.over ? Number(match.overUnder.over) : undefined,
      under_25_odds: match.overUnder?.under ? Number(match.overUnder.under) : undefined,
      btts_yes_odds: match.bothTeamsScore?.yes ? Number(match.bothTeamsScore.yes) : undefined,
      btts_no_odds: match.bothTeamsScore?.no ? Number(match.bothTeamsScore.no) : undefined,
      market_count: match.marketCount,
      available_markets: match.availableMarkets,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  // Convert SupabaseMatch to TotelepepMatch format
  private convertToTotelepepMatch(match: SupabaseMatch): TotelepepMatch {
    return {
      id: match.id,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      league: match.league,
      date: match.date,
      kickoff: match.kickoff,
      status: match.status as 'upcoming' | 'live' | 'finished',
      homeScore: match.home_score,
      awayScore: match.away_score,
      minute: match.minute,
      competitionId: match.competition_id || '',
      marketBookNo: match.market_book_no,
      marketCode: match.market_code,
      homeOdds: match.home_odds?.toString() || 'N/A',
      drawOdds: match.draw_odds?.toString() || 'N/A',
      awayOdds: match.away_odds?.toString() || 'N/A',
      overUnder: {
        over: match.over_25_odds?.toString() || 'N/A',
        under: match.under_25_odds?.toString() || 'N/A',
        line: 2.5
      },
      bothTeamsScore: {
        yes: match.btts_yes_odds?.toString() || 'N/A',
        no: match.btts_no_odds?.toString() || 'N/A'
      },
      marketCount: match.market_count,
      availableMarkets: match.available_markets
    };
  }

  // Store matches in Supabase with upsert
  async storeMatches(matches: TotelepepMatch[]): Promise<boolean> {
    // Check if Supabase is configured
    if (!isSupabaseConfigured || !supabase) {
      console.log('⚠️ Supabase not configured, skipping store matches');
      return false;
    }
    
    try {
      console.log(`🔍 Preparing to store ${matches.length} matches in Supabase`);
      
      // Remove duplicates by ID to prevent the "ON CONFLICT DO UPDATE command cannot affect row a second time" error
      const uniqueMatches = matches.filter((match, index, self) => 
        index === self.findIndex(m => m.id === match.id)
      );
      
      console.log(`🔍 After deduplication: ${uniqueMatches.length} unique matches`);
      
      // Log some sample matches for debugging
      if (uniqueMatches.length > 0) {
        console.log('📅 Sample matches by date:');
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
        
        // Log match counts by date for better debugging
        const dateCounts: Record<string, number> = {};
        uniqueMatches.forEach(match => {
          const date = match.date || 'unknown';
          dateCounts[date] = (dateCounts[date] || 0) + 1;
        });
        
        console.log('📊 Match counts by date:');
        Object.entries(dateCounts).forEach(([date, count]) => {
          console.log(`   ${date}: ${count} matches`);
        });
      }
      
      const supabaseMatches = uniqueMatches.map(match => this.convertToSupabaseMatch(match));
      
      // Log some sample converted matches for debugging
      if (supabaseMatches.length > 0) {
        console.log('📄 Sample converted matches:');
        console.log(JSON.stringify(supabaseMatches.slice(0, 3), null, 2));
      }
      
      // Clear old matches first to ensure clean state
      console.log('🧹 Clearing old matches before storing new ones...');
      await this.clearOldMatches();
      
      // Delete all existing matches to ensure a clean state
      // We'll use a more reliable approach than the batch deletion
      console.log('🗑️ Deleting all existing matches...');
      
      // First, check how many records we have
      const { count: initialCount, error: countError } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.error('Error getting initial count:', countError);
        // Continue anyway as we'll try to upsert
      } else {
        console.log(`📊 Initial record count: ${initialCount ?? 0}`);
        
        // Only delete if there are records
        if (initialCount && initialCount > 0) {
          // Delete all records using a more reliable approach
          // We'll delete in smaller batches and track actual deletions
          let totalDeleted = 0;
          const batchSize = 50; // Smaller batch size for better control
          
          console.log(`🗑️ Deleting ${initialCount} records in batches of ${batchSize}...`);
          
          while (totalDeleted < (initialCount ?? 0)) {
            // Get a batch of record IDs to delete
            const { data: recordsToDelete, error: fetchError } = await supabase
              .from('matches')
              .select('id')
              .limit(batchSize);
            
            if (fetchError) {
              console.error('Error fetching records to delete:', fetchError);
              // Continue anyway as we'll try to upsert
              break;
            }
            
            // If no records to delete, break
            if (recordsToDelete.length === 0) {
              break;
            }
            
            // Extract IDs
            const idsToDelete = recordsToDelete.map(record => record.id);
            
            // Delete the batch
            const { error: deleteError } = await supabase
              .from('matches')
              .delete()
              .in('id', idsToDelete);
            
            if (deleteError) {
              console.error(`Error deleting batch:`, deleteError);
              // Continue anyway as we'll try to upsert
              break;
            }
            
            const recordsDeletedInBatch = idsToDelete.length;
            totalDeleted += recordsDeletedInBatch;
            console.log(`✅ Deleted ${recordsDeletedInBatch} records in this batch (${totalDeleted}/${initialCount} total)`);
            
            // Add a small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          console.log(`✅ Deleted all existing matches. Total deleted: ${totalDeleted}`);
        } else {
          console.log('✅ No existing matches to delete');
        }
      }
      
      // If there are no matches to store, we're done
      if (supabaseMatches.length === 0) {
        console.log('ℹ️ No matches to store in Supabase');
        return true;
      }
      
      // Upsert matches (insert or update) in batches to avoid timeouts
      console.log('🔄 Performing upsert operation in batches...');
      const batchSize = 100;
      let totalStored = 0;
      let totalErrors = 0;
      
      for (let i = 0; i < supabaseMatches.length; i += batchSize) {
        const batch = supabaseMatches.slice(i, i + batchSize);
        console.log(`🔄 Storing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(supabaseMatches.length/batchSize)} (${batch.length} matches)`);
        
        const { error } = await supabase
          .from('matches')
          .upsert(batch, {
            onConflict: 'id',
            ignoreDuplicates: false
          });

        if (error) {
          console.error(`Error storing batch ${Math.floor(i/batchSize) + 1}:`, error);
          totalErrors++;
          // Continue with other batches instead of failing completely
        } else {
          totalStored += batch.length;
          console.log(`✅ Successfully stored batch ${Math.floor(i/batchSize) + 1} (${batch.length} matches)`);
        }
      }

      console.log(`✅ Successfully stored ${totalStored} matches in Supabase with ${totalErrors} errors`);
      
      // Verify the data was stored correctly
      console.log('🔍 Verifying stored data...');
      const { data: verificationData, error: verificationError } = await supabase
        .from('matches')
        .select('date', { count: 'exact' });
        
      if (verificationError) {
        console.error('Error verifying stored data:', verificationError);
      } else {
        console.log(`✅ Verification: Found ${verificationData.length} matches in Supabase after storage`);
        
        // Count matches by date for verification
        const verificationCounts: Record<string, number> = {};
        verificationData.forEach(item => {
          verificationCounts[item.date] = (verificationCounts[item.date] || 0) + 1;
        });
        
        console.log('📊 Verification counts by date:');
        Object.entries(verificationCounts).forEach(([date, count]) => {
          console.log(`   ${date}: ${count} matches`);
        });
      }
      
      return totalErrors === 0;
    } catch (error) {
      console.error('Error storing matches in Supabase:', error);
      return false;
    }
  }

  // Get matches from Supabase
  async getMatches(date?: string): Promise<TotelepepMatch[]> {
    // Check if Supabase is configured
    if (!isSupabaseConfigured || !supabase) {
      console.log('⚠️ Supabase not configured, returning empty matches array');
      return [];
    }
    
    try {
      let query = supabase
        .from('matches')
        .select('*')
        .order('date', { ascending: true })
        .order('kickoff', { ascending: true });

      // Filter by date if provided
      if (date) {
        query = query.eq('date', date);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching matches from Supabase:', error);
        return [];
      }

      return data.map(match => this.convertToTotelepepMatch(match));
    } catch (error) {
      console.error('Error fetching matches from Supabase:', error);
      return [];
    }
  }

  // Get matches by competition
  async getMatchesByCompetition(competitionId: string): Promise<TotelepepMatch[]> {
    // Check if Supabase is configured
    if (!isSupabaseConfigured || !supabase) {
      console.log('⚠️ Supabase not configured, returning empty matches array');
      return [];
    }
    
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('competition_id', competitionId)
        .order('date', { ascending: true })
        .order('kickoff', { ascending: true });

      if (error) {
        console.error('Error fetching matches by competition from Supabase:', error);
        return [];
      }

      return data.map(match => this.convertToTotelepepMatch(match));
    } catch (error) {
      console.error('Error fetching matches by competition from Supabase:', error);
      return [];
    }
  }

  // Subscribe to real-time updates
  subscribeToMatchUpdates(callback: (payload: any) => void) {
    // Check if Supabase is configured
    if (!isSupabaseConfigured || !supabase) {
      console.log('⚠️ Supabase not configured, returning null subscription');
      return null;
    }
    
    console.log('📡 Subscribing to real-time match updates');
    
    const subscription = supabase
      .channel('matches-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
        },
        (payload) => {
          console.log('📥 New match inserted:', payload);
          callback(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
        },
        (payload) => {
          console.log('🔄 Match updated:', payload);
          callback(payload);
        }
      )
      .subscribe();

    return subscription;
  }

  // Clear old matches (older than 7 days) and future matches (more than 30 days in the future)
  async clearOldMatches(): Promise<void> {
    // Check if Supabase is configured
    if (!isSupabaseConfigured || !supabase) {
      console.log('⚠️ Supabase not configured, skipping clear old matches');
      return;
    }
    
    try {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      
      const thirtyDaysFromNow = new Date(today);
      thirtyDaysFromNow.setDate(today.getDate() + 30);
      
      const sevenDaysAgoString = sevenDaysAgo.toISOString().split('T')[0];
      const thirtyDaysFromNowString = thirtyDaysFromNow.toISOString().split('T')[0];
      const todayString = today.toISOString().split('T')[0];
      
      console.log(`📅 Today: ${todayString}`);
      console.log(`📅 Seven days ago: ${sevenDaysAgoString}`);
      console.log(`📅 Thirty days from now: ${thirtyDaysFromNowString}`);
      
      // First, let's see what dates we have in the database
      const { data: allDates, error: datesError } = await supabase
        .from('matches')
        .select('date');
      
      if (datesError) {
        console.error('Error fetching dates from Supabase:', datesError);
        throw datesError;
      }
      
      // Get unique dates and sort them
      const uniqueDates = [...new Set(allDates.map(item => item.date))].sort();
      console.log(`📅 All dates in database:`, uniqueDates);
      
      // Count matches by date
      const dateCounts: Record<string, number> = {};
      allDates.forEach(item => {
        dateCounts[item.date] = (dateCounts[item.date] || 0) + 1;
      });
      
      console.log('📊 Match counts by date:');
      Object.entries(dateCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([date, count]) => {
          console.log(`   ${date}: ${count} matches`);
        });
      
      // Identify old and future dates
      const oldDates = uniqueDates.filter(date => date < sevenDaysAgoString);
      const futureDates = uniqueDates.filter(date => date > thirtyDaysFromNowString);
      
      console.log(`📅 Old dates to delete:`, oldDates);
      console.log(`📅 Future dates to delete:`, futureDates);
      
      let totalDeleted = 0;
      
      // Delete matches older than 7 days
      if (oldDates.length > 0) {
        console.log('🧹 Deleting old matches...');
        // Delete old matches one by one to avoid issues
        for (const oldDate of oldDates) {
          const { error: deleteError } = await supabase
            .from('matches')
            .delete()
            .eq('date', oldDate);
            
          if (deleteError) {
            console.error(`Error deleting matches for date ${oldDate}:`, deleteError);
          } else {
            const count = dateCounts[oldDate] || 0;
            console.log(`✅ Deleted ${count} matches for date ${oldDate}`);
            totalDeleted += count;
          }
        }
      } else {
        console.log('✅ No old matches to delete');
      }
      
      // Delete matches more than 30 days in the future
      if (futureDates.length > 0) {
        console.log('🧹 Deleting future matches...');
        // Delete future matches one by one to avoid issues
        for (const futureDate of futureDates) {
          const { error: deleteError } = await supabase
            .from('matches')
            .delete()
            .eq('date', futureDate);
            
          if (deleteError) {
            console.error(`Error deleting matches for date ${futureDate}:`, deleteError);
          } else {
            const count = dateCounts[futureDate] || 0;
            console.log(`✅ Deleted ${count} matches for date ${futureDate}`);
            totalDeleted += count;
          }
        }
      } else {
        console.log('✅ No future matches to delete');
      }
      
      console.log(`📊 Total matches deleted: ${totalDeleted}`);
      
    } catch (error) {
      console.error('Error clearing old and future matches from Supabase:', error);
      throw error;
    }
  }

  // Get last update time
  async getLastUpdateTime(): Promise<Date | null> {
    // Check if Supabase is configured
    if (!isSupabaseConfigured || !supabase) {
      console.log('⚠️ Supabase not configured, returning null last update time');
      return null;
    }
    
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Error fetching last update time from Supabase:', error);
        return null;
      }

      return data ? new Date(data.updated_at) : null;
    } catch (error) {
      console.error('Error fetching last update time from Supabase:', error);
      return null;
    }
  }
  
  // Get total match count
  async getMatchCount(): Promise<number> {
    // Check if Supabase is configured
    if (!isSupabaseConfigured || !supabase) {
      console.log('⚠️ Supabase not configured, returning 0 match count');
      return 0;
    }
    
    try {
      const { count, error } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error('Error fetching match count from Supabase:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error fetching match count from Supabase:', error);
      return 0;
    }
  }
  
  // Get all matches from Supabase (regardless of date)
  async getAllMatches(): Promise<TotelepepMatch[]> {
    // Check if Supabase is configured
    if (!isSupabaseConfigured || !supabase) {
      console.log('⚠️ Supabase not configured, returning empty matches array');
      return [];
    }
    
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .order('date', { ascending: true })
        .order('kickoff', { ascending: true });

      if (error) {
        console.error('Error fetching all matches from Supabase:', error);
        return [];
      }

      return data.map(match => this.convertToTotelepepMatch(match));
    } catch (error) {
      console.error('Error fetching all matches from Supabase:', error);
      return [];
    }
  }
  
  // Get matches for a range of dates
  async getMatchesForDateRange(startDate: string, endDate: string): Promise<TotelepepMatch[]> {
    // Check if Supabase is configured
    if (!isSupabaseConfigured || !supabase) {
      console.log('⚠️ Supabase not configured, returning empty matches array');
      return [];
    }
    
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
        .order('kickoff', { ascending: true });

      if (error) {
        console.error('Error fetching matches for date range from Supabase:', error);
        return [];
      }

      return data.map(match => this.convertToTotelepepMatch(match));
    } catch (error) {
      console.error('Error fetching matches for date range from Supabase:', error);
      return [];
    }
  }
  
  // Get match counts by date
  async getMatchCountsByDate(): Promise<Record<string, number>> {
    // Check if Supabase is configured
    if (!isSupabaseConfigured || !supabase) {
      console.log('⚠️ Supabase not configured, returning empty counts');
      return {};
    }
    
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('date');
      
      if (error) {
        console.error('Error fetching match counts from Supabase:', error);
        return {};
      }
      
      // Count matches by date
      const counts: Record<string, number> = {};
      data.forEach(item => {
        counts[item.date] = (counts[item.date] || 0) + 1;
      });
      
      return counts;
    } catch (error) {
      console.error('Error fetching match counts from Supabase:', error);
      return {};
    }
  }
  
  // Completely reset the matches table
  async resetMatchesTable(): Promise<boolean> {
    // Check if Supabase is configured
    if (!isSupabaseConfigured || !supabase) {
      console.log('⚠️ Supabase not configured, cannot reset matches table');
      return false;
    }
    
    try {
      console.log('🗑️ Completely resetting matches table...');
      
      // First, let's check how many records we have
      console.log('🔍 Checking initial record count...');
      const { count: initialCount, error: countError } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.error('Error getting initial count:', countError);
        return false;
      }
      
      console.log(`📊 Initial record count: ${initialCount ?? 0}`);
      
      // If there are no records, we're already reset
      if (!initialCount || initialCount === 0) {
        console.log('✅ Matches table is already empty');
        return true;
      }
      
      // Delete all records using a more reliable approach
      // We'll delete in smaller batches and track actual deletions
      let totalDeleted = 0;
      const batchSize = 50; // Smaller batch size for better control
      
      console.log(`🗑️ Deleting ${initialCount} records in batches of ${batchSize}...`);
      
      // Continue deleting while we still have records to delete
      let recordsRemaining = initialCount ?? 0;
      let iteration = 0;
      const maxIterations = Math.ceil((initialCount ?? 0) / batchSize) + 10; // Add buffer to prevent infinite loop
      
      while (recordsRemaining > 0 && iteration < maxIterations) {
        iteration++;
        console.log(`🔄 Iteration ${iteration}, records remaining: ${recordsRemaining}`);
        
        // Get a batch of record IDs to delete
        console.log(`🔍 Fetching up to ${batchSize} records to delete...`);
        const { data: recordsToDelete, error: fetchError } = await supabase
          .from('matches')
          .select('id')
          .limit(batchSize);
        
        if (fetchError) {
          console.error('Error fetching records to delete:', fetchError);
          return false;
        }
        
        console.log(`📥 Fetched ${recordsToDelete.length} records to delete`);
        
        // If no records to delete, break
        if (recordsToDelete.length === 0) {
          console.log('ℹ️ No more records to delete, breaking loop');
          break;
        }
        
        // Extract IDs
        const idsToDelete = recordsToDelete.map(record => record.id);
        console.log(`📋 IDs to delete:`, idsToDelete);
        
        // Delete the batch
        console.log(`🗑️ Deleting ${idsToDelete.length} records...`);
        const { data: deleteData, error: deleteError } = await supabase
          .from('matches')
          .delete()
          .in('id', idsToDelete);
        
        if (deleteError) {
          console.error(`Error deleting batch:`, deleteError);
          return false;
        }
        
        console.log(`📤 Delete operation result:`, deleteData);
        
        const recordsDeletedInBatch = idsToDelete.length;
        totalDeleted += recordsDeletedInBatch;
        recordsRemaining -= recordsDeletedInBatch;
        console.log(`✅ Deleted ${recordsDeletedInBatch} records in this batch (${totalDeleted}/${initialCount} total)`);
        
        // Add a small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Final verification
      console.log('🔍 Performing final verification...');
      const { count: finalCount, error: finalCountError } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true });
      
      if (finalCountError) {
        console.error('Error getting final count:', finalCountError);
      } else {
        console.log(`📊 Final record count: ${finalCount ?? 0}`);
        console.log(`📊 Expected: 0, Actual: ${finalCount ?? 0}, Difference: ${finalCount ?? 0}`);
      }
      
      console.log(`✅ Matches table reset successfully. Deleted ${totalDeleted} records`);
      return true;
    } catch (error) {
      console.error('Error resetting matches table:', error);
      return false;
    }
  }
}

// Export the service instance or null if Supabase is not configured
export const supabaseService = isSupabaseConfigured ? new SupabaseService() : null;

// Log service initialization status
console.log(' Supabase service initialization status:');
console.log('  supabaseService:', supabaseService);

// Also attach to window for debugging
if (typeof window !== 'undefined') {
  (window as any).supabaseService = supabaseService;
  console.log(' Supabase service attached to window object for debugging');
}
