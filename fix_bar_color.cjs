const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /className=\{`absolute left-0 top-0 bottom-0 w-1\.5 \$\{item\.barColor\} opacity-90`\}/g,
  "className={'absolute left-0 top-0 bottom-0 w-1.5 ' + item.barColor + ' opacity-90'}"
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed bar color successfully');
