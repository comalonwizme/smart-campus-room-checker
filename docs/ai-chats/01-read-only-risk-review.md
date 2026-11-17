# Task #02 — Read-only risk review

Tool: Claude Code 2.1.326 (headless, `claude -p`) · Model: claude-opus-5-5 · Date: 2026-11-17 · Session: e4798507-bd47-4b70-a53f-fcb2bfefbf08  
Repo state: git tag `baseline` (separate worktree) · Allowed tools: Read, Grep, Glob only (no edit, no shell) · Turns: 17

## Prompt

> Act as a cautious software reviewer. Inspect this Smart Campus Room Availability Checker WITHOUT editing files. Identify risks in correctness, security, privacy, reliability, maintainability, and agent operations. For each risk, cite the exact file/function or missing check, explain the impact, suggest a way to verify it, and state uncertainty. Do not invent test results.

## Response (verbatim)

I reviewed every file in the repo and changed nothing. I couldn't run any commands in this session, so I didn't run `npm test`, `npm run build` or `npm audit`. Every "verify" step below is a suggestion that hasn't been run. The only test results I mention are the ones in the committed `evidence/` files, and I haven't confirmed them.

The core rules look correct for well-formed input: the overlap check `start < be && end > bs` is right, and back-to-back bookings are allowed. The main problems are three cases where bad or unusual data quietly produces "available", and a set of time-zone and date-parsing assumptions that the tests never check.

## Correctness

**C1. A malformed booking is skipped silently, so the room shows as free (High)**
- **Where:** `checkAvailability` in `src/lib/availability.ts:71-80`. The stored `bookings` are never validated.
- **Impact:** If a booking's `start` or `end` doesn't parse, both comparisons with `NaN` are `false`, so the overlap check never fires. A booking whose `end <= start` can also never match. Either way the user is told the room is free when it isn't.
- **Verify:** Write a unit test with a booking `{start: 'garbage', end: '2099-01-15T10:00'}` and check a request that should conflict with it. Expect `available: true` today.
- **Uncertainty:** Low for the logic. The current fictional data is valid, so this matters once bookings come from somewhere other than a hand-written file.

**C2. Date parsing is too lenient and differs between browsers (Medium)**
- **Where:** `toDate()` in `availability.ts:26-28` is just `new Date(s)`. Nothing enforces the `YYYY-MM-DDTHH:MM` format described in the comment.
- **Impact:**
  - A date with no time, like `'2099-01-15'`, is read as **UTC**, while a date with a time is read as **local time**. That mismatch can hide or invent overlaps and errors about past times.
  - Strings like `'2099-02-30T10:00'` may roll over to March 2 in V8 but be rejected in Firefox.
  - Strings with a `Z` or a time-zone offset are accepted and mixed with local times.
- **Verify:** Unit tests for a date-only string, an impossible date like Feb 30, and a string ending in `Z`. Run them in Node, and ideally in Firefox and Safari too.
- **Uncertainty:** The per-browser behaviour for Feb 30 is from memory, not tested here. Today the UI's `datetime-local` input only produces well-formed strings, so the risk applies to other callers and to browsers that fall back to a plain text box.

**C3. Results depend on the computer's time zone and daylight saving (Medium)**
- **Where:**
  - The duration calculation in `availability.ts:56`.
  - The past-time check in `availability.ts:51`.
  - The tests use `new Date('2099-01-01T00:00')`, which is local time, and don't set a time zone.
- **Impact:**
  - A booking that crosses a clock change, or starts at a local time that doesn't exist, gets the wrong duration. For example, 01:30 to 03:00 is 30 minutes of real time on the night clocks go forward.
  - A user in a different time zone from the campus gets different answers to "is this in the past?".
  - The time zone in force is never shown to the user.
- **Verify:** Run `TZ=UTC npm test` and `TZ=America/New_York npm test`. Add a test that crosses a clock change.
- **Uncertainty:** Whether this matters depends on whether the product assumes "campus local time". That isn't specified anywhere.

