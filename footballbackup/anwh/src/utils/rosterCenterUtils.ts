/**
 * Check if a roster entry has attached center information
 * Returns true if the entry is associated with a center (should be sorted to bottom)
 */
export function hasAttachedCenter(changeDescription?: string): boolean {
  if (!changeDescription) return false;
  
  // Split by | and check the LAST entries (most recent actions)
  const logEntries = changeDescription.split('|').map(e => e.trim());
  
  // Find the LAST marker entry (if any)
  let lastMarkerEntry: string | null = null;
  let lastCenterAction: { action: string, centerName: string } | null = null;
  
  // Process from end to beginning to find the most recent marker and center action
  for (let i = logEntries.length - 1; i >= 0; i--) {
    const entry = logEntries[i];
    
    // Check for marker
    const markerMatch = entry.match(/- Marker:\s*(\*+)/);
    if (markerMatch && !lastMarkerEntry) {
      lastMarkerEntry = markerMatch[1];
    }
    
    // Check for center action
    const centerMatch = entry.match(/\[([^\]]+)\]\s+([^:]+):\s+Center (Added|Removed):\s*(.+)/);
    if (centerMatch && !lastCenterAction) {
      lastCenterAction = {
        action: centerMatch[3],
        centerName: centerMatch[4].trim()
      };
    }
    
    // If we found both, we can stop
    if (lastMarkerEntry && lastCenterAction) {
      break;
    }
  }
  
  // If we have a marker, check if the last center action was Add
  if (lastMarkerEntry) {
    return lastCenterAction?.action === 'Added';
  }
  
  // Fallback to old format: Check if Center Added exists without Center Removed
  const hasAdded = changeDescription.includes('Center Added:') || changeDescription.includes('- Center:');
  const hasRemoved = changeDescription.includes('Center Removed:') || changeDescription.includes('- Removed:');
  
  // Only return true if there's an Add and NO Remove (or last action was Add)
  return hasAdded && !hasRemoved;
}

/**
 * Count number of markers/centers associated with an entry
 * Returns 0 if no centers, or count of markers (e.g., multiple "Center Added:" entries)
 */
export function getCenterCount(changeDescription?: string): number {
  if (!changeDescription) return 0;
  
  // Count occurrences of "Center Added:" or "Center:" patterns
  const centerAddedMatches = changeDescription.match(/Center Added:/gi) || [];
  const markerMatches = changeDescription.match(/Marker: \*+/g) || [];
  
  // Return the count of center associations
  return Math.max(centerAddedMatches.length, markerMatches.length > 0 ? 1 : 0);
}
