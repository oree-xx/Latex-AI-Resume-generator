import { useState, useEffect, useRef } from 'react';
import { flow, emptyResume } from './questions.js';
import { setAtPath, upsertAtPath } from './chatEngine.js';
import { polish, downloadResume } from './api.js';
import Chat from './components/Chat.jsx';
import ResumePreview from './components/ResumePreview.jsx';
import './app.css';

// Modes describe what we're waiting for from the user.
// 'await_section_choice'- user picks which section to work on from the in-chat menu
// 'await_text'         - typed answer to a field question
// 'await_yes_no'       - optional section / add-another prompt
// 'await_polish_review'- polished bullets shown, awaiting accept / retry / edit
// 'polishing'          - LLM call in flight
// 'done'               - flow complete, showing resume preview

// Each section spans the flow steps between its header and the next header,
// as a half-open range [startIdx, endIdx). The menu jumps to startIdx.
const SECTIONS = (() => {
  const list = flow.flatMap((step, idx) =>
    step.kind === 'section'
      ? [{ title: step.title, markerIdx: idx, startIdx: idx + 1, endIdx: flow.length }]
      : []
  );
  for (let i = 0; i < list.length - 1; i++) list[i].endIdx = list[i + 1].markerIdx;
  return list;
})();

export default function App() {
  const [messages, setMessages] = useState([]);
  const [resume, setResume] = useState(emptyResume());
  const [pos, setPos] = useState({ stepIdx: 0, subIdx: 0, inRepeat: false, item: null });
  const [mode, setMode] = useState('await_section_choice');
  const [completed, setCompleted] = useState([]); // markerIdx of sections finished so far
  const [pendingPolish, setPendingPolish] = useState(null); // { bullets, rawText, attempt }
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const sectionRef = useRef(null); // the section currently being worked on
  const midRef = useRef(0); // stable ids for repeat-section items, used to locate answers for editing
  const newMid = () => ++midRef.current;

  // Kick off the conversation on first mount.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    beginConversation();
  }, []);

  function beginConversation() {
    appendBot("Hi! I'm going to help you build a polished resume, one section at a time — I'll clean up your answers as we go.");
    appendBot("Which section would you like to start with? Pick one below.");
    setMode('await_section_choice');
  }

  // Wipe all progress and restart the flow from the section menu.
  function restart() {
    const hasProgress = messages.some((m) => m.role === 'user');
    if (hasProgress && !window.confirm('Start over? This clears your answers and the resume so far.')) return;
    setMessages([]);
    setResume(emptyResume());
    setPendingPolish(null);
    setBusy(false);
    setCompleted([]);
    sectionRef.current = null;
    setPos({ stepIdx: 0, subIdx: 0, inRepeat: false, item: null });
    beginConversation();
  }

  // Begin a section the user picked from the in-chat menu.
  function chooseSection(markerIdx) {
    if (busy) return;
    const section = SECTIONS.find((s) => s.markerIdx === markerIdx);
    if (!section) return;
    sectionRef.current = section;
    setPendingPolish(null);
    appendSection(section.title);
    primeStep({ stepIdx: section.startIdx, subIdx: 0, inRepeat: false, item: null });
  }

  // Finished the current section: record it and return to the menu.
  function completeSection() {
    const section = sectionRef.current;
    sectionRef.current = null;
    const nextCompleted = section && !completed.includes(section.markerIdx)
      ? [...completed, section.markerIdx]
      : completed;
    setCompleted(nextCompleted);
    appendBot(nextCompleted.length >= SECTIONS.length
      ? "That covers every section! Pick one to revisit, or finish and view your resume."
      : "Which section would you like to work on next?");
    setMode('await_section_choice');
  }

  // Wrap up: stop asking and show the finished resume.
  function handleFinish() {
    if (busy) return;
    sectionRef.current = null;
    appendBot("All done! Your resume is ready on the right — download it as PDF or DOCX.");
    setMode('done');
  }

  function appendBot(text) {
    setMessages((m) => [...m, { role: 'bot', text }]);
  }
  // `ref` (optional) records where this answer lives in the resume so it can be edited later.
  function appendUser(text, ref) {
    setMessages((m) => [...m, { role: 'user', text, ...(ref ? { ref } : {}) }]);
  }
  function appendSection(title) {
    setMessages((m) => [...m, { role: 'section', text: title }]);
  }
  function appendBullets(bullets, ref) {
    setMessages((m) => [...m, { role: 'bullets', bullets, ...(ref ? { ref } : {}) }]);
  }

  // Show the prompt at the given position and set the right mode.
  // Bounded to the current section: when it runs past the section's last
  // step it returns to the menu rather than walking into the next section.
  function primeStep(next) {
    let { stepIdx, subIdx, inRepeat, item } = next;
    const endIdx = sectionRef.current ? sectionRef.current.endIdx : flow.length;

    while (stepIdx < endIdx) {
      const step = flow[stepIdx];

      if (step.kind === 'field' && !inRepeat) {
        appendBot(step.prompt + (step.optional ? "  (optional — type 'skip' to skip)" : ""));
        setPos({ stepIdx, subIdx: 0, inRepeat: false, item: null });
        setMode('await_text');
        return;
      }

      if (step.kind === 'repeat' && !inRepeat) {
        // Starting a new repeat section.
        if (step.optional) {
          appendBot(step.prompt);
          setPos({ stepIdx, subIdx: 0, inRepeat: false, item: null });
          setMode('await_yes_no');
          return;
        }
        // Mandatory repeat: start the first item right away.
        appendBot(step.prompt);
        setPos({ stepIdx, subIdx: 0, inRepeat: true, item: { __mid: newMid() } });
        setMode('await_text');
        // Ask the first sub-question now so the intro and first prompt arrive together.
        appendBot(step.subFlow[0].prompt);
        return;
      }

      if (step.kind === 'repeat' && inRepeat) {
        const subStep = step.subFlow[subIdx];
        appendBot(subStep.prompt + (subStep.optional ? "  (optional — type 'skip')" : ""));
        setPos({ stepIdx, subIdx, inRepeat: true, item });
        setMode('await_text');
        return;
      }

      stepIdx++;
    }

    // Reached the end of this section — back to the menu.
    completeSection();
  }

  function advanceFromField(updatedResume, updatedItem) {
    const step = flow[pos.stepIdx];

    if (pos.inRepeat) {
      // Reflect the in-progress item in the resume right away so the preview
      // updates after each sub-answer, not only once the whole entry is done.
      setResume(upsertAtPath(updatedResume, step.path, updatedItem));

      const nextSubIdx = pos.subIdx + 1;
      if (nextSubIdx < step.subFlow.length) {
        // Move to next sub-question within the same item.
        const subStep = step.subFlow[nextSubIdx];
        appendBot(subStep.prompt + (subStep.optional ? "  (optional — type 'skip')" : ""));
        setPos({ ...pos, subIdx: nextSubIdx, item: updatedItem });
        setMode('await_text');
        return;
      }
      // Finished this item — ask "add another?".
      appendBot(step.addPrompt);
      setPos({ stepIdx: pos.stepIdx, subIdx: 0, inRepeat: false, item: null });
      setMode('await_yes_no');
      return;
    }

    // Non-repeat field: advance to the next top-level step.
    setResume(updatedResume);
    primeStep({ stepIdx: pos.stepIdx + 1, subIdx: 0, inRepeat: false, item: null });
  }

  // Handlers ---------------------------------------------------------------

  async function handleTextSubmit(raw) {
    const value = raw.trim();
    if (!value) return;

    const step = flow[pos.stepIdx];
    const activeStep = pos.inRepeat ? step.subFlow[pos.subIdx] : step;
    const isSkip = activeStep.optional && /^(skip|none|n\/a|no)$/i.test(value);

    if (activeStep.input === 'polish' && !isSkip) {
      // The raw text bubble isn't editable; the polished bullets get the edit ref on commit.
      appendUser(value);
      setMode('polishing');
      setBusy(true);
      try {
        const context = describePolishContext(step, pos.item);
        const { bullets } = await polish({
          rawText: value,
          kind: activeStep.polishKind,
          context,
        });
        setPendingPolish({ bullets, rawText: value, attempt: 1 });
        appendBot("Here's how I'd phrase that on your resume — accept, retry, or edit?");
        appendBullets(bullets);
        setMode('await_polish_review');
      } catch (err) {
        appendBot(`Couldn't reach the polishing service (${err.message}). I'll use your raw text as a single bullet for now.`);
        const bullets = [value];
        appendBullets(bullets);
        commitPolishedBullets(bullets);
      } finally {
        setBusy(false);
      }
      return;
    }

    // Plain text field — tag the bubble so the answer can be edited later.
    const storedValue = isSkip ? '' : value;
    appendUser(value, answerRef(step, activeStep, pos, 'text'));
    if (pos.inRepeat) {
      const updatedItem = { ...pos.item, [activeStep.path]: storedValue };
      advanceFromField(resume, updatedItem);
    } else {
      const updated = setAtPath(resume, activeStep.path, storedValue);
      advanceFromField(updated, null);
    }
  }

  // Build a ref describing where an answer lives in the resume.
  function answerRef(step, activeStep, position, kind) {
    return position.inRepeat
      ? { kind, arrayPath: step.path, mid: position.item.__mid, key: activeStep.path }
      : { kind, path: activeStep.path };
  }

  function handleYes() {
    appendUser("Yes");
    const step = flow[pos.stepIdx];
    // Begin a new item in this repeat.
    appendBot(step.subFlow[0].prompt);
    setPos({ stepIdx: pos.stepIdx, subIdx: 0, inRepeat: true, item: { __mid: newMid() } });
    setMode('await_text');
  }

  function handleNo() {
    appendUser("No");
    primeStep({ stepIdx: pos.stepIdx + 1, subIdx: 0, inRepeat: false, item: null });
  }

  function commitPolishedBullets(bullets) {
    const step = flow[pos.stepIdx];
    const activeStep = pos.inRepeat ? step.subFlow[pos.subIdx] : step;
    const ref = answerRef(step, activeStep, pos, 'polish');
    // Tag the most recent bullets bubble so it stays editable after commit.
    setMessages((ms) => {
      const copy = [...ms];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === 'bullets') { copy[i] = { ...copy[i], bullets, ref }; break; }
      }
      return copy;
    });
    if (pos.inRepeat) {
      const updatedItem = { ...pos.item, [activeStep.path]: bullets };
      setPendingPolish(null);
      advanceFromField(resume, updatedItem);
    } else {
      const updated = setAtPath(resume, activeStep.path, bullets);
      setPendingPolish(null);
      advanceFromField(updated, null);
    }
  }

  function handleAcceptBullets() {
    appendUser("Looks good");
    commitPolishedBullets(pendingPolish.bullets);
  }

  async function handleRetryBullets() {
    appendUser("Try again");
    const step = flow[pos.stepIdx];
    const activeStep = pos.inRepeat ? step.subFlow[pos.subIdx] : step;
    setMode('polishing');
    setBusy(true);
    try {
      const context = describePolishContext(step, pos.item);
      const { bullets } = await polish({
        rawText: pendingPolish.rawText,
        kind: activeStep.polishKind,
        context: `${context} (rewrite differently — previous attempt #${pendingPolish.attempt})`,
      });
      setPendingPolish({ bullets, rawText: pendingPolish.rawText, attempt: pendingPolish.attempt + 1 });
      appendBot("Take two — how about this?");
      appendBullets(bullets);
      setMode('await_polish_review');
    } catch (err) {
      appendBot(`Retry failed (${err.message}). Keeping the original.`);
      setMode('await_polish_review');
    } finally {
      setBusy(false);
    }
  }

  function handleEditBullets(newBullets) {
    appendUser("Edited");
    appendBullets(newBullets);
    commitPolishedBullets(newBullets);
  }

  // Edit a previously answered question in place (text field or polished bullets).
  function editAnswer(idx, newValue) {
    const ref = messages[idx]?.ref;
    if (!ref) return;
    setResume((prev) => applyEdit(prev, ref, newValue));
    // If the item is still being filled in (not yet pushed to the resume array), patch it too.
    if (ref.arrayPath && pos.item && pos.item.__mid === ref.mid) {
      setPos((p) => ({ ...p, item: { ...p.item, [ref.key]: newValue } }));
    }
    setMessages((ms) => ms.map((m, i) => (
      i === idx
        ? (ref.kind === 'polish' ? { ...m, bullets: newValue } : { ...m, text: newValue })
        : m
    )));
  }

  // ------------------------------------------------------------------------

  return (
    <div className="layout">
      <Chat
        messages={messages}
        mode={mode}
        busy={busy}
        pendingPolish={pendingPolish}
        onSubmit={handleTextSubmit}
        onYes={handleYes}
        onNo={handleNo}
        onAccept={handleAcceptBullets}
        onRetry={handleRetryBullets}
        onEdit={handleEditBullets}
        onRestart={restart}
        onEditAnswer={editAnswer}
        sections={SECTIONS}
        completed={completed}
        onChooseSection={chooseSection}
        onFinish={handleFinish}
      />
      <ResumePreview
        resume={resume}
        onDownload={(fmt) => downloadResume(fmt, resume)}
      />
    </div>
  );
}

// Write an edited value back into the resume at the location named by `ref`.
function applyEdit(resume, ref, value) {
  if (ref.path) return setAtPath(resume, ref.path, value);
  if (ref.arrayPath) {
    const copy = structuredClone(resume);
    const arr = copy[ref.arrayPath];
    if (Array.isArray(arr)) {
      const item = arr.find((it) => it.__mid === ref.mid);
      if (item) item[ref.key] = value;
    }
    return copy;
  }
  return resume;
}

function describePolishContext(step, item) {
  if (!item) return step.id;
  if (step.id === 'experience') return `Role: ${item.title || ''} at ${item.organization || ''}`;
  if (step.id === 'projects')   return `Project: ${item.name || ''} (tech: ${item.tech || 'n/a'})`;
  if (step.id === 'activities') return `${item.role || ''} at ${item.organization || ''}`;
  return step.id;
}
