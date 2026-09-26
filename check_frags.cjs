const fs = require('fs');
const content = fs.readFileSync('./src/App.tsx', 'utf8');

const matches = content.match(/<>|<\/>/g) || [];
console.log('All fragment tags in App.tsx:', matches);

// Let's find line numbers of <>
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('<>') || line.includes('</>')) {
    console.log(`Line ${idx+1}: ${line}`);
  }
});
