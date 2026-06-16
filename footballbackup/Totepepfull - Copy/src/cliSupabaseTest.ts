#!/usr/bin/env ts-node
// CLI Supabase Test Script
// Run with: npx ts-node src/cliSupabaseTest.ts

import { supabaseService } from './services/supabaseService';
import { TotelepepMatch } from './services/totelepepExtractor';

async function runSupabaseTests() {
  console.log('🔍 CLI Supabase Test Script');
  console.log('==========================');
  
  // Check if Supabase service is available
  if (!supabaseService) {
    console.error('❌ Supabase service not available. Check your configuration.');
    process.exit(1);
  }
  
  try {
    console.log('\n🔍 Starting Supabase Operations Test...\n');
    
    // Test 1: Get current match count
    console.log('--- Test 1: Current Match Count ---');
    const initialCount = await supabaseService.getMatchCount();
    console.log(`📊 Current total matches: ${initialCount}`);
    
    // Test 2: Get match counts by date
    console.log('\n--- Test 2: Match Counts by Date ---');
    const dateCounts = await supabaseService.getMatchCountsByDate();
    console.log('📅 Matches by date:');
    Object.entries(dateCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, count]) => {
        console.log(`   ${date}: ${count} matches`);
      });
    
    // Test 3: Get all matches (sample)
    console.log('\n--- Test 3: Sample of All Matches ---');
    const allMatches = await supabaseService.getAllMatches();
    console.log(`📊 Total matches fetched: ${allMatches.length}`);
    if (allMatches.length > 0) {
      console.log('📄 First 3 matches:');
      console.log(JSON.stringify(allMatches.slice(0, 3), null, 2));
    }
    
    // Test 4: Reset table (be careful with this!)
    console.log('\n--- Test 4: Reset Matches Table ---');
    console.log('⚠️  This will delete ALL matches from the database!');
    const answer = await askQuestion('Do you want to proceed with resetting the table? (yes/no): ');
    
    if (answer.toLowerCase() === 'yes') {
      const resetSuccess = await supabaseService.resetMatchesTable();
      if (resetSuccess) {
        console.log('✅ Successfully reset matches table');
      } else {
        console.error('❌ Failed to reset matches table');
      }
      
      // Check count after reset
      const afterResetCount = await supabaseService.getMatchCount();
      console.log(`📊 Match count after reset: ${afterResetCount}`);
    } else {
      console.log('⏭️  Skipping table reset');
    }
    
    // Test 5: Store a test match
    console.log('\n--- Test 5: Store Test Match ---');
    const storeAnswer = await askQuestion('Do you want to store a test match? (yes/no): ');
    
    if (storeAnswer.toLowerCase() === 'yes') {
      const testMatch: TotelepepMatch = {
        id: 'cli_test_' + Date.now(),
        homeTeam: 'CLI Home Team',
        awayTeam: 'CLI Away Team',
        league: 'CLI League',
        date: new Date().toISOString().split('T')[0],
        kickoff: '15:00',
        status: 'upcoming',
        competitionId: 'cli_competition',
        homeOdds: 'N/A',
        drawOdds: 'N/A',
        awayOdds: 'N/A',
        overUnder: { over: 'N/A', under: 'N/A', line: 2.5 },
        bothTeamsScore: { yes: 'N/A', no: 'N/A' },
        marketBookNo: '0',
        marketCode: 'CP',
        marketCount: 0
      };
      
      console.log('📄 Test match to store:', testMatch);
      const storeSuccess = await supabaseService.storeMatches([testMatch]);
      if (storeSuccess) {
        console.log('✅ Successfully stored test match');
      } else {
        console.error('❌ Failed to store test match');
      }
      
      // Check count after storing
      const afterStoreCount = await supabaseService.getMatchCount();
      console.log(`📊 Match count after storing: ${afterStoreCount}`);
    } else {
      console.log('⏭️  Skipping test match storage');
    }
    
    console.log('\n✅ CLI Supabase Test Completed');
    console.log('=============================');
    
  } catch (error) {
    console.error('❌ Error during CLI Supabase test:', error);
    process.exit(1);
  }
}

// Helper function to ask questions in the terminal
function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });
}

// Run the tests
runSupabaseTests();