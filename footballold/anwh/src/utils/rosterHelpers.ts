export const parseNameChange = (description: string, assignedName: string) => {
  console.log('🔍 parseNameChange called with:', { description, assignedName });
  
  // First, check if we have the original PDF assignment stored in the description
  const originalPdfMatch = description.match(/\(Original PDF: ([^)]+)\)/);
  console.log('🔍 Original PDF match:', originalPdfMatch);
  
  if (originalPdfMatch) {
    let originalPdfAssignment = originalPdfMatch[1].trim();
    
    // Fix missing closing parenthesis if it exists
    if (originalPdfAssignment.includes('(R') && !originalPdfAssignment.includes('(R)')) {
      originalPdfAssignment = originalPdfAssignment.replace('(R', '(R)');
    }
    
    console.log('🔍 Using original PDF assignment:', { oldName: originalPdfAssignment, newName: assignedName });
    // If we have the original PDF assignment stored, use it directly
    return {
      oldName: originalPdfAssignment, // Always the original PDF assignment
      newName: assignedName, // Current assignment
      isNameChange: true
    };
  }
  
  // Look for the MOST RECENT "Name changed from" pattern to get the immediate change
  const nameChangeMatches = description.match(/Name changed from "([^"]+)" to "([^"]+)"/g);
  console.log('🔍 Name change matches found:', nameChangeMatches);
  
  if (nameChangeMatches && nameChangeMatches.length > 0) {
    // Get the LAST (most recent) change to show the immediate before/after
    const lastMatch = nameChangeMatches[nameChangeMatches.length - 1];
    console.log('🔍 Using last match:', lastMatch);
    const parsed = lastMatch.match(/Name changed from "([^"]+)" to "([^"]+)"/);
    console.log('🔍 Parsed last match:', parsed);
    
    if (parsed) {
      let fromName = parsed[1].trim();
      let toName = parsed[2].trim();
      
      // Fix missing closing parenthesis if it exists
      if (fromName.includes('(R') && !fromName.includes('(R)')) {
        fromName = fromName.replace('(R', '(R)');
      }
      if (toName.includes('(R') && !toName.includes('(R)')) {
        toName = toName.replace('(R', '(R)');
      }
      
      console.log('🔍 Returning immediate change:', { oldName: fromName, newName: toName });
      return {
        oldName: fromName, // The "from" name in the change description
        newName: toName, // The "to" name in the change description (should match assignedName)
        isNameChange: true
      };
    }
  }
  
  // Fallback: look for single match (for backward compatibility)
  const singleMatch = description.match(/Name changed from "([^"]+)" to "([^"]+)"/);
  console.log('🔍 Single match fallback:', singleMatch);
  if (singleMatch) {
    let fromName = singleMatch[1].trim();
    let toName = singleMatch[2].trim();
    
    // Fix missing closing parenthesis if it exists
    if (fromName.includes('(R') && !fromName.includes('(R)')) {
      fromName = fromName.replace('(R', '(R)');
    }
    if (toName.includes('(R') && !toName.includes('(R)')) {
      toName = toName.replace('(R', '(R)');
    }
    
    console.log('🔍 Returning single match:', { oldName: fromName, newName: toName });
    return {
      oldName: fromName, // The "from" name
      newName: toName, // The "to" name
      isNameChange: true
    };
  }
  
  console.log('🔍 No name change detected');
  return {
    oldName: null,
    newName: null,
    isNameChange: false
  };
};

export const isPastDate = (dateString: string): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const entryDate = new Date(dateString);
  entryDate.setHours(0, 0, 0, 0);
  
  return entryDate < today;
};