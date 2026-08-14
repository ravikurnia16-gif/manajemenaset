const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'server/controllers/uniformController.js');
let content = fs.readFileSync(file, 'utf8');

// Replace column headers
content = content.replace(/\{ header: 'Vendor', key: 'vendor', width: 20 \},\r?\n\s*/g, '');

// Replace addRow
content = content.replace(/vendors\.length \? vendors\[0\]\.name : '', /g, '');

// Replace dataValidation
content = content.replace(/if \(vendorList\.length\) sheet\.getCell\(G\$\{i\}\)\.dataValidation = \{ type: 'list', allowBlank: true, formulae: \[formatValidation\(vendorList\)\] \};\r?\n\s*/g, '');
content = content.replace(/sheet\.getCell\(I\$\{i\}\)\.dataValidation/g, 'sheet.getCell(H).dataValidation');
content = content.replace(/sheet\.getCell\(J\$\{i\}\)\.dataValidation/g, 'sheet.getCell(I).dataValidation');
content = content.replace(/sheet\.getCell\(H\$\{i\}\)\.dataValidation/g, 'sheet.getCell(G).dataValidation');

fs.writeFileSync(file, content);
console.log('Fixed');
