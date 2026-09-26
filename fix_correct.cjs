const fs = require('fs');
const filePath = './src/App.tsx';
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

// 1. Find line 8529 (approx) where `</div>` is followed by `{/* Vertical Padding Slider Control */}`
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('</div>') && i < 8600 && lines[i+2] && lines[i+2].includes('Vertical Padding Slider Control')) {
    // Check if next line doesn't already have )}
    if (!lines[i+1].includes(')}')) {
      lines[i] = lines[i] + '\n                                        )}';
      console.log(`Fixed isDivider block at line ${i+1}`);
      break;
    }
  }
}

// 2. Find line 8738-8740 where `</div>` inside `isDetailedPdfLayout` is followed by `)}`
for (let i = 8700; i < 8750; i++) {
  if (lines[i] && lines[i].includes(')') && lines[i].trim() === ')' && lines[i-1] && lines[i-1].includes('</div>')) {
    // Insert </> before )}
    lines[i] = '                                         </>\n' + lines[i];
    console.log(`Fixed isDetailedPdfLayout fragment at line ${i+1}`);
    break;
  }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Saved App.tsx successfully.');
