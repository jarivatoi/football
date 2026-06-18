import { supabase } from '../lib/supabase';

/**
 * Validate if a passcode exists and return the associated user
 */
export const validatePasscode = async (passcode: string): Promise<{
  isValid: boolean;
  userId?: string;
  idNumber?: string;
  surname?: string;
  name?: string;
  isAdmin?: boolean;
} | null> => {
  try {
    const { data, error } = await supabase
      .from('staff_users')
      .select('id, id_number, surname, name, is_admin')
      .eq('passcode', passcode)
      .eq('is_active', true)
      .limit(1);

    if (error) {
      console.error('❌ Passcode validation error:', error.message, error.details);
      return null;
    }
    
    if (!data || data.length === 0) {
      return null;
    }

    // Take the first match (with duplicate passcodes, there might be multiple)
    const user = data[0];
    
    return {
      isValid: true,
      userId: user.id,
      idNumber: user.id_number,
      surname: user.surname,
      name: user.name,
      isAdmin: user.is_admin
    };
  } catch (error) {
    console.error('❌ Error validating passcode:', error);
    return null;
  }
};

/**
 * Check if a passcode already exists in the database
 * NOTE: Passcodes can now be duplicated - this function is kept for backward compatibility
 * but always returns false to allow duplicate passcodes
 */
export const isPasscodeTaken = async (passcode: string, excludeUserId?: string): Promise<boolean> => {
  // Always return false to allow duplicate passcodes
  // Authentication is now based on unique ID, not passcode uniqueness
  return false;
};

/**
 * Update a user's passcode
 */
export const updatePasscode = async (userId: string, newPasscode: string): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    // Passcodes can be duplicated - ID number is the unique identifier
    // No need to check for uniqueness
    
    const { error } = await supabase
      .from('staff_users')
      .update({ passcode: newPasscode })
      .eq('id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating passcode:', error);
    return { success: false, error: 'Failed to update passcode' };
  }
};

/**
 * Set passcode for a user (admin function)
 */
export const setPasscode = async (userId: string, passcode: string): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    // Passcodes can be duplicated - ID number is the unique identifier
    // No need to check for uniqueness

    const { error } = await supabase
      .from('staff_users')
      .update({ passcode })
      .eq('id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error setting passcode:', error);
    return { success: false, error: 'Failed to set passcode' };
  }
};

/**
 * Get all staff members with their passcode status
 */
export const getStaffPasscodeStatus = async () => {
  try {
    const { data, error } = await supabase
      .from('staff_users')
      .select('id, id_number, surname, name, is_admin, is_active, passcode')
      .order('surname', { ascending: true });

    if (error) {
      throw error;
    }

    return data.map((staff: any) => ({
      ...staff,
      hasPasscode: !!staff.passcode
    }));
  } catch (error) {
    console.error('Error fetching staff passcode status:', error);
    return [];
  }
};
