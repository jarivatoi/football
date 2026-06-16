-- Direct test: Update ONE specific record
UPDATE staff_users 
SET roster_display_name = 'NARAYYA_TEST123'
WHERE name = 'Subita' AND surname = 'NARAYYA';

-- Immediate select to verify
SELECT 
    id,
    name,
    surname,
    id_number,
    institution_code,
    roster_display_name,
    is_active
FROM staff_users
WHERE name = 'Subita';

-- Also check if there are multiple Subita records
SELECT COUNT(*) as count, name, surname
FROM staff_users
GROUP BY name, surname
HAVING name = 'Subita';
