import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RosterEntry } from '../../types/roster';
import { formatMauritianRupees } from '../currency';
import { getStaffInfo, getStaffSalary } from '../rosterAuth';
import { extractBaseSurname } from '../rosterFilters';
import { formatDisplayNameForUI } from '../rosterDisplayName';
import { getCurrentInstitutionDetails, formatInstitutionHeader } from '../institutionHelper';
import { supabase } from '../../lib/supabase';

export interface AnnexureOptions {
  month: number;
  year: number;
  entries: RosterEntry[];
  hourlyRate: number;
  shiftCombinations: Array<{
    id: string;
    combination: string;
    hours: number;
  }>;
  numberOfCopies?: number;
}

export class AnnexureGenerator {
  
  /**
   * Format number without trailing zeros and hide if zero
   */
  private formatNumber(value: number): string {
    if (value === 0) return '';
    return value % 1 === 0 ? value.toString() : value.toFixed(2).replace(/\.?0+$/, '');
  }
  
  /**
   * Format currency without trailing zeros and hide if zero
   */
  private formatCurrency(value: number): string {
    if (value === 0) return '';
    return `Rs ${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }
  
  /**
   * Format salary without decimal places
   */
  private formatSalary(value: number): string {
    if (value === 0) return '';
    return `Rs ${value.toLocaleString('en-US')}`;
  }

  /**
   * Generate annexure matching the exact PDF format
   */
  async generateAnnexure(options: AnnexureOptions): Promise<void> {
    const { month, year, numberOfCopies = 1 } = options;
    
    // Generate the specified number of copies
    for (let copy = 1; copy <= numberOfCopies; copy++) {
      await this.generateSingleAnnexure(options, copy, numberOfCopies);
    }
  }
  
  /**
   * Generate a single annexure copy
   */
  private async generateSingleAnnexure(options: AnnexureOptions, copyNumber: number, totalCopies: number): Promise<void> {
    const { month, year } = options;
    
    // Create PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Generate content
    await this.generateAnnexureContent(doc, options, copyNumber, totalCopies);
    
    // Generate filename and save
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    let filename = `Annexure_${monthNames[month]}_${year}`;
    if (totalCopies > 1) {
      filename += `_Copy${copyNumber}`;
    }
    filename += '.pdf';
    
    doc.save(filename);
    
    console.log(`✅ Annexure generated (${copyNumber}/${totalCopies}):`, filename);
  }
  
  /**
   * Generate annexure content into provided PDF document (for batch printing)
   */
  async generateAnnexureContent(doc: jsPDF, options: AnnexureOptions, copyNumber?: number, totalCopies?: number): Promise<void> {
    const { month, year, entries, hourlyRate, shiftCombinations } = options;
    
    console.log(`📄 Annexure - Received ${entries.length} entries for ${month}/${year}`);
    
    // Get institution details
    const institutionDetails = await getCurrentInstitutionDetails();
    const userInstitution = institutionDetails?.code;
    
    console.log(`🏢 Annexure - Institution: ${userInstitution}, Entries to process: ${entries.length}`);
    
    console.log('📄 Generating annexure for all staff');
    
    // Get institution details for header
    const institutionHeader = formatInstitutionHeader(institutionDetails);
    console.log('🏥 Generating annexure for institution:', institutionDetails?.name || 'Default');
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    // Header - institution-specific format
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    
    // Use institution-specific header (supports multiple lines)
    institutionHeader.forEach((line, index) => {
      const yPosition = 15 + (index * 6); // 6mm spacing between lines
      doc.text(line, doc.internal.pageSize.getWidth() / 2, yPosition, { align: 'center' });
    });
    
    doc.setFontSize(12);
    let headerText = `ANNEXURE - ${monthNames[month]} ${year}`;
    if (copyNumber && totalCopies && totalCopies > 1) {
      headerText += ` (Copy ${copyNumber}/${totalCopies})`;
    }
    doc.text(headerText, doc.internal.pageSize.getWidth() / 2, 25 + (institutionHeader.length - 1) * 6, { align: 'center' });
    
    // Calculate summary for all staff
    const staffSummaries = await this.calculateStaffSummaries(entries, month, year, hourlyRate, shiftCombinations);
    
    // Prepare table data - matching the PDF format exactly
    const tableData = staffSummaries.map((summary, index) => [
      (index + 1).toString(), // Serial number
      summary.fullName, // Full name instead of staff name
      summary.employeeId, // ID number
      this.formatSalary(summary.salary), // Salary (no decimals)
      this.formatNumber(summary.totalHours), // Hours payable (without night allowance)
      this.formatNumber(summary.nightDutyHours), // Night allowance hours
      this.formatCurrency(summary.grandTotal)
    ]);
    
    // Create table matching the original format
    autoTable(doc, {
      startY: 35,
      head: [['S.No', 'NAME\n(Full Name)', 'ID\nNUMBER', 'SALARY', 'NO OF HRS\nPAYABLE\n(Hrs)', 'NIGHT\nALLOWANCE\n(Hrs)', 'AMOUNT']],
      body: tableData,
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak',
        halign: 'center',
        valign: 'middle',
        fontStyle: 'bold'
      },
      headStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
        valign: 'middle',
        cellPadding: 2,
        minCellHeight: 8
      },
      margin: { left: 5, right: 5 },
      theme: 'grid',
      tableWidth: 'auto',
      tableLineWidth: 0.3,
      tableLineColor: [0, 0, 0],
      columnStyles: {
        1: { cellWidth: 40 } // Wider column for NAME with multi-line support
      },
      didParseCell: function(data) {
        // Auto-adjust font size based on content length
        if (data.section === 'body') {
          const cellText = data.cell.text.join(' ');
          if (cellText.length > 20) {
            
            //data.cell.styles.fontSize = 6;
            data.cell.styles.fontSize = 9;
          } else if (cellText.length > 10) {
            //data.cell.styles.fontSize = 7;
         data.cell.styles.fontSize = 9;
          } else {
            data.cell.styles.fontSize = 9;
          }
        }
      }
    });
    
    // Get final Y position after table
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // Check if we have enough space for footer
    const pageHeight = doc.internal.pageSize.getHeight();
    const spaceNeeded = 50; // Reduced space needed for just footer
    const spaceRemaining = pageHeight - finalY;
    
    // If not enough space, add a new page
    if (spaceRemaining < spaceNeeded) {
      doc.addPage();
      // Add institution header on new page
      institutionHeader.forEach((line, index) => {
        const yPosition = 15 + (index * 6);
        doc.text(line, doc.internal.pageSize.getWidth() / 2, yPosition, { align: 'center' });
      });
    }
    
    // Footer section - always at bottom of last page
    const footerY = doc.internal.pageSize.getHeight() - 45;
    
    // Signature section in footer area
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Certified correct as per annexture:-_________________________', 80, footerY);
    doc.text('(Principal Medical Imaging Technologist):', 95, footerY + 15);
    
    // System info at very bottom
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    const currentYear = now.getFullYear();
    doc.text(`Generated on: ${day}/${currentMonth}/${currentYear}`, 15, doc.internal.pageSize.getHeight() - 15);
    doc.text('X-ray ANWH System', doc.internal.pageSize.getWidth() - 15, doc.internal.pageSize.getHeight() - 15, { align: 'right' });
  }
  
  
  /**
   * Calculate summaries for all staff with night allowance
   */
  private async calculateStaffSummaries(
    entries: RosterEntry[], 
    month: number, 
    year: number, 
    hourlyRate: number, 
    shiftCombinations: Array<{id: string, combination: string, hours: number}>
  ) {
    const staffSummaries: Array<{
      staffName: string;
      fullName: string;
      employeeId: string;
      salary: number;
      totalDays: number;
      totalHours: number;
      totalAmount: number;
      nightDutyCount: number;
      nightDutyHours: number;
      nightAllowance: number;
      grandTotal: number;
    }> = [];
    
    // Group entries by staff (using smart name formatting)
    const staffGroups: Record<string, { entries: RosterEntry[]; displayName: string }> = {};
    
    entries.forEach(entry => {
      const entryDate = new Date(entry.date);
      if (entryDate.getMonth() === month && entryDate.getFullYear() === year) {
        // Use formatDisplayNameForUI to strip ID number first
        let displayName = formatDisplayNameForUI(entry.assigned_name);
        
        // Strip (R) suffix ONLY if it's a modification marker (not preceded by underscore)
        // e.g., "NARAYYA(R)" → "NARAYYA" (modification marker)
        // But "NARAYYA_(R)" stays as "NARAYYA_(R)" ((R) IS the identifier)
        if (displayName.endsWith('(R)')) {
          const beforeR = displayName.slice(0, -3);
          if (!beforeR.endsWith('_')) {
            displayName = beforeR.trim();
          }
        }
        
        // Use uppercase clean name as grouping key
        const groupKey = displayName.toUpperCase();
        
        if (!staffGroups[groupKey]) {
          staffGroups[groupKey] = { entries: [], displayName };
        }
        staffGroups[groupKey].entries.push(entry);
      }
    });
    
    // Calculate for each staff member who actually has entries
    for (const [groupKey, groupData] of Object.entries(staffGroups)) {
      const staffEntries = groupData.entries;
      const displayName = groupData.displayName;
      
      let totalHours = 0;
      let nightDutyCount = 0;
      let nightDutyHours = 0;
      
      staffEntries.forEach(entry => {
        // Count night duties for allowance calculation
        if (entry.shift_type === 'Night Duty') {
          nightDutyCount++;
        }
        
        // Map and calculate hours
        const shiftMapping: Record<string, string> = {
          'Morning Shift (9-4)': '9-4',
          'Evening Shift (4-10)': '4-10',
          'Saturday Regular (12-10)': '12-10',
          'Night Duty': 'N',
          'Sunday/Public Holiday/Special': '9-4'
        };
        
        const shiftId = shiftMapping[entry.shift_type];
        if (shiftId) {
          const combination = shiftCombinations.find(combo => combo.id === shiftId);
          if (combination) {
            // Special case: Night Duty should use 11 hours (since allowances are paid separately)
            const hoursToUse = entry.shift_type === 'Night Duty' ? 11 : combination.hours;
            totalHours += hoursToUse;
          }
        }
      });
      
      // Calculate night allowance hours: (number of nights) × 6 × 0.25
      nightDutyHours = nightDutyCount * 6 * 0.25;
      
      // Use the clean display name for staff identification
      const actualStaffName = displayName;
      
      // Get current user's institution from helper (which fetches from Supabase)
      const { getCurrentInstitutionDetails } = await import('../institutionHelper');
      const institution = await getCurrentInstitutionDetails();
      const userInstitution = institution?.code;
      
      console.log(`🏢 Annexure DB Lookup - Staff: ${actualStaffName}, Institution: ${userInstitution}`);
      
      // Fetch full name from Supabase - extract base surname for lookup
      let fullName = actualStaffName;
      let employeeId = '';
      let staffSalary = 0;
      let foundInDB = false;
      
      if (userInstitution) {
        try {
          // Extract base surname from display name for database lookup
          // e.g., "NARAYYA_(Viraj)" → "NARAYYA"
          const lookupSurname = actualStaffName.replace(/_\([^)]+\)$/, '').replace(/\(R\)$/, '').trim();
          
          const { data: userData, error } = await supabase
            .from('staff_users')
            .select('id, id_number, name, surname, salary')
            .eq('surname', lookupSurname)
            .eq('institution_code', userInstitution)
            .eq('is_active', true)
            .single();
          
          if (error) {
            console.warn(`⚠️ Error fetching staff: ${error.message}`);
          }
          
          if (userData) {
            fullName = `${userData.name} ${userData.surname}`;
            employeeId = userData.id_number || '';
            staffSalary = userData.salary || 0;
            foundInDB = true;
            console.log(`✅ Annexure found staff: ${fullName}, Salary: ${staffSalary}`);
          } else {
            console.warn(`⚠️ Staff not found in DB: ${actualStaffName}, ${userInstitution}`);
          }
        } catch (err) {
          console.error(`❌ Exception fetching staff:`, err);
        }
      }
      
      // Calculate individual hourly rate: (salary × 12) ÷ 52 ÷ 40
      const individualHourlyRate = staffSalary > 0 ? (staffSalary * 12) / 52 / 40 : hourlyRate;
      const salary = staffSalary || 0;
      
      // Debug logging
      console.log(`🔍 Staff Summary Debug for ${displayName}:`, {
        totalHours,
        nightDutyCount,
        staffEntriesLength: staffEntries.length,
        willBeIncluded: totalHours > 0 || nightDutyCount > 0,
        fullName
      });
      
      // Only include staff with actual roster entries (hours > 0 or night duties)
      if (totalHours > 0 || nightDutyCount > 0) {
        staffSummaries.push({
          staffName: displayName,
          fullName: fullName,
          employeeId: employeeId,
          salary: salary,
          totalDays: staffEntries.length,
          totalHours,
          totalAmount: totalHours * individualHourlyRate,
          nightDutyCount,
          nightDutyHours,
          nightAllowance: nightDutyHours * individualHourlyRate,
          grandTotal: (totalHours * individualHourlyRate) + (nightDutyHours * individualHourlyRate)
        });
      } else if (staffEntries.length > 0 && !foundInDB) {
        // Log cases where staff has entries but wasn't found in DB
        console.log(`⚠️ Staff ${displayName} has ${staffEntries.length} entries but not found in DB`);
      }
    }
    
    // Sort by staff name
    return staffSummaries.sort((a, b) => a.staffName.localeCompare(b.staffName));
  }
}

// Create singleton instance
export const annexureGenerator = new AnnexureGenerator();