/**
 * Generate roster display name with ID-based format
 * Format: SURNAME_IDNUMBER or SURNAME_(INITIALS)_IDNUMBER for duplicates
 */

import { supabase } from '../lib/supabase';

export interface DisplayNameFormat {
  rosterDisplayName: string;
  surname: string;
  idNumber: string;
}

/**
 * Parse roster display name to extract surname and ID
 * Examples:
 * - "NARAYYA_N280881240162C" → {surname: "NARAYYA", idNumber: "N280881240162C"}
 * - "NARAYYA_(V.T)_N280881240162C" → {surname: "NARAYYA", idNumber: "N280881240162C"}
 * - "NARAYYA_(Viraj)_N280881240162C" → {surname: "NARAYYA", idNumber: "N280881240162C"}
 */
export function parseRosterDisplayName(displayName: string): { surname: string; idNumber: string } {
  // Remove (R) suffix if present
  const cleanName = displayName.replace(/\(R\)$/, '');
  
  // Pattern: SURNAME_(OPTIONAL)_IDNUMBER
  // Match from the end - last part after final _ is ID number
  const parts = cleanName.split('_');
  
  if (parts.length < 2) {
    // Fallback: treat entire string as surname
    return { surname: cleanName, idNumber: '' };
  }
  
  // Last part is always ID number
  const idNumber = parts[parts.length - 1];
  
  // Check if second-to-last part is in parentheses (initials or full name)
  const hasMiddlePart = parts.length >= 3 && parts[parts.length - 2].startsWith('(');
  
  if (hasMiddlePart) {
    // First part(s) are surname (could be compound surname)
    const surnameParts = parts.slice(0, parts.length - 2);
    const surname = surnameParts.join('_');
    return { surname, idNumber };
  } else {
    // Simple format: SURNAME_IDNUMBER
    const surname = parts.slice(0, parts.length - 1).join('_');
    return { surname, idNumber };
  }
}

/**
 * Extract surname from assigned name for matching
 * Strips (R), initials, and ID number
 */
export function extractSurnameForMatching(assignedName: string): string {
  const parsed = parseRosterDisplayName(assignedName);
  return parsed.surname;
}

/**
 * Check if this is admin 5274's display name
 */
function isAdmin5274(displayName: string): boolean {
  return displayName.includes('_5274') || displayName.endsWith('5274');
}

/**
 * Format roster display name for UI display
 * Strips ID number, marker prefix (*), but preserves (R) suffix and other annotations
 * SPECIAL: For admin 5274, hides ID with dots for privacy
 * NOTE: Marker prefix is stripped because it's displayed as a separate colored badge in roster cells
 */
export function formatDisplayNameForUI(displayName: string): string {
  // Check if this is admin 5274 - hide ID with dots for privacy
  const hideId = isAdmin5274(displayName);
  
  // Strip marker prefix (*) - it's displayed separately as a colored badge
  const markerMatch = displayName.match(/^(\*+)/);
  const nameWithoutMarker = markerMatch ? displayName.substring(markerMatch[0].length) : displayName;
  
  // Extract (R) suffix if present - keep it for display
  const hasR = nameWithoutMarker.includes('(R)');
  let cleanName = nameWithoutMarker.replace(/\(R\)/g, '').trim();
  
  const parts = cleanName.split('_');
  
  if (parts.length < 2) {
    const result = hasR ? `${cleanName}(R)` : cleanName;
    // If hiding ID, show dots instead
    return hideId ? `•••${hasR ? '(R)' : ''}` : result;
  }
  
  const hasMiddlePart = parts.length >= 3 && parts[parts.length - 2].startsWith('(');
  
  if (hasMiddlePart) {
    const surnameParts = parts.slice(0, parts.length - 2);
    const initials = parts[parts.length - 2];
    const surname = surnameParts.join('_');
    const result = `${surname}${initials}`;  // No space between surname and initials
    // If hiding ID, show dots instead of full name
    return hideId ? `•••${hasR ? '(R)' : ''}` : `${hasR ? `${result}(R)` : result}`;
  } else {
    const surname = parts.slice(0, parts.length - 1).join('_');
    // If hiding ID, show dots instead of full name
    return hideId ? `•••${hasR ? '(R)' : ''}` : `${hasR ? `${surname}(R)` : surname}`;
  }
}

/**
 * Format change description to replace ID-based names with clean display names
 */
export function formatChangeDescription(description: string): string {
  if (!description) return '';
  
  let formattedText = description;
  
  // Pattern to match names in quotes like "NARAYYA_(Viraj)_N280881240162C"
  const nameInQuotesPattern = /"([^"]+)"/g;
  
  formattedText = formattedText.replace(nameInQuotesPattern, (match, name) => {
    const cleanName = formatDisplayNameForUI(name);
    return cleanName; // Remove quotes
  });
  
  // Clean up center and marker format
  // Replace " - Center: XXX Hospital - Marker: **" with " → XXX Hospital"
  formattedText = formattedText.replace(/\s*-\s*Center:\s*[^-]+?\s*-\s*Marker:\s*\*+/g, (centerMatch) => {
    // Extract just the center name
    const centerName = centerMatch.match(/Center:\s*([^-]+)/)?.[1]?.trim();
    return centerName ? ` → ${centerName}` : '';
  });
  
  // If only center (no marker), clean it up too
  formattedText = formattedText.replace(/\s*-\s*Center:\s*([^;-]+)/g, (centerMatch) => {
    const centerName = centerMatch.match(/Center:\s*(.+)/)?.[1]?.trim();
    return centerName ? ` → ${centerName}` : '';
  });
  
  return formattedText;
}

