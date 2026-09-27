const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /draggedPdfSectionId \? `"\$\{PDF_SECTION_CONFIG_ITEMS\[draggedPdfSectionId\.includes\('_dup_'\) \? \(draggedPdfSectionId\.split\('_dup_'\)\[0\] as DiagnosticPdfSectionId\) : \(draggedPdfSectionId as DiagnosticPdfSectionId\)\]\?\.title \|\| draggedPdfSectionId\}"` : ''/g,
  "draggedPdfSectionId ? ('\"' + (PDF_SECTION_CONFIG_ITEMS[draggedPdfSectionId.includes('_dup_') ? (draggedPdfSectionId.split('_dup_')[0] as DiagnosticPdfSectionId) : (draggedPdfSectionId as DiagnosticPdfSectionId)]?.title || draggedPdfSectionId) + '\"') : ''"
);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed dragging section successfully');
