const fs = require('fs');
const path = require('path');

// Directories to process
const directories = ['src'];

// Files to skip
const skipFiles = ['vite-env.d.ts'];

// Function to safely remove console logs
function removeConsoleLogs(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let modified = false;
  
  // Split into lines for safer processing
  const lines = content.split('\n');
  const resultLines = [];
  let skipUntilCloseBrace = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip if we're inside a multi-line console statement
    if (skipUntilCloseBrace > 0) {
      if (trimmed.includes(');') || trimmed.endsWith(')')) {
        skipUntilCloseBrace--;
      }
      continue;
    }
    
    // Check if this is a standalone console.log/warn/error/info/debug line
    // Only remove if:
    // 1. Line starts with console. (possibly with whitespace)
    // 2. It's the only thing on the line (not part of a larger expression)
    // 3. Doesn't contain assignment operators before console
    // 4. Doesn't contain return/const/let/var before console (those are fine to remove)
    const isStandaloneConsole = /^\s*(console\.(log|warn|error|info|debug))\s*\(/.test(line);
    
    if (isStandaloneConsole) {
      // Check if it's a single-line statement (ends with ); or just ))
      if (trimmed.endsWith(');') || trimmed.endsWith(')')) {
        // Safe to remove - it's a complete single-line statement
        modified = true;
        continue; // Skip this line
      } else {
        // Multi-line console statement - skip until we find the closing );
        skipUntilCloseBrace = 1;
        modified = true;
        continue;
      }
    }
    
    // Keep the line
    resultLines.push(line);
  }
  
  const newContent = resultLines.join('\n');
  
  // Remove multiple consecutive blank lines (leave max 1 blank line)
  const finalContent = newContent.replace(/
\s*
\s*
/g, '

');
  
  if (modified && finalContent !== originalContent) {
    fs.writeFileSync(filePath, finalContent, 'utf8');
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

console.log('🧹 Starting console log cleanup...\n');

for (const dir of directories) {
  const fullPath = path.join(__dirname, dir);
  if (fs.existsSync(fullPath)) {
    totalCleaned += processDirectory(fullPath);
  }
}

console.log(`\n✅ Total files cleaned: ${totalCleaned}`);
console.log('🎉 Done! Review changes with: git diff');
