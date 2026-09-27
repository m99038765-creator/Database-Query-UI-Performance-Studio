const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /\{m\.targetRows \? `\$\{m\.targetRows\}r` : 'In-flight'\}/g,
  "{m.targetRows ? (m.targetRows + 'r') : 'In-flight'}"
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed target rows successfully');
