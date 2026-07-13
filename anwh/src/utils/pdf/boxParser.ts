// Individual staff analysis parser - no box grouping
import { availableNames } from '../rosterAuth';

export interface ParsedEntry {
  date: string;
  shiftType: string;
  assignedName: string;
  changeDescription?: string;
  remarks?: string; // Attached center name from marker (*)
  originalPdfText?: string; // Original PDF text with marker
}

export class BoxParser {
  // Allow passing custom staff names list (for institution-filtered parsing)
  private staffNamesList: string[] | null = null;
  
  /**
   * Set custom staff names list for parsing (e.g., institution-filtered)
   * If not set, uses default availableNames from rosterAuth
   */
  setStaffNames(names: string[]): void {
    this.staffNamesList = names;
  }
  
  /**
   * Get the staff names list to use for matching
   */
  private getStaffNamesList(): string[] {
    return this.staffNamesList || availableNames;
  }
  
  /**
   * Parse PDF page using individual staff analysis:
   * 1. Find each staff member individually
   * 2. For each staff member, go UP to find their specific date
   * 3. For each staff member, go LEFT to find their specific shift
   * 4. Create entry for that specific staff member
   */
  parsePageAsBoxes(textItems: Array<{text: string, x: number, y: number}>): ParsedEntry[] {
    const entries: ParsedEntry[] = [];
    
    // STEP 1: Find all staff names with their exact positions
    const allStaffPositions = this.findAllStaffNames(textItems);
    
    // STEP 2: For each staff member individually, find their date and shift
    for (let i = 0; i < allStaffPositions.length; i++) {
      const staff = allStaffPositions[i];
      
      const date = this.findDateAboveStaff(textItems, staff);
      const shift = this.findShiftInFirstColumn(textItems, staff);
      
      // Only add entry if both date and shift are found
      if (date && shift) {
        entries.push({
          date: date,
          shiftType: shift,
          assignedName: staff.name,
          originalPdfText: staff.originalText
        });
      }
    }
    
    return entries;
  }
  
  /**
   * Find all staff names in the PDF
   */
  private findAllStaffNames(textItems: Array<{text: string, x: number, y: number}>): Array<{name: string, originalText: string, x: number, y: number}> {
    const staffNames: Array<{name: string, originalText: string, x: number, y: number}> = [];
    
    // Also collect potential multiline remarks while finding staff
    const remarksItems: Array<{text: string, x: number, y: number}> = [];
    
    for (const item of textItems) {
      const matchedName = this.findMatchingStaffName(item.text);
      if (matchedName) {
        // Preserve the original marker prefix (*, **, ***) from the PDF text
        const markerMatch = item.text.match(/^(\*+)/);
        const markerPrefix = markerMatch ? markerMatch[1] : '';
        const nameWithMarker = markerPrefix ? `${markerPrefix}${matchedName}` : matchedName;
        
        staffNames.push({
          name: nameWithMarker, // Include marker in the name (e.g., *BHEKUR, **NARAYYA)
          originalText: item.text, // Preserve original PDF text with marker
          x: item.x,
          y: item.y
        });
      } else if (this.isPotentialRemarksText(item.text)) {
        remarksItems.push(item);
      }
    }
    
    return staffNames;
  }
  
  /**
   * Check if text could be part of remarks (contains common keywords)
   */
  private isPotentialRemarksText(text: string): boolean {
    const lowerText = text.toLowerCase();
    const remarksKeywords = [
      'public', 'holiday', 'cyclone', 'testing', 'working', 'fine',
      'emergency', 'special', 'event', 'celebration', 'festival'
    ];
    
    return remarksKeywords.some(keyword => lowerText.includes(keyword)) ||
           text.includes('*') || // Text with asterisk
           /^[A-Za-z\s]{10,}/.test(text); // Long text strings
  }
  
  /**
   * Find date above a specific staff member
   */
  private findDateAboveStaff(textItems: Array<{text: string, x: number, y: number}>, staff: {name: string, x: number, y: number}): string | null {
    // Look for items above this staff member (smaller Y coordinate) and close horizontally
    const itemsAbove = textItems.filter(item => 
      item.y < staff.y && // Above the staff member
      Math.abs(item.x - staff.x) < 50 // Close horizontally (within 50px)
    );
    
    // Sort by distance from staff member (closest first)
    itemsAbove.sort((a, b) => {
      const distanceA = Math.sqrt(Math.pow(staff.y - a.y, 2) + Math.pow(staff.x - a.x, 2));
      const distanceB = Math.sqrt(Math.pow(staff.y - b.y, 2) + Math.pow(staff.x - b.x, 2));
      return distanceA - distanceB;
    });
    
    // Look for date patterns in items above
    for (const item of itemsAbove) {
      const dateMatch = this.extractDateFromText(item.text);
      if (dateMatch) {
        return dateMatch.date;
      }
    }
    
    return null;
  }
  
