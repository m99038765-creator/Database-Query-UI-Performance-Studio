const fs = require('fs');
const filePath = './src/App.tsx';
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

for (let i = 8740; i < lines.length; i++) {
  if (lines[i].includes(');') && !lines[i].includes('};')) {
    lines[i] = lines[i] + '\n                                    };';
    console.log(`Added }; at line ${i+1}`);
    break;
  }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Saved App.tsx with closing function brace.');
