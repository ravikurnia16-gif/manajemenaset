
import fs from 'fs';

const content = fs.readFileSync('d:/MANAJEMEN ASET/client/src/pages/EOffice.jsx', 'utf8');
const lines = content.split('\n');
const startLine = 1060;
const endLine = 1085;

for (let i = startLine - 1; i < endLine; i++) {
    const line = lines[i];
    let charCodes = '';
    for (let j = 0; j < line.length; j++) {
        charCodes += line.charCodeAt(j) + ' ';
    }
    console.log(`Line ${i + 1}: ${JSON.stringify(line)} | Codes: ${charCodes}`);
}
