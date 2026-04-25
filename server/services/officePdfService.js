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
    // Implementasi serupa dengan menggunakan drawKopSurat
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    
    const startY = await drawKopSurat(page, fontBold, fontRegular);
    // ... sisa logika BAST ...
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

module.exports = {
    generateVerificationQR,
    generateSuratPDF,
    generateBASTMouPDF,
};
