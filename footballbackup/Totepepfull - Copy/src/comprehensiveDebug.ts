import { supabase } from './services/supabaseClient';

async function comprehensiveDebug() {
  console.log('🔍 Starting comprehensive Supabase debug...');
  
  // Check if Supabase is configured
  if (!supabase) {
    console.log('⚠️ Supabase not configured');
    return;
  }
  
  try {
    // 1. Get total count of all matches
    const { count: totalCount, error: countError } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Error getting total count:', countError);
      return;
    }
    
    const actualTotalCount = totalCount || 0;
    console.log(`📊 Total matches in Supabase: ${actualTotalCount}`);
    
    // 2. Get all unique dates and their counts
    const { data: dateData, error: dateError } = await supabase
      .from('matches')
      .select('date');
    
    if (dateError) {
      console.error('Error fetching dates:', dateError);
      return;
    }
    
    // Count matches by date
    const dateCounts: Record<string, number> = {};
    dateData.forEach(item => {
      dateCounts[item.date] = (dateCounts[item.date] || 0) + 1;
    });
    
    console.log('📅 All dates and their match counts:');
    Object.entries(dateCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, count]) => {
        console.log(`   ${date}: ${count} matches`);
      });
    
    // 3. Check specifically for today's date
    const today = new Date().toISOString().split('T')[0];
    const todayCount = dateCounts[today] || 0;
    console.log(`\n📅 Today (${today}): ${todayCount} matches`);
    
    // 4. Check for old dates (older than 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoString = sevenDaysAgo.toISOString().split('T')[0];
    
    console.log(`\n📅 Checking for matches older than ${sevenDaysAgoString}:`);
    let oldMatchesCount = 0;
    Object.entries(dateCounts).forEach(([date, count]) => {
      if (date < sevenDaysAgoString) {
        console.log(`   ${date}: ${count} matches (OLD)`);
        oldMatchesCount += count;
      }
    });
    console.log(`📊 Total old matches: ${oldMatchesCount}`);
    
    // 5. Check for future dates (more than 30 days in future)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const thirtyDaysFromNowString = thirtyDaysFromNow.toISOString().split('T')[0];
    
    console.log(`\n📅 Checking for matches more than 30 days in future (${thirtyDaysFromNowString}):`);
    let futureMatchesCount = 0;
    Object.entries(dateCounts).forEach(([date, count]) => {
      if (date > thirtyDaysFromNowString) {
        console.log(`   ${date}: ${count} matches (FUTURE)`);
        futureMatchesCount += count;
      }
    });
    console.log(`📊 Total future matches: ${futureMatchesCount}`);
    
    // 6. Try to manually clear old matches
    console.log('\n🧹 Attempting to clear old matches...');
    
    // Delete matches older than 7 days
    console.log(`Deleting matches older than ${sevenDaysAgoString}...`);
    const { error: deleteOldError } = await supabase
      .from('matches')
      .delete()
      .lt('date', sevenDaysAgoString);
    
    if (deleteOldError) {
      console.error('Error deleting old matches:', deleteOldError);
    } else {
      console.log('✅ Old matches deletion completed');
    }
    
    // Delete matches more than 30 days in future
    console.log(`Deleting matches more than ${thirtyDaysFromNowString}...`);
    const { error: deleteFutureError } = await supabase
      .from('matches')
      .delete()
      .gt('date', thirtyDaysFromNowString);
    
    if (deleteFutureError) {
      console.error('Error deleting future matches:', deleteFutureError);
    } else {
      console.log('✅ Future matches deletion completed');
    }
    
    // 7. Get count after deletion
    const { count: newTotalCount, error: newCountError } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true });
    
    if (newCountError) {
      console.error('Error getting new total count:', newCountError);
      return;
    }
    
    const actualNewTotalCount = newTotalCount || 0;
    console.log(`\n📊 Total matches after cleanup: ${actualNewTotalCount}`);
    console.log(`📊 Matches removed: ${actualTotalCount - actualNewTotalCount}`);
    
  } catch (error) {
    console.error('❌ Error during comprehensive debug:', error);
  }
}

comprehensiveDebug();