const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(
  /\{m\.description \|\| `Transaction #\$\{idx \+ 1\}`\}/g,
  "{m.description || ('Transaction #' + (idx + 1))}"
);
fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed description successfully');
