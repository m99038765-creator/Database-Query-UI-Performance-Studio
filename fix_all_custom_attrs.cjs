const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /data-testid-section=\{`drag-handle-\$\{sectionId\}`\}/g,
  "data-testid-section={'drag-handle-' + sectionId}"
);
content = content.replace(
  /data-testid-section=\{`([^`]+)\$\{([^}]+)\}`\}/g,
  (match, prefix, expr) => `data-testid-section={'${prefix}' + (${expr})}`
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed custom attrs successfully');
