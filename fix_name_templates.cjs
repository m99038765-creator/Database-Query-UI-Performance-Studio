const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /name=\{`divider-style-\$\{sectionId\}`\}/g,
  "name={'divider-style-' + sectionId}"
);
content = content.replace(
  /name=\{`([^`]+)\$\{([^}]+)\}`\}/g,
  (match, prefix, expr) => `name={'${prefix}' + (${expr})}`
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed name templates successfully');
