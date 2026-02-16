const fs = require('fs');
const path = require('path');
const filePath = path.join('d:', 'MANAJEMEN ASET', 'server', 'controllers', 'procurementController.js');
const content = fs.readFileSync(filePath, 'utf8');

let tryCount = 0;
let catchCount = 0;
let braceBalance = 0;

const lines = content.split('\n');
lines.forEach((line, i) => {
    const tries = (line.match(/try\s*\{/g) || []).length;
    const catches = (line.match(/catch\s*\(/g) || []).length;
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;

    tryCount += tries;
    catchCount += catches;

    if (tries > 0 || catches > 0) {
        console.log(`L${i + 1}: tries=${tries}, catches=${catches}`);
    }

    braceBalance += (openBraces - closeBraces);

    if (braceBalance < 0) {
        console.log(`Brace balance dropped below zero at line ${i + 1}`);
    }
});

console.log(`Try Count: ${tryCount}`);
console.log(`Catch Count: ${catchCount}`);
console.log(`Final Brace Balance: ${braceBalance}`);