  /**
   * Find shift to the left of a specific staff member
   */
  private findShiftInFirstColumn(textItems: Array<{text: string, x: number, y: number}>, staff: {name: string, x: number, y: number}): string | null {
    // Look for items in the FIRST COLUMN (leftmost x positions) that are in the same row
    // First, find the leftmost X coordinate in the document
    const allXPositions = textItems.map(item => item.x).sort((a, b) => a - b);
    const leftmostX = allXPositions[0];
    const firstColumnMaxX = leftmostX + 100; // First column extends up to 100px from leftmost
    
    const itemsInFirstColumn = textItems.filter(item => 
      item.x >= leftmostX && item.x <= firstColumnMaxX && // In the first column
      Math.abs(item.y - staff.y) < 30 // Close vertically (within 30px)
    );
    
    // Sort by vertical distance from staff member (closest row first)
    itemsInFirstColumn.sort((a, b) => {
      const distanceA = Math.abs(staff.y - a.y);
      const distanceB = Math.abs(staff.y - b.y);
      return distanceA - distanceB;
    });
    
    // Look for shift patterns in the first column
    for (const item of itemsInFirstColumn) {
      const shiftType = this.identifyShiftTypeFromText(item.text);
      if (shiftType) {
        return shiftType;
      }
    }
    
    return null;
  }
  
