const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /htmlFor=\{isDuplicate \? `select-divider-style-\$\{sectionId\}` : item\.inputDividerStyleId\}/g,
  "htmlFor={isDuplicate ? ('select-divider-style-' + sectionId) : item.inputDividerStyleId}"
);
content = content.replace(
  /htmlFor=\{`([^`]+)\$\{([^}]+)\}`\}/g,
  (match, prefix, expr) => `htmlFor={'${prefix}' + (${expr})}`
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed htmlFor templates successfully');
