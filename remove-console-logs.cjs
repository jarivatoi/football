const fs = require('fs');
const path = require('path');

// Directories to scan
const srcDir = path.join(__dirname, 'src');

// Counter for removed logs
let totalRemoved = 0;
let filesModified = 0;

// Function to remove console logs from a file
function removeConsoleLogs(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Remove console.log, console.error, console.warn, console.info, console.debug
    // Handle single-line console logs
    const patterns = [
      // console.log(...);
      /^\s*console\.(log|error|warn|info|debug)\(.*\);?\s*$/gm,
      // console.log(...) at end of file without semicolon
      /^\s*console\.(log|error|warn|info|debug)\(.*\)\s*$/gm,
    ];
    
    let removed = 0;
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        removed += matches.length;
        content = content.replace(pattern, '');
      }
    }
    
    // Remove triple+ empty lines, replace with double empty lines
    const emptyLineRegex = new RegExp('\\n\\s*\\n\\s*\\n', 'g');
    content = content.replace(emptyLineRegex, '\n\n');
    
    if (removed > 0) {
      fs.writeFileSync(filePath, content, 'utf8');
      totalRemoved += removed;
      filesModified++;
      console.log(`✓ Removed ${removed} console statements from ${path.relative(__dirname, filePath)}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

// Function to recursively scan directories
function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and .git
      if (file !== 'node_modules' && file !== '.git' && !file.startsWith('.')) {
        scanDirectory(filePath);
      }
    } else if (file.match(/\.(ts|tsx|js|jsx)$/)) {
      removeConsoleLogs(filePath);
    }
  }
}

console.log('🧹 Removing console logs from project...\n');
scanDirectory(srcDir);

console.log(`\n✅ Done! Removed ${totalRemoved} console statements from ${filesModified} files`);
