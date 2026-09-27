const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /`\$\{queryResult\.records\.length\} records`/g,
  "queryResult.records.length + ' records'"
);

content = content.replace(
  /`\$\{([^}]+)\} records`/g,
  "($1) + ' records'"
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed records count successfully');
