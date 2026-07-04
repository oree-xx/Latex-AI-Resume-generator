import { renderResumeHtml } from '../templates/resume.js';
import { renderResumePdf } from '../generators/pdf.js';
import { renderResumeDocx } from '../generators/docx.js';

export async function pdfHandler(req, res, next) {
  try {
    const { resume } = req.body || {};
    if (!resume) return res.status(400).send("Missing 'resume'.");
    const html = renderResumeHtml(resume);
    const pdf = await renderResumePdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="resume.pdf"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
}

export async function docxHandler(req, res, next) {
  try {
    const { resume } = req.body || {};
    if (!resume) return res.status(400).send("Missing 'resume'.");
    const buffer = await renderResumeDocx(resume);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="resume.docx"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}
