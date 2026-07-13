import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RosterEntry } from '../../types/roster';
import { getCurrentInstitutionDetails, formatInstitutionHeader } from '../institutionHelper';
import { formatDisplayNameForUI } from '../rosterDisplayName';
import { supabase } from '../../lib/supabase';
import { extractMarkerPrefix, fetchAttachedCenters, resolveMarkerToCenter } from '../attachedCenters';

export interface RosterListOptions {
  month: number;
  year: number;
  entries: RosterEntry[];
  numberOfCopies?: number;
}

export class RosterListGenerator {
  
  /**
   * Generate roster list matching the PDF template format - all on one page
   */
  async generateRosterList(options: RosterListOptions): Promise<void> {
    const { month, year, numberOfCopies = 1 } = options;
    
    // Generate the specified number of copies
    for (let copy = 1; copy <= numberOfCopies; copy++) {
      await this.generateSingleRosterList(options, copy, numberOfCopies);
    }
  }
  
  /**
   * Generate a single roster list copy
   */
  private async generateSingleRosterList(options: RosterListOptions, copyNumber: number, totalCopies: number): Promise<void> {
    const { month, year } = options;
    
    // Create PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Generate content
    await this.generateRosterListContent(doc, options, copyNumber, totalCopies);
    
    // Generate filename and save
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    let filename = `Roster_List_${monthNames[month]}_${year}`;
    if (totalCopies > 1) {
      filename += `_Copy${copyNumber}`;
    }
    filename += '.pdf';
    
    doc.save(filename);
    
    console.log(`✅ Roster list generated (${copyNumber}/${totalCopies}):`, filename);
  }
  
