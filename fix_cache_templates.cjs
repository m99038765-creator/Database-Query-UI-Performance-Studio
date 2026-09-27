const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /className=\{`text-\[10px\] uppercase font-bold tracking-wider px-1\.5 py-0\.5 rounded border \$\{([^}]+)\}`\}/g,
  "className={'text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ' + ($1)}"
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed cache template successfully');
