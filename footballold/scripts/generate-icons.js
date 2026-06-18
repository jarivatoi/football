const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function createIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(0, 0, size, size);
  
  // Football icon
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.5}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚽', size / 2, size / 2);
  
  return canvas.toBuffer('image/png');
}

// Create icons
const publicDir = path.join(__dirname, '..', 'public');
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), createIcon(192));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), createIcon(512));

console.log('✅ Icons created successfully!');
