// Reproduces the "wrong title" scenario, then edits the answer in chat and
// confirms the resume preview updates. Also edits a polished bullet.
import puppeteer from 'puppeteer';

const BASE = 'http://localhost:5173';
const log = (...a) => console.log('[edit]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];

function answerFor(prompt) {
  const p = prompt.toLowerCase();
  const m = [
    ['full name', 'Alex Morgan'], ['email', 'alex@example.com'],
    ['phone', 'skip'], ['based', 'skip'], ['linkedin', 'skip'], ['portfolio', 'skip'],
    ['school name', 'State University'], ['graduation', 'May 2027'],
    ['degree', 'B.S.'], ['major', 'CS'], ['gpa', 'skip'], ['coursework', 'skip'], ['honors', 'skip'],
    ['title or role', 'XXWRONGXX'],            // <- the mistake (org typed into title)
    ['company or organization', 'Starbucks'],
    ['location', 'skip'], ['dates', '2024'],
    ['describe what you actually did', 'made coffee and trained people during the busy morning rush'],
    ['technical skills', 'Python'], ['tools', 'skip'], ['languages', 'skip'],
  ];
  for (const [n, a] of m) if (p.includes(n)) return a;
  return 'skip';
}
const yesNo = (p) => (/another/i.test(p) ? 'no' : /work experience/i.test(p) ? 'yes' : 'no');

const lastBot = (page) => page.evaluate(() => {
  const n = [...document.querySelectorAll('.msg.bot .bubble:not(.typing):not(.bullets)')];
  return n.length ? n[n.length - 1].textContent.trim() : '';
});
const state = (page) => page.evaluate(() => ({
  hasText: !!document.querySelector('.text-form textarea'),
  btns: [...document.querySelectorAll('.chat-input .quick-replies button')].map((b) => b.textContent.trim()),
  done: !!document.querySelector('.preview'),
  polishing: !!document.querySelector('.chat-input .status') &&
    /polish/i.test(document.querySelector('.chat-input .status').textContent),
}));
const clickByText = (page, t, scope = 'button') => page.evaluate((t, scope) => {
  const b = [...document.querySelectorAll(scope)].find((x) => x.textContent.trim() === t);
  if (b) b.click();
  return !!b;
}, t, scope);

async function clearAndType(page, sel, value) {
  await page.click(sel);
  await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.type(sel, value);
}

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(BASE, { waitUntil: 'networkidle0' });

// Walk the flow.
let guard = 0, last = '';
while (guard++ < 80) {
  await sleep(220);
  const st = await state(page);
  if (st.done) break;
  if (st.polishing) continue;
  if (st.btns.includes('Looks good')) { await clickByText(page, 'Looks good'); last = ''; continue; }
  if (st.btns.some((b) => /add one|skip/i.test(b)) && !st.hasText) {
    await clickByText(page, yesNo(await lastBot(page)) === 'yes' ? 'Yes, add one' : 'No, skip');
    last = ''; continue;
  }
  if (st.hasText) {
    const prompt = await lastBot(page);
    if (prompt === last) continue;
    last = prompt;
    await page.click('.text-form textarea');
    await page.type('.text-form textarea', answerFor(prompt));
    await clickByText(page, 'Send');
  }
}
if (guard >= 80) { console.error('[edit] flow stalled'); process.exit(1); }
log('reached done');

// Sanity: the wrong value is present, then edit it.
let preview = await page.evaluate(() => document.querySelector('.preview').textContent);
if (!preview.includes('XXWRONGXX')) failures.push('expected wrong title in preview before edit');

// Click Edit on the user bubble containing XXWRONGXX.
const clickedEdit = await page.evaluate(() => {
  const msg = [...document.querySelectorAll('.msg.user')].find((d) => d.textContent.includes('XXWRONGXX'));
  const btn = msg?.querySelector('.link-edit');
  if (btn) { btn.click(); return true; }
  return false;
});
if (!clickedEdit) failures.push('could not find Edit button on the wrong-title bubble');
await sleep(200);
await clearAndType(page, '.edit-inline textarea', 'Barista');
await clickByText(page, 'Save', '.edit-inline button');
await sleep(400);

preview = await page.evaluate(() => document.querySelector('.preview').textContent);
log('after title edit, preview has "Barista":', preview.includes('Barista'), '| still has XXWRONGXX:', preview.includes('XXWRONGXX'));
if (!preview.includes('Barista')) failures.push('preview did not pick up edited title');
if (preview.includes('XXWRONGXX')) failures.push('old wrong title still in preview after edit');

// Edit a polished bullet.
const clickedBulletEdit = await page.evaluate(() => {
  const bullets = [...document.querySelectorAll('.msg.bot .bubble.bullets')];
  const withEdit = bullets.find((b) => b.querySelector('.link-edit'));
  const btn = withEdit?.querySelector('.link-edit');
  if (btn) { btn.click(); return true; }
  return false;
});
if (!clickedBulletEdit) failures.push('could not find Edit on a polished bullets bubble');
await sleep(200);
await clearAndType(page, '.edit-bullets textarea', 'EDITED BULLET CONTENT');
await clickByText(page, 'Save', '.edit-bullets button');
await sleep(400);
preview = await page.evaluate(() => document.querySelector('.preview').textContent);
log('after bullet edit, preview has "EDITED BULLET CONTENT":', preview.includes('EDITED BULLET CONTENT'));
if (!preview.includes('EDITED BULLET CONTENT')) failures.push('preview did not pick up edited bullet');

// Download still works (and __mid is stripped server-side regardless).
const waitPdf = page.waitForResponse((r) => r.url().includes('/api/generate/pdf'), { timeout: 30000 });
await clickByText(page, 'Download PDF');
const pdf = await waitPdf;
log('PDF after edits:', pdf.status());
if (pdf.status() !== 200) failures.push('PDF download failed after edits');

await page.screenshot({ path: 'edit-final.png', fullPage: true });
await browser.close();

if (failures.length) { console.error('[edit] FAIL\n - ' + failures.join('\n - ')); process.exit(1); }
log('RESULT: PASS');
