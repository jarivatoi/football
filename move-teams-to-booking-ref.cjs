const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'ParlayBuilder.tsx');

console.log('🔧 Moving teams into bookingRefRef div...\n');

let content = fs.readFileSync(filePath, 'utf8');
const originalContent = content;

// Find the booking result section and restructure it
// We need to move bookingRefRef to wrap both teams AND booking reference

// Pattern 1: Find the opening of the booking result container
const bookingResultStart = `        {/* Booking Result Display - Betslip Style - Hidden in Bet Refund Mode */}
        {!betRefundMode && lastResult && lastResult.success && lastResult.fullResponse && selections.length > 0 && (
          <div className="mb-4 border-2 border-green-500 rounded-lg overflow-hidden bg-white">
            {/* Bet Selections */}
            <div className="max-h-60 overflow-y-auto">`;

const bookingResultNew = `        {/* Booking Result Display - Betslip Style - Hidden in Bet Refund Mode */}
        {!betRefundMode && lastResult && lastResult.success && lastResult.fullResponse && selections.length > 0 && (
          <div className="mb-4 border-2 border-green-500 rounded-lg overflow-hidden bg-white">
            {/* Booking Reference Section - Capture Target - NOW INCLUDES TEAMS */}
            <div ref={bookingRefRef} className="bg-white">
              {/* Bet Selections - Inside booking ref div */}
              <div className="max-h-60 overflow-y-auto">`;

// Pattern 2: Find where teams end and booking ref section starts
const teamsEnd = `            </div>

            {/* Booking Reference Section - Capture Target */}
            <div ref={bookingRefRef} className="bg-white">`;

const teamsEndNew = `              </div>`;

if (content.includes(bookingResultStart)) {
  content = content.replace(bookingResultStart, bookingResultNew);
  console.log('✓ Moved bookingRefRef wrapper to include teams');
} else {
  console.log('✗ Could not find booking result start pattern');
}

if (content.includes(teamsEnd)) {
  content = content.replace(teamsEnd, teamsEndNew);
  console.log('✓ Removed duplicate bookingRefRef opening');
} else {
  console.log('✗ Could not find teams end pattern');
}

// Fix the closing divs - remove the extra closing div
const closingPattern = `            </div>
            </div> {/* End of bookingRefRef wrapper */}

            {/* Place New Bet Button */}`;

const closingNew = `            </div> {/* End of bookingRefRef wrapper - includes teams + booking ref */}

            {/* Place New Bet Button - INSIDE outer container, OUTSIDE bookingRefRef */}`;

if (content.includes(closingPattern)) {
  content = content.replace(closingPattern, closingNew);
  console.log('✓ Fixed closing divs');
} else {
  console.log('⚠ Closing pattern not found (may already be correct)');
}

if (content !== originalContent) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('\n✅ File updated successfully!');
  console.log('\n📋 Changes made:');
  console.log('  - Teams are now INSIDE bookingRefRef div');
  console.log('  - Booking reference is INSIDE bookingRefRef div');
  console.log('  - Both are in the SAME container for screenshot capture');
  console.log('  - Scroll-to-bottom functionality preserved');
} else {
  console.log('\n⚠ No changes made - patterns not found');
  console.log('The file may have already been modified or has a different structure');
}
