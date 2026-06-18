/**
 * Anonymous User Management
 * Handles creation and matching of anonymous user placeholders during PDF import
 */

/**
 * Extract surname from full name, handling (R) suffix correctly
 * 
 * Rules:
 * - NARAYYA(R) → NARAYYA (strip variant suffix)
 * - NARAYYA_(R) → NARAYYA_(R) (keep if underscore before)
 * - NARAYYA_(V.T)(R) → NARAYYA_(V.T) (strip (R) but keep qualification)
 * - NARAYYA_(V.T) → NARAYYA_(V.T) (no change)
 * 
 * @param fullName - Full name from PDF (e.g., "NARAYYA, Viraj(R)")
 * @returns Surname without (R) variant suffix
 */
export function extractSurname(fullName: string): string {
  if (!fullName) return '';
  
  // Get the surname part (before comma if exists)
  const surnamePart = fullName.split(',')[0].trim();
  
  // Pattern to match (R) at the end that is NOT preceded by underscore
  // This matches: NARAYYA(R), NARAYYA_(V.T)(R)
  // But NOT: NARAYYA_(R)
  const result = surnamePart.replace(/([A-Z])\(R\)$/, '$1');
  
  console.log(`📝 Extract surname: "${fullName}" → "${result}"`);
  return result;
}

/**
 * Generate a placeholder ID with 14 X's
 * 
 * Format: SURNAME_XXXXXXXXXXXXXX (14 X's)
 * 
 * @param surname - The surname (e.g., "NARAYYA")
 * @returns Placeholder ID (e.g., "NARAYYA_XXXXXXXXXXXXXX")
 */
export function generatePlaceholderId(surname: string): string {
  const cleanSurname = extractSurname(surname);
  const placeholder = `${cleanSurname}_XXXXXXXXXXXXXX`; // 14 X's
  
  console.log(`🆔 Generate placeholder ID: "${surname}" → "${placeholder}"`);
  return placeholder;
}

/**
 * Check if an ID is a placeholder (anonymous)
 * 
 * @param idNumber - The ID to check
 * @returns True if it's a placeholder ID
 */
export function isPlaceholderId(idNumber: string): boolean {
  return /^.+_X{14}$/.test(idNumber);
}

/**
 * Check if a roster display name represents an anonymous placeholder
 * This is used to hide placeholders from regular staff view
 * 
 * @param rosterDisplayName - The roster_display_name to check
 * @returns True if it's an anonymous placeholder
 */
export function isAnonymousPlaceholder(rosterDisplayName: string): boolean {
  const cleanName = rosterDisplayName.replace(/\(R\)$/, '').trim();
  return /_X{14}$/.test(cleanName);
}

/**
 * Extract unique surnames from a list of names
 * Removes duplicates and handles (R) suffixes
 * 
 * @param names - Array of full names from PDF
 * @returns Array of unique surnames
 */
export function extractUniqueSurnames(names: string[]): string[] {
  const surnameSet = new Set<string>();
  
  names.forEach(name => {
    const surname = extractSurname(name);
    if (surname) {
      surnameSet.add(surname);
    }
  });
  
  const result = Array.from(surnameSet);
  console.log(`📋 Extracted ${result.length} unique surnames:`, result);
  return result;
}

/**
 * Match a PDF surname against database entries
 * Matches both regular IDs and placeholder IDs
 * 
 * Examples:
 * - "NARAYYA" matches "NARAYYA_123456789012" (real user)
 * - "NARAYYA" matches "NARAYYA_XXXXXXXXXXXXXX" (anonymous placeholder)
 * - "NARAYYA_(V.T)" matches "NARAYYA_(V.T)_XXXXXXXXXXXXXX"
 * 
 * @param pdfSurname - Surname from PDF
 * @param dbEntry - Database entry (roster_display_name or full staff_users record)
 * @returns True if there's a match
 */
export function matchAnonymousUser(pdfSurname: string, dbEntry: string): boolean {
  const cleanPdfSurname = extractSurname(pdfSurname);
  
  // Extract surname from DB entry (remove ID part)
  // Format: SURNAME_ID or SURNAME_QUALIFICATION_ID
  // We need to get everything before the last underscore followed by 14 chars
  const dbMatch = dbEntry.match(/^(.+)_([A-Z0-9]{14})$/);
  
  if (!dbMatch) {
    // No ID format, direct comparison
    return cleanPdfSurname === dbEntry;
  }
  
  const dbSurname = dbMatch[1]; // Everything before the ID
  
  console.log(`🔍 Match check: PDF="${cleanPdfSurname}" vs DB="${dbSurname}" → ${cleanPdfSurname === dbSurname}`);
  return cleanPdfSurname === dbSurname;
}

