const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /className=\{`absolute top-full left-8 -mt-1 w-2\.5 h-2\.5 bg-zinc-900 border-r border-b \$\{([^}]+)\} rotate-45`\}/g,
  "className={'absolute top-full left-8 -mt-1 w-2.5 h-2.5 bg-zinc-900 border-r border-b ' + ($1) + ' rotate-45'}"
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed tooltip caret successfully');
