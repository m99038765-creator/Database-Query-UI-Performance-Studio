const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /group\.isCollapsed \? `Expand \$\{group\.title\}` : `Collapse \$\{group\.title\}`/g,
  "group.isCollapsed ? ('Expand ' + group.title) : ('Collapse ' + group.title)"
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed group collapse titles successfully');