/**
 * Convert placeholder ID to real ID when user registers
 * 
 * @param placeholderId - Current placeholder ID (e.g., "NARAYYA_XXXXXXXXXXXXXX")
 * @param realIdNumber - Real ID number from registration
 * @returns New ID with real number (e.g., "NARAYYA_123456789012")
 */
export function convertPlaceholderToReal(placeholderId: string, realIdNumber: string): string {
  if (!isPlaceholderId(placeholderId)) {
    return placeholderId; // Not a placeholder, return as-is
  }
  
  // Extract surname part (remove the XXXXXXXXXXXXXX)
  const surname = placeholderId.replace(/_X{14}$/, '');
  
  // Pad real ID to 14 digits if needed
  const paddedId = realIdNumber.padStart(14, '0');
  
  const newId = `${surname}_${paddedId}`;
  console.log(`🔄 Convert placeholder: "${placeholderId}" + "${realIdNumber}" → "${newId}"`);
  return newId;
}

/**
 * Create anonymous placeholder users in Supabase
 * 
 * @param surnames - Array of surnames to create placeholders for
 * @param institutionCode - Institution code for the placeholders
 * @returns Object with success status and created users
 */
export async function createAnonymousPlaceholders(
  surnames: string[],
  institutionCode: string
): Promise<{
  success: boolean;
  created: Array<{ surname: string; placeholderId: string }>;
  errors: Array<{ surname: string; error: string }>;
}> {
  const { supabase } = await import('../lib/supabase');
  
  const created: Array<{ surname: string; placeholderId: string }> = [];
  const errors: Array<{ surname: string; error: string }> = [];
  
  for (const surname of surnames) {
    try {
      const placeholderId = generatePlaceholderId(surname);
      
      // Check if already exists
      const { data: existing } = await supabase
        .from('staff_users')
        .select('id')
        .eq('surname', surname)
        .eq('institution_code', institutionCode)
        .single();
      
      if (existing) {
        console.log(`⚠️ Surname ${surname} already exists, skipping`);
        continue;
      }
      
      // Create anonymous placeholder
      const { data, error } = await supabase
        .from('staff_users')
        .insert({
          surname: surname,
          name: 'Anonymous',
          id_number: placeholderId,
          institution_code: institutionCode,
          is_anonymous: true,
          is_pending_registration: false,
          is_active: true,
          roster_display_name: placeholderId
        })
        .select()
        .single();
      
      if (error) {
        console.error(`❌ Failed to create placeholder for ${surname}:`, error);
        errors.push({ surname, error: error.message });
      } else {
        console.log(`✅ Created anonymous placeholder: ${surname} → ${placeholderId}`);
        created.push({ surname, placeholderId });
      }
    } catch (error) {
      console.error(`❌ Error creating placeholder for ${surname}:`, error);
      errors.push({ 
        surname, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
  
  return {
    success: errors.length === 0,
    created,
    errors
  };
}

/**
 * Search for anonymous placeholder by surname and convert to real user
 * 
 * @param surname - Surname to search for
 * @param realIdNumber - Real ID number from registration
 * @param realName - Real name from registration
 * @returns Object with success status and updated user info
 */
export async function convertAnonymousToReal(
  surname: string,
  realIdNumber: string,
  realName: string
): Promise<{
  success: boolean;
  updated: boolean;
  previousPlaceholderId?: string;
  newId?: string;
  error?: string;
}> {
  const { supabase } = await import('../lib/supabase');
  
  try {
    // Search for anonymous placeholder with matching surname
    const { data: placeholder, error: fetchError } = await supabase
      .from('staff_users')
      .select('*')
      .eq('surname', surname)
      .eq('is_anonymous', true)
      .single();
    
    if (fetchError || !placeholder) {
      console.log(`ℹ️ No anonymous placeholder found for ${surname}`);
      return { success: true, updated: false };
    }
    
    // Found placeholder - update it
    const newId = convertPlaceholderToReal(placeholder.id_number, realIdNumber);
    const newRosterDisplayName = newId; // Use same format
    
    const { error: updateError } = await supabase
      .from('staff_users')
      .update({
        id_number: newId,
        roster_display_name: newRosterDisplayName,
        name: realName,
        is_anonymous: false,
        is_pending_registration: false,
        is_active: true
      })
      .eq('id', placeholder.id);
    
    if (updateError) {
      console.error(`❌ Failed to update placeholder:`, updateError);
      return { 
        success: false, 
        updated: false, 
        error: updateError.message,
        previousPlaceholderId: placeholder.id_number
      };
    }
    
    console.log(`✅ Converted anonymous to real: ${placeholder.id_number} → ${newId}`);
    return {
      success: true,
      updated: true,
      previousPlaceholderId: placeholder.id_number,
      newId
    };
  } catch (error) {
    console.error(`❌ Error converting anonymous user:`, error);
    return {
      success: false,
      updated: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