**C4. Bookings aren't tied to a room (Medium, a design trap)**
- **Where:** The `Booking` interface in `availability.ts:7-12` has no `roomId`, and `checkAvailability` treats every booking as belonging to `room`.
- **Impact:** Today there is only one room, so this works. Adding a second room would make bookings in one room block the others, or require every caller to filter correctly.
- **Verify:** Read the code: the function never filters by room.
- **Uncertainty:** None about the code. The impact only appears when the app grows.

**C5. The result stays on screen after the inputs change (Medium, user-facing)**
- **Where:** `App.tsx:37,41`. The `onChange` handlers update `start`/`end` but don't clear `result`.
- **Impact:** A "✅ Room is available" result stays visible after the user edits the times to a slot that conflicts. The user may act on an answer that no longer applies.
- **Verify:** Manually: check a free slot, change it to `2099-01-15T09:30`, and don't submit. The green result is still shown.
- **Uncertainty:** Low.

**C6. The order of checks decides which error the user sees (Low)**
- **Where:** `availability.ts:51-68`. The blocked-room check runs after the past-time and duration checks.
- **Impact:** For a blocked room, the user may fix the duration only to be told the room can't be booked at all.
- **Verify:** Check a blocked room with a 10-minute request. Today it returns `DURATION`.
- **Uncertainty:** The README doesn't define which check comes first, so this may be intended.

**C7. Smaller edge cases (Low)**
- **Picking the current minute:** `start < now` uses milliseconds, but `datetime-local` has whole minutes. Choosing the current minute returns `PAST`.
- **Conflict message drops the date:** it uses `b.start.slice(11)`, which shows times only. That's ambiguous for bookings on other days or spanning several days, and it relies on the exact string format.
- **Uncertainty:** Low.

## Tests

**T1. Tests don't cover the cases most likely to break (Medium)**
- **Where:** `tests/availability.test.ts`.
- **What's missing:**
  - Start equal to end, and malformed strings (AC1).
  - Start exactly equal to `now` (AC2).
  - 29 and 121 minutes (AC3 tests only 20 and 150).
  - Overlap cases: a request that contains a booking, one inside a booking, and an exact match (AC4).
  - Malformed stored bookings (C1).
  - AC7: there are no UI tests and no browser-like test environment configured.
- **AC6 test is weak:** it compares `JSON.stringify` output before and after. Freezing the bookings with `Object.freeze` would catch more.
- **Verify:** Run coverage with `npx vitest run --coverage`. It may need `@vitest/coverage-v8`, which isn't installed. Or add the cases above.
- **Uncertainty:** I expect most of these to pass, since the formula is sound. The gap is in what the tests prove, not necessarily a bug.

## Security

**S1. The check runs only in the browser (Low now, High if it becomes real)**
- **Where:** The whole design; the README says "no login, no database".
- **Impact:** This is fine as a demo. If it ever guards real bookings, anyone can bypass it by changing the code in their browser. The same checks would have to run on a server.
- **Uncertainty:** It depends entirely on future scope.

**S2. Rendering untrusted text (Low)**
- **Where:** `App.tsx:25,49` show `b.title` and the result message as plain text.
- **Impact:** React escapes text, and I found no `dangerouslySetInnerHTML`, so there's no cross-site scripting risk today. The risk would appear if titles ever came from users and were inserted as HTML.
- **Verify:** `grep -r dangerouslySetInnerHTML src`.

**S3. Dependencies (Low, development only)**
- **Where:** `package-lock.json` pins vite 5.4.21, vitest 2.1.9 and esbuild 0.21.5.
- **Impact:** I believe esbuild versions up to 0.24.2 have a published issue with the dev server's cross-origin handling (GHSA-67mh-4wv8-2f99). It affects the local dev server only, not the built site.
- **Verify:** Run `npm audit`.
- **Uncertainty:** Medium. This is from memory, not an audit.

## Privacy

**P1. Every booking title is shown to everyone (Medium once data is real)**
- **Where:**
  - The bookings list in `App.tsx:23-30`.
  - The conflict message in `availability.ts:78`, which includes the other booking's title.
