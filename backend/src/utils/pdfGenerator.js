import PDFDocument from 'pdfkit';

/**
 * Generate a PDF report and pipe it to the response.
 * @param {Response} res - Express response object
 * @param {Object} options
 * @param {string} options.title - Report title
 * @param {string[]} options.headers - Column headers
 * @param {Array<string[]>} options.rows - Data rows
 * @param {string} options.filename - Download filename
 */
export function generatePDFReport(res, { title, headers, rows, filename }) {
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  doc.pipe(res);

  // Title
  doc.fontSize(18).font('Helvetica-Bold').text(title, { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(9).font('Helvetica').fillColor('#666666')
    .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
  doc.moveDown(1);

  // Table setup
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colCount = headers.length;
  const colWidth = pageWidth / colCount;
  const startX = doc.page.margins.left;
  let y = doc.y;

  // Header row
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff');
  doc.rect(startX, y, pageWidth, 18).fill('#4F46E5');
  headers.forEach((header, i) => {
    doc.fillColor('#ffffff').text(header, startX + i * colWidth + 4, y + 4, {
      width: colWidth - 8,
      height: 14,
      ellipsis: true
    });
  });
  y += 18;

  // Data rows
  doc.font('Helvetica').fontSize(7).fillColor('#333333');
  rows.forEach((row, rowIndex) => {
    if (y > doc.page.height - 60) {
      doc.addPage();
      y = doc.page.margins.top;
    }

    const bgColor = rowIndex % 2 === 0 ? '#F9FAFB' : '#FFFFFF';
    doc.rect(startX, y, pageWidth, 16).fill(bgColor);

    row.forEach((cell, i) => {
      const text = cell != null ? String(cell) : '';
      doc.fillColor('#333333').text(text, startX + i * colWidth + 4, y + 3, {
        width: colWidth - 8,
        height: 12,
        ellipsis: true
      });
    });
    y += 16;
  });

  // Footer
  doc.moveDown(2);
  doc.fontSize(8).fillColor('#999999')
    .text(`Total Records: ${rows.length}`, startX, y + 10);

  doc.end();
}
