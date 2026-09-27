const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /title=\{`Total estimated completion: \$\{mutationProgressPercent\}% across \$\{pendingMutationsCount\} active pending database mutation\$\{pendingMutationsCount === 1 \? '' : 's'\}`\}/g,
  "title={'Total estimated completion: ' + mutationProgressPercent + '% across ' + pendingMutationsCount + ' active pending database mutation' + (pendingMutationsCount === 1 ? '' : 's')}"
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Patched remaining title successfully');
