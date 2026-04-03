const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage();
  await page.goto('https://www.tcgplayer.com/product/610499', { waitUntil: 'networkidle', timeout: 120000 });
  console.log('TITLE:', await page.title());
  console.log('H1S:', JSON.stringify(await page.locator('h1').allTextContents()));
  console.log('BODY-SNIP:', (await page.locator('body').innerText()).slice(0, 2000));
  await browser.close();
})();