  /**
   * Generate roster list content into provided PDF document (for batch printing)
   */
  async generateRosterListContent(doc: jsPDF, options: RosterListOptions, copyNumber?: number, totalCopies?: number): Promise<void> {
    const { month, year, entries } = options;
    
    console.log('📄 Generating roster list');
    
    // Get institution details for header - use current user's institution (admin who is generating)
    const institution = await getCurrentInstitutionDetails();
    const institutionHeader = formatInstitutionHeader(institution);
    console.log('🏥 Generating roster list for institution:', institution?.name || 'Default');
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    // Helper to get date string from entry
    const getDateStr = (entry: any) => {
      return `${monthNames[month]} ${entry.date}, ${year}`;
    };
    
    // Header - institution-specific format
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    
    // Use institution-specific header (supports multiple lines)
    institutionHeader.forEach((line, index) => {
      const yPosition = 15 + (index * 6); // 6mm spacing between lines
      doc.text(line, doc.internal.pageSize.getWidth() / 2, yPosition, { align: 'center' });
    });
    
    // Blank line after header (add 8mm spacing)
    const titleY = 20 + (institutionHeader.length - 1) * 6 + 8;
    
    // Main title with title-case capitalization (First Letter Of Each Word)
    doc.setFontSize(14);
    let headerText = `X-Ray Roster For Month Of ${monthNames[month]} ${year}`;
    if (copyNumber && totalCopies && totalCopies > 1) {
      headerText += ` (Copy ${copyNumber}/${totalCopies})`;
    }
    doc.text(headerText, doc.internal.pageSize.getWidth() / 2, titleY, { align: 'center' });
    
    // Filter entries for the specified month/year
    const monthEntries = entries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate.getMonth() === month && entryDate.getFullYear() === year;
    });
    
    console.log(`📄 Filtered ${monthEntries.length} entries for ${monthNames[month]} ${year}`);
    
    if (monthEntries.length === 0) {
      // Show "No data" message
      doc.setFontSize(14);
      doc.text('No roster entries found for this month', doc.internal.pageSize.getWidth() / 2, 40, { align: 'center' });
    } else {
      // Create table data with colored text
      const tableData = this.createColoredTableData(monthEntries);
      
      // Create table with new column structure
      autoTable(doc, {
        startY: 35,
        head: [['Date', 'Shift', 'Staff Names', 'Remarks']],
        body: tableData,
        didParseCell: (data) => {
          // Dynamically calculate row height for staff names column based on number of entries
          if (data.column.index === 2 && data.section === 'body' && data.row.index >= 0) {
            if (data.row.index < tableData.length) {
              const originalRow = tableData[data.row.index];
              const staffNamesData = this.getStaffNamesForRow(originalRow[0], originalRow[1], entries);
              
              if (staffNamesData && staffNamesData.length > 0) {
                // Calculate how many lines we'll need
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                
                const cellWidth = data.cell.width - 8; // Account for padding (2mm each side)
                let currentLineWidth = 0;
                let lineCount = 1;
                const commaSpaceWidth = doc.getTextWidth(', ');
                
                staffNamesData.forEach((staff, index) => {
                  const nameWidth = doc.getTextWidth(staff.name);
                  
                  if (index > 0) {
                    // Need comma + space before this name
                    if (currentLineWidth + commaSpaceWidth + nameWidth > cellWidth) {
                      // Won't fit on current line, move to next
                      lineCount++;
                      currentLineWidth = nameWidth;
                    } else {
                      currentLineWidth += commaSpaceWidth + nameWidth;
                    }
                  } else {
                    // First name on the line
                    currentLineWidth = nameWidth;
                  }
                });
                
                // Calculate minimum cell height needed
                // Base height: lineHeight * lineCount + padding
                const lineHeight = 3; // Height per line in mm (MUST MATCH didDrawCell)
                const minCellHeight = (lineCount * lineHeight) + 2; // Add 2mm for top/bottom padding
                
                // Set the cell height
                data.cell.height = minCellHeight;
                data.row.height = minCellHeight;
              }
            }
          }
        },
        willDrawCell: (data) => {
          // Clear staff names column content to prevent default rendering
          if (data.column.index === 2 && data.section === 'body') {
            data.cell.text = [];
          }
        },
        didDrawCell: (data) => {
          // Only draw custom colored text for staff names column in body
          if (data.column.index === 2 && data.section === 'body' && data.row.index >= 0) {
            console.log(`[ROW ${data.row.index}] Processing row...`);
            
            // Get the staff data for this specific row
            if (data.row.index < tableData.length) {
              const originalRow = tableData[data.row.index];
              const staffNamesData = this.getStaffNamesForRow(originalRow[0], originalRow[1], entries);
              
              if (staffNamesData && staffNamesData.length > 0) {
                // Start drawing from left edge of cell with proper margin
                let currentX = data.cell.x + 2;
                let currentLine = 0;
                const lineHeight = 3;
                let totalLines = 1;

                // Pre-calculate how many lines we'll need - MUST MATCH drawing logic exactly
                const cellLeft = data.cell.x + 2;
                const cellRight = data.cell.x + data.cell.width - 6;
                let tempX = cellLeft;
                                
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                
                staffNamesData.forEach((staff, index) => {
                  const isNarayya = staff.name.includes('NARAYYA');
                  const isLast = index === staffNamesData.length - 1;
                  
                  // Pre-calc: check if name + comma fits, then add padding
                  const textWithComma = isLast ? staff.name : `${staff.name},`;
                  const textWidth = doc.getTextWidth(textWithComma);
                  const SPACE_PADDING = 2.50; //2.51px padding after comma
                  
                  if (index === 0) {
                    // First name always draws at start of line
                    tempX = cellLeft + textWidth;
                    // Add padding after comma for non-last names
                    if (!isLast) {
                      tempX += SPACE_PADDING;
                    }
                    console.log(`[PRE-CALC] Index 0, Name: "${staff.name}", tempX: ${tempX.toFixed(2)}`);
                  } else {
                    // Check if this text + padding will fit on current line
                    const totalWidth = tempX + textWidth + (!isLast ? SPACE_PADDING : 0);
                    const willFit = totalWidth <= cellRight;
                                    
                    if (isNarayya) {
                      console.log(`[PRE-CALC NARAYYA] Index: ${index}, currentX: ${tempX.toFixed(2)}, willFit: ${willFit}`);
                    }
                                    
                    if (!willFit) {
                      // Won't fit - move to next line
                      totalLines++;
                      tempX = cellLeft + textWidth;
                      // Add padding after comma for non-last names
                      if (!isLast) {
                        tempX += SPACE_PADDING;
                      }
                      if (isNarayya) {
                        console.log(`[PRE-CALC NARAYYA] -> NEW LINE ${totalLines}, tempX reset to ${tempX.toFixed(4)}`);
                      }
                    } else {
                      // Will fit - add the text + padding
                      tempX += textWidth;
                      // Add padding after comma for non-last names
                      if (!isLast) {
                        tempX += SPACE_PADDING;
                      }
                      if (isNarayya) {
                        console.log(`[PRE-CALC NARAYYA] -> SAME LINE, tempX now ${tempX.toFixed(4)}`);
                      }
                    }
                  }
                });
                console.log(`[PRE-CALC] Total lines calculated: ${totalLines}`);
                
                // Calculate starting Y position for vertical centering
                const totalHeight = totalLines * lineHeight;
                let cellY = data.cell.y + (data.cell.height / 2) - (totalHeight / 2) + 2;
                
                // Set font to match table
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');

                staffNamesData.forEach((staff, index) => {
                  const isNarayya = staff.name.includes('NARAYYA');
                  const isLast = index === staffNamesData.length - 1;
                  
                  // Check if NEXT name will fit after this one
                  let shouldDrawCommaSpace = false;
                  const SPACE_PADDING = 1.0; // Must match padding used above
                  
                  if (!isLast) {
                    const nextNameWidth = doc.getTextWidth(staffNamesData[index + 1].name);
                    const textWithComma = `${staff.name},`;
                    const widthWithComma = doc.getTextWidth(textWithComma);
                    const rightEdge = data.cell.x + data.cell.width - 6;
                    
                    // Check if NEXT name will fit after this name + comma + padding
                    const willNextFit = currentX + widthWithComma + SPACE_PADDING + nextNameWidth <= rightEdge;
                    
                    console.log(`[FIT CHECK] ${staff.name} → Next: ${staffNamesData[index + 1].name}`);
                    console.log(`  currentX: ${currentX.toFixed(2)}, widthWithComma: ${widthWithComma.toFixed(2)}, next: ${nextNameWidth.toFixed(2)}`);
                    console.log(`  Will fit: ${willNextFit} (${(currentX + widthWithComma + SPACE_PADDING + nextNameWidth).toFixed(2)} <= ${rightEdge.toFixed(2)})`);
                    
                    if (!willNextFit && index > 0) {
                      // Next name won't fit - wrap THIS name to new line first
                      currentX = data.cell.x + 2;
                      cellY += lineHeight;
                      
                      // After wrapping, re-check if next name will fit on the new line
                      const newX = data.cell.x + 2;
                      const willFitOnNewLine = newX + widthWithComma + SPACE_PADDING + nextNameWidth <= rightEdge;
                      shouldDrawCommaSpace = willFitOnNewLine;
                    } else {
                      shouldDrawCommaSpace = willNextFit;
                    }
                  }
                  
                  // Build the text to draw - just name + comma (no space)
                  const textForThisStaff = shouldDrawCommaSpace ? `${staff.name},` : staff.name;
                  const textWidth = doc.getTextWidth(textForThisStaff);
                  
                  // Draw the name + comma
                  const rgbColor = this.hexToRgb(staff.color);
                  doc.setTextColor(rgbColor[0], rgbColor[1], rgbColor[2]);
                  
                  doc.text(textForThisStaff, currentX, cellY);
                  
                  // Move by text width
                  currentX += textWidth;
                  
                  // Manually add PADDING for space after comma (if not last name)
                  if (shouldDrawCommaSpace) {
                    const spacePadding = 1.0; // Manual padding after comma
                    currentX += spacePadding;
                  }
                });
                
                // Reset color for other cells
                doc.setTextColor(0, 0, 0);
              }
            }
          }
        },
        styles: {
          fontSize: 8,
          cellPadding: 2,
          halign: 'center',
          valign: 'top',
          lineWidth: 0.1,
          lineColor: [150, 150, 150],
          fontStyle: 'bold'
        },
        headStyles: {
          fillColor: [220, 220, 220],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center',
          valign: 'middle',
          lineWidth: 0.1,
          lineColor: [150, 150, 150]
        },
        bodyStyles: {
          lineWidth: 0.1,
          lineColor: [150, 150, 150],
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 35, halign: 'center', valign: 'middle' },   // Date (fixed width)
          1: { cellWidth: 45, halign: 'center', valign: 'middle' },   // Shift (fixed width)
          2: { cellWidth: 80, halign: 'left', valign: 'middle' },   // Staff Names (80mm width, left aligned for readability)
          3: { cellWidth: 35, halign: 'center', valign: 'middle' }   // Remarks (fixed width, middle aligned)
        },
        tableLineWidth: 0.1,
        tableLineColor: [150, 150, 150],
        margin: { top: 35, left: 10, right: 10, bottom: 0 },
        tableWidth: 'wrap'
      });
    }
    
    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 10, doc.internal.pageSize.getHeight() - 15);
    doc.text(`Total Entries: ${monthEntries.length}`, doc.internal.pageSize.getWidth() - 10, doc.internal.pageSize.getHeight() - 15, { align: 'right' });
  }
  
  /**
   * Prepare roster table data in new tabular format
   */
  private prepareRosterTableData(entries: RosterEntry[]): string[][] {
    // Group entries by date and shift type
    const groupedData: Record<string, Record<string, RosterEntry[]>> = {};
    
    entries.forEach(entry => {
      const dateKey = entry.date;
      const shiftType = entry.shift_type;
      
      if (!groupedData[dateKey]) {
        groupedData[dateKey] = {};
      }
      if (!groupedData[dateKey][shiftType]) {
        groupedData[dateKey][shiftType] = [];
      }
      groupedData[dateKey][shiftType].push(entry);
    });
    
    // Convert to table rows
    const tableData: string[][] = [];
    
    // Sort dates
    const sortedDates = Object.keys(groupedData).sort();
    
    sortedDates.forEach(date => {
      const shiftData = groupedData[date];
      
      // Define shift order for consistent display
      const shiftOrder = [
        'Morning Shift (9-4)',
        'Saturday Regular (12-10)', 
        'Evening Shift (4-10)',
        'Night Duty',
        'Sunday/Public Holiday/Special'
      ];
      
      // Process shifts in order
      shiftOrder.forEach(shiftType => {
        const shiftEntries = shiftData[shiftType];
        if (!shiftEntries || shiftEntries.length === 0) return;
        
        // Get staff names with color indicators
        const staffNamesWithColors = this.formatStaffNamesWithColors(shiftEntries);
        
        // Get remarks from special date info
        const remarks = this.extractRemarks(shiftEntries);
        
        // Format shift type for display
        const formattedShift = this.formatShiftTypeForList(shiftType);
        
        tableData.push([
          this.formatDateForList(date),  // DDD dd-mmm-yyyy
          formattedShift,                // Shift type
          staffNamesWithColors,          // Staff names with color indicators
          remarks                        // Remarks
        ]);
      });
    });
    
    return tableData;
  }
  
  /**
   * Format staff names with actual text colors based on their edit status
   */
  private formatStaffNamesWithColors(entries: RosterEntry[]): { text: string; color: number[] }[] {
    return entries.map(entry => {
      // Use formatDisplayNameForUI to strip ID number from assigned_name
      let staffName = formatDisplayNameForUI(entry.assigned_name);
      
      // Strip (R) suffix ONLY if it's a modification marker (not preceded by underscore)
      // e.g., "NARAYYA(R)" → "NARAYYA" (modification marker)
      // But "NARAYYA_(R)" stays as "NARAYYA_(R)" ((R) IS the identifier)
      if (staffName.endsWith('(R)')) {
        const beforeR = staffName.slice(0, -3);
        if (!beforeR.endsWith('_')) {
          staffName = beforeR.trim();
        }
      }
      
      const textColor = this.getTextColor(entry);
      
      return {
        text: staffName, // Clean name without ID
        color: this.hexToRgb(textColor)
      };
    });
  }
  
  /**
   * Get actual text color for staff name based on edit status
   */
  private getTextColor(entry: RosterEntry): string {
    // HIGHEST PRIORITY: Admin-set text color
    if (entry.text_color) {
      return entry.text_color;
    }
    
    // Check if entry has been reverted to original
    const hasBeenReverted = () => {
      if (!entry.change_description) return false;
      
      // Check if we have original PDF assignment stored
      const originalPdfMatch = entry.change_description.match(/\(Original PDF: ([^)]+)\)/);
      if (originalPdfMatch) {
        let originalPdfAssignment = originalPdfMatch[1].trim();
        
        // Fix missing closing parenthesis if it exists
        if (originalPdfAssignment.includes('(R') && !originalPdfAssignment.includes('(R)')) {
          originalPdfAssignment = originalPdfAssignment.replace('(R', '(R)');
        }
        
        // Check if current assignment matches original PDF assignment (reverted to original)
        return entry.assigned_name === originalPdfAssignment;
      }
      
      return false;
    };
    
    // Check if entry has been edited (name changed)
    const hasBeenEdited = entry.change_description && 
                         entry.change_description.includes('Name changed from') &&
                         entry.last_edited_by;

    if (hasBeenReverted()) {
      return '#059669'; // Green for reverted entries (back to original PDF by ADMIN)
    } else if (hasBeenEdited) {
      return '#dc2626'; // Red for edited entries (by non-ADMIN users)
    } else {
      return '#000000'; // Black for original entries
    }
  }
  
  /**
   * Convert hex color to RGB array for jsPDF
   */
  private hexToRgb(hex: string): number[] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0]; // Default to black if parsing fails
  }
  
  /**
   * Get staff names data for a specific row during PDF generation
   */
  private getStaffNamesForRow(date: string, shiftType: string, entries: RosterEntry[]): { name: string; color: string }[] {
    // Find entries that match this date and shift
    const matchingEntries = entries.filter(entry => {
      const formattedDate = this.formatDateForList(entry.date);
      const formattedShift = this.formatShiftTypeForList(entry.shift_type);
      return formattedDate === date && formattedShift === shiftType;
    });
    
    return matchingEntries.map(entry => {
      // For roster list PDF, we need to ADD the * marker based on change_description
      // Check if this entry has a center assignment (Center Added or - Center:)
      let hasCenter = false;
      let markerPrefix = '';
      
      if (entry.change_description) {
        // Split by | and check from RIGHT to LEFT to find the LAST center action
        const logEntries = entry.change_description.split('|').map(e => e.trim());
        
        // Process from end to beginning to find the most recent center action
        for (let i = logEntries.length - 1; i >= 0; i--) {
          const logEntry = logEntries[i];
          
          // Check for "Center Added:" or "Center Removed:" patterns
          const addedMatch = logEntry.match(/Center Added:\s*([^;|]+)/);
          const removedMatch = logEntry.match(/Center Removed:\s*([^;|]+)/);
          const markerMatch = logEntry.match(/- Marker:\s*(\*+)/);
          
          if (addedMatch && addedMatch[1].trim()) {
            hasCenter = true;
            markerPrefix = markerMatch ? markerMatch[1] : '*';
            break; // Found the last action, stop searching
          } else if (removedMatch && removedMatch[1].trim()) {
            hasCenter = false; // Center was removed
            break;
          }
        }
        
        // Also check for "- Center:" format (old format)
        if (!hasCenter && entry.change_description.includes('- Center:')) {
          const centerMatch = entry.change_description.match(/- Center:\s*([^;]+?)(?:\s*-\s*Marker:|$)/);
          const markerMatch = entry.change_description.match(/- Marker:\s*(\*+)/);
          if (centerMatch && centerMatch[1].trim()) {
            hasCenter = true;
            markerPrefix = markerMatch ? markerMatch[1] : '*';
          }
        }
      }
      
      // Format the name without ID
      let staffName = entry.assigned_name;
      
      // Strip ID number if present (e.g., "NARAYYA_N280881240165C" → "NARAYYA")
      const parts = staffName.split('_');
      if (parts.length >= 2) {
        // Check if last part is an ID (starts with a letter followed by numbers)
        const lastPart = parts[parts.length - 1];
        if (/^[A-Z]\d+$/i.test(lastPart)) {
          parts.pop();
        }
        staffName = parts.join('_');
      }
      
      // Handle surname_initials format (e.g., "NARAYYA_(V.T)" → "NARAYYA(V.T)")
      if (staffName.includes('_(')) {
        staffName = staffName.replace(/_\(([^)]+)\)/g, '($1)');
      } else if (staffName.includes('_')) {
        // Simple format: "SURNAME_NAME" → "SURNAME"
        const surnameParts = staffName.split('_');
        if (surnameParts.length > 1) {
          staffName = surnameParts[0];
        }
      }
      
      // Strip (R) suffix ONLY if it's a modification marker (not preceded by underscore)
      if (staffName.endsWith('(R)')) {
        const beforeR = staffName.slice(0, -3);
        if (!beforeR.endsWith('_')) {
          staffName = beforeR.trim();
        }
      }
      
      // Add marker prefix if this entry has a center assignment
      if (hasCenter && markerPrefix) {
        staffName = `${markerPrefix}${staffName}`;
      }
      
      return {
        name: staffName, // Name with * marker added based on center assignment
        color: this.getTextColor(entry)
      };
    });
  }
  
  /**
   * Create table data with combined staff names but individual colors
   */
  private createColoredTableData(entries: RosterEntry[]): any[] {
    // Group entries by date and shift type
    const groupedData: Record<string, Record<string, RosterEntry[]>> = {};
    
    entries.forEach(entry => {
      const dateKey = entry.date;
      const shiftType = entry.shift_type;
      
      if (!groupedData[dateKey]) {
        groupedData[dateKey] = {};
      }
      if (!groupedData[dateKey][shiftType]) {
        groupedData[dateKey][shiftType] = [];
      }
      groupedData[dateKey][shiftType].push(entry);
    });
    
    // Convert to table rows with colored text
    const tableData: any[] = [];
    
    // Sort dates
    const sortedDates = Object.keys(groupedData).sort();
    
    sortedDates.forEach(date => {
      const shiftData = groupedData[date];
      
      // Define shift order for consistent display
      const shiftOrder = [
        'Morning Shift (9-4)',
        'Saturday Regular (12-10)', 
        'Evening Shift (4-10)',
        'Night Duty',
        'Sunday/Public Holiday/Special'
      ];
      
      // Process shifts in order
      shiftOrder.forEach(shiftType => {
        const shiftEntries = shiftData[shiftType];
        if (!shiftEntries || shiftEntries.length === 0) return;
        
        // Get remarks from special date info
        const remarks = this.extractRemarks(shiftEntries);
        
        // Format shift type for display
        const formattedShift = this.formatShiftTypeForList(shiftType);
        
        // Combine all staff names with individual colors
        const staffNamesWithColors = shiftEntries.map(entry => {
          // For roster list PDF, we need to ADD the * marker based on change_description
          // Check if this entry has a center assignment (Center Added or - Center:)
          let hasCenter = false;
          let markerPrefix = '';
          
          if (entry.change_description) {
            // Split by | and check from RIGHT to LEFT to find the LAST center action
            const logEntries = entry.change_description.split('|').map(e => e.trim());
            
            // Process from end to beginning to find the most recent center action
            for (let i = logEntries.length - 1; i >= 0; i--) {
              const logEntry = logEntries[i];
              
              // Check for "Center Added:" or "Center Removed:" patterns
              const addedMatch = logEntry.match(/Center Added:\s*([^;|]+)/);
              const removedMatch = logEntry.match(/Center Removed:\s*([^;|]+)/);
              const markerMatch = logEntry.match(/- Marker:\s*(\*+)/);
              
              if (addedMatch && addedMatch[1].trim()) {
                hasCenter = true;
                markerPrefix = markerMatch ? markerMatch[1] : '*';
                break; // Found the last action, stop searching
              } else if (removedMatch && removedMatch[1].trim()) {
                hasCenter = false; // Center was removed
                break;
              }
            }
            
            // Also check for "- Center:" format (old format)
            if (!hasCenter && entry.change_description.includes('- Center:')) {
              const centerMatch = entry.change_description.match(/- Center:\s*([^;]+?)(?:\s*-\s*Marker:|$)/);
              const markerMatch = entry.change_description.match(/- Marker:\s*(\*+)/);
              if (centerMatch && centerMatch[1].trim()) {
                hasCenter = true;
                markerPrefix = markerMatch ? markerMatch[1] : '*';
              }
            }
          }
          
          // Format the name without ID
          let staffName = entry.assigned_name;
          
          // Strip ID number if present (e.g., "NARAYYA_N280881240165C" → "NARAYYA")
          const parts = staffName.split('_');
          if (parts.length >= 2) {
            // Check if last part is an ID (starts with a letter followed by numbers)
            const lastPart = parts[parts.length - 1];
            if (/^[A-Z]\d+$/i.test(lastPart)) {
              parts.pop();
            }
            staffName = parts.join('_');
          }
          
          // Handle surname_initials format (e.g., "NARAYYA_(V.T)" → "NARAYYA(V.T)")
          if (staffName.includes('_(')) {
            staffName = staffName.replace(/_\(([^)]+)\)/g, '($1)');
          } else if (staffName.includes('_')) {
            // Simple format: "SURNAME_NAME" → "SURNAME"
            const surnameParts = staffName.split('_');
            if (surnameParts.length > 1) {
              staffName = surnameParts[0];
            }
          }
          
          // Strip (R) suffix ONLY if it's a modification marker (not preceded by underscore)
          if (staffName.endsWith('(R)')) {
            const beforeR = staffName.slice(0, -3);
            if (!beforeR.endsWith('_')) {
              staffName = beforeR.trim();
            }
          }
          
          // Add marker prefix if this entry has a center assignment
          if (hasCenter && markerPrefix) {
            staffName = `${markerPrefix}${staffName}`;
          }
          
          return {
            name: staffName, // Name with * marker added based on center assignment
            color: this.getTextColor(entry)
          };
        });
        
        // Create single row with combined staff names
        const row = [
          this.formatDateForList(date),
          formattedShift,
          staffNamesWithColors.map(s => s.name).join(', '), // Convert to string for display
          remarks
        ];
        
        tableData.push(row);
      });
    });
    
    return tableData;
  }
  
  /**
   * Extract remarks from entries (special date info + attached center from change_description)
   */
  private extractRemarks(entries: RosterEntry[]): string {
    const remarksList: string[] = [];
    
    for (const entry of entries) {
      // Extract special date information
      if (entry.change_description && entry.change_description.includes('Special Date:')) {
        const match = entry.change_description.match(/Special Date:\s*([^;]+)/);
        if (match && match[1].trim()) {
          const fullRemarks = match[1].trim();
          const remarkText = fullRemarks.includes('*') ? fullRemarks.split('*')[0].trim() : fullRemarks;
          if (remarkText && !remarksList.includes(remarkText)) {
            remarksList.push(remarkText);
          }
        }
      }
      
      // Extract attached center from change_description
      // Check ONLY the last center action (Added or Removed)
      if (entry.change_description) {
        // Split by | and check from RIGHT to LEFT to find the LAST center action
        const logEntries = entry.change_description.split('|').map(e => e.trim());
        let lastCenterAction: { action: 'Added' | 'Removed', centerName: string, marker?: string } | null = null;
        
        // Process from end to beginning to find the most recent center action
        for (let i = logEntries.length - 1; i >= 0; i--) {
          const logEntry = logEntries[i];
          
          // Check for "Center Added:" or "Center Removed:" patterns
          const addedMatch = logEntry.match(/Center Added:\s*([^;|]+)/);
          const removedMatch = logEntry.match(/Center Removed:\s*([^;|]+)/);
          const markerMatch = logEntry.match(/- Marker:\s*(\*+)/);
          
          if (addedMatch && addedMatch[1].trim()) {
            lastCenterAction = {
              action: 'Added',
              centerName: addedMatch[1].trim().replace(/\s*-\s*Marker:.*$/, '').trim(),
              marker: markerMatch ? markerMatch[1] : '*'
            };
            break; // Found the last action, stop searching
          } else if (removedMatch && removedMatch[1].trim()) {
            lastCenterAction = {
              action: 'Removed',
              centerName: removedMatch[1].trim()
            };
            break; // Found the last action, stop searching
          }
        }
        
        // Also check for "- Center:" format (old format)
        if (!lastCenterAction && entry.change_description.includes('- Center:')) {
          const centerMatch = entry.change_description.match(/- Center:\s*([^;]+?)(?:\s*-\s*Marker:|$)/);
          const markerMatch = entry.change_description.match(/- Marker:\s*(\*+)/);
          if (centerMatch && centerMatch[1].trim()) {
            lastCenterAction = {
              action: 'Added',
              centerName: centerMatch[1].trim(),
              marker: markerMatch ? markerMatch[1] : '*'
            };
          }
        }
        
        // Only add center if last action was Added (not Removed)
        if (lastCenterAction && lastCenterAction.action === 'Added') {
          const centerWithMarker = `${lastCenterAction.marker}${lastCenterAction.centerName}`;
          if (!remarksList.includes(centerWithMarker)) {
            remarksList.push(centerWithMarker);
            console.log(`[REMARKS] Extracted center from entry: ${centerWithMarker}`);
          }
        } else if (lastCenterAction && lastCenterAction.action === 'Removed') {
          console.log(`[REMARKS] Center was removed, not adding to remarks`);
        }
      }
    }
    
    // Join multiple remarks with semicolon (no space before, space after)
    return remarksList.join('; ');
  }
  
  /**
   * Format date as DDD dd-mmm-yyyy (e.g., "Mon 01-Jul-2025")
   */
  private formatDateForList(dateString: string): string {
    const date = new Date(dateString);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const dayName = dayNames[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const monthName = monthNames[date.getMonth()];
    const year = date.getFullYear();
    
    return `${dayName} ${day}-${monthName}-${year}`;
  }
  
  /**
   * Format shift type for list display
   */
  private formatShiftTypeForList(shiftType: string): string {
    const shortNames: Record<string, string> = {
      'Morning Shift (9-4)': 'Morning Shift (9-4)',
      'Evening Shift (4-10)': 'Evening Shift (4-10)', 
      'Saturday Regular (12-10)': 'Saturday Regular (12-10)',
      'Night Duty': 'Night Duty',
      'Sunday/Public Holiday/Special': 'Sunday/Public Holiday/Special'
    };
    return shortNames[shiftType] || shiftType;
  }
}

// Create singleton instance
export const rosterListGenerator = new RosterListGenerator();