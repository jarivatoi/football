import { supabaseService } from './services/supabaseService';

async function clearOldMatchesManually() {
  console.log('🧹 Manually clearing old matches...');
  
  if (supabaseService) {
    try {
      await supabaseService.clearOldMatches();
      console.log('✅ Finished clearing old matches');
    } catch (error) {
      console.error('❌ Error clearing old matches:', error);
    }
  } else {
    console.log('⚠️ Supabase service not available');
  }
}

clearOldMatchesManually();