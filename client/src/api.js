// All paths go through Vite's dev proxy to the Express server.

export async function polish({ rawText, kind, context }) {
  const res = await fetch('/api/polish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawText, kind, context }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Polish failed: ${err}`);
  }
  return res.json(); // { bullets: string[] }
}

// Drop internal item ids (used only for in-chat editing) before sending to the server.
function stripInternal(resume) {
  const out = structuredClone(resume);
  for (const k of Object.keys(out)) {
    if (Array.isArray(out[k])) {
      out[k] = out[k].map(({ __mid, ...rest }) => rest);
    }
  }
  return out;
}

export async function downloadResume(format, resume) {
  const res = await fetch(`/api/generate/${format}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resume: stripInternal(resume) }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Generate ${format} failed: ${err}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${resume.contact?.name || 'resume'}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
