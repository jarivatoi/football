import { totelepepService } from './totelepepService';
import { supabaseService } from './supabaseService';

class ContinuousSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;

  // Start continuous synchronization
  startContinuousSync() {
    // Check if Supabase is configured
    if (!supabaseService) {
      console.log('⚠️ Supabase not configured, continuous sync disabled');
      return;
    }
    
    console.log('🔄 Starting continuous synchronization');
    
    // Run immediately on start
    this.syncAllMatches();
    
    // Then run every 30 minutes (1800000 ms)
    this.syncInterval = setInterval(() => {
      this.syncAllMatches();
    }, 1800000);
  }

  // Stop continuous synchronization
  stopContinuousSync() {
    console.log('⏹️ Stopping continuous synchronization');
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Sync all matches from all available dates
  private async syncAllMatches() {
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
      console.log('🔄 Starting continuous sync of all matches...');
      
      // Clear cache to ensure we get fresh data
      totelepepService.clearCache();
      
      // Set flag to indicate manual sync to ensure cache is cleared
      if (typeof window !== 'undefined') {
        (window as any).manualSyncInProgress = true;
      }
      
      // Use the totelepepService to fetch all matches
      await totelepepService.fetchAndStoreAllMatches();
      
      console.log('✅ Continuous sync completed successfully');
    } catch (error) {
      console.error('❌ Error during continuous sync:', error);
    } finally {
      // Clear flag when done
      if (typeof window !== 'undefined') {
        (window as any).manualSyncInProgress = false;
      }
      this.isSyncing = false;
    }
  }

  // Manual trigger for continuous sync
  async triggerManualSync() {
    console.log('🔄 Manual continuous sync triggered');
    await this.syncAllMatches();
  }
}

export const continuousSyncService = new ContinuousSyncService();