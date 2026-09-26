const fs = require('fs');
const filePath = './src/App.tsx';
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

for (let i = 8515; i < 8540; i++) {
  if (lines[i] && lines[i].includes('</div>') && lines[i+1] && lines[i+1].includes(')}')) {
    lines.splice(i+1, 1); // remove the next line containing )}
    console.log(`Removed erroneous )} at line ${i+2}`);
    break;
  }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Saved App.tsx.');
