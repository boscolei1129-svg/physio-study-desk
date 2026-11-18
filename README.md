# Physio Study Desk

A personal, browser-based study companion for the **2027 Adelaide University Bachelor of Physiotherapy (Honours), HPHYS**. Opens on Year 1, Semester 1. Independent and unofficial.

Built in the chosen Study Desk direction: warm paper, forest green, a quiet daily dashboard, responsive layouts and keyboard-accessible controls.

## Study tools

- Spaced recall with due dates, an adjustable daily new-card limit, interleaved subjects and honest Again/Hard/Good/Easy ratings.
- Shuffled multiple-choice quizzes, immediate explanations, source links and a mistake log with editable reflections and retesting.
- Original starting notes with active-recall prompts; personal Cornell-style notes and custom flashcards.
- Three fictional discussion and reasoning stations with self-checklists and saved reflections.
- Focus timer, personal study tasks, progress summaries, JSON backup export/import and offline caching.
- Four-year course map with both honours streams. Each pathway totals 192 units; every semester is 24 units.

## Coverage and research

The library has **251 recall cards**, **207 multiple-choice questions** (a subset of the same cards), **50 study notes**, **3 discussion stations** and **67 source records**. Anatomy 100 now includes 165 cards, 142 quiz questions and 26 notes adapted from the user's uploaded 30-page PDF. Its six learning outcomes can be selected separately for recall, quizzes and notes, with original PDF page references and verification links for important clarifications. Original seed IDs are preserved, so existing schedules remain valid.

The original PDF, extracted text and illustrations are not bundled or uploaded to the public app. Uploaded-source records show the filename and page number rather than a broken web link. The rest of Year 1 remains a selective starting library; Years 2–4 are a roadmap with official course links and space for personal notes/cards. None of these packs is an official examination bank or a complete assessed syllabus.

See [RESEARCH.md](RESEARCH.md) for scope, course mapping, access limits and attribution. The app's Source library links each item to the university, open textbook, professional or community-led source. University assessment instructions and your enrolled course outline take priority.

## Use and storage

Open the published GitHub Pages app. No login is needed. Study records are kept in **this browser's localStorage**, not in the GitHub repository. They are not synchronised across devices. Use **Settings & backup → Export backup** regularly. Import that file on another device to transfer the data; import replaces the destination's existing records after confirmation.

The app makes no analytics or AI API calls and needs no secrets. External links open source websites. Keep patient information and identifiable placement details out of personal notes. Browser profiles and private browsing have separate storage. Clearing site data can remove records.

Offline study works after a successful online load in a service-worker-capable browser. External readings require a connection. The focus timer survives route changes and accounts for background tab throttling, but resets on full page reload.

## Development

Requires Node.js 20+; there are no runtime dependencies or build step.

```sh
npm start
npm test
npm run check
```

Preview: `http://127.0.0.1:4173`. Opening `index.html` as a file is not supported because the app uses ES modules and service workers.

## GitHub Pages

Publish **main / (root)** in repository Settings → Pages → Deploy from a branch. All asset URLs are relative, so project Pages subpaths work. `.nojekyll` preserves the static files without processing.

To update, edit the app files, run the checks and commit to main. For substantial cache changes, bump the service-worker cache version. Do not commit personal backups, credentials or unrelated workspace files.

## Scheduler

Again: 10 minutes and resets consecutive successes. First Hard/Good: 1 day. First Easy: 4 days. Subsequent Hard/Good/Easy: previous interval ×1.2/2.5/3.3 with minimum increases and a 365-day cap. Quiz results affect mistakes and quiz history, not card due dates. Practice mode does not record ratings. This is a simple custom scheduler, not FSRS or a validated mastery model.
