import { supabase } from '../lib/supabase';
import { RosterEntry, RosterFormData } from '../types/roster';
import { getUserSession } from './indexedDB';

/**
 * Check if a staff member exists with a different name (name change scenario)
 * Uses change_description patterns to find related entries
 */
export const checkForNameChanges = async (
  date: string,
  shiftType: string,
  staffName: string
): Promise<{ found: boolean; originalName?: string; changeDescription?: string } | null> => {
  try {
    // Get all entries for this date and shift
    const { data: entries } = await supabase
      .from('roster_entries')
      .select('id, date, shift_type, assigned_name, change_description')
      .eq('date', date)
      .eq('shift_type', shiftType);
    
    if (!entries || entries.length === 0) {
      return { found: false };
    }
    
    // Look for entries with change descriptions that might indicate a name change
    for (const entry of entries) {
      const changeDesc = entry.change_description?.toLowerCase() || '';
      
      // Check if change description mentions this staff member
      if (
        changeDesc.includes(staffName.toLowerCase()) &&
        entry.assigned_name !== staffName
      ) {

        return {
          found: true,
          originalName: entry.assigned_name,
          changeDescription: entry.change_description
        };
      }
      
      // Also check for swap/exchange patterns
      if (
        (changeDesc.includes('swap') || 
         changeDesc.includes('exchange') || 
         changeDesc.includes('replace')) &&
        changeDesc.includes(staffName.toLowerCase())
      ) {
return {
          found: true,
          originalName: entry.assigned_name,
          changeDescription: entry.change_description
        };
      }
    }
    
    return { found: false };
  } catch (error) {
return null;
  }
};

export const fetchRosterEntries = async (): Promise<RosterEntry[]> => {
  if (!supabase) {

    throw new Error('Supabase not configured. Please set up your Supabase credentials in the .env file.');
  }

  try {
    // Get current user's institution for filtering
    let institutionCode: string | null = null;
    try {
      const session = await getUserSession();
      if (session) {
        const { data: userData } = await supabase
          .from('staff_users')
          .select('id_number, institution_code, posting_institution')
          .eq('id', session.userId)
          .single();
        
        // Admin 5274 can see all (no filter), others filtered by institution
        if (userData && !userData.id_number?.endsWith('5274')) {
          institutionCode = userData.posting_institution || userData.institution_code;
        }
      }
    } catch (err) {
  
    }
    
    // Build query with optional institution filter
    let query = supabase
      .from('roster_entries')
      .select('*');
    
    if (institutionCode) {
      query = query.eq('institution_code', institutionCode);
    }
    
    const { data, error } = await query
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {

      throw new Error(`Database error: ${error.message}`);
    }

    return data || [];
  } catch (error) {

    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error: Unable to connect to database. Please check your internet connection and Supabase configuration.');
  }
};

