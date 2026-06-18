import { supabaseService } from './services/supabaseService';

async function debugSupabase() {
  console.log('🔍 Debugging Supabase database...');
  
  if (supabaseService) {
    try {
      // Get total match count
      const totalMatches = await supabaseService.getMatchCount();
      console.log(`📊 Total matches in Supabase: ${totalMatches}`);
      
      // Get sample dates
      const allMatches = await supabaseService.getAllMatches();
      console.log(`📊 Total matches fetched: ${allMatches.length}`);
      
      // Group matches by date
      const matchesByDate: Record<string, number> = {};
      allMatches.forEach(match => {
        const date = match.date || 'unknown';
        matchesByDate[date] = (matchesByDate[date] || 0) + 1;
      });
      
      console.log('📅 Matches by date:');
      Object.entries(matchesByDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([date, count]) => {
          console.log(`   ${date}: ${count} matches`);
        });
      
      // Check specifically for 2025-10-17
      const matchesOn17Oct2025 = allMatches.filter(match => match.date === '2025-10-17');
      console.log(`📅 Matches on 2025-10-17: ${matchesOn17Oct2025.length}`);
      
      // Try to manually clear old matches
      console.log('🧹 Attempting to clear old matches...');
      await supabaseService.clearOldMatches();
      
    } catch (error) {
      console.error('❌ Error debugging Supabase:', error);
    }
  } else {
    console.log('⚠️ Supabase service not available');
  }
}

debugSupabase();