const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/id=\{`([^`]+)\$\{([^}]+)\}`\}/g, (match, prefix, expr) => {
  return `id={'${prefix}' + ${expr}}`;
});

content = content.replace(/data-testid=\{`([^`]+)\$\{([^}]+)\}`\}/g, (match, prefix, expr) => {
  return `data-testid={'${prefix}' + ${expr}}`;
});

content = content.replace(/aria-label=\{`([^`]+)\$\{([^}]+)\}`\}/g, (match, prefix, expr) => {
  return `aria-label={'${prefix}' + ${expr}}`;
});

content = content.replace(/title=\{`([^`]+)\$\{([^}]+)\}`\}/g, (match, prefix, expr) => {
  return `title={'${prefix}' + ${expr}}`;
});

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed remaining JSX templates successfully');
