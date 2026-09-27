const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/className=\{`([^`]+)\$\{([^}]+)\}`\}/g, (match, prefix, expr) => {
  return `className={'${prefix}' + (${expr})}`;
});

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed remaining classNames successfully');
