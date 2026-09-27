const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /data-testid=\{`pending-mutation-item-\$\{idx\}`\}/g,
  "data-testid={'pending-mutation-item-' + idx}"
);
content = content.replace(
  /title=\{`\$\{m\.description \|\| `Transaction #\$\{idx \+ 1\}`\} — \$\{impact\.tooltipText\}`\}/g,
  "title={(m.description || ('Transaction #' + (idx + 1))) + ' — ' + impact.tooltipText}"
);
content = content.replace(
  /id=\{`btn-cancel-mutation-\$\{m\.id\}`\}/g,
  "id={'btn-cancel-mutation-' + m.id}"
);
content = content.replace(
  /data-testid=\{`btn-cancel-mutation-\$\{m\.id\}`\}/g,
  "data-testid={'btn-cancel-mutation-' + m.id}"
);
content = content.replace(
  /aria-label=\{`Cancel pending mutation \$\{m\.description\}`\}/g,
  "aria-label={'Cancel pending mutation ' + m.description}"
);
content = content.replace(
  /title=\{`Cancel pending mutation \$\{m\.description\}`\}/g,
  "title={'Cancel pending mutation ' + m.description}"
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Patched pending mutations list templates successfully');
