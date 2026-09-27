const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /`\$\{prev\}_\$\{v\.var\}`/g,
  "prev + '_' + v.var"
);

content = content.replace(
  /`\$\{([^}]+)\}_\$\{([^}]+)\}`/g,
  "($1) + '_' + ($2)"
);

content = content.replace(
  /`\$\{([^}]+)\}-\$\{([^}]+)\}`/g,
  "($1) + '-' + ($2)"
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed remaining code templates successfully');
