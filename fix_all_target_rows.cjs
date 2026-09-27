const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /(\w+)\.targetRows \? `\$\{\1\.targetRows\}r` : 'In-flight'/g,
  "$1.targetRows ? ($1.targetRows + 'r') : 'In-flight'"
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed all target rows successfully');
