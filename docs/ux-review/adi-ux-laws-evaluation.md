# Adi — End-to-End UX Evaluation Against the 20 UX Laws

**Subject:** `kgudipati/adi` @ `main` (commit at time of review)
**Method:** static review of the codebase + live browser walkthrough of a running instance
**Lens:** the vocal, non-technical user — someone who talks in outcomes ("I want to open a bakery"), not in systems
**Date:** 2026-09-05

---

## 1. Method

Adi was installed and run locally (`pnpm install`, `pnpm adi:init` → 75 migrations, `pnpm dev`).
It was then driven with a headless Chromium session across every top-level route, at three
viewports (1440 / 1024 / 390), in light and dark, with computed styles and network traces captured.

Because no AI provider key was available, a realistic project was seeded through Adi's own public
API (`POST /api/projects`, `POST /api/projects/:id/workstreams`) so that populated screens — not just
empty states — could be judged:

> **Project:** Neighborhood Bakery — "Open a small bakery on Oak Street by spring"
> **Workstreams:** "Find and lease a storefront", "Build the opening menu"
> **Tasks:** 7 across the two workstreams

19 screenshots are in `./screenshots/`. Every finding below cites either a screenshot, a
`file:line`, or a measured value. Claims that could not be verified are marked as such.

### A note on the source list

The list of 20 in the reference image has **"Postel's law" at both #16 and #17** — a transcription
duplicate. Item #8, "Minimize target distance", is also a corollary of Fitts's Law rather than a
separate law. This review covers all 19 distinct laws from the list and adds **Aesthetic-Usability
Effect** and **Law of Common Region** (the two canonical Laws-of-UX entries most likely intended by
the duplicated slot), for 21 total.

---

## 2. The laws, in one line each

| # | Law | What it says |
|---|-----|--------------|
| 1 | Hick's Law | More options → longer decisions. |
| 2 | Fitts's Law | Time to hit a target scales with distance and inversely with size. |
| 3 | Jakob's Law | Users expect your product to work like the others they already use. |
| 4 | Law of Proximity | Things placed near each other are perceived as related. |
| 5 | Miller's Law | Working memory holds ~7 (±2) chunks; chunk your content. |
| 6 | Doherty Threshold | Below ~400ms response, attention holds and productivity jumps. |
| 7 | Von Restorff Effect | The item that differs is the one remembered. |
| 8 | Minimize target distance | (Fitts corollary) Put related controls where the pointer already is. |
| 9 | Serial Position Effect | First and last items are best recalled; the middle sags. |
| 10 | Peak-End Rule | An experience is remembered by its most intense moment and its ending. |
| 11 | Zeigarnik Effect | Unfinished tasks are remembered — and nag — more than finished ones. |
| 12 | Law of Prägnanz | People read complex images in the simplest form available. |
| 13 | Law of Similarity | Elements that look alike are perceived as the same kind of thing. |
| 14 | Uniform Connectedness | Visually connected elements are perceived as more related than merely nearby ones. |
| 15 | Tesler's Law | Every system has irreducible complexity — the only question is who absorbs it. |
| 16 | Postel's Law | Be liberal in what you accept, conservative in what you emit. |
| 17 | Aesthetic-Usability Effect | Beautiful designs are perceived as more usable — and forgiven more. |
| 18 | Parkinson's Law | Work expands to fill the time available. |
| 19 | Occam's Razor | Remove elements until nothing can be removed without breaking it. |
| 20 | Pareto Principle | ~80% of effects come from ~20% of causes. |
| 21 | Law of Common Region | A shared boundary groups elements, even across distance. |

