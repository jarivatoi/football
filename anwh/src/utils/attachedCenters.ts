/**
 * Utilities for resolving attached center markers (*) to center names
 * Examples:
 * - "*NARAYYA" → Fetches marker "*" for institution → Returns "ENT Hospital"
 * - "**VIRAJ" → Fetches marker "**" for institution → Returns "Souillac Hospital"
 */

import { supabase } from '../lib/supabase';

export interface AttachedCenter {
  id: string;
  institution_code: string;
  marker: string;
  center_name: string;
  center_code?: string; // Optional abbreviation (e.g., "ENT", "SOUIL")
  created_at: string;
}

/**
 * Fetch all attached centers for an institution
 */
export async function fetchAttachedCenters(institutionCode: string): Promise<AttachedCenter[]> {
  try {
    const { data, error } = await supabase
      .from('attached_centers')
      .select('*')
      .eq('institution_code', institutionCode)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching attached centers:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Failed to fetch attached centers:', error);
    return [];
  }
}

/**
 * Extract marker prefix from staff name
 * Examples:
 * - "*NARAYYA" → "*"
 * - "**VIRAJ" → "**"
 * - "NARAYYA" → null (no marker)
 */
export function extractMarkerPrefix(name: string): string | null {
  const match = name.match(/^(\*+)\w+/);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

/**
 * Remove marker prefix from staff name
 * Examples:
 * - "*NARAYYA" → "NARAYYA"
 * - "**VIRAJ" → "VIRAJ"
 * - "NARAYYA" → "NARAYYA" (unchanged)
 */
export function removeMarkerPrefix(name: string): string {
  return name.replace(/^\*+/, '');
}

/**
 * Resolve marker to center name
 * Examples:
 * - Marker: "*", Centers: [{marker: '*', center_name: 'ENT Hospital'}] → "ENT Hospital"
 * - Marker: "**", Centers: [] → null (not configured)
 */
export function resolveMarkerToCenter(
  marker: string,
  centers: AttachedCenter[]
): string | null {
  const center = centers.find(c => c.marker === marker);
  return center?.center_name || null;
}

/**
 * Process staff name with marker and return clean name + center remark
 * Examples:
 * - Input: "*NARAYYA", Institution: "JEETOO" → {cleanName: "NARAYYA", remark: "ENT Hospital"}
 * - Input: "**VIRAJ", Institution: "JEETOO" → {cleanName: "VIRAJ", remark: "Souillac Hospital"}
 * - Input: "NARAYYA", Institution: "JEETOO" → {cleanName: "NARAYYA", remark: null}
 */
export async function processStaffWithAttachedCenter(
  staffName: string,
  institutionCode: string
): Promise<{ cleanName: string; remark: string | null }> {
  const marker = extractMarkerPrefix(staffName);
  
  console.log('[ATTACHED CENTER] Processing:', { staffName, institutionCode, marker });
  
  if (!marker) {
    // No marker, return as-is
    return {
      cleanName: staffName,
      remark: null
    };
  }
  
  // Fetch attached centers for this institution
  const centers = await fetchAttachedCenters(institutionCode);
  console.log('[ATTACHED CENTER] Fetched centers:', centers);
  
  const centerName = resolveMarkerToCenter(marker, centers);
  console.log('[ATTACHED CENTER] Resolved marker:', marker, '→', centerName);
  
  // Remove marker from name
  const cleanName = removeMarkerPrefix(staffName);
  
  return {
    cleanName,
    remark: centerName
  };
}

/**
 * Batch process multiple staff names with markers
 */
export async function batchProcessStaffWithAttachedCenters(
  staffNames: string[],
  institutionCode: string
): Promise<Map<string, { cleanName: string; remark: string | null }>> {
  const centers = await fetchAttachedCenters(institutionCode);
  const results = new Map<string, { cleanName: string; remark: string | null }>();
  
  for (const name of staffNames) {
    const marker = extractMarkerPrefix(name);
    
    if (!marker) {
      results.set(name, {
        cleanName: name,
        remark: null
      });
    } else {
      const centerName = resolveMarkerToCenter(marker, centers);
      const cleanName = removeMarkerPrefix(name);
      
      results.set(name, {
        cleanName,
        remark: centerName
      });
    }
  }
  
  return results;
}
