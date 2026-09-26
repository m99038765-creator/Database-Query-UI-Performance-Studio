const fs = require('fs');
const filePath = './src/App.tsx';
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

// Replace lines 8741 to 8746 with the clean 4 lines
const replacement = [
  '                                         </div>',
  '                                       )}',
  '                                         </div>',
  '                                    };'
];

lines.splice(8740, 7, ...replacement);

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Cleaned up renderCard closing.');
