const fs = require('fs');
const filePath = './src/App.tsx';
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('{isDetailedPdfLayout && (')) {
    console.log(`Found isDetailedPdfLayout at line ${i+1}`);
    if (lines[i+1].includes('<>')) {
      lines[i+1] = lines[i+1].replace('<>', '<div>');
      console.log(`Replaced <> with <div> at line ${i+2}`);
    }
  }
}

// Find near the end of renderCard where we have </> or extra closing tags around line 8740-8745
for (let i = 8730; i < lines.length && i < 8760; i++) {
  if (lines[i].includes('</>')) {
    lines[i] = lines[i].replace('</>', '</div>');
    console.log(`Replaced </> with </div> at line ${i+1}`);
  }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Exact detailed fix applied.');
