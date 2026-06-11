const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'https://sarpras.dareliman.or.id';

/**
 * Generate QR code verification data URL for a document.
 */
async function generateVerificationQR(uuid) {
    const verifyUrl = `${BASE_URL}/verify/${uuid}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        errorCorrectionLevel: 'H',
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
    });
    return qrDataUrl;
}

/**
 * Draw the official Yayasan Dar el-Iman letterhead
 */
async function embedKopSuratImages(pdfDoc) {
    let logoImage = null;
    let sarprasImage = null;
    try {
        const logoPath = path.join(__dirname, '../assets/logo_yayasan.jpg');
        if (fs.existsSync(logoPath)) {
            const logoBytes = fs.readFileSync(logoPath);
            logoImage = await pdfDoc.embedJpg(logoBytes);
        }
        const sarprasPath = path.join(__dirname, '../assets/sarpras.jpeg');
        if (fs.existsSync(sarprasPath)) {
            const sarprasBytes = fs.readFileSync(sarprasPath);
            sarprasImage = await pdfDoc.embedJpg(sarprasBytes);
        }
    } catch (e) {
        console.error('Failed to embed kop surat logos:', e);
    }
    return { logoImage, sarprasImage };
}

function drawKopSuratSync(page, fontBold, fontRegular, images) {
    const { width, height } = page.getSize();
    let y = height - 40;
    const centerX = width / 2;

    if (images && images.logoImage) {
        page.drawImage(images.logoImage, {
            x: 45, y: height - 120, width: 100, height: 85,
        });
    }

    if (images && images.sarprasImage) {
        page.drawImage(images.sarprasImage, {
            x: width - 125, y: height - 115, width: 75, height: 75,
        });
    }

    const green = rgb(0.37, 0.77, 0.64);
    const orange = rgb(0.95, 0.65, 0.48);
    const gray = rgb(0.4, 0.4, 0.4);

    const t1 = 'YAYASAN DAR EL-IMAN';
    const w1 = fontBold.widthOfTextAtSize(t1, 16);
    page.drawText(t1, { x: centerX - (w1 / 2), y, size: 16, font: fontBold, color: green });
    y -= 16;

    const t2 = 'BIDANG SARANA';
    const w2 = fontBold.widthOfTextAtSize(t2, 18);
    page.drawText(t2, { x: centerX - (w2 / 2), y, size: 18, font: fontBold, color: orange });
    y -= 16;

    const t3 = '"Merawat dengan Ikhlas, Melayani dengan Sunnah."';
    const w3 = fontRegular.widthOfTextAtSize(t3, 11);
    page.drawText(t3, { x: centerX - (w3 / 2), y, size: 11, font: fontRegular, color: gray });
    y -= 14;

    const t4 = 'Komplek Islamic Center, Surau Gadang, Kec. Nanggalo, Kota Padang,';
    const w4 = fontRegular.widthOfTextAtSize(t4, 10);
    page.drawText(t4, { x: centerX - (w4 / 2), y, size: 10, font: fontRegular, color: gray });
    y -= 12;

    const t5 = 'Sumatera Barat 25173.';
    const w5 = fontRegular.widthOfTextAtSize(t5, 10);
    page.drawText(t5, { x: centerX - (w5 / 2), y, size: 10, font: fontRegular, color: gray });
    y -= 12;

    const t6 = 'WA : 0895-3202-42508                 Email : dar.el.imansarpras@gmail.com';
    const w6 = fontRegular.widthOfTextAtSize(t6, 10);
    page.drawText(t6, { x: centerX - (w6 / 2), y, size: 10, font: fontRegular, color: gray });
    y -= 10;

    const lineOrange = rgb(0.96, 0.69, 0.51);
    y -= 1;
    page.drawLine({
        start: { x: 40, y },
        end: { x: width - 40, y },
        thickness: 1,
        color: lineOrange,
    });
    return y - 15;
}

/**
 * Helper to draw recipient block (Single or Multiple)
 */
function drawRecipientBlock(page, doc, recipientsData, x, y, fontRegular, fontBold, margin, width) {
    if (recipientsData && recipientsData.isMultiple && recipientsData.list && recipientsData.list.length > 0) {
        if (recipientsData.mode === 'MASSAL') {
            // For massal, this is called per page with a specific recipient index (passed via doc or context)
            // But for now, we'll handle the loop in the main generator.
            // This function will draw just ONE recipient if provided.
            const r = doc._currentRecipient || recipientsData.list[0];
            page.drawText(`Yth. ${r.name || '....................'}`, { x, y, size: 11, font: fontBold });
            y -= 14;
            if (r.title) {
                page.drawText(r.title, { x, y, size: 11, font: fontRegular });
                y -= 14;
            }
            page.drawText('di', { x, y, size: 11, font: fontRegular });
            y -= 14;
            page.drawText(r.address || 'Tempat', { x, y, size: 11, font: fontBold });
            return y - 25;
        } else {
            // LIST Mode: Draw all recipients as a list
            page.drawText('Kepada Yth.', { x, y, size: 11, font: fontBold });
            y -= 16;
            recipientsData.list.forEach((r, idx) => {
                const text = `${idx + 1}. ${r.name}${r.title ? ' - ' + r.title : ''}`;
                const lines = wrapText(text, width - margin * 2, fontRegular, 11);
                lines.forEach(line => {
                    page.drawText(line, { x: x + 10, y, size: 11, font: fontRegular });
                    y -= 14;
                });
            });
            page.drawText('di', { x: x + 10, y, size: 11, font: fontRegular });
            y -= 14;
            page.drawText('Tempat', { x: x + 10, y, size: 11, font: fontBold });
            return y - 25;
        }
    } else {
        // Standard Single Recipient
        page.drawText(`Yth. ${doc.party2Name || '....................'}`, { x, y, size: 11, font: fontBold });
        y -= 14;
        if (doc.party2Title) {
            page.drawText(doc.party2Title, { x, y, size: 11, font: fontRegular });
            y -= 14;
        }
        page.drawText('di', { x, y, size: 11, font: fontRegular });
        y -= 14;
        page.drawText(doc.party2Address || 'Tempat', { x, y, size: 11, font: fontBold });
        return y - 25;
    }
}

async function drawKopSurat(page, fontBold, fontRegular) {
    const images = await embedKopSuratImages(page.doc);
    return drawKopSuratSync(page, fontBold, fontRegular, images);
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

            const logoSize = size * 0.22;
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

/**
 * Helper to initialize PDF with standard fonts and settings
 */
async function createBasePDF() {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    const margin = 50;
    return { pdfDoc, page, fontRegular, fontBold, fontItalic, margin, width, height, rgb };
}

/**
 * Helper to sanitize text for WinAnsi encoding (standard PDF fonts)
 */
function sanitizeTextForWinAnsi(text) {
    if (text === null || text === undefined) return text;
    return String(text)
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\u2013/g, '-')
        .replace(/\u2014/g, '--')
        .replace(/\u2026/g, '...')
        .replace(/[^\x00-\xFF]/g, '');
}

/**
 * Helper to format date to Indonesian locale string
 */
function formatDate(date) {
    const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const d = new Date(date);
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Helper to wrap text into multiple lines
 */
function wrapText(text, maxWidth, font, size) {
    if (!text) return [];
    
    // Clean text from character that cannot be encoded by WinAnsi (like \n)
    // We split by \n to handle paragraphs
    const paragraphs = text.split('\n');
    let allLines = [];
    
    paragraphs.forEach(paragraph => {
        const words = paragraph.split(/\s+/).filter(w => w.length > 0);
        if (words.length === 0) {
            allLines.push(""); // Empty line for empty paragraph
            return;
        }
        
        let currentLine = words[0];
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = font.widthOfTextAtSize(currentLine + " " + word, size);
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                allLines.push(currentLine);
                currentLine = word;
            }
        }
        allLines.push(currentLine);
    });
    
    return allLines;
}

/**
 * Helper to draw justified text within a specified width
 */
function drawJustifiedText(page, text, x, y, maxWidth, size, font) {
    const words = text.split(/\s+/);
    let lines = [];
    let currentLine = [];

    words.forEach(word => {
        const testLine = [...currentLine, word].join(' ');
        const testWidth = font.widthOfTextAtSize(testLine, size);
        if (testWidth > maxWidth && currentLine.length > 0) {
            lines.push(currentLine.join(' '));
            currentLine = [word];
        } else {
            currentLine.push(word);
        }
    });
    lines.push(currentLine.join(' '));

    let currentY = y;
    lines.forEach((line, i) => {
        const isLastLine = i === lines.length - 1;
        if (isLastLine || line.split(' ').length <= 1) {
            page.drawText(line, { x, y: currentY, size, font });
        } else {
            const lineWords = line.split(' ');
            const totalWordsWidth = lineWords.reduce((acc, w) => acc + font.widthOfTextAtSize(w, size), 0);
            const spaceWidth = (maxWidth - totalWordsWidth) / (lineWords.length - 1);
            
            let currentX = x;
            lineWords.forEach((word, j) => {
                page.drawText(word, { x: currentX, y: currentY, size, font });
                currentX += font.widthOfTextAtSize(word, size) + spaceWidth;
            });
        }
        currentY -= size * 1.5;
    });
    return currentY;
}

async function generateSuratPDF(doc, setting) {
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const images = await embedKopSuratImages(pdfDoc);
    
    let content = {};
    try { content = JSON.parse(doc.content || '{}'); } catch (e) {}
    const recipientsData = content.recipientsData;

    const generateSinglePage = async (recipient = null) => {
        let page = pdfDoc.addPage([595.28, 841.89]);
        const { width, height } = page.getSize();
        const kopImages = await embedKopSuratImages(pdfDoc);
        
        const margin = 56;
        const bottomMargin = 60;
        const checkPage = (needed = 30) => {
            if (y - needed < bottomMargin) {
                page = pdfDoc.addPage([595.28, 841.89]);
                y = drawKopSuratSync(page, fontBold, fontRegular, kopImages);
            }
        };

        const startY = drawKopSuratSync(page, fontBold, fontRegular, kopImages);
        let y = startY;

        // === HEADER DOKUMEN ===
        if (doc.number) {
            page.drawText(`Nomor     : ${doc.number}`, { x: margin, y, size: 11, font: fontRegular });
            y -= 16;
        }
        const hasLampiran = (content.lampiranText && content.lampiranText.trim()) || doc.fileUrl;
        page.drawText(`Lampiran  : ${hasLampiran ? '1 Berkas' : '-'}`, { x: margin, y, size: 11, font: fontRegular });
        y -= 16;
        page.drawText(`Perihal   : ${doc.subject}`, {
            x: margin, y, size: 11, font: fontBold,
            maxWidth: width - margin * 2
        });
        y -= 30;

        // === RECIPIENT ===
        if (recipient) doc._currentRecipient = recipient;
        y = drawRecipientBlock(page, doc, recipientsData, margin, y, fontRegular, fontBold, margin, width);

        // ISI SURAT
        let bodyText = content.text || '';
        // Fallback: if content wasn't JSON, use raw doc.content
        if (!bodyText && doc.content && !doc.content.startsWith('{')) {
            bodyText = doc.content;
        }

        if (bodyText) {
            // Simplified content drawing for Surat Keluar
            const plainText = bodyText
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/p>/gi, '\n\n')
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/[\u2018\u2019]/g, "'")
                .replace(/[\u201C\u201D]/g, '"')
                .replace(/\u2013/g, '-')
                .replace(/\u2014/g, '--')
                .replace(/\u2026/g, '...')
                .replace(/[^\x00-\xFF]/g, '')
                .trim();

            const lines = plainText.split('\n');
            for (const line of lines) {
                if (line.trim() === '') { y -= 8; continue; }

                const safeLine = line.replace(/[^\x20-\x7E]/g, '') || '-';
                const textWidth = fontRegular.widthOfTextAtSize(safeLine, 11);
                const numLines = Math.ceil(textWidth / (width - margin * 2));
                const neededSpace = numLines * 16;
                
                checkPage(neededSpace);

                try {
                    page.drawText(line, {
                        x: margin, y, size: 11, font: fontRegular,
                        maxWidth: width - margin * 2,
                        lineHeight: 14
                    });
                } catch (drawErr) {
                    page.drawText(safeLine, {
                        x: margin, y, size: 11, font: fontRegular,
                        maxWidth: width - margin * 2,
                        lineHeight: 14
                    });
                }

                y -= neededSpace;
            }
        }

        // === TANDA TANGAN ===
        checkPage(150);
        y -= 30;
        const sigX = width - margin - 180;
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const d = new Date(doc.date);
        page.drawText(`Padang, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`, { x: sigX, y, size: 11, font: fontRegular });
        y -= 18;

        page.drawText('Kepala Bidang Sarpras,', { x: sigX, y, size: 11, font: fontBold });
        y -= 65;

        await drawDigitalSignature(page, doc, sigX + 20, y, 60);
        y -= 10;
        const signerName = doc.signedBy?.name || '____________________';
        page.drawText(signerName, { x: sigX, y, size: 11, font: fontBold });
    };

    if (recipientsData && recipientsData.isMultiple && recipientsData.mode === 'MASSAL' && recipientsData.list.length > 0) {
        for (const r of recipientsData.list) {
            await generateSinglePage(r);
        }
    } else {
        await generateSinglePage();
    }

    await drawLampiranSection(pdfDoc, doc, fontBold, fontRegular);
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

async function generateBASTMouPDF(doc, setting) {
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();

    const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    const kopImages = await embedKopSuratImages(pdfDoc);

    const margin = 56;
    const bottomMargin = 60;
    const checkPage = (needed = 30) => {
        if (y - needed < bottomMargin) {
            page = pdfDoc.addPage([595.28, 841.89]);
            y = drawKopSuratSync(page, fontBold, fontRegular, kopImages);
        }
    };

    const startY = drawKopSuratSync(page, fontBold, fontRegular, kopImages);
    let y = startY;

    // Judul
    const isBAST = doc.type === 'BAST' || (doc.type === 'SURAT_KELUAR' && (doc.category === 'Serah Terima Barang' || doc.category === 'Berita Acara' || doc.category === 'BAST'));
    const title = isBAST ? 'BERITA ACARA SERAH TERIMA' : 'MEMORANDUM OF UNDERSTANDING';
    const titleWidth = fontBold.widthOfTextAtSize(title, 14);
    page.drawText(title, { x: (width - titleWidth) / 2, y, size: 14, font: fontBold });
    y -= 16;

    // Nomor
    if (doc.number) {
        const numText = `Nomor: ${doc.number}`;
        const numWidth = fontRegular.widthOfTextAtSize(numText, 11);
        page.drawText(numText, { x: (width - numWidth) / 2, y, size: 11, font: fontRegular });
        y -= 20;
    } else {
        y -= 15;
    }

    // Parse content JSON early to get location and items
    let contentData = {};
    if (doc.content) {
        try {
            contentData = JSON.parse(doc.content);
        } catch (e) {}
    }

    // Sanitize document fields to prevent WinAnsi encoding errors
    const sDoc = { ...doc };
    const fieldsToSanitize = ['number', 'party1Name', 'party1Title', 'party1Address', 'party1Org', 'party2Name', 'party2Title', 'party2Address', 'party2Org'];
    fieldsToSanitize.forEach(field => {
        if (sDoc[field]) sDoc[field] = sanitizeTextForWinAnsi(sDoc[field]);
    });


    // Tanggal Teks Pembuka
    const docDate = new Date(doc.date);
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    const formattedDateNum = `${String(docDate.getDate()).padStart(2, '0')}/${String(docDate.getMonth() + 1).padStart(2, '0')}/${docDate.getFullYear()}`;

    const bastLocation = sanitizeTextForWinAnsi(contentData.location) || sDoc.party1Address || 'Padang';
    const openingText = `Pada hari ini, ${days[docDate.getDay()]}, tanggal ${docDate.getDate()} bulan ${months[docDate.getMonth()]} tahun ${docDate.getFullYear()} (${formattedDateNum}), bertempat di ${bastLocation}, kami yang bertanda tangan di bawah ini:`;
    const openingLines = wrapText(openingText, width - margin * 2, fontRegular, 11);
    openingLines.forEach(line => {
        checkPage(18);
        page.drawText(line, { x: margin, y, size: 11, font: fontRegular });
        y -= 15;
    });
    y -= 10;

    // Bagian I: PARA PIHAK
    checkPage(30);
    page.drawText('I. PARA PIHAK', { x: margin, y, size: 11, font: fontBold });
    y -= 15;

    // Pihak 1
    checkPage(20);
    page.drawText('1.', { x: margin + 10, y, size: 11, font: fontRegular });
    page.drawText('Nama', { x: margin + 25, y, size: 11, font: fontBold });
    page.drawText(`: ${sDoc.party1Name || '-'}`, { x: margin + 75, y, size: 11, font: fontBold });
    y -= 15;
    checkPage(20);
    page.drawText('Jabatan', { x: margin + 25, y, size: 11, font: fontBold });
    page.drawText(`: ${sDoc.party1Title || '-'}`, { x: margin + 75, y, size: 11, font: fontBold });
    y -= 15;
    checkPage(20);
    page.drawText('Alamat', { x: margin + 25, y, size: 11, font: fontBold });
    page.drawText(`: ${sDoc.party1Address || '-'}`, { x: margin + 75, y, size: 11, font: fontBold, maxWidth: width - margin - 125 });
    y -= 30; // space for multiline address if any
    checkPage(35);
    page.drawText(`Dalam hal ini bertindak untuk dan atas nama ${sDoc.party1Org || '-'}, selanjutnya disebut sebagai PIHAK PERTAMA (YANG MENYERAHKAN).`, { x: margin + 25, y, size: 11, font: fontRegular, maxWidth: width - margin * 2 - 25, lineHeight: 15 });
    y -= 35;

    // Pihak 2
    checkPage(20);
    page.drawText('2.', { x: margin + 10, y, size: 11, font: fontRegular });
    page.drawText('Nama', { x: margin + 25, y, size: 11, font: fontBold });
    page.drawText(`: ${sDoc.party2Name || '-'}`, { x: margin + 75, y, size: 11, font: fontBold });
    y -= 15;
    checkPage(20);
    page.drawText('Jabatan', { x: margin + 25, y, size: 11, font: fontBold });
    page.drawText(`: ${sDoc.party2Title || '-'}`, { x: margin + 75, y, size: 11, font: fontBold });
    y -= 15;
    checkPage(20);
    page.drawText('Alamat', { x: margin + 25, y, size: 11, font: fontBold });
    page.drawText(`: ${sDoc.party2Address || '-'}`, { x: margin + 75, y, size: 11, font: fontBold, maxWidth: width - margin - 125 });
    y -= 30;
    checkPage(35);
    page.drawText(`Dalam hal ini bertindak untuk dan atas nama ${sDoc.party2Org || '-'}, selanjutnya disebut sebagai PIHAK KEDUA (YANG MENERIMA).`, { x: margin + 25, y, size: 11, font: fontRegular, maxWidth: width - margin * 2 - 25, lineHeight: 15 });
    y -= 45;

    // Garis Pemisah (Opsional, di screenshot ada garis horizontal kecil)
    page.drawLine({ start: { x: margin, y: y + 15 }, end: { x: width - margin, y: y + 15 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    y -= 10;

    // Bagian II: OBJEK SERAH TERIMA
    checkPage(40);
    page.drawText('II. OBJEK SERAH TERIMA', { x: margin, y, size: 11, font: fontBold });
    y -= 15;
    page.drawText('PIHAK PERTAMA menyerahkan kepada PIHAK KEDUA, dan PIHAK KEDUA menyatakan telah menerima dari PIHAK PERTAMA berupa:', {
        x: margin, y, size: 11, font: fontRegular, maxWidth: width - margin * 2, lineHeight: 15
    });
    y -= 30;

    // Tabel Barang (Gunakan contentData yang sudah di-parse)
    let items = [];
    if (Array.isArray(contentData)) {
        items = contentData;
    } else if (contentData && typeof contentData === 'object') {
        items = contentData.items || [];
    }

    if (items.length > 0) {
        // Header Tabel (4 kolom sesuai screenshot)
        const colNoX = margin;
        const colNamaX = margin + 30;
        const colSpecX = margin + 200;
        const colQtyX = width - margin - 100;

        const drawTableHeader = (currentY) => {
            page.drawLine({ start: { x: margin, y: currentY + 12 }, end: { x: width - margin, y: currentY + 12 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
            page.drawText('No', { x: colNoX + 5, y: currentY, size: 10, font: fontBold });
            page.drawText('Nama Barang/Pekerjaan', { x: colNamaX + 5, y: currentY, size: 10, font: fontBold });
            page.drawText('Spesifikasi/Serial Number', { x: colSpecX + 5, y: currentY, size: 10, font: fontBold });
            page.drawText('Jumlah', { x: colQtyX + 5, y: currentY, size: 10, font: fontBold });
            page.drawLine({ start: { x: margin, y: currentY - 5 }, end: { x: width - margin, y: currentY - 5 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
            return currentY - 20;
        };

        y = drawTableHeader(y);

        // Isi Tabel
        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            checkPage(40);

            const itemName = sanitizeTextForWinAnsi(item.name || '-');
            const itemSpec = sanitizeTextForWinAnsi(item.spec || '-');
            const itemQty = sanitizeTextForWinAnsi(String(item.qty || '-'));

            page.drawText(`${i + 1}`, { x: colNoX + 5, y, size: 10, font: fontRegular });
            page.drawText(itemName, { x: colNamaX + 5, y, size: 10, font: fontRegular, maxWidth: 160 });
            page.drawText(itemSpec, { x: colSpecX + 5, y, size: 10, font: fontRegular, maxWidth: 160 });
            page.drawText(itemQty, { x: colQtyX + 5, y, size: 10, font: fontRegular });

            y -= 25;
            page.drawLine({ start: { x: margin, y: y + 15 }, end: { x: width - margin, y: y + 15 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
        }
        y -= 10;
        // y -= 25; // Removed redundant decrement
    } else {
        checkPage(30);
        page.drawText('(Tidak ada rincian barang)', { x: margin, y, size: 11, font: fontItalic });
        y -= 25;
    }

    // Penutup
    checkPage(50);
    page.drawText('Demikian Berita Acara Serah Terima ini dibuat dalam keadaan sadar dan tanpa paksaan dari pihak manapun untuk dapat dipergunakan sebagaimana mestinya.', {
        x: margin, y, size: 11, font: fontRegular, maxWidth: width - margin * 2, lineHeight: 15
    });
    y -= 60;

    // Tanda Tangan
    checkPage(150);
    const col2X = margin + 20; // Pihak Kedua (Kiri)
    const col1X = width - margin - 180; // Pihak Pertama (Kanan)

    page.drawText('PIHAK PERTAMA,', { x: col1X, y, size: 11, font: fontBold });
    page.drawText('PIHAK KEDUA,', { x: col2X, y, size: 11, font: fontBold });
    y -= 15;
    page.drawText(sDoc.party1Title || '', { x: col1X, y, size: 10, font: fontRegular });
    page.drawText(sDoc.party2Title || '', { x: col2X, y, size: 10, font: fontRegular });

    y -= 85; // Increased space for signature to avoid overlap

    // Embed Signatures
    const embedSig = async (sigBase64, xPos, yPos) => {
        if (!sigBase64) return;
        try {
            const sigData = sigBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
            const sigBytes = Buffer.from(sigData, 'base64');
            const sigImage = sigBase64.includes('image/png') ? await pdfDoc.embedPng(sigBytes) : await pdfDoc.embedJpg(sigBytes);
            page.drawImage(sigImage, { x: xPos, y: yPos, width: 100, height: 60 });
        } catch (e) { console.error('Sig Embed Error:', e); }
    };

    if (doc.party1Signature) {
        await embedSig(doc.party1Signature, col1X, y + 10);
    } else if (doc.party1SignedAt) {
        // Pihak 1 signed electronically (TTE)
        try {
            const qrData = doc.qrCodeData || await generateVerificationQR(doc.uuid);
            const qrBytes = Buffer.from(qrData.replace(/^data:image\/png;base64,/, ''), 'base64');
            const qrImage = await pdfDoc.embedPng(qrBytes);
            const qrSize = 65;
            const qrX = col1X;
            const qrY = y + 10;
            page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

            // Draw small Sarpras logo in the middle of QR
            const sarprasPath = path.join(__dirname, '../assets/sarpras.jpeg');
            if (fs.existsSync(sarprasPath)) {
                const sarprasBytes = fs.readFileSync(sarprasPath);
                const sarprasImage = await pdfDoc.embedJpg(sarprasBytes);
                const logoSize = 15;
                page.drawImage(sarprasImage, {
                    x: qrX + (qrSize / 2) - (logoSize / 2),
                    y: qrY + (qrSize / 2) - (logoSize / 2),
                    width: logoSize,
                    height: logoSize,
                });
            }
        } catch (e) { console.error('P1 QR Embed Error:', e); }
    }

    // Only embed party 2 if they have a signature (they always use pad as per request)
    if (doc.party2Signature) await embedSig(doc.party2Signature, col2X, y + 10);

    // Names
    y -= 5;
    page.drawText(sDoc.party1Name || '____________________', { x: col1X, y, size: 11, font: fontBold });
    page.drawText(sDoc.party2Name || '____________________', { x: col2X, y, size: 11, font: fontBold });

    await drawLampiranSection(pdfDoc, doc, fontBold, fontRegular);
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

async function generateSuratTugasPDF(doc, setting) {
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();

    const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    const startY = await drawKopSurat(page, fontBold, fontRegular);
    const kopImages = await embedKopSuratImages(pdfDoc);

    const margin = 70;
    const bottomMargin = 60;
    const checkPage = (needed = 30) => {
        if (y - needed < bottomMargin) {
            page = pdfDoc.addPage([595.28, 841.89]);
            y = drawKopSuratSync(page, fontBold, fontRegular, kopImages);
        }
    };

    let y = startY;

    // Judul
    const title = 'SURAT TUGAS';
    const titleWidth = fontBold.widthOfTextAtSize(title, 14);
    page.drawText(title, { x: (width - titleWidth) / 2, y, size: 14, font: fontBold });
    y -= 16;

    // Nomor
    if (doc.number) {
        const numText = sanitizeTextForWinAnsi(`Nomor: ${doc.number}`);
        const numWidth = fontRegular.widthOfTextAtSize(numText, 11);
        page.drawText(numText, { x: (width - numWidth) / 2, y, size: 11, font: fontRegular });
        y -= 25;
    } else {
        y -= 15;
    }

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
        
        checkPage(25);
        page.drawText(label, { x: margin, y, size: 11, font: fontBold });

        const contentX = margin + 80;
        list.forEach((item, idx) => {
            if (!item) return;
            const prefix = list.length > 1 ? `${idx + 1}. ` : ': ';
            const fullText = sanitizeTextForWinAnsi(prefix + item);

            const textWidth = fontRegular.widthOfTextAtSize(fullText, 11);
            const numLines = Math.ceil(textWidth / (width - margin - 100));
            const needed = numLines * 15;
            
            checkPage(needed);

            page.drawText(fullText, {
                x: contentX,
                y,
                size: 11,
                font: fontRegular,
                maxWidth: width - margin - 100
            });

            y -= needed;
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
            const labelWidth = 55;
            const valueX = pX + labelWidth + indent;
            const maxWidth = width - valueX - margin;

            // Nama
            const safeName = sanitizeTextForWinAnsi(p.name || '-');
            const safePos = sanitizeTextForWinAnsi(p.position || '');
            const safeNip = sanitizeTextForWinAnsi(p.nip || '');

            const nameLines = Math.ceil(fontBold.widthOfTextAtSize(`: ${safeName}`, 11) / maxWidth);
            const posLines = safePos ? Math.ceil(fontRegular.widthOfTextAtSize(`: ${safePos}`, 10) / maxWidth) : 0;
            const nipLines = safeNip ? Math.ceil(fontRegular.widthOfTextAtSize(`: ${safeNip}`, 10) / maxWidth) : 0;
            
            const needed = (nameLines * 14) + (posLines * 13) + (nipLines * 13) + 10;
            checkPage(needed);

            page.drawText(`${prefix}Nama`, { x: pX, y, size: 11, font: fontRegular });
            page.drawText(`: ${safeName}`, {
                x: valueX, y, size: 11, font: fontBold,
                maxWidth: maxWidth
            });
            y -= (nameLines * 14);

            // Jabatan
            if (safePos) {
                page.drawText('Jabatan', { x: pX + indent, y, size: 10, font: fontRegular });
                page.drawText(`: ${safePos}`, {
                    x: valueX, y, size: 10, font: fontRegular,
                    maxWidth: maxWidth
                });
                y -= (posLines * 13);
            }

            // NIY
            if (safeNip) {
                page.drawText('NIY', { x: pX + indent, y, size: 10, font: fontRegular });
                page.drawText(`: ${safeNip}`, {
                    x: valueX, y, size: 10, font: fontRegular,
                    maxWidth: maxWidth
                });
                y -= (nipLines * 13);
            }
            y -= 8; // Space between personnel entries
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
    if (task.location) drawListSection('Tempat', [sanitizeTextForWinAnsi(task.location)]);

    y -= 25;
    const closing = 'Demikian surat tugas ini diberikan untuk dapat dilaksanakan dengan penuh tanggung jawab.';
    page.drawText(closing, {
        x: margin, y, size: 11, font: fontRegular, maxWidth: width - margin * 2
    });

    // Signature Area
    checkPage(180);
    y -= 50;
    const sigX = width - margin - 180;
    const docDate = new Date(doc.date);
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    page.drawText(`Padang, ${docDate.getDate()} ${months[docDate.getMonth()]} ${docDate.getFullYear()}`, { x: sigX, y, size: 11, font: fontRegular });
    y -= 18;
    page.drawText('Kepala Bidang Sarpras,', { x: sigX, y, size: 11, font: fontBold });

    y -= 85;
    // TTE (QR Code)
    await drawDigitalSignature(page, doc, sigX + 20, y);

    y -= 20;
    const signerName = doc.signedBy?.name || 'Yayasan Dar el-Iman';
    page.drawText(signerName, { x: sigX, y, size: 11, font: fontBold });
    if (doc.signedBy?.nip) {
        y -= 14;
        page.drawText(`NIY. ${doc.signedBy.nip}`, { x: sigX, y, size: 11, font: fontRegular });
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

    await drawLampiranSection(pdfDoc, doc, fontBold, fontRegular);
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

/**
 * Generate PDF for Surat Pesanan (Purchasing Order)
 */
async function generateSuratPesananPDF(doc) {
    let { pdfDoc, page, fontRegular, fontBold, fontItalic, margin, width, height, rgb } = await createBasePDF();
    const startY = await drawKopSurat(page, fontBold, fontRegular);
    const kopImages = await embedKopSuratImages(pdfDoc);

    const bottomMargin = 80;
    const checkPage = (needed = 30) => {
        if (y - needed < bottomMargin) {
            page = pdfDoc.addPage([595.28, 841.89]);
            y = drawKopSuratSync(page, fontBold, fontRegular, kopImages);
            return true;
        }
        return false;
    };

    let y = startY;
    const centerX = width / 2;

    // Title
    const title = 'SURAT PESANAN (PURCHASE ORDER)';
    const titleWidth = fontBold.widthOfTextAtSize(title, 14);
    page.drawText(title, { x: centerX - (titleWidth / 2), y, size: 14, font: fontBold });
    y -= 4;
    page.drawLine({ start: { x: centerX - (titleWidth / 2), y }, end: { x: centerX + (titleWidth / 2), y }, thickness: 1 });
    y -= 15;
    if (doc.number) {
        const numText = `Nomor: ${doc.number}`;
        const numWidth = fontRegular.widthOfTextAtSize(numText, 11);
        page.drawText(numText, { x: centerX - (numWidth / 2), y, size: 11, font: fontRegular });
        y -= 25;
    } else {
        y -= 15;
    }

    // Recipient Info
    page.drawText('Kepada Yth,', { x: margin, y, size: 11, font: fontBold });
    y -= 15;
    page.drawText(doc.party2Name || '............................', { x: margin, y, size: 11, font: fontBold });
    y -= 14;
    page.drawText('di tempat', { x: margin, y, size: 10, font: fontRegular });
    y -= 25;

    page.drawText('Dengan hormat,', { x: margin, y, size: 11, font: fontRegular });
    y -= 15;
    
    const preambleText = 'Sehubungan dengan kebutuhan sarana dan prasarana di lingkungan Yayasan Dar el-Iman, bersama ini kami sampaikan pesanan barang/jasa dengan rincian sebagai berikut:';
    y = drawJustifiedText(page, preambleText, margin, y, width - margin * 2, 11, fontRegular);
    y -= 10;

    let content = {};
    try { content = JSON.parse(doc.content || '{}'); } catch (e) {}
    
    let items = [];
    if (Array.isArray(content)) {
        items = content;
    } else if (content && typeof content === 'object') {
        items = content.items || [];
    }
    
    const isPriceDetermined = content.priceDetermined !== false; // Default true

    // Table Header
    const cols = {
        no: margin,
        desc: margin + 30,
        qty: isPriceDetermined ? margin + 230 : width - margin - 120,
        unit: isPriceDetermined ? margin + 270 : width - margin - 70,
        price: margin + 320,
        total: margin + 420
    };

    const drawTableHeader = (currentY) => {
        page.drawRectangle({ x: margin, y: currentY - 5, width: width - margin * 2, height: 20, color: rgb(0.95, 0.95, 0.95) });
        page.drawText('NO', { x: cols.no + 5, y: currentY, size: 8, font: fontBold });
        page.drawText('NAMA BARANG & SPESIFIKASI', { x: cols.desc + 5, y: currentY, size: 8, font: fontBold });
        page.drawText('QTY', { x: cols.qty + 5, y: currentY, size: 8, font: fontBold });
        page.drawText('SAT', { x: cols.unit + 5, y: currentY, size: 8, font: fontBold });
        
        if (isPriceDetermined) {
            page.drawText('HARGA (Rp)', { x: cols.price + 5, y: currentY, size: 8, font: fontBold });
            page.drawText('TOTAL (Rp)', { x: cols.total + 5, y: currentY, size: 8, font: fontBold });
        }
        return currentY - 20;
    };

    y = drawTableHeader(y);

    let grandTotal = 0;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (checkPage(50)) {
            y = drawTableHeader(y);
        }

        page.drawText(String(i + 1), { x: cols.no + 5, y, size: 9, font: fontRegular });
        
        // Name & Spec
        page.drawText(item.name || '-', { x: cols.desc + 5, y, size: 9, font: fontBold });
        if (item.spec) {
            page.drawText(item.spec, { x: cols.desc + 5, y: y - 11, size: 8, font: fontRegular, maxWidth: 190, lineHeight: 10 });
        }

        page.drawText(String(item.qty || 0), { x: cols.qty + 5, y, size: 9, font: fontRegular });
        page.drawText(item.unit || 'Pcs', { x: cols.unit + 5, y, size: 9, font: fontRegular });
        
        if (isPriceDetermined) {
            const price = parseFloat(item.price) || 0;
            const total = (parseFloat(item.qty) || 0) * price;
            const hasPrice = price > 0;
            
            if (hasPrice) {
                grandTotal += total;
                page.drawText(price.toLocaleString('id-ID'), { x: cols.price + 5, y, size: 9, font: fontRegular });
                page.drawText(total.toLocaleString('id-ID'), { x: cols.total + 5, y, size: 9, font: fontBold });
            } else {
                page.drawText('-', { x: cols.price + 5, y, size: 8, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
                page.drawText('-', { x: cols.total + 5, y, size: 8, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
            }
        }
        
        y -= 35; // Row spacing
    }

    // Grand Total
    if (isPriceDetermined) {
        y -= 5;
        page.drawLine({ start: { x: margin, y: y + 10 }, end: { x: width - margin, y: y + 10 }, thickness: 1 });
        page.drawText('TOTAL KESELURUHAN', { x: cols.price - 60, y: y - 5, size: 10, font: fontBold });
        
        const hasAnyUnknownPrice = items.some(it => !(parseFloat(it.price) > 0));
        if (hasAnyUnknownPrice) {
            page.drawText('Menyusul', { x: cols.total + 5, y: y - 5, size: 10, font: fontBold, color: rgb(0.5, 0.5, 0.5) });
        } else {
            page.drawText(`Rp ${grandTotal.toLocaleString('id-ID')}`, { x: cols.total + 5, y: y - 5, size: 11, font: fontBold, color: rgb(0.1, 0.3, 0.7) });
        }
    } else {
        y -= 5;
        page.drawLine({ start: { x: margin, y: y + 10 }, end: { x: width - margin, y: y + 10 }, thickness: 1 });
        page.drawText('* Harga akan ditentukan kemudian setelah konfirmasi/negosiasi.', { x: margin + 5, y: y - 5, size: 9, font: fontItalic, color: rgb(0.4, 0.4, 0.4) });
    }

    y -= 40;

    // Deadline Selesai
    const deadlineVal = content.deadline;
    if (deadlineVal) {
        let formattedDeadline = deadlineVal;
        try {
            const parts = deadlineVal.split('-');
            if (parts.length === 3) {
                const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
                formattedDeadline = `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
            }
        } catch (e) {}
        checkPage(40);
        page.drawText(`Deadline Penyelesaian Pekerjaan / Pengiriman Barang: ${formattedDeadline}`, {
            x: margin,
            y,
            size: 10,
            font: fontBold,
            color: rgb(0.7, 0.15, 0.15)
        });
        y -= 20;
    }

    const closingText = 'Demikianlah surat pesanan ini kami buat untuk dapat dipergunakan sebagaimana mestinya. Atas perhatian dan kerjasamanya kami ucapkan terima kasih.';
    y = drawJustifiedText(page, closingText, margin, y, width - margin * 2, 11, fontRegular);

    y -= 30;
    checkPage(180);
    const sigX = width - margin - 180;

    page.drawText('Hormat Kami,', { x: sigX, y, size: 11, font: fontBold });
    y -= 15;
    page.drawText('Kepala Bidang Sarpras', { x: sigX, y, size: 10, font: fontRegular });

    y -= 85;
    // TTE for Kabid
    await drawDigitalSignature(page, doc, sigX, y, 80);

    y -= 15;
    page.drawText(doc.party1Name || 'Ravi Kurnia', { x: sigX, y, size: 11, font: fontBold });
    y -= 14;
    page.drawText(`NIY. ${doc.signedBy?.nip || '-'}`, { x: sigX, y, size: 10, font: fontRegular });

    // Catatan / Syarat & Ketentuan at the very bottom
    y = 120;
    page.drawLine({ start: { x: margin, y: y + 15 }, end: { x: width - margin, y: y + 15 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    page.drawText('Catatan:', { x: margin, y, size: 9, font: fontBold });
    y -= 12;
    const term1 = '1. Barang harus dikirimkan sesuai dengan spesifikasi dan kualitas yang telah disepakati.';
    y = drawJustifiedText(page, term1, margin, y, width - margin * 2, 8, fontRegular);
    
    const term2 = '2. Pembayaran akan diproses setelah barang diterima dan diperiksa oleh tim Sarpras.';
    y = drawJustifiedText(page, term2, margin, y, width - margin * 2, 8, fontRegular);
    
    const term3 = '3. Surat pesanan ini merupakan dokumen resmi yang mengikat kedua belah pihak.';
    y = drawJustifiedText(page, term3, margin, y, width - margin * 2, 8, fontRegular);

    await drawLampiranSection(pdfDoc, doc, fontBold, fontRegular);
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

async function generateInvoicePDF(doc, setting) {
    const pdfDoc = await PDFDocument.create();
    // A5 Size (Setengah A4) - Landscape (Wide)
    // A4 is [595.28, 841.89] -> A5 is [595.28, 420.94]
    const page = pdfDoc.addPage([595.28, 420.94]);
    const { width, height } = page.getSize();

    const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const margin = 35;
    let y = height - margin;

    // Header - INVOICE
    page.drawText('INVOICE', { x: width - margin - 120, y, size: 24, font: fontBold, color: rgb(0.1, 0.3, 0.7) });
    
    // Org Info
    const orgName = setting?.orgName || 'Manajemen Aset';
    page.drawText(orgName, { x: margin, y: y + 10, size: 14, font: fontBold });
    page.drawText('Sarana & Prasarana', { x: margin, y: y - 5, size: 10, font: fontRegular });
    
    y -= 50;
    
    // Invoice Details
    if (doc.number) {
        page.drawText(`No. Invoice: ${doc.number}`, { x: margin, y, size: 10, font: fontBold });
    }
    page.drawText(`Tanggal: ${new Date(doc.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, { x: width - margin - 150, y, size: 10, font: fontRegular });
    
    y -= 35;
    
    // Bill To
    page.drawText('TAGIHAN KEPADA:', { x: margin, y, size: 9, font: fontBold, color: rgb(0.5, 0.5, 0.5) });
    y -= 15;
    page.drawText(doc.party2Name || '............................', { x: margin, y, size: 11, font: fontBold });
    if (doc.party2Title) {
        y -= 12;
        page.drawText(`Telp: ${doc.party2Title}`, { x: margin, y, size: 9, font: fontRegular });
    }
    y -= 12;
    page.drawText('di tempat', { x: margin, y, size: 9, font: fontRegular });
    
    y -= 30;
    
    // Table Header
    const cols = {
        no: margin,
        desc: margin + 30,
        qty: margin + 280,
        price: margin + 330,
        total: margin + 440
    };
    
    page.drawRectangle({ x: margin, y: y - 5, width: width - margin * 2, height: 20, color: rgb(0.95, 0.96, 0.98) });
    page.drawText('NO', { x: cols.no + 5, y, size: 8, font: fontBold });
    page.drawText('DESKRIPSI', { x: cols.desc + 5, y, size: 8, font: fontBold });
    page.drawText('QTY', { x: cols.qty + 5, y, size: 8, font: fontBold });
    page.drawText('HARGA', { x: cols.price + 5, y, size: 8, font: fontBold });
    page.drawText('TOTAL', { x: cols.total + 5, y, size: 8, font: fontBold });
    
    y -= 25;
    
    let items = [];
    let bankInfo = {};
    let dueDate = '';
    let notes = '';
    try { 
        const parsed = JSON.parse(doc.content || '{}');
        if (Array.isArray(parsed)) {
            items = parsed;
        } else {
            items = parsed.items || [];
            bankInfo = parsed.bankInfo || {};
            dueDate = parsed.dueDate || '';
            notes = parsed.notes || '';
        }
    } catch (e) {}

    let grandTotal = 0;
    items.forEach((item, index) => {
        const itemPrice = parseFloat(item.price) || 0;
        const itemTotal = (parseFloat(item.qty) || 0) * itemPrice;
        grandTotal += itemTotal;
        
        page.drawText(String(index + 1), { x: cols.no + 5, y, size: 9, font: fontRegular });
        page.drawText(item.name || '-', { x: cols.desc + 5, y, size: 9, font: fontBold });
        page.drawText(String(item.qty || 0), { x: cols.qty + 5, y, size: 9, font: fontRegular });
        page.drawText(itemPrice.toLocaleString('id-ID'), { x: cols.price + 5, y, size: 9, font: fontRegular });
        page.drawText(itemTotal.toLocaleString('id-ID'), { x: cols.total + 5, y, size: 9, font: fontBold });
        
        y -= 18;
    });
    
    y -= 10;
    page.drawLine({ start: { x: margin, y: y + 5 }, end: { x: width - margin, y: y + 5 }, thickness: 1, color: rgb(0.1, 0.3, 0.7) });
    
    // Grand Total
    page.drawText('TOTAL PEMBAYARAN', { x: cols.total - 120, y: y - 5, size: 10, font: fontBold });
    page.drawText(`Rp ${grandTotal.toLocaleString('id-ID')}`, { x: cols.total + 5, y: y - 5, size: 12, font: fontBold, color: rgb(0.1, 0.3, 0.7) });
    
    y -= 50;
    
    // Payment Info (Left)
    if (bankInfo.bankName) {
        page.drawText('Informasi Pembayaran:', { x: margin, y: y + 25, size: 8, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
        page.drawText(`Bank: ${bankInfo.bankName}`, { x: margin, y: y + 10, size: 9, font: fontRegular });
        page.drawText(`No. Rek: ${bankInfo.bankAccountNumber}`, { x: margin, y: y - 5, size: 10, font: fontBold });
        page.drawText(`A/N: ${bankInfo.bankAccountName}`, { x: margin, y: y - 20, size: 9, font: fontRegular });
    }
    
    if (dueDate) {
        page.drawText(`Jatuh Tempo: ${new Date(dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, { x: margin, y: y - 35, size: 9, font: fontBold, color: rgb(0.8, 0.1, 0.1) });
    }
    
    // Signature (Right)
    const sigX = width - margin - 150;
    page.drawText('Hormat Kami,', { x: sigX, y: y + 10, size: 10, font: fontBold });
    
    // TTE for Kabid
    await drawDigitalSignature(page, doc, sigX + 10, y - 50, 60);
    
    page.drawText(doc.party1Name || 'Ravi Kurnia', { x: sigX, y: y - 70, size: 10, font: fontBold });

    // LUNAS Stamp
    try {
        const parsed = JSON.parse(doc.content || '{}');
        if (parsed.paymentStatus === 'PAID') {
            const stampX = width / 2 - 50;
            const stampY = 50;
            page.drawRectangle({
                x: stampX,
                y: stampY,
                width: 100,
                height: 40,
                borderColor: rgb(0, 0.6, 0),
                borderWidth: 2,
            });
            page.drawText('LUNAS', {
                x: stampX + 15,
                y: stampY + 12,
                size: 20,
                font: fontBold,
                color: rgb(0, 0.6, 0),
            });
        } else {
            const stampX = width / 2 - 65;
            const stampY = 50;
            page.drawRectangle({
                x: stampX,
                y: stampY,
                width: 130,
                height: 40,
                borderColor: rgb(0.8, 0, 0),
                borderWidth: 2,
            });
            page.drawText('BELUM LUNAS', {
                x: stampX + 12,
                y: stampY + 13,
                size: 14,
                font: fontBold,
                color: rgb(0.8, 0, 0),
            });
        }
    } catch (e) {}

    await drawLampiranSection(pdfDoc, doc, fontBold, fontRegular);
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}
async function generateSuratEdaranPDF(doc, setting) {
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const kopImages = await embedKopSuratImages(pdfDoc);
    
    let content = {};
    try { content = JSON.parse(doc.content || '{}'); } catch (e) {}
    const recipientsData = content.recipientsData;

    const generateSinglePage = async (recipient = null) => {
        let page = pdfDoc.addPage([595.28, 841.89]);
        const { width, height } = page.getSize();
        const margin = 70;
        const contentWidth = width - margin * 2;
        const bottomMargin = 28;
        let y = drawKopSuratSync(page, fontBold, fontRegular, kopImages);

        const checkPage = (needed = 30) => {
            if (y - needed < bottomMargin) {
                page = pdfDoc.addPage([595.28, 841.89]);
                y = drawKopSuratSync(page, fontBold, fontRegular, kopImages);
            }
        };

        const drawJustified = (text, x, maxW, font, size = 11, reserveSpaceForLastLine = 0) => {
            const paragraphs = (text || '').split('\n');
            paragraphs.forEach(para => {
                const words = para.split(/\s+/).filter(w => w.length > 0);
                if (words.length === 0) { y -= 8; return; }
                let lines = [];
                let currentLine = [words[0]];
                for (let i = 1; i < words.length; i++) {
                    const testLine = [...currentLine, words[i]].join(' ');
                    if (font.widthOfTextAtSize(testLine, size) > maxW) {
                        lines.push(currentLine);
                        currentLine = [words[i]];
                    } else {
                        currentLine.push(words[i]);
                    }
                }
                lines.push(currentLine);

                lines.forEach((lineWords, li) => {
                    const isLast = li === lines.length - 1;
                    checkPage(16 + (isLast ? reserveSpaceForLastLine : 0));
                    if (isLast || lineWords.length <= 1) {
                        page.drawText(lineWords.join(' '), { x, y, size, font });
                    } else {
                        const totalW = lineWords.reduce((a, w) => a + font.widthOfTextAtSize(w, size), 0);
                        const space = (maxW - totalW) / (lineWords.length - 1);
                        let cx = x;
                        lineWords.forEach(word => {
                            page.drawText(word, { x: cx, y, size, font });
                            cx += font.widthOfTextAtSize(word, size) + space;
                        });
                    }
                    y -= 15;
                });
            });
        };

        // Title
        const title = "SURAT EDARAN";
        const titleWidth = fontBold.widthOfTextAtSize(title, 14);
        page.drawText(title, { x: (width - titleWidth) / 2, y, size: 14, font: fontBold });
        y -= 2;
        page.drawLine({ start: { x: (width - titleWidth) / 2, y }, end: { x: (width + titleWidth) / 2, y }, thickness: 1.5 });
        y -= 15;

        // Number
        if (doc.number) {
            const numberText = `Nomor: ${doc.number}`;
            const numWidth = fontRegular.widthOfTextAtSize(numberText, 11);
            page.drawText(numberText, { x: (width - numWidth) / 2, y, size: 11, font: fontRegular });
            y -= 18;
        }

        // TENTANG
        const tentangLabel = "TENTANG";
        const tentangLabelWidth = fontBold.widthOfTextAtSize(tentangLabel, 12);
        page.drawText(tentangLabel, { x: (width - tentangLabelWidth) / 2, y, size: 12, font: fontBold });
        y -= 12;

        // Subject
        const subjectLines = wrapText((doc.subject || '').toUpperCase(), width - 140, fontBold, 12);
        subjectLines.forEach(line => {
            const lw = fontBold.widthOfTextAtSize(line, 12);
            page.drawText(line, { x: (width - lw) / 2, y, size: 12, font: fontBold });
            y -= 15;
        });
        y -= 20;

        // Recipient
        if (recipient) doc._currentRecipient = recipient;
        y = drawRecipientBlock(page, doc, recipientsData, margin, y, fontRegular, fontBold, margin, width);

        // 1. Latar Belakang
        checkPage(30);
        page.drawText("1. Latar Belakang", { x: margin, y, size: 11, font: fontBold });
        y -= 15;
        drawJustified(content.background || '-', margin, contentWidth, fontRegular, 11);
        y -= 10;

        // 2. Ketentuan
        checkPage(30);
        page.drawText("2. Ketentuan", { x: margin, y, size: 11, font: fontBold });
        y -= 15;
        drawJustified("Melalui surat edaran ini, disampaikan bahwa:", margin, contentWidth, fontRegular, 11);
        y -= 5;

        const points = content.points || [];
        points.forEach((p, idx) => {
            const pt = typeof p === 'string' ? { text: p, subs: [] } : p;
            checkPage(20);
            const numLabel = `${idx + 1}.`;
            page.drawText(numLabel, { x: margin + 10, y, size: 11, font: fontRegular });
            const pointX = margin + 30;
            const pointW = contentWidth - 30;
            drawJustified(pt.text || '', pointX, pointW, fontRegular, 11);

            const subs = (pt.subs || []).filter(s => s);
            if (subs.length > 0) {
                subs.forEach((sub, sIdx) => {
                    checkPage(16);
                    const subLabel = `${String.fromCharCode(97 + sIdx)}.`;
                    page.drawText(subLabel, { x: margin + 30, y, size: 10, font: fontRegular });
                    const subX = margin + 50;
                    const subW = contentWidth - 50;
                    drawJustified(sub, subX, subW, fontRegular, 10);
                });
            }
            y -= 3;
        });
        y -= 10;

        // 3. Penutup
        checkPage(30);
        page.drawText("3. Penutup", { x: margin, y, size: 11, font: fontBold });
        y -= 15;
        const closing = "Demikian surat edaran ini disampaikan untuk diketahui dan dilaksanakan sebagaimana mestinya. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.";
        drawJustified(closing, margin, contentWidth, fontRegular, 11, 150);
        y -= 20;

        const sigX = width - 250;
        checkPage(120);
        page.drawText("Ditetapkan di: Padang", { x: sigX, y, size: 10, font: fontRegular });
        y -= 14;
        if (doc.signedAt) {
            page.drawText(`Pada tanggal: ${formatDate(doc.signedAt)}`, { x: sigX, y, size: 10, font: fontRegular });
            y -= 18;
        } else {
            y -= 18;
        }

        page.drawText(doc.signedBy?.position || doc.party1Title || 'Kepala Bidang Sarpras', { x: sigX, y, size: 10, font: fontBold });
        y -= 65; // Space for QR

        await drawDigitalSignature(page, doc, sigX, y, 60);
        y -= 10; // Space below QR

        page.drawText(doc.signedBy?.name || doc.party1Name || 'Ravi Kurnia', { x: sigX, y, size: 10, font: fontBold });
        y -= 12;
        page.drawText(`NIY. ${doc.signedBy?.nip || '-'}`, { x: sigX, y, size: 9, font: fontRegular });
    };

    if (recipientsData && recipientsData.isMultiple && recipientsData.mode === 'MASSAL' && recipientsData.list.length > 0) {
        for (const r of recipientsData.list) {
            await generateSinglePage(r);
        }
    } else {
        await generateSinglePage();
    }

    await drawLampiranSection(pdfDoc, doc, fontBold, fontRegular);
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}


async function generateKeputusanPDF(doc, setting) {
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const kopImages = await embedKopSuratImages(pdfDoc);

    let content = { menimbang: [], mengingat: [], menetapkan: [], tembusan: [] };
    try { content = JSON.parse(doc.content || '{}'); } catch (e) {}
    const recipientsData = content.recipientsData;

    const generateSinglePage = async (recipient = null) => {
        let page = pdfDoc.addPage([595.28, 841.89]);
        const { width, height } = page.getSize();
        const margin = 70;
        const contentWidth = width - margin * 2;
        const bottomMargin = 28;
        let y = drawKopSuratSync(page, fontBold, fontRegular, kopImages) - 10;

        const checkPage = (needed = 30) => {
            if (y - needed < bottomMargin) {
                page = pdfDoc.addPage([595.28, 841.89]);
                y = drawKopSuratSync(page, fontBold, fontRegular, kopImages) - 10;
            }
        };

        const drawJustified = (text, x, maxW, font, size = 11, lineSpacing = 1.4, reserveSpaceForLastLine = 0) => {
            const paragraphs = (text || '').split('\n');
            paragraphs.forEach(para => {
                const words = para.split(/\s+/).filter(w => w.length > 0);
                if (words.length === 0) { y -= 8; return; }
                let lines = [];
                let currentLine = [words[0]];
                for (let i = 1; i < words.length; i++) {
                    const testLine = [...currentLine, words[i]].join(' ');
                    if (font.widthOfTextAtSize(testLine, size) > maxW) {
                        lines.push(currentLine);
                        currentLine = [words[i]];
                    } else {
                        currentLine.push(words[i]);
                    }
                }
                lines.push(currentLine);

                lines.forEach((lineWords, li) => {
                    const isLast = li === lines.length - 1;
                    checkPage(size * lineSpacing + 2 + (isLast ? reserveSpaceForLastLine : 0));
                    if (isLast || lineWords.length <= 1) {
                        page.drawText(lineWords.join(' '), { x, y, size, font });
                    } else {
                        const totalW = lineWords.reduce((a, w) => a + font.widthOfTextAtSize(w, size), 0);
                        const space = (maxW - totalW) / (lineWords.length - 1);
                        let cx = x;
                        lineWords.forEach(word => {
                            page.drawText(word, { x: cx, y, size, font });
                            cx += font.widthOfTextAtSize(word, size) + space;
                        });
                    }
                    y -= size * lineSpacing;
                });
            });
        };

        // Header Title
        const headerTitle = "KEPUTUSAN KEPALA BIDANG SARPRAS YAYASAN DAR EL-IMAN";
        const headerTitleLines = wrapText(headerTitle, contentWidth, fontBold, 12);
        headerTitleLines.forEach(line => {
            const lw = fontBold.widthOfTextAtSize(line, 12);
            page.drawText(line, { x: (width - lw) / 2, y, size: 12, font: fontBold });
            y -= 15;
        });

        // Number
        if (doc.number) {
            const numberText = `Nomor: ${doc.number}`;
            const numWidth = fontRegular.widthOfTextAtSize(numberText, 11);
            page.drawText(numberText, { x: (width - numWidth) / 2, y, size: 11, font: fontRegular });
            y -= 20;
        }

        // TENTANG
        const tentangLabel = "TENTANG";
        const tentangLabelWidth = fontBold.widthOfTextAtSize(tentangLabel, 12);
        page.drawText(tentangLabel, { x: (width - tentangLabelWidth) / 2, y, size: 12, font: fontBold });
        y -= 12;

        // Subject
        const subjectLines = wrapText((doc.subject || '').toUpperCase(), contentWidth, fontBold, 12);
        subjectLines.forEach(line => {
            const lw = fontBold.widthOfTextAtSize(line, 12);
            page.drawText(line, { x: (width - lw) / 2, y, size: 12, font: fontBold });
            y -= 15;
        });
        y -= 25;

        // Recipient (Optional in Keputusan, but support it if mode is Massal)
        if (recipientsData && recipientsData.isMultiple) {
            if (recipient) doc._currentRecipient = recipient;
            y = drawRecipientBlock(page, doc, recipientsData, margin, y, fontRegular, fontBold, margin, width);
            y -= 10;
        }

        // Menimbang
        checkPage(30);
        page.drawText("Menimbang :", { x: margin, y, size: 11, font: fontBold });
        const menimbang = content.menimbang || [];
        menimbang.forEach((item, idx) => {
            checkPage(20);
            const label = `${String.fromCharCode(97 + idx)}. `;
            page.drawText(label, { x: margin + 80, y, size: 11, font: fontRegular });
            drawJustified(item, margin + 100, contentWidth - 100, fontRegular, 11);
            y -= 5;
        });
        y -= 15;

        // Mengingat
        checkPage(30);
        page.drawText("Mengingat   :", { x: margin, y, size: 11, font: fontBold });
        const mengingat = content.mengingat || [];
        mengingat.forEach((item, idx) => {
            checkPage(20);
            const label = `${idx + 1}. `;
            page.drawText(label, { x: margin + 80, y, size: 11, font: fontRegular });
            drawJustified(item, margin + 100, contentWidth - 100, fontRegular, 11);
            y -= 5;
        });
        y -= 25;

        // MEMUTUSKAN
        checkPage(40);
        const mLabel = "MEMUTUSKAN:";
        const mlWidth = fontBold.widthOfTextAtSize(mLabel, 12);
        page.drawText(mLabel, { x: (width - mlWidth) / 2, y, size: 12, font: fontBold });
        y -= 30;

        // Menetapkan
        checkPage(30);
        page.drawText("Menetapkan :", { x: margin, y, size: 11, font: fontBold });
        y -= 15;

        const menetapkan = content.menetapkan || [];
        menetapkan.forEach((item, idx) => {
            const isLastItem = idx === menetapkan.length - 1;
            checkPage(30);
            page.drawText(`${item.label} :`, { x: margin + 30, y, size: 11, font: fontBold });
            y -= 15;
            
            const hasSubs = item.subs && Array.isArray(item.subs) && item.subs.length > 0;
            drawJustified(item.text, margin + 30, contentWidth - 30, fontRegular, 11, 1.4, (isLastItem && !hasSubs) ? 150 : 0);
            y -= 10;
            
            if (hasSubs) {
                item.subs.forEach((sub, sIdx) => {
                    if (!sub) return;
                    const isLastSub = sIdx === item.subs.length - 1;
                    checkPage(20);
                    const subLabel = `${String.fromCharCode(97 + sIdx)}. `;
                    page.drawText(subLabel, { x: margin + 50, y, size: 11, font: fontRegular });
                    drawJustified(sub, margin + 70, contentWidth - 70, fontRegular, 11, 1.4, (isLastItem && isLastSub) ? 150 : 0);
                    y -= 5;
                });
            }
        });
        y -= 20;

        // Footer
        checkPage(150);
        const sigX = width - 250;
        page.drawText("Ditetapkan di: Padang", { x: sigX, y, size: 10, font: fontRegular });
        y -= 14;
        if (doc.signedAt) {
            page.drawText(`Pada tanggal: ${formatDate(doc.signedAt)}`, { x: sigX, y, size: 10, font: fontRegular });
            y -= 18;
        } else {
            y -= 18;
        }

        page.drawText(doc.signedBy?.position || doc.party1Title || 'Kepala Bidang Sarpras', { x: sigX, y, size: 10, font: fontBold });
        y -= 65; // Space for QR

        await drawDigitalSignature(page, doc, sigX, y, 60);
        y -= 10; // Space below QR

        page.drawText(doc.signedBy?.name || doc.party1Name || 'Ravi Kurnia', { x: sigX, y, size: 10, font: fontBold });
        y -= 12;
        page.drawText(`NIY. ${doc.signedBy?.nip || '-'}`, { x: sigX, y, size: 9, font: fontRegular });
        y -= 30;

        // Tembusan
        const tembusan = (content.tembusan || []).filter(t => t);
        if (tembusan.length > 0) {
            checkPage(40);
            page.drawText("Tembusan:", { x: margin, y, size: 10, font: fontBold });
            y -= 15;
            tembusan.forEach((item, idx) => {
                checkPage(15);
                page.drawText(`${idx + 1}. ${item}`, { x: margin + 10, y, size: 9, font: fontRegular });
                y -= 12;
            });
        }
    };

    if (recipientsData && recipientsData.isMultiple && recipientsData.mode === 'MASSAL' && recipientsData.list.length > 0) {
        for (const r of recipientsData.list) {
            await generateSinglePage(r);
        }
    } else {
        await generateSinglePage();
    }

    await drawLampiranSection(pdfDoc, doc, fontBold, fontRegular);
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

async function generatePemberitahuanPDF(doc, setting) {
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    const kopImages = await embedKopSuratImages(pdfDoc);

    let content = {};
    try { content = JSON.parse(doc.content || '{}'); } catch (e) {}
    const recipientsData = content.recipientsData;

    const generateSinglePage = async (recipient = null) => {
        let page = pdfDoc.addPage([595.28, 841.89]);
        const { width, height } = page.getSize();
        const margin = 70;
        const contentWidth = width - margin * 2;
        const bottomMargin = 28;
        let y = drawKopSuratSync(page, fontBold, fontRegular, kopImages);

        const checkPage = (needed = 30) => {
            if (y - needed < bottomMargin) {
                page = pdfDoc.addPage([595.28, 841.89]);
                y = drawKopSuratSync(page, fontBold, fontRegular, kopImages);
            }
        };

        const drawJustified = (text, x, maxW, font, size = 11, lineSpacing = 1.4, reserveSpaceForLastLine = 0) => {
            const paragraphs = (text || '').split('\n');
            paragraphs.forEach(para => {
                const words = para.split(/\s+/).filter(w => w.length > 0);
                if (words.length === 0) { y -= 8; return; }
                let lines = [];
                let currentLine = [words[0]];
                for (let i = 1; i < words.length; i++) {
                    const testLine = [...currentLine, words[i]].join(' ');
                    if (font.widthOfTextAtSize(testLine, size) > maxW) {
                        lines.push(currentLine);
                        currentLine = [words[i]];
                    } else {
                        currentLine.push(words[i]);
                    }
                }
                lines.push(currentLine);

                lines.forEach((lineWords, li) => {
                    const isLast = li === lines.length - 1;
                    checkPage(size * lineSpacing + 2 + (isLast ? reserveSpaceForLastLine : 0));
                    if (isLast || lineWords.length <= 1) {
                        page.drawText(lineWords.join(' '), { x, y, size, font });
                    } else {
                        const totalW = lineWords.reduce((a, w) => a + font.widthOfTextAtSize(w, size), 0);
                        const space = (maxW - totalW) / (lineWords.length - 1);
                        let cx = x;
                        lineWords.forEach(word => {
                            page.drawText(word, { x: cx, y, size, font });
                            cx += font.widthOfTextAtSize(word, size) + space;
                        });
                    }
                    y -= size * lineSpacing;
                });
            });
        };

        // Title: SURAT PEMBERITAHUAN
        const title = "SURAT PEMBERITAHUAN";
        const titleWidth = fontBold.widthOfTextAtSize(title, 14);
        page.drawText(title, { x: (width - titleWidth) / 2, y, size: 14, font: fontBold });
        y -= 2;
        page.drawLine({ start: { x: (width - titleWidth) / 2, y }, end: { x: (width + titleWidth) / 2, y }, thickness: 1.5 });
        y -= 15;

        // Number
        if (doc.number) {
            const numberText = `Nomor: ${doc.number}`;
            const numWidth = fontRegular.widthOfTextAtSize(numberText, 11);
            page.drawText(numberText, { x: (width - numWidth) / 2, y, size: 11, font: fontRegular });
            y -= 25;
        }

        // Perihal
        const perihalLabel = "Perihal:";
        page.drawText(perihalLabel, { x: margin, y, size: 11, font: fontBold });
        const perihalValueX = margin + fontBold.widthOfTextAtSize(perihalLabel, 11) + 8;
        const subjectLines = wrapText(doc.subject || '', contentWidth - (perihalValueX - margin), fontBold, 11);
        subjectLines.forEach((line, idx) => {
            page.drawText(line, { x: perihalValueX, y, size: 11, font: fontBold });
            y -= 14;
        });
        y -= 15;

        // Recipient
        if (recipient) doc._currentRecipient = recipient;
        y = drawRecipientBlock(page, doc, recipientsData, margin, y, fontRegular, fontBold, margin, width);

        // Salam Pembuka
        checkPage(20);
        page.drawText("Assalamu'alaikum Warahmatullahi Wabarakatuh,", { x: margin, y, size: 11, font: fontItalic });
        y -= 20;

        checkPage(20);
        page.drawText("Dengan hormat,", { x: margin, y, size: 11, font: fontRegular });
        y -= 15;

        // Fixed intro
        checkPage(30);
        const introText = "Segala puji bagi Allah Subhaanahu wa ta'aala yang senantiasa melimpahkan nikmat dan hidayah-Nya kepada kita semua. Shalawat dan salam atas Nabi Muhammad Shalallaahu 'alaihi wa sallam. Kami mendo'akan semoga Bapak/Ibu selalu berada dalam lindungan Allah Subhaanahu wa ta'aala, Amin.";
        drawJustified(introText, margin, contentWidth, fontRegular, 11);
        y -= 8;

        // Pembukaan paragraph
        if (content.pembukaan) {
            checkPage(30);
            drawJustified(content.pembukaan, margin, contentWidth, fontRegular, 11);
            y -= 8;
        }

        // Points
        const points = (content.points || []).filter(p => p);
        if (points.length > 0) {
            checkPage(20);
            page.drawText("Adapun poin-poin penting yang perlu diperhatikan adalah:", { x: margin, y, size: 11, font: fontRegular });
            y -= 18;

            points.forEach((point, idx) => {
                checkPage(25);
                const label = `${idx + 1}. `;
                const labelWidth = fontBold.widthOfTextAtSize(label, 11);
                page.drawText(label, { x: margin + 15, y, size: 11, font: fontBold });
                drawJustified(point, margin + 15 + labelWidth + 3, contentWidth - 15 - labelWidth - 3, fontRegular, 11);
                y -= 5;
            });
            y -= 5;
        }

        // Penutup
        if (content.penutup) {
            checkPage(30);
            drawJustified(content.penutup, margin, contentWidth, fontRegular, 11);
            y -= 8;
        }

        // Salam Penutup
        checkPage(130);
        page.drawText("Wassalamu'alaikum Warahmatullahi Wabarakatuh.", { x: margin, y, size: 11, font: fontItalic });
        y -= 20;

        // Signature
        const sigX = width - 250;
            page.drawText(doc.signedBy?.position || doc.party1Title || 'Kepala Bidang Sarana,', { x: sigX, y, size: 10, font: fontBold });
        y -= 65;

        await drawDigitalSignature(page, doc, sigX, y, 60);
        y -= 10;

        page.drawText(doc.signedBy?.name || doc.party1Name || 'Ravi Kurnia', { x: sigX, y, size: 10, font: fontBold });
        y -= 12;
        page.drawText(`NIY. ${doc.signedBy?.nip || '-'}`, { x: sigX, y, size: 9, font: fontRegular });
    };

    if (recipientsData && recipientsData.isMultiple && recipientsData.mode === 'MASSAL' && recipientsData.list.length > 0) {
        for (const r of recipientsData.list) {
            await generateSinglePage(r);
        }
    } else {
        await generateSinglePage();
    }

    await drawLampiranSection(pdfDoc, doc, fontBold, fontRegular);
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

async function drawLampiranSection(pdfDoc, doc, fontBold, fontRegular) {
    let content = {};
    try { content = JSON.parse(doc.content || '{}'); } catch (e) {}

    const hasTextLampiran = content.lampiranText && content.lampiranText.trim();
    const fileUrls = doc.fileUrl ? doc.fileUrl.split(',').map(u => u.trim()).filter(u => u !== '') : [];
    const photoUrls = fileUrls.filter(u => u.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/i) != null);
    const hasPhotoLampiran = photoUrls.length > 0;

    if (!hasTextLampiran && !hasPhotoLampiran) return;

    let page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    const margin = 70;
    const contentWidth = width - margin * 2;
    let y = height - 60;

    page.drawText("LAMPIRAN", { x: margin, y, size: 14, font: fontBold });
    y -= 5;
    page.drawLine({ start: { x: margin, y }, end: { x: margin + 80, y }, thickness: 1.5 });
    y -= 30;

    if (hasTextLampiran) {
        const paragraphs = content.lampiranText.split('\n');
        paragraphs.forEach(para => {
            const lines = wrapText(para, contentWidth, fontRegular, 11);
            lines.forEach(line => {
                if (y < 60) {
                    page = pdfDoc.addPage([595.28, 841.89]);
                    y = height - 60;
                }
                page.drawText(line, { x: margin, y, size: 11, font: fontRegular });
                y -= 15;
            });
            y -= 5;
        });
        y -= 20;
    }

    if (hasPhotoLampiran) {
        const colCount = 2;
        const rowCount = 3;
        const gapX = 15;
        const gapY = 20;
        const colWidth = (contentWidth - gapX) / colCount;
        const maxRowHeight = (height - 120 - (gapY * (rowCount - 1))) / rowCount;

        let currentImgIndex = 0;
        let pageStartY = y;

        for (const url of photoUrls) {
            try {
                let imgBytes;
                let fileExt = '';
                
                if (url.startsWith('http')) {
                    const response = await axios.get(url, { responseType: 'arraybuffer' });
                    imgBytes = Buffer.from(response.data);
                    const contentType = response.headers['content-type'] || '';
                    if (contentType.includes('png')) fileExt = '.png';
                    else if (contentType.includes('jpeg') || contentType.includes('jpg')) fileExt = '.jpg';
                    else fileExt = url.toLowerCase().endsWith('.png') ? '.png' : '.jpg';
                } else if (url.startsWith('/api/media/')) {
                    const { minioClient, bucketName } = require('./minioService');
                    const objectName = url.replace('/api/media/', '');
                    try {
                        const dataStream = await minioClient.getObject(bucketName, objectName);
                        const chunks = [];
                        for await (const chunk of dataStream) {
                            chunks.push(chunk);
                        }
                        imgBytes = Buffer.concat(chunks);
                        fileExt = objectName.toLowerCase().endsWith('.png') ? '.png' : '.jpg';
                    } catch (minioErr) {
                        console.error('Failed to get from MinIO:', minioErr);
                    }
                } else {
                    const filePath = path.join(__dirname, '..', url);
                    if (fs.existsSync(filePath)) {
                        imgBytes = fs.readFileSync(filePath);
                        fileExt = path.extname(filePath).toLowerCase();
                    }
                }

                if (imgBytes) {
                    const img = (fileExt === '.png') ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);
                    
                    const indexOnPage = currentImgIndex % (colCount * rowCount);

                    // Handle pagination
                    if (currentImgIndex > 0 && indexOnPage === 0) {
                        page = pdfDoc.addPage([595.28, 841.89]);
                        pageStartY = height - 60;
                    } else if (currentImgIndex === 0 && pageStartY - maxRowHeight < 60) {
                        // If the first page doesn't even have space for one row
                        page = pdfDoc.addPage([595.28, 841.89]);
                        pageStartY = height - 60;
                    }

                    const col = indexOnPage % colCount;
                    const row = Math.floor(indexOnPage / colCount);

                    const imgDims = img.scale(1);
                    let finalWidth = imgDims.width;
                    let finalHeight = imgDims.height;
                    
                    if (finalWidth > colWidth) {
                        const ratio = colWidth / finalWidth;
                        finalWidth = colWidth;
                        finalHeight = finalHeight * ratio;
                    }
                    
                    if (finalHeight > maxRowHeight) {
                        const ratio = maxRowHeight / finalHeight;
                        finalHeight = maxRowHeight;
                        finalWidth = finalWidth * ratio;
                    }

                    const xPos = margin + col * (colWidth + gapX);
                    const centeredX = xPos + (colWidth - finalWidth) / 2;

                    const rowTopY = pageStartY - row * (maxRowHeight + gapY);
                    const centeredY = rowTopY - (maxRowHeight - finalHeight) / 2 - finalHeight;

                    page.drawImage(img, {
                        x: centeredX,
                        y: centeredY,
                        width: finalWidth,
                        height: finalHeight
                    });

                    currentImgIndex++;
                }
            } catch (e) {
                console.error('Failed to draw photo lampiran:', e);
            }
        }
    }
}


/**
 * GENERATE SURAT LAINNYA (OTHER / CUSTOM LETTER)
 * Content extracted from uploaded .doc/.docx file.
 * Features: Kop Surat, Judul Surat centered, Nomor Surat otomatis, TTE.
 */
async function generateSuratLainnyaPDF(doc, setting) {
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    const kopImages = await embedKopSuratImages(pdfDoc);

    let content = {};
    try { content = JSON.parse(doc.content || '{}'); } catch (e) {}

    let page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    const margin = 56;
    const contentWidth = width - margin * 2;
    const bottomMargin = 60;
    let y = drawKopSuratSync(page, fontBold, fontRegular, kopImages);

    const checkPage = (needed = 30) => {
        if (y - needed < bottomMargin) {
            page = pdfDoc.addPage([595.28, 841.89]);
            y = height - 50;
        }
    };

    const drawJustified = (text, x, maxW, font, size = 11) => {
        const paragraphs = (text || '').split('\n');
        paragraphs.forEach(para => {
            const words = para.split(/\s+/).filter(w => w.length > 0);
            if (words.length === 0) { y -= 8; return; }
            let lines = [];
            let currentLine = [words[0]];
            for (let i = 1; i < words.length; i++) {
                const testLine = [...currentLine, words[i]].join(' ');
                if (font.widthOfTextAtSize(testLine, size) > maxW) {
                    lines.push(currentLine);
                    currentLine = [words[i]];
                } else {
                    currentLine.push(words[i]);
                }
            }
            lines.push(currentLine);

            lines.forEach((lineWords, li) => {
                const isLast = li === lines.length - 1;
                checkPage(size * 1.4 + 2);
                if (isLast || lineWords.length <= 1) {
                    page.drawText(lineWords.join(' '), { x, y, size, font });
                } else {
                    const totalW = lineWords.reduce((a, w) => a + font.widthOfTextAtSize(w, size), 0);
                    const space = (maxW - totalW) / (lineWords.length - 1);
                    let cx = x;
                    lineWords.forEach(word => {
                        page.drawText(word, { x: cx, y, size, font });
                        cx += font.widthOfTextAtSize(word, size) + space;
                    });
                }
                y -= size * 1.4;
            });
        });
    };

    // === JUDUL SURAT (centered, bold, uppercase) ===
    const title = (content.title || doc.subject || 'SURAT').toUpperCase();
    const titleLines = wrapText(title, contentWidth, fontBold, 14);
    titleLines.forEach(line => {
        const lw = fontBold.widthOfTextAtSize(line, 14);
        page.drawText(line, { x: (width - lw) / 2, y, size: 14, font: fontBold });
        y -= 18;
    });

    // Underline title
    const lastTitleLine = titleLines[titleLines.length - 1] || '';
    const lastTitleWidth = fontBold.widthOfTextAtSize(lastTitleLine, 14);
    page.drawLine({
        start: { x: (width - lastTitleWidth) / 2, y: y + 4 },
        end: { x: (width + lastTitleWidth) / 2, y: y + 4 },
        thickness: 1.5,
    });
    y -= 8;

    // === NOMOR SURAT (centered) ===
    if (doc.number) {
        const numText = `Nomor: ${doc.number}`;
        const numWidth = fontRegular.widthOfTextAtSize(numText, 11);
        page.drawText(numText, { x: (width - numWidth) / 2, y, size: 11, font: fontRegular });
        y -= 25;
    } else {
        y -= 15;
    }

    // === ISI DOKUMEN (from extracted docx) ===
    const bodyText = content.body || '';

    if (bodyText) {
        // Clean text for WinAnsi encoding
        const cleanText = bodyText
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/\u2013/g, '-')
            .replace(/\u2014/g, '--')
            .replace(/\u2026/g, '...')
            .replace(/[^\x00-\xFF]/g, '');

        const paragraphs = cleanText.split('\n');
        for (const para of paragraphs) {
            if (para.trim() === '') {
                y -= 10;
                continue;
            }
            checkPage(20);
            drawJustified(para.trim(), margin, contentWidth, fontRegular, 11);
            y -= 4;
        }
    } else {
        checkPage(20);
        page.drawText('(Konten dokumen kosong)', { x: margin, y, size: 11, font: fontItalic, color: rgb(0.5, 0.5, 0.5) });
        y -= 20;
    }

    // === TANDA TANGAN ===
    y -= 30;
    const sigX = width - 250;
    checkPage(130);

    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const d = new Date(doc.date);
    page.drawText(`Padang, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`, { x: sigX, y, size: 11, font: fontRegular });
    y -= 18;

    page.drawText(doc.signedBy?.position || 'Kepala Bidang Sarana,', { x: sigX, y, size: 10, font: fontBold });
    y -= 65;

    await drawDigitalSignature(page, doc, sigX, y, 60);
    y -= 10;

    const signerName = doc.signedBy?.name || doc.party1Name || '____________________';
    page.drawText(signerName, { x: sigX, y, size: 10, font: fontBold });
    y -= 14;
    if (doc.signedBy?.nip) {
        page.drawText(`NIY. ${doc.signedBy.nip}`, { x: sigX, y, size: 9, font: fontRegular });
    }

    await drawLampiranSection(pdfDoc, doc, fontBold, fontRegular);
    return await pdfDoc.save();
}


module.exports = {
    generateVerificationQR,
    generateSuratPDF,
    generateBASTMouPDF,
    generateSuratTugasPDF,
    generateSuratPesananPDF,
    generateInvoicePDF,
    generateSuratEdaranPDF,
    generateKeputusanPDF,
    generatePemberitahuanPDF,
    generateSuratUmumPDF,
    generateSuratLainnyaPDF,
    generateBeritaAcaraKunjunganPDF
};

/**
 * GENERATE BERITA ACARA KUNJUNGAN
 */
async function generateBeritaAcaraKunjunganPDF(doc, setting) {
    const { pdfDoc, fontBold, fontRegular, width, height, margin } = await createBasePDF(setting);
    let page = pdfDoc.getPages()[0];
    const contentWidth = width - (2 * margin);
    const cursor = { y: height - 145 };

    // Draw Kop Surat
    await drawKopSurat(page, fontBold, fontRegular);

    const content = typeof doc.content === 'string' ? JSON.parse(doc.content) : (doc.content || {});

    // Title
    const title = "BERITA ACARA KUNJUNGAN";
    const titleWidth = fontBold.widthOfTextAtSize(title, 14);
    page.drawText(title, { x: (width - titleWidth) / 2, y: cursor.y, size: 14, font: fontBold });
    cursor.y -= 2;
    page.drawLine({ start: { x: (width - titleWidth) / 2, y: cursor.y }, end: { x: (width + titleWidth) / 2, y: cursor.y }, thickness: 1.5 });
    cursor.y -= 15;

    if (doc.number) {
        const numberText = sanitizeTextForWinAnsi(`Nomor: ${doc.number}`);
        const numWidth = fontRegular.widthOfTextAtSize(numberText, 11);
        page.drawText(numberText, { x: (width - numWidth) / 2, y: cursor.y, size: 11, font: fontRegular });
        cursor.y -= 30;
    } else {
        cursor.y -= 20;
    }

    const checkPage = (needed) => {
        if (cursor.y < 60 + needed) {
            page = pdfDoc.addPage([595.28, 841.89]);
            cursor.y = height - 60;
        }
    };

    const drawTextWrapped = (text, xOffset, size, font, lineHeight = 15) => {
        const safeText = sanitizeTextForWinAnsi(text || '-');
        const lines = wrapText(safeText, contentWidth - xOffset, font, size);
        lines.forEach(line => {
            checkPage(lineHeight);
            page.drawText(line, { x: margin + xOffset, y: cursor.y, size, font });
            cursor.y -= lineHeight;
        });
    };

    const drawJustified = (text, x, w, font, size) => {
        const safeText = sanitizeTextForWinAnsi(text || '-');
        const lines = wrapText(safeText, w, font, size);
        lines.forEach((line, i) => {
            const isLast = i === lines.length - 1;
            checkPage(20);
            if (isLast || line.split(' ').length <= 1) {
                page.drawText(line, { x, y: cursor.y, size, font });
            } else {
                const words = line.split(' ');
                const totalW = words.reduce((acc, word) => acc + font.widthOfTextAtSize(word, size), 0);
                const spaceW = (w - totalW) / (words.length - 1);
                let curX = x;
                words.forEach((word) => {
                    page.drawText(word, { x: curX, y: cursor.y, size, font });
                    curX += font.widthOfTextAtSize(word, size) + spaceW;
                });
            }
            cursor.y -= 15;
        });
    };

    // Pembukaan
    const d = new Date(content.date || doc.date || new Date());
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    const openingText = `Pada hari ini, ${days[d.getDay()]} tanggal ${d.getDate()} bulan ${months[d.getMonth()]} tahun ${d.getFullYear()}, telah dilaksanakan kegiatan kunjungan dalam rangka ${content.purpose || '................................'}.`;
    
    drawJustified(openingText, margin, contentWidth, fontRegular, 11);
    cursor.y -= 15;

    // Bagian I: LOKASI
    checkPage(40);
    page.drawText("I. LOKASI KUNJUNGAN", { x: margin, y: cursor.y, size: 11, font: fontBold });
    cursor.y -= 15;
    page.drawText("Kegiatan kunjungan tersebut dilaksanakan di:", { x: margin, y: cursor.y, size: 11, font: fontRegular });
    cursor.y -= 20;

    checkPage(40);
    drawTextWrapped(content.locationName, 20, 11, fontBold);
    cursor.y -= 5;
    drawTextWrapped(content.locationAddress, 20, 11, fontRegular);
    cursor.y -= 15;

    // Bagian II: URAIAN
    checkPage(40);
    page.drawText("II. URAIAN KEGIATAN", { x: margin, y: cursor.y, size: 11, font: fontBold });
    cursor.y -= 15;
    page.drawText("Selama kunjungan berlangsung, rangkaian kegiatan yang telah dilaksanakan adalah:", { x: margin, y: cursor.y, size: 11, font: fontRegular });
    cursor.y -= 20;

    if (Array.isArray(content.activities)) {
        content.activities.forEach((act, i) => {
            if (!act) return;
            checkPage(20);
            page.drawText(`${i + 1}.`, { x: margin + 20, y: cursor.y, size: 11, font: fontRegular });
            drawJustified(act, margin + 35, contentWidth - 35, fontRegular, 11);
            cursor.y -= 5;
        });
    } else if (content.activities) {
        drawJustified(content.activities, margin + 20, contentWidth - 20, fontRegular, 11);
    }
    cursor.y -= 10;

    // Bagian III: HASIL
    checkPage(40);
    page.drawText("III. HASIL & CATATAN KUNJUNGAN", { x: margin, y: cursor.y, size: 11, font: fontBold });
    cursor.y -= 15;
    page.drawText("Berdasarkan hasil kunjungan di lokasi tersebut, terdapat beberapa poin penting sebagai berikut:", { x: margin, y: cursor.y, size: 11, font: fontRegular });
    cursor.y -= 20;

    if (Array.isArray(content.results)) {
        content.results.forEach((res, i) => {
            checkPage(30);
            page.drawText(sanitizeTextForWinAnsi(res.title || '-'), { x: margin + 20, y: cursor.y, size: 11, font: fontBold });
            cursor.y -= 15;
            
            if (res.items && Array.isArray(res.items)) {
                res.items.forEach(it => {
                    if (!it) return;
                    checkPage(20);
                    page.drawText("-", { x: margin + 35, y: cursor.y, size: 11, font: fontRegular });
                    drawJustified(it, margin + 45, contentWidth - 45, fontRegular, 11);
                    cursor.y -= 2;
                });
            }
            cursor.y -= 8;
        });
    } else if (content.results) {
        drawJustified(content.results, margin + 20, contentWidth - 20, fontRegular, 11);
    }
    cursor.y -= 15;

    // Penutup
    const closingText = "Demikian Berita Acara ini dibuat dengan sebenarnya sesuai dengan kondisi di lapangan untuk dapat dipergunakan sebagaimana mestinya.";
    drawJustified(closingText, margin, contentWidth, fontRegular, 11);
    cursor.y -= 30;

    // Signature
    const sigX = width - 250;
    checkPage(120);
    
    // Fix location string to use content.locationName as fallback since doc.location doesn't exist
    const docLocation = content.locationName || 'Padang';
    page.drawText(sanitizeTextForWinAnsi(`Dibuat di: ${docLocation}`), { x: margin, y: cursor.y, size: 11, font: fontRegular });
    cursor.y -= 20;
    
    page.drawText(sanitizeTextForWinAnsi(doc.signedBy?.position || doc.party1Title || 'Kepala Bidang Sarana,'), { x: sigX, y: cursor.y, size: 10, font: fontBold });
    cursor.y -= 65;

    await drawDigitalSignature(page, doc, sigX, cursor.y, 60);
    cursor.y -= 10;

    page.drawText(sanitizeTextForWinAnsi(doc.signedBy?.name || doc.party1Name || 'Ravi Kurnia'), { x: sigX, y: cursor.y, size: 10, font: fontBold });
    cursor.y -= 14;
    if (doc.signedBy?.nip || doc.party1Nip) {
        page.drawText(sanitizeTextForWinAnsi(`NIY. ${doc.signedBy?.nip || doc.party1Nip}`), { x: sigX, y: cursor.y, size: 10, font: fontRegular });
    }

    await drawLampiranSection(pdfDoc, doc, fontBold, fontRegular);
    return await pdfDoc.save();
}

/**
 * GENERATE SURAT UMUM (GENERAL LETTER)
 * Pre-filled opening and closing, custom body and subcategory.
 */
async function generateSuratUmumPDF(doc, setting) {
    const { pdfDoc, fontBold, fontRegular, fontItalic, width, height, margin } = await createBasePDF(setting);
    let page = pdfDoc.getPages()[0];
    const contentWidth = width - (2 * margin);
    const cursor = { y: height - 145 };

    // Draw Kop Surat
    await drawKopSurat(page, fontBold, fontRegular);

    const content = typeof doc.content === 'string' ? JSON.parse(doc.content) : (doc.content || {});

    // Header Title (SubCategory)
    const title = content.subCategory || "SURAT";
    const titleWidth = fontBold.widthOfTextAtSize(title, 14);
    page.drawText(title, { x: (width - titleWidth) / 2, y: cursor.y, size: 14, font: fontBold });
    cursor.y -= 2;
    page.drawLine({ start: { x: (width - titleWidth) / 2, y: cursor.y }, end: { x: (width + titleWidth) / 2, y: cursor.y }, thickness: 1.5 });
    cursor.y -= 15;

    // Number
    if (doc.number) {
        const numberText = `Nomor: ${doc.number}`;
        const numWidth = fontRegular.widthOfTextAtSize(numberText, 11);
        page.drawText(numberText, { x: (width - numWidth) / 2, y: cursor.y, size: 11, font: fontRegular });
        cursor.y -= 25;
    }

    // Perihal
    const perihalLabel = "Perihal:";
    page.drawText(perihalLabel, { x: margin, y: cursor.y, size: 11, font: fontBold });
    const perihalValueX = margin + fontBold.widthOfTextAtSize(perihalLabel, 11) + 8;
    const subjectLines = wrapText(doc.subject || '', contentWidth - (perihalValueX - margin), fontBold, 11);
    subjectLines.forEach((line) => {
        page.drawText(line, { x: perihalValueX, y: cursor.y, size: 11, font: fontBold });
        cursor.y -= 14;
    });
    cursor.y -= 15;

    // Recipient
    page.drawText(`Yth. ${doc.party2Name || '....................'}`, { x: margin, y: cursor.y, size: 11, font: fontBold });
    cursor.y -= 15;
    page.drawText('di', { x: margin, y: cursor.y, size: 11, font: fontRegular });
    cursor.y -= 15;
    page.drawText(doc.party2Address || 'Tempat', { x: margin, y: cursor.y, size: 11, font: fontBold });
    cursor.y -= 30;

    // Function to check page overflow
    const checkPage = (needed) => {
        if (cursor.y < 60 + needed) {
            page = pdfDoc.addPage([595.28, 841.89]);
            cursor.y = height - 60;
        }
    };

    const drawJustified = (text, x, w, font, size) => {
        const lines = wrapText(text, w, font, size);
        lines.forEach((line, i) => {
            const isLast = i === lines.length - 1;
            checkPage(20);
            if (isLast || line.split(' ').length <= 1) {
                page.drawText(line, { x, y: cursor.y, size, font });
            } else {
                const words = line.split(' ');
                const totalW = words.reduce((acc, word) => acc + font.widthOfTextAtSize(word, size), 0);
                const spaceW = (w - totalW) / (words.length - 1);
                let curX = x;
                words.forEach((word) => {
                    page.drawText(word, { x: curX, y: cursor.y, size, font });
                    curX += font.widthOfTextAtSize(word, size) + spaceW;
                });
            }
            cursor.y -= 15;
        });
    };

    // Salam Pembuka
    checkPage(20);
    page.drawText("Assalamu'alaikum Warahmatullahi Wabarakatuh,", { x: margin, y: cursor.y, size: 11, font: fontItalic });
    cursor.y -= 25;

    // Opening Text (Fixed)
    const openingText = "Segala puji bagi Allah Subhaanahu wa ta'aala yang senantiasa melimpahkan nikmat dan hidayah-Nya kepada kita semua. Shalawat dan salam atas Nabi Muhammad Shalallaahu 'alaihi wa sallam. Kami mendo'akan semoga Bapak/Ibu selalu berada dalam lindungan Allah Subhaanahu wa ta'aala, Amin.";
    drawJustified(openingText, margin, contentWidth, fontRegular, 11);
    cursor.y -= 10;

    // Body Text (User Input)
    if (content.body) {
        const paragraphs = content.body.split('\n');
        paragraphs.forEach(p => {
            if (p.trim()) {
                drawJustified(p.trim(), margin, contentWidth, fontRegular, 11);
                cursor.y -= 8;
            } else {
                cursor.y -= 12;
            }
        });
    }

    cursor.y -= 10;

    // Closing Text (Fixed)
    const closingText = "Demikianlah surat ini kami sampaikan, atas perhatian dan kerjasamanya kami ucapkan terima kasih. Jazakumullahu khairan.";
    drawJustified(closingText, margin, contentWidth, fontRegular, 11);
    cursor.y -= 10;

    // Salam Penutup
    checkPage(20);
    page.drawText("Wassalamu'alaikum Warahmatullahi Wabarakatuh.", { x: margin, y: cursor.y, size: 11, font: fontItalic });
    cursor.y -= 40;

    // Signature
    const sigX = width - 250;
    checkPage(100);
    page.drawText(doc.signedBy?.position || doc.party1Title || 'Kepala Bidang Sarana,', { x: sigX, y: cursor.y, size: 10, font: fontBold });
    cursor.y -= 65;

    await drawDigitalSignature(page, doc, sigX, cursor.y, 60);
    cursor.y -= 10;

    page.drawText(doc.signedBy?.name || doc.party1Name || 'Ravi Kurnia', { x: sigX, y: cursor.y, size: 10, font: fontBold });
    cursor.y -= 14;
    if (doc.signedBy?.nip || doc.party1Nip) {
        page.drawText(`NIY. ${doc.signedBy?.nip || doc.party1Nip}`, { x: sigX, y: cursor.y, size: 10, font: fontRegular });
    }

    return await pdfDoc.save();
}
