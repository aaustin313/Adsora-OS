const puppeteer = require('puppeteer');
const path = require('path');

async function generatePDF() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  const htmlPath = path.resolve(__dirname, '../output/adsora-original-contributions.html');
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0', timeout: 30000 });

  await page.pdf({
    path: path.resolve(__dirname, '../output/adsora-original-contributions.pdf'),
    width: '1280px',
    height: '720px',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  console.log('PDF generated: output/adsora-original-contributions.pdf');
  await browser.close();
}

generatePDF().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
