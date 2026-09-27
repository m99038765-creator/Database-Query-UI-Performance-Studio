const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(
  /\`\$\{pendingMutationsCount\} database mutations are currently mid-process\. Export serialization is paused to prevent dirty reads and partial snapshot tearing\.\`/g,
  "pendingMutationsCount + ' database mutations are currently mid-process. Export serialization is paused to prevent dirty reads and partial snapshot tearing.'"
);
fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Patched text successfully');