export const addRosterEntry = async (formData: RosterFormData, editorName: string, isPdfImport: boolean = false): Promise<{ entry: RosterEntry; status: 'added' | 'updated' | 'skipped' }> => {
  if (!supabase) {
    throw new Error('Database not available. Please check your connection.');
  }

  try {
    // Check for exact duplicate entries (same date, shift, and staff name)
    const { data: existingEntries } = await supabase
      .from('roster_entries')
      .select('id, date, shift_type, assigned_name, change_description')
      .eq('date', formData.date)
      .eq('shift_type', formData.shiftType)
      .eq('assigned_name', formData.assignedName)
      .limit(1);
    
    // For PDF imports, also check for name variants (with/without marker)
    let existingEntryForPdf: any = null;
    if (isPdfImport && (!existingEntries || existingEntries.length === 0)) {
      // Extract base name without marker (incoming name should already be without marker)
      const baseName = formData.assignedName.replace(/^\*+/, '');
      
      // Check if there's an entry with the base name (without marker)
      const { data: baseNameEntries } = await supabase
        .from('roster_entries')
        .select('id, date, shift_type, assigned_name, change_description')
        .eq('date', formData.date)
        .eq('shift_type', formData.shiftType)
        .eq('assigned_name', baseName)
        .limit(1);
      
      if (baseNameEntries && baseNameEntries.length > 0) {
        existingEntryForPdf = baseNameEntries[0];
      }
      
      // ALSO check if there's an entry with a marker variant (e.g., *NARAYYA when importing NARAYYA)
      if (!existingEntryForPdf) {
        const { data: markerVariants } = await supabase
          .from('roster_entries')
          .select('id, date, shift_type, assigned_name, change_description')
          .eq('date', formData.date)
          .eq('shift_type', formData.shiftType)
          .filter('assigned_name', 'like', `%${baseName}%`)
          .limit(10);
        
        // Find entries that match when marker is stripped
        const matchingVariant = markerVariants?.find((entry: any) => {
          const entryBaseName = entry.assigned_name.replace(/^\*+/, '');
          return entryBaseName === baseName;
        });
        
        if (matchingVariant) {
          existingEntryForPdf = matchingVariant;
        }
      }
    }
    
    if (existingEntries && existingEntries.length > 0) {
      // Exact duplicate found - check if it's a perfect match
      const existingEntry = existingEntries[0];
      
      // For PDF imports, check if the incoming data matches exactly
      if (isPdfImport) {
        // Ensure both names are stripped of markers for comparison
        const existingNameClean = existingEntry.assigned_name.replace(/^\*+/, '');
        const incomingNameClean = formData.assignedName.replace(/^\*+/, '');
        
        // Check if incoming PDF has marker
        const hasIncomingMarker = formData.changeDescription?.includes('- Marker:');
        
        // If names match exactly (both without markers) and no new marker is being added
        if (existingNameClean === incomingNameClean && !hasIncomingMarker) {
          // Perfect match - skip this entry (no update needed)
          return { 
            entry: { ...existingEntry, shiftType: existingEntry.shift_type, assignedName: existingEntry.assigned_name } as RosterEntry,
            status: 'skipped'
          };
        }
        
        // Names differ or has new marker - proceed with update
        const now = new Date();
        const timestamp = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        
        // Ensure the incoming name is stripped of marker before saving
        const cleanName = incomingNameClean;
        
        // For PDF imports, always update with the incoming name (without marker)
        // If incoming PDF has no marker, remove marker info from change_description
        let mergedChangeDescription = formData.changeDescription || '';
        
        // If incoming PDF has no marker, strip marker-related info from change_description
        if (!hasIncomingMarker) {
          // Remove any existing marker info from change_description
          if (mergedChangeDescription) {
            // Remove " - Marker: *" or " - Marker: **" patterns
            mergedChangeDescription = mergedChangeDescription.replace(/\s*-\s*Marker:\s*\*+/g, '');
            // Clean up trailing/leading whitespace
            mergedChangeDescription = mergedChangeDescription.trim();
          }
        }
        
        const { data: updatedEntry, error: updateError } = await supabase
          .from('roster_entries')
          .update({
            assigned_name: cleanName, // Store WITHOUT marker
            change_description: mergedChangeDescription || null,
            last_edited_by: editorName,
            last_edited_at: timestamp
          })
          .eq('id', existingEntry.id)
          .select()
          .single();
        
        if (updateError) {
          throw new Error(`Failed to update existing entry: ${updateError.message}`);
        }
        
        return { 
          entry: { ...updatedEntry, shiftType: updatedEntry.shift_type, assignedName: updatedEntry.assigned_name } as RosterEntry,
          status: 'updated'
        };
      }
      
      return { 
        entry: { ...existingEntries[0], shiftType: existingEntries[0].shift_type, assignedName: existingEntries[0].assigned_name } as RosterEntry,
        status: 'skipped'
      };
    } else if (existingEntryForPdf) {
      // Found entry with base name or marker variant - update it
      const now = new Date();
      const timestamp = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      
      // Ensure the incoming name is stripped of marker before saving
      const cleanName = formData.assignedName.replace(/^\*+/, '');
      
      // Check if incoming PDF has marker info
      const hasIncomingMarker = formData.changeDescription?.includes('- Marker:');
      
      // If incoming PDF has no marker, remove marker info from change_description
      let mergedChangeDescription = formData.changeDescription || '';
      
      if (!hasIncomingMarker) {
        // Remove any existing marker info from change_description
        if (mergedChangeDescription) {
          // Remove " - Marker: *" or " - Marker: **" patterns
          mergedChangeDescription = mergedChangeDescription.replace(/\s*-\s*Marker:\s*\*+/g, '');
          // Clean up trailing/leading whitespace
          mergedChangeDescription = mergedChangeDescription.trim();
        }
      }
      
      const { data: updatedEntry, error: updateError } = await supabase
        .from('roster_entries')
        .update({
          assigned_name: cleanName, // Store WITHOUT marker
          change_description: mergedChangeDescription || null,
          last_edited_by: editorName,
          last_edited_at: timestamp
        })
        .eq('id', existingEntryForPdf.id)
        .select()
        .single();
      
      if (updateError) {
        throw new Error(`Failed to update existing entry: ${updateError.message}`);
      }
      
      return { 
        entry: { ...updatedEntry, shiftType: updatedEntry.shift_type, assignedName: updatedEntry.assigned_name } as RosterEntry,
        status: 'updated'
      };
    }
    
    // Get current user's institution
    let institutionCode: string | undefined;
    try {
      const session = await getUserSession();
      if (session) {
        const { data: userData } = await supabase
          .from('staff_users')
          .select('institution_code, posting_institution')
          .eq('id', session.userId)
          .single();
        
        // Use posting_institution if available (for Admin 5274), otherwise institution_code
        institutionCode = userData?.posting_institution || userData?.institution_code;
      }
    } catch (err) {
  
    }
    
    const now = new Date();
    const timestamp = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    const entryData = {
      date: formData.date,
      shift_type: formData.shiftType,
      assigned_name: formData.assignedName,
      last_edited_by: editorName,
      last_edited_at: timestamp,
      change_description: formData.changeDescription || null,
      institution_code: institutionCode || null // Add institution
    };

    const { data, error } = await supabase
      .from('roster_entries')
      .insert([entryData])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add roster entry: ${error.message}`);
    }
    
    try {
      const db = (window as any).rosterDb;
      if (db && db.addRosterEntry) {
        await db.addRosterEntry(data);
      }
    } catch (dbError) {
      // Non-critical, continue
    }
    
    const syncEvent = {
      date: formData.date,
      shiftType: formData.shiftType,
      assignedName: formData.assignedName,
      editorName: editorName,
      action: 'added'
    };
    window.dispatchEvent(new CustomEvent('rosterCalendarSync', {
      detail: syncEvent
    }));
    
    return { 
      entry: data,
      status: 'added'
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Import failed: ${error.message}`);
    }
    throw new Error('Import failed: Network or database error');
  }
};

