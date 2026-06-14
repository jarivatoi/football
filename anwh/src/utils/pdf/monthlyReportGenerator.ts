import { individualBillGenerator } from './individualBillGenerator';
import { annexureGenerator } from './annexureGenerator';
import { rosterListGenerator } from './rosterListGenerator';
import { RosterEntry } from '../../types/roster';
import { availableNames, getStaffInfo } from '../rosterAuth';
import { extractBaseSurname } from '../rosterFilters';
import { formatDisplayNameForUI } from '../rosterDisplayName';

export interface MonthlyReportOptions {
  month: number;
  year: number;
  entries: RosterEntry[];
  basicSalary: number;
  hourlyRate: number;
  shiftCombinations: Array<{
    id: string;
    combination: string;
    hours: number;
  }>;
  numberOfCopies?: number;
}

export class MonthlyReportGenerator {
  
  /**
   * Generate all three types of reports for the month
   */
  async generateAllReports(options: MonthlyReportOptions): Promise<{
    individualBills: number;
    annexureGenerated: boolean;
    rosterListGenerated: boolean;
  }> {
    const { month, year, entries, basicSalary, hourlyRate, shiftCombinations, numberOfCopies = 1 } = options;
    
    console.log('📄 Starting monthly report generation...');
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    // Filter entries for the month
    const monthEntries = entries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate.getMonth() === month && entryDate.getFullYear() === year;
    });
    
    if (monthEntries.length === 0) {
      throw new Error(`No roster entries found for ${monthNames[month]} ${year}`);
    }
    
    // Get unique staff members who worked this month
    const staffMembers = this.getUniqueStaffMembers(monthEntries);
    
    console.log(`📄 Found ${staffMembers.length} staff members with entries in ${monthNames[month]} ${year}`);
    
    let individualBillsGenerated = 0;
    
    // Generate individual bills for each staff member
    for (const staffName of staffMembers) {
      try {
        await individualBillGenerator.generateBill({
          staffName,
          month,
          year,
          entries: monthEntries,
          basicSalary,
          hourlyRate,
          shiftCombinations,
          numberOfCopies
        });
        individualBillsGenerated++;
        
        // Small delay to prevent browser from being overwhelmed
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Failed to generate bill for ${staffName}:`, error);
      }
    }
    
    // Generate annexure for all staff
    let annexureGenerated = false;
    try {
      await annexureGenerator.generateAnnexure({
        month,
        year,
        entries: monthEntries,
        hourlyRate,
        shiftCombinations,
        numberOfCopies
      });
      annexureGenerated = true;
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('❌ Failed to generate annexure:', error);
    }
    
    // Generate roster list
    let rosterListGenerated = false;
    try {
      await rosterListGenerator.generateRosterList({
        month,
        year,
        entries: monthEntries,
        numberOfCopies
      });
      rosterListGenerated = true;
    } catch (error) {
      console.error('❌ Failed to generate roster list:', error);
    }
    
    console.log('✅ Monthly report generation completed:', {
      individualBills: individualBillsGenerated,
      annexureGenerated,
      rosterListGenerated
    });
    
    return {
      individualBills: individualBillsGenerated,
      annexureGenerated,
      rosterListGenerated
    };
  }
  
  /**
   * Get unique staff members from entries (formatted for display)
   */
  private getUniqueStaffMembers(entries: RosterEntry[]): string[] {
    const staffSet = new Set<string>();
    
    entries.forEach(entry => {
      // Use formatDisplayNameForUI to strip ID number first, then apply smart (R) stripping
      let displayName = formatDisplayNameForUI(entry.assigned_name);
      
      // Strip (R) suffix ONLY if it's a modification marker (not preceded by underscore)
      // e.g., "NARAYYA(R)" → "NARAYYA" (modification marker - no underscore before R)
      // But "NARAYYA_(R)" stays as "NARAYYA_(R)" ((R) IS the identifier - has underscore)
      if (displayName.endsWith('(R)')) {
        const beforeR = displayName.slice(0, -3); // Remove trailing (R)
        if (!beforeR.endsWith('_')) {
          // No underscore before (R) = modification marker, safe to strip
          displayName = beforeR.trim();
        }
      }
      
      staffSet.add(displayName);
    });
    
    // Convert to array and sort
    const staffArray = Array.from(staffSet);
    
    // Filter out staff members who don't exist in the current auth system
    // This prevents deleted staff from appearing in reports
    const validStaffArray = staffArray.filter(staffName => {
      const staffInfo = getStaffInfo(staffName);
      return !!staffInfo;
    });
    
    // Sort alphabetically by base name
    return validStaffArray.sort((a, b) => {
      return a.localeCompare(b);
    });
  }
}

// Create singleton instance
export const monthlyReportGenerator = new MonthlyReportGenerator();