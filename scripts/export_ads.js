#!/usr/bin/env node
/**
 * Export HTML ad designs to 1080x1080 PNG images
 * Usage: node scripts/export_ads.js
 * Requires: npm install puppeteer
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const ADS_DIR = path.join(__dirname, '..', 'output', 'image-ads');
const OUTPUT_DIR = path.join(ADS_DIR, 'png');

async function exportAds() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const htmlFiles = fs.readdirSync(ADS_DIR).filter(f => f.endsWith('.html'));
  if (htmlFiles.length === 0) {
    console.log('No HTML ad files found.');
    return;
  }

  console.log(`Found ${htmlFiles.length} ads to export...`);
  const browser = await puppeteer.launch({ headless: true });

  for (const file of htmlFiles) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
    await page.goto(`file://${path.join(ADS_DIR, file)}`, { waitUntil: 'networkidle0' });

    const pngName = file.replace('.html', '.png');
    await page.screenshot({
      path: path.join(OUTPUT_DIR, pngName),
      clip: { x: 0, y: 0, width: 1080, height: 1080 },
    });

    console.log(`✓ ${pngName}`);
    await page.close();
  }

  await browser.close();
  console.log(`\nDone! PNGs saved to: ${OUTPUT_DIR}`);
}

exportAds().catch(console.error);
