import { totelepepService } from './totelepepService';
import { supabaseService } from './supabaseService';

class RealTimeSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private subscription: any = null;
  private continuousSyncInterval: NodeJS.Timeout | null = null;

  // Start real-time synchronization
  startRealTimeSync() {
    // Check if Supabase is configured
    if (!supabaseService) {
      console.log('⚠️ Supabase not configured, real-time sync disabled');
      return;
    }
    
    console.log('🔄 Starting real-time synchronization');
    
    // Start background sync
    this.startBackgroundSync();
    
    // Start continuous sync for all days
    this.startContinuousSync();
    
    // Subscribe to real-time updates
    this.subscribeToRealTimeUpdates();
  }

  // Stop real-time synchronization
  stopRealTimeSync() {
    console.log('⏹️ Stopping real-time synchronization');
    
    // Stop background sync
    this.stopBackgroundSync();
    
    // Stop continuous sync
    this.stopContinuousSync();
    
    // Unsubscribe from real-time updates
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  // Start background synchronization (every 2 minutes)
  private startBackgroundSync() {
    if (this.syncInterval) {
      console.log('⚠️ Background sync already running');
      return;
    }

    console.log('🔄 Starting background sync every 2 minutes');
    
    // Run immediately on start
    this.syncData();
    
    // Then run every 2 minutes (120000 ms)
    this.syncInterval = setInterval(() => {
      this.syncData();
    }, 120000);
  }

  // Stop background synchronization
  private stopBackgroundSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏹️ Background sync stopped');
    }
  }

  // Start continuous synchronization for all days (every 30 minutes)
  private startContinuousSync() {
    if (this.continuousSyncInterval) {
      console.log('⚠️ Continuous sync already running');
      return;
    }

    console.log('🔄 Starting continuous sync for all days every 30 minutes');
    
    // Run every 30 minutes (1800000 ms)
    this.continuousSyncInterval = setInterval(() => {
      this.syncAllDaysData();
    }, 1800000);
  }

  // Stop continuous synchronization
  private stopContinuousSync() {
    if (this.continuousSyncInterval) {
      clearInterval(this.continuousSyncInterval);
      this.continuousSyncInterval = null;
      console.log('⏹️ Continuous sync stopped');
    }
  }

  // Subscribe to real-time updates from Supabase
  private subscribeToRealTimeUpdates() {
    // Check if Supabase is configured
    if (!supabaseService) {
      console.log('⚠️ Supabase not configured, real-time updates disabled');
      return;
    }
    
    this.subscription = supabaseService.subscribeToMatchUpdates((payload) => {
      console.log('📡 Real-time update received:', payload);
      // Handle real-time updates here
      // Extract date information from the payload if available
      let updateDate = null;
      if (payload && payload.new && payload.new.date) {
        updateDate = payload.new.date;
      } else if (payload && payload.old && payload.old.date) {
        updateDate = payload.old.date;
      } else if (payload && payload.new && payload.new.created_at) {
        // Try to extract date from created_at timestamp
        try {
          updateDate = new Date(payload.new.created_at).toISOString().split('T')[0];
        } catch (e) {
          console.warn('⚠️ Could not parse date from created_at:', payload.new.created_at);
        }
      } else if (payload && payload.old && payload.old.created_at) {
        // Try to extract date from created_at timestamp
        try {
          updateDate = new Date(payload.old.created_at).toISOString().split('T')[0];
        } catch (e) {
          console.warn('⚠️ Could not parse date from created_at:', payload.old.created_at);
        }
      }
      
      // Emit event with date information
      window.dispatchEvent(new CustomEvent('matchUpdate', { 
        detail: { 
          payload, 
          date: updateDate 
        } 
      }));
    });
  }

  // Sync data from Totelepep to Supabase (improved implementation)
  private async syncData() {
    // Check if Supabase is configured
    if (!supabaseService) {
      console.log('⚠️ Supabase not configured, data sync disabled');
      return;
    }
    
    // Prevent multiple simultaneous syncs
    if (this.isSyncing) {
      console.log('⚠️ Sync already in progress, skipping');
      return;
    }

    this.isSyncing = true;
    
    try {
      console.log('🔄 Starting data sync from Totelepep to Supabase...');
      const today = new Date().toISOString().split('T')[0];
      console.log(`📅 Today's date: ${today}`);
      
      // Clear cache to ensure we get fresh data
      totelepepService.clearCache();
      
      // Get all available dates from Totelepep calendar list
      let allMatches: any[] = [];
      const datesWithZeroMatches: string[] = []; // Track dates with zero matches
      
      // Fetch matches for all dates that have matches
      console.log('🔍 Fetching matches for all dates with matches...');
      const calendarList = await totelepepService.getCalendarList();
      console.log(`📅 Found ${calendarList.length} dates in calendar list`);
      console.log(`📅 Calendar list contents:`, JSON.stringify(calendarList, null, 2));
      
      if (calendarList && calendarList.length > 0) {
        console.log(`🔄 Fetching matches for all dates from calendar list...`);
        for (const calendarEntry of calendarList) {
          try {
            // Extract date in YYYY-MM-DD format from the calendar entry
            let dateToFetch = calendarEntry.entryDate;
            if (dateToFetch && typeof dateToFetch === 'string') {
              // If it's an ISO date string, extract just the date part
              if (dateToFetch.includes('T')) {
                dateToFetch = dateToFetch.split('T')[0];
              }
            }
            
            console.log(`🔍 Fetching matches for ${dateToFetch} (expected ${calendarEntry.matchCount} matches)...`);
            console.log(`📄 Calendar entry details:`, calendarEntry);
            const matches = await totelepepService.getMatches(dateToFetch);
            console.log(`✅ Fetched ${matches.length} matches for ${dateToFetch}`);
            if (matches.length > 0) {
              console.log(`📄 Sample matches for ${dateToFetch}:`, matches.slice(0, 3));
              allMatches.push(...matches);
            } else {
              console.log(`⚠️ No matches found for ${dateToFetch}, even though calendar said ${calendarEntry.matchCount} matches`);
              // Track dates with zero matches
              datesWithZeroMatches.push(dateToFetch);
            }
          } catch (error) {
            console.warn(`⚠️ Error fetching matches for date ${calendarEntry.entryDate}:`, error);
          }
        }
      } else {
        // Fallback to fetching next 8 days if calendar list is empty
        console.log('⚠️ Calendar list empty, falling back to fetching next 8 days...');
        const dates = this.getNextNDates(8);
        
        for (const date of dates) {
          try {
            console.log(`🔍 Fetching matches for ${date}...`);
            const matches = await totelepepService.getMatches(date);
            console.log(`✅ Fetched ${matches.length} matches for ${date}`);
            if (matches.length > 0) {
              console.log(`📄 Sample matches for ${date}:`, matches.slice(0, 3));
              allMatches.push(...matches);
            } else {
              console.log(`⚠️ No matches found for ${date}`);
              // Track dates with zero matches
              datesWithZeroMatches.push(date);
            }
          } catch (error) {
            console.warn(`⚠️ Error fetching matches for ${date}:`, error);
          }
        }
      }
      
      console.log(`📊 Total matches fetched: ${allMatches.length}`);
      console.log(`📊 Dates with zero matches:`, datesWithZeroMatches);
      if (allMatches.length > 0) {
        console.log(`📄 Sample of all matches:`, allMatches.slice(0, 5));
      }
      
      // Remove duplicates by ID to prevent issues when storing in Supabase
      const uniqueMatches = allMatches.filter((match, index, self) => 
        index === self.findIndex(m => m.id === match.id)
      );
      
      console.log(`📊 After deduplication: ${uniqueMatches.length} unique matches`);
      
      // Store in Supabase - this will also clear old matches
      console.log(`🔄 Storing ${uniqueMatches.length} matches in Supabase...`);
      const success = await supabaseService.storeMatches(uniqueMatches);
      
      if (success) {
        console.log(`✅ Successfully synced ${uniqueMatches.length} matches to Supabase`);
        
        // If there are dates with zero matches, we should ensure Supabase is updated
        // The storeMatches method already clears old matches, so this should be handled
        if (datesWithZeroMatches.length > 0) {
          console.log(`ℹ️ The following dates have zero matches and should be cleared from Supabase:`, datesWithZeroMatches);
        }
      } else {
        console.error('❌ Failed to store matches in Supabase');
      }
      
    } catch (error) {
      console.error('❌ Error during data sync:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // Sync all days data continuously (new implementation)
  private async syncAllDaysData() {
    // Check if Supabase is configured
    if (!supabaseService) {
      console.log('⚠️ Supabase not configured, data sync disabled');
      return;
    }
    
    // Prevent multiple simultaneous syncs
    if (this.isSyncing) {
      console.log('⚠️ Sync already in progress, skipping continuous sync');
      return;
    }

    this.isSyncing = true;
    
    try {
      console.log('🔄 Starting continuous sync for all days...');
      
      // Get all available dates from Totelepep calendar list
      let allMatches: any[] = [];
      
      // Fetch matches for all dates that have matches
      console.log('🔍 Fetching matches for all dates with matches (continuous sync)...');
      const calendarList = await totelepepService.getCalendarList();
      console.log(`📅 Found ${calendarList.length} dates in calendar list for continuous sync`);
      
      if (calendarList && calendarList.length > 0) {
        console.log(`🔄 Fetching matches for all dates from calendar list (continuous sync)...`);
        for (const calendarEntry of calendarList) {
          try {
            // Extract date in YYYY-MM-DD format from the calendar entry
            let dateToFetch = calendarEntry.entryDate;
            if (dateToFetch && typeof dateToFetch === 'string') {
              // If it's an ISO date string, extract just the date part
              if (dateToFetch.includes('T')) {
                dateToFetch = dateToFetch.split('T')[0];
              }
            }
            
            console.log(`🔍 Fetching matches for ${dateToFetch} (expected ${calendarEntry.matchCount} matches)...`);
            const matches = await totelepepService.getMatches(dateToFetch);
            console.log(`✅ Fetched ${matches.length} matches for ${dateToFetch} (continuous sync)`);
            allMatches.push(...matches);
          } catch (error) {
            console.warn(`⚠️ Error fetching matches for date ${calendarEntry.entryDate} (continuous sync):`, error);
          }
        }
      } else {
        // Fallback to fetching next 14 days if calendar list is empty
        console.log('⚠️ Calendar list empty, falling back to fetching next 14 days (continuous sync)...');
        const dates = this.getNextNDates(14);
        
        for (const date of dates) {
          try {
            console.log(`🔍 Fetching matches for ${date} (continuous sync fallback)...`);
            const matches = await totelepepService.getMatches(date);
            console.log(`✅ Fetched ${matches.length} matches for ${date} (continuous sync fallback)`);
            allMatches.push(...matches);
          } catch (error) {
            console.warn(`⚠️ Error fetching matches for ${date} (continuous sync fallback):`, error);
          }
        }
      }
      
      console.log(`📊 Total matches fetched in continuous sync: ${allMatches.length}`);
      
      if (allMatches.length > 0) {
        // Store in Supabase
        console.log(`🔄 Storing ${allMatches.length} matches in Supabase (continuous sync)...`);
        const success = await supabaseService.storeMatches(allMatches);
        
        if (success) {
          console.log(`✅ Successfully synced ${allMatches.length} matches to Supabase (continuous sync)`);
        } else {
          console.error('❌ Failed to store matches in Supabase (continuous sync)');
        }
      } else {
        console.log('ℹ️ No matches to sync in continuous sync');
      }
      
    } catch (error) {
      console.error('❌ Error during continuous data sync:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // Get next N dates
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

  // Manual sync trigger
  async triggerManualSync() {
    console.log('🔄 Manual sync triggered');
    // Set flag to indicate manual sync
    if (typeof window !== 'undefined') {
      (window as any).manualSyncInProgress = true;
    }
    try {
      await this.syncData();
    } finally {
      // Clear flag when done
      if (typeof window !== 'undefined') {
        (window as any).manualSyncInProgress = false;
      }
    }
  }

  // Check if sync service is available and working
  async isSyncServiceAvailable(): Promise<boolean> {
    // Check if Supabase is configured
    if (!supabaseService) {
      return false;
    }
    
    try {
      // Try a simple query to test connectivity
      const test = await supabaseService.getLastUpdateTime();
      return true;
    } catch (error) {
      console.error('❌ Sync service not available:', error);
      return false;
    }
  }
}

export const realTimeSyncService = new RealTimeSyncService();