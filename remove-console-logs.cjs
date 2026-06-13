const fs = require('fs');
const path = require('path');

// Get all .ts and .tsx files from src directory
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      arrayOfFiles.push(fullPath);
    }
  });
  
  return arrayOfFiles;
}

const srcDir = path.join(__dirname, 'src');
const files = getAllFiles(srcDir);

console.log(`Found ${files.length} TypeScript files\n`);

files.forEach(file => {
  const relativePath = path.relative(__dirname, file);
  let code = fs.readFileSync(file, 'utf8');
  const before = code.length;
  
  // Remove console.log/warn/error/info/debug with multi-line support
  // More aggressive regex to handle nested parentheses
  let newCode = code;
  let previousLength;
  
  // Keep removing until no more matches
  do {
    previousLength = newCode.length;
    newCode = newCode.replace(/console\.(log|warn|error|info|debug)\s*\([^)]*(?:\([^)]*\)[^)]*)*\);?/g, '');
  } while (newCode.length < previousLength);
  
  code = newCode;
  
  const removed = before - code.length;
  if (removed > 0) {
    console.log(`✓ ${relativePath} (-${removed} chars)`);
    fs.writeFileSync(file, code, 'utf8');
  }
});

console.log('\nDone!');
