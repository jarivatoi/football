import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zaleugflzamrkrfkrcsa.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphbGV1Z2ZsemFtcmtyZmtyY3NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NTE5NjgsImV4cCI6MjA3NjIyNzk2OH0.2UDcqZ-QKujOBIZR9wZT8HiQy4supXvSGVO6p-Y1WRk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
