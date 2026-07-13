import { supabase } from '../lib/supabase';

export interface StaffMember {
  id: string;
  code: string;
  name: string;
  title: string;
  salary: number;
  employee_id?: string;  // Optional - may not exist in all tables
  first_name: string;
  surname: string;
  roster_display_name?: string;  // Unique roster display name (e.g., "NARAYYA_(V.T)")
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_updated_by: string;
}

// Note: Now using staff_users table instead of staff_members
// The staff_members table has been consolidated into staff_users

export const fetchStaffMembers = async (): Promise<StaffMember[]> => {
  if (!supabase) {
    console.warn('⚠️ Supabase not available');
    return [];
  }

  try {
    // Fetch from staff_users table (consolidated table)
    const { data, error } = await supabase
      .from('staff_users')
      .select('*')
      .order('surname', { ascending: true });

    if (error) {
      console.error('❌ Error fetching staff_users:', error);
      return [];
    }

    // Map staff_users format to StaffMember interface
    const staffMembers: StaffMember[] = (data || []).map((user: any) => ({
      id: user.id,
      code: user.passcode, // Use passcode as code for compatibility
      name: user.name,
      title: user.title || 'MIT',
      salary: user.salary || 0,
      employee_id: user.id_number || '', // Use id_number from staff_users table
      first_name: user.first_name || '',
      surname: user.surname,
      roster_display_name: user.roster_display_name || undefined, // Use roster_display_name if available
      is_active: user.is_active !== false,
      created_at: user.created_at || new Date().toISOString(),
      updated_at: user.last_login || new Date().toISOString(),
      last_updated_by: 'SYSTEM'
    }));

    return staffMembers;
  } catch (error) {
    console.error('❌ Failed to fetch staff members:', error);
    return [];
  }
};

export const addStaffMember = async (staffData: Omit<StaffMember, 'id' | 'created_at' | 'updated_at'>, editorName: string): Promise<StaffMember> => {
  if (!supabase) {
    throw new Error('Database not available.');
  }

  try {
    // Convert StaffMember format to staff_users format
    const userData = {
      surname: staffData.surname.toUpperCase(),
      name: staffData.name,
      passcode: staffData.code,
      title: staffData.title,
      salary: staffData.salary,
      employee_id: staffData.employee_id,
      first_name: staffData.first_name,
      is_active: staffData.is_active,
      is_admin: false
    };

    const { data, error } = await supabase
      .from('staff_users')
      .insert([userData])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add staff member: ${error.message}`);
    }

    // If this is a base name (not containing (R)), also create the corresponding (R) variant
    if (data && !data.name.includes('(R)')) {
      const rVariantName = `${data.name}(R)`;
      const rVariantCode = `${data.passcode}R`;
      
      // Create the (R) variant with modified code
      const rVariantData = {
        surname: data.surname.toUpperCase(),
        name: rVariantName,
        passcode: rVariantCode,
        title: data.title,
        salary: data.salary,
        employee_id: data.employee_id,
        first_name: data.first_name,
        is_active: data.is_active,
        is_admin: false
      };
      
      const { data: rVariantResult, error: rVariantError } = await supabase
        .from('staff_users')
        .insert([rVariantData])
        .select()
        .single();

      if (rVariantError) {
        console.warn('Could not create (R) variant:', rVariantError);
        // Don't throw error here as we still want to return the main staff member
      }
    }
    
    // Convert back to StaffMember format for return value
    const result: StaffMember = {
      id: data.id,
      code: data.passcode,
      name: data.name,
      title: data.title || 'MIT',
      salary: data.salary || 0,
      employee_id: data.employee_id || '',
      first_name: data.first_name || '',
      surname: data.surname,
      is_active: data.is_active !== false,
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.last_login || new Date().toISOString(),
      last_updated_by: editorName
    };
    
    // Dispatch event for real-time updates
    window.dispatchEvent(new CustomEvent('staffRealtimeUpdate', {
      detail: { action: 'added', staff: result }
    }));
    
    return result;
  } catch (error) {
    throw error;
  }
};

export const updateStaffMember = async (id: string, staffData: Partial<StaffMember>, editorName: string): Promise<StaffMember> => {
  if (!supabase) {
    throw new Error('Database not available.');
  }

  try {
    // Convert to staff_users format
    const updateData: any = {};
    
    if (staffData.surname !== undefined) updateData.surname = staffData.surname.toUpperCase();
    if (staffData.name !== undefined) updateData.name = staffData.name;
    if (staffData.title !== undefined) updateData.title = staffData.title;
    if (staffData.salary !== undefined) updateData.salary = staffData.salary;
    if (staffData.employee_id !== undefined) updateData.employee_id = staffData.employee_id;
    if (staffData.first_name !== undefined) updateData.first_name = staffData.first_name;
    if (staffData.is_active !== undefined) updateData.is_active = staffData.is_active;
    if (staffData.code !== undefined) updateData.passcode = staffData.code;
    
    const { data, error } = await supabase
      .from('staff_users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update staff member: ${error.message}`);
    }

    // Dispatch event for real-time updates
    window.dispatchEvent(new CustomEvent('staffRealtimeUpdate', {
      detail: data
    }));
    
    return data;
  } catch (error) {
    throw error;
  }
};

export const deleteStaffMember = async (id: string, editorName: string): Promise<void> => {
  if (!supabase) {
    throw new Error('Database not available.');
  }

  try {
    // First, get the staff member to be deleted
    const { data: staffToDelete, error: fetchError } = await supabase
      .from('staff_users')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch staff member: ${fetchError.message}`);
    }

    // Permanently delete the main staff member
    const { data, error } = await supabase
      .from('staff_users')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to delete staff member: ${error.message}`);
    }

    // If this is a base name (not containing (R)), also delete the corresponding (R) variant
    if (staffToDelete && !staffToDelete.name.includes('(R)')) {
      const rVariantName = `${staffToDelete.name}(R)`;
      
      // Check if the (R) variant exists using maybeSingle() which returns null if no record found
      const { data: existingRVariant, error: checkError } = await supabase
        .from('staff_users')
        .select('*')
        .eq('name', rVariantName)
        .maybeSingle();
      
      if (!checkError && existingRVariant) {
        // Permanently delete the (R) variant
        await supabase
          .from('staff_users')
          .delete()
          .eq('name', rVariantName)
          .select()
          .single();
      }
    }
    
    // If this is an (R) variant, also delete the corresponding base name
    else if (staffToDelete && staffToDelete.name.includes('(R)')) {
      const baseName = staffToDelete.name.replace('(R)', '');
      
      // Check if the base name exists using maybeSingle() which returns null if no record found
      const { data: existingBase, error: checkError } = await supabase
        .from('staff_members')
        .select('*')
        .eq('name', baseName)
        .maybeSingle();
      
      if (!checkError && existingBase) {
        // Permanently delete the base name
        await supabase
          .from('staff_members')
          .delete()
          .eq('name', baseName)
          .select()
          .single();
      }
    }
    
    // Dispatch event for real-time updates
    window.dispatchEvent(new CustomEvent('staffRealtimeUpdate', {
      detail: { action: 'deleted', id, deletedStaff: data }
    }));
    
  } catch (error) {
    throw error;
  }
};

