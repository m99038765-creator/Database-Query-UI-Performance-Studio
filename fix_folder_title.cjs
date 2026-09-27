const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /title=\{`Click to \$\{isCollapsed \? 'expand' : 'collapse'\} folder "\$\{folderName\}"`\}/g,
  "title={'Click to ' + (isCollapsed ? 'expand' : 'collapse') + ' folder \"' + folderName + '\"'}"
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed folder title successfully');
