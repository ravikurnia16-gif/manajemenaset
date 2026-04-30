
import fs from 'fs';

const content = fs.readFileSync('d:/MANAJEMEN ASET/client/src/pages/EOffice.jsx', 'utf8');
const lines = content.split('\n');
const start = 401;
const end = 1065;

let stack = [];

for (let i = start - 1; i < end; i++) {
    const line = lines[i];
    const tags = line.match(/<div|<\/div>/g) || [];
    tags.forEach(tag => {
        if (tag === '<div') {
            stack.push(i + 1);
        } else {
            stack.pop();
        }
    });
}

console.log('Unclosed divs started at lines:', stack);
