// Direct Supabase test script
// Run this in the browser console to test Supabase operations directly

console.log('🔍 Direct Supabase test starting...');

// Check if Supabase is available
if (typeof window.supabase === 'undefined') {
  console.error('❌ Supabase client not available on window object');
} else {
  console.log('✅ Supabase client is available');
  console.log(' Supabase client:', window.supabase);
}

// Check if Supabase service is available
if (typeof window.supabaseService === 'undefined') {
  console.error('❌ Supabase service not available on window object');
} else {
  console.log('✅ Supabase service is available');
  console.log(' Supabase service:', window.supabaseService);
}

// Test function to directly test Supabase operations
async function directSupabaseTest() {
  try {
    console.log('\n--- Direct Supabase Operations Test ---');
    
    // Check if we have access to the Supabase client
    if (!window.supabase) {
      console.error('❌ No Supabase client available');
      return;
    }
    
    // Test 1: Get current match count
    console.log('\n--- Test 1: Current match count ---');
    const { count: initialCount, error: countError } = await window.supabase
      .from('matches')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error getting initial count:', countError);
      return;
    }
    
    console.log(`✅ Initial match count: ${initialCount}`);
    
    // Test 2: Try to get some sample records
    console.log('\n--- Test 2: Fetching sample records ---');
    const { data: sampleData, error: sampleError } = await window.supabase
      .from('matches')
      .select('id, home_team, away_team, date')
      .limit(3);
    
    if (sampleError) {
      console.error('❌ Error fetching sample data:', sampleError);
    } else {
      console.log(`✅ Sample data (${sampleData.length} records):`, sampleData);
    }
    
    // Test 3: Try to delete a few records directly
    console.log('\n--- Test 3: Deleting sample records ---');
    if (sampleData && sampleData.length > 0) {
      const idsToDelete = sampleData.map(record => record.id);
      console.log(`🗑️ Attempting to delete records with IDs:`, idsToDelete);
      
      const { data: deleteData, error: deleteError } = await window.supabase
        .from('matches')
        .delete()
        .in('id', idsToDelete);
      
      if (deleteError) {
        console.error('❌ Error deleting records:', deleteError);
      } else {
        console.log(`✅ Delete operation result:`, deleteData);
        
        // Verify deletion
        const { count: afterDeleteCount, error: afterDeleteError } = await window.supabase
          .from('matches')
          .select('*', { count: 'exact', head: true });
        
        if (afterDeleteError) {
          console.error('❌ Error getting count after deletion:', afterDeleteError);
        } else {
          console.log(`✅ Match count after deletion: ${afterDeleteCount}`);
          console.log(`📊 Deleted ${initialCount - afterDeleteCount} records`);
        }
      }
    }
    
    console.log('\n--- Direct Supabase test completed ---');
  } catch (error) {
    console.error('❌ Error during direct Supabase test:', error);
  }
}

// Make the test function available globally
window.directSupabaseTest = directSupabaseTest;

console.log('💡 To run the test, type "directSupabaseTest()" in the console and press Enter');