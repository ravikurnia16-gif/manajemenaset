
import fs from 'fs';

const content = fs.readFileSync('d:/MANAJEMEN ASET/client/src/pages/EOffice.jsx', 'utf8');
const lines = content.split('\n');

let stack = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Remove strings and comments for more accurate tag matching
    const cleanLine = line.replace(/(\/\*.*?\*\/)|(\/\/.*)|(".*?")|('.*?')|(`.*?`)/g, '');
    const tags = cleanLine.match(/<div|<\/div>/g) || [];
    tags.forEach(tag => {
        if (tag === '<div') {
            stack.push(i + 1);
        } else {
            if (stack.length === 0) {
                console.log(`Extra close tag at line ${i + 1}`);
            } else {
                stack.pop();
            }
        }
    });
}

console.log('Unclosed divs started at lines:', stack);
