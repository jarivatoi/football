import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, MapPin, Plus, Trash2, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getUserSession } from '../utils/indexedDB';
import ConfirmationModal from './ConfirmationModal';

interface AttachedCenter {
  id: string;
  institution_code: string;
  marker: string;
  center_name: string;
}

interface CenterManagementModalProps {
  isOpen: boolean;
  staffName: string;
  currentDate?: string;
  currentShift?: string;
  userInstitution?: string | null;
  isAdmin: boolean;
  onClose: () => void;
  onCenterChange?: (staffName: string, centerName: string, action: 'add' | 'remove', editorName: string) => void;
  onCentersUpdated?: () => void; // Add this prop to trigger refresh
}

export const CenterManagementModal: React.FC<CenterManagementModalProps> = ({
  isOpen,
  staffName,
  currentDate,
  currentShift,
  userInstitution,
  isAdmin,
  onClose,
  onCenterChange,
  onCentersUpdated
}) => {
  const [availableCenters, setAvailableCenters] = useState<AttachedCenter[]>([]);
  const [assignedCenters, setAssignedCenters] = useState<string[]>([]); // Store center names
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    newCenter: string | null;
    currentCenter: string | null;
  }>({ isOpen: false, newCenter: null, currentCenter: null });

  // Fetch available centers for user's institution
  useEffect(() => {
    if (isOpen) {
      if (userInstitution) {
        // User has institution - fetch filtered centers
        fetchAvailableCenters();
      } else if (isAdmin) {
        // Admin without institution - this shouldn't happen, but fetch their own institution centers
        // Fetch admin's institution first
        fetchAdminInstitution();
      } else {
        // Non-admin user without institution - showing no centers
      }
      // Non-admin users MUST have institution - if null, they'll see empty list (correct behavior)
    }
  }, [isOpen, userInstitution, isAdmin]);

  const fetchAdminInstitution = async () => {
    try {
      const session = await getUserSession();
      if (session?.userId) {
        const { data: userData } = await supabase
          .from('staff_users')
          .select('institution_code')
          .eq('id', session.userId)
          .single();
        
        if (userData?.institution_code) {
          // Now fetch centers for admin's institution
          setLoading(true);
          const { data, error } = await supabase
            .from('attached_centers')
            .select('*')
            .eq('institution_code', userData.institution_code)
            .order('marker', { ascending: true });

          if (error) throw error;
          if (data) {
            setAvailableCenters(data);
          }
        }
      }
    } catch (error) {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableCenters = async () => {
    if (!userInstitution) {
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('attached_centers')
        .select('*')
        .eq('institution_code', userInstitution)
        .order('marker', { ascending: true });

      if (error) {
        throw error;
      }
      
      if (data) {
        setAvailableCenters(data);
      }
    } catch (error) {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };
  


  // Fetch currently assigned centers for this staff member
  useEffect(() => {
    if (isOpen && staffName && currentDate && currentShift) {
      fetchAssignedCenters();
    }
  }, [isOpen, staffName, currentDate, currentShift]);

  const fetchAssignedCenters = async () => {
    if (!staffName || !currentDate || !currentShift) return;
    
    try {
      // Extract ID from staffName if it exists (format: NAME_ID or NAME_ID(R))
      const staffNameParts = staffName.replace('(R)', '').split('_');
      const hasIdFormat = staffNameParts.length > 1;
      
      let query = supabase
        .from('roster_entries')
        .select('change_description, assigned_name')
        .eq('date', currentDate)
        .eq('shift_type', currentShift);
      
      if (hasIdFormat) {
        // Use ID-based matching (unique identifier)
        const idNumber = staffNameParts[staffNameParts.length - 1];
        query = query.ilike('assigned_name', `%${idNumber}%`);
      } else {
        // Fallback: No ID format, try to match by full name variants
        const baseStaffName = staffName.replace(/\(R\)$/, '').trim();
        query = query.or(`assigned_name.eq.${staffName},assigned_name.eq.${baseStaffName}`);
      }
      
      const { data: entries, error } = await query;

      if (error) throw error;
      
      // Extract center names from change_description
      // Read from RIGHT to LEFT - only the LAST action (rightmost) for each center matters
      const centersSet = new Set<string>();
      entries?.forEach((entry: any) => {
        if (entry.change_description) {
          // Parse new format: "[timestamp] Editor: Center Added/Removed: X"
          // Split by | to get individual log entries
          const logEntries = entry.change_description.split('|').map((e: string) => e.trim());
          
          // Track which centers we've already seen (right-to-left, so first occurrence is the latest)
          const processedCenters = new Set<string>();
          
          // Process from RIGHT to LEFT (last entry is most recent)
          for (let i = logEntries.length - 1; i >= 0; i--) {
            const logEntry = logEntries[i];
            const match = logEntry.match(/\[([^\]]+)\]\s+([^:]+):\s+Center (Added|Removed):\s*(.+)/);
            
            if (match) {
              const [, timestamp, editor, action, centerName] = match;
              
              // Strip out "(Original PDF: ...)" suffix if present
              const cleanCenterName = centerName.replace(/\s*\(Original PDF:[^)]+\)\s*$/, '').trim();
              
              // Only process each center once (the first time we see it = most recent action)
              if (!processedCenters.has(cleanCenterName)) {
                processedCenters.add(cleanCenterName);
                
                if (action === 'Added') {
                  centersSet.add(cleanCenterName);
                } else {
                }
              }
            }
          }
          
          // Fallback: Also check for old format for backwards compatibility (only if no new format found)
          if (processedCenters.size === 0) {
            if (entry.change_description.includes('Center Added:')) {
              const centerMatch = entry.change_description.match(/Center Added:\s*([^;|]+?)(?:\s*-\s*Marker:|\s*\||$)/);
              if (centerMatch && centerMatch[1].trim()) {
                const cleanCenterName = centerMatch[1].trim().replace(/\s*\(Original PDF:[^)]+\)\s*$/, '');
                centersSet.add(cleanCenterName);
              }
            }
            if (entry.change_description.includes('Center Removed:')) {
              const removedMatch = entry.change_description.match(/Center Removed:\s*([^;|]+)/);
              if (removedMatch && removedMatch[1].trim()) {
                const cleanCenterName = removedMatch[1].trim().replace(/\s*\(Original PDF:[^)]+\)\s*$/, '');
                centersSet.delete(cleanCenterName);
              }
            }
          }
        }
      });
      
      const centers = Array.from(centersSet);

      setAssignedCenters(centers);
    } catch (error) {
      // Error handled silently
    }
  };

  const handleToggleCenter = async (centerName: string) => {
    if (!staffName || !currentDate || !currentShift) {
      return;
    }
      
    const isAdding = !assignedCenters.includes(centerName);
    
    // VALIDATION: A staff can only have ONE center at a time
    if (isAdding && assignedCenters.length > 0) {
      const currentCenter = assignedCenters[0];
      
      // Show confirmation modal instead of window.confirm
      setConfirmModal({
        isOpen: true,
        newCenter: centerName,
        currentCenter: currentCenter
      });
      return; // Stop here, will be called again after confirmation
    }
    
    setSaving(true);
    try {
      // Get current user info for logging
      const session = await getUserSession();
      let editorName = 'Unknown';
      if (session) {
        const { data: userData } = await supabase
          .from('staff_users')
          .select('surname, name')
          .eq('id', session.userId)
          .single();
          
        if (userData) {
          editorName = `${userData.surname}, ${userData.name}`;
        }
      }
        
      // Find the roster entry - use only ONE entry for all center changes
      // Extract ID from staffName if it exists (format: NAME_ID or NAME_ID(R))
      const staffNameParts = staffName.split('_');
      const hasIdFormat = staffNameParts.length > 1;
      
      let query = supabase
        .from('roster_entries')
        .select('id, change_description')
        .eq('date', currentDate)
        .eq('shift_type', currentShift);
      
      if (hasIdFormat) {
        // Use ID-based matching (unique identifier)
        const idNumber = staffNameParts[staffNameParts.length - 1].replace('(R)', '');
        query = query.ilike('assigned_name', `%${idNumber}%`);
      } else {
        // Fallback to full name match (with or without (R))
        query = query.or(`assigned_name.eq.${staffName},assigned_name.eq.${staffName}(R)`);
      }
      
      const { data: entries } = await query
        .order('created_at', { ascending: true })
        .limit(1);
        
      if (!entries || entries.length === 0) {
        alert('No roster entry found for this staff member');
        return;
      }
      
      // Use only the first entry - all center changes go into this single entry
      const entry = entries[0];
      let newChangeDescription = entry.change_description || '';
          
      // Format timestamp as DD-MM-YYYY HH:mm:ss
      const now = new Date();
      const day = now.getDate().toString().padStart(2, '0');
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const year = now.getFullYear();
      const hour = now.getHours().toString().padStart(2, '0');
      const minute = now.getMinutes().toString().padStart(2, '0');
      const second = now.getSeconds().toString().padStart(2, '0');
      const formattedTimestamp = `${day}-${month}-${year} ${hour}:${minute}:${second}`;
          
      // STEP 1: Remove ALL old center-related entries (both Added and Removed)
      // Remove pipe-separated entries like "| [timestamp] Editor: Center Added: XXX"
      newChangeDescription = newChangeDescription
        .replace(/\s*\|\s*\[[^\]]+\]\s+[^:]+:\s+Center (Added|Removed):\s*[^|]+/g, '')
        .trim();
      
      // Remove standalone entries at the start (no pipe)
      newChangeDescription = newChangeDescription
        .replace(/^\s*\[[^\]]+\]\s+[^:]+:\s+Center (Added|Removed):\s*[^|]+\s*\|?\s*/g, '')
        .trim();
      
      // STEP 2: Remove ALL old markers
      newChangeDescription = newChangeDescription
        .replace(/\s*\|\s*- Marker:\s*\*+/g, '')
        .replace(/- Marker:\s*\*+/g, '')
        .trim();
          
      // STEP 3: Add ONLY the new center action (Added or Removed)
      const logEntry = `[${formattedTimestamp}] ${editorName}: Center ${isAdding ? 'Added' : 'Removed'}: ${centerName}`;
      newChangeDescription = logEntry;
      
      // STEP 4: If adding, also add the new marker (MUST BE LAST)
      if (isAdding) {
        const centerData = availableCenters.find(c => c.center_name === centerName);
        if (centerData) {
          newChangeDescription = `${newChangeDescription} | - Marker: ${centerData.marker}`;
        }
      }
          
      const { error: updateError } = await supabase
        .from('roster_entries')
        .update({
          change_description: newChangeDescription || null,
          last_edited_by: editorName,
          last_edited_at: formattedTimestamp
        })
        .eq('id', entry.id);

      const centerData = availableCenters.find(c => c.center_name === centerName);

      if (updateError) {
        throw updateError;
      }
        
      // Update local state immediately to reflect the change
      if (isAdding) {
        setAssignedCenters([centerName]); // Only ONE center allowed
      } else {
        setAssignedCenters(assignedCenters.filter(c => c !== centerName));
      }
      
      // Notify parent to refresh roster data
      if (onCentersUpdated) {
        onCentersUpdated();
      }
      
      // Dispatch rosterUpdated event to trigger global refresh
      window.dispatchEvent(new CustomEvent('rosterUpdated'));
      
      // Call parent handler if provided (for logging)
      // Always use base name (without (R)) for consistency in logs
      const baseStaffNameForLog = staffName.replace(/\(R\)$/, '').trim();
      if (onCenterChange) {
        onCenterChange(baseStaffNameForLog, centerName, isAdding ? 'add' : 'remove', editorName);
      }
    } catch (error) {
      alert('Failed to update center assignment');
    } finally {
      setSaving(false);
    }
  };

  // Handle confirmation of center change
  const handleConfirmCenterChange = async () => {
    if (!confirmModal.newCenter || !confirmModal.currentCenter) {
      return;
    }
    
    // First remove the current center
    setSaving(true);
    try {
      const session = await getUserSession();
      let editorName = 'Unknown';
      if (session) {
        const { data: userData } = await supabase
          .from('staff_users')
          .select('surname, name')
          .eq('id', session.userId)
          .single();
          
        if (userData) {
          editorName = `${userData.surname}, ${userData.name}`;
        }
      }
      
      const staffNameParts = staffName.split('_');
      const hasIdFormat = staffNameParts.length > 1;
      
      let query = supabase
        .from('roster_entries')
        .select('id, change_description')
        .eq('date', currentDate)
        .eq('shift_type', currentShift);
      
      if (hasIdFormat) {
        const idNumber = staffNameParts[staffNameParts.length - 1].replace('(R)', '');
        query = query.ilike('assigned_name', `%${idNumber}%`);
      } else {
        query = query.or(`assigned_name.eq.${staffName},assigned_name.eq.${staffName}(R)`);
      }
      
      const { data: entries } = await query
        .order('created_at', { ascending: true })
        .limit(1);
        
      if (entries && entries.length > 0) {
        const entry = entries[0];
        let newChangeDescription = entry.change_description || '';
        
        const now = new Date();
        const day = now.getDate().toString().padStart(2, '0');
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const year = now.getFullYear();
        const hour = now.getHours().toString().padStart(2, '0');
        const minute = now.getMinutes().toString().padStart(2, '0');
        const second = now.getSeconds().toString().padStart(2, '0');
        const formattedTimestamp = `${day}-${month}-${year} ${hour}:${minute}:${second}`;
        
        // STEP 1: Remove ALL old center-related entries
        newChangeDescription = newChangeDescription
          .replace(/\s*\|\s*\[[^\]]+\]\s+[^:]+:\s+Center (Added|Removed):\s*[^|]+/g, '')
          .trim();
        
        newChangeDescription = newChangeDescription
          .replace(/^\s*\[[^\]]+\]\s+[^:]+:\s+Center (Added|Removed):\s*[^|]+\s*\|?\s*/g, '')
          .trim();
        
        // STEP 2: Remove ALL old markers
        newChangeDescription = newChangeDescription
          .replace(/\s*\|\s*- Marker:\s*\*+/g, '')
          .replace(/- Marker:\s*\*+/g, '')
          .trim();
        
        // STEP 3: Build clean change_description with only the new center
        // Start with removal log (optional - we could skip this if you want ONLY the Added)
        const removeLogEntry = `[${formattedTimestamp}] ${editorName}: Center Removed: ${confirmModal.currentCenter}`;
        newChangeDescription = removeLogEntry;
        
        // Add the new center
        const newCenterData = availableCenters.find(c => c.center_name === confirmModal.newCenter);
        const addLogEntry = `[${formattedTimestamp}] ${editorName}: Center Added: ${confirmModal.newCenter}`;
        newChangeDescription = `${newChangeDescription} | ${addLogEntry}`;
        
        // Add the marker for the new center (MUST BE LAST)
        if (newCenterData) {
          newChangeDescription = `${newChangeDescription} | - Marker: ${newCenterData.marker}`;
        }
        
        await supabase
          .from('roster_entries')
          .update({
            change_description: newChangeDescription || null,
            last_edited_by: editorName,
            last_edited_at: formattedTimestamp
          })
          .eq('id', entry.id);
        
        // Update local state
        setAssignedCenters([confirmModal.newCenter]);
        
        // Notify parent to refresh roster data
        if (onCentersUpdated) {
          onCentersUpdated();
        }
        
        // Dispatch rosterUpdated event to trigger global refresh
        window.dispatchEvent(new CustomEvent('rosterUpdated'));
        
        // Call parent handler if provided (for logging)
        const baseStaffNameForLog = staffName.replace(/\(R\)$/, '').trim();
        if (onCenterChange) {
          onCenterChange(baseStaffNameForLog, confirmModal.newCenter!, 'add', editorName);
        }
      }
    } catch (error) {
      alert('Failed to update center assignment');
    } finally {
      setSaving(false);
      setConfirmModal({ isOpen: false, newCenter: null, currentCenter: null });
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {createPortal(
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[999999]"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999999,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative p-6 pb-4 border-b border-gray-200 flex-shrink-0">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Manage Centers</h3>
                  <p className="text-sm text-gray-600">{formatDisplayNameForUI(staffName)}</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading centers...</div>
              ) : availableCenters.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No centers configured for your institution
                </div>
              ) : (
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900 mb-3">Available Centers:</h4>
                  
                  {availableCenters.map((center) => {
                    const isAssigned = assignedCenters.includes(center.center_name);
                    
                    return (
                      <div
                        key={center.id}
                        className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all duration-200 ${
                          isAssigned
                            ? 'border-gray-300 bg-gray-100 opacity-60'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center space-x-3 flex-1">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            isAssigned ? 'bg-gray-300 text-gray-600' : 'bg-indigo-100 text-indigo-800'
                          }`}>
                            {center.marker}
                          </span>
                          <span className={`font-medium ${
                            isAssigned ? 'text-gray-500' : 'text-gray-900'
                          }`}>
                            {center.center_name}
                          </span>
                          {isAssigned && (
                            <span className="ml-2 text-xs text-gray-500 font-medium">(Assigned)</span>
                          )}
                        </div>
                        
                        {!isAssigned && (
                          <button
                            onClick={() => handleToggleCenter(center.center_name)}
                            disabled={saving}
                            className="p-2 rounded bg-green-100 text-green-600 hover:bg-green-200 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              
              {assignedCenters.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-3">Currently Assigned To:</h4>
                  <div className="space-y-2">
                    {(() => {
                      return assignedCenters.map((centerName) => {
                        // Try to find the marker for this center
                        const centerData = availableCenters.find(c => c.center_name === centerName);
                        
                        return (
                          <div key={centerName} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center space-x-2 flex-1">
                              {centerData && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                  {centerData.marker}
                                </span>
                              )}
                              <span className="font-medium text-green-900">{centerData?.center_name || centerName}</span>
                            </div>
                            <button
                              onClick={() => handleToggleCenter(centerName)}
                              disabled={saving}
                              className="p-2 rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Confirmation Modal for Center Change - Separate Portal */}
      <ConfirmationModalPortal
        isOpen={confirmModal.isOpen}
        currentCenter={confirmModal.currentCenter}
        newCenter={confirmModal.newCenter}
        onConfirm={handleConfirmCenterChange}
        onCancel={() => setConfirmModal({ isOpen: false, newCenter: null, currentCenter: null })}
      />
    </>
  );
};

// Also render the confirmation modal separately to ensure it appears on top
const ConfirmationModalPortal: React.FC<{
  isOpen: boolean;
  currentCenter: string | null;
  newCenter: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ isOpen, currentCenter, newCenter, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  
  return createPortal(
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999999]"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999999,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">Confirm Center Change</h3>
        
        {currentCenter && newCenter && (
          <div className="mb-6">
            <p className="mb-2">
              This staff member is already assigned to <strong>"{currentCenter}"</strong>.
            </p>
            <p className="mb-2">
              Do you want to change the assignment to <strong>"{newCenter}"</strong>?
            </p>
            <p className="text-sm text-gray-500">
              This will remove the previous assignment.
            </p>
          </div>
        )}
        
        <div className="flex space-x-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
          >
            Change Center
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Helper function
const formatDisplayNameForUI = (name: string): string => {
  // Simple formatting - remove ID suffix if present
  const parts = name.split('_');
  if (parts.length > 1) {
    return parts[0].replace(/_/g, ' ');
  }
  return name;
};

export default CenterManagementModal;
