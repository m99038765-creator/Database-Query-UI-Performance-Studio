const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /isDuplicate \? `\$\{item\.title\} \(Copy\)` : item\.title/g,
  "isDuplicate ? (item.title + ' (Copy)') : item.title"
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed duplicate title successfully');
