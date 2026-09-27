const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /id=\{isDuplicate \? `btn-copy-json-\$\{sectionId\}` : `btn-copy-json-\$\{item\.id\}`\}/g,
  "id={isDuplicate ? ('btn-copy-json-' + sectionId) : ('btn-copy-json-' + item.id)}"
);

content = content.replace(
  /id=\{`([^`]+)\$\{([^}]+)\}`\}/g,
  (match, prefix, expr) => `id={'${prefix}' + (${expr})}`
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed remaining ids successfully');
