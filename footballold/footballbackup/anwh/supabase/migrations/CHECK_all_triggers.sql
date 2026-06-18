-- Check ALL triggers on staff_users table
SELECT 
    tgname as trigger_name,
    tgenabled as enabled,
    tgevents as events,
    proname as function_name
FROM pg_trigger tg
JOIN pg_proc pr ON tg.tgfoid = pr.oid
JOIN pg_class tbl ON tg.tgrelid = tbl.oid
WHERE tbl.relname = 'staff_users';

-- Check if there are multiple triggers
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing,
    action_orientation
FROM information_schema.triggers
WHERE event_object_table = 'staff_users'
ORDER BY action_order;
