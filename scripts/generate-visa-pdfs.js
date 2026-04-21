const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const VISA_DIR = path.resolve(__dirname, '../output/visa-evidence');

async function generatePDFs() {
  const files = fs.readdirSync(VISA_DIR).filter(f => f.endsWith('.html'));

  if (files.length === 0) {
    console.log('No HTML files found in output/visa-evidence/');
    return;
  }

  const browser = await puppeteer.launch({ headless: 'new' });

  for (const file of files) {
    const htmlPath = path.join(VISA_DIR, file);
    const pdfPath = path.join(VISA_DIR, file.replace('.html', '.pdf'));

    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait for Google Fonts to fully load
    await page.evaluateHandle('document.fonts.ready');

    await page.pdf({
      path: pdfPath,
      width: '1280px',
      height: '720px',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    console.log(`PDF generated: ${file.replace('.html', '.pdf')}`);
    await page.close();
  }

  await browser.close();
  console.log(`\nDone — ${files.length} PDFs generated in output/visa-evidence/`);
}

generatePDFs().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
