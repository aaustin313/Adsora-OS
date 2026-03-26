const puppeteer = require('puppeteer');
const path = require('path');

async function generatePDF() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  const htmlPath = path.resolve(__dirname, '../output/subscriber-segment-analysis.html');
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

  const pdfPath = path.resolve(__dirname, '../output/subscriber-segment-analysis.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '40px', bottom: '40px', left: '40px', right: '40px' }
  });

  await browser.close();
  console.log(`PDF saved to: ${pdfPath}`);
}

generatePDF().catch(console.error);
