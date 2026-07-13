-- Check the actual table structure of staff_users
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable,
    is_generated,
    generation_expression
FROM information_schema.columns
WHERE table_name = 'staff_users'
ORDER BY ordinal_position;

-- Check if roster_display_name has any special constraints
SELECT
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = (SELECT oid FROM pg_class WHERE relname = 'staff_users');
