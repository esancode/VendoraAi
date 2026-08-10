const fs = require('fs');
const path = require('path');

const dirsToScan = [
  'C:/Users/Erick Vicent/Documents/my-apps/VendoraAi/frontend/src/features/auth',
  'C:/Users/Erick Vicent/Documents/my-apps/VendoraAi/frontend/src/features/dashboard',
  'C:/Users/Erick Vicent/Documents/my-apps/VendoraAi/frontend/src/features/chat-simulator'
];

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('font-mono')) {
        content = content.replace(/\bfont-mono\b\s*/g, '');
        fs.writeFileSync(fullPath, content);
        console.log(`Removed font-mono from ${fullPath}`);
      }
    }
  }
}

for (const dir of dirsToScan) {
  processDir(dir);
}
console.log('Done!');
