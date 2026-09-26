const fs = require('fs');
const filePath = './src/App.tsx';
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

const replacement = [
  '                                         </div>',
  '                                       )}',
  '                                         </div>',
  '                                    };',
  '',
  '                                    const sectionGroupsToRender = (pdfExportSections.sectionGroups && pdfExportSections.sectionGroups.length > 0)',
  '                                      ? pdfExportSections.sectionGroups',
  '                                      : DEFAULT_PDF_SECTION_GROUPS;'
];

// Find where sectionGroupsToRender appears and replace the chunk around it
for (let i = 8735; i < lines.length; i++) {
  if (lines[i].includes('sectionGroupsToRender') || (lines[i].includes('? pdfExportSections.sectionGroups'))) {
    // Go up a few lines to cover the duplicate };
    lines.splice(i - 4, 10, ...replacement);
    console.log(`Replaced chunk around line ${i+1}`);
    break;
  }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Saved App.tsx cleanly.');
