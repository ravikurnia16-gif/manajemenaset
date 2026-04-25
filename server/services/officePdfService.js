const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'https://sarpras.dareliman.or.id';

/**
 * Generate QR code verification data URL for a document.
 */
async function generateVerificationQR(uuid) {
    const verifyUrl = `${BASE_URL}/verify/${uuid}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        width: 150,
        margin: 1,
        color: { dark: '#1e293b', light: '#ffffff' },
    });
    return qrDataUrl;
}

/**
 * Draw the official Yayasan Dar el-Iman letterhead
 */
async function drawKopSurat(page, fontBold, fontRegular) {
    const { width, height } = page.getSize();
    let y = height - 40;
    const centerX = width / 2;

    // Embed and draw Yayasan Logo (Left Side)
    try {
        const logoPath = path.join(__dirname, '../assets/logo_yayasan.jpg');
        if (fs.existsSync(logoPath)) {
            const logoBytes = fs.readFileSync(logoPath);
            const logoImage = await page.doc.embedJpg(logoBytes);
            page.drawImage(logoImage, {
                x: 45,
                y: height - 120,
                width: 100, // Widened to avoid 'ramping' look
                height: 85,
            });
        }
    } catch (e) {
        console.error('Failed to embed yayasan logo:', e);
    }

    // Embed and draw Sarpras Logo (Right Side)
    try {
        const sarprasPath = path.join(__dirname, '../assets/sarpras.jpeg');
        if (fs.existsSync(sarprasPath)) {
            const sarprasBytes = fs.readFileSync(sarprasPath);
            const sarprasImage = await page.doc.embedJpg(sarprasBytes);
            page.drawImage(sarprasImage, {
                x: width - 125,
                y: height - 115,
                width: 75, // Smaller as requested
                height: 75,
            });
        }
    } catch (e) {
        console.error('Failed to embed sarpras logo:', e);
    }

    const green = rgb(0.37, 0.77, 0.64); // YAYASAN DAR EL-IMAN
    const orange = rgb(0.95, 0.65, 0.48); // BIDANG SARANA
    const gray = rgb(0.4, 0.4, 0.4); // Text

    // 1. YAYASAN DAR EL-IMAN
    const t1 = 'YAYASAN DAR EL-IMAN';
    const w1 = fontBold.widthOfTextAtSize(t1, 16);
    page.drawText(t1, { x: centerX - (w1 / 2), y, size: 16, font: fontBold, color: green });
    y -= 18;

    // 2. BIDANG SARANA DAN PRASARANA
    const t2 = 'BIDANG SARANA DAN PRASARANA';
    const w2 = fontBold.widthOfTextAtSize(t2, 16);
    page.drawText(t2, { x: centerX - (w2 / 2), y, size: 16, font: fontBold, color: orange });
    y -= 18;

    // 3. Motto
    const t3 = '"Merawat dengan Ikhlas, Melayani dengan Sunnah."';
    const w3 = fontRegular.widthOfTextAtSize(t3, 11);
    page.drawText(t3, { x: centerX - (w3 / 2), y, size: 11, font: fontRegular, color: gray });
    y -= 14;

    // 4. Address Line 1
    const t4 = 'Komplek islamic center, Surau Gadang, Kec. Nanggalo, Kota Padang,';
    const w4 = fontRegular.widthOfTextAtSize(t4, 10);
    page.drawText(t4, { x: centerX - (w4 / 2), y, size: 10, font: fontRegular, color: gray });
    y -= 12;

    // 5. Address Line 2
    const t5 = 'Sumatera Barat 25173.';
    const w5 = fontRegular.widthOfTextAtSize(t5, 10);
    page.drawText(t5, { x: centerX - (w5 / 2), y, size: 10, font: fontRegular, color: gray });
    y -= 16;

    // 6. Contact Info
    const t6 = 'WA : 0895-3202-42508                 Email : dar.el.imansarpras@gmail.com';
    const w6 = fontRegular.widthOfTextAtSize(t6, 10);
    page.drawText(t6, { x: centerX - (w6 / 2), y, size: 10, font: fontRegular, color: gray });
    y -= 12;

    // 7. Thick Orange Line
    const lineOrange = rgb(0.96, 0.69, 0.51);
    page.drawLine({
        start: { x: 40, y },
        end: { x: width - 40, y },
        thickness: 3,
        color: lineOrange,
    });

    return y - 30; // Posisi Y awal untuk konten surat
}

/**
 * Helper to draw QR Code Digital Signature with Logo in middle
 */
async function drawDigitalSignature(page, doc, x, y, size = 70) {
    if (!doc.uuid || (doc.status !== 'SIGNED' && doc.status !== 'APPROVED')) return;

    try {
        const qrDataUrl = await generateVerificationQR(doc.uuid);
        const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
        const qrBytes = Buffer.from(qrBase64, 'base64');
        const qrImage = await page.doc.embedPng(qrBytes);

        page.drawImage(qrImage, { x, y, width: size, height: size });

        // Embed Sarpras Logo in the middle
        const sarprasPath = path.join(__dirname, '../assets/sarpras.jpeg');
        if (fs.existsSync(sarprasPath)) {
            const sarprasBytes = fs.readFileSync(sarprasPath);
            const sarprasImage = await page.doc.embedJpg(sarprasBytes);

            const logoSize = size * 0.28;
            const logoOffset = (size - logoSize) / 2;

            // White background for logo
            page.drawRectangle({
                x: x + logoOffset - 1,
                y: y + logoOffset - 1,
                width: logoSize + 2,
                height: logoSize + 2,
                color: rgb(1, 1, 1),
            });

            page.drawImage(sarprasImage, {
                x: x + logoOffset,
                y: y + logoOffset,
                width: logoSize,
                height: logoSize,
            });
        }
    } catch (e) {
        console.error('Digital Signature Draw Error:', e);
    }
}

async function generateSuratPDF(doc, setting) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();

    const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    const startY = await drawKopSurat(page, fontBold, fontRegular);
    const margin = 56;
    let y = startY;

    // === HEADER DOKUMEN (Nomor, Lampiran, Perihal) ===
    if (doc.number) {
        page.drawText(`Nomor     : ${doc.number}`, { x: margin, y, size: 11, font: fontRegular });
        y -= 16;
    }
    page.drawText(`Lampiran  : -`, { x: margin, y, size: 11, font: fontRegular });
    y -= 16;
    page.drawText(`Perihal   : ${doc.subject}`, {
        x: margin, y, size: 11, font: fontBold,
        maxWidth: width - margin * 2
    });
    y -= 40;

    // === ISI SURAT ===
    if (doc.content) {
        const plainText = doc.content
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .trim();

        const lines = plainText.split('\n');
        for (const line of lines) {
            if (y < 150) { /* logic page break bisa ditambah */ }
            if (line.trim() === '') { y -= 8; continue; }

            page.drawText(line, {
                x: margin, y, size: 11, font: fontRegular,
                maxWidth: width - margin * 2,
                lineHeight: 14
            });

            // Estimasi penurunan Y berdasarkan panjang teks
            const textWidth = fontRegular.widthOfTextAtSize(line, 11);
            const numLines = Math.ceil(textWidth / (width - margin * 2));
            y -= (numLines * 16);
        }
    }

    // === TANDA TANGAN ===
    y -= 40;
    const sigX = width - margin - 180;

    // Tanggal
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const d = new Date(doc.date);
    page.drawText(`Padang, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`, { x: sigX, y, size: 11, font: fontRegular });
    y -= 18;

    page.drawText('Kepala Bidang Sarpras,', { x: sigX, y, size: 11, font: fontBold });
    y -= 60;

    // TTE (QR Code)
    await drawDigitalSignature(page, doc, sigX + 20, y);
    y -= 5;

    y -= 20;
    const signerName = doc.signedBy?.name || '____________________';
    page.drawText(signerName, { x: sigX, y, size: 11, font: fontBold });

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

async function generateBASTMouPDF(doc, setting) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();

    const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

    const startY = await drawKopSurat(page, fontBold, fontRegular);
    const margin = 56;
    let y = startY;

    // Judul
    const title = doc.type === 'BAST' ? 'BERITA ACARA SERAH TERIMA' : 'MEMORANDUM OF UNDERSTANDING';
    const titleWidth = fontBold.widthOfTextAtSize(title, 14);
    page.drawText(title, { x: (width - titleWidth) / 2, y, size: 14, font: fontBold });
    y -= 16;

    // Nomor
    if (doc.number) {
        const numText = `Nomor: ${doc.number}`;
        const numWidth = fontRegular.widthOfTextAtSize(numText, 11);
        page.drawText(numText, { x: (width - numWidth) / 2, y, size: 11, font: fontRegular });
    }
    y -= 30;

    // Tanggal Teks Pembuka
    const docDate = new Date(doc.date);
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    page.drawText(`Pada hari ini ${days[docDate.getDay()]}, tanggal ${docDate.getDate()} bulan ${months[docDate.getMonth()]} tahun ${docDate.getFullYear()}, kami yang bertanda tangan di bawah ini:`, {
        x: margin, y, size: 11, font: fontRegular, maxWidth: width - margin * 2, lineHeight: 15
    });
    y -= 30;

    // Pihak 1
    page.drawText('1. Nama', { x: margin, y, size: 11, font: fontRegular });
    page.drawText(`: ${doc.party1Name || '-'}`, { x: margin + 70, y, size: 11, font: fontBold });
    y -= 15;
    page.drawText('   Jabatan', { x: margin, y, size: 11, font: fontRegular });
    page.drawText(`: ${doc.party1Title || '-'}`, { x: margin + 70, y, size: 11, font: fontRegular });
    y -= 15;
    page.drawText('   Alamat', { x: margin, y, size: 11, font: fontRegular });
    page.drawText(`: ${doc.party1Address || doc.party1Org || '-'}`, { x: margin + 70, y, size: 11, font: fontRegular, maxWidth: width - margin - 130 });
    y -= 30;
    page.drawText('Selanjutnya disebut sebagai PIHAK PERTAMA.', { x: margin, y, size: 11, font: fontRegular });
    y -= 25;

    // Pihak 2
    page.drawText('2. Nama', { x: margin, y, size: 11, font: fontRegular });
    page.drawText(`: ${doc.party2Name || '-'}`, { x: margin + 70, y, size: 11, font: fontBold });
    y -= 15;
    page.drawText('   Jabatan', { x: margin, y, size: 11, font: fontRegular });
    page.drawText(`: ${doc.party2Title || '-'}`, { x: margin + 70, y, size: 11, font: fontRegular });
    y -= 15;
    page.drawText('   Alamat', { x: margin, y, size: 11, font: fontRegular });
    page.drawText(`: ${doc.party2Address || doc.party2Org || '-'}`, { x: margin + 70, y, size: 11, font: fontRegular, maxWidth: width - margin - 130 });
    y -= 30;
    page.drawText('Selanjutnya disebut sebagai PIHAK KEDUA.', { x: margin, y, size: 11, font: fontRegular });
    y -= 30;

    // Teks Pengantar Tabel
    page.drawText('PIHAK PERTAMA menyerahkan kepada PIHAK KEDUA, dan PIHAK KEDUA menerima dari PIHAK PERTAMA, barang-barang dengan rincian sebagai berikut:', {
        x: margin, y, size: 11, font: fontRegular, maxWidth: width - margin * 2, lineHeight: 15
    });
    y -= 30;

    // Tabel Barang (Parse JSON dari content)
    let items = [];
    if (doc.type === 'BAST' && doc.content) {
        try {
            items = JSON.parse(doc.content);
        } catch (e) { }
    }

    if (items.length > 0) {
        // Header Tabel
        const colNoX = margin;
        const colNamaX = margin + 30;
        const colQtyX = margin + 250;
        const colKondisiX = margin + 330;

        page.drawLine({ start: { x: margin, y: y + 12 }, end: { x: width - margin, y: y + 12 }, thickness: 1 });
        page.drawText('No', { x: colNoX + 5, y, size: 10, font: fontBold });
        page.drawText('Jenis Barang', { x: colNamaX + 5, y, size: 10, font: fontBold });
        page.drawText('Kuantitas', { x: colQtyX + 5, y, size: 10, font: fontBold });
        page.drawText('Kondisi', { x: colKondisiX + 5, y, size: 10, font: fontBold });
        y -= 8;
        page.drawLine({ start: { x: margin, y: y + 12 }, end: { x: width - margin, y: y + 12 }, thickness: 1 });
        y -= 15;

        // Isi Tabel
        items.forEach((item, index) => {
            page.drawText(`${index + 1}`, { x: colNoX + 5, y, size: 10, font: fontRegular });
            page.drawText(item.name || '-', { x: colNamaX + 5, y, size: 10, font: fontRegular, maxWidth: 200 });
            page.drawText(item.qty || '-', { x: colQtyX + 5, y, size: 10, font: fontRegular });
            page.drawText(item.condition || '-', { x: colKondisiX + 5, y, size: 10, font: fontRegular });
            y -= 15;
            if (y < 100) { /* handle page break ideally, but simplified for now */ }
        });
        page.drawLine({ start: { x: margin, y: y + 12 }, end: { x: width - margin, y: y + 12 }, thickness: 1 });
        y -= 20;
    } else {
        page.drawText('(Tidak ada rincian barang)', { x: margin, y, size: 11, font: fontItalic });
        y -= 20;
    }

    // Penutup
    page.drawText('Demikian Berita Acara Serah Terima ini dibuat dalam keadaan sadar dan tanpa paksaan dari pihak manapun untuk dapat dipergunakan sebagaimana mestinya.', {
        x: margin, y, size: 11, font: fontRegular, maxWidth: width - margin * 2, lineHeight: 15
    });
    y -= 50;

    // Tanda Tangan
    const col1X = margin + 20;
    const col2X = width - margin - 150;

    page.drawText('PIHAK PERTAMA', { x: col1X, y, size: 11, font: fontBold });
    page.drawText('PIHAK KEDUA', { x: col2X, y, size: 11, font: fontBold });
    y -= 15;
    page.drawText(doc.party1Title || '', { x: col1X, y, size: 10, font: fontRegular });
    page.drawText(doc.party2Title || '', { x: col2X, y, size: 10, font: fontRegular });

    y -= 60; // Space for signature

    // Embed Signatures
    const embedSig = async (sigBase64, xPos) => {
        if (!sigBase64) return;
        try {
            const sigData = sigBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
            const sigBytes = Buffer.from(sigData, 'base64');
            const sigImage = sigBase64.includes('image/png') ? await pdfDoc.embedPng(sigBytes) : await pdfDoc.embedJpg(sigBytes);
            page.drawImage(sigImage, { x: xPos, y: y + 5, width: 100, height: 50 });
        } catch (e) { }
    };

    if (doc.party1Signature) await embedSig(doc.party1Signature, col1X);
    if (doc.party2Signature) await embedSig(doc.party2Signature, col2X);

    // Names
    page.drawText(doc.party1Name || '____________________', { x: col1X, y, size: 11, font: fontBold });
    page.drawText(doc.party2Name || '____________________', { x: col2X, y, size: 11, font: fontBold });

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

async function generateSuratTugasPDF(doc, setting) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();

    const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    const startY = await drawKopSurat(page, fontBold, fontRegular);
    const margin = 70;
    let y = startY;

    // Judul
    const title = 'SURAT TUGAS';
    const titleWidth = fontBold.widthOfTextAtSize(title, 14);
    page.drawText(title, { x: (width - titleWidth) / 2, y, size: 14, font: fontBold });
    y -= 16;

    // Nomor
    if (doc.number) {
        const numText = `Nomor: ${doc.number}`;
        const numWidth = fontRegular.widthOfTextAtSize(numText, 11);
        page.drawText(numText, { x: (width - numWidth) / 2, y, size: 11, font: fontRegular });
    }
    y -= 35;

    // Parse Content
    let task = {
        basisList: [''],
        personnelList: [{ name: '', position: '', nip: '' }],
        purposeList: [''],
        dateStart: '',
        dateEnd: '',
        timeRange: '',
        location: '',
        carbonCopy: []
    };

    if (doc.content) {
        try {
            const parsed = JSON.parse(doc.content);
            if (parsed && typeof parsed === 'object') {
                task = { ...task, ...parsed };
                // Handle old data formats if any
                if (!task.basisList && parsed.basis) task.basisList = [parsed.basis];
                if (!task.personnelList && parsed.personnel) task.personnelList = [{ name: parsed.personnel, position: '', nip: '' }];
                if (!task.purposeList && parsed.purpose) task.purposeList = [parsed.purpose];
            }
        } catch (e) {
            task.purposeList = [String(doc.content)];
        }
    }

    const drawListSection = (label, list) => {
        if (!list || list.length === 0 || (list.length === 1 && !list[0])) return;
        page.drawText(label, { x: margin, y, size: 11, font: fontBold });

        const contentX = margin + 80;
        list.forEach((item, idx) => {
            if (!item) return;
            const prefix = list.length > 1 ? `${idx + 1}. ` : ': ';
            const fullText = prefix + item;

            page.drawText(fullText, {
                x: contentX,
                y,
                size: 11,
                font: fontRegular,
                maxWidth: width - margin - 100
            });

            const textWidth = fontRegular.widthOfTextAtSize(fullText, 11);
            const numLines = Math.ceil(textWidth / (width - margin - 100));
            y -= (numLines * 15);
        });
        y -= 8;
    };

    // 1. Dasar
    drawListSection('Dasar', task.basisList);
    y -= 10;

    // MENUGASKAN
    const mText = 'MENUGASKAN:';
    const mw = fontBold.widthOfTextAtSize(mText, 11);
    page.drawText(mText, { x: (width - mw) / 2, y, size: 11, font: fontBold });
    y -= 25;

    // 2. Kepada (Personel)
    page.drawText('Kepada', { x: margin, y, size: 11, font: fontBold });
    const pX = margin + 80;

    if (task.personnelList && task.personnelList.length > 0) {
        task.personnelList.forEach((p, idx) => {
            const prefix = task.personnelList.length > 1 ? `${idx + 1}. ` : '';
            const indent = task.personnelList.length > 1 ? 15 : 0;
            
            page.drawText(`${prefix}Nama`, { x: pX, y, size: 11, font: fontRegular });
            page.drawText(`: ${p.name}`, { x: pX + 50 + indent, y, size: 11, font: fontBold });
            y -= 14;
            
            if (p.position) {
                page.drawText('Jabatan', { x: pX + indent, y, size: 10, font: fontRegular });
                page.drawText(`: ${p.position}`, { x: pX + 50 + indent, y, size: 10, font: fontRegular });
                y -= 13;
            }
            if (p.nip) {
                page.drawText('NIY', { x: pX + indent, y, size: 10, font: fontRegular });
                page.drawText(`: ${p.nip}`, { x: pX + 50 + indent, y, size: 10, font: fontRegular });
                y -= 13;
            }
            y -= 5; // Space between personnel
        });
    }
    y -= 8;

    // 3. Untuk
    drawListSection('Untuk', task.purposeList);

    // 4. Waktu & Tempat
    const formatPeriod = () => {
        if (!task.dateStart) return '';
        const ds = new Date(task.dateStart);
        const de = task.dateEnd ? new Date(task.dateEnd) : ds;
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        if (task.dateStart === task.dateEnd || !task.dateEnd) {
            return `${ds.getDate()} ${months[ds.getMonth()]} ${ds.getFullYear()}`;
        }
        if (ds.getMonth() === de.getMonth() && ds.getFullYear() === de.getFullYear()) {
            return `${ds.getDate()} s.d ${de.getDate()} ${months[ds.getMonth()]} ${ds.getFullYear()}`;
        }
        return `${ds.getDate()} ${months[ds.getMonth()]} s.d ${de.getDate()} ${months[de.getMonth()]} ${de.getFullYear()}`;
    };

    const timeInfo = `${formatPeriod()}${task.timeRange ? ' (' + task.timeRange + ')' : ''}`;
    if (timeInfo) drawListSection('Waktu', [timeInfo]);
    if (task.location) drawListSection('Tempat', [task.location]);

    y -= 25;
    const closing = 'Demikian surat tugas ini diberikan untuk dapat dilaksanakan dengan penuh tanggung jawab.';
    page.drawText(closing, {
        x: margin, y, size: 11, font: fontRegular, maxWidth: width - margin * 2
    });

    // Signature Area
    y -= 50;
    const sigX = width - margin - 180;
    const docDate = new Date(doc.date);
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    page.drawText(`Padang, ${docDate.getDate()} ${months[docDate.getMonth()]} ${docDate.getFullYear()}`, { x: sigX, y, size: 11, font: fontRegular });
    y -= 18;
    page.drawText('Kepala Bidang Sarpras,', { x: sigX, y, size: 11, font: fontBold });

    y -= 65;
    // TTE (QR Code)
    await drawDigitalSignature(page, doc, sigX + 20, y);

    y -= 20;
    const signerName = doc.signedBy?.name || 'Yayasan Dar el-Iman';
    page.drawText(signerName, { x: sigX, y, size: 11, font: fontBold });
    if (doc.signedBy?.nip) {
        y -= 14;
        page.drawText(`NIP. ${doc.signedBy.nip}`, { x: sigX, y, size: 11, font: fontRegular });
    }

    // Tembusan
    if (task.carbonCopy && task.carbonCopy.length > 0 && task.carbonCopy[0]) {
        y = 120; // Fixed position at bottom left
        page.drawText('Tembusan:', { x: margin, y, size: 9, font: fontBold });
        y -= 12;
        task.carbonCopy.forEach((item, idx) => {
            if (!item) return;
            page.drawText(`${idx + 1}. ${item}`, { x: margin, y, size: 9, font: fontRegular });
            y -= 11;
        });
    }

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

module.exports = {
    generateVerificationQR,
    generateSuratPDF,
    generateBASTMouPDF,
    generateSuratTugasPDF,
};
