const fs = require('fs');
const filePath = './src/App.tsx';
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

const replacement = [
  '                                         </div>',
  '                                       )}',
  '                                         </div>',
  '                                    };'
];

// Replace from line 8741 (index 8740) to line 8746 (index 8745)
lines.splice(8740, 6, ...replacement);

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Replaced end of renderCard with exact 4 lines.');
