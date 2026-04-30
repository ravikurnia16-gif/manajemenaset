
import fs from 'fs';

const content = fs.readFileSync('d:/MANAJEMEN ASET/client/src/pages/EOffice.jsx', 'utf8');
for (let i = 0; i < content.length; i++) {
    const code = content.charCodeAt(i);
    if (code > 127 && code !== 0x0A && code !== 0x0D) {
        console.log(`Non-ASCII at char ${i}: ${code} (${content[i]}) around: ${content.substring(i-10, i+10)}`);
    }
}