export const updateRosterEntry = async (id: string, formData: RosterFormData, editorName: string): Promise<RosterEntry> => {
  if (!supabase) {
    throw new Error('Supabase not available. Please configure your Supabase credentials in .env file or src/lib/supabase.ts');
  }

  try {
    const { data: currentEntry, error: fetchError } = await supabase
      .from('roster_entries')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch current entry: ${fetchError.message}`);
    }

    const isNameChange = currentEntry.assigned_name !== formData.assignedName;
    const oldAssignedName = currentEntry.assigned_name;

const now = new Date();
    const timestamp = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    let newChangeDescription = formData.changeDescription;
    
    if (currentEntry.change_description === 'Imported from PDF') {
      newChangeDescription = `${formData.changeDescription} (Original PDF: ${currentEntry.assigned_name})`;
    } else if (currentEntry.change_description && currentEntry.change_description.includes('(Original PDF:')) {
      const existingOriginal = currentEntry.change_description.match(/\(Original PDF: ([^)]+)\)/);
      if (existingOriginal) {
        newChangeDescription = `${formData.changeDescription} (Original PDF: ${existingOriginal[1]})`;
      }
    }
    
    const updateData = {
      date: formData.date,
      shift_type: formData.shiftType,
      assigned_name: formData.assignedName,
      last_edited_by: editorName,
      last_edited_at: timestamp,
      change_description: newChangeDescription || null,
      text_color: formData.textColor || null
      // Note: institution_code should not change on update - it's set on insert
    };

    const { data, error } = await supabase
      .from('roster_entries')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update roster entry: ${error.message}`);
    }
    
    try {
      const db = (window as any).rosterDb;
      if (db && db.updateRosterEntry) {
        await db.updateRosterEntry(data);
      }
    } catch (dbError) {
      // Non-critical, continue
    }
    
    if (isNameChange) {
      const removalEvent = {
        date: formData.date,
        shiftType: formData.shiftType,
        assignedName: oldAssignedName,
        editorName: editorName,
        action: 'removed'
      };
      window.dispatchEvent(new CustomEvent('rosterCalendarSync', {
        detail: removalEvent
      }));
    }
    
    const syncEvent = {
      date: formData.date,
      shiftType: formData.shiftType,
      assignedName: formData.assignedName,
      editorName: editorName,
      action: 'updated'
    };
    window.dispatchEvent(new CustomEvent('rosterCalendarSync', {
      detail: syncEvent
    }));
    
    return data;
  } catch (error) {
    throw error;
  }
};

