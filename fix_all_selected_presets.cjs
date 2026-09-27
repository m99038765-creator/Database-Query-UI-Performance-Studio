const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /\{selectedPresetIds\.length > 0 \? `\$\{selectedPresetIds\.length\} selected` : 'Select All'\}/g,
  "{selectedPresetIds.length > 0 ? (selectedPresetIds.length + ' selected') : 'Select All'}"
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed selected presets text successfully');
