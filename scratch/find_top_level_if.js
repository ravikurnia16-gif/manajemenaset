
import fs from 'fs';

const content = fs.readFileSync('d:/MANAJEMEN ASET/client/src/pages/EOffice.jsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('if') && line.search(/^\s+/) === -1) {
        console.log(`Potential top-level if at line ${i + 1}: ${line}`);
    }
});
