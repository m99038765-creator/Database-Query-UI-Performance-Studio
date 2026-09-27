const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /className=\{`text-\[9px\] font-mono font-semibold px-1\.5 py-0\.2 rounded border \$\{impact\.badgeBg\} \$\{impact\.badgeText\} \$\{impact\.badgeBorder\}`\}/g,
  "className={'text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded border ' + impact.badgeBg + ' ' + impact.badgeText + ' ' + impact.badgeBorder}"
);

content = content.replace(
  /title=\{`Estimated B-Tree Impact: \$\{impact\.label\} \(\$\{impact\.estimatedPageSplits\}\)`\}/g,
  "title={'Estimated B-Tree Impact: ' + impact.label + ' (' + impact.estimatedPageSplits + ')'}"
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed impact templates successfully');
