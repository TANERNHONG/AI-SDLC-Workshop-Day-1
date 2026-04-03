const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage();
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));
  page.on('request', req => {
    const url = req.url();
    if (url.includes('api') || url.includes('product') || url.includes('search') || url.includes('mp')) {
      console.log('REQ:', url);
    }
  });
  page.on('response', async res => {
    const url = res.url();
    if (url.includes('api') || url.includes('product') || url.includes('search') || url.includes('mp')) {
      console.log('RES:', res.status(), url);
    }
  });
  await page.goto('https://www.tcgplayer.com/product/610499', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(15000);
  console.log('TITLE:', await page.title());
  console.log('HTMLLEN:', (await page.content()).length);
  await browser.close();
})();
