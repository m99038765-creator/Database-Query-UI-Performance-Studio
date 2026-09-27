const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /id=\{isDuplicate \? `select-divider-style-\$\{sectionId\}` : item\.inputDividerStyleId\}/g,
  "id={isDuplicate ? ('select-divider-style-' + sectionId) : item.inputDividerStyleId}"
);
content = content.replace(
  /id=\{`([^`]+)\$\{([^}]+)\}`\}/g,
  (match, prefix, expr) => `id={'${prefix}' + (${expr})}`
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed id templates successfully');
