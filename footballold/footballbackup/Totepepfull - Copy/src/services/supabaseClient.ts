import { createClient } from '@supabase/supabase-js';

// These should be set in your environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Log environment variables (without exposing sensitive data)
console.log(' Supabase environment variables:');
console.log('  VITE_SUPABASE_URL:', SUPABASE_URL ? 'SET' : 'NOT SET');
console.log('  VITE_SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');

// Create a single supabase client for the entire application
// Only create the client if both URL and key are provided
export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY'
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Log the created client
console.log(' Supabase client creation result:');
console.log('  supabase:', supabase);

// Also attach to window for debugging
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
  console.log(' Supabase client attached to window object for debugging');
}