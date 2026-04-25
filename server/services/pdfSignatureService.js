const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { PDFDocument } = require('pdf-lib');
const crypto = require('crypto');
const QRCode = require('qrcode');

/**
 * Approve and sign document with QR and digital signature
 * @param {number} documentId 
 * @param {number} kabidUserId 
 * @param {string} pdfBufferBase64 
 */
const approveAndSignDocument = async (documentId, kabidUserId, pdfBufferBase64) => {
  // Fetch document and user
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error('Document not found');

  const kabidUser = await prisma.user.findUnique({ where: { id: kabidUserId } });
  if (!kabidUser) throw new Error('User not found');

  // Validate authorization
  if (kabidUser.role !== 'KABID_SARPRAS' && kabidUser.role !== 'SUPER_ADMIN') {
      throw new Error('Not authorized to sign');
  }

  // Generate Hash & Validation URL
  const uniqueString = `${doc.id}-${new Date().getTime()}-${crypto.randomBytes(4).toString('hex')}`;
  const hash = crypto.createHash('sha256').update(uniqueString).digest('hex');
  const validationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify/${hash}`;

  // Generate QR Code
  const qrCodeDataUrl = await QRCode.toDataURL(validationUrl, {
      width: 150,
      margin: 1,
      color: {
          dark: '#000000',
          light: '#ffffff'
      }
  });

  // Load PDF
  const pdfBuffer = Buffer.from(pdfBufferBase64, 'base64');
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1]; // Draw on the last page

  // Embed QR Code
  const qrImage = await pdfDoc.embedPng(qrCodeDataUrl);
  const qrDims = qrImage.scale(0.5); // scale down
  
  // Position the QR code on the bottom left
  lastPage.drawImage(qrImage, {
    x: 50,
    y: 50,
    width: qrDims.width,
    height: qrDims.height,
  });

  // Embed Kabid Signature if available
  if (kabidUser.signatureImage) {
      try {
          // Determine if PNG or JPEG
          let signatureImage;
          if (kabidUser.signatureImage.includes('image/png')) {
              signatureImage = await pdfDoc.embedPng(kabidUser.signatureImage);
          } else if (kabidUser.signatureImage.includes('image/jpeg')) {
              signatureImage = await pdfDoc.embedJpg(kabidUser.signatureImage);
          } else {
              // try PNG by default
              signatureImage = await pdfDoc.embedPng(kabidUser.signatureImage);
          }

          const sigDims = signatureImage.scale(0.5);
          
          // Position signature on the bottom right
          lastPage.drawImage(signatureImage, {
            x: lastPage.getWidth() - 150,
            y: 50,
            width: 100,
            height: 100 * (sigDims.height / sigDims.width), // Keep aspect ratio
          });
      } catch (e) {
          console.error("Failed to embed signature:", e);
          // Continue even if signature fails, QR code is more important
      }
  }

  // Check for external signatures (BAST)
  const externalSignatures = await prisma.signatureLog.findMany({
      where: { documentId: doc.id, signerId: null }
  });

  if (externalSignatures.length > 0) {
      let extX = 250;
      for (const extSig of externalSignatures) {
          if (extSig.signatureData) {
              try {
                  const extImage = await pdfDoc.embedPng(extSig.signatureData);
                  const extDims = extImage.scale(0.5);
                  lastPage.drawImage(extImage, {
                      x: extX,
                      y: 50,
                      width: 80,
                      height: 80 * (extDims.height / extDims.width),
                  });
                  extX += 100;
              } catch (e) {
                  console.error("Failed to embed external signature:", e);
              }
          }
      }
  }

  const finalPdfBytes = await pdfDoc.save();
  const finalPdfBase64 = Buffer.from(finalPdfBytes).toString('base64');

  // Update Database
  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: 'SIGNED',
      hash: hash,
      qrCodeUrl: qrCodeDataUrl,
      fileUrl: `data:application/pdf;base64,${finalPdfBase64}` // For simplicity, saving base64 to DB. In production, save to S3.
    }
  });

  // Log Signature
  await prisma.signatureLog.create({
      data: {
          documentId: doc.id,
          signerId: kabidUserId,
          signatureData: kabidUser.signatureImage || '',
      }
  });

  // Create document history
  await prisma.documentHistory.create({
      data: {
          documentId: doc.id,
          version: doc.version,
          content: doc.content,
          changedById: kabidUserId,
          changeNote: "Dokumen ditandatangani dan disahkan."
      }
  });

  return { hash, finalPdfBase64 };
};

module.exports = {
  approveAndSignDocument
};
