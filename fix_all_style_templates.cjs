const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /style=\{\{\s*paddingTop:\s*`\$\{([^}]+)\}`,\s*paddingBottom:\s*`\$\{([^}]+)\}`\s*\}\}/g,
  "style={{ paddingTop: ($1) + 'px', paddingBottom: ($2) + 'px' }}"
);

content = content.replace(/`\$\{([^}]+)\}%`/g, "($1) + '%'");
content = content.replace(/`\$\{([^}]+)\}px`/g, "($1) + 'px'");

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed style templates successfully');
