const fs = require('fs');
const file = 'd:/MANAJEMEN ASET/server/controllers/uniformController.js';
let content = fs.readFileSync(file, 'utf8');

// Find start and end of both exports.importStocks
const startRegex = /exports\.importStocks = async \(req, res\) => \{/g;
let match;
const bounds = [];
while ((match = startRegex.exec(content)) !== null) {
    let braceCount = 1;
    let idx = match.index + match[0].length;
    while (braceCount > 0 && idx < content.length) {
        if (content[idx] === '{') braceCount++;
        else if (content[idx] === '}') braceCount--;
        idx++;
    }
    bounds.push({ start: match.index, end: idx });
}
console.log(JSON.stringify(bounds));
