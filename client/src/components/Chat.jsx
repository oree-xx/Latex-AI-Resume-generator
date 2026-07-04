import { useState, useEffect, useRef } from 'react';

export default function Chat({
  messages, mode, busy, pendingPolish,
  onSubmit, onYes, onNo, onAccept, onRetry, onEdit, onRestart, onEditAnswer,
  sections, completed, onChooseSection, onFinish,
}) {
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const [editBullets, setEditBullets] = useState([]);
  const [editingIdx, setEditingIdx] = useState(null); // index of a past answer being edited
  const [draftText, setDraftText] = useState('');
  const [draftBullets, setDraftBullets] = useState([]);
  const scrollRef = useRef(null);

  function startEdit(i, m) {
    setEditingIdx(i);
    if (m.role === 'bullets') setDraftBullets([...m.bullets]);
    else setDraftText(m.text);
  }
  function cancelEdit() { setEditingIdx(null); }
  function saveTextEdit(i) {
    const v = draftText.trim();
    if (!v) return;
    setEditingIdx(null);
    onEditAnswer(i, v);
  }
  function saveBulletsEdit(i) {
    const v = draftBullets.map((b) => b.trim()).filter(Boolean);
    if (!v.length) return;
    setEditingIdx(null);
    onEditAnswer(i, v);
  }

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, mode, busy]);

  function submit(e) {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    onSubmit(text);
    setText('');
  }

  function startEditing() {
    setEditBullets([...pendingPolish.bullets]);
    setEditing(true);
  }

  function commitEdit() {
    const cleaned = editBullets.map((b) => b.trim()).filter(Boolean);
    if (cleaned.length === 0) return;
    setEditing(false);
    onEdit(cleaned);
  }

  return (
    <div className="chat">
      <div className="chat-header">
        <span className="chat-title">Resume Builder</span>
        <div className="header-actions">
          <button className="secondary restart-btn" onClick={onRestart} disabled={busy}>
            Start over
          </button>
        </div>
      </div>
      <div className="chat-scroll" ref={scrollRef}>
        {messages.map((m, i) => {
          if (m.role === 'section') {
            return <div key={i} className="section-divider"><span>{m.text}</span></div>;
          }
          const isEditing = editingIdx === i;
          const editable = !!m.ref && !busy;

          if (m.role === 'bullets') {
            return (
              <div key={i} className="msg bot">
                {isEditing ? (
                  <div className="bubble bullets">
                    <div className="edit-bullets">
                      {draftBullets.map((b, j) => (
                        <textarea
                          key={j}
                          value={b}
                          rows={2}
                          onChange={(e) => {
                            const next = [...draftBullets];
                            next[j] = e.target.value;
                            setDraftBullets(next);
                          }}
                        />
                      ))}
                      <div className="quick-replies">
                        <button onClick={() => saveBulletsEdit(i)}>Save</button>
                        <button className="secondary" onClick={cancelEdit}>Cancel</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bubble bullets">
                      <ul>{m.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>
                    </div>
                    {editable && (
                      <button className="link-edit" onClick={() => startEdit(i, m)}>Edit</button>
                    )}
                  </>
                )}
              </div>
            );
          }

          return (
            <div key={i} className={`msg ${m.role}`}>
              {isEditing ? (
                <div className="bubble">
                  <div className="edit-inline">
                    <textarea
                      value={draftText}
                      rows={2}
                      autoFocus
                      onChange={(e) => setDraftText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          saveTextEdit(i);
                        }
                      }}
                    />
                    <div className="quick-replies">
                      <button onClick={() => saveTextEdit(i)}>Save</button>
                      <button className="secondary" onClick={cancelEdit}>Cancel</button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bubble">{m.text}</div>
                  {editable && (
                    <button className="link-edit" onClick={() => startEdit(i, m)}>Edit</button>
                  )}
                </>
              )}
            </div>
          );
        })}
        {busy && (
          <div className="msg bot">
            <div className="bubble typing"><span /><span /><span /></div>
          </div>
        )}
      </div>

      <div className="chat-input">
        {mode === 'await_section_choice' && (
          <div className="section-choice">
            <select
              className="jump-select"
              value=""
              disabled={busy}
              onChange={(e) => { if (e.target.value !== '') onChooseSection(Number(e.target.value)); }}
            >
              <option value="">Choose a section…</option>
              {sections.map((s) => (
                <option key={s.markerIdx} value={s.markerIdx}>
                  {s.title}{completed.includes(s.markerIdx) ? ' ✓' : ''}
                </option>
              ))}
            </select>
            {completed.length > 0 && (
              <button className="secondary" onClick={onFinish} disabled={busy}>
                Finish &amp; view resume
              </button>
            )}
          </div>
        )}

        {mode === 'await_text' && (
          <form onSubmit={submit} className="text-form">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your answer…"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              autoFocus
            />
            <button type="submit" disabled={!text.trim() || busy}>Send</button>
          </form>
        )}

        {mode === 'await_yes_no' && (
          <div className="quick-replies">
            <button onClick={onYes} disabled={busy}>Yes, add one</button>
            <button onClick={onNo} disabled={busy} className="secondary">No, skip</button>
          </div>
        )}

        {mode === 'await_polish_review' && !editing && (
          <div className="quick-replies">
            <button onClick={onAccept} disabled={busy}>Looks good</button>
            <button onClick={onRetry} disabled={busy} className="secondary">Try again</button>
            <button onClick={startEditing} disabled={busy} className="secondary">Edit</button>
          </div>
        )}

        {mode === 'await_polish_review' && editing && (
          <div className="edit-bullets">
            {editBullets.map((b, i) => (
              <textarea
                key={i}
                value={b}
                onChange={(e) => {
                  const next = [...editBullets];
                  next[i] = e.target.value;
                  setEditBullets(next);
                }}
                rows={2}
              />
            ))}
            <div className="quick-replies">
              <button onClick={commitEdit}>Save bullets</button>
              <button onClick={() => setEditing(false)} className="secondary">Cancel</button>
            </div>
          </div>
        )}

        {mode === 'polishing' && (
          <div className="status">Polishing your answer…</div>
        )}

        {mode === 'done' && (
          <div className="status">Resume ready — preview is on the right.</div>
        )}
      </div>
    </div>
  );
}
