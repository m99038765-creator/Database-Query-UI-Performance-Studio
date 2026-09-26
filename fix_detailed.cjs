const fs = require('fs');
const filePath = './src/App.tsx';
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

for (let i = 8730; i < 8745; i++) {
  if (lines[i] && lines[i].includes('</div>') && lines[i+1] && lines[i+1].includes('};')) {
    // Insert </> and )} right before this </div>
    lines.splice(i, 0, '                                         </>', '                                      )}');
    console.log(`Inserted fragment & condition close at line ${i+1}`);
    break;
  }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Saved App.tsx with detailed PDF fix.');
