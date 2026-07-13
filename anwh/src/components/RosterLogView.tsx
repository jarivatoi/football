import React from 'react';
import { useState, useEffect } from 'react';
import { Clock, User, Calendar, FileText, ArrowRight, MapPin } from 'lucide-react';
import { RosterEntry, ShiftFilterType } from '../types/roster';
import { formatDisplayDate, getShiftDisplayName } from '../utils/rosterFilters';
import { availableNames } from '../utils/rosterAuth';
import { parseNameChange } from '../utils/rosterHelpers';
import { formatDisplayNameForUI } from '../utils/rosterDisplayName';
import { ScrollingText } from './ScrollingText';

interface RosterLogViewProps {
  entries: RosterEntry[];
  loading: boolean;
  selectedDate?: Date;
}

export const RosterLogView: React.FC<RosterLogViewProps> = ({
  entries,
  loading,
  selectedDate
}) => {
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'nameChanges'>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Listen for real-time updates
  useEffect(() => {
    const handleRealtimeUpdate = (event: CustomEvent) => {
      
      // Force component re-render to show real-time changes
      setRefreshKey(prev => prev + 1);
    };

    window.addEventListener('rosterRealtimeUpdate', handleRealtimeUpdate as EventListener);
    return () => window.removeEventListener('rosterRealtimeUpdate', handleRealtimeUpdate as EventListener);
  }, []);
  
  // Filter entries by selected month/year first
  const monthFilteredEntries = selectedDate ? entries.filter(entry => {
    const entryDate = new Date(entry.date);
    return entryDate.getMonth() === selectedDate.getMonth() && 
           entryDate.getFullYear() === selectedDate.getFullYear();
  }) : entries;
  
  // Filter entries based on filter type
  const filteredEntries = monthFilteredEntries.filter(entry => {
    // Always exclude PDF import entries and Saturday conversion entries from the log view
    if (entry.change_description && 
        (entry.change_description === 'Imported from PDF' || 
         entry.change_description.includes('Saturday 4-10 converted to 12-10'))) {
      return false;
    }
    
    // Exclude entries edited by ADMIN (main admin 5274)
    // Check for various formats: 'ADMIN', '5274', 'admin-5274', etc.
    // BUT allow center management changes and shift marker changes to show
    if (entry.last_edited_by) {
      const isAdmin5274 = 
        entry.last_edited_by === 'ADMIN' ||
        entry.last_edited_by === '5274' ||
        entry.last_edited_by === 'admin-5274' ||
        entry.last_edited_by.includes('(5274)') ||
        entry.last_edited_by.toLowerCase().includes('admin');
      
      // Only filter out admin edits if it's NOT a center change AND NOT a shift marker change
      const isCenterChange = entry.change_description && 
        (entry.change_description.includes('- Center:') || 
         entry.change_description.includes('- Removed:'));
      
      // Check if change_description contains ANY shift marker actions (by anyone)
      const hasShiftMarkerActions = entry.change_description && 
        (entry.change_description.includes('as marker for his shift') ||
         entry.change_description.includes('Cleared shift marker'));
      
      if (isAdmin5274 && !isCenterChange && !hasShiftMarkerActions) {
        return false;
      }
    }
    
    if (filterType === 'nameChanges') {
      // Only show entries that have name change descriptions (containing "Name changed from")
      return entry.change_description && 
             entry.change_description.includes('Name changed from') &&
             entry.change_description.includes(' to ');
    } else {
      // Show all entries that have meaningful change descriptions
      // Exclude empty descriptions and PDF import entries
      const hasChangeDescription = entry.change_description && 
                                   entry.change_description.trim() !== '' &&
                                   entry.change_description !== 'Imported from PDF';
      return hasChangeDescription;
    }
  });

  // Filter by selected staff member (after getDisplayName is defined)
  const staffFilteredEntries = filteredEntries.filter(entry => {
    if (selectedStaff === 'all') return true;
    
    // Check if this is a name change entry
    const isNameChange = entry.change_description && 
      entry.change_description.includes('Name changed from') &&
      entry.change_description.includes(' to ');
    
    // For name changes, only filter by who made the edit (last_edited_by)
    // NOT by the assigned_name (the person whose name was changed)
    if (isNameChange) {
      return entry.last_edited_by && getDisplayName(entry.last_edited_by) === selectedStaff;
    }
    
    // For other entries (center changes, etc.), filter by editor OR assigned person
    const isEditor = entry.last_edited_by && getDisplayName(entry.last_edited_by) === selectedStaff;
    const isAssignedTo = getDisplayName(entry.assigned_name) === selectedStaff;
    
    // Also check if any center change action was performed by this staff member
    let isCenterChangeByStaff = false;
    if (entry.change_description) {
      const logEntries = entry.change_description.split('|').map(e => e.trim());
      isCenterChangeByStaff = logEntries.some(logEntry => {
        const match = logEntry.match(/\[([^\]]+)\]\s+([^:]+):\s+Center (Added|Removed):\s*(.+)/);
        if (match) {
          const editorName = match[2].trim();
          return getDisplayName(editorName) === selectedStaff;
        }
        return false;
      });
    }
    
    return isEditor || isAssignedTo || isCenterChangeByStaff;
  });

  // Sort entries by latest edit first (most recent last_edited_at at the top)
  const sortedEntries = [...staffFilteredEntries].sort((a, b) => {
    // Enhanced timestamp parsing with better fallbacks
    const parseTimestamp = (timestamp: string | null | undefined) => {
      if (!timestamp) return new Date(0); // Very old date for missing timestamps
      
      try {
        // Handle custom format: "20-01-2025 09:00:00"
        if (timestamp.includes('-') && timestamp.includes(' ')) {
          const [datePart, timePart] = timestamp.split(' ');
          const [day, month, year] = datePart.split('-');
          const [hour, minute, second] = (timePart || '00:00:00').split(':');
          return new Date(
            parseInt(year), 
            parseInt(month) - 1, 
            parseInt(day), 
            parseInt(hour || '0'), 
            parseInt(minute || '0'), 
            parseInt(second || '0')
          );
        }
        
        // Handle ISO format or other standard formats
        const date = new Date(timestamp);
        return isNaN(date.getTime()) ? new Date(0) : date;
      } catch (error) {
        return new Date(0); // Very old date for unparseable timestamps
      }
    };
    
    // ONLY use last_edited_at - do NOT fall back to created_at
    // If last_edited_at is missing, treat as very old (new Date(0))
    const dateA = a.last_edited_at ? parseTimestamp(a.last_edited_at) : new Date(0);
    const dateB = b.last_edited_at ? parseTimestamp(b.last_edited_at) : new Date(0);
    
    // Sort by most recent first (descending order) - latest edits on top
    const timeDiff = dateB.getTime() - dateA.getTime();
    
    // If timestamps are the same, sort by entry ID as secondary sort
    if (timeDiff === 0) {
      return b.id.localeCompare(a.id);
    }
    
    return timeDiff;
  });

  // Simple display name extractor - just strip (R) suffix if it's a modification marker
  function getDisplayName(fullName: string): string {
    if (!fullName) return '';
    
    // Use formatDisplayNameForUI to strip ID number
    let displayName = formatDisplayNameForUI(fullName);
    
    // Strip (R) suffix ONLY if it's a modification marker (not preceded by underscore)
    // e.g., "NARAYYA(R)" → "NARAYYA" (modification marker - no underscore before R)
    // But "NARAYYA_(R)" stays as "NARAYYA_(R)" ((R) IS the identifier - has underscore)
    if (displayName.endsWith('(R)')) {
      const beforeR = displayName.slice(0, -3);
      if (!beforeR.endsWith('_')) {
        displayName = beforeR.trim();
      }
    }
    
    // If there's a comma, take only the part before the comma
    if (displayName.includes(',')) {
      displayName = displayName.split(',')[0].trim();
    }
    
    return displayName;
  }

  // Get unique staff names from all entries for the filter dropdown
  const getUniqueStaffNames = () => {
    const staffNames = new Set<string>();
    
    monthFilteredEntries.forEach(entry => {
      // Add the editor's name to the filter list
      // Exclude main admin (5274), PDF imports, and system entries
      if (entry.last_edited_by && 
          entry.last_edited_by !== 'PDF Import' && 
          !entry.last_edited_by.toLowerCase().includes('pdf')) {
        // Skip main admin (5274) in various formats
        const isAdmin5274 = 
          entry.last_edited_by === 'ADMIN' ||
          entry.last_edited_by === '5274' ||
          entry.last_edited_by === 'admin-5274' ||
          entry.last_edited_by.includes('(5274)') ||
          entry.last_edited_by.toLowerCase().includes('admin');
        
        if (!isAdmin5274) {
          // Use getDisplayName to strip ID numbers and (R) suffix
          const displayName = getDisplayName(entry.last_edited_by);
          staffNames.add(displayName);
        }
      }
    });
    
    // Filter out staff members with 0 actual edits in the current view
    // Use filteredEntries (after admin filtering) to count visible edits
    const staffWithEdits = new Set<string>();
    filteredEntries.forEach(entry => {
      if (entry.last_edited_by && 
          entry.last_edited_by !== 'PDF Import' && 
          !entry.last_edited_by.toLowerCase().includes('pdf')) {
        const displayName = getDisplayName(entry.last_edited_by);
        const isAdmin5274 = 
          entry.last_edited_by === 'ADMIN' ||
          entry.last_edited_by === '5274' ||
          entry.last_edited_by === 'admin-5274' ||
          entry.last_edited_by.includes('(5274)') ||
          entry.last_edited_by.toLowerCase().includes('admin');
        
        if (!isAdmin5274) {
          staffWithEdits.add(displayName);
        }
      }
    });
    
    // Only return staff who have actual edits
    return Array.from(staffNames).filter(name => staffWithEdits.has(name)).sort();
  };

  // Count total edit actions per staff member (center changes, name changes, shift marker changes, and general edits)
  const getStaffActionCount = (staffName: string) => {
    let totalCount = 0;
    
    filteredEntries.forEach(entry => {
      // Count center change actions from change_description
      if (entry.change_description) {
        const logEntries = entry.change_description.split('|').map(e => e.trim());
        logEntries.forEach(logEntry => {
          // Match center add/remove actions with timestamp format
          const centerMatch = logEntry.match(/\[([^\]]+)\]\s+([^:]+):\s+Center (Added|Removed):\s*(.+)/);
          if (centerMatch) {
            const editorName = centerMatch[2].trim();
            if (getDisplayName(editorName) === staffName) {
              totalCount++;
            }
          }
          
          // Match shift marker add/remove actions with timestamp format
          const markerAddMatch = logEntry.match(/\[([^\]]+)\]\s+([^:]+):\s+Added\s+"(\w+)"\s+as marker for his shift/);
          const markerRemoveMatch = logEntry.match(/\[([^\]]+)\]\s+([^:]+):\s+Removed\s+"(\w+)"\s+as marker for his shift/);
          
          if (markerAddMatch) {
            const editorName = markerAddMatch[2].trim();
            if (getDisplayName(editorName) === staffName) {
              totalCount++;
            }
          }
          
          if (markerRemoveMatch) {
            const editorName = markerRemoveMatch[2].trim();
            if (getDisplayName(editorName) === staffName) {
              totalCount++;
            }
          }
        });
      }
      
      // For name changes and other edits, count based on last_edited_by
      // Name changes don't have individual timestamps - they use the entry's last_edited_by
      if (entry.last_edited_by && getDisplayName(entry.last_edited_by) === staffName) {
        // Check if this entry has any detailed logs we already counted
        const hasCenterLogs = entry.change_description && 
          (entry.change_description.includes('Center Added') || 
           entry.change_description.includes('Center Removed'));
        
        const hasShiftMarkerLogs = entry.change_description && 
          (entry.change_description.includes('as marker for his shift') || 
           entry.change_description.includes('Removed "') && entry.change_description.includes('as marker for his shift'));
        
        // Check if this is a name change entry
        const isNameChange = entry.change_description && 
          entry.change_description.includes('Name changed from') &&
          entry.change_description.includes(' to ');
        
        // Count name changes (they don't have individual timestamped logs)
        if (isNameChange) {
          totalCount++;
        }
        // Count general edits without detailed logs
        else if (!hasCenterLogs && !hasShiftMarkerLogs) {
          totalCount++;
        }
      }
    });
    
    return totalCount;
  };

  const uniqueStaffNames = getUniqueStaffNames();

  const getShiftColor = (shiftType: string) => {
    const colorMap: Record<string, string> = {
      'Morning Shift (9-4)': 'text-red-600',
      'Evening Shift (4-10)': 'text-blue-600',
      'Saturday Regular (12-10)': 'text-gray-600',
      'Night Duty': 'text-green-600',
      'Sunday/Public Holiday/Special': 'text-purple-600'
    };
    return colorMap[shiftType] || 'text-gray-600';
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      // Check if it's ISO format (contains 'T' or ends with 'Z')
      if (timestamp.includes('T') || timestamp.endsWith('Z')) {
        const date = new Date(timestamp);
        
        // Extract components
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hour = date.getHours().toString().padStart(2, '0');
        const minute = date.getMinutes().toString().padStart(2, '0');
        
        // Format as: dd-mm-yyyy at HHhmm
        return `${day}-${month}-${year} at ${hour}h${minute}`;
      }
      
      // Handle the custom format: "20-01-2025 09:00:00"
      const [datePart, timePart] = timestamp.split(' ');
      const [day, month, year] = datePart.split('-');
      const [hour, minute, second] = timePart.split(':');
      
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second || '0'));
      
      // Format as: dd-mm-yyyy at 23h10
      const formattedDate = `${day}-${month}-${year}`;
      const formattedTime = `${hour}h${minute}`;
      return `${formattedDate} at ${formattedTime}`;
    } catch (error) {
      return timestamp; // Fallback to original if parsing fails
    }
  };

  // Format date for display in log view (Mon 01-Jan-2025)
  const formatLogDate = (dateString: string) => {
    const date = new Date(dateString);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const dayName = dayNames[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const monthName = monthNames[date.getMonth()];
    const year = date.getFullYear();
    
    return `${dayName} ${day}-${monthName}-${year}`;
  };

  return (
    <div className="bg-white rounded-lg">
      {/* Filters */}
      <div className="p-2 sm:p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-2">
          <User className="w-5 h-5 text-gray-600" />
          <label className="text-sm font-medium text-gray-700">Filter by Staff:</label>
          <select
            value={selectedStaff}
            onChange={(e) => setSelectedStaff(e.target.value)}
            className="px-2 py-1 sm:px-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm flex-1 sm:flex-none"
          >
            <option value="all">
              All Staff{filteredEntries.length > 0 ? ` (${filteredEntries.length} ${filteredEntries.length === 1 ? 'Entry' : 'Entries'})` : ''}
            </option>
            {uniqueStaffNames.map(name => {
              // Count total edit actions for this staff member
              const actionCount = getStaffActionCount(name);
              
              return (
                <option key={name} value={name}>
                  {name}{actionCount > 0 ? ` (${actionCount} ${actionCount === 1 ? 'Edit' : 'Edits'})` : ''}
                </option>
              );
            })}

          </select>
        </div>
      </div>

      {/* Log Content */}
      <div className="overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : sortedEntries.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">
              {selectedStaff === 'all' ? 
                (filterType === 'all' ? 'No roster edits found' : 'No name changes found') : 
                `No ${filterType === 'all' ? 'edits' : 'name changes'} found for ${selectedStaff}`}
            </p>
            <p className="text-gray-400 text-sm mt-2">
              {selectedStaff === 'all' ? 
                (filterType === 'all' ? 'No activity to display' : 'Try selecting "All Roster Edits" to see more activity') : 
                'Try selecting a different staff member or filter type'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sortedEntries.map((entry, index) => (
              <div key={entry.id} className="p-2 sm:p-4 hover:bg-gray-50 transition-colors duration-200">
                <div className="flex items-start space-x-3">
                  {/* Timeline dot */}
                  <div className="flex-shrink-0 mt-1">
                    <div className={`w-3 h-3 rounded-full ${
                      entry.shift_type === 'Saturday Regular (12-10)' 
                        ? 'bg-gray-600' 
                        : getShiftColor(entry.shift_type).replace('text-', 'bg-')
                    }`} />
                  </div>
                  
                  {/* Log content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Line 1: Date and Shift */}
                    <div className="w-full overflow-hidden">
                      <ScrollingText className="w-full">
                        <div className="flex items-center space-x-2 whitespace-nowrap">
                          <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <span className="font-medium text-gray-900">
                            {formatLogDate(entry.date)}
                          </span>
                          <span className={`font-medium ${getShiftColor(entry.shift_type)}`}>
                            {getShiftDisplayName(entry.shift_type)}
                          </span>
                        </div>
                      </ScrollingText>
                    </div>
                    
                    {/* Line 2: Main action description */}
                    {(() => {
                      const nameInfo = parseNameChange(entry.change_description || '', entry.assigned_name);
                      
                      // Check if this is a name change
                      const isNameChange = nameInfo.isNameChange && entry.change_description;
                      
                      // Always split and process all pipe-separated log entries
                      const logEntries = entry.change_description?.split('|').map(e => e.trim()) || [];
                      
                      // Separate name change from timestamped center actions
                      const nameChangePart = logEntries.find(e => e.includes('Name changed from'));
                      const centerActionParts = logEntries.filter(e => e.match(/\[([^\]]+)\]\s+([^:]+):\s+Center (Added|Removed):/)).reverse();
                      const shiftMarkerParts = logEntries.filter(e => e.match(/\[([^\]]+)\]\s+([^:]+):\s+(Added "\w+" as marker for his shift|Removed "\w+" as marker for his shift)/)).reverse();
                      
                      // Extract name match for later use
                      const nameMatch = nameChangePart?.match(/Name changed from "([^"]+)" to "([^"]+)"/);
                      
                      // If we have name change AND (center actions OR shift markers), render them all
                      if (nameChangePart && (centerActionParts.length > 0 || shiftMarkerParts.length > 0)) {
                        const elements = [];
                        
                        // Row 1: Name change
                        if (nameMatch) {
                          const oldName = nameMatch[1];
                          const newName = nameMatch[2];
                          
                          elements.push(
                            <div key="name-change" className="w-full overflow-hidden mb-2">
                              <div className="w-full overflow-hidden">
                                <ScrollingText 
                                  text=""
                                  className="w-full"
                                >
                                  <div className="flex items-center space-x-1 whitespace-nowrap">
                                    <div className="flex items-center space-x-1 bg-red-100 px-2 py-1 rounded-lg border border-red-200 flex-shrink-0">
                                      <User className="w-4 h-4 text-red-600" />
                                      <span className="text-red-700 font-semibold line-through text-xs">
                                        {formatDisplayNameForUI(oldName)}
                                      </span>
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-black bg-white rounded-full p-0.5 border-2 border-gray-300 shadow-md flex-shrink-0" />
                                    <div className="flex items-center space-x-1 bg-green-100 px-2 py-1 rounded-lg border border-green-200 flex-shrink-0">
                                      <User className="w-4 h-4 text-green-600" />
                                      <span className="text-green-700 font-semibold text-xs">
                                        {formatDisplayNameForUI(newName)}
                                      </span>
                                    </div>
                                  </div>
                                </ScrollingText>
                              </div>
                            </div>
                          );
                        }
                        
                        // Row 2+: Each center action as separate row
                        centerActionParts.forEach((logEntry, idx) => {
                          const newFormatMatch = logEntry.match(/\[([^\]]+)\]\s+([^:]+):\s+Center (Added|Removed):\s*(.+)/);
                          
                          if (newFormatMatch) {
                            const [, timestamp, editorName, action, centerName] = newFormatMatch;
                            const wasAdded = action === 'Added';
                            
                            let displayName = entry.assigned_name;
                            if (displayName.match(/[A-Z0-9]\(R\)$/)) {
                              displayName = displayName.replace(/\(R\)$/, '').trim();
                            }
                            
                            elements.push(
                              <div key={`center-${idx}`} className="w-full overflow-hidden">
                                <ScrollingText className="w-full">
                                  <div className="flex items-center space-x-1 whitespace-nowrap">
                                    <span className="text-gray-900 font-medium">
                                      {formatDisplayNameForUI(displayName)}
                                    </span>
                                    <ArrowRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                                    <div className={`font-medium flex items-center space-x-2 ${wasAdded ? 'text-indigo-700' : 'text-red-700'}`}>
                                      <span>({wasAdded ? 'Added posting to' : 'Removed posting from'} {centerName})</span>
                                      <span className="text-xs text-gray-500">• {timestamp}</span>
                                    </div>
                                  </div>
                                </ScrollingText>
                              </div>
                            );
                          }
                        });
                        
                        // Row N+: Each shift marker action as separate row
                        shiftMarkerParts.forEach((logEntry, idx) => {
                          const addMatch = logEntry.match(/\[([^\]]+)\]\s+([^:]+):\s+Added\s+"(\w+)"\s+as marker for his shift/);
                          const removeMatch = logEntry.match(/\[([^\]]+)\]\s+([^:]+):\s+Removed\s+"(\w+)"\s+as marker for his shift/);
                          
                          if (addMatch) {
                            const [, timestamp, editorName, marker] = addMatch;
                            let displayName = entry.assigned_name;
                            if (displayName.match(/[A-Z0-9]\(R\)$/)) {
                              displayName = displayName.replace(/\(R\)$/, '').trim();
                            }
                            
                            elements.push(
                              <div key={`marker-${idx}`} className="w-full overflow-hidden">
                                <ScrollingText className="w-full">
                                  <div className="flex items-center space-x-1 whitespace-nowrap">
                                    <span className="text-gray-900 font-medium">
                                      {formatDisplayNameForUI(displayName)}
                                    </span>
                                    <ArrowRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                                    <div className="font-medium text-purple-700 flex items-center space-x-2">
                                      <span>(Added "{marker}" as marker for his shift)</span>
                                      <span className="text-xs text-gray-500">• {timestamp}</span>
                                    </div>
                                  </div>
                                </ScrollingText>
                              </div>
                            );
                          } else if (removeMatch) {
                            const [, timestamp, editorName, marker] = removeMatch;
                            let displayName = entry.assigned_name;
                            if (displayName.match(/[A-Z0-9]\(R\)$/)) {
                              displayName = displayName.replace(/\(R\)$/, '').trim();
                            }
                            
                            elements.push(
                              <div key={`marker-remove-${idx}`} className="w-full overflow-hidden">
                                <ScrollingText className="w-full">
                                  <div className="flex items-center space-x-1 whitespace-nowrap">
                                    <span className="text-gray-900 font-medium">
                                      {formatDisplayNameForUI(displayName)}
                                    </span>
                                    <ArrowRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                                    <div className="font-medium text-red-600 flex items-center space-x-2">
                                      <span>(Removed "{marker}" as marker for his shift)</span>
                                      <span className="text-xs text-gray-500">• {timestamp}</span>
                                    </div>
                                  </div>
                                </ScrollingText>
                              </div>
                            );
                          }
                        });
                        
                        return <>{elements}</>;
                      }
                      
                      // If only name change (no center actions), show simple name change display
                      if (isNameChange && nameMatch) {
                        const oldName = nameMatch[1];
                        const newName = nameMatch[2];
                        
                        return (
                          <div className="w-full overflow-hidden">
                            <div className="w-full overflow-hidden">
                              <ScrollingText 
                                text=""
                                className="w-full"
                              >
                                <div className="flex items-center space-x-1 whitespace-nowrap">
                                  <div className="flex items-center space-x-1 bg-red-100 px-2 py-1 rounded-lg border border-red-200 flex-shrink-0">
                                    <User className="w-4 h-4 text-red-600" />
                                    <span className="text-red-700 font-semibold line-through text-xs">
                                      {formatDisplayNameForUI(oldName)}
                                    </span>
                                  </div>
                                  <ArrowRight className="w-5 h-5 text-black bg-white rounded-full p-0.5 border-2 border-gray-300 shadow-md flex-shrink-0" />
                                  <div className="flex items-center space-x-1 bg-green-100 px-2 py-1 rounded-lg border border-green-200 flex-shrink-0">
                                    <User className="w-4 h-4 text-green-600" />
                                    <span className="text-green-700 font-semibold text-xs">
                                      {formatDisplayNameForUI(newName)}
                                    </span>
                                  </div>
                                </div>
                              </ScrollingText>
                            </div>
                          </div>
                        );
                      }
                      
                      // Otherwise, process center changes normally
                      const centerLogElements = logEntries.map((logEntry, idx) => {
                        const newFormatMatch = logEntry.match(/\[([^\]]+)\]\s+([^:]+):\s+Center (Added|Removed):\s*(.+)/);
                        
                        if (newFormatMatch) {
                          const [, timestamp, editorName, action, centerName] = newFormatMatch;
                          const wasAdded = action === 'Added';
                          
                          let displayName = entry.assigned_name;
                          if (displayName.match(/[A-Z0-9]\(R\)$/)) {
                            displayName = displayName.replace(/\(R\)$/, '').trim();
                          }
                          
                          return (
                            <div key={idx} className="w-full overflow-hidden">
                              <ScrollingText className="w-full">
                                <div className="flex items-center space-x-1 whitespace-nowrap">
                                  <span className="text-gray-900 font-medium">
                                    {formatDisplayNameForUI(displayName)}
                                  </span>
                                  <ArrowRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                                  <div className={`font-medium flex items-center space-x-2 ${wasAdded ? 'text-indigo-700' : 'text-red-700'}`}>
                                    <span>({wasAdded ? 'Added posting to' : 'Removed posting from'} {centerName})</span>
                                    <span className="text-xs text-gray-500">• {timestamp}</span>
                                  </div>
                                </div>
                              </ScrollingText>
                            </div>
                          );
                        }
                        return null;
                      }).reverse().filter(Boolean);
                      
                      // If we found center logs, render them all
                      if (centerLogElements.length > 0) {
                        return <>{centerLogElements}</>;
                      }
                      
                      // Check for shift marker logs
                      const markerLogElements = (() => {
                        if (!entry.change_description) return null;
                        
                        const logEntries = entry.change_description.split('|').map(e => e.trim()).reverse();
                        const elements: JSX.Element[] = [];
                        
                        logEntries.forEach((logEntry, idx) => {
                          
                          // Match format: [timestamp] Editor Name: Added "First" as marker for his shift (Night Duty)
                          const addMatch = logEntry.match(/\[([^\]]+)\]\s+([^:]+):\s+Added\s+"(\w+)"\s+as marker for his shift/);
                          if (addMatch) {
                            const [, timestampRaw, editorName, marker] = addMatch;
                            const timestamp = timestampRaw;
                            
                            elements.push(
                              <div key={`marker-add-${idx}`} className="w-full overflow-hidden">
                                <ScrollingText className="w-full">
                                  <div className="flex items-center space-x-1 whitespace-nowrap">
                                    <span className="text-gray-900 font-medium">
                                      {formatDisplayNameForUI(entry.assigned_name)}
                                    </span>
                                    <ArrowRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                                    <div className="font-medium text-purple-700 flex items-center space-x-2">
                                      <span>(Added "{marker}" as marker for his shift)</span>
                                      <span className="text-xs text-gray-500">• {timestamp}</span>
                                    </div>
                                  </div>
                                </ScrollingText>
                              </div>
                            );
                            return;
                          }
                          
                          // Match format: [timestamp] Editor Name: Removed "FULL" as marker for his shift
                          const removeMatch = logEntry.match(/\[([^\]]+)\]\s+([^:]+):\s+Removed\s+"(\w+)"\s+as marker for his shift/);
                          if (removeMatch) {
                            const [, timestampRaw, editorName, marker] = removeMatch;
                            const timestamp = timestampRaw;
                            
                            elements.push(
                              <div key={`marker-remove-${idx}`} className="w-full overflow-hidden">
                                <ScrollingText className="w-full">
                                  <div className="flex items-center space-x-1 whitespace-nowrap">
                                    <span className="text-gray-900 font-medium">
                                      {formatDisplayNameForUI(entry.assigned_name)}
                                    </span>
                                    <ArrowRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                                    <div className="font-medium text-red-600 flex items-center space-x-2">
                                      <span>(Removed "{marker}" as marker for his shift)</span>
                                      <span className="text-xs text-gray-500">• {timestamp}</span>
                                    </div>
                                  </div>
                                </ScrollingText>
                              </div>
                            );
                          }
                        });
                        
                        if (elements.length > 0) {
                          return <>{elements}</>;
                        }
                        return null;
                      })();
                      
                      if (markerLogElements) {
                        return <>{markerLogElements}</>;
                      }
                      
                      // Default fallback - show nothing for Line 2
                      return null;
                    })()}

                    {/* Line 3: Change description note - HIDDEN for center changes since shown in Line 2 */}
                    {entry.change_description && (
                      (() => {
                        const nameInfo = parseNameChange(entry.change_description, entry.assigned_name);
                        if (!nameInfo.isNameChange) {
                          // Skip displaying center changes and shift marker changes here since they're shown in Line 2
                          const isCenterChange = entry.change_description?.includes('Center Added:') || 
                                                entry.change_description?.includes('Center Removed:') ||
                                                entry.change_description?.includes('- Center:') || 
                                                entry.change_description?.includes('- Removed:');
                          
                          const isShiftMarkerChange = entry.change_description?.includes('as marker for his shift') ||
                                                     entry.change_description?.includes('Cleared shift marker');
                          
                          if (isCenterChange || isShiftMarkerChange) {
                            return null; // Don't show duplicate
                          }
                          
                          return (
                            <div className="w-full overflow-hidden">
                              <ScrollingText className="w-full">
                                <div className="text-xs text-gray-700 whitespace-nowrap">
                                  <span className="font-medium">Note:</span> {entry.change_description}
                                </div>
                              </ScrollingText>
                            </div>
                          );
                        }
                        return null;
                      })()
                    )}
                    
                    {/* Line 4: Editor and timestamp info */}
                    <div className="w-full overflow-hidden">
                      {entry.last_edited_by && (
                        <ScrollingText className="w-full">
                          <div className="flex items-center space-x-2 text-xs text-gray-500 whitespace-nowrap">
                            <User className="w-3 h-3 text-blue-600 flex-shrink-0" />
                            <span className="text-blue-700 font-medium">
                              Modified by {getDisplayName(entry.last_edited_by || 'Unknown')}
                            </span>
                            {entry.last_edited_at && (
                              <>
                                <Clock className="w-3 h-3 text-gray-600 flex-shrink-0" />
                                <span className="text-gray-700 font-medium">
                                  {formatTimestamp(entry.last_edited_at)}
                                </span>
                              </>
                            )}
                          </div>
                        </ScrollingText>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom CSS for arrow animation */}

      {/* Summary */}
      {!loading && sortedEntries.length > 0 && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="text-center text-sm text-gray-600">
            Showing {sortedEntries.length} {filterType === 'all' ? 'roster edit' : 'name change'} {sortedEntries.length === 1 ? 'entry' : 'entries'}
            {selectedStaff !== 'all' && ` for ${selectedStaff}`} (sorted by latest edit first)
          </div>
        </div>
      )}
    </div>
  );
};