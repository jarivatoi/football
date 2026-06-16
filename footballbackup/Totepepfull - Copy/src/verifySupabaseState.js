// Script to verify Supabase state and test operations
// Run this in the browser console

console.log('🔍 Verifying Supabase state...');

// Check if Supabase service is available
if (typeof window.supabaseService === 'undefined' || window.supabaseService === null) {
  console.error('❌ Supabase service not available');
} else {
  console.log('✅ Supabase service is available');
  
  // Test current state
  async function verifyState() {
    try {
      console.log('\n--- Current Supabase State ---');
      
      // Get current match count
      const currentCount = await window.supabaseService.getMatchCount();
      console.log(`📊 Current match count: ${currentCount}`);
      
      // Get match counts by date
      const dateCounts = await window.supabaseService.getMatchCountsByDate();
      console.log('📅 Match counts by date:');
      Object.entries(dateCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([date, count]) => {
          console.log(`   ${date}: ${count} matches`);
        });
      
      // Get sample matches
      const sampleMatches = await window.supabaseService.getAllMatches();
      console.log(`📄 Total matches in database: ${sampleMatches.length}`);
      if (sampleMatches.length > 0) {
        console.log('📄 Sample matches (first 3):');
        console.log(JSON.stringify(sampleMatches.slice(0, 3), null, 2));
      }
      
      console.log('\n--- Testing Reset Operation ---');
      console.log('⚠️ This will delete ALL matches from the database!');
      
      // Perform reset
      console.log('🗑️ Resetting matches table...');
      const resetSuccess = await window.supabaseService.resetMatchesTable();
      console.log(`✅ Reset operation result: ${resetSuccess ? 'Success' : 'Failed'}`);
      
      // Verify after reset
      const countAfterReset = await window.supabaseService.getMatchCount();
      console.log(`📊 Match count after reset: ${countAfterReset}`);
      
    } catch (error) {
      console.error('❌ Error verifying Supabase state:', error);
    }
  }
  
  // Run the verification
  verifyState();
  
  console.log('\n💡 To run this script, paste it in the console and press Enter');
}