Sources: [Laws of UX](https://lawsofux.com/), [UX Design Institute — 21 laws](https://www.uxdesigninstitute.com/blog/laws-of-ux/), [UXtweak](https://blog.uxtweak.com/ux-laws-and-principles/)

---

## 3. Scorecard

| Law | Grade | One-line verdict |
|---|:---:|---|
| Hick's Law | **C** | Welcome is exemplary; Home offers 8 competing ways to start. |
| Fitts's Law | **C+** | Targets are small-but-workable; "Save Changes" sits ~600px from the last field. |
| Jakob's Law | **D+** | Icon-only nav, Mac-only ⌘ glyphs on every platform, empty "Overview" tab. |
| Law of Proximity | **B** | Settings and board group well; save-action and Home's duplicate rail are the misses. |
| Miller's Law | **A-** | Genuinely well chunked everywhere. |
| Doherty Threshold | **C** | 880ms tab loads behind bare "Loading tasks…"; multi-second AI calls with no progress. |
| Von Restorff Effect | **D** | **The primary CTA renders at 2.46:1 contrast and reads as disabled.** |
| Minimize target distance | **C+** | Long pointer trips between the left dock and right-side actions. |
| Serial Position Effect | **C** | Project page's first tab shows "Nothing is running right now." |
| Peak-End Rule | **C-** | A designed peak exists (CommitmentReveal); endings are flat, and first-run ends in a red toast. |
| Zeigarnik Effect | **B-** | Excellent "pick up where you left off" framing, but zero progress quantification. |
| Law of Prägnanz | **C+** | Visually calm and simple; conceptually 6 nested abstractions deep. |
| Law of Similarity | **B-** | Consistent patterns, two concrete breaks (Bio field, split button system). |
| Uniform Connectedness | **B+** | Strong card/section containment; chips clip their container in the Adi rail. |
| Tesler's Law | **D+** | Irreducible complexity is handed to the user, not absorbed. |
| Postel's Law | **D** | Liberal on input, raw on output: `No API key for provider: google`. |
| Aesthetic-Usability | **A-** | Restrained, credible, calm — its greatest asset (and its best camouflage). |
| Parkinson's Law | **D** | No dates, estimates, or time-boxes anywhere on work objects. |
| Occam's Razor | **C** | Redundant entry points; ⌘K means two different things behind a flag. |
| Pareto Principle | **C-** | Deep investment in expert surfaces; the vital 20% path is broken on first run. |
| Law of Common Region | **A-** | Consistent, well-used bounded regions. |

**Overall: C.** Adi is a thoughtfully-designed product with an unusually strong point of view —
and a first-run experience that a non-technical user cannot get through.

---

## 4. The five defects that matter most

These are concrete, reproducible, and cheap to fix. They are ordered by damage done.

### D1 — The primary call-to-action across the whole app fails contrast and looks disabled

`src/components/welcome/WelcomeIntentScreen.tsx:127` styles the Continue button
`text-adiPrimaryForeground bg-adiPrimary`. **`adiPrimaryForeground` is not defined in
`tailwind.config.js`** — the config defines `adiPrimary` (line 336) and `adiOnPrimary` (line 353),
but never `adiPrimaryForeground`. Tailwind emits no rule, so the label inherits the ambient text
colour.

Measured in the browser:

```
Welcome "Continue"        color rgb(34,36,42)  on  bg rgb(49,95,168)   → 2.46:1
Home "Answer"             color rgb(34,36,42)  on  bg rgb(49,95,168)   → 2.46:1
Home "Open <project>"     color rgb(34,36,42)  on  bg rgb(49,95,168)   → 2.46:1
```

WCAG AA requires 4.5:1 for normal text and 3:1 for large text. **All three fail both.**

The token is used in **9 components / 11 call sites** — Welcome, Home intent, Home orientation,
Home catch-up, the workstream Composer (×3), the Adi composer, the diagnostic dialog, the
crystallization canvas, and the auth form. That is very nearly every primary action a new user
touches.

The user-visible consequence is worse than the contrast number: near-black text on a mid-blue fill
reads as a *disabled* button. In the Welcome screenshot the enabled Continue button is
indistinguishable from a greyed-out one. **The single most important button in the product looks
switched off.** (Von Restorff, Aesthetic-Usability, and basic accessibility, all at once.)

> Fix: replace `adiPrimaryForeground` with `adiOnPrimary` in all 11 call sites, or define the token.
> Then add a CI guard that fails on Tailwind classes referencing undefined theme keys — this class
> of bug is silent by construction.

**Evidence:** `screenshots/welcome.png`, `screenshots/err-welcome-nokey.png`, `screenshots/home.png`

### D2 — First run dead-ends on a raw developer error

A new user types "I want to open a small bakery in my neighborhood", presses Continue, waits ~8
seconds with no progress indication, and receives a red toast:

> **Could not propose a project**
> `No API key for provider: google`

There is no explanation, no remedy, no link, no retry. The user does not know what an API key is,
which provider they have, or that Settings → ADI behavior contains a field
(`src/components/settings/ai-models-section.tsx:142`) that would fix it.

This is the **peak and the end** of the first session, and it is a failure. It is also the clearest
Postel's Law violation in the product: maximally liberal on input (free text, fragments welcome),
maximally raw on output (the provider's internal error string, verbatim).

> Fix, in order of value:
> 1. **Pre-flight the key before the input is even offered.** If no provider is configured, Welcome
>    should open on "First, connect a brain for Adi" with the provider picker inline and a
>    one-sentence explanation — not fail after the user has already committed an intention.
> 2. Never surface provider error strings. Map to: *"Adi isn't connected to an AI provider yet.
>    [Connect one →]"* with the button routing to the models section.
> 3. Preserve the typed intent across the fix so the user resumes rather than restarts.

**Evidence:** `screenshots/err-welcome-nokey.png`

### D3 — A project's default tab shows nothing about the project

Opening the seeded project — 2 workstreams, 7 tasks, acceptance criteria, key steps — lands on the
**Overview** tab, which renders exactly one line:

> Nothing is running right now.

The actual work is one tab over, under **Work**, and even there only **one workstream is visible at
a time** behind a dropdown. There is no view anywhere that shows the project's whole shape.

This is a Serial Position failure (the strongest recall position is spent on an absence), a Jakob's
Law failure (every project tool the user has met — Notion, Asana, Trello, Linear — shows the
project's contents on open), and a Zeigarnik failure (the unfinished work that should be pulling
the user forward is hidden).

For a non-technical user the message received is *"nothing happened / this is broken"*, which is
the opposite of the truth.

> Fix: make Overview show the project — workstreams with progress, what's next, what's blocked,
> recent activity — and reserve "Nothing is running right now" for a small live-status line rather
> than the entire page. Show all workstreams as a list, not one-at-a-time behind a picker.

**Evidence:** `screenshots/pop-project.png` vs `screenshots/pop-project-work-waited.png`

### D4 — Mac-only keyboard glyphs on every platform

`⌘` is hardcoded in **52 places across 24 files** with **zero platform detection for display**.
Key *handling* is correct everywhere (`e.metaKey || e.ctrlKey` — 9 call sites), so the shortcuts
work; only the labels lie.

A Windows or Linux user reads "⌘↵ to send", "⌘K for commands", "⌘J", "⌘F" and sees instructions
for a keyboard they do not own. Adi's own README ships a Linux install path, so this is not a
theoretical audience.

> Fix: one `useModifierKey()` hook returning `⌘`/`Ctrl` from `navigator.platform`, applied to all 52
> sites. Half a day of work.

**Evidence:** `screenshots/home.png` ("⌘↵ to send · ⌘K for commands"), `screenshots/welcome.png`

### D5 — Deprecated vocabulary is still on screen, and the guard that should catch it has a hole

`DOCTRINE.md` §1 is emphatic: the user-facing word is **Workstream**; "Blueprint" is a deprecated
alias, "enforced by the `vocab-coverage` architecture test and the `no-legacy-vocab` ESLint rule."

`node scripts/vocab-audit.mjs` reports **`vocab-audit: clean.`**

But the Adi panel a first-time user opens with ⌘K says:

> "I can create projects, **generate blueprints**, run tasks, and keep everything connected."
> Chips: **Create a blueprint** · **Run a blueprint** · Generate a spec

Source: `src/components/chat/chat-window.tsx:246`, `:249`, `:323`.

The audit misses them because its pattern is **case-sensitive**:
`regex: /\bBlueprint(s)?\b/g` (`scripts/vocab-audit.mjs:119`) — no `i` flag. Lowercase "blueprint"
in prose sails through, and `src/components/chat/` is not in the allowlist, so these would be caught
if the flag were added.

Related, in the same family: **brand casing is split**. "ADI" appears 152 times and "Adi" 101 times
in user-facing components; the root page title is `Adi` (`src/app/layout.tsx:22`) while child pages
are `— ADI`. Both spellings appear *on the same screen* on `/library`: the header reads "Everything
you and **ADI** can read…" above a card reading "Documents and sources **Adi** can read."

> Fix: add the `i` flag to the audit regex, fix the three chat-window strings, and pick one brand
> casing. The doctrine is right; the enforcement has a typo.

**Evidence:** `screenshots/ui-command-palette.png`, `screenshots/library.png`

---

## 5. Law-by-law findings

### 1. Hick's Law — **C**

**Where it works.** `/welcome` is a model of the law: one heading, one input, six suggestion chips,
one of which ("I'm not sure where to start") is an explicit escape hatch for the undecided. Settings
chunks 9 sections each with a one-line description, so the user chooses a *category* before facing
controls. Library reduces the whole surface to 4 tiles.

**Where it breaks.** `/home`, once populated, offers **eight** ways to begin the same journey:
the free-text input, four chips (Start a new workstream / Continue *Build the opening menu* /
Browse projects / Open inbox), an "Open Neighborhood Bakery" primary button in the right card,
two "Continue where you left off" cards, and a "Recent projects" list — plus ⌘K and ⌘J opening two
further command surfaces on top. Several of these are literally the same destination.

The right-hand "Ready to continue" card is the sharpest example: it restates in prose what the chip
row already offers, then adds a ninth button.

> Fix: pick one primary path (the input), demote the chips to two, and let the right card be a
> *status* card rather than a second navigation system.

### 2. Fitts's Law — **C+**

Dock icons measure 36–40px — under the 44px touch guideline but defensible for a
declared desktop-only product. The workstream composer's Send button is 36×36px.

The clearest violation is in Settings → You: **"Save Changes" sits at the top-right of the Profile
card while the last field (Bio) is ~600px below it**, so completing the form requires a full-height
pointer trip back up. The button is also outside the visual region containing the fields it saves.

> Fix: sticky save bar at the bottom of the form, or save-on-blur with an undo toast.

### 3. Jakob's Law — **D+**

Four distinct breaks with learned convention:

1. **Icon-only navigation with no persistent labels.** `src/components/layout/sidebar.tsx:30`
   documents the choice: *"Replaces the labeled sidebar with a vertical icon dock."* Eight
   unlabeled glyphs (home, cubes, books, tray, pulse, magnifier, ⌘, gear). Labels exist only on
   hover — and hovering the Library icon opens a **4-item flyout menu**, not a tooltip, so
   discovery costs a hover *and* a read. Notion, Linear, Asana, Slack and Monday all ship labeled
   nav. This is a recognition-vs-recall tax paid on every session, and it is heaviest for exactly
   the non-technical user this review is scoped to.
2. **⌘ glyphs on all platforms** (D4).
3. **Empty "Overview" tab** (D3).
4. **Brand casing** (D5).

> Fix: label the dock (icon + text, ~180px rail) or at minimum ship persistent labels for
> first-N-sessions and let power users collapse it. This is the highest-leverage single change for
> the target user.

### 4. Law of Proximity — **B**

Strong: Settings pairs each label with its description and control in a tight group; board columns
bind tasks to a status; workstream header binds title, status chip and description.

Weak: the Save/field separation above, and Home's right card duplicating the chip row's function at
the far side of the screen.

### 5. Miller's Law — **A-**

Genuinely good. The dock's 8 items are broken by separators into 3 groups (5 / 2 / 1). Settings is
9 sections, never all-controls-at-once. The board is 4 columns. Welcome is 6 chips. Library is 4
tiles. Nothing in the product asks the user to hold more than ~5 things at a time.

### 6. Doherty Threshold — **C**

Measured, warm, dev server: switching to the Work tab takes **~880ms** to first task content
(two runs: 896ms, 868ms). *(An earlier 3s reading was Next.js dev-mode cold compilation, not
product latency — noted so the number isn't over-claimed. Production figures were not measured.)*

880ms is over Doherty's 400ms, and it is covered by a bare centred text string **"Loading tasks…"**
rather than a skeleton of the board that's coming. The codebase has a `Skeleton` component used in
14 files, but 9 sites still render bare `Loading…` text
(`scope-level-picker.tsx:315`, `scope-picker-popover.tsx:370`, `InboxDockMenu.tsx:203`,
`trust-grants-section.tsx:95`, and others).

The bigger issue is the AI path: `/api/welcome/propose-project` took **~8 seconds** before
returning, during which the UI showed only a dimmed textarea — no progress, no streaming, no
"thinking" state, no cancel. For an operation the product's own positioning says is important, that
is a long silence.

To the product's credit, `DOCTRINE.md` §6 and §11 are explicitly about this — realtime push as the
floor of latency, polling only as fallback, and a `realtime-health.ts` monitor that surfaces when
polling is silently masking gateway regressions. The architecture is right; the perceived-latency
layer on top of it is thin.

> Fix: skeletons everywhere `Loading…` appears now; stream the proposal as it generates; add an
> indeterminate progress affordance with a cancel for any call over ~1s.

### 7. Von Restorff Effect — **D**

See **D1**. The design system has a correct, well-built primary variant
(`src/components/ui/button.tsx`: `bg-adiPrimary text-adiOnPrimary`), but the highest-traffic
buttons bypass it with hand-rolled classes carrying an undefined token. The result is that the one
element that most needs to stand out — the primary action — is the one that recedes.

Secondary observation: on the seeded Home, "IDLE" status chips are rendered in the same muted
treatment as timestamps, so nothing on the screen visually claims priority. "Needs your attention"
— the thing the whole Inbox/Leverage architecture exists to surface (`DOCTRINE.md` §10) — is
styled identically to every other section header.

### 8. Minimize target distance — **C+**

Navigation lives at the far left; primary actions live centre and right; the composer sits at the
bottom with its send control at the right edge. A single "start work on this" gesture can cross the
full 1440px viewport. Board columns invite drag-and-drop across four columns — a long,
error-prone drag — although the empty-state copy says tasks "will be automatically processed"
anyway, which raises the question of whether the drag is needed at all (see Occam's Razor).

### 9. Serial Position Effect — **C**

The dock gets this right: Home first, Settings last.

The project page gets it exactly wrong (**D3**): the primacy slot holds "Nothing is running right
now."

Home is middling — "Needs your attention", arguably the most important region, sits third of five,
in the recall trough, below the fold-adjacent "Continue where you left off".

### 10. Peak-End Rule — **C-**

Adi *has* a designed peak, and it is a good one: `CommitmentReveal.tsx`, paced by animation
completion rather than a fixed timer, with reduced-motion respected — and `DOCTRINE.md` §8 plus a
`no-fixed-celebration-timeouts` ESLint rule to keep it that way. That is more care than most
products take.

But it is the *only* designed moment. Beyond it:

- Completing a task moves a card to a **DONE** column whose empty state reads
  *"Drag and drop tasks here or they will be automatically processed."* — a completion state
  described in the language of a to-do queue.
- There is no workstream-completion moment, no summary of what was accomplished, no artifact
  hand-off.
- For a user without a provider key, the entire first session **ends on a red error toast** (D2).

The peak-end rule is where the "positive reinforcing experience" the brief asks for is won or lost,
and it is currently the thinnest layer in the product.

> Fix: a completion moment at workstream close — what you set out to do, what Adi did, what you
> have now. This is also the natural home for the trust-calibration data the product already
> collects.

### 11. Zeigarnik Effect — **B-**

The *framing* is excellent and clearly deliberate: "Continue where you left off", "Picking up where
you left off", "Needs your attention", "Ready to continue", an Inbox built specifically for
"decisions ADI is waiting on". This is a product that understands open loops.

What's missing is **quantification**. A workstream card shows a name, a description, "IDLE" and a
relative timestamp — but never *how far along it is*. There is no "3 of 7 tasks", no percentage, no
progress bar. A `Progress` component exists and is used in `activity-mode.tsx` and
`blueprint-details/`, but not on the cards the user actually sees on Home or in the workstream
header.

Zeigarnik works on *partially* complete things. Without a completion fraction, an idle workstream
reads as abandoned rather than in-progress.

> Fix: put a task-completion fraction and a thin progress bar on every workstream card and header.
> Cheapest high-impact motivational change available.

### 12. Law of Prägnanz — **C+**

Visually, Adi is simple and calm — generous whitespace, one accent colour, restrained type. The eye
resolves each screen easily.

Conceptually it is not simple. To use the product as designed the user must hold:

**Project → Workstream → Task → Run → Sub-agent → Checkpoint → Capsule → Provenance**

Eight nested abstractions, several of which surface directly in UI copy. `/sub-agents` describes
itself as *"the run inspector with provenance, capsules, and steering controls"* and offers a
filter field labelled **"Optional project UUID"**. Jargon counts in `src/components`:
`provenance` 58, `capsule` 72, `HITL` 83, `runtime` 39, `sub-agent` 20.

For a bakery owner, the simplest available interpretation of that vocabulary is "this software is
not for me."

> Fix: this is a progressive-disclosure problem, not a rename problem. A "simple mode" that exposes
> only Project → Workstream → Task, with runs/provenance/capsules available but never volunteered,
> would let one product serve both audiences.

### 13. Law of Similarity — **B-**

Consistent card, chip, section-header and status-label patterns throughout — the product reads as
one system.

Two concrete breaks:

1. **The Bio textarea in Settings is styled unlike every sibling field.** Measured computed
   backgrounds on `/settings`: all seven `input` elements are `rgb(253,252,249)`; the Bio
   `textarea` is **`rgb(200,200,196)`** — a mid-grey fill that reads as disabled next to seven
   off-white ones.
2. **Two parallel button systems** — the correct `Button` component and hand-rolled primary
   buttons carrying the broken token (D1) — so "primary action" has two different appearances.

**Evidence:** `screenshots/settings.png`

### 14. Uniform Connectedness — **B+**

Well handled: cards, bordered settings groups, board columns and the dock are all single connected
regions, and relatedness is communicated by containment rather than mere adjacency.

One defect: in the ⌘K Adi rail, the suggestion chips **overflow the panel's right edge and clip
mid-word** — "Show project statu[s]", "What needs my ap[proval]". A connected region that visibly
fails to contain its contents undermines exactly the grouping cue it's providing.

**Evidence:** `screenshots/ui-command-palette.png`

### 15. Tesler's Law — **D+**

The question Tesler asks is *who absorbs the irreducible complexity*. In Adi today, it is the user:

- **Provider keys.** The user must know what an AI provider is, obtain a key, and paste it — and
  discovers this only by hitting an error (D2).
- **Expert surfaces are not gated.** `/sub-agents` asks for a project UUID and speaks of
  provenance and capsules. `/library/tools` and `/library/connections` both silently redirect to
  `/library/plugins` (feature flags off), so two nav destinations quietly go somewhere else.
- **Knowledge ships pre-loaded with 67 internal engineering documents** — `tool-usage-order.md`,
  `task-splitting-rules.md`, `output-contracts.md`, `lifecycle-state-model.md`,
  `hitl-and-approval-rules.md`, `invariants.md`. A first-time user opening Knowledge sees Adi's own
  implementation notes, with file extensions, presented as *their* library.

Each of these is complexity the system could absorb and currently doesn't.

**Evidence:** `screenshots/knowledge.png`, `screenshots/sub-agents.png`, `screenshots/library.png`

### 16. Postel's Law — **D**

**Liberal on input: excellent.** Free-text intent, six starter chips, an "I'm not sure where to
start" path, and a diagnostic that explicitly says *"None of them need a complete answer — fragments
are fine."* That last screen is the best copy in the product.

**Conservative on output: failing.** The provider error is emitted raw (D2). Beyond it:

- `/projects` with zero projects **silently redirects to `/welcome`** with no explanation of why
  the destination changed.
- The workstream page says *"Start a run, review the board, or inspect the latest outputs."* while
  offering **no button for any of those three actions** — only an "Open details" link. It names
  three affordances that aren't there.

**Evidence:** `screenshots/pop-workstream.png`, `screenshots/flow-diagnostic.png`

### 17. Aesthetic-Usability Effect — **A-**

Adi's strongest asset. The warm off-white ground, single blue accent, restrained type and generous
spacing produce something that looks considered and trustworthy — and for a product asking users to
delegate weeks of work, perceived trustworthiness *is* function. Dark mode is implemented and
coherent.

The caution that comes with this law: aesthetic quality this high will suppress usability
complaints in testing. Users will blame themselves for the icon-only nav and the empty Overview tab
rather than reporting them. Weight observed behaviour over reported satisfaction.

**Evidence:** `screenshots/dark-home.png`, `screenshots/history.png`

### 18. Parkinson's Law — **D**

Adi's positioning is explicitly unbounded: *"long-running projects — things that take days, weeks,
or months to finish, not minutes."* Nothing in the UI provides a counterweight:

- No due dates, target dates or estimates on tasks, workstreams, or projects.
- No elapsed-time or cycle-time display on work objects.
- No time-boxing anywhere.
- Task cards carry a priority ("Medium") and a relative timestamp — nothing forward-looking.

The one exception is the diagnostic's *"What would 'better' look like in two weeks?"* — a good
instinct that is then discarded, since the answer becomes prose rather than a date on the work.

For a non-technical user with a real-world deadline ("open by spring"), a system that never asks
when is a system that will drift.

> Fix: capture the target date at project creation (the bakery owner said "by spring" in their
> first sentence — parse it), show time-remaining on the project header, and let workstreams
> inherit and display a due horizon.

### 19. Occam's Razor — **C**

Removable without loss:

- **The redundant Home entry points** (Hick's, above) — the right-hand card is a second navigation
  system for destinations already one chip away.
- **Two command surfaces on one shortcut.** `sidebar.tsx:124` binds ⌘K to *either*
  `openCommandPalette()` *or* `startAdiDraft()` depending on the `ff_adi_layer_v1` flag. The same
  keystroke means two different things depending on configuration, and both surfaces overlap in
  purpose.
- **Dead nav entries.** `/library/tools` and `/library/connections` both redirect to
  `/library/plugins`.
- **Contradictory board copy.** *"Drag and drop tasks here or they will be automatically
  processed"* on all three non-TODO columns — including **DONE**, where it makes no sense. If
  processing is automatic, the drag affordance may be removable entirely.

### 20. Pareto Principle — **C-**

The vital 20% for this product is unambiguous: **describe an outcome in plain language → get a
credible plan → watch it progress**. That path is currently broken at step one for any user without
a pre-configured provider key (D2), and step three is hidden behind a tab and a dropdown (D3).

Meanwhile, substantial surface exists for the rare 80%: sub-agent run inspection, provenance
ledgers with signing keys, capsule lineage, skills compilation, calibration-outcome telemetry, a
presentation plane. These are real engineering assets — the trust-calibration system
(`DOCTRINE.md` §4) in particular is a genuinely differentiated idea — but the effort ratio is
inverted relative to what a first-time non-technical user needs.

> Fix: the top-five defects in §4 are, collectively, days of work and they *are* the vital 20%.

### 21. Law of Common Region — **A-**

Consistently and correctly applied. Cards, settings groups, board columns and the dock all use
shared boundaries to communicate grouping, and the boundaries are drawn at the right level of
emphasis (subtle borders, not heavy chrome). No significant issues beyond the chip-clipping noted
under Uniform Connectedness.

---

## 6. Cross-cutting gaps for vocal, non-technical users

Beyond the individual laws, five themes recur.

**1. The product speaks two languages and hasn't finished translating.**
`DOCTRINE.md` §1 correctly identifies that users think in *workstreams*, not blueprints — but the
translation is incomplete (D5), and the deeper layer (runs, provenance, capsules, HITL, sub-agents,
UUIDs) has no user-facing translation at all. A bakery owner needs "Adi is working on it", not
"spawn a run".

**2. Nothing tells the user how far along anything is.**
No progress fractions, no percentages, no dates, no estimates (Zeigarnik + Parkinson). The user
cannot answer "are we on track?" — the single question a non-technical user cares about most.

**3. Recognition has been traded for recall throughout.**
Icon-only nav, hover-to-discover menus, keyboard-shortcut-forward affordances (⌘K, ⌘J, ⌘F, ⌘↵), and
Mac-only glyphs. Every one of these favours the returning power user over the occasional
non-technical one.

**4. Failure is louder than success.**
The product has one designed celebration and several raw error paths. For a user being asked to
trust software with weeks of their work, the reinforcement ratio is backwards.

**5. Mobile is out of scope, and the doctrine disagrees with itself.**
At 390px the app shows a blocking modal — *"ADI is best on desktop… tuned for screens 1024px and
wider"* with a "Continue anyway" escape. That's an honest, well-executed degradation, and
`docs/decisions/0003-desktop-only.md` is cited in `sidebar.tsx:43`. But `DOCTRINE.md` §7 states the
explainability rail *"must be reachable on every breakpoint"* and specifies a mobile slide-up
sheet. Those two commitments cannot both be true. Worth resolving explicitly — and worth noting
that non-technical users skew mobile-first.

**Evidence:** `screenshots/resp-390.png`

---

## 7. Prioritized recommendations

### P0 — Do these first (days, not weeks)

| # | Change | Laws addressed |
|---|---|---|
| 1 | Fix `adiPrimaryForeground` → `adiOnPrimary` across 11 call sites; add a CI guard for undefined Tailwind tokens | Von Restorff, Aesthetic-Usability, a11y |
| 2 | Pre-flight the provider key in Welcome; never surface raw provider errors; preserve typed intent through the fix | Postel, Peak-End, Tesler, Pareto |
| 3 | Make project **Overview** show the project — all workstreams, progress, what's next | Serial Position, Jakob, Zeigarnik |
| 4 | Add progress fractions + bars to every workstream card and header | Zeigarnik, Von Restorff |
| 5 | Label the left dock (or persist labels for first N sessions) | Jakob, Hick, recognition-over-recall |

### P1 — Next (weeks)

| # | Change | Laws addressed |
|---|---|---|
| 6 | `useModifierKey()` hook; replace all 52 hardcoded `⌘` labels | Jakob |
| 7 | Add the `i` flag to `vocab-audit.mjs:119`; fix `chat-window.tsx:246/249/323`; settle brand casing | Jakob, Similarity |
| 8 | Design a workstream-completion moment (what you asked for → what Adi did → what you have) | Peak-End |
| 9 | Capture a target date at project creation; show time-remaining on headers | Parkinson |
| 10 | Skeletons for the 9 bare `Loading…` sites; stream the project proposal; cancel affordance >1s | Doherty |
| 11 | Reduce Home to one primary path; make the right card status-only | Hick, Occam |
| 12 | Stop seeding user Knowledge with Adi's 67 internal engineering docs | Tesler, Prägnanz |

### P2 — Then (a release)

| # | Change | Laws addressed |
|---|---|---|
| 13 | "Simple mode": expose Project → Workstream → Task only; gate runs/provenance/capsules behind an expert toggle | Prägnanz, Tesler, Pareto |
| 14 | Resolve ⌘K's double meaning; retire the dead `/library/tools` and `/library/connections` routes | Occam |
| 15 | Fix Bio field styling; unify the two button systems | Similarity |
| 16 | Fix chip clipping in the Adi rail; sticky save bar in Settings | Uniform Connectedness, Fitts |
| 17 | Resolve the DOCTRINE §7 / desktop-only contradiction and decide the mobile story | — |

---

## 8. What Adi already gets right

It would misrepresent the product to end on the defect list. The following are genuinely
above-average and should be protected through any redesign:

- **`/welcome` and the diagnostic dialog.** One decision per screen, an explicit path for the
  undecided, and copy that lowers the stakes (*"fragments are fine"*, *"You decide later"*). This
  is the best-designed part of the product and it is designed for exactly the non-technical user in
  question.
- **Empty states.** Nearly every one explains what will appear and why — *"Activity appears here as
  ADI works. Start a project and the timeline fills in automatically."* Most products ship blank
  screens here.
- **The trust-calibration system** (`DOCTRINE.md` §4). Grading every output `first_pass` →
  `verified`, with the explicit observation that *uniform confidence across cards is itself a trust
  failure mode*, is a genuinely differentiated idea and the right foundation for non-technical
  trust.
- **Completion-driven celebration** (§8) and the ESLint rule enforcing it. Pacing on animation
  completion rather than a fixed timer, with reduced-motion respected, is a level of care most
  teams skip.
- **Doctrine-as-tests** (§12). Every architectural commitment is backed by a lint rule,
  architecture test, or deprecation date. The D5 finding is not a failure of this approach — it's
  a one-character bug in one regex, and the approach is why it's findable at all.
- **The visual system.** Calm, consistent, credible, and coherent in dark mode.

The gap between Adi's design thinking and its current execution is narrower than the C grade
suggests. Most of what's wrong is a small number of concrete, cheap defects sitting directly on the
first-run path — which is also why fixing them would move the grade a long way.

---

## Appendix — Screenshot index

| File | Surface |
|---|---|
| `welcome.png` | First run — `/welcome` |
| `flow-diagnostic.png` | "I'm not sure where to start" diagnostic |
| `err-welcome-nokey.png` | First-run failure — raw provider error (D2) |
| `home.png` / `pop-home.png` | Home, empty and populated |
| `pop-project.png` | Project → Overview (D3) |
| `pop-project-work-waited.png` | Project → Work board |
| `pop-workstream.png` | Workstream page |
| `ui-command-palette.png` | ⌘K Adi rail — "blueprint" copy, clipped chips |
| `ui-dock-tooltip.png` | Dock hover flyout |
| `library.png` / `knowledge.png` | Library and Knowledge (internal docs surfaced) |
| `settings.png` | Settings → You (Bio field, save placement) |
| `inbox.png` / `history.png` / `sub-agents.png` | Inbox, History, Sub-agents |
| `resp-1024.png` / `resp-390.png` | Responsive at 1024px and 390px |
| `dark-home.png` | Dark mode |

*Environment: Next.js 14.2.30 dev server, Chromium 1194 headless, viewport 1440×900 unless noted.
Timing figures are dev-mode and warm; production numbers were not measured.*
