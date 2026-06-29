const fs = require('fs');
const path = require('path');

const directories = ['src'];
const skipFiles = ['vite-env.d.ts'];

function removeConsoleLogs(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  content = content.replace(/^\s*console\.(log|warn|error|info|debug)\(.*\);?\s*$/gm, '');
  
  content = content.replace(/^\s*console\.(log|warn|error|info|debug)\([\s\S]*?\);\s*$/gm, (match) => {
    if (!match.includes('=>') && !match.match(/\b(function|return|if|for|while)\b/)) {
      return '';
    }
    return match;
  });
  
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

function processDirectory(dirPath) {
  let filesCleaned = 0;
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        filesCleaned += processDirectory(fullPath);
      }
    } else if (stat.isFile()) {
      if (/\.(ts|tsx|js|jsx)$/.test(file) && !skipFiles.includes(file)) {
        if (removeConsoleLogs(fullPath)) {
          filesCleaned++;
        }
      }
    }
  }
  
  return filesCleaned;
}

let totalCleaned = 0;

for (const dir of directories) {
  const fullPath = path.join(__dirname, dir);
  if (fs.existsSync(fullPath)) {
    totalCleaned += processDirectory(fullPath);
  }
}

console.log(`\n✅ Total files cleaned: ${totalCleaned}`);
