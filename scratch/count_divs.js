
import fs from 'fs';

const content = fs.readFileSync('d:/MANAJEMEN ASET/client/src/pages/EOffice.jsx', 'utf8');
const lines = content.split('\n');
const start = 401;
const end = 1065;

let divOpen = 0;
let divClose = 0;

for (let i = start - 1; i < end; i++) {
    const line = lines[i];
    const opens = (line.match(/<div/g) || []).length;
    const closes = (line.match(/<\/div>/g) || []).length;
    divOpen += opens;
    divClose += closes;
}

console.log(`Divs: ${divOpen} open, ${divClose} close`);
