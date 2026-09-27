const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /className=\{`w-1\.5 h-1\.5 rounded-full shrink-0 \$\{([^}]+)\}`\}/g,
  "className={'w-1.5 h-1.5 rounded-full shrink-0 ' + ($1)}"
);

content = content.replace(
  /title=\{`Audit Trigger Type: \$\{([^}]+)\}`\}/g,
  "title={'Audit Trigger Type: ' + ($1)}"
);

content = content.replace(
  /title=\{`Timestamp: \$\{([^}]+)\}`\}/g,
  "title={'Timestamp: ' + ($1)}"
);

content = content.replace(
  /title=\{`Total Rows Affected: \$\{([^}]+)\}`\}/g,
  "title={'Total Rows Affected: ' + ($1)}"
);

content = content.replace(
  /title=\{`Duration: \$\{([^}]+)\}`\}/g,
  "title={'Duration: ' + ($1)}"
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed audit templates successfully');
