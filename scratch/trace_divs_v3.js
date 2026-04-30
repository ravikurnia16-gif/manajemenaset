
import fs from 'fs';

const content = fs.readFileSync('d:/MANAJEMEN ASET/client/src/pages/EOffice.jsx', 'utf8');
const lines = content.split('\n');
const start = 401;
const end = 1065;

let stack = [];

for (let i = start - 1; i < end; i++) {
    const line = lines[i];
    const cleanLine = line.replace(/(\/\*.*?\*\/)|(\/\/.*)|(".*?")|('.*?')|(`.*?`)/g, '');
    const tags = cleanLine.match(/<div|<\/div>/g) || [];
    tags.forEach(tag => {
        if (tag === '<div') {
            stack.push(i + 1);
        } else {
            stack.pop();
        }
    });
    if (i > 1055) {
        console.log(`After line ${i + 1}: Stack size ${stack.length}, Stack: ${stack}`);
    }
}