  /**
   * Extract date from text
   */
  private extractDateFromText(text: string): {date: string, dayOfWeek: number} | null {
    const cleanText = text.trim();
    
    // Format 1: DD MM YYYY (25 07 2025)
    const ddmmyyyySpacePattern = /^(\d{1,2})\s+(\d{1,2})\s+(\d{4})$/;
    const ddmmyyyySpaceMatch = cleanText.match(ddmmyyyySpacePattern);
    if (ddmmyyyySpaceMatch) {
      const [, day, month, year] = ddmmyyyySpaceMatch;
      const standardDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      const dateObj = new Date(standardDate);
      
      if (this.isValidDate(dateObj, parseInt(year), parseInt(month), parseInt(day))) {
        return { date: standardDate, dayOfWeek: dateObj.getDay() };
      }
    }
    
    // Format 2: DD-MM-YYYY (25-07-2025)
    const ddmmyyyyDashPattern = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
    const ddmmyyyyDashMatch = cleanText.match(ddmmyyyyDashPattern);
    if (ddmmyyyyDashMatch) {
      const [, day, month, year] = ddmmyyyyDashMatch;
      const standardDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      const dateObj = new Date(standardDate);
      
      if (this.isValidDate(dateObj, parseInt(year), parseInt(month), parseInt(day))) {
        return { date: standardDate, dayOfWeek: dateObj.getDay() };
      }
    }
    
    // Format 3: DD-MMM-YYYY (25-Jul-2025)
    const ddmmmyyyyPattern = /^(\d{1,2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{4})$/i;
    const ddmmmyyyyMatch = cleanText.match(ddmmmyyyyPattern);
    if (ddmmmyyyyMatch) {
      const [, day, monthName, year] = ddmmmyyyyMatch;
      const monthNumber = this.getMonthNumber(monthName);
      if (monthNumber !== -1) {
        const standardDate = `${year}-${monthNumber.toString().padStart(2, '0')}-${day.padStart(2, '0')}`;
        const dateObj = new Date(standardDate);
        
        if (this.isValidDate(dateObj, parseInt(year), monthNumber, parseInt(day))) {
          return { date: standardDate, dayOfWeek: dateObj.getDay() };
        }
      }
    }
    
    // Format 4: DD MM YY (25 07 25)
    const ddmmyySpacePattern = /^(\d{1,2})\s+(\d{1,2})\s+(\d{2})$/;
    const ddmmyySpaceMatch = cleanText.match(ddmmyySpacePattern);
    if (ddmmyySpaceMatch) {
      const [, day, month, year] = ddmmyySpaceMatch;
      const fullYear = parseInt(year) > 50 ? `19${year}` : `20${year}`;
      const standardDate = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      const dateObj = new Date(standardDate);
      
      if (this.isValidDate(dateObj, parseInt(fullYear), parseInt(month), parseInt(day))) {
        return { date: standardDate, dayOfWeek: dateObj.getDay() };
      }
    }
    
    // Format 5: DD-MM-YY (25-07-25)
    const ddmmyyDashPattern = /^(\d{1,2})-(\d{1,2})-(\d{2})$/;
    const ddmmyyDashMatch = cleanText.match(ddmmyyDashPattern);
    if (ddmmyyDashMatch) {
      const [, day, month, year] = ddmmyyDashMatch;
      const fullYear = parseInt(year) > 50 ? `19${year}` : `20${year}`;
      const standardDate = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      const dateObj = new Date(standardDate);
      
      if (this.isValidDate(dateObj, parseInt(fullYear), parseInt(month), parseInt(day))) {
        return { date: standardDate, dayOfWeek: dateObj.getDay() };
      }
    }
    
    // Format 6: DD-MMM-YY (25-jul-25)
    const ddmmmyyPattern = /^(\d{1,2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})$/i;
    const ddmmmyyMatch = cleanText.match(ddmmmyyPattern);
    if (ddmmmyyMatch) {
      const [, day, monthName, year] = ddmmmyyMatch;
      const monthNumber = this.getMonthNumber(monthName);
      if (monthNumber !== -1) {
        const fullYear = parseInt(year) > 50 ? `19${year}` : `20${year}`;
        const standardDate = `${fullYear}-${monthNumber.toString().padStart(2, '0')}-${day.padStart(2, '0')}`;
        const dateObj = new Date(standardDate);
        
        if (this.isValidDate(dateObj, parseInt(fullYear), monthNumber, parseInt(day))) {
          return { date: standardDate, dayOfWeek: dateObj.getDay() };
        }
      }
    }
    
    // Format 7: DD/MM/YYYY (25/07/2025)
    const ddmmyyyySlashPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const ddmmyyyySlashMatch = cleanText.match(ddmmyyyySlashPattern);
    if (ddmmyyyySlashMatch) {
      const [, day, month, year] = ddmmyyyySlashMatch;
      const standardDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      const dateObj = new Date(standardDate);
      
      if (this.isValidDate(dateObj, parseInt(year), parseInt(month), parseInt(day))) {
        return { date: standardDate, dayOfWeek: dateObj.getDay() };
      }
    }
    
    // Format 8: DD/MM/YY (25/07/25 or 25/7/25)
    const ddmmyySlashPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/;
    const ddmmyySlashMatch = cleanText.match(ddmmyySlashPattern);
    if (ddmmyySlashMatch) {
      const [, day, month, year] = ddmmyySlashMatch;
      const fullYear = parseInt(year) > 50 ? `19${year}` : `20${year}`;
      const standardDate = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      const dateObj = new Date(standardDate);
      
      if (this.isValidDate(dateObj, parseInt(fullYear), parseInt(month), parseInt(day))) {
        return { date: standardDate, dayOfWeek: dateObj.getDay() };
      }
    }
    
    // Format 9: D/M/YY (25/7/25) - single digit month
    const dmyySlashPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/;
    const dmyySlashMatch = cleanText.match(dmyySlashPattern);
    if (dmyySlashMatch) {
      const [, day, month, year] = dmyySlashMatch;
      const fullYear = parseInt(year) > 50 ? `19${year}` : `20${year}`;
      const standardDate = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      const dateObj = new Date(standardDate);
      
      if (this.isValidDate(dateObj, parseInt(fullYear), parseInt(month), parseInt(day))) {
        return { date: standardDate, dayOfWeek: dateObj.getDay() };
      }
    }
    
    // DD MM YYYY format (like "01 07 2025")
    const dayMonthYearPattern = /^(\d{1,2})\s+(\d{1,2})\s+(\d{4})$/;
    const dayMonthYearMatch = cleanText.match(dayMonthYearPattern);
    // Fallback: DD MM format (like "01 07") - assume 2025
    const dayMonthPattern = /^(\d{1,2})\s+(\d{1,2})$/;
    const dayMonthMatch = cleanText.match(dayMonthPattern);
    if (dayMonthMatch && parseInt(dayMonthMatch[1]) >= 1 && parseInt(dayMonthMatch[1]) <= 31 && 
        parseInt(dayMonthMatch[2]) >= 1 && parseInt(dayMonthMatch[2]) <= 12) {
      const day = dayMonthMatch[1].padStart(2, '0');
      const month = dayMonthMatch[2].padStart(2, '0');
      const standardDate = `2025-${month}-${day}`;
      const dateObj = new Date(standardDate);
      
      if (this.isValidDate(dateObj, 2025, parseInt(month), parseInt(day))) {
        return { date: standardDate, dayOfWeek: dateObj.getDay() };
      }
      // Validate the date
      if (!this.isValidDate(dateObj, 2025, parseInt(month), parseInt(day))) {
        console.log(`⚠️ Invalid date detected: "${text}" -> ${standardDate}, clearing date field`);
        return null;
      }
      
      return { date: standardDate, dayOfWeek: dateObj.getDay() };
    }
    
    // Fallback: Single day number (like "01") - assume July 2025
    const singleDayPattern = /^(\d{1,2})$/;
    const dayMatch = cleanText.match(singleDayPattern);
    if (dayMatch && parseInt(dayMatch[1]) >= 1 && parseInt(dayMatch[1]) <= 31) {
      const day = dayMatch[1].padStart(2, '0');
      const standardDate = `2025-07-${day}`;
      const dateObj = new Date(standardDate);
      
      // Validate the date (check if July 2025 has this day)
      if (!this.isValidDate(dateObj, 2025, 7, parseInt(day))) {
        console.log(`⚠️ Invalid date detected: "${text}" -> ${standardDate}, clearing date field`);
        return null;
      }
      
      
      if (this.isValidDate(dateObj, 2025, 7, parseInt(day))) {
        return { date: standardDate, dayOfWeek: dateObj.getDay() };
      }
    }
    
    console.log(`❌ DATE DEBUG: No pattern matched for: "${cleanText}"`);
    return null;
  }
  
  /**
   * Convert month name to number (1-12)
   */
  private getMonthNumber(monthName: string): number {
    const months: Record<string, number> = {
      'jan': 1, 'january': 1,
      'feb': 2, 'february': 2,
      'mar': 3, 'march': 3,
      'apr': 4, 'april': 4,
      'may': 5,
      'jun': 6, 'june': 6,
      'jul': 7, 'july': 7,
      'aug': 8, 'august': 8,
      'sep': 9, 'september': 9,
      'oct': 10, 'october': 10,
      'nov': 11, 'november': 11,
      'dec': 12, 'december': 12
    };
    
    return months[monthName.toLowerCase()] || -1;
  }
  
  /**
   * Validate if a date is actually valid
   */
  private isValidDate(dateObj: Date, expectedYear: number, expectedMonth: number, expectedDay: number): boolean {
    if (isNaN(dateObj.getTime())) {
      return false;
    }
    
    const actualYear = dateObj.getFullYear();
    const actualMonth = dateObj.getMonth() + 1;
    const actualDay = dateObj.getDate();
    
    return actualYear === expectedYear && 
           actualMonth === expectedMonth && 
           actualDay === expectedDay;
  }
  
  /**
   * Identify shift type from text - PRIORITIZE EVENING SHIFT DETECTION
   */
  private identifyShiftTypeFromText(text: string): string | null {
    const lowerText = text.toLowerCase();
    
    // HIGHEST PRIORITY: Evening Shift patterns (check these FIRST)
    if (lowerText.includes('4-10') || lowerText.includes('16hrs-22hrs') || lowerText.includes('16-22')) {
      return 'Evening Shift (4-10)';
    }
    
    if (lowerText.includes('evening') || lowerText.includes('4pm') || lowerText.includes('16:')) {
      return 'Evening Shift (4-10)';
    }
    
    // Single letter patterns
    if (text.trim() === 'N' || lowerText === 'night' || lowerText === 'n') {
      return 'Night Duty';
    }
    
    // Other time patterns
    if (lowerText.includes('9-4') || lowerText.includes('9hrs-16hrs')) {
      return 'Morning Shift (9-4)';
    }
    
    if (lowerText.includes('12-10') || lowerText.includes('12hrs-22hrs')) {
      return 'Saturday Regular (12-10)';
    }
    
    if (lowerText.includes('22hrs-9hrs') || lowerText.includes('22-9')) {
      return 'Night Duty';
    }
    
    // Word-based patterns
    if (lowerText.includes('morning')) {
      return 'Morning Shift (9-4)';
    }
    
    if (lowerText.includes('saturday')) {
      return 'Saturday Regular (12-10)';
    }
    
    if (lowerText.includes('sunday') || lowerText.includes('special') || lowerText.includes('holiday')) {
      return 'Sunday/Public Holiday/Special';
    }
    
    if (lowerText.includes('duty') || lowerText.includes('night')) {
      return 'Night Duty';
    }
    
    return null;
  }
  
  /**
   * Find matching staff name
   */
  private findMatchingStaffName(text: string): string | null {
    const cleanText = text.trim().toUpperCase();
    
    // Skip very short text or obvious non-names
    if (cleanText.length < 3) {
      return null;
    }
    
    // Skip common non-name patterns
    const skipPatterns = [
      /^\d+$/, // Pure numbers
      /^[A-Z]{1,2}$/, // Single/double letters
      /SHIFT/i, /DUTY/i, /MORNING/i, /EVENING/i, /NIGHT/i, /SATURDAY/i, /SUNDAY/i,
      /HRS/i, /^AM$/i, /^PM$/i, /DATE/i, /TIME/i
    ];
    
    for (const pattern of skipPatterns) {
      if (pattern.test(cleanText)) {
        return null;
      }
    }
    
    // Remove marker prefix (*) if present for matching purposes
    const cleanTextWithoutMarker = cleanText.replace(/^\*+/, '');
    
    // PRIORITY 1: Perfect exact match
    for (const nameUpper of this.getStaffNamesList()) {
      if (cleanText === nameUpper || cleanTextWithoutMarker === nameUpper) {
        // Return WITH marker prefix if it existed in the PDF
        const markerMatch = text.trim().match(/^(\*+)/);
        const markerPrefix = markerMatch ? markerMatch[1] : '';
        return markerPrefix ? `${markerPrefix}${nameUpper}` : nameUpper;
      }
    }
    
    // PRIORITY 2: Surname match
    for (const nameUpper of this.getStaffNamesList()) {
      const commaIndex = nameUpper.indexOf(',');
      if (commaIndex > 0) {
        const surnameOnly = nameUpper.substring(0, commaIndex).trim();
        if (cleanText === surnameOnly && surnameOnly.length >= 3) {
          // Return WITH marker prefix if it existed
          const markerMatch = text.trim().match(/^(\*+)/);
          const markerPrefix = markerMatch ? markerMatch[1] : '';
          return markerPrefix ? `${markerPrefix}${nameUpper}` : nameUpper;
        }
      }
    }
    
    // PRIORITY 3: Base name match
    for (const nameUpper of this.getStaffNamesList()) {
      // Extract base name from ID-based format
      // Handles: NARAYYA → NARAYYA
      //          NARAYYA(R) → NARAYYA
      //          NARAYYA_(V.T)_N280881240165C → NARAYYA (V.T)
      //          NARAYYA_(THOMAS)_N280881240165C → NARAYYA (THOMAS)
      let baseName = nameUpper;
      let surnameOnly = '';
      let initialsPart = '';
      
      if (nameUpper.includes('_')) {
        // ID-based format: extract surname and disambiguation
        const parts = nameUpper.split('_');
        surnameOnly = parts[0];
        const hasDisambiguation = parts[1]?.startsWith('(') && parts[1]?.endsWith(')');
        
        if (hasDisambiguation) {
          // Convert NARAYYA_(V.T)_N280881240165C → NARAYYA (V.T)
          const withoutId = parts.slice(0, -1).join('_');
          baseName = withoutId.replace(/_\(([^)]+)\)/, ' ($1)');
          initialsPart = parts[1].replace(/[()]/g, ''); // Extract "V.T" from "(V.T)"
        } else {
          // Simple format: NARAYYA_N280881240165C → NARAYYA
          baseName = surnameOnly;
        }
      } else {
        // Legacy format: remove (R) suffix
        baseName = nameUpper.replace(/\(R\)$/, '').trim();
        surnameOnly = baseName.split(',')[0].trim();
      }
      
      const cleanTextBase = cleanText.replace(/\(R\)$/, '').trim().replace(/^\*+/, '');
      const hasRVariantInPDF = cleanText.includes('(R)') || cleanText.includes('(r)');
      
      // Handle truncated ID-based format like "ITTOO_(U.K)" or "ITTOO_(P)"
      // PDF has: ITTOO_(U.K) or ITTOO_(U.K)(R)
      // Database has: ITTOO_(U.K)_C1234567891011 or ITTOO_(U.K)(R)_C1234567891011
      // We need to match them
      const cleanTextForMatching = cleanTextBase.replace(/\(R\)$/i, ''); // Remove (R) for initial extraction
      if (cleanTextForMatching.includes('_(') && cleanTextForMatching.endsWith(')')) {
        // Extract surname and disambiguation from PDF text
        // ITTOO_(U.K) → surname: "ITTOO", disambiguation: "(U.K)"
        const pdfMatch = cleanTextForMatching.match(/^([A-Z]+)_\(([^)]+)\)$/);
        if (pdfMatch) {
          const pdfSurname = pdfMatch[1];
          const pdfDisambiguation = `(${pdfMatch[2]})`;
          const pdfHasR = cleanTextBase.toUpperCase().includes('(R)');
          
          // Check if database has same surname + disambiguation pattern
          // Also check (R) variant if PDF has it
          const dbHasDisambiguation = nameUpper.startsWith(`${pdfSurname}_`) && nameUpper.includes(`_${pdfDisambiguation}_`);
          const dbHasR = nameUpper.includes('(R)');
          
          // Match if: same surname+disambiguation AND (R) status matches
          if (dbHasDisambiguation && pdfHasR === dbHasR) {
            // Return WITH marker prefix if it existed
            const markerMatch = text.trim().match(/^(\*+)/);
            const markerPrefix = markerMatch ? markerMatch[1] : '';
            return markerPrefix ? `${markerPrefix}${nameUpper}` : nameUpper;
          }
        }
      }
      
      // If PDF text matches base name, return the full ID-based format
      if (cleanTextBase === baseName && baseName.length >= 3) {
        const staffHasRVariant = nameUpper.includes('(R)');
        
        if (hasRVariantInPDF && !staffHasRVariant) {
          continue;
        }
        
        if (!hasRVariantInPDF && staffHasRVariant) {
          continue;
        }
        
        // Return WITH marker prefix if it existed
        const markerMatch = text.trim().match(/^(\*+)/);
        const markerPrefix = markerMatch ? markerMatch[1] : '';
        return markerPrefix ? `${markerPrefix}${nameUpper}` : nameUpper;
      }
      
      // PRIORITY 3b: Match by surname + initials pattern
      if (surnameOnly && cleanText.length >= 3) {
        const cleanTextWithoutR = cleanText.replace(/\(R\)$/i, '').trim();
        
        const cleanTextSurname = cleanTextWithoutR.split(/[\s()]+/)[0];
        const cleanTextInitials = cleanTextWithoutR.match(/\(([^)]+)\)/)?.[1] ||
                                  cleanTextWithoutR.match(/\b([A-Z]\.?[A-Z]?\.?)\b/i)?.[1] ||
                                  '';
        
        if (cleanTextSurname.toUpperCase() === surnameOnly && initialsPart) {
          if (cleanTextInitials) {
            const pdfInitials = cleanTextInitials.replace(/\./g, '').toUpperCase();
            const dbInitials = initialsPart.replace(/\./g, '').toUpperCase();
            
            if (dbInitials.startsWith(pdfInitials) || pdfInitials === dbInitials) {
              // Return WITH marker prefix if it existed
              const markerMatch = text.trim().match(/^(\*+)/);
              const markerPrefix = markerMatch ? markerMatch[1] : '';
              return markerPrefix ? `${markerPrefix}${nameUpper}` : nameUpper;
            }
          } else {
            const sameSurnameCount = availableNames.filter(name => {
              if (name.includes('_')) {
                return name.split('_')[0] === surnameOnly;
              }
              return name.split(',')[0].trim() === surnameOnly;
            }).length;
            
            if (sameSurnameCount === 1) {
              // Return WITH marker prefix if it existed
              const markerMatch = text.trim().match(/^(\*+)/);
              const markerPrefix = markerMatch ? markerMatch[1] : '';
              return markerPrefix ? `${markerPrefix}${nameUpper}` : nameUpper;
            }
          }
        }
      }
    }
    
    return null;
  }
}
