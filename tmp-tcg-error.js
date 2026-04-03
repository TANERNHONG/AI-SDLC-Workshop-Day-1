const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage();
  page.on('pageerror', err => console.log('PAGEERROR STACK:', err.stack));
  await page.goto('https://www.tcgplayer.com/product/610499', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(5000);
  await browser.close();
})();
