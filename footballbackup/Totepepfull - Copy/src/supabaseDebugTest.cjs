// Simple JavaScript version of the Supabase debug test
const { supabase } = require('./services/supabaseClient');

async function testSupabaseOperations() {
  console.log('🔍 Testing Supabase operations...');
  
  // Check if Supabase is configured
  if (!supabase) {
    console.error('❌ Supabase is not configured');
    return;
  }
  
  try {
    // Test 1: Check if we can read from the matches table
    console.log('\n--- Test 1: Reading from matches table ---');
    const { data: readData, error: readError, count: readCount } = await supabase
      .from('matches')
      .select('*', { count: 'exact' })
      .limit(5);

    if (readError) {
      console.error('❌ Read error:', readError);
    } else {
      console.log(`✅ Successfully read ${readData?.length || 0} matches (total count: ${readCount || 0})`);
      if (readData && readData.length > 0) {
        console.log('📄 Sample data:', JSON.stringify(readData[0], null, 2));
      }
    }

    // Test 2: Check if we can insert data
    console.log('\n--- Test 2: Inserting test data ---');
    const testMatch = {
      id: 'test_' + Date.now(),
      home_team: 'Test Home Team',
      away_team: 'Test Away Team',
      league: 'Test League',
      date: new Date().toISOString().split('T')[0],
      kickoff: '15:00',
      status: 'upcoming',
      competition_id: 'test_competition',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: insertData, error: insertError } = await supabase
      .from('matches')
      .insert([testMatch]);

    if (insertError) {
      console.error('❌ Insert error:', insertError);
    } else {
      console.log('✅ Successfully inserted test match');
    }

    // Test 3: Check if we can update data
    console.log('\n--- Test 3: Updating test data ---');
    const { data: updateData, error: updateError } = await supabase
      .from('matches')
      .update({ status: 'live', updated_at: new Date().toISOString() })
      .eq('id', testMatch.id);

    if (updateError) {
      console.error('❌ Update error:', updateError);
    } else {
      console.log('✅ Successfully updated test match');
    }

    // Test 4: Check if we can delete data
    console.log('\n--- Test 4: Deleting test data ---');
    const { data: deleteData, error: deleteError } = await supabase
      .from('matches')
      .delete()
      .eq('id', testMatch.id);

    if (deleteError) {
      console.error('❌ Delete error:', deleteError);
    } else {
      console.log('✅ Successfully deleted test match');
    }

    // Test 5: Test the specific delete operation used in the app
    console.log('\n--- Test 5: Testing specific delete operations ---');
    
    // Test delete with neq condition (used in resetMatchesTable)
    console.log('Testing delete with neq condition...');
    const { error: neqDeleteError } = await supabase
      .from('matches')
      .delete()
      .neq('id', '');
    
    if (neqDeleteError) {
      console.error('❌ neq delete error:', neqDeleteError);
    } else {
      console.log('✅ neq delete operation completed');
    }

    console.log('\n🎉 All tests completed!');
  } catch (error) {
    console.error('❌ Error during tests:', error);
  }
}

// Run the test
testSupabaseOperations();

module.exports = testSupabaseOperations;