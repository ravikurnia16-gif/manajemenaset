const fs = require('fs');
const path = require('path');
const filePath = path.join('d:', 'MANAJEMEN ASET', 'server', 'controllers', 'procurementController.js');
const content = fs.readFileSync(filePath, 'utf8');

let braceBalance = 0;
const lines = content.split('\n');
lines.forEach((line, i) => {
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;
    braceBalance += (openBraces - closeBraces);

    // Only log where it's at level 0 (should be between functions)
    if (braceBalance === 0 || line.includes('exports.')) {
        console.log(`L${i + 1}: balance=${braceBalance} | ${line.trim()}`);
    }
});
console.log(`Final Brace Balance: ${braceBalance}`);
