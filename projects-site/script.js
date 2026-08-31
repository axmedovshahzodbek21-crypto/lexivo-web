/* ================================================================
   PROJECTS  —  this is the only part you edit to add a project.
   Append an object to the array. One object == one card.

   fields:
     name      short display name
     kind      badge text (platform / framework)
     accent    "lexivo" | "cdi" | "batch"   OR any hex e.g. "#e0a72c"
     status    short status label (rendered with a coloured dot)
     tagline   one sentence, plain text
     note      optional dim sub-line
     features  array of short strings -> pills
     stack     array of tech strings  -> mono row
     art       "cards" | "gauge" | "amrap"  (omit for a generic checkmark)
     links     array of { label, href }
     spec      optional HTML string -> collapsible "Full spec"

   After adding a project also bump the count in sitemap.xml only if
   you give it its own page; a card alone needs no sitemap change.
   ================================================================ */
const PROJECTS = [
  {
    name: "Lexivo",
    kind: "Web app · Next.js",
    accent: "lexivo",
    status: "Live",
    tagline: "A vocabulary trainer for learners and classrooms — spaced-repetition decks, teacher-run review sessions, and multiple-choice drills that grade on tap.",
    note: "The studio behind the other two projects on this shelf.",
    features: [
      "Spaced-repetition scheduling",
      "Class review mode for teachers",
      "MCQ tiles auto-grade on tap",
      "Per-card reveal → grade timing",
      "New class words capped per session",
    ],
    stack: ["Next.js", "React", "TypeScript", "Supabase", "Vercel"],
    art: "cards",
    links: [{ label: "Open app ↗", href: "https://lexivo-web-nu.vercel.app" }],
    spec: `
      <p>Lexivo pairs a personal SRS deck with a <strong>classroom mode</strong>: a teacher runs a live review, learners tap through multiple-choice tiles, and each card's reveal-to-grade time is logged to <code>class_review_events</code> for pacing insight.</p>
      <ul>
        <li>Struggling class words are <strong>flagged, not auto-unlearned</strong>, so a bad day doesn't wipe progress.</li>
        <li>Next-due dates are computed against the learner's <strong>local date</strong> so the "due" filter always lines up.</li>
        <li>New class words are limited to <strong>10 per session</strong> to keep review load sane.</li>
      </ul>`,
  },
  {
    name: "IELTS CDI",
    kind: "Web tool · Next.js 16",
    accent: "cdi",
    status: "Private · v0.1.0",
    tagline: "Turns paper IELTS Academic Reading passages into a computer-delivered test — authoring, an interactive test-taker, static HTML export, and Play-store distribution.",
    features: [
      "All 14 official Reading question types",
      "No account — fresh session per visit",
      "Interactive taker with band-score estimate",
      "Self-contained HTML export per test",
      "Creator attribution pills + avatar",
      "PWA → Trusted Web Activity → Google Play",
    ],
    stack: ["Next.js 16", "React 19", "TypeScript", "Tailwind v4", "Supabase", "Vercel Cron"],
    art: "gauge",
    links: [{ label: "Visit ↗", href: "https://ielts-cdi-mauve.vercel.app" }],
    spec: `
      <p><strong>Authoring flow:</strong> every visit spins up a fresh session straight into a passage editor — paste text, set paragraph labelling (none / A,B,C / i,ii,iii), add a glossary, subtitle, and recommended time. No dashboard, no login.</p>
      <p><strong>Question families:</strong> Judgement (TF/NG, YN/NG), Selection (MCQ, multi-select), Matching (headings, information, features, sentence endings), and Completion (sentence, short answer, summary, note, flow-chart, table, diagram label with %-positioned clickable markers).</p>
      <p><strong>Test-taker:</strong> a "Start Test" screen with the creator's channel + avatar, live passage highlighting, a timer, then a results screen with an estimated band score scaled from a raw-score table to any question count.</p>
      <p><strong>Data model:</strong> <code>tests → passages → question_groups → questions</code>, plus <code>attempts</code> with a client-generated session token. JSONB holds type-specific shapes; normalized columns for anything ordered or joined. Public RLS read for published tests only; writes via a service-role key behind an admin cookie.</p>
      <p><strong>Distribution:</strong> installable manifest + offline-fallback service worker, and a Digital Asset Links endpoint at <code>/.well-known/assetlinks.json</code> so the same production URL ships to Google Play as an <code>.aab</code> — no second codebase. A daily 03:00 cron sweeps stale tests older than 24h.</p>`,
  },
  {
    name: "Batch",
    kind: "PWA + Android · Capacitor",
    accent: "batch",
    status: "v1.0.0 · personal",
    tagline: "A personal Cindy training tracker — a fixed 24-week progression toward the CrossFit benchmark WOD: 20 min AMRAP of 5 pull-ups, 10 push-ups, 15 air squats.",
    features: [
      "Auto-generated 6-month schedule from your start date",
      "Guided runner: work/rest, round counter, splits",
      "Audio countdown cues + screen wake-lock",
      "Round-pace chart + two-session comparison",
      "Local only — last 80 sessions, no backend",
      "Installable PWA + downloadable APK",
    ],
    stack: ["React 19", "TypeScript 5.7", "Vite 6", "Tailwind v4", "Zustand 5", "Capacitor 7", "Web Audio API"],
    art: "amrap",
    links: [{ label: "Visit ↗", href: "https://dist-one-eta-78.vercel.app" }],
    spec: `
      <p><strong>The plan:</strong> 24 weeks, Mon–Sat with Sundays off, one variable changed per week (rounds <em>or</em> rest, never both). Month 6 switches to AMRAP blocks — 10 → 13 → 16 → 20 min — ending on full Cindy.</p>
      <p><strong>Guided runner:</strong> work/rest phases, round counter, circuit progress bar, per-exercise stopwatch, countdown beeps synthesized with the Web Audio API (no assets), and <code>navigator.wakeLock</code> to keep the screen on. Android hardware back-button handled via history + a Capacitor listener.</p>
      <p><strong>Stats:</strong> round-pace-over-time bar chart, per-exercise pace trends with faster/slower deltas, and a side-by-side comparison of any two sessions.</p>
      <p><strong>Storage:</strong> Zustand + persist to <code>localStorage</code> under key <code>batch-cindy-v2</code>. A <code>SessionLog</code> holds date, day, week, kind (rounds/amrap), target/completed rounds, rest, duration, and roundSplits[]. Schedule status (done / missed / today / upcoming) is recomputed from log dates and the real date on every launch.</p>
      <p><strong>Shell:</strong> web manifest + network-first service worker, plus a Capacitor 7 Android project (App ID <code>com.shahzod.batch</code>). Dark near-black palette, Figtree + Bebas Neue, portrait mobile-first.</p>`,
  },
];

