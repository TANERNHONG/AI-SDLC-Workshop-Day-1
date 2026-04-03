const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage();
  await page.addInitScript(() => {
    window.addEventListener('unhandledrejection', event => {
      event.preventDefault();
      console.log('suppressed rejection', event.reason?.message || String(event.reason));
    });
  });
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('request', req => {
    const url = req.url();
    if (url.includes('productdetails') || url.includes('product/') || url.includes('mpapi') || url.includes('infinite-api') || url.includes('search')) console.log('REQ:', url);
  });
  page.on('response', async res => {
    const url = res.url();
    if (url.includes('productdetails') || url.includes('product/') || url.includes('mpapi') || url.includes('infinite-api') || url.includes('search')) console.log('RES:', res.status(), url);
  });
  await page.goto('https://www.tcgplayer.com/product/610499', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(15000);
  console.log('TITLE:', await page.title());
  console.log('H1S:', JSON.stringify(await page.locator('h1').allTextContents()));
  console.log('BODYLEN:', (await page.locator('body').innerText()).length);
  await browser.close();
})();
