/**
 * Complete Database Export Utility
 * Exports ALL data from Supabase including:
 * - Roster entries (with markers, center info)
 * - Staff users
 * - Institutions
 * - Attached centers
 * - Metadata
 */

import { supabase } from '../lib/supabase';

export interface DatabaseExportData {
  exportDate: string;
  version: string;
  roster_entries: any[];
  staff_users: any[];
  institutions: any[];
  attached_centers: any[];
  metadata: any[];
}

export const exportCompleteDatabase = async (): Promise<DatabaseExportData> => {
  try {
    console.log('🚀 Starting complete database export...');
    
    const exportData: DatabaseExportData = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      roster_entries: [],
      staff_users: [],
      institutions: [],
      attached_centers: [],
      metadata: []
    };

    // 1. Export Roster Entries (includes markers, center remarks, change history)
    console.log('📊 Exporting roster entries...');
    const { data: rosterData, error: rosterError } = await supabase
      .from('roster_entries')
      .select('*')
      .order('date', { ascending: false });
    
    if (rosterError) throw rosterError;
    exportData.roster_entries = rosterData || [];
    console.log(`✅ Exported ${exportData.roster_entries.length} roster entries`);

    // 2. Export Staff Users
    console.log('👥 Exporting staff users...');
    const { data: staffData, error: staffError } = await supabase
      .from('staff_users')
      .select('*')
      .order('surname', { ascending: true });
    
    if (staffError) throw staffError;
    exportData.staff_users = staffData || [];
    console.log(`✅ Exported ${exportData.staff_users.length} staff users`);

    // 3. Export Institutions
    console.log('🏥 Exporting institutions...');
    const { data: institutionData, error: institutionError } = await supabase
      .from('institutions')
      .select('*')
      .order('name', { ascending: true });
    
    if (institutionError) throw institutionError;
    exportData.institutions = institutionData || [];
    console.log(`✅ Exported ${exportData.institutions.length} institutions`);

    // 4. Export Attached Centers (if table exists)
    try {
      console.log('📍 Exporting attached centers...');
      const { data: centersData, error: centersError } = await supabase
        .from('attached_centers')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (!centersError && centersData) {
        exportData.attached_centers = centersData;
        console.log(`✅ Exported ${exportData.attached_centers.length} attached centers`);
      }
    } catch (err) {
      console.warn('⚠️ attached_centers table not found, skipping...');
    }

    // 5. Export Metadata (if table exists)
    try {
      console.log('📝 Exporting metadata...');
      const { data: metadata, error: metadataError } = await supabase
        .from('metadata')
        .select('*');
      
      if (!metadataError && metadata) {
        exportData.metadata = metadata;
        console.log(`✅ Exported ${exportData.metadata.length} metadata records`);
      }
    } catch (err) {
      console.warn('⚠️ metadata table not found, skipping...');
    }

    console.log('✅ Complete database export successful!');
    console.log('📦 Total exported:', {
      roster_entries: exportData.roster_entries.length,
      staff_users: exportData.staff_users.length,
      institutions: exportData.institutions.length,
      attached_centers: exportData.attached_centers?.length || 0,
      metadata: exportData.metadata?.length || 0
    });

    return exportData;
  } catch (error) {
    console.error('❌ Database export failed:', error);
    throw error;
  }
};

export const downloadExportFile = async (data: DatabaseExportData): Promise<void> => {
  const now = new Date();
  const day = now.getDate().toString().padStart(2, '0');
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const year = now.getFullYear();
  const hour = now.getHours().toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  
  const filename = `ANWH_Database_Backup_${day}-${month}-${year}_${hour}-${minute}.json`;
  
  const dataStr = JSON.stringify(data, null, 2);
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
               (window.navigator as any).standalone === true;
  
  // Try Web Share API first (works well on iPhone)
  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([dataStr], filename, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'ANWH Database Backup',
          text: 'Complete database export including all roster entries, staff users, and settings'
        });
        return;
      }
    } catch (error) {
      console.log('Web Share API failed, trying fallback');
    }
  }
  
  // PWA-specific handling (iPhone)
  if (isPWA) {
    try {
      // Try clipboard copy for PWA
      await navigator.clipboard.writeText(dataStr);
      alert(`📋 Database backup copied to clipboard!

To save as file:
1. Open Notes app
2. Paste the data
3. Tap Share → Save to Files
4. Name it: ${filename}`);
      return;
    } catch (error) {
      console.log('Clipboard failed in PWA');
    }
  }
  
  // Fallback: Create download link
  try {
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    // Last resort: Open in new tab
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(`<pre>${dataStr}</pre>`);
      alert(`Database backup opened in new tab. To save:\n1. Right-click → Save As\n2. Name it: ${filename}`);
    }
  }
  
  console.log(`📥 Database backup exported: ${filename}`);
};
