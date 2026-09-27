const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /key=\{`\$\{presetSearchQuery\}-\$\{presetTimeFilter\}-\$\{presetSortMode\}-\$\{exportPresetsList\.length\}`\}/g,
  "key={presetSearchQuery + '-' + presetTimeFilter + '-' + presetSortMode + '-' + exportPresetsList.length}"
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed keys successfully');
