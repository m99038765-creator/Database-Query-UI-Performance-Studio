const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /title=\{`Position #\$\{index \+ 1\} in generated PDF report sequence`\}/g,
  "title={'Position #' + (index + 1) + ' in generated PDF report sequence'}"
);
content = content.replace(
  /`Position #\$\{index \+ 1\}`/g,
  "'Position #' + (index + 1)"
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed position templates successfully');
