export default function ResumePreview({ resume, onDownload }) {
  const c = resume.contact || {};
  return (
    <div className="preview">
      <div className="preview-toolbar">
        <div className="preview-title">
          <strong>Preview</strong>
        </div>
        <div>
          <button onClick={() => onDownload('pdf')}>Download PDF</button>
          <button onClick={() => onDownload('docx')} className="secondary">Download DOCX</button>
        </div>
      </div>
      <div className="preview-page">
        <header>
          <h1>{c.name || 'Your Name'}</h1>
          <div className="contact-line">
            {[c.email, c.phone, c.location, c.linkedin, c.portfolio].filter(Boolean).join(' · ')}
          </div>
        </header>

        {resume.education?.length > 0 && (
          <Section title="Education">
            {resume.education.map((e, i) => (
              <div className="entry" key={i}>
                <div className="entry-head">
                  <strong>{e.school}</strong>
                  <span>{e.graduationDate}</span>
                </div>
                <div className="entry-sub">
                  {[e.degree, e.major].filter(Boolean).join(', ')}
                  {e.gpa ? ` — GPA ${e.gpa}` : ''}
                </div>
                {e.coursework && <div className="entry-detail"><em>Coursework:</em> {e.coursework}</div>}
                {e.honors && <div className="entry-detail"><em>Honors:</em> {e.honors}</div>}
              </div>
            ))}
          </Section>
        )}

        {resume.experience?.length > 0 && (
          <Section title="Experience">
            {resume.experience.map((e, i) => (
              <div className="entry" key={i}>
                <div className="entry-head">
                  <strong>{e.title}</strong>
                  <span>{e.dates}</span>
                </div>
                <div className="entry-sub">
                  {[e.organization, e.location].filter(Boolean).join(' · ')}
                </div>
                {Array.isArray(e.bullets) && <ul>{e.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>}
              </div>
            ))}
          </Section>
        )}

        {resume.projects?.length > 0 && (
          <Section title="Projects">
            {resume.projects.map((p, i) => (
              <div className="entry" key={i}>
                <div className="entry-head">
                  <strong>{p.name}</strong>
                  {p.tech && <span>{p.tech}</span>}
                </div>
                {p.link && <div className="entry-sub">{p.link}</div>}
                {Array.isArray(p.bullets) && <ul>{p.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>}
              </div>
            ))}
          </Section>
        )}

        {(resume.skills?.technical || resume.skills?.tools || resume.skills?.languages) && (
          <Section title="Skills">
            {resume.skills.technical && <div><strong>Technical:</strong> {resume.skills.technical}</div>}
            {resume.skills.tools     && <div><strong>Tools:</strong> {resume.skills.tools}</div>}
            {resume.skills.languages && <div><strong>Languages:</strong> {resume.skills.languages}</div>}
          </Section>
        )}

        {resume.activities?.length > 0 && (
          <Section title="Activities & Leadership">
            {resume.activities.map((a, i) => (
              <div className="entry" key={i}>
                <div className="entry-head">
                  <strong>{a.role}</strong>
                  <span>{a.dates}</span>
                </div>
                <div className="entry-sub">{a.organization}</div>
                {Array.isArray(a.bullets) && <ul>{a.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>}
              </div>
            ))}
          </Section>
        )}

        {resume.awards?.length > 0 && (
          <Section title="Awards & Honors">
            {resume.awards.map((a, i) => (
              <div className="entry" key={i}>
                <div className="entry-head">
                  <strong>{a.name}</strong>
                  <span>{a.date}</span>
                </div>
                {a.description && <div className="entry-detail">{a.description}</div>}
              </div>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2>{title}</h2>
      <div className="section-body">{children}</div>
    </section>
  );
}
