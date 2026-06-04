// Supabase Debug Operations Script
// Copy and paste this into your browser console to run tests

console.log('🔍 Supabase Debug Operations Script');
console.log('====================================');

// Check if required services are available
if (typeof window.supabaseService === 'undefined' || window.supabaseService === null) {
  console.error('❌ Supabase service not available. Please make sure the app is fully loaded.');
  console.log('💡 Try refreshing the page and waiting for all data to load before running this script.');
} else {
  console.log('✅ Supabase service is available');
  
  // Debug function
  async function debugSupabaseOperations() {
    try {
      console.log('\n🔍 Starting Supabase Operations Debug...\n');
      
      // Test 1: Get current match count
      console.log('--- Test 1: Current Match Count ---');
      const initialCount = await window.supabaseService.getMatchCount();
      console.log(`📊 Current total matches: ${initialCount}`);
      
      // Test 2: Get match counts by date
      console.log('\n--- Test 2: Match Counts by Date ---');
      const dateCounts = await window.supabaseService.getMatchCountsByDate();
      console.log('📅 Matches by date:');
      Object.entries(dateCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([date, count]) => {
          console.log(`   ${date}: ${count} matches`);
        });
      
      // Test 3: Get all matches (sample)
      console.log('\n--- Test 3: Sample of All Matches ---');
      const allMatches = await window.supabaseService.getAllMatches();
      console.log(`📊 Total matches fetched: ${allMatches.length}`);
      if (allMatches.length > 0) {
        console.log('📄 First 3 matches:');
        console.log(JSON.stringify(allMatches.slice(0, 3), null, 2));
      }
      
      // Test 4: Reset table (be careful with this!)
      console.log('\n--- Test 4: Reset Matches Table ---');
      console.log('⚠️  This will delete ALL matches from the database!');
      console.log('💡 To proceed with reset, uncomment the next lines in the script');
      
      // Uncomment the following lines if you want to actually reset the table:
      /*
      const resetSuccess = await window.supabaseService.resetMatchesTable();
      if (resetSuccess) {
        console.log('✅ Successfully reset matches table');
      } else {
        console.error('❌ Failed to reset matches table');
      }
      
      // Check count after reset
      const afterResetCount = await window.supabaseService.getMatchCount();
      console.log(`📊 Match count after reset: ${afterResetCount}`);
      */
      
      // Test 5: Store a test match
      console.log('\n--- Test 5: Store Test Match ---');
      console.log('💡 To store a test match, uncomment the next lines in the script');
      
      // Uncomment the following lines if you want to store a test match:
      /*
      const testMatch = {
        id: 'debug_test_' + Date.now(),
        homeTeam: 'Debug Home Team',
        awayTeam: 'Debug Away Team',
        league: 'Debug League',
        date: new Date().toISOString().split('T')[0],
        kickoff: '15:00',
        status: 'upcoming',
        competitionId: 'debug_competition'
      };
      
      console.log('📄 Test match to store:', testMatch);
      const storeSuccess = await window.supabaseService.storeMatches([testMatch]);
      if (storeSuccess) {
        console.log('✅ Successfully stored test match');
      } else {
        console.error('❌ Failed to store test match');
      }
      
      // Check count after storing
      const afterStoreCount = await window.supabaseService.getMatchCount();
      console.log(`📊 Match count after storing: ${afterStoreCount}`);
      */
      
      console.log('\n✅ Supabase Operations Debug Completed');
      console.log('====================================');
      
    } catch (error) {
      console.error('❌ Error during Supabase operations debug:', error);
    }
  }
  
  // Make the function available globally
  window.debugSupabaseOperations = debugSupabaseOperations;
  
  console.log('\n💡 To run the debug operations, type in the console:');
  console.log('   debugSupabaseOperations()');
  
  console.log('\n💡 To run specific tests, you can call individual methods like:');
  console.log('   await window.supabaseService.getMatchCount()');
  console.log('   await window.supabaseService.getMatchCountsByDate()');
  console.log('   await window.supabaseService.getAllMatches()');
  
  console.log('\n⚠️  To reset the table or store test data, edit the script to uncomment the relevant sections');
}