export const deleteRosterEntry = async (id: string): Promise<void> => {
  if (!supabase) {
    throw new Error('Supabase not available. Please configure your Supabase credentials in .env file or src/lib/supabase.ts');
  }

  try {
    const { data: entryToDelete, error: fetchError } = await supabase
      .from('roster_entries')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch entry before deletion: ${fetchError.message}`);
    }

    const { error } = await supabase
      .from('roster_entries')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete roster entry: ${error.message}`);
    }
    
    try {
      const db = (window as any).rosterDb;
      if (db && db.deleteRosterEntry) {
        await db.deleteRosterEntry(id);
      }
    } catch (dbError) {
      // Non-critical, continue
    }
    
    if (entryToDelete) {
      const syncEvent = {
        date: entryToDelete.date,
        shiftType: entryToDelete.shift_type,
        assignedName: entryToDelete.assigned_name,
        editorName: entryToDelete.last_edited_by || 'Unknown',
        action: 'removed'
      };
      window.dispatchEvent(new CustomEvent('rosterCalendarSync', {
        detail: syncEvent
      }));
    }
  } catch (error) {
    throw error;
  }
};

export const clearAllRosterEntries = async (institutionCode?: string): Promise<void> => {
  if (!supabase) {
    throw new Error('Supabase not available. Please configure your Supabase credentials in .env file or src/lib/supabase.ts');
  }

  try {
    let query = supabase.from('roster_entries').select('*', { count: 'exact', head: true });
    let deleteQuery = supabase.from('roster_entries').delete();
    
    if (institutionCode) {
      query = query.eq('institution_code', institutionCode);
      deleteQuery = deleteQuery.eq('institution_code', institutionCode);
    }
    
    const { count, error: countError } = await query;
    
    if (countError) {
      // Non-critical, continue
    }
    
    const { error } = await deleteQuery;

    if (error) {
      throw new Error(`Failed to clear roster entries: ${error.message}`);
    }
  } catch (error) {
    throw error;
  }
};

export const clearMonthRosterEntries = async (year: number, month: number, institutionCode?: string): Promise<void> => {
  if (!supabase) {
    throw new Error('Supabase not available. Please configure your Supabase credentials in .env file or src/lib/supabase.ts');
  }

  try {
    const startDate = `${year}-${(month + 1).toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${(month + 1).toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    
    let query = supabase.from('roster_entries').select('*', { count: 'exact', head: true });
    let deleteQuery = supabase.from('roster_entries').delete()
      .gte('date', startDate)
      .lte('date', endDate);
    
    if (institutionCode) {
      query = query.eq('institution_code', institutionCode);
      deleteQuery = deleteQuery.eq('institution_code', institutionCode);
    }
    
    const { count, error: countError } = await query;
    
    if (countError) {
      // Non-critical, continue
    }
    
    const { error } = await deleteQuery;

    if (error) {
      throw new Error(`Failed to clear month roster entries: ${error.message}`);
    }
  } catch (error) {
    throw error;
  }
};

export const updateAllStaffRemarksForDate = async (date: string, info: string, editorName: string): Promise<void> => {
  if (!supabase) {
    throw new Error('Supabase not available. Please configure your Supabase credentials in .env file or src/lib/supabase.ts');
  }

  try {
    const now = new Date();
    const timestamp = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    const { data: dateEntries, error: fetchError } = await supabase
      .from('roster_entries')
      .select('*')
      .eq('date', date);

    if (fetchError) {
      throw new Error(`Failed to fetch entries for date: ${fetchError.message}`);
    }

    if (!dateEntries || dateEntries.length === 0) {
      return;
    }

    for (const entry of dateEntries) {
      let newChangeDescription = entry.change_description || '';
      
      newChangeDescription = newChangeDescription.replace(/Special Date: [^;]*;?\s*/g, '');
      
      if (info.trim()) {
        const specialInfo = `Special Date: ${info.trim()}`;
        newChangeDescription = newChangeDescription ? 
          `${specialInfo}; ${newChangeDescription}` : 
          specialInfo;
      }
      
      const { error: updateError } = await supabase
        .from('roster_entries')
        .update({
          change_description: newChangeDescription || null,
          last_edited_by: editorName,
          last_edited_at: timestamp
        })
        .eq('id', entry.id);

      if (updateError) {
        throw new Error(`Failed to update entry: ${updateError.message}`);
      }
    }
    
    window.dispatchEvent(new CustomEvent('rosterUpdated', {
      detail: { 
        type: 'special_date_update', 
        date,
        info,
        entries: dateEntries 
      }
    }));
  } catch (error) {
    throw error;
  }
};

export const syncRosterEntriesForStaff = async (
  idNumber: string,
  newRosterDisplayName: string
): Promise<void> => {
  try {
    const { data: entries, error: fetchError } = await supabase
      .from('roster_entries')
      .select('id, assigned_name, date, shift_type')
      .eq('assigned_name', idNumber);
    
    if (fetchError) {
      return;
    }
    
    if (!entries || entries.length === 0) {
      return;
    }
    
    for (const entry of entries) {
      const oldAssignedName = entry.assigned_name;
      
      const { error: updateError } = await supabase
        .from('roster_entries')
        .update({ 
          assigned_name: newRosterDisplayName,
          last_edited_at: new Date().toISOString()
        })
        .eq('id', entry.id);
      
      if (updateError) {
        // Log error but continue processing other entries
      } else {
        const removalEvent = {
          date: entry.date || '',
          shiftType: entry.shift_type || '',
          assignedName: oldAssignedName,
          editorName: 'System Sync',
          action: 'removed' as const
        };
        window.dispatchEvent(new CustomEvent('rosterCalendarSync', {
          detail: removalEvent
        }));
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const additionEvent = {
          date: entry.date || '',
          shiftType: entry.shift_type || '',
          assignedName: newRosterDisplayName,
          editorName: 'System Sync',
          action: 'added' as const
        };
        window.dispatchEvent(new CustomEvent('rosterCalendarSync', {
          detail: additionEvent
        }));
      }
    }
  } catch (err) {
    // Error handling
  }
};
