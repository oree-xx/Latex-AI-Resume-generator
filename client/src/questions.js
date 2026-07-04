// The chat flow. Walked top-to-bottom by chatEngine.js.
//
// Step shapes:
//   { kind: 'section',  title }                     - just shows a header in chat
//   { kind: 'field',    id, path, prompt, input,
//                       optional?, placeholder? }   - asks a single question, stores at path
//   { kind: 'repeat',   id, path, itemNoun,
//                       prompt, addPrompt,
//                       optional?, subFlow: [...] } - asks repeatedly, builds an array of items
//
// `path` is a dotted path into the resume data object (e.g. 'contact.email').
// `input` is one of: 'text' | 'textarea' | 'polish'.
//   - polish: freeform answer that the backend rewrites into resume bullets.

export const flow = [
  { kind: 'section', title: "Contact info" },
  { kind: 'field', id: 'name',      path: 'contact.name',      prompt: "What's your full name?", input: 'text' },
  { kind: 'field', id: 'email',     path: 'contact.email',     prompt: "What's your email address?", input: 'text' },
  { kind: 'field', id: 'phone',     path: 'contact.phone',     prompt: "Phone number?", input: 'text', optional: true },
  { kind: 'field', id: 'location',  path: 'contact.location',  prompt: "Where are you based? (City, State)", input: 'text', optional: true },
  { kind: 'field', id: 'linkedin',  path: 'contact.linkedin',  prompt: "LinkedIn URL?", input: 'text', optional: true },
  { kind: 'field', id: 'portfolio', path: 'contact.portfolio', prompt: "Portfolio / GitHub / personal site?", input: 'text', optional: true },

  { kind: 'section', title: "Education" },
  {
    kind: 'repeat',
    id: 'education',
    path: 'education',
    itemNoun: 'school',
    prompt: "Let's add your education. What school are you attending (or did you graduate from)?",
    addPrompt: "Want to add another school?",
    subFlow: [
      { kind: 'field', id: 'school',    path: 'school',          prompt: "School name?", input: 'text' },
      { kind: 'field', id: 'degree',    path: 'degree',          prompt: "Degree (e.g. B.S., High School Diploma)?", input: 'text' },
      { kind: 'field', id: 'major',     path: 'major',           prompt: "Major or field of study?", input: 'text', optional: true },
      { kind: 'field', id: 'grad',      path: 'graduationDate',  prompt: "Graduation date (or expected — e.g. 'May 2027')?", input: 'text' },
      { kind: 'field', id: 'gpa',       path: 'gpa',             prompt: "GPA?", input: 'text', optional: true },
      { kind: 'field', id: 'courses',   path: 'coursework',      prompt: "Relevant coursework (comma-separated)?", input: 'text', optional: true },
      { kind: 'field', id: 'honors',    path: 'honors',          prompt: "Any honors (Dean's List, scholarships)?", input: 'text', optional: true },
    ],
  },

  { kind: 'section', title: "Experience" },
  {
    kind: 'repeat',
    id: 'experience',
    path: 'experience',
    itemNoun: 'job',
    optional: true,
    prompt: "Any work experience? (internships, part-time jobs, volunteer roles all count)",
    addPrompt: "Add another job or role?",
    subFlow: [
      { kind: 'field', id: 'title',    path: 'title',        prompt: "What was your title or role?", input: 'text' },
      { kind: 'field', id: 'org',      path: 'organization', prompt: "Company or organization?", input: 'text' },
      { kind: 'field', id: 'loc',      path: 'location',     prompt: "Location (city, state or 'Remote')?", input: 'text', optional: true },
      { kind: 'field', id: 'dates',    path: 'dates',        prompt: "Dates? (e.g. 'Jun 2024 – Aug 2024')", input: 'text' },
      {
        kind: 'field',
        id: 'desc',
        path: 'bullets',
        prompt: "Describe what you actually did. Talk freely — I'll turn it into strong bullet points.",
        input: 'polish',
        polishKind: 'experience',
      },
    ],
  },

  { kind: 'section', title: "Projects" },
  {
    kind: 'repeat',
    id: 'projects',
    path: 'projects',
    itemNoun: 'project',
    optional: true,
    prompt: "Got any projects worth showing off? (school, personal, hackathon — anything)",
    addPrompt: "Add another project?",
    subFlow: [
      { kind: 'field', id: 'name', path: 'name', prompt: "Project name?", input: 'text' },
      { kind: 'field', id: 'tech', path: 'tech', prompt: "Tech / tools used (comma-separated)?", input: 'text', optional: true },
      { kind: 'field', id: 'link', path: 'link', prompt: "Link (GitHub / demo)?", input: 'text', optional: true },
      {
        kind: 'field',
        id: 'desc',
        path: 'bullets',
        prompt: "What does it do, and what did you build? Talk freely.",
        input: 'polish',
        polishKind: 'project',
      },
    ],
  },

  { kind: 'section', title: "Skills" },
  { kind: 'field', id: 'technical', path: 'skills.technical', prompt: "Technical skills? (comma-separated — e.g. 'Python, JavaScript, SQL')", input: 'text', optional: true },
  { kind: 'field', id: 'tools',     path: 'skills.tools',     prompt: "Tools / software you use? (e.g. 'Excel, Figma, Git')", input: 'text', optional: true },
  { kind: 'field', id: 'languages', path: 'skills.languages', prompt: "Languages you speak?", input: 'text', optional: true },

  { kind: 'section', title: "Activities & awards" },
  {
    kind: 'repeat',
    id: 'activities',
    path: 'activities',
    itemNoun: 'activity',
    optional: true,
    prompt: "Clubs, leadership, or volunteer roles?",
    addPrompt: "Add another activity?",
    subFlow: [
      { kind: 'field', id: 'role',  path: 'role',         prompt: "Your role?", input: 'text' },
      { kind: 'field', id: 'org',   path: 'organization', prompt: "Organization or club?", input: 'text' },
      { kind: 'field', id: 'dates', path: 'dates',        prompt: "Dates?", input: 'text', optional: true },
      {
        kind: 'field',
        id: 'desc',
        path: 'bullets',
        prompt: "What did you do in this role?",
        input: 'polish',
        polishKind: 'activity',
      },
    ],
  },
  {
    kind: 'repeat',
    id: 'awards',
    path: 'awards',
    itemNoun: 'award',
    optional: true,
    prompt: "Any awards, honors, or scholarships?",
    addPrompt: "Add another award?",
    subFlow: [
      { kind: 'field', id: 'name', path: 'name',        prompt: "Award name?", input: 'text' },
      { kind: 'field', id: 'date', path: 'date',        prompt: "When did you receive it?", input: 'text', optional: true },
      { kind: 'field', id: 'desc', path: 'description', prompt: "One-line description?", input: 'text', optional: true },
    ],
  },
];

export function emptyResume() {
  return {
    contact: {},
    education: [],
    experience: [],
    projects: [],
    skills: {},
    activities: [],
    awards: [],
  };
}
