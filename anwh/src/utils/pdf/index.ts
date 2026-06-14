// Main PDF parser that orchestrates all the smaller components
import { RosterFormData } from '../../types/roster';
import { PDFLoader } from './pdfLoader';
import { BoxParser, type ParsedEntry } from './boxParser';
import { ListParser } from './listParser';
import { getCurrentInstitutionDetails } from '../institutionHelper';
import { processStaffWithAttachedCenter } from '../attachedCenters';

export interface ParsedRosterData {
  entries: RosterFormData[];
  errors: string[];
  warnings: string[];
}

class PDFRosterParser {
  private pdfLoader = new PDFLoader();
  public boxParser = new BoxParser(); // Make public for custom staff list
  private listParser = new ListParser();

  async parsePDF(file: File): Promise<ParsedRosterData> {
    const result: ParsedRosterData = {
      entries: [],
      errors: [],
      warnings: []
    };

    try {
      const pdf = await this.pdfLoader.loadPDF(file);

      const allParsedEntries: ParsedEntry[] = [];

      // Process each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textItems = await this.pdfLoader.extractTextFromPage(page);
        
        // Try both parsing approaches and use the one that finds more entries
        const boxEntries = this.boxParser.parsePageAsBoxes(textItems);
        const listEntries = this.listParser.parsePageAsList(textItems);
        
        // Use the approach that found more valid entries (with valid dates)
        const validListEntries = listEntries.filter(entry => entry.date && entry.date !== '' && entry.date !== null);
        const validBoxEntries = boxEntries.filter(entry => entry.date && entry.date !== '' && entry.date !== null);
        
        const pageEntries = validListEntries.length > validBoxEntries.length ? listEntries : boxEntries;
        
        allParsedEntries.push(...pageEntries);
      }

      // Build final entries with marker processing
      const institution = await getCurrentInstitutionDetails();
      
      result.entries = await Promise.all(allParsedEntries
        .filter(entry => {
          // Filter out entries with missing required fields
          const hasDate = entry.date && entry.date !== '' && entry.date !== null;
          const hasShift = entry.shiftType && entry.shiftType !== '' && entry.shiftType !== null;
          const hasStaff = entry.assignedName && entry.assignedName !== '' && entry.assignedName !== null;
          
          return hasDate && hasShift && hasStaff;
        })
        .map(async (entry) => {
          // STEP 1: Check if assignedName has marker prefix (from boxParser/listParser)
          const nameMatch = entry.assignedName.match(/^(\*+)(.+)/);
          const hasMarkerInName = nameMatch !== null;
          const actualMarker = hasMarkerInName ? nameMatch[1] : '';
          const cleanNameWithoutMarker = hasMarkerInName ? nameMatch[2] : entry.assignedName;
          
          // STEP 2: Process marker to extract center information (if institution supports attached centers)
          let processedName = cleanNameWithoutMarker;
          let centerRemark: string | undefined;
          let markerPrefix: string | undefined;
          
          if (hasMarkerInName && institution?.code) {
            const nameWithMarker = `${actualMarker}${cleanNameWithoutMarker}`;
            
            const processed = await processStaffWithAttachedCenter(nameWithMarker, institution.code);
            // Store the name WITH marker in assignedName (for display in roster)
            processedName = nameWithMarker;
            centerRemark = processed.remark || undefined;
            markerPrefix = actualMarker; // Store marker separately for change_description
          } else if (hasMarkerInName) {
            // Has marker but no institution - keep marker in the name for display
            processedName = `${actualMarker}${cleanNameWithoutMarker}`; // Keep the name WITH marker
            markerPrefix = actualMarker;
          } else {
            // NO marker in name - ensure name is stored without marker
            processedName = cleanNameWithoutMarker;
          }
          
          // STEP 3: Include center remark AND marker in change_description if present
          // Format: | DD-MM-YYYY HH:MM:SS USER, Admin: Center Added: CENTER_NAME - Marker: **
          let changeDescription = '';
          
          if (centerRemark || markerPrefix) {
            changeDescription = `| ${new Date().toLocaleString('en-GB', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit', second: '2-digit'
            }).replace(/\//g, '-')} USER, Admin:`;
            
            if (centerRemark) {
              changeDescription += ` Center Added: ${centerRemark}`;
            }
            
            if (markerPrefix) {
              changeDescription += ` - Marker: ${markerPrefix}`;
            }
          }
          
          return {
            date: entry.date,
            shiftType: entry.shiftType,
            assignedName: processedName, // Store WITHOUT marker
            changeDescription
          };
        }));
      
      // Remove duplicate entries (same date, shift, and staff)
      const uniqueEntries = new Map<string, typeof result.entries[0]>();
      result.entries.forEach(entry => {
        const key = `${entry.date}-${entry.shiftType}-${entry.assignedName}`;
        if (!uniqueEntries.has(key)) {
          uniqueEntries.set(key, entry);
        } else {
          // Duplicate removed
        }
      });
      result.entries = Array.from(uniqueEntries.values());

    } catch (error) {
      result.errors.push(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Apply Saturday shift logic corrections
    result.entries = this.applySaturdayShiftLogic(result.entries);

    return result;
  }

  /**
   * Apply Saturday shift logic:
   * - Normal Saturday: Convert 4-10 to 12-10 (unless 9-4 is present)
   * - Special Saturday: Keep 4-10 if 9-4 is present
   */
  private applySaturdayShiftLogic(entries: RosterFormData[]): RosterFormData[] {
    // Group entries by date to analyze each day
    const entriesByDate = entries.reduce((groups, entry) => {
      if (!groups[entry.date]) groups[entry.date] = [];
      groups[entry.date].push(entry);
      return groups;
    }, {} as Record<string, RosterFormData[]>);

    const correctedEntries: RosterFormData[] = [];

    Object.entries(entriesByDate).forEach(([date, dateEntries]) => {
      const dateObj = new Date(date);
      const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday

      if (dayOfWeek === 6) { // Saturday
        // Check if this Saturday has any 9-4 shifts (indicating it's a special day)
        const has9to4 = dateEntries.some(entry => entry.shiftType === 'Morning Shift (9-4)');
        
        if (!has9to4) {
          // Normal Saturday: Convert all 4-10 shifts to 12-10
          dateEntries.forEach(entry => {
            if (entry.shiftType === 'Evening Shift (4-10)') {
              correctedEntries.push({
                ...entry,
                shiftType: 'Saturday Regular (12-10)',
                changeDescription: 'Imported from PDF (Saturday 4-10 converted to 12-10)'
              });
            } else {
              correctedEntries.push(entry);
            }
          });
        } else {
          // Special Saturday: Keep 4-10 shifts as they are (since 9-4 is present)
          dateEntries.forEach(entry => {
            correctedEntries.push(entry);
          });
        }
      } else {
        // Not Saturday: Keep all entries as they are
        dateEntries.forEach(entry => {
          correctedEntries.push(entry);
        });
      }
    });

    return correctedEntries;
  }
}

export const pdfRosterParser = new PDFRosterParser();