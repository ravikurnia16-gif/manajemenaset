const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const QRCode = require('qrcode');

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
    const topY = height - 40;
    
    // Sisi Kiri: Teks Bahasa Indonesia
    page.drawText('Yayasan Dar el-Iman', {
        x: 50,
        y: topY,
        size: 14,
        font: fontBold,
        color: rgb(0, 0, 0),
    });
    
    const leftLines = [
        'Pendidikan, Dakwah dan Kemanusiaan',
        'SK Kemkumham no :',
        'C-1231.HT.01.02.TH 2006.',
        'Akta Notaris, Dra. Butet, SH,',
        'Tanggal 01 Mei 2006, No. 01.',
        'Padang - Indonesia'
    ];
    
    let leftY = topY - 15;
    leftLines.forEach(text => {
        page.drawText(text, {
            x: 50,
            y: leftY,
            size: 9,
            font: fontRegular,
            color: rgb(0, 0, 0),
        });
        leftY -= 11;
    });

    // Sisi Kanan: Teks Bahasa Arab
    // Catatan: pdf-lib tidak mendukung RTL/Arabic shaping secara native. 
    // Teks ini mungkin akan terbalik jika tidak menggunakan font khusus.
    const rightX = width - 50;
    const arabicName = 'مؤسسة دار الإيمان الخيرية';
    page.drawText(arabicName, {
        x: rightX - 140, 
        y: topY,
        size: 13,
        font: fontBold,
        color: rgb(0, 0, 0),
    });

    const rightLines = [
        'للتعليم و الدعوة و الإنسانية',
        'قرار وزارة العدل و حقوق الإنسان إندونيسيا رقم',
        'ج 1231 إجتي 01.02 تي إج 2006',
        'بموجب صك كتابة العدل : دي. إر. أ. بوتيت إس. هاء',
        'بالتاريخ 1 مايو 2006 ذات الرقم 1',
        'فادانج - إندونيسيا'
    ];

    let rightY = topY - 15;
    rightLines.forEach(text => {
        page.drawText(text, {
            x: rightX - 160,
            y: rightY,
            size: 8,
            font: fontRegular,
            color: rgb(0, 0, 0),
        });
        rightY -= 11;
    });

    // Tengah: Placeholder untuk Logo (Area 100x100 di tengah)
    // Jika Anda memiliki file logo.png, kita bisa embed di sini.

    // Garis Ganda di Bawah Kop
    const lineY = topY - 85;
    // Garis Tebal
    page.drawLine({
        start: { x: 50, y: lineY },
        end: { x: width - 50, y: lineY },
        thickness: 2,
        color: rgb(0, 0, 0),
    });
    // Garis Tipis
    page.drawLine({
        start: { x: 50, y: lineY - 3 },
        end: { x: width - 50, y: lineY - 3 },
        thickness: 0.5,
        color: rgb(0, 0, 0),
    });

    return lineY - 30; // Posisi Y awal untuk konten surat
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
    if (doc.uuid) {
        const qrDataUrl = await generateVerificationQR(doc.uuid);
        const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
        const qrBytes = Buffer.from(qrBase64, 'base64');
        const qrImage = await pdfDoc.embedPng(qrBytes);
        page.drawImage(qrImage, { x: sigX + 20, y: y, width: 60, height: 60 });
    }

    // Tanda Tangan Basah (Jika ada)
    if (doc.signatureData) {
        try {
            const sigData = doc.signatureData.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
            const sigBytes = Buffer.from(sigData, 'base64');
            const sigImage = doc.signatureData.includes('image/png') ? await pdfDoc.embedPng(sigBytes) : await pdfDoc.embedJpg(sigBytes);
            page.drawImage(sigImage, { x: sigX, y: y, width: 100, height: 60 });
        } catch (e) {}
    }

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
        } catch(e) {}
    }

    if (items.length > 0) {
        // Header Tabel
        const colNoX = margin;
        const colNamaX = margin + 30;
        const colQtyX = margin + 250;
        const colKondisiX = margin + 330;
        
        page.drawLine({ start: { x: margin, y: y+12 }, end: { x: width - margin, y: y+12 }, thickness: 1 });
        page.drawText('No', { x: colNoX + 5, y, size: 10, font: fontBold });
        page.drawText('Jenis Barang', { x: colNamaX + 5, y, size: 10, font: fontBold });
        page.drawText('Kuantitas', { x: colQtyX + 5, y, size: 10, font: fontBold });
        page.drawText('Kondisi', { x: colKondisiX + 5, y, size: 10, font: fontBold });
        y -= 8;
        page.drawLine({ start: { x: margin, y: y+12 }, end: { x: width - margin, y: y+12 }, thickness: 1 });
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
        page.drawLine({ start: { x: margin, y: y+12 }, end: { x: width - margin, y: y+12 }, thickness: 1 });
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
        } catch (e) {}
    };

    if (doc.party1Signature) await embedSig(doc.party1Signature, col1X);
    if (doc.party2Signature) await embedSig(doc.party2Signature, col2X);

    // Names
    page.drawText(doc.party1Name || '____________________', { x: col1X, y, size: 11, font: fontBold });
    page.drawText(doc.party2Name || '____________________', { x: col2X, y, size: 11, font: fontBold });

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

module.exports = {
    generateVerificationQR,
    generateSuratPDF,
    generateBASTMouPDF,
};
