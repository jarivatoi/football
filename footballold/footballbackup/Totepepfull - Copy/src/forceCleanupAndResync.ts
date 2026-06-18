import { supabaseService } from './services/supabaseService';
import { totelepepService } from './services/totelepepService';
import { realTimeSyncService } from './services/realTimeSyncService';

async function forceCleanupAndResync() {
  console.log('🚀 Starting force cleanup and resync process...');
  
  try {
    // Step 1: Clear all old matches
    console.log('🧹 Step 1: Clearing old matches...');
    if (supabaseService) {
      await supabaseService.clearOldMatches();
      console.log('✅ Old matches cleared');
    } else {
      console.log('⚠️ Supabase service not available');
      return;
    }
    
    // Step 2: Clear the Totelepep service cache
    console.log('🧹 Step 2: Clearing Totelepep cache...');
    totelepepService.clearCache();
    console.log('✅ Totelepep cache cleared');
    
    // Step 3: Trigger a manual sync
    console.log('🔄 Step 3: Triggering manual sync...');
    if (realTimeSyncService) {
      // Set manual sync flag
      if (typeof window !== 'undefined') {
        (window as any).manualSyncInProgress = true;
      }
      
      await realTimeSyncService.triggerManualSync();
      
      // Clear manual sync flag
      if (typeof window !== 'undefined') {
        (window as any).manualSyncInProgress = false;
      }
      
      console.log('✅ Manual sync completed');
    } else {
      console.log('⚠️ Real-time sync service not available');
    }
    
    // Step 4: Verify the results
    console.log('🔍 Step 4: Verifying results...');
    if (supabaseService) {
      const matchCount = await supabaseService.getMatchCount();
      console.log(`📊 Total matches in Supabase after cleanup: ${matchCount}`);
      
      // Get match counts by date
      const dateCounts = await supabaseService.getMatchCountsByDate();
      console.log('📅 Match counts by date after cleanup:');
      Object.entries(dateCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([date, count]) => {
          console.log(`   ${date}: ${count} matches`);
        });
    }
    
    console.log('🎉 Force cleanup and resync process completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during force cleanup and resync:', error);
  }
}

// Run the function if this script is executed directly
if (typeof window === 'undefined') {
  forceCleanupAndResync();
}

export default forceCleanupAndResync;