const fs = require('fs');
const filePath = './src/App.tsx';
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

// Find where sectionGroupsToRender starts and ensure renderCard is closed right before it
for (let i = 8735; i < lines.length; i++) {
  if (lines[i].includes('pdfExportSections.sectionGroups')) {
    // Make sure renderCard is closed right above this
    lines.splice(i, 0, '                                    };', '');
    console.log(`Inserted renderCard closure above sectionGroupsToRender at line ${i+1}`);
    break;
  }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Saved App.tsx.');
