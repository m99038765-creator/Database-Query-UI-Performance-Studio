const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(
  /title=\{`Estimated completion: \$\{deferredWaitCountdown\.percentComplete\}% \(\$\{deferredWaitCountdown\.formattedSeconds\} remaining\)`\}/g,
  "title={'Estimated completion: ' + deferredWaitCountdown.percentComplete + '% (' + deferredWaitCountdown.formattedSeconds + ' remaining)'}"
);
fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Patched title successfully');
