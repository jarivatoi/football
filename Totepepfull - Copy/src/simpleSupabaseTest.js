// Simple test script to verify Supabase operations
// This can be run directly in the browser console

console.log('🔍 Starting Supabase test...');

// Check if Supabase service is available
if (typeof window.supabaseService === 'undefined' || window.supabaseService === null) {
  console.error('❌ Supabase service not available. Make sure the app is loaded.');
} else {
  console.log('✅ Supabase service is available');
  
  // Test function
  async function runSupabaseTests() {
    try {
      // Test 1: Get current match count
      console.log('\n--- Test 1: Current match count ---');
      const initialCount = await window.supabaseService.getMatchCount();
      console.log(`✅ Initial match count: ${initialCount}`);
      
      // Test 2: Get match counts by date
      console.log('\n--- Test 2: Match counts by date ---');
      const dateCounts = await window.supabaseService.getMatchCountsByDate();
      console.log('📊 Match counts by date:', dateCounts);
      
      // Test 3: Try to reset the table
      console.log('\n--- Test 3: Resetting matches table ---');
      const resetSuccess = await window.supabaseService.resetMatchesTable();
      if (resetSuccess) {
        console.log('✅ Successfully reset matches table');
      } else {
        console.error('❌ Failed to reset matches table');
      }
      
      // Test 4: Get match count after reset
      console.log('\n--- Test 4: Match count after reset ---');
      const afterResetCount = await window.supabaseService.getMatchCount();
      console.log(`✅ Match count after reset: ${afterResetCount}`);
      
      // Test 5: Try to insert a test match
      console.log('\n--- Test 5: Inserting test match ---');
      const testMatch = {
        id: 'test_' + Date.now(),
        homeTeam: 'Test Home Team',
        awayTeam: 'Test Away Team',
        league: 'Test League',
        date: new Date().toISOString().split('T')[0],
        kickoff: '15:00',
        status: 'upcoming',
        competitionId: 'test_competition'
      };
      
      const storeSuccess = await window.supabaseService.storeMatches([testMatch]);
      if (storeSuccess) {
        console.log('✅ Successfully stored test match');
      } else {
        console.error('❌ Failed to store test match');
      }
      
      // Test 6: Get match count after insertion
      console.log('\n--- Test 6: Match count after insertion ---');
      const afterInsertCount = await window.supabaseService.getMatchCount();
      console.log(`✅ Match count after insertion: ${afterInsertCount}`);
      
      console.log('\n🎉 All tests completed!');
      console.log(`📊 Summary: Started with ${initialCount} matches, reset to ${afterResetCount}, ended with ${afterInsertCount} matches`);
      
    } catch (error) {
      console.error('❌ Error during tests:', error);
    }
  }
  
  // Run the tests
  runSupabaseTests();
}