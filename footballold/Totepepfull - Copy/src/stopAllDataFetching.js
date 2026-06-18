// Script to completely stop all data fetching operations
// Run this in the browser console to pause everything

console.log('🛑 Stopping all data fetching operations...');

// Pause sync operations
if (typeof window.realTimeSyncService !== 'undefined' && window.realTimeSyncService !== null) {
  window.realTimeSyncService.stopRealTimeSync();
  console.log('✅ Real-time sync stopped');
} else {
  console.log('ℹ️ Real-time sync service not available');
}

if (typeof window.continuousSyncService !== 'undefined' && window.continuousSyncService !== null) {
  window.continuousSyncService.stopContinuousSync();
  console.log('✅ Continuous sync stopped');
} else {
  console.log('ℹ️ Continuous sync service not available');
}

// Pause match-specific extractor
if (typeof window.matchSpecificExtractor !== 'undefined' && window.matchSpecificExtractor !== null) {
  if (typeof window.matchSpecificExtractor.pauseScraping === 'function') {
    window.matchSpecificExtractor.pauseScraping();
    console.log('✅ Match-specific scraping paused');
  } else {
    console.log('ℹ️ Match-specific extractor pauseScraping method not available');
  }
} else {
  console.log('ℹ️ Match-specific extractor not available');
}

// Clear caches
if (typeof window.totelepepService !== 'undefined' && window.totelepepService !== null) {
  window.totelepepService.clearCache();
  console.log('✅ Totelepep service cache cleared');
} else {
  console.log('ℹ️ Totelepep service not available');
}

if (typeof window.matchSpecificExtractor !== 'undefined' && window.matchSpecificExtractor !== null) {
  if (typeof window.matchSpecificExtractor.clearCache === 'function') {
    window.matchSpecificExtractor.clearCache();
    console.log('✅ Match-specific extractor cache cleared');
  } else {
    console.log('ℹ️ Match-specific extractor clearCache method not available');
  }
} else {
  console.log('ℹ️ Match-specific extractor not available');
}

console.log('🛑 All data fetching operations stopped!');
console.log('💡 To resume operations, click the "Resume Sync" button in the UI or refresh the page');