/**
 * Generate unique roster display name for staff member
 * Handles duplicates within same institution
 */
export async function generateRosterDisplayName(params: {
  surname: string;
  name: string;
  idNumber: string;
  institutionCode: string | null;
  currentStaffId?: string;  // Optional: staff ID for exclusion when checking duplicates
}): Promise<string> {
  const { surname, name, idNumber, institutionCode, currentStaffId } = params;
  
  const baseSurname = surname.toUpperCase().trim();
  const formattedId = idNumber.toUpperCase().trim();
  
  try {
    // Check for duplicates in the SAME institution
    const { data: duplicates } = await supabase
      .from('staff_users')
      .select('id, surname, name')
      .eq('surname', baseSurname)
      .eq('institution_code', institutionCode)
      .eq('is_active', true);
    
    if (!duplicates || duplicates.length === 0) {
      // No duplicates - use simple format
      return `${baseSurname}_${formattedId}`;
    }
    
    if (duplicates.length === 1) {
      // Only this person - no suffix needed yet
      return `${baseSurname}_${formattedId}`;
    }
    
    // Multiple duplicates - need to add disambiguation
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0];
    const initials = nameParts.map(p => p.charAt(0).toUpperCase()).join('.');

    // Check if anyone ELSE in the duplicates has the same initial
    const othersWithSameInitial = duplicates.filter((d: any) => {
      const otherNameParts = d.name.trim().split(/\s+/);
      const otherInitial = otherNameParts[0]?.charAt(0).toUpperCase();
      
      // Try to exclude by id_number first, fall back to UUID id if id_number is unavailable
      const isCurrentPerson = d.id_number === idNumber || (!d.id_number && currentStaffId && d.id === currentStaffId);

      return otherInitial === initials && !isCurrentPerson;
    });

    // If others have same initial, skip initials and go straight to full name
    if (othersWithSameInitial.length > 0) {

      const candidateWithFullName = `${baseSurname}_(${firstName})_${formattedId}`;

      return candidateWithFullName;
    }
    
    // No initial collision - try initials format
    const candidateWithInitials = `${baseSurname}_(${initials})_${formattedId}`;
    
    // Check if this initials format is already taken by someone ELSE (not the current person)
    const { data: existingInitials } = await supabase
      .from('staff_users')
      .select('id, roster_display_name')
      .eq('roster_display_name', candidateWithInitials)
      .eq('institution_code', institutionCode)
      .eq('is_active', true)
      .neq('id_number', idNumber)  // Exclude current person by ID number
      .maybeSingle();
    
    if (!existingInitials) {

      return candidateWithInitials;
    }
    
    // Initials taken - check if it's a collision (same initial but different person)

    // Use full first name format
    const candidateWithFullName = `${baseSurname}_(${firstName})_${formattedId}`;
    
    const { data: existingFullName } = await supabase
      .from('staff_users')
      .select('id')
      .eq('roster_display_name', candidateWithFullName)
      .eq('institution_code', institutionCode)
      .eq('is_active', true)
      .neq('id_number', idNumber)  // Exclude current person
      .maybeSingle();
    
    if (!existingFullName) {

      return candidateWithFullName;
    }
    
    // Even full name is taken - add timestamp as final fallback

    const timestamp = Date.now().toString().slice(-6);
    return `${baseSurname}_(${firstName})_${timestamp}_${formattedId}`;
    
  } catch (err) {

    // Fallback to simple format
    return `${baseSurname}_${formattedId}`;
  }
}

/**
 * Update roster_display_name for a single staff member who changed their name
 * Also checks if other staff can be simplified back to SURNAME_IDNUMBER format
 */
export async function updateStaffDisplayName(params: {
  staffId: string;
  oldSurname: string;
  oldName: string;
  newSurname: string;
  newName: string;
  idNumber: string;
  institutionCode: string | null;
}): Promise<string> {
  const { staffId, oldSurname, oldName, newSurname, newName, idNumber, institutionCode } = params;
  
  try {
    // Generate new display name based on new surname/name
    const newDisplayName = await generateRosterDisplayName({
      surname: newSurname,
      name: newName,
      idNumber,
      institutionCode
    });

    return newDisplayName;
    
  } catch (err) {

    throw err;
  }
}

/**
 * Update all staff with same surname in same institution to use proper format
 * Call this when adding new staff or fixing existing records
 */
export async function updateDuplicateDisplayNames(params: {
  surname: string;
  institutionCode: string;
}): Promise<void> {
  const { surname, institutionCode } = params;
  const baseSurname = surname.toUpperCase();
  
  try {
    // Get all active staff with this surname in this institution
    const { data: staffList } = await supabase
      .from('staff_users')
      .select('id, surname, name, id_number, roster_display_name')
      .eq('surname', baseSurname)
      .eq('institution_code', institutionCode)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    
    if (!staffList || staffList.length <= 1) {
      return; // Nothing to update
    }

    // Update each staff member
    for (const staff of staffList) {
      const displayName = await generateRosterDisplayName({
        surname: staff.surname,
        name: staff.name,
        idNumber: staff.id_number,
        institutionCode,
        currentStaffId: staff.id  // Pass the staff's UUID for proper exclusion
      });
      
      await supabase
        .from('staff_users')
        .update({ roster_display_name: displayName })
        .eq('id', staff.id);

    }
    
  } catch (err) {

  }
}
