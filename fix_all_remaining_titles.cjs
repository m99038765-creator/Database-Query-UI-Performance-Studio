const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /title=\{`Select section divider line style for \$\{displayTitle\} \(Solid, Dashed, Dotted\)`\}/g,
  "title={'Select section divider line style for ' + displayTitle + ' (Solid, Dashed, Dotted)'}"
);

content = content.replace(
  /title=\{`([^`]+)\$\{([^}]+)\}([^`]*)`\}/g,
  (match, prefix, expr, suffix) => `title={'${prefix}' + (${expr}) + '${suffix}'}`
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed remaining titles successfully');
