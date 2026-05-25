const fs = require('fs');
const file = 'server/controllers/personnelController.js';
let content = fs.readFileSync(file, 'utf8');

const replacement = `            if (user.phone) {
                const msg = \`❌ *PENCABUTAN SANKSI DITOLAK*\\n\\n\` +
                    \`Bismillah Ustadz \${user.name},\\n\\n\` +
                    \`Maaf, pengajuan pencabutan sanksi Anda ditolak oleh \${admin.name}.\`;
                await whatsappService.sendMessage(user.phone, msg);
            }
            await createNotification(user.id, 'Pencabutan Sanksi Ditolak', 'Pengajuan pencabutan sanksi Anda ditolak.', 'ERROR', '/kendaraan');

            res.json({ message: 'Pencabutan sanksi ditolak.' });
        }
    } catch (err) {
        console.error('[Review Sanction Lift Error]', err.message);
        res.status(500).json({ error: 'Gagal memproses review pencabutan sanksi: ' + err.message });
    }
};

exports.generateSummary = async (req, res) => {
    try {
        const currentUser = await prisma.user.findUnique({ where: { id: req.user.id } });
        const userPosition = (currentUser?.position || '').toLowerCase();`;

// The exact string in the file (watch out for line endings, we use regex to replace)
const targetRegex = /            if \(user\.phone\) \{\r?\n                const msg = `❌ \*PENCABUTAN SANKSI DITOLAK\*\\n\\n` \+\r?\n                    `Bismillah Ustadz \$\{user\.name\},\\n\\n` \+\r?\n                    `Maaf, pengajuan pencabutan sanksi Anda ditolak oleh \$\{admin\.name\}\.`;\r?\nconst currentUser = await prisma\.user\.findUnique\(\{ where: \{ id: req\.user\.id \} \}\);\r?\n        const userPosition = \(currentUser\?\.position \|\| ''\)\.toLowerCase\(\);/;

content = content.replace(targetRegex, replacement);

fs.writeFileSync(file, content);
console.log('Fixed syntax error in personnelController.js');
