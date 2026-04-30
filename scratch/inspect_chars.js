
import fs from 'fs';

const content = fs.readFileSync('d:/MANAJEMEN ASET/client/src/pages/EOffice.jsx', 'utf8');
const lines = content.split('\n');
const startLine = 1070;
const endLine = 1080;

for (let i = startLine - 1; i < endLine; i++) {
    const line = lines[i];
    console.log(`Line ${i + 1}: ${JSON.stringify(line)}`);
}
