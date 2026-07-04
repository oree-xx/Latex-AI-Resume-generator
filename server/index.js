import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { polishHandler } from './routes/polish.js';
import { pdfHandler, docxHandler } from './routes/generate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/polish', polishHandler);
app.post('/api/generate/pdf',  pdfHandler);
app.post('/api/generate/docx', docxHandler);

// In production we ship the built client from this same server, so the app and
// its API share one origin (no CORS/proxy needed). In dev there's no build —
// Vite serves the client and proxies /api here — so this block is skipped.
const clientDist = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error('[server error]', err);
  res.status(500).send(err.message || 'Internal server error');
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Resume server listening on http://localhost:${port}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('  GEMINI_API_KEY not set — /api/polish will fall back to passing raw text through unchanged.');
  }
});
