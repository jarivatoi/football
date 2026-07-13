const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'BookingHistory.tsx');

console.log('🔧 Unifying saved booking scroll in BookingHistory...\n');

let content = fs.readFileSync(filePath, 'utf8');
const originalContent = content;

// 1. Remove inner scroll container opening
const innerScrollOpen = `              {/* Matches - Inside booking ref container */}
              <div className="border-2 border-green-500 rounded-lg overflow-hidden bg-white">
                <div className="max-h-60 overflow-y-auto">
                  {selectedBooking.selections.map((selection, index) => {`;

const innerScrollNew = `              {/* Matches - Inside booking ref container (unified scroll) */}
              <div className="border-2 border-green-500 rounded-lg overflow-hidden bg-white max-h-[60vh] overflow-y-auto">
                {selectedBooking.selections.map((selection, index) => {`;

if (content.includes(innerScrollOpen)) {
  content = content.replace(innerScrollOpen, innerScrollNew);
  console.log('✓ Removed inner scroll container, added scroll to outer container');
} else {
  console.log('✗ Could not find inner scroll opening');
}

// 2. Remove inner scroll container closing
const innerScrollClose = `                  })}
                </div>

                {/* Booking Reference Section */}`;

const innerScrollCloseNew = `              })}

                {/* Booking Reference Section */}`;

if (content.includes(innerScrollClose)) {
  content = content.replace(innerScrollClose, innerScrollCloseNew);
  console.log('✓ Removed inner scroll container closing');
} else {
  console.log('✗ Could not find inner scroll closing');
}

if (content !== originalContent) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('\n✅ File updated successfully!');
  console.log('\n📋 Changes made:');
  console.log('  - Removed separate scroll container for teams in saved booking');
  console.log('  - Teams and booking ref now scroll together');
  console.log('  - Outer container has max-h-[60vh] overflow-y-auto');
  console.log('  - Unified scrolling experience for saved bookings');
} else {
  console.log('\n⚠ No changes made - patterns not found');
}
