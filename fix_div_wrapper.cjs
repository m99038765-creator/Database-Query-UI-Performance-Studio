const fs = require('fs');
const filePath = './src/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace opening fragment after isDetailedPdfLayout with a div
content = content.replace(
  `                                        {isDetailedPdfLayout && (
                                        <>`,
  `                                        {isDetailedPdfLayout && (
                                        <div className="flex flex-col gap-2">`
);

// Replace closing fragment with div
content = content.replace(
  `                                         </>
                                      )}`,
  `                                         </div>
                                      )}`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Replaced fragment with div wrapper.');