- **Impact:** All data today is fictional and marked as such, which meets AGENTS.md. Real titles, like "Meeting with [student name]", would be shown to anyone. Showing "Busy" instead of the title would avoid that.
- **Uncertainty:** None today; this is about future data.

**P2. The evidence files contain a local path with a username (Low)**
- **Where:** `evidence/01-baseline-tests.txt:4` contains `/home/saintholly/...`.
- **Impact:** A small leak of local machine details if the repo is shared.

## Reliability

**R1. Older browsers fall back to a plain text box (Low–Medium)**
- **Where:** The `<input type="datetime-local">` fields in `App.tsx`. They have no `required`, `min` or `step` attributes.
- **Impact:** Where `datetime-local` isn't supported (older Safari), users type free text. That free text goes through the lenient parsing in C2. I also recall that some older Safari versions read times without a time zone as UTC, which would shift every check.
- **Verify:** Test manually on old Safari, or force `type="text"` and try typing different date formats.
- **Uncertainty:** The browser-version details are from memory.

**R2. Demo bookings are all in 2099 (Low)**
- **Where:** `src/data/bookings.ts:8-10`. The comment above them, "offset (days from today)", is wrong: the dates are fixed.
- **Impact:** Unless someone types a 2099 date, no conflict is ever shown, so the overlap rule never appears in normal use. The wrong comment will mislead whoever edits the data next.

## Maintainability

- **M1. `code: string` is too loose:** `availability.ts:21` should list the allowed codes (`'INVALID' | 'PAST' | ...`). As it stands, a typo in a code, or in a test that checks one, won't be caught by the compiler.
- **M2. The `Request` interface reuses a built-in name:** `availability.ts:14` shares its name with the browser's built-in `Request` type. That's confusing, and the two can clash if imported carelessly. A name like `BookingRequest` would avoid it.
- **M3. No linting and no CI:** there's no ESLint config and no CI workflow, so nothing enforces the rules in AGENTS.md automatically.

## Agent operations

**A1. `npm test` alone doesn't check types (Medium)**
- **Where:** `AGENTS.md`. Vitest removes type annotations without checking them, so a type error still passes `npm test`. Only `npm run build`, which runs `tsc`, catches it.
- **Impact:** An agent following AGENTS.md to the letter can leave code that doesn't build.
- **Verify:** Add a deliberate type error in a test file and run `npm test`. I expect it to pass.
- **Fix:** Require `npm run build` (or `npx tsc`) as well.

**A2. The evidence logs can't be tied to this commit (Medium)**
- **Where:** Both files in `evidence/`.
- **What I found:**
  - The logs record a different directory (`/home/saintholly/smart-campus-checker`) from this worktree.
  - They contain no commit hash.
  - The commit message says "rebuilt checkpoint", so the logs may predate the rebuild.
  - The `npm notice run …` lines don't look like the usual `> pkg@ver test` header that npm prints. That suggests they were produced with an unusual setup or edited afterwards.
- **What does match:** the versions in the logs (vite 5.4.21, vitest 2.1.9) agree with the lockfile.
- **Impact:** These files show that tests passed at some point, not on this commit.
- **Verify:** Run `npm ci && npm test && npm run build` here and compare. Future logs should record `git rev-parse HEAD`.
- **Uncertainty:** High. I'm not claiming they were faked, only that I can't confirm where they came from.

**A3. AGENTS.md leaves out important rules (Low–Medium)**
- **Install command:** it doesn't say to use `npm ci` rather than `npm install`, which can rewrite the lockfile.
- **Time zone:** it doesn't say which time zone tests should run in.
- **Protected files:** nothing says not to weaken tests or the README's acceptance rules to make a change pass.
- **No-real-data rule:** "Do not add real personal data" depends entirely on judgement; nothing checks it.

## Suggested order to verify
1. Run `npm ci && npm test && npm run build` in this worktree.
2. Add the C1 test (a malformed stored booking).
3. Fix C5 (clear the result when the inputs change).
4. Add the T1 boundary tests and run them under `TZ=UTC` and a time zone with daylight saving.
5. Run `npm audit`.
6. Update AGENTS.md to require `npm run build` and record a commit hash with evidence logs.
