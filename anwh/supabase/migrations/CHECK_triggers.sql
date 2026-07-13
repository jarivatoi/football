-- Check for triggers on staff_users table
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'staff_users';

-- List all functions that might be resetting roster_display_name
SELECT 
    proname as function_name,
    prosrc as source_code
FROM pg_proc
WHERE proname LIKE '%roster%' 
   OR proname LIKE '%display%';
