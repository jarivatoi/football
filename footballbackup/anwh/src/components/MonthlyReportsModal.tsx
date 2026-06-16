import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, User, Users, List, Download, AlertTriangle, CheckCircle } from 'lucide-react';
import { useRosterData } from '../hooks/useRosterData';
import { individualBillGenerator } from '../utils/pdf/individualBillGenerator';
import { monthlyReportGenerator } from '../utils/pdf/monthlyReportGenerator';
import { rosterListGenerator } from '../utils/pdf/rosterListGenerator';
import { annexureGenerator } from '../utils/pdf/annexureGenerator';
import { getStaffInfo } from '../utils/rosterAuth';
import { formatDisplayNameForUI } from '../utils/rosterDisplayName';
import type { RosterEntry } from '../types/roster';
import { supabase } from '../lib/supabase';

interface MonthlyReportsModalProps {
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

export const MonthlyReportsModal: React.FC<MonthlyReportsModalProps> = ({
  isOpen,
  onClose,
  entries,
  basicSalary,
  hourlyRate,
  shiftCombinations
}) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportType, setReportType] = useState<'all' | 'individual' | 'annexure' | 'roster'>('all');
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [availableStaff, setAvailableStaff] = useState<Array<{ displayName: string; surname: string }>>([]);
  const [generationResult, setGenerationResult] = useState<{
    individualBills: number;
    annexureGenerated: boolean;
    rosterListGenerated: boolean;
    reportType: string;
    staffName?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [numberOfCopies, setNumberOfCopies] = useState(1);

  // Prevent body scroll when modal is open - CRITICAL for iOS
  useEffect(() => {
    if (isOpen) {
      console.log('📱 MonthlyReportsModal: Opening modal, locking body scroll');
      const originalStyle = window.getComputedStyle(document.body).overflow;
      const originalPosition = window.getComputedStyle(document.body).position;
      const originalTop = window.getComputedStyle(document.body).top;
      
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = '0';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.bottom = '0';
      
      return () => {
        console.log('📱 MonthlyReportsModal: Closing modal, restoring body scroll');
        document.body.style.overflow = originalStyle;
        document.body.style.position = originalPosition;
        document.body.style.top = originalTop;
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.bottom = '';
      };
    }
  }, [isOpen]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsGenerating(false);
      setGenerationResult(null);
      setError(null);
      setReportType('all');
      setSelectedStaff('');
      setNumberOfCopies(1);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isGenerating) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, isGenerating, onClose]);

  // Load available staff when month/year changes
  useEffect(() => {
    loadStaffForMonth();
  }, [selectedMonth, selectedYear, entries]);

  const handleGenerateReports = async () => {
    setIsGenerating(true);
    setError(null);
    setGenerationResult(null);
    
    try {
      console.log('🚀 Starting monthly report generation...');
      
      // Try to fetch fresh data from Supabase first, fallback to IndexedDB if offline
      let allEntries;
      try {
        const { fetchRosterEntries } = await import('../utils/rosterApi');
        allEntries = await fetchRosterEntries();
        console.log(`📊 Fetched ${allEntries.length} fresh entries from Supabase`);
      } catch (err) {
        console.warn('⚠️ Could not fetch from Supabase, using IndexedDB:', err);
        allEntries = await (window as any).rosterDb.getRosterEntries();
        console.log(`📊 Using ${allEntries.length} entries from IndexedDB`);
      }
      
      // Filter entries for the month
      const monthEntries = allEntries.filter((entry: any) => {
        const entryDate = new Date(entry.date);
        return entryDate.getMonth() === selectedMonth && entryDate.getFullYear() === selectedYear;
      });
      
      console.log(`📅 Filtered to ${monthEntries.length} entries for ${selectedMonth}/${selectedYear}`);
      
      if (monthEntries.length === 0) {
        throw new Error(`No roster entries found for ${formatMonthYear()}`);
      }
      
      let result = {
        individualBills: 0,
        annexureGenerated: false,
        rosterListGenerated: false,
        reportType: reportType,
        staffName: selectedStaff
      };
      
      if (reportType === 'all') {
        // Generate all reports
        const allResult = await monthlyReportGenerator.generateAllReports({
          month: selectedMonth,
          year: selectedYear,
          entries,
          basicSalary,
          hourlyRate,
          shiftCombinations,
          numberOfCopies
        });
        result = { ...allResult, reportType: 'all', staffName: '' };
        
      } else if (reportType === 'individual') {
        // Generate individual bill for selected staff
        if (!selectedStaff || selectedStaff.trim() === '') {
          throw new Error('Please select a staff member for individual report');
        }
        
        await individualBillGenerator.generateBill({
          staffName: selectedStaff,
          month: selectedMonth,
          year: selectedYear,
          entries: monthEntries,
          basicSalary,
          hourlyRate,
          shiftCombinations,
          numberOfCopies
        });
        
        result.individualBills = 1;
        
      } else if (reportType === 'annexure') {
        // Generate annexure only
        await annexureGenerator.generateAnnexure({
          month: selectedMonth,
          year: selectedYear,
          entries: monthEntries,
          hourlyRate,
          shiftCombinations,
          numberOfCopies
        });
        
        result.annexureGenerated = true;
        
      } else if (reportType === 'roster') {
        // Generate roster list only
        await rosterListGenerator.generateRosterList({
          month: selectedMonth,
          year: selectedYear,
          entries: monthEntries,
          numberOfCopies
        });
        
        result.rosterListGenerated = true;
      }
      
      setGenerationResult(result);
      console.log('✅ Monthly reports generated successfully:', result);
      
    } catch (error) {
      console.error('❌ Monthly report generation failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate reports');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isGenerating) {
      onClose();
    }
  };

  const formatMonthYear = () => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[selectedMonth]} ${selectedYear}`;
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Get count of entries for selected month
  const getMonthEntryCount = () => {
    return entries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate.getMonth() === selectedMonth && entryDate.getFullYear() === selectedYear;
    }).length;
  };

  // Get unique staff members for the selected month
  const loadStaffForMonth = async () => {
    // Clear selected staff before loading new list to prevent invalid selections
    setSelectedStaff('');
    
    const monthEntries = entries.filter(entry => {
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
      setAvailableStaff([]);
      return;
    }
    
    // Fetch all active staff from the institution
    const { data: staffUsers, error } = await supabase
      .from('staff_users')
      .select('id, surname, name, roster_display_name')
      .eq('institution_code', userInstitution)
      .eq('is_active', true);
    
    if (error) {
      setAvailableStaff([]);
      return;
    }
    
    // Match roster entries with staff users
    const validStaffNames: Array<{ displayName: string; surname: string }> = [];
    
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
        
        validStaffNames.push({
          displayName: displayName,
          surname: displayName
        });
      }
    }
    
    // Sort by display name
    validStaffNames.sort((a, b) => a.displayName.localeCompare(b.displayName));
    
    setAvailableStaff(validStaffNames);
  };
  if (!isOpen) return null;

  // Modal content JSX - separated for clarity (like BatchPrintModal)
  const modalContent = (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: window.innerWidth > window.innerHeight ? '4px' : '16px',
        paddingTop: window.innerWidth > window.innerHeight ? '2px' : '16px',
        overflow: 'auto',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        // Force hardware acceleration on iOS
        transform: 'translate3d(0, 0, 0)',
        backfaceVisibility: 'hidden'
      }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full"
        style={{ 
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          maxHeight: window.innerWidth > window.innerHeight ? '98vh' : '90vh',
          display: 'flex',
          flexDirection: 'column',
          // Force hardware acceleration
          transform: 'translate3d(0, 0, 0)',
          backfaceVisibility: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-6 pb-4 border-b border-gray-200 flex-shrink-0">
          {!isGenerating && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>

          <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
            Monthly Reports Generator
          </h3>
          
          <p className="text-sm text-gray-600 text-center">
            Generate end-of-month reports for all staff
          </p>
        </div>

        {/* Content */}
        <div 
          className="flex-1 overflow-y-auto p-6"
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y'
          }}
        >
          {!generationResult && !error && (
            <div className="space-y-6">
              {/* Month/Year Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Month and Year
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      disabled={isGenerating}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                    >
                      {[
                        'January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'
                      ].map((month, index) => (
                        <option key={index} value={index}>{month}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      disabled={isGenerating}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                    >
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="mt-2 text-sm text-gray-600 text-center">
                  {getMonthEntryCount()} entries found for {formatMonthYear()}
                </div>
              </div>

              {/* Report Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Report Type
                </label>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      value="all"
                      checked={reportType === 'all'}
                      onChange={(e) => setReportType(e.target.value as any)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex items-center space-x-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <div>
                        <div className="font-medium text-gray-900">All Reports</div>
                        <div className="text-sm text-gray-600">Generate all three report types</div>
                      </div>
                    </div>
                  </label>
                  
                  <label className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      value="individual"
                      checked={reportType === 'individual'}
                      onChange={(e) => setReportType(e.target.value as any)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex items-center space-x-2">
                      <User className="w-5 h-5 text-green-600" />
                      <div>
                        <div className="font-medium text-gray-900">Individual Staff Bill</div>
                        <div className="text-sm text-gray-600">Generate bill for one staff member</div>
                      </div>
                    </div>
                  </label>
                  
                  <label className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      value="annexure"
                      checked={reportType === 'annexure'}
                      onChange={(e) => setReportType(e.target.value as any)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex items-center space-x-2">
                      <Users className="w-5 h-5 text-purple-600" />
                      <div>
                        <div className="font-medium text-gray-900">Annexure (All Staff Summary)</div>
                        <div className="text-sm text-gray-600">Combined summary for all staff</div>
                      </div>
                    </div>
                  </label>
                  
                  <label className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      value="roster"
                      checked={reportType === 'roster'}
                      onChange={(e) => setReportType(e.target.value as any)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex items-center space-x-2">
                      <List className="w-5 h-5 text-orange-600" />
                      <div>
                        <div className="font-medium text-gray-900">Roster List</div>
                        <div className="text-sm text-gray-600">Simple list of name, date, and shift</div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Staff Selection - Only show when Individual Report is selected */}
              {reportType === 'individual' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Select Staff Member
                  </label>
                  <select
                    value={selectedStaff}
                    onChange={(e) => setSelectedStaff(e.target.value)}
                    disabled={isGenerating}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">Select staff member</option>
                    {availableStaff.map((staff) => (
                      <option key={staff.surname} value={staff.surname}>{staff.displayName}</option>
                    ))}
                    {availableStaff.length === 0 && (
                      <option disabled>No staff with roster entries this month</option>
                    )}
                  </select>
                  
                  {selectedStaff && (
                    <div className="mt-2 text-sm text-gray-600 text-center">
                      Will generate individual bill for {selectedStaff}
                    </div>
                  )}
                </div>
              )}

              {/* Number of Copies */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Number of Copies
                </label>
                <select
                  value={numberOfCopies}
                  onChange={(e) => setNumberOfCopies(Number(e.target.value))}
                  disabled={isGenerating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                >
                  {[1, 2, 3, 4, 5].map(num => (
                    <option key={num} value={num}>{num} {num === 1 ? 'copy' : 'copies'}</option>
                  ))}
                </select>
              </div>

              {/* Report Types Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-3">
                  {reportType === 'all' ? 'Reports to Generate:' : 'Selected Report:'}
                </h4>
                <div className="space-y-3">
                  {(reportType === 'all' || reportType === 'individual') && (
                    <div className="flex items-center space-x-3">
                      <User className="w-5 h-5 text-green-600" />
                      <div>
                        <div className="font-medium text-gray-900">
                          {reportType === 'individual' ? `Individual Bill - ${selectedStaff || 'Select staff'}` : 'Individual Staff Bills'}
                        </div>
                        <div className="text-sm text-gray-600">
                          {reportType === 'individual' ? 'One PDF for selected staff member' : 'One PDF per staff member with their work summary'}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {(reportType === 'all' || reportType === 'annexure') && (
                    <div className="flex items-center space-x-3">
                      <Users className="w-5 h-5 text-purple-600" />
                      <div>
                        <div className="font-medium text-gray-900">Annexure (All Staff Summary)</div>
                        <div className="text-sm text-gray-600">Combined summary for all staff members</div>
                      </div>
                    </div>
                  )}
                  
                  {(reportType === 'all' || reportType === 'roster') && (
                    <div className="flex items-center space-x-3">
                      <List className="w-5 h-5 text-orange-600" />
                      <div>
                        <div className="font-medium text-gray-900">Roster List</div>
                        <div className="text-sm text-gray-600">Simple list showing name, date, and shift</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Warning if no entries */}
              {(getMonthEntryCount() === 0 || (reportType === 'individual' && !selectedStaff)) && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <span className="text-sm text-amber-800 font-medium">
                      {getMonthEntryCount() === 0 
                        ? `No entries found for ${formatMonthYear()}`
                        : 'Please select a staff member for individual report'
                      }
                    </span>
                  </div>
                  <p className="text-sm text-amber-700 mt-1">
                    {getMonthEntryCount() === 0 
                      ? 'Please select a different month or ensure roster data exists.'
                      : 'Choose a staff member from the dropdown above.'
                    }
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Generation Progress */}
          {isGenerating && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                Generating Reports
              </h4>
              <p className="text-gray-600 mb-4">
                Creating PDFs for {formatMonthYear()}...
              </p>
              <div className="space-y-2 text-sm text-gray-500">
                <p>• Generating individual staff bills</p>
                <p>• Creating annexure summary</p>
                <p>• Preparing roster list</p>
              </div>
            </div>
          )}

          {/* Results */}
          {generationResult && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">
                  Reports Generated Successfully!
                </h4>
                <p className="text-gray-600">
                  All reports for {formatMonthYear()} have been created
                </p>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h5 className="font-medium text-green-800 mb-3">Generation Summary:</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-700">Report Type:</span>
                    <span className="text-green-800 font-medium capitalize">{generationResult.reportType}</span>
                  </div>
                  
                  {generationResult.reportType === 'individual' && generationResult.staffName && (
                    <div className="flex justify-between">
                      <span className="text-green-700">Staff Member:</span>
                      <span className="text-green-800 font-medium">{generationResult.staffName}</span>
                    </div>
                  )}
                  
                  {generationResult.individualBills > 0 && (
                    <div className="flex justify-between">
                      <span className="text-green-700">Individual Bills:</span>
                      <span className="text-green-800 font-medium">{generationResult.individualBills} files</span>
                    </div>
                  )}
                  
                  {generationResult.reportType === 'all' || generationResult.reportType === 'annexure' ? (
                    <div className="flex justify-between">
                      <span className="text-green-700">Annexure:</span>
                      <span className="text-green-800 font-medium">
                        {generationResult.annexureGenerated ? '✅ Generated' : '❌ Failed'}
                      </span>
                    </div>
                  ) : null}
                  
                  {generationResult.reportType === 'all' || generationResult.reportType === 'roster' ? (
                    <div className="flex justify-between">
                      <span className="text-green-700">Roster List:</span>
                      <span className="text-green-800 font-medium">
                        {generationResult.rosterListGenerated ? '✅ Generated' : '❌ Failed'}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h5 className="font-medium text-blue-800 mb-2">Files Generated:</h5>
                <ul className="text-sm text-blue-700 space-y-1">
                  {generationResult.individualBills > 0 && (
                    <li>• {generationResult.individualBills} individual staff bill{generationResult.individualBills > 1 ? 's' : ''}</li>
                  )}
                  {generationResult.annexureGenerated && (
                    <li>• 1 annexure summary (all staff)</li>
                  )}
                  {generationResult.rosterListGenerated && (
                    <li>• 1 roster list (name, date, shift)</li>
                  )}
                </ul>
                <p className="text-sm text-blue-600 mt-2">
                  Check your downloads folder for all PDF files.
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                Generation Failed
              </h4>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 flex-shrink-0">
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50"
            >
              {generationResult ? 'Close' : 'Cancel'}
            </button>
            
            {!generationResult && !error && (
              <button
                onClick={handleGenerateReports}
                disabled={isGenerating || getMonthEntryCount() === 0 || (reportType === 'individual' && !selectedStaff)}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>
                      {reportType === 'all' ? 'Generate All Reports' :
                       reportType === 'individual' ? 'Generate Individual Bill' :
                       reportType === 'annexure' ? 'Generate Annexure' : 'Generate Roster List'}
                    </span>
                  </>
                )}
              </button>
            )}
            
            {(generationResult || error) && (
              <button
                onClick={() => {
                  setGenerationResult(null);
                  setError(null);
                }}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
              >
                Generate Again
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};