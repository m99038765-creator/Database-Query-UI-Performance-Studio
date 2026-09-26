const fs = require('fs');
const filePath = './src/App.tsx';
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

const replacement = [
  '                                         </div>',
  '                                       )}',
  '                                         </div>',
  '                                     );',
  '                                    };'
];

lines.splice(8740, 4, ...replacement);

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Added ); before }; at the end of renderCard.');
