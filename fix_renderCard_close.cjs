const fs = require('fs');
const filePath = './src/App.tsx';
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

for (let i = 8740; i < lines.length; i++) {
  if (lines[i].includes(')') && lines[i+1] && lines[i+1].includes('}')) {
    lines[i] = '                                          </div>';
    lines[i+1] = '                                       )}';
    lines[i+2] = '                                    };';
    console.log(`Fixed renderCard close at lines ${i+1}-${i+3}`);
    break;
  }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Saved App.tsx.');
