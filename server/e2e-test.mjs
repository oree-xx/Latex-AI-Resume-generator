// Throwaway end-to-end driver: walks the real chat UI in a headless browser,
// exercises the experience+polish path, and verifies PDF/DOCX downloads return 200.
import puppeteer from 'puppeteer';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = 'http://localhost:5173';
const log = (...a) => console.log('[e2e]', ...a);

function answerFor(prompt) {
  const p = prompt.toLowerCase();
  const m = [
    ['full name', 'Alex Morgan'],
    ['email', 'alex.morgan@example.com'],
    ['phone', 'skip'],
    ['based', 'skip'],
    ['linkedin', 'skip'],
    ['portfolio', 'skip'],
    ['school name', 'State University'],
    ['graduation', 'May 2027'],
    ['degree', 'B.S. Computer Science'],
    ['major', 'Computer Science'],
    ['gpa', '3.8'],
    ['coursework', 'Data Structures, Algorithms'],
    ['honors', 'skip'],
    ['title or role', 'Barista'],
    ['company or organization', 'Starbucks'],
    ['location', 'skip'],
    ['dates', 'Jun 2024 – Aug 2024'],
    ['describe what you actually did', 'worked the morning rush making espresso drinks, trained three new baristas on the POS, and cut average wait time during peak hours'],
    ['technical skills', 'Python, JavaScript, SQL'],
    ['tools', 'skip'],
    ['languages', 'skip'],
  ];
  for (const [needle, ans] of m) if (p.includes(needle)) return ans;
  return 'skip';
}

// For yes/no prompts: enter the experience section once (to test polish),
// decline "add another" and the other optional sections to keep the run bounded.
function yesNoDecision(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes('another')) return 'no';
  if (p.includes('work experience')) return 'yes';
  return 'no';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function lastBotPrompt(page) {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.msg.bot .bubble:not(.typing):not(.bullets)')];
    const last = nodes[nodes.length - 1];
    return last ? last.textContent.trim() : '';
  });
}

async function controlState(page) {
  return page.evaluate(() => {
    const hasText = !!document.querySelector('.text-form textarea');
    const btns = [...document.querySelectorAll('.quick-replies button')].map((b) => b.textContent.trim());
    const done = !!document.querySelector('.preview');
    const polishing = !!document.querySelector('.status') &&
      document.querySelector('.status').textContent.toLowerCase().includes('polish');
    return { hasText, btns, done, polishing };
  });
}

async function clickButtonByText(page, text) {
  const ok = await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === t);
    if (b) { b.click(); return true; }
    return false;
  }, text);
  if (!ok) throw new Error(`Button not found: ${text}`);
}

async function run() {
  const downloadDir = mkdtempSync(join(tmpdir(), 'resume-e2e-'));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });

  let polishSeen = false;
  page.on('console', (msg) => { if (msg.type() === 'error') log('PAGE ERROR:', msg.text()); });
  page.on('pageerror', (e) => log('UNCAUGHT:', e.message));

  await page.goto(BASE, { waitUntil: 'networkidle0' });
  log('loaded', BASE);

  let guard = 0;
  let lastPrompt = '';
  while (guard++ < 80) {
    await sleep(250);
    const st = await controlState(page);

    if (st.done) { log('reached DONE'); break; }
    if (st.polishing) { continue; } // wait for review controls

    // Polish review takes priority — accept the bullets.
    if (st.btns.includes('Looks good')) {
      polishSeen = true;
      log('polish review -> Looks good');
      await clickButtonByText(page, 'Looks good');
      lastPrompt = '';
      continue;
    }

    // Yes/No section prompts.
    if (st.btns.some((b) => /add one|skip/i.test(b)) && !st.hasText) {
      const prompt = await lastBotPrompt(page);
      const decision = yesNoDecision(prompt);
      log(`yes/no: "${prompt.slice(0, 50)}" -> ${decision}`);
      await clickButtonByText(page, decision === 'yes' ? 'Yes, add one' : 'No, skip');
      lastPrompt = '';
      continue;
    }

    // Text question.
    if (st.hasText) {
      const prompt = await lastBotPrompt(page);
      if (prompt === lastPrompt) continue; // not updated yet
      lastPrompt = prompt;
      const ans = answerFor(prompt);
      log(`text: "${prompt.slice(0, 50)}" -> "${ans}"`);
      await page.click('.text-form textarea');
      await page.type('.text-form textarea', ans);
      await clickButtonByText(page, 'Send');
      continue;
    }
  }

  if (guard >= 80) throw new Error('flow did not complete within guard limit');

  // Verify preview rendered the data we entered.
  const previewText = await page.evaluate(() => document.querySelector('.preview')?.textContent || '');
  const checks = ['Alex Morgan', 'State University', 'Barista', 'Python'];
  for (const c of checks) {
    if (!previewText.includes(c)) throw new Error(`preview missing expected text: ${c}`);
  }
  log('preview contains:', checks.join(', '));

  await page.screenshot({ path: join(process.cwd(), 'e2e-final.png'), fullPage: true });
  log('screenshot saved: e2e-final.png');

  // Trigger downloads and assert 200 responses.
  const waitPdf = page.waitForResponse((r) => r.url().includes('/api/generate/pdf'), { timeout: 30000 });
  await clickButtonByText(page, 'Download PDF');
  const pdfResp = await waitPdf;
  log('PDF download:', pdfResp.status(), pdfResp.headers()['content-type']);

  const waitDocx = page.waitForResponse((r) => r.url().includes('/api/generate/docx'), { timeout: 30000 });
  await clickButtonByText(page, 'Download DOCX');
  const docxResp = await waitDocx;
  log('DOCX download:', docxResp.status(), docxResp.headers()['content-type']);

  await browser.close();

  const pass = pdfResp.status() === 200 && docxResp.status() === 200 && polishSeen;
  log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
  if (!pass) process.exit(1);
}

run().catch((e) => { console.error('[e2e] ERROR', e); process.exit(1); });
