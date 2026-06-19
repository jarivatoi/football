const fs = require('fs');
const path = require('path');

// Directories to process
const directories = ['src'];

// Files to skip
const skipFiles = ['vite-env.d.ts'];

// Function to remove console.log, console.warn, console.error, console.info, console.debug
function removeConsoleLogs(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Remove single-line console logs
  content = content.replace(/^\s*console\.(log|warn|error|info|debug)\(.*\);?\s*$/gm, '');
  
  // Remove console.log with template literals that span multiple lines (simple cases)
  content = content.replace(/^\s*console\.(log|warn|error|info|debug)\([\s\S]*?\);\s*$/gm, (match) => {
    // Only remove if it doesn't contain function calls or complex logic
    if (!match.includes('=>') && !match.match(/\b(function|return|if|for|while)\b/)) {
      return '';
    }
    return match;
  });
  
  // Remove empty lines that were left behind (multiple consecutive blank lines)
  content = content.replace(/
\s*
\s*
/g, '

');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Cleaned: ${filePath}`);
    return true;
  }
  return false;
}

// Process all TypeScript/JavaScript files
function processDirectory(dirPath) {
  let filesCleaned = 0;
  
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and dist
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        filesCleaned += processDirectory(fullPath);
      }
    } else if (stat.isFile()) {
      // Process .ts, .tsx, .js, .jsx files
      if (/\.(ts|tsx|js|jsx)$/.test(file) && !skipFiles.includes(file)) {
        if (removeConsoleLogs(fullPath)) {
          filesCleaned++;
        }
      }
    }
  }
  
  return filesCleaned;
}

// Start processing
let totalCleaned = 0;

for (const dir of directories) {
  const fullPath = path.join(__dirname, dir);
  if (fs.existsSync(fullPath)) {
    totalCleaned += processDirectory(fullPath);
  }
}

console.log(`\n✅ Total files cleaned: ${totalCleaned}`);
