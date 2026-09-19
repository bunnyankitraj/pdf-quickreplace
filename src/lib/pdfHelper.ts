import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Generates an in-memory sample invoice PDF for quick testing.
 */
export async function createSampleInvoicePdf(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 750]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { height } = page.getSize();

  // Header Banner
  page.drawRectangle({
    x: 40,
    y: height - 100,
    width: 520,
    height: 60,
    color: rgb(0.12, 0.28, 0.49),
  });

  page.drawText('INVOICE & WORK ORDER', {
    x: 60,
    y: height - 65,
    size: 20,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText('Acme Corporation', {
    x: 60,
    y: height - 85,
    size: 12,
    font,
    color: rgb(0.85, 0.9, 0.98),
  });

  // Metadata block
  page.drawText('Invoice Number: INV-2024-0091', {
    x: 40,
    y: height - 140,
    size: 11,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });

  page.drawText('Issue Date: October 14, 2023', {
    x: 40,
    y: height - 160,
    size: 11,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });

  page.drawText('Billed To: John Doe', {
    x: 40,
    y: height - 180,
    size: 11,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });

  page.drawText('Client Email: john.doe@example.com', {
    x: 40,
    y: height - 200,
    size: 11,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });

  // Table header
  page.drawRectangle({
    x: 40,
    y: height - 250,
    width: 520,
    height: 25,
    color: rgb(0.92, 0.94, 0.97),
  });

  page.drawText('Description', { x: 50, y: height - 243, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('Qty', { x: 340, y: height - 243, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('Price', { x: 410, y: height - 243, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('Total Amount', { x: 480, y: height - 243, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) });

  // Table rows
  const items = [
    { desc: 'Web Design & UI Development', qty: '1', price: '$800.00', total: '$800.00' },
    { desc: 'Database Setup & Migration', qty: '2', price: '$200.00', total: '$400.00' },
    { desc: 'Server Maintenance (Acme Cloud)', qty: '1', price: '$50.00', total: '$50.00' },
  ];

  let currentY = height - 280;
  for (const item of items) {
    page.drawText(item.desc, { x: 50, y: currentY, size: 10, font, color: rgb(0.25, 0.25, 0.25) });
    page.drawText(item.qty, { x: 345, y: currentY, size: 10, font, color: rgb(0.25, 0.25, 0.25) });
    page.drawText(item.price, { x: 410, y: currentY, size: 10, font, color: rgb(0.25, 0.25, 0.25) });
    page.drawText(item.total, { x: 485, y: currentY, size: 10, font, color: rgb(0.25, 0.25, 0.25) });
    currentY -= 25;
  }

  // Divider
  page.drawLine({
    start: { x: 40, y: currentY - 5 },
    end: { x: 560, y: currentY - 5 },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });

  // Total
  page.drawText('Grand Total: $1,250.00', {
    x: 410,
    y: currentY - 35,
    size: 13,
    font: fontBold,
    color: rgb(0.12, 0.28, 0.49),
  });

  // Footer notes
  page.drawText('Thank you for partnering with Acme Corporation.', {
    x: 40,
    y: 80,
    size: 10,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });
  page.drawText('All payments are due within 30 days of issuance. Contact billing@acme.com for inquiries.', {
    x: 40,
    y: 65,
    size: 9,
    font,
    color: rgb(0.6, 0.6, 0.6),
  });

  return await pdfDoc.save();
}
