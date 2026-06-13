const fs = require('fs');
const files = process.argv.slice(2);

files.forEach(file => {
  console.log(`Processing ${file}...`);
  let code = fs.readFileSync(file, 'utf8');
  const before = code.length;
  
  // Remove console.log/warn/error/info/debug with multi-line support
  // This regex handles nested parentheses correctly
  code = code.replace(/console\.(log|warn|error|info|debug)\s*\((?:[^()]|\([^()]*\))*\);/g, '');
  
  const removed = before - code.length;
  console.log(`  Removed ${removed} characters`);
  
  fs.writeFileSync(file, code, 'utf8');
  console.log(`  ✓ Done\n`);
});
