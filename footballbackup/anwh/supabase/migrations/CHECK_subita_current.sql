[
  {
    "name": "Viraj",
    "roster_display_name": "NARAYYA"
  }
]-- Just SELECT current values for Subita
SELECT 
    id,
    name,
    surname,
    id_number,
    institution_code,
    roster_display_name,
    is_active
FROM staff_users
WHERE name = 'Subita' AND surname = 'NARAYYA';
