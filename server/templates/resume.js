// Server-side HTML template for PDF rendering via Puppeteer.
// Tuned for a single-page ATS-friendly look.

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function joinLine(parts) {
  return parts.filter(Boolean).map(esc).join(' · ');
}

function bulletList(bullets) {
  if (!Array.isArray(bullets) || bullets.length === 0) return '';
  return `<ul>${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`;
}

function educationBlock(edu) {
  if (!edu?.length) return '';
  const items = edu.map((e) => `
    <div class="entry">
      <div class="entry-head">
        <strong>${esc(e.school)}</strong>
        <span>${esc(e.graduationDate || '')}</span>
      </div>
      <div class="entry-sub">${joinLine([e.degree, e.major])}${e.gpa ? ` — GPA ${esc(e.gpa)}` : ''}</div>
      ${e.coursework ? `<div class="entry-detail"><em>Coursework:</em> ${esc(e.coursework)}</div>` : ''}
      ${e.honors     ? `<div class="entry-detail"><em>Honors:</em> ${esc(e.honors)}</div>` : ''}
    </div>
  `).join('');
  return section('Education', items);
}

function experienceBlock(items) {
  if (!items?.length) return '';
  const body = items.map((e) => `
    <div class="entry">
      <div class="entry-head">
        <strong>${esc(e.title)}</strong>
        <span>${esc(e.dates || '')}</span>
      </div>
      <div class="entry-sub">${joinLine([e.organization, e.location])}</div>
      ${bulletList(e.bullets)}
    </div>
  `).join('');
  return section('Experience', body);
}

function projectsBlock(items) {
  if (!items?.length) return '';
  const body = items.map((p) => `
    <div class="entry">
      <div class="entry-head">
        <strong>${esc(p.name)}</strong>
        <span>${esc(p.tech || '')}</span>
      </div>
      ${p.link ? `<div class="entry-sub">${esc(p.link)}</div>` : ''}
      ${bulletList(p.bullets)}
    </div>
  `).join('');
  return section('Projects', body);
}

function skillsBlock(skills) {
  if (!skills) return '';
  const rows = [];
  if (skills.technical) rows.push(`<div><strong>Technical:</strong> ${esc(skills.technical)}</div>`);
  if (skills.tools)     rows.push(`<div><strong>Tools:</strong> ${esc(skills.tools)}</div>`);
  if (skills.languages) rows.push(`<div><strong>Languages:</strong> ${esc(skills.languages)}</div>`);
  if (rows.length === 0) return '';
  return section('Skills', rows.join(''));
}

function activitiesBlock(items) {
  if (!items?.length) return '';
  const body = items.map((a) => `
    <div class="entry">
      <div class="entry-head">
        <strong>${esc(a.role)}</strong>
        <span>${esc(a.dates || '')}</span>
      </div>
      <div class="entry-sub">${esc(a.organization || '')}</div>
      ${bulletList(a.bullets)}
    </div>
  `).join('');
  return section('Activities & Leadership', body);
}

function awardsBlock(items) {
  if (!items?.length) return '';
  const body = items.map((a) => `
    <div class="entry">
      <div class="entry-head">
        <strong>${esc(a.name)}</strong>
        <span>${esc(a.date || '')}</span>
      </div>
      ${a.description ? `<div class="entry-detail">${esc(a.description)}</div>` : ''}
    </div>
  `).join('');
  return section('Awards & Honors', body);
}

function section(title, inner) {
  return `<section><h2>${esc(title)}</h2><div>${inner}</div></section>`;
}

export function renderResumeHtml(resume) {
  const c = resume.contact || {};
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(c.name || 'Resume')}</title>
<style>
  @page { size: Letter; margin: 0.6in; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Georgia', 'Times New Roman', serif;
    color: #111;
    font-size: 11pt;
    line-height: 1.4;
    margin: 0;
  }
  header {
    text-align: center;
    border-bottom: 2px solid #111;
    padding-bottom: 8px;
    margin-bottom: 12px;
  }
  header h1 {
    margin: 0 0 4px;
    font-size: 22pt;
    letter-spacing: 0.02em;
  }
  .contact-line { font-size: 10pt; color: #333; }
  section { margin-top: 12px; page-break-inside: avoid; }
  h2 {
    font-size: 11pt;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-bottom: 1px solid #666;
    padding-bottom: 2px;
    margin: 0 0 6px;
  }
  .entry { margin-bottom: 8px; page-break-inside: avoid; }
  .entry-head { display: flex; justify-content: space-between; align-items: baseline; }
  .entry-sub  { font-style: italic; color: #333; font-size: 10.5pt; }
  .entry-detail { font-size: 10.5pt; }
  ul { margin: 4px 0 4px 18px; padding: 0; }
  li { margin: 2px 0; font-size: 10.5pt; }
</style>
</head>
<body>
  <header>
    <h1>${esc(c.name || '')}</h1>
    <div class="contact-line">${joinLine([c.email, c.phone, c.location, c.linkedin, c.portfolio])}</div>
  </header>
  ${educationBlock(resume.education)}
  ${experienceBlock(resume.experience)}
  ${projectsBlock(resume.projects)}
  ${skillsBlock(resume.skills)}
  ${activitiesBlock(resume.activities)}
  ${awardsBlock(resume.awards)}
</body>
</html>`;
}
