import puppeteer from 'puppeteer';

// Keep a single browser instance alive across requests for speed.
let browserPromise = null;

function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
      .then((browser) => {
        // If the browser dies, drop the cached instance so the next call relaunches
        // instead of reusing a dead handle (which would 500 every request).
        browser.on('disconnected', () => { browserPromise = null; });
        return browser;
      })
      .catch((err) => {
        browserPromise = null; // never cache a failed launch
        throw err;
      });
  }
  return browserPromise;
}

async function renderOnce(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }, // margins come from @page CSS
    });
    // page.pdf() returns a Uint8Array; Express's res.send() JSON-stringifies a
    // bare Uint8Array, so hand back a Buffer to get raw binary on the wire.
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}

export async function renderResumePdf(html) {
  try {
    return await renderOnce(html);
  } catch (err) {
    // A crashed or closed browser poisons the cached promise; reset and retry once.
    browserPromise = null;
    return await renderOnce(html);
  }
}
