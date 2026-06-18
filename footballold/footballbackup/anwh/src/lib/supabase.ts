import { createClient } from '@supabase/supabase-js';

// Supabase configuration - Production values
// Note: Supabase anon key is safe to expose publicly (used in client-side apps)
// Service role key should NEVER be exposed - use Edge Functions for sensitive operations
const supabaseUrl = 'https://cpzxnbhpzsssyhpuhsgh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwenhuYmhwenNzc3locHVoc2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxMjExMDMsImV4cCI6MjA2ODY5NzEwM30.xB3KJ6FYeS5U08We1JqgSajutrdJ3vIvbRZVHmxUACc';

// Service role key - ONLY for admin operations (bypasses RLS)
// ⚠️ WARNING: This key should NOT be in client-side code for production
// TODO: Move sensitive operations to Supabase Edge Functions
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

let supabase: any = null;
let supabaseAdmin: any = null;

// Only initialize if we have valid credentials
if (supabaseUrl && 
    supabaseAnonKey && 
    supabaseUrl.includes('supabase.co') && 
    supabaseAnonKey.length > 50) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false, // Disable session persistence to avoid CORS issues
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        },
        headers: {
          apikey: supabaseAnonKey
        }
      },
      global: {
        fetch: (url, options = {}) => {
          // Add timeout and better error handling to all fetch requests
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          return fetch(url, {
            ...options,
            signal: controller.signal,
          }).finally(() => {
            clearTimeout(timeoutId);
          }).catch(error => {
            if (error.name === 'AbortError') {
              throw new Error('Request timeout - please check your connection');
            }
            throw error;
          });
        }
      }
    });
    
    // Admin client for system-level operations (bypasses RLS)
    // Only initialize if service role key is available (development only)
    if (supabaseServiceRoleKey && supabaseServiceRoleKey.length > 50) {
      supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
        },
        global: {
          fetch: (url, options = {}) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            return fetch(url, {
              ...options,
              signal: controller.signal,
            }).finally(() => {
              clearTimeout(timeoutId);
            }).catch(error => {
              if (error.name === 'AbortError') {
                throw new Error('Request timeout - please check your connection');
              }
              throw error;
            });
          }
        }
      });
      supabaseAdmin = null;
    }
  } catch (error) {
    console.error('⚠️ Supabase initialization failed:', error);
  }
} else {
  console.error('⚠️ Supabase credentials not configured. Please update the hardcoded values in src/lib/supabase.ts');
}

// Export a mock client if Supabase is not available
export { supabase, supabaseAdmin };

type Database = {
  public: {
    Tables: {
      roster_entries: {
        Row: {
          id: string;
          date: string;
          shift_type: string;
          assigned_name: string;
          last_edited_by: string;
          last_edited_at: string;
          created_at: string;
          change_description: string;
          text_color?: string;
        };
        Insert: {
          id?: string;
          date: string;
          shift_type: string;
          assigned_name: string;
          last_edited_by: string;
          last_edited_at: string;
          created_at?: string;
          change_description?: string;
          text_color?: string;
        };
        Update: {
          id?: string;
          date?: string;
          shift_type?: string;
          assigned_name?: string;
          last_edited_by?: string;
          last_edited_at?: string;
          created_at?: string;
          change_description?: string;
          text_color?: string;
        };
      };
    };
  };
};