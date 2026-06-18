import { hasAttachedCenter, getCenterCount } from './rosterCenterUtils';
import type { RosterEntry } from '../types/roster';

interface AuthCode {
  code: string;
  name: string;
  title?: string;
  employeeId?: string;
  firstName?: string;
  surname?: string;
  salary?: number;
}

// Generate (R) variants for initial auth codes
const initialAuthCodes: AuthCode[] = [
  // Regular Staff - ID-based codes
  { code: 'B165', name: 'BHEKUR', title: 'MIT', salary: 49445, employeeId: 'B1604812300915', firstName: 'Yashdev', surname: 'BHEKUR' },
  { code: 'B196', name: 'BHOLLOORAM', title: 'MIT', salary: 48810, employeeId: 'B1911811805356', firstName: 'Sawan', surname: 'BHOLLOORAM' },
  { code: 'D28B', name: 'DHUNNY', title: 'MIT', salary: 30060, employeeId: 'D280487461277B', firstName: 'Leelarvind', surname: 'DHUNNY' },
  { code: 'D07D', name: 'DOMUN', title: 'SMIT', salary: 59300, employeeId: 'D070273400031D', firstName: 'Sheik Ahmad Shamir', surname: 'DOMUN' },
  { code: 'H301', name: 'FOKEERCHAND', title: 'MIT', salary: 37185, employeeId: 'H3003861200061', firstName: 'Needeema', surname: 'FOKEERCHAND' },
  { code: 'S069', name: 'GHOORAN', title: 'MIT', salary: 48810, employeeId: 'S0607814601039', firstName: 'Bibi Shafinaaz', surname: 'SAMTALLY-GHOORAN' },
  { code: 'H13D', name: 'HOSENBUX', title: 'MIT', salary: 48810, employeeId: 'H130381180129D', firstName: 'Zameer', surname: 'HOSENBUX' },
  { code: 'J149', name: 'JUMMUN', title: 'MIT', salary: 47510, employeeId: 'J1403792600909', firstName: 'Bibi Nawsheen', surname: 'JUMMUN' },
  { code: 'M17G', name: 'MAUDHOO', title: 'MIT', salary: 39470, employeeId: 'M170380260096G', firstName: 'Chandanee', surname: 'MAUDHOO' },
  { code: 'N28C', name: 'NARAYYA', title: 'MIT', salary: 39470, employeeId: 'N280881240162C', firstName: 'Viraj', surname: 'NARAYYA' },
  { code: 'P09A', name: 'PITTEA', title: 'SMIT', salary: 59300, employeeId: 'P091171190413A', firstName: 'Soubiraj', surname: 'PITTEA' },
  { code: 'R16G', name: 'RUNGADOO', title: 'SMIT', salary: 59300, employeeId: 'R210572400118G', firstName: 'Manee', surname: 'RUNGADOO' },
  { code: 'T16G', name: 'TEELUCK', title: 'SMIT', salary: 59300, employeeId: '', firstName: '', surname: 'TEELUCK' },
  { code: 'V160', name: 'VEERASAWMY', title: 'SMIT', salary: 59300, employeeId: 'V1604664204410', firstName: 'Goindah', surname: 'VEERASAWMY' }
];

// Dynamically generate (R) variants for initial auth codes
// BUT don't generate (R) variants if they already exist in the initial list
const existingRVariantNames = new Set(
  initialAuthCodes.filter(auth => auth.name.includes('(R)')).map(auth => auth.name)
);

const baseStaffCodes = initialAuthCodes.filter(auth => !auth.name.includes('(R)'));
const rVariants = baseStaffCodes
  .filter(auth => !existingRVariantNames.has(`${auth.name}(R)`)) // Only generate if not already exists
  .map(auth => ({
    ...auth,
    name: `${auth.name}(R)`,
    code: `${auth.code}R` // Generate a unique code for the (R) variant
  }));

// Combine base staff and (R) variants with ADMIN code
export let authCodes: AuthCode[] = [
  ...initialAuthCodes,
  ...rVariants,
  // Admin Code
  { code: '5274', name: 'ADMIN', title: 'ADMIN', salary: 0, employeeId: '', firstName: '', surname: '' }
];

// Load staff data from Supabase on startup
const loadStaffFromSupabase = async (): Promise<void> => {
  try {
    const { fetchStaffMembers } = await import('./staffApi');
    const staffMembers = await fetchStaffMembers();
    
    if (staffMembers && staffMembers.length > 0) {
      // Filter out the main admin user (ID 5274) from the list
      const filteredStaff = staffMembers.filter((staff: any) => {
        const isMainAdmin = staff.id_number === '5274' || staff.id_number === 'admin-5274';
        return !isMainAdmin;
      });
      
      // Convert to AuthCode format and update
      const serverAuthCodes: AuthCode[] = filteredStaff
        // Include all staff members, including those with (R) in their name
        .map(staff => ({
          code: staff.code,
          name: staff.roster_display_name || staff.name, // Use roster_display_name for uniqueness, fallback to actual name (first name)
          title: staff.title || 'MIT',
          salary: staff.salary || 0,
          employeeId: staff.employee_id || '', // Now optional
          firstName: staff.first_name,
          surname: staff.surname
        }));
      
      // Dynamically generate (R) variants for base staff members ONLY
      // This ensures that even if (R) variants are deleted from Supabase,
      // they are still available in the application
      // BUT don't generate (R) variants if they already exist in the database
      const existingRVariantNames = new Set(
        serverAuthCodes.filter(auth => auth.name.includes('(R)')).map(auth => auth.name)
      );
      
      const baseStaffCodes = serverAuthCodes.filter(auth => !auth.name.includes('(R)'));
      const rVariants = baseStaffCodes
        .filter(auth => !existingRVariantNames.has(`${auth.name}(R)`)) // Only generate if not already exists
        .map(auth => ({
          ...auth,
          name: `${auth.name}(R)`,
          code: `${auth.code}R` // Generate a unique code for the (R) variant
        }));
      
      // Combine base staff and (R) variants
      const allAuthCodes = [...serverAuthCodes, ...rVariants];
      
      // Add ADMIN code (not stored in database)
      allAuthCodes.push({ 
        code: '5274', 
        name: 'ADMIN', 
        title: 'ADMIN', 
        salary: 0, 
        employeeId: '', 
        firstName: '', 
        surname: '' 
      });
      
      // Update the in-memory array
      authCodes.length = 0;
      authCodes.push(...allAuthCodes);
      
      // Force refresh of derived arrays
      refreshDerivedArrays();
    }
  } catch (error) {
    console.error('❌ Failed to load staff from Supabase:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    // Don't swallow the error - keep local defaults as fallback
  }
  
  // Always ensure ADMIN code is available, regardless of Supabase loading result
  const adminCodeExists = authCodes.some(auth => auth.code === '5274');
  if (!adminCodeExists) {
    authCodes.push({ 
      code: '5274', 
      name: 'ADMIN', 
      title: 'ADMIN', 
      salary: 0, 
      employeeId: '', 
      firstName: '', 
      surname: '' 
    });
    console.log('✅ ADMIN code added to authCodes');
  }
  
  // Force refresh of derived arrays
  refreshDerivedArrays();
};

;

// Auto-load staff data when module is imported
loadStaffFromSupabase();

// Listen for real-time staff updates to keep auth codes in sync
const handleStaffRealtimeUpdate = (event: CustomEvent) => {
  console.log('📡 rosterAuth: Received staff real-time update:', event.detail);
  
  // Reload staff data from Supabase to update auth codes
  loadStaffFromSupabase().catch(error => {
    console.error('❌ Failed to reload staff data after real-time update:', error);
  });
};

// Set up real-time listener
if (typeof window !== 'undefined') {
  window.addEventListener('staffRealtimeUpdate', handleStaffRealtimeUpdate as EventListener);
}

/**
 * Update the auth codes array and persist to file
 */
export async function updateAuthCodes(newAuthCodes: AuthCode[]): Promise<void> {
  try {
    console.log('💾 Updating rosterAuth.ts with new auth codes...');
    
    // Dynamically generate (R) variants for base staff members ONLY
    // This ensures that even if (R) variants are deleted from Supabase,
    // they are still available in the application
    // BUT don't generate (R) variants if they already exist in the database
    const existingRVariantNames = new Set(
      newAuthCodes.filter(auth => auth.name.includes('(R)') && auth.name !== 'ADMIN').map(auth => auth.name)
    );
    
    const baseStaffCodes = newAuthCodes.filter(auth => !auth.name.includes('(R)') && auth.name !== 'ADMIN');
    const rVariants = baseStaffCodes
      .filter(auth => !existingRVariantNames.has(`${auth.name}(R)`)) // Only generate if not already exists
      .map(auth => ({
        ...auth,
        name: `${auth.name}(R)`,
        code: `${auth.code}R` // Generate a unique code for the (R) variant
      }));
    
    // Combine base staff and (R) variants
    const allAuthCodes = [...newAuthCodes, ...rVariants];
    
    // Update the in-memory array immediately for instant UI updates
    authCodes.length = 0;
    authCodes.push(...allAuthCodes);
    
    // Force refresh of derived arrays
    refreshDerivedArrays();
    
    // Persist to IndexedDB for permanent storage
    await persistAuthCodesToStorage(allAuthCodes);
    
    console.log('✅ Successfully updated and persisted auth codes');
    
  } catch (error) {
    console.error('❌ Failed to update rosterAuth.ts:', error);
    throw new Error('Failed to save changes. Please try again.');
  }
}

/**
 * Persist auth codes to IndexedDB
 */
async function persistAuthCodesToStorage(authCodes: AuthCode[]): Promise<void> {
  try {
    // Use the existing IndexedDB infrastructure
    const { workScheduleDB } = await import('./indexedDB');
    await workScheduleDB.init();
    await workScheduleDB.setSetting('authCodes', authCodes);
    console.log('💾 Auth codes persisted to IndexedDB');
  } catch (error) {
    console.error('❌ Failed to persist auth codes:', error);
    throw error;
  }
}

/**
 * Load auth codes from IndexedDB on startup
 */
async function loadAuthCodesFromStorage(): Promise<void> {
  try {
    const { workScheduleDB } = await import('./indexedDB');
    await workScheduleDB.init();
    const storedAuthCodes = await workScheduleDB.getSetting<AuthCode[]>('authCodes');
    
    if (storedAuthCodes && Array.isArray(storedAuthCodes) && storedAuthCodes.length > 0) {
      console.log('📦 Loading auth codes from IndexedDB:', storedAuthCodes.length, 'codes');
      
      // Dynamically generate (R) variants for base staff members ONLY
      // This ensures that even if (R) variants are deleted from Supabase,
      // they are still available in the application
      // BUT don't generate (R) variants if they already exist in the database
      const existingRVariantNames = new Set(
        storedAuthCodes.filter(auth => auth.name.includes('(R)') && auth.name !== 'ADMIN').map(auth => auth.name)
      );
      
      const baseStaffCodes = storedAuthCodes.filter(auth => !auth.name.includes('(R)') && auth.name !== 'ADMIN');
      const rVariants = baseStaffCodes
        .filter(auth => !existingRVariantNames.has(`${auth.name}(R)`)) // Only generate if not already exists
        .map(auth => ({
          ...auth,
          name: `${auth.name}(R)`,
          code: `${auth.code}R` // Generate a unique code for the (R) variant
        }));
      
      // Combine base staff and (R) variants
      const allAuthCodes = [...storedAuthCodes, ...rVariants];
      
      // Update the in-memory array
      authCodes.length = 0;
      authCodes.push(...allAuthCodes);
      
      // Force refresh of derived arrays
      refreshDerivedArrays();
      
      console.log('✅ Auth codes loaded from storage successfully');
    }
  } catch (error) {
    console.error('❌ Failed to load auth codes from storage:', error);
    // Continue with default auth codes if loading fails
  }
}

// Auto-load auth codes when module is imported
loadAuthCodesFromStorage();

/**
 * Refresh derived arrays after auth codes change
 */
function refreshDerivedArrays(): void {
  // Force recalculation of availableNames by clearing and rebuilding
  const newAvailableNames = authCodes
    .filter(auth => auth.name !== 'ADMIN')
    .filter(auth => auth.name !== 'MIT' && auth.name !== 'SMIT')
    .map(auth => auth.name)
    .sort((a, b) => {
      const aHasR = a.includes('(R)');
      const bHasR = b.includes('(R)');
      
      if (aHasR && !bHasR) return -1;
      if (!aHasR && bHasR) return 1;
      
      return a.localeCompare(b);
    });
  
  // Update the exported array
  (availableNames as any).length = 0;
  (availableNames as any).push(...newAvailableNames);
  
  // Force refresh of derived arrays
}

// Available staff names for dropdowns and validation
export let availableNames = authCodes
  .filter(auth => auth.name !== 'ADMIN') // Exclude ADMIN from staff selection
  .filter(auth => auth.name !== 'MIT' && auth.name !== 'SMIT') // Exclude titles
  .map(auth => auth.name)
  .sort((a, b) => {
    // CRITICAL PRIORITY 1: Check asterisks FIRST - names with * ALWAYS go to bottom
    const aStartsWithAsterisk = a.startsWith('*');
    const bStartsWithAsterisk = b.startsWith('*');
    
    if (!aStartsWithAsterisk && bStartsWithAsterisk) return -1;
    if (aStartsWithAsterisk && !bStartsWithAsterisk) return 1;
    
    // If both have same asterisk status, then check seniority
    // Get auth entries for both names
    const authA = authCodes.find(auth => auth.name === a);
    const authB = authCodes.find(auth => auth.name === b);
    
    // Get titles (default to 'MIT' if not found)
    const titleA = authA?.title || 'MIT';
    const titleB = authB?.title || 'MIT';
    
    // Priority 2: SMIT (senior) comes first
    if (titleA === 'SMIT' && titleB !== 'SMIT') return -1;
    if (titleA !== 'SMIT' && titleB === 'SMIT') return 1;
    
    // Priority 3: Within same title and asterisk status, (R) comes first
    if (titleA === titleB) {
      const aHasR = a.includes('(R)');
      const bHasR = b.includes('(R)');
      
      // Names WITH (R) come first (reserve staff priority)
      if (aHasR && !bHasR) return -1;
      if (!aHasR && bHasR) return 1;
      
      // If same (R) status, sort alphabetically
      return a.localeCompare(b);
    }
    
    // Different titles (both not SMIT), sort by title
    return titleA.localeCompare(titleB);
  });

// Group sorting function for roster entries: center entries at bottom, then seniority
export const sortRosterEntriesByGroup = (entries: RosterEntry[]): RosterEntry[] => {
  return [...entries].sort((a, b) => {
    // CRITICAL PRIORITY 1: Check if entries have attached centers (from change_description)
    const aHasCenter = hasAttachedCenter(a.change_description);
    const bHasCenter = hasAttachedCenter(b.change_description);
   
    
    // Entries WITH centers go to bottom
    if (!aHasCenter && bHasCenter) return -1;
    if (aHasCenter && !bHasCenter) return 1;
    
    // If both have same center status, check seniority
    const authA = authCodes.find(auth => auth.name === a.assigned_name);
    const authB = authCodes.find(auth => auth.name === b.assigned_name);
    
    const titleA = authA?.title || 'MIT';
    const titleB = authB?.title || 'MIT';
    
    // Priority 2: SMIT (senior) comes first
    if (titleA === 'SMIT' && titleB !== 'SMIT') return -1;
    if (titleA !== 'SMIT' && titleB === 'SMIT') return 1;
    
    // Priority 3: Within same title and center status, (R) comes first
    if (titleA === titleB) {
      const aHasR = a.assigned_name.includes('(R)');
      const bHasR = b.assigned_name.includes('(R)');
      
      // Names WITH (R) come first
      if (aHasR && !bHasR) return -1;
      if (!aHasR && bHasR) return 1;
      
      // If same (R) status, sort alphabetically
      return a.assigned_name.localeCompare(b.assigned_name);
    }
    
    // Different titles (both not SMIT), sort by title
    return titleA.localeCompare(titleB);
  });
};

// Group sorting function for names (legacy): (*) at bottom always, then seniority
export const sortByGroup = (names: string[]): string[] => {
  return [...names].sort((a, b) => {
    // CRITICAL PRIORITY 1: Check asterisks FIRST - names with * ALWAYS go to bottom
    const aStartsWithAsterisk = a.startsWith('*');
    const bStartsWithAsterisk = b.startsWith('*');
    
    if (!aStartsWithAsterisk && bStartsWithAsterisk) return -1;
    if (aStartsWithAsterisk && !bStartsWithAsterisk) return 1;
    
    // If both have same asterisk status, then check seniority
    // Get auth entries for both names
    const authA = authCodes.find(auth => auth.name === a);
    const authB = authCodes.find(auth => auth.name === b);
    
    // Get titles (default to 'MIT' if not found)
    const titleA = authA?.title || 'MIT';
    const titleB = authB?.title || 'MIT';
    
    // Priority 2: SMIT (senior) comes first
    if (titleA === 'SMIT' && titleB !== 'SMIT') return -1;
    if (titleA !== 'SMIT' && titleB === 'SMIT') return 1;
    
    // Priority 3: Within same title and asterisk status, (R) comes first
    if (titleA === titleB) {
      const aHasR = a.includes('(R)');
      const bHasR = b.includes('(R)');
      
      // Names WITH (R) come first (reserve staff priority)
      if (aHasR && !bHasR) return -1;
      if (!aHasR && bHasR) return 1;
      
      // If same (R) status, sort alphabetically
      return a.localeCompare(b);
    }
    
    // Different titles (both not SMIT), sort by title
    return titleA.localeCompare(titleB);
  });
};

// Get names sorted by group
export const getNamesSortedByGroup = (): string[] => {
  const names = authCodes
    .filter(auth => auth.name !== 'ADMIN') // Exclude ADMIN
    .map(auth => auth.name);
  
  return sortByGroup(names);
};

// Get names by specific title/group
export const getNamesByTitle = (title: string): string[] => {
  const names = authCodes
    .filter(auth => auth.title === title && auth.name !== 'ADMIN')
    .map(auth => auth.name);
  
  return sortByGroup(names);
};

// Shift types for the roster system
export const shiftTypes = [
  'Morning Shift (9-4)',
  'Saturday Regular (12-10)',
  'Evening Shift (4-10)',
  'Night Duty'
];

// Admin code constant
export const ADMIN_CODE = '5274';

// Validation functions
export function validateAuthCode(code: string): string | null {
  const authEntry = authCodes.find(auth => auth.code === code.toUpperCase());
  return authEntry ? authEntry.name : null;
}

export function isAdminCode(code: string): boolean {
  return code.toUpperCase() === ADMIN_CODE;
}

// Helper functions to get staff information
export function getStaffInfo(staffName: string): AuthCode | null {
  // First try exact name match
  const exactMatch = authCodes.find(auth => auth.name === staffName);
  if (exactMatch) return exactMatch;
  
  // If not found, try matching by surname (case-insensitive)
  const surnameMatch = authCodes.find(auth => 
    auth.surname && auth.surname.toUpperCase() === staffName.toUpperCase()
  );
  if (surnameMatch) return surnameMatch;
  
  return null;
}

export function getStaffFullName(staffName: string): string {
  const staffInfo = getStaffInfo(staffName);
  if (!staffInfo) return staffName;
  
  const firstName = staffInfo.firstName || '';
  const surname = staffInfo.surname || staffInfo.name;
  
  return firstName ? `${firstName} ${surname}` : surname;
}

export function getStaffEmployeeId(staffName: string): string {
  const staffInfo = getStaffInfo(staffName);
  return staffInfo?.employeeId || '';
}

export function getStaffSalary(staffName: string): number {
  const staffInfo = getStaffInfo(staffName);
  return staffInfo?.salary || 0;
}
