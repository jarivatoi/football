import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { batchPrintManager, BatchPrintOptions, BatchPrintProgress } from '../utils/pdf/batchPrintManager';
import { RosterEntry } from '../types/roster';
import { getStaffInfo } from '../utils/rosterAuth';
import { formatDisplayNameForUI } from '../utils/rosterDisplayName';
import { supabase } from '../lib/supabase';

interface BatchPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: RosterEntry[];
  basicSalary: number;
  hourlyRate: number;
  shiftCombinations: Array<{
    id: string;
    combination: string;
    hours: number;
  }>;
}

export const BatchPrintModal: React.FC<BatchPrintModalProps> = ({
  isOpen,
  onClose,
  entries,
  basicSalary,
  hourlyRate,
  shiftCombinations
}) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportTypes, setReportTypes] = useState<('individual' | 'annexure' | 'roster')[]>(['individual', 'annexure', 'roster']);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<BatchPrintProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availableStaff, setAvailableStaff] = useState<string[]>([]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Get unique staff members for the selected month (formatted for display)
  const getUniqueStaffMembers = async (): Promise<string[]> => {
    // Try to fetch fresh data from Supabase first, fallback to props if offline
    let allEntries;
    try {
      const { fetchRosterEntries } = await import('../utils/rosterApi');
      allEntries = await fetchRosterEntries();
    } catch (err) {
      console.warn('⚠️ Could not fetch from Supabase, using props:', err);
      allEntries = entries;
    }
    
    const monthEntries = allEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate.getMonth() === selectedMonth && entryDate.getFullYear() === selectedYear;
    });

    // First, get all unique roster_display_names from entries for this month
    const rosterDisplayNameSet = new Set<string>();
    monthEntries.forEach(entry => {
      // Keep the full roster_display_name from entries
      rosterDisplayNameSet.add(entry.assigned_name);
    });

    // Get current user's institution
    const { getCurrentInstitutionDetails } = await import('../utils/institutionHelper');
    const institution = await getCurrentInstitutionDetails();
    const userInstitution = institution?.code;
    
    if (!userInstitution) {
      return [];
    }
    
    // Fetch all active staff from the institution
    const { data: staffUsers, error } = await supabase
      .from('staff_users')
      .select('id, surname, name, roster_display_name')
      .eq('institution_code', userInstitution)
      .eq('is_active', true);
    
    if (error) {
      return [];
    }
    
    // Match roster entries with staff users
    const validStaffNames: string[] = [];
    
    for (const rosterDisplayName of rosterDisplayNameSet) {
      // Try to find a matching staff user
      // First, try exact match on roster_display_name
      let matchedUser = staffUsers?.find((u: any) => u.roster_display_name === rosterDisplayName);
      
      // If not found, try matching by parsing the roster display name
      if (!matchedUser) {
        const { parseRosterDisplayName } = await import('../utils/rosterDisplayName');
        const parsed = parseRosterDisplayName(rosterDisplayName);
        
        // Try matching by surname + id_number (more strict)
        matchedUser = staffUsers?.find((u: any) => 
          u.surname === parsed.surname && u.id_number === parsed.idNumber
        );
      }
      
      // NO fallback to surname-only matching - this was causing staff from other months to appear
      
      if (matchedUser) {
        // Use formatDisplayNameForUI to get the clean display name for UI
        const { formatDisplayNameForUI } = await import('../utils/rosterDisplayName');
        let displayName = formatDisplayNameForUI(matchedUser.roster_display_name || rosterDisplayName);
        
        // Strip (R) suffix ONLY if it's a modification marker
        if (displayName.endsWith('(R)')) {
          const beforeR = displayName.slice(0, -3);
          if (!beforeR.endsWith('_')) {
            displayName = beforeR.trim();
          }
        }
        
        validStaffNames.push(displayName);
      }
    }
    
    return validStaffNames.sort();
  };

  // Load staff when month/year changes
  useEffect(() => {
    const loadStaff = async () => {
      // Clear selected staff before loading new list to prevent invalid selections
      setSelectedStaff([]);
      const staff = await getUniqueStaffMembers();
      setAvailableStaff(staff);
    };
    loadStaff();
  }, [selectedMonth, selectedYear]);

  const handleReportTypeChange = (type: 'individual' | 'annexure' | 'roster', checked: boolean) => {
    if (checked) {
      setReportTypes(prev => [...prev, type]);
    } else {
      setReportTypes(prev => prev.filter(t => t !== type));
    }
  };

  const handleStaffSelection = (staffName: string, checked: boolean) => {
    if (checked) {
      setSelectedStaff(prev => [...prev, staffName]);
    } else {
      setSelectedStaff(prev => prev.filter(s => s !== staffName));
    }
  };

  const handleSelectAllStaff = () => {
    setSelectedStaff(availableStaff);
  };

  const handleDeselectAllStaff = () => {
    setSelectedStaff([]);
  };

  const handleGeneratePDF = async () => {
    if (reportTypes.length === 0) {
      setError('Please select at least one report type');
      return;
    }

    if (reportTypes.includes('individual') && selectedStaff.length === 0) {
      setError('Please select at least one staff member for individual reports');
      return;
    }


    setIsProcessing(true);
    setError(null);
    setProgress(null);

    const options: BatchPrintOptions = {
      month: selectedMonth,
      year: selectedYear,
      entries: entries,
      basicSalary: basicSalary,
      hourlyRate: hourlyRate,
      shiftCombinations: shiftCombinations,
      reportTypes: reportTypes,
      selectedStaff: reportTypes.includes('individual') ? selectedStaff : undefined,
      combineIntoSinglePDF: true
    };

    try {
      await batchPrintManager.generateCombinedPDF(options, setProgress);
    } catch (err) {
      let errorMessage = err instanceof Error ? err.message : 'Failed to generate batch print';
      
      // Provide more specific guidance for popup blocker issues
      if (errorMessage.includes('Unable to open print window') || errorMessage.includes('popup')) {
        errorMessage = 'Browser blocked the print window popup. Please disable your browser\'s popup blocker for this site and try again. You can usually do this by clicking the popup blocker icon in your address bar.';
      }
      
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };


  const handleClose = () => {
    if (!isProcessing) {
      batchPrintManager.cleanup();
      onClose();
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Batch Print & Download</h2>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Month/Year Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Select Month & Year</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  disabled={isProcessing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
                >
                  {monthNames.map((month, index) => (
                    <option key={index} value={index}>{month}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  disabled={isProcessing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
                >
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Report Types */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Report Types</h3>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={reportTypes.includes('individual')}
                  onChange={(e) => handleReportTypeChange('individual', e.target.checked)}
                  disabled={isProcessing}
                  className="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded disabled:opacity-50"
                />
                <span className="text-sm font-medium text-gray-700">Individual Bills</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={reportTypes.includes('annexure')}
                  onChange={(e) => handleReportTypeChange('annexure', e.target.checked)}
                  disabled={isProcessing}
                  className="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded disabled:opacity-50"
                />
                <span className="text-sm font-medium text-gray-700">Annexure Summary</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={reportTypes.includes('roster')}
                  onChange={(e) => handleReportTypeChange('roster', e.target.checked)}
                  disabled={isProcessing}
                  className="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded disabled:opacity-50"
                />
                <span className="text-sm font-medium text-gray-700">Roster List</span>
              </label>
            </div>
          </div>

          {/* Print Mode */}

          {/* Staff Selection (only show if individual reports selected) */}
          {reportTypes.includes('individual') && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Select Staff</h3>
                <div className="space-x-2">
                  <button
                    onClick={handleSelectAllStaff}
                    disabled={isProcessing}
                    className="text-sm text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                  >
                    Select All
                  </button>
                  <button
                    onClick={handleDeselectAllStaff}
                    disabled={isProcessing}
                    className="text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                {availableStaff.length === 0 ? (
                  <p className="text-sm text-gray-500">No staff found for selected month</p>
                ) : (
                  <div className="space-y-2">
                    {availableStaff.map(staffName => (
                      <label key={staffName} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedStaff.includes(staffName)}
                          onChange={(e) => handleStaffSelection(staffName, e.target.checked)}
                          disabled={isProcessing}
                          className="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded disabled:opacity-50"
                        />
                        <span className="text-sm text-gray-700">{staffName}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Progress */}
          {progress && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-3 mb-2">
                {progress.completed ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                )}
                <span className="text-sm font-medium text-gray-900">
                  {progress.currentTask}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {progress.current} of {progress.total} tasks completed
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="text-sm text-red-800">{error}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : 'Cancel'}
          </button>
          <button
            onClick={handleGeneratePDF}
            disabled={isProcessing || reportTypes.length === 0}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
          >
            <Printer className="w-4 h-4" />
            <span>
              Print PDF
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};