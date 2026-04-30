
import fs from 'fs';

const content = fs.readFileSync('d:/MANAJEMEN ASET/client/src/pages/EOffice.jsx', 'utf8');
let open = 0;
let close = 0;
let inString = false;
let stringChar = '';
let inComment = false;
let commentType = '';

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i+1];

    if (inComment) {
        if (commentType === 'single' && char === '\n') {
            inComment = false;
        } else if (commentType === 'multi' && char === '*' && nextChar === '/') {
            inComment = false;
            i++;
        }
        continue;
    }

    if (inString) {
        if (char === stringChar && content[i-1] !== '\\') {
            inString = false;
        }
        continue;
    }

    if (char === '/' && nextChar === '/') {
        inComment = true;
        commentType = 'single';
        i++;
        continue;
    }
    if (char === '/' && nextChar === '*') {
        inComment = true;
        commentType = 'multi';
        i++;
        continue;
    }

    if (char === '"' || char === "'" || char === '`') {
        inString = true;
        stringChar = char;
        continue;
    }

    if (char === '{') open++;
    if (char === '}') close++;
}

console.log(`Open: ${open}, Close: ${close}`);