/* ---------- rendering ---------- */
const ACCENTS = { lexivo: "var(--a-lexivo)", cdi: "var(--a-cdi)", batch: "var(--a-batch)" };

function artSVG(kind) {
  if (kind === "cards") return `
    <svg viewBox="0 0 200 160" fill="none" aria-hidden="true">
      <g stroke="currentColor" stroke-width="3">
        <rect x="34" y="46" width="110" height="78" rx="12" transform="rotate(-11 89 85)" fill="color-mix(in srgb, currentColor 8%, transparent)"/>
        <rect x="50" y="40" width="110" height="78" rx="12" transform="rotate(-2 105 79)" fill="color-mix(in srgb, currentColor 12%, transparent)"/>
        <rect x="60" y="34" width="110" height="78" rx="12" transform="rotate(7 115 73)" fill="color-mix(in srgb, currentColor 20%, transparent)"/>
      </g>
      <g stroke="currentColor" stroke-width="4" stroke-linecap="round" transform="rotate(7 115 73)">
        <line x1="80" y1="58" x2="150" y2="58"/>
        <line x1="80" y1="74" x2="150" y2="74"/>
        <line x1="80" y1="90" x2="126" y2="90"/>
      </g>
    </svg>`;
  if (kind === "gauge") return `
    <svg viewBox="0 0 200 160" fill="none" aria-hidden="true">
      <path d="M28 130 A72 72 0 0 1 172 130" stroke="color-mix(in srgb, currentColor 22%, transparent)" stroke-width="14" stroke-linecap="round"/>
      <path d="M28 130 A72 72 0 0 1 138 71" stroke="currentColor" stroke-width="14" stroke-linecap="round"/>
      <line x1="100" y1="130" x2="132" y2="86" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      <circle cx="100" cy="130" r="8" fill="currentColor"/>
      <text x="100" y="118" text-anchor="middle" font-family="Bricolage Grotesque, sans-serif" font-weight="800" font-size="34" fill="currentColor">7.5</text>
      <text x="100" y="150" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="currentColor" opacity="0.7">BAND</text>
    </svg>`;
  if (kind === "amrap") return `
    <svg viewBox="0 0 200 160" fill="none" aria-hidden="true">
      <circle cx="100" cy="80" r="58" stroke="color-mix(in srgb, currentColor 22%, transparent)" stroke-width="12"/>
      <circle cx="100" cy="80" r="58" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-dasharray="273 91" transform="rotate(-90 100 80)"/>
      <text x="100" y="74" text-anchor="middle" font-family="Bricolage Grotesque, sans-serif" font-weight="800" font-size="30" fill="currentColor">20:00</text>
      <text x="100" y="96" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="currentColor" opacity="0.7">AMRAP</text>
      <g stroke="currentColor" stroke-width="7" stroke-linecap="round">
        <line x1="150" y1="126" x2="150" y2="112"/>
        <line x1="164" y1="126" x2="164" y2="102"/>
        <line x1="178" y1="126" x2="178" y2="92"/>
      </g>
    </svg>`;
  return `
    <svg viewBox="0 0 200 160" fill="none" aria-hidden="true">
      <rect x="46" y="34" width="108" height="92" rx="16" stroke="currentColor" stroke-width="3" fill="color-mix(in srgb, currentColor 12%, transparent)"/>
      <path d="M70 80 l18 18 l40 -44" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

const shelf = document.getElementById("shelf");

PROJECTS.forEach((p) => {
  const accent = ACCENTS[p.accent] || p.accent || "var(--a-lexivo)";
  const chips = (p.features || []).map((f) => `<span class="chip">${f}</span>`).join("");
  const stack = (p.stack || []).map((s) => `<span>${s}</span>`).join("");
  const links = (p.links || [])
    .map((l, i) => `<a class="btn ${i === 0 ? "" : "ghost"}" href="${l.href}" target="_blank" rel="noopener">${l.label}</a>`)
    .join("");
  const spec = p.spec
    ? `<details class="spec"><summary>Full spec</summary><div class="spec-inner">${p.spec}</div></details>`
    : "";
  const note = p.note ? `<p class="tagline dim">${p.note}</p>` : "";

  shelf.appendChild(
    el(`
    <article class="card reveal" style="--accent:${accent}">
      <div class="card-art">${artSVG(p.art)}</div>
      <div class="card-body">
        <p class="kicker">
          <span class="badge">${p.kind}</span>
          <span class="status">${p.status}</span>
        </p>
        <h3>${p.name}</h3>
        <p class="tagline">${p.tagline}</p>
        ${note}
        <div class="chips">${chips}</div>
        <p class="stack">${stack}</p>
        ${links ? `<div class="actions">${links}</div>` : ""}
        ${spec}
      </div>
    </article>`)
  );
});

shelf.appendChild(
  el(`
  <div class="add-card reveal">
    <h3>+ Next project</h3>
    <p>Add an object to the <code>PROJECTS</code> array in <code>script.js</code>. Pick an <code>accent</code> and an <code>art</code> mark (<code>cards</code>, <code>gauge</code>, <code>amrap</code>, or leave it out) and the card renders itself.</p>
  </div>`)
);

document.getElementById("projCount").textContent = PROJECTS.length;
document.getElementById("year").textContent = new Date().getFullYear();

/* ---------- reveal on scroll ---------- */
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    });
  },
  { threshold: 0.14 }
);
document.querySelectorAll(".reveal").forEach((n) => io.observe(n));

/* ---------- rotating "now" word ---------- */
const WORDS = ["band scores", "learning words", "getting to Cindy", "whatever's next"];
const nowWord = document.getElementById("nowWord");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!reduce && nowWord) {
  let i = 0;
  setInterval(() => {
    i = (i + 1) % WORDS.length;
    nowWord.style.opacity = "0";
    setTimeout(() => {
      nowWord.textContent = WORDS[i];
      nowWord.style.opacity = "1";
    }, 350);
  }, 2600);
}

/* ---------- theme toggle: auto -> light -> dark -> auto ---------- */
const KEY = "lexivo-projects-theme";
const btn = document.getElementById("themeBtn");
const order = ["auto", "light", "dark"];
let cur = "auto";
try {
  const s = localStorage.getItem(KEY);
  if (s && order.includes(s)) cur = s;
} catch (e) {}

function applyTheme(mode) {
  if (mode === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", mode);
  if (btn) btn.textContent = "theme: " + mode;
  try {
    localStorage.setItem(KEY, mode);
  } catch (e) {}
}
applyTheme(cur);
if (btn) {
  btn.addEventListener("click", () => {
    cur = order[(order.indexOf(cur) + 1) % order.length];
    applyTheme(cur);
  });
}
