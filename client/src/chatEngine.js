// Pure helpers for walking the flow defined in questions.js.

export function setAtPath(obj, path, value) {
  const keys = path.split('.');
  const copy = structuredClone(obj);
  let cur = copy;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
  return copy;
}

// Insert or replace an item in the array at `path`, matched by its stable `__mid`.
// Lets the resume reflect a repeat-section item while it's still being filled in.
export function upsertAtPath(obj, path, value) {
  const keys = path.split('.');
  const copy = structuredClone(obj);
  let cur = copy;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  const last = keys[keys.length - 1];
  if (!Array.isArray(cur[last])) cur[last] = [];
  const arr = cur[last];
  const at = arr.findIndex((it) => it && it.__mid === value.__mid);
  if (at >= 0) arr[at] = value;
  else arr.push(value);
  return copy;
}

// Step at top-level position (skipping sections).
export function stepAt(flow, idx) {
  return flow[idx];
}

// Find the next non-section index, returning -1 if past the end.
export function nextRealStep(flow, idx) {
  let i = idx;
  while (i < flow.length && flow[i].kind === 'section') i++;
  return i >= flow.length ? -1 : i;
}
