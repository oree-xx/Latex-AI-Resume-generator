import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, TabStopType, TabStopPosition, Tab, BorderStyle,
} from 'docx';

function txt(text, opts = {}) {
  return new TextRun({ text: text == null ? '' : String(text), ...opts });
}

function nameHeader(name) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [txt(name || '', { bold: true, size: 36 })],
  });
}

function contactLine(c) {
  const parts = [c.email, c.phone, c.location, c.linkedin, c.portfolio].filter(Boolean).join(' · ');
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    border: { bottom: { color: '000000', size: 12, space: 4, style: BorderStyle.SINGLE } },
    children: [txt(parts, { size: 20 })],
  });
}

function sectionHeading(text) {
  return new Paragraph({
    spacing: { before: 220, after: 80 },
    border: { bottom: { color: '777777', size: 6, space: 2, style: BorderStyle.SINGLE } },
    children: [txt(text.toUpperCase(), { bold: true, size: 22 })],
  });
}

// Two-column line: left text bold, right text right-aligned via a right tab stop.
function headedLine(left, right) {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      txt(left || '', { bold: true, size: 22 }),
      new TextRun({ children: [new Tab()] }),
      txt(right || '', { size: 22 }),
    ],
  });
}

function subLine(text) {
  return new Paragraph({
    spacing: { after: 40 },
    children: [txt(text || '', { italics: true, size: 21 })],
  });
}

function detailLine(label, body) {
  return new Paragraph({
    spacing: { after: 40 },
    children: [
      txt(`${label}: `, { italics: true, size: 21 }),
      txt(body, { size: 21 }),
    ],
  });
}

function bulletPara(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40 },
    children: [txt(text, { size: 21 })],
  });
}

function block(title, bodyParas) {
  if (!bodyParas || bodyParas.length === 0) return [];
  return [sectionHeading(title), ...bodyParas];
}

function educationBody(edu) {
  if (!edu?.length) return [];
  const out = [];
  for (const e of edu) {
    out.push(headedLine(e.school, e.graduationDate));
    const subBits = [e.degree, e.major].filter(Boolean).join(', ');
    const gpaBit = e.gpa ? ` — GPA ${e.gpa}` : '';
    if (subBits || gpaBit) out.push(subLine(`${subBits}${gpaBit}`));
    if (e.coursework) out.push(detailLine('Coursework', e.coursework));
    if (e.honors)     out.push(detailLine('Honors', e.honors));
  }
  return out;
}

function entriesWithBullets(items, headFn, subFn) {
  if (!items?.length) return [];
  const out = [];
  for (const item of items) {
    out.push(headFn(item));
    const sub = subFn(item);
    if (sub) out.push(subLine(sub));
    if (Array.isArray(item.bullets)) {
      for (const b of item.bullets) out.push(bulletPara(b));
    }
  }
  return out;
}

function skillsBody(skills) {
  if (!skills) return [];
  const out = [];
  const row = (label, value) => new Paragraph({
    spacing: { after: 40 },
    children: [txt(`${label}: `, { bold: true, size: 21 }), txt(value, { size: 21 })],
  });
  if (skills.technical) out.push(row('Technical', skills.technical));
  if (skills.tools)     out.push(row('Tools', skills.tools));
  if (skills.languages) out.push(row('Languages', skills.languages));
  return out;
}

function awardsBody(items) {
  if (!items?.length) return [];
  const out = [];
  for (const a of items) {
    out.push(headedLine(a.name, a.date));
    if (a.description) out.push(new Paragraph({
      spacing: { after: 40 },
      children: [txt(a.description, { size: 21 })],
    }));
  }
  return out;
}

export async function renderResumeDocx(resume) {
  const c = resume.contact || {};

  const children = [
    nameHeader(c.name),
    contactLine(c),
    ...block('Education', educationBody(resume.education)),
    ...block('Experience', entriesWithBullets(
      resume.experience,
      (e) => headedLine(e.title, e.dates),
      (e) => [e.organization, e.location].filter(Boolean).join(' · '),
    )),
    ...block('Projects', entriesWithBullets(
      resume.projects,
      (p) => headedLine(p.name, p.tech || ''),
      (p) => p.link || '',
    )),
    ...block('Skills', skillsBody(resume.skills)),
    ...block('Activities & Leadership', entriesWithBullets(
      resume.activities,
      (a) => headedLine(a.role, a.dates),
      (a) => a.organization || '',
    )),
    ...block('Awards & Honors', awardsBody(resume.awards)),
  ];

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Georgia', size: 22 } },
      },
    },
    sections: [{
      properties: {
        page: { margin: { top: 864, right: 864, bottom: 864, left: 864 } }, // ~0.6 inch
      },
      children,
    }],
  });

  return await Packer.toBuffer(doc);
}
