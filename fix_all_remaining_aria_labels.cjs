const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /aria-label=\{`([^`]+)\$\{([^}]+)\}([^`]*)`\}/g,
  (match, prefix, expr, suffix) => `aria-label={'${prefix}' + (${expr}) + '${suffix}'}`
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed remaining aria-labels successfully');
