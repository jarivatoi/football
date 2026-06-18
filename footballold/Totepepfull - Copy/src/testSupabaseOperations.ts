import { supabaseService } from './services/supabaseService';
import { TotelepepMatch } from './services/totelepepExtractor';

// Test function to verify Supabase operations
async function testSupabaseOperations() {
  console.log('🧪 Testing Supabase operations...');
  
  if (!supabaseService) {
    console.error('❌ Supabase service not available');
    return;
  }
  
  try {
    // Get initial count
    const initialCount = await supabaseService.getMatchCount();
    console.log(`📊 Initial match count: ${initialCount}`);
    
    // Test reset
    console.log('🗑️ Testing reset operation...');
    const resetSuccess = await supabaseService.resetMatchesTable();
    console.log(`✅ Reset operation: ${resetSuccess ? 'Success' : 'Failed'}`);
    
    // Verify reset
    const countAfterReset = await supabaseService.getMatchCount();
    console.log(`📊 Match count after reset: ${countAfterReset}`);
    
    // Test storing sample data
    if (resetSuccess) {
      console.log('💾 Testing store operation with sample data...');
      
      // Create sample matches
      const sampleMatches: TotelepepMatch[] = [
        {
          id: 'test-1',
          homeTeam: 'Test Team A',
          awayTeam: 'Test Team B',
          league: 'Test League',
          date: '2025-10-18',
          kickoff: '15:00',
          status: 'upcoming',
          competitionId: 'test-comp-1',
          homeOdds: '2.10',
          drawOdds: '3.20',
          awayOdds: '3.40',
          overUnder: {
            over: '1.90',
            under: '1.80',
            line: 2.5
          },
          bothTeamsScore: {
            yes: '2.20',
            no: '1.60'
          }
        },
        {
          id: 'test-2',
          homeTeam: 'Test Team C',
          awayTeam: 'Test Team D',
          league: 'Test League',
          date: '2025-10-19',
          kickoff: '18:00',
          status: 'upcoming',
          competitionId: 'test-comp-1',
          homeOdds: '1.80',
          drawOdds: '3.40',
          awayOdds: '4.20',
          overUnder: {
            over: '1.75',
            under: '2.00',
            line: 2.5
          },
          bothTeamsScore: {
            yes: '1.90',
            no: '1.80'
          }
        }
      ];
      
      // Store matches
      const storeSuccess = await supabaseService.storeMatches(sampleMatches);
      console.log(`✅ Store operation: ${storeSuccess ? 'Success' : 'Failed'}`);
      
      // Verify storage
      const countAfterStore = await supabaseService.getMatchCount();
      console.log(`📊 Match count after store: ${countAfterStore}`);
      
      // Get matches by date
      const matchesByDate = await supabaseService.getMatchCountsByDate();
      console.log('📅 Matches by date after store:');
      Object.entries(matchesByDate).forEach(([date, count]) => {
        console.log(`   ${date}: ${count} matches`);
      });
      
      // Clean up - reset again
      console.log('🧹 Cleaning up test data...');
      const finalResetSuccess = await supabaseService.resetMatchesTable();
      console.log(`✅ Cleanup reset: ${finalResetSuccess ? 'Success' : 'Failed'}`);
    }
    
    console.log('✅ Supabase operations test completed');
  } catch (error) {
    console.error('❌ Error during Supabase operations test:', error);
  }
}

// Run the test
testSupabaseOperations();