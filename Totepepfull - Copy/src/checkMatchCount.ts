import { supabase } from './services/supabaseClient';

async function checkMatchCount() {
  try {
    if (!supabase) {
      console.log('⚠️ Supabase not configured');
      return;
    }

    const { count, error } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error fetching match count:', error);
      return;
    }

    console.log(`📊 Total matches in Supabase: ${count}`);
    return count;
  } catch (error) {
    console.error('Error checking match count:', error);
  }
}

// Run the function
checkMatchCount();