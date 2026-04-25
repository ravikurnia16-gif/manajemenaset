const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const QRCode = require('qrcode');

const BASE_URL = process.env.BASE_URL || 'https://sarpras.dareliman.or.id';

/**
 * Generate QR code verification data URL for a document.
 * @param {string} uuid - Document UUID
 * @returns {Promise<string>} QR code as data URL (base64)
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
 * Generate a complete PDF for a Surat Keluar with kop surat, body, and QR signature.
 * @param {Object} doc - The OfficeDocument record
 * @param {Object} setting - Organization settings (orgName, orgAddress, etc.)
 * @returns {Promise<Uint8Array>} PDF bytes
 */
async function generateSuratPDF(doc, setting) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();

    const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

    const margin = 56;
    let y = height - 50;

    // === KOP SURAT ===
    // Logo (if org has logo)
    if (setting?.orgLogo) {
        try {
            const logoData = setting.orgLogo.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
            const logoBytes = Buffer.from(logoData, 'base64');
            let logoImage;
            if (setting.orgLogo.includes('image/png')) {
                logoImage = await pdfDoc.embedPng(logoBytes);
            } else {
                logoImage = await pdfDoc.embedJpg(logoBytes);
            }
            const logoDims = logoImage.scale(0.15);
            page.drawImage(logoImage, {
                x: margin,
                y: y - logoDims.height,
                width: logoDims.width,
                height: logoDims.height,
            });
        } catch (e) {
            console.error('Failed to embed logo:', e.message);
        }
    }

    // Organization Name
    const orgName = (setting?.orgName || 'YAYASAN DAARUL ILMI').toUpperCase();
    page.drawText(orgName, {
        x: margin + 80,
        y: y - 5,
        size: 16,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
    });

    // Sub-org Name
    page.drawText('BIDANG SARANA DAN PRASARANA', {
        x: margin + 80,
        y: y - 22,
        size: 13,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
    });

    // Address
    const orgAddress = setting?.orgAddress || '';
    if (orgAddress) {
        page.drawText(orgAddress, {
            x: margin + 80,
            y: y - 38,
            size: 9,
            font: fontRegular,
            color: rgb(0.3, 0.3, 0.3),
            maxWidth: width - margin * 2 - 80,
        });
    }

    // Contact info
    const contactParts = [];
    if (setting?.orgPhone) contactParts.push(`Telp: ${setting.orgPhone}`);
    if (setting?.orgEmail) contactParts.push(`Email: ${setting.orgEmail}`);
    if (contactParts.length > 0) {
        page.drawText(contactParts.join('  |  '), {
            x: margin + 80,
            y: y - 52,
            size: 8,
            font: fontItalic,
            color: rgb(0.4, 0.4, 0.4),
        });
    }

    // Separator line
    y -= 68;
    page.drawLine({
        start: { x: margin, y },
        end: { x: width - margin, y },
        thickness: 2,
        color: rgb(0.1, 0.1, 0.1),
    });
    page.drawLine({
        start: { x: margin, y: y - 3 },
        end: { x: width - margin, y: y - 3 },
        thickness: 0.5,
        color: rgb(0.1, 0.1, 0.1),
    });

    y -= 25;

    // === DOCUMENT HEADER ===
    // Document Number
    if (doc.number) {
        page.drawText(`Nomor     : ${doc.number}`, {
            x: margin, y, size: 11, font: fontRegular, color: rgb(0, 0, 0),
        });
        y -= 16;
    }

    // Category / Perihal
    if (doc.category) {
        page.drawText(`Lampiran  : -`, {
            x: margin, y, size: 11, font: fontRegular, color: rgb(0, 0, 0),
        });
        y -= 16;
    }

    page.drawText(`Perihal   : ${doc.subject}`, {
        x: margin, y, size: 11, font: fontRegular, color: rgb(0, 0, 0),
        maxWidth: width - margin * 2 - 70,
    });
    y -= 30;

    // === DOCUMENT BODY ===
    if (doc.content) {
        // Strip HTML tags for PDF text rendering
        const plainText = doc.content
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .trim();

        const lines = plainText.split('\n');
        const maxWidth = width - margin * 2;

        for (const line of lines) {
            if (y < 120) {
                // Add new page if needed
                const newPage = pdfDoc.addPage([595.28, 841.89]);
                y = height - 50;
            }

            if (line.trim() === '') {
                y -= 8;
                continue;
            }

            // Word wrap
            const words = line.split(' ');
            let currentLine = '';
            for (const word of words) {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                const testWidth = fontRegular.widthOfTextAtSize(testLine, 11);
                if (testWidth > maxWidth && currentLine) {
                    page.drawText(currentLine, {
                        x: margin, y, size: 11, font: fontRegular, color: rgb(0, 0, 0),
                    });
                    y -= 16;
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine) {
                page.drawText(currentLine, {
                    x: margin, y, size: 11, font: fontRegular, color: rgb(0, 0, 0),
                });
                y -= 16;
            }
        }
    }

    // === SIGNATURE BLOCK ===
    y -= 30;
    const sigX = width - margin - 200;

    // Date
    const docDate = new Date(doc.date);
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const dateStr = `${docDate.getDate()} ${months[docDate.getMonth()]} ${docDate.getFullYear()}`;

    page.drawText(dateStr, {
        x: sigX, y, size: 11, font: fontRegular, color: rgb(0, 0, 0),
    });
    y -= 20;

    // Signer title
    page.drawText('Kepala Bidang Sarana dan Prasarana', {
        x: sigX, y, size: 11, font: fontRegular, color: rgb(0, 0, 0),
    });
    y -= 16;

    // QR Code
    if (doc.qrCodeData || doc.uuid) {
        try {
            const qrDataUrl = await generateVerificationQR(doc.uuid);
            const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
            const qrBytes = Buffer.from(qrBase64, 'base64');
            const qrImage = await pdfDoc.embedPng(qrBytes);
            page.drawImage(qrImage, {
                x: sigX + 30,
                y: y - 65,
                width: 60,
                height: 60,
            });
        } catch (e) {
            console.error('Failed to embed QR:', e.message);
        }
    }

    // Signature image if exists
    if (doc.signatureData) {
        try {
            const sigData = doc.signatureData.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
            const sigBytes = Buffer.from(sigData, 'base64');
            let sigImage;
            if (doc.signatureData.includes('image/png')) {
                sigImage = await pdfDoc.embedPng(sigBytes);
            } else {
                sigImage = await pdfDoc.embedJpg(sigBytes);
            }
            page.drawImage(sigImage, {
                x: sigX + 10,
                y: y - 65,
                width: 100,
                height: 55,
            });
        } catch (e) {
            console.error('Failed to embed signature:', e.message);
        }
    }

    y -= 75;

    // Signer name
    const signerName = doc.signedBy?.name || setting?.orgHeadName || '____________________';
    page.drawText(signerName, {
        x: sigX, y, size: 11, font: fontBold, color: rgb(0, 0, 0),
    });
    y -= 14;

    // NIP
    const signerNip = doc.signedBy?.nip || setting?.orgHeadNip || '';
    if (signerNip) {
        page.drawText(`NIP. ${signerNip}`, {
            x: sigX, y, size: 9, font: fontRegular, color: rgb(0.3, 0.3, 0.3),
        });
    }

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

/**
 * Generate a BAST/MOU PDF with two-party signatures.
 * @param {Object} doc - The OfficeDocument record
 * @param {Object} setting - Organization settings
 * @returns {Promise<Uint8Array>} PDF bytes
 */
async function generateBASTMouPDF(doc, setting) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();

    const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    const margin = 56;
    let y = height - 50;

    // === KOP SURAT (same as above but simplified) ===
    const orgName = (setting?.orgName || 'YAYASAN DAARUL ILMI').toUpperCase();
    page.drawText(orgName, {
        x: margin, y, size: 16, font: fontBold, color: rgb(0.1, 0.1, 0.1),
    });
    y -= 18;
    page.drawText('BIDANG SARANA DAN PRASARANA', {
        x: margin, y, size: 13, font: fontBold, color: rgb(0.1, 0.1, 0.1),
    });
    y -= 25;

    // Separator
    page.drawLine({
        start: { x: margin, y },
        end: { x: width - margin, y },
        thickness: 2,
        color: rgb(0.1, 0.1, 0.1),
    });
    y -= 30;

    // Title
    const title = doc.type === 'BAST' ? 'BERITA ACARA SERAH TERIMA' : 'MEMORANDUM OF UNDERSTANDING';
    const titleWidth = fontBold.widthOfTextAtSize(title, 14);
    page.drawText(title, {
        x: (width - titleWidth) / 2,
        y,
        size: 14,
        font: fontBold,
        color: rgb(0, 0, 0),
    });
    y -= 18;

    // Number
    if (doc.number) {
        const numText = `Nomor: ${doc.number}`;
        const numWidth = fontRegular.widthOfTextAtSize(numText, 11);
        page.drawText(numText, {
            x: (width - numWidth) / 2,
            y,
            size: 11,
            font: fontRegular,
            color: rgb(0, 0, 0),
        });
        y -= 30;
    } else {
        y -= 15;
    }

    // Body content
    if (doc.content) {
        const plainText = doc.content
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .trim();

        const lines = plainText.split('\n');
        const maxWidth = width - margin * 2;

        for (const line of lines) {
            if (y < 200) break;
            if (line.trim() === '') { y -= 8; continue; }

            const words = line.split(' ');
            let currentLine = '';
            for (const word of words) {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                const testWidth = fontRegular.widthOfTextAtSize(testLine, 11);
                if (testWidth > maxWidth && currentLine) {
                    page.drawText(currentLine, {
                        x: margin, y, size: 11, font: fontRegular, color: rgb(0, 0, 0),
                    });
                    y -= 16;
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine) {
                page.drawText(currentLine, {
                    x: margin, y, size: 11, font: fontRegular, color: rgb(0, 0, 0),
                });
                y -= 16;
            }
        }
    }

    // === DUAL SIGNATURE BLOCK ===
    y -= 40;
    const col1X = margin + 20;
    const col2X = width / 2 + 30;

    // Party 1 (Internal / Yayasan)
    page.drawText('PIHAK PERTAMA', {
        x: col1X, y, size: 10, font: fontBold, color: rgb(0, 0, 0),
    });

    // Party 2 (External)
    page.drawText('PIHAK KEDUA', {
        x: col2X, y, size: 10, font: fontBold, color: rgb(0, 0, 0),
    });
    y -= 16;

    page.drawText(doc.party1Title || 'Kepala Bidang Sarpras', {
        x: col1X, y, size: 9, font: fontRegular, color: rgb(0.3, 0.3, 0.3),
    });
    page.drawText(doc.party2Title || '', {
        x: col2X, y, size: 9, font: fontRegular, color: rgb(0.3, 0.3, 0.3),
    });

    y -= 10;

    // Embed signatures and QR
    if (doc.uuid) {
        try {
            const qrDataUrl = await generateVerificationQR(doc.uuid);
            const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
            const qrBytes = Buffer.from(qrBase64, 'base64');
            const qrImage = await pdfDoc.embedPng(qrBytes);
            // QR between two signatures
            const qrSize = 50;
            page.drawImage(qrImage, {
                x: (width - qrSize) / 2,
                y: y - 55,
                width: qrSize,
                height: qrSize,
            });
        } catch (e) { /* ignore */ }
    }

    // Party 1 signature
    if (doc.party1Signature) {
        try {
            const sigData = doc.party1Signature.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
            const sigBytes = Buffer.from(sigData, 'base64');
            const sigImage = doc.party1Signature.includes('image/png')
                ? await pdfDoc.embedPng(sigBytes)
                : await pdfDoc.embedJpg(sigBytes);
            page.drawImage(sigImage, {
                x: col1X, y: y - 55, width: 90, height: 50,
            });
        } catch (e) { /* ignore */ }
    }

    // Party 2 signature
    if (doc.party2Signature) {
        try {
            const sigData = doc.party2Signature.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
            const sigBytes = Buffer.from(sigData, 'base64');
            const sigImage = doc.party2Signature.includes('image/png')
                ? await pdfDoc.embedPng(sigBytes)
                : await pdfDoc.embedJpg(sigBytes);
            page.drawImage(sigImage, {
                x: col2X, y: y - 55, width: 90, height: 50,
            });
        } catch (e) { /* ignore */ }
    }

    y -= 70;

    // Names
    page.drawText(doc.party1Name || '____________________', {
        x: col1X, y, size: 11, font: fontBold, color: rgb(0, 0, 0),
    });
    page.drawText(doc.party2Name || '____________________', {
        x: col2X, y, size: 11, font: fontBold, color: rgb(0, 0, 0),
    });
    y -= 14;

    if (doc.party1Org) {
        page.drawText(doc.party1Org, {
            x: col1X, y, size: 9, font: fontRegular, color: rgb(0.4, 0.4, 0.4),
        });
    }
    if (doc.party2Org) {
        page.drawText(doc.party2Org, {
            x: col2X, y, size: 9, font: fontRegular, color: rgb(0.4, 0.4, 0.4),
        });
    }

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

module.exports = {
    generateVerificationQR,
    generateSuratPDF,
    generateBASTMouPDF,
};
