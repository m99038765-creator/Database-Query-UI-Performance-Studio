const fs = require('fs');
const filePath = './src/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Target 1: isDivider block closing parenthesis
const target1 = `                                             />
                                           
                                         
                                           </div>

                                        {/* Vertical Padding Slider Control */}`;

const replacement1 = `                                             />
                                           
                                         
                                           </div>
                                        )}

                                        {/* Vertical Padding Slider Control */}`;

if (content.includes(target1)) {
  content = content.replace(target1, replacement1);
  console.log('Target 1 replaced successfully.');
} else {
  console.log('Target 1 NOT found.');
}

// Target 2: isDetailedPdfLayout fragment closing tag
const target2 = `                                             <span>Color: {(pdfExportSections as any)[item.dividerColorKey] || '#cbd5e1'}</span>
                                            </div>
                                           </div>
                                        )}
                                     
                                          </div>`;

const replacement2 = `                                             <span>Color: {(pdfExportSections as any)[item.dividerColorKey] || '#cbd5e1'}</span>
                                            </div>
                                           </div>
                                        </>
                                        )}
                                     
                                          </div>`;

if (content.includes(target2)) {
  content = content.replace(target2, replacement2);
  console.log('Target 2 replaced successfully.');
} else {
  console.log('Target 2 NOT found.');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done fixing App.tsx');
