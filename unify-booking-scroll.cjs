const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'ParlayBuilder.tsx');

console.log('🔧 Removing inner scroll container for unified scrolling...\n');

let content = fs.readFileSync(filePath, 'utf8');
const originalContent = content;

// Remove the inner max-h-60 overflow-y-auto div wrapper around teams
// Replace: <div className="max-h-60 overflow-y-auto">\n{selections.map
// With: {selections.map (directly, no wrapper)

const innerScrollOpen = `              {/* Bet Selections - Inside booking ref div */}
              <div className="max-h-60 overflow-y-auto">
                {selections.map((selection, index) => {`;

const innerScrollNew = `              {/* Bet Selections - Inside booking ref div (no separate scroll) */}
              {selections.map((selection, index) => {`;

if (content.includes(innerScrollOpen)) {
  content = content.replace(innerScrollOpen, innerScrollNew);
  console.log('✓ Removed inner scroll container opening');
} else {
  console.log('✗ Could not find inner scroll container opening');
}

// Remove the closing </div> for the inner scroll container
// It's right after the selections map ends
const innerScrollClose = `                })}
              </div>

              {/* API Source - Above Booking Reference */}`;

const innerScrollCloseNew = `              })}

              {/* API Source - Above Booking Reference */}`;

if (content.includes(innerScrollClose)) {
  content = content.replace(innerScrollClose, innerScrollCloseNew);
  console.log('✓ Removed inner scroll container closing');
} else {
  console.log('✗ Could not find inner scroll container closing');
}

// Add max-h and overflow to the outer bookingRefRef container
const outerContainer = `            <div ref={bookingRefRef} className="bg-white">`;
const outerContainerNew = `            <div ref={bookingRefRef} className="bg-white max-h-[60vh] overflow-y-auto">`;

if (content.includes(outerContainer)) {
  content = content.replace(outerContainer, outerContainerNew);
  console.log('✓ Added scroll classes to bookingRefRef container');
} else {
  console.log('✗ Could not find bookingRefRef container');
}

if (content !== originalContent) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('\n✅ File updated successfully!');
  console.log('\n📋 Changes made:');
  console.log('  - Removed separate scroll container for teams');
  console.log('  - Teams and booking ref now scroll together');
  console.log('  - bookingRefRef container has max-h-[60vh] overflow-y-auto');
  console.log('  - Unified scrolling experience');
} else {
  console.log('\n⚠ No changes made - patterns not found');
}
