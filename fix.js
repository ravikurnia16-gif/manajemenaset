const fs = require('fs');
const file = 'd:/MANAJEMEN ASET/server/controllers/uniformController.js';
let lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

let newLines = [];
for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Remove header Vendor
    if (line.includes("{ header: 'Vendor', key: 'vendor', width: 20 }")) {
        continue;
    }
    
    // Replace addRow
    if (line.includes("sheet.addRow(['Seragam Nasional', 'Kemeja Panjang', 'SMP', 'IKHWAN', 'M', 'Gudang Pusat', vendors.length ? vendors[0].name : '', 50, 5]);")) {
        line = line.replace(" vendors.length ? vendors[0].name : '',", "");
    }
    
    // Remove vendor dataValidation
    if (line.includes("if (vendorList.length) sheet.getCell(`G${i}`).dataValidation")) {
        continue;
    }
    
    // Shift data validation columns H -> G, I -> H, J -> I
    if (line.includes("sheet.getCell(`H${i}`).dataValidation")) {
        line = line.replace("H${i}", "G${i}");
    } else if (line.includes("sheet.getCell(`I${i}`).dataValidation")) {
        line = line.replace("I${i}", "H${i}");
    } else if (line.includes("sheet.getCell(`J${i}`).dataValidation")) {
        line = line.replace("J${i}", "I${i}");
    }
    
    newLines.push(line);
}

fs.writeFileSync(file, newLines.join('\n'));
console.log('Processed');
