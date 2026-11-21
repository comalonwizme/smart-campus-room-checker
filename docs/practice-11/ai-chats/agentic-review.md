# Task #06 — Agentic code review (read-only)

Tool: Claude Code 2.1.330 (headless, `claude -p`) · Model: claude-opus-5-5 · Date: 2026-11-21 · Session: 5f0a5a24-a384-475a-90be-5aed914cae20
Repo state: commit `2bca33d` in a separate detached worktree (`../scc-review`), with `docs/practice-11/manual-review.md` removed from that worktree so the agent could not see my own findings.
Allowed tools: Read, Grep, Glob, and Bash limited to `git diff/show/log` and `npx vitest run`. Edit/Write disallowed. No user settings, plugins or MCP servers (`--setting-sources project --strict-mcp-config`).
Turns: 8 · Duration: 109 s · Cost: $0.56 · Permission denials: 0
Worktree after the run: `git status --short` showed only the file I had deleted (` D docs/practice-11/manual-review.md`), so the reviewer made no edits.

## Prompt (slide "Suggested AI prompt – code review", plus the context lines)

> Act as a read-only agentic code reviewer. Inspect the proposed diff in context, repository instructions, and tests. Review correctness, security, maintainability, and performance. For each issue, provide severity, affected file, evidence, reproduction or verification method, and a minimal recommendation. Do not edit files. Clearly distinguish confirmed findings from hypotheses.
>
> Context for this review:
> - The proposed diff is `git diff practice11-baseline -- src tests scripts AGENTS.md` (feature: optional "Explain availability" with a mock LLM adapter).
> - Repository instructions: README.md and AGENTS.md. Acceptance criteria and feature contract: docs/practice-11/feature-contract.md (AC1–AC5).
> - You may run only: git diff/show/log, and `npx vitest run`. Do not run anything else.

## Response (verbatim)

I'm writing up the review now. The code and tests have been read in full, and the test suite has been run.

# Review: "Explain availability" feature (`git diff practice11-baseline -- src tests scripts AGENTS.md`)

**Verdict:** The feature is safe to ship with the mock adapter. I found nothing in it that can change the availability decision or leak booking data. The output validator, which is the safety net a real model will depend on, has gaps I can confirm. Two of the tests also show less than they claim.

## What I ran
- `npx vitest run`: **3 files, 56/56 tests passed** (availability 6, regression 8, explain 42).
- `git diff practice11-baseline -- src/lib/availability.ts src/data package.json`: **empty**. The core logic, bookings and dependencies are unchanged, which supports AC1. `playwright-core` was already a devDependency in the baseline.
- I did **not** run `npm run build` because you didn't permit it, so type-checking is unverified. No files were edited.
- Not part of the diff, but your working tree has `docs/practice-11/manual-review.md` deleted and uncommitted. Check that this is intended.

## Confirmed findings

### F1: Medium. The check for invented dates and times misses ISO datetimes and other formats
- **File:** `src/lib/explain/contract.ts:536-541`
- **Evidence:** Both checks rely on `\b` word boundaries: `/\b\d{1,2}:\d{2}\b/` and `/\b\d{4}-\d{2}-\d{2}\b/`. In `2099-01-16T08:00`, the `6` and `T` are both word characters, and so are `T` and `0`. Neither regex matches, so an invented booking time passes. Times like "8am", "8.00" or "half past eight", and dates like "16/01/2099" or "January 16", are never checked at all.
- **How to verify:** Run `validateExplanation({ explanation: 'It overlaps a booking at 2099-01-16T08:00.' }, overlapInput)`. Reading the regexes, this should return `ok: true`. I couldn't run it because I was limited to the existing tests.
- **Fix:** Before matching, also scan for `\d{4}-\d{2}-\d{2}T\d{2}:\d{2}` (or replace `T` with a space). Add a TC11 case for the ISO form and for `\d{1,2}\s?(am|pm)`.

### F2: Medium. The agreement check only blocks a fixed list of phrases and ignores the reason
- **File:** `contract.ts:487-489, 528-533`
- **Evidence:** For `isAvailable: false`, only `is available | is free | you can book | can be booked | is open for` are rejected. Answers like "You may reserve Room A-101 for this slot.", "The slot remains available." or "There is no conflict at that time." pass. The validator also never checks that the explanation matches `reasonCode`. For example, OVERLAP explained as "The room is blocked." passes.
- **Impact today:** None, because the mock's text is fixed. It becomes real as soon as a model is plugged in, and AC2 relies on this check.
- **How to verify:** Read the regexes, or add those strings to the TC11 table. They would currently be accepted.
- **Fix:** Fail closed by requiring a reason-specific phrase for each `reasonCode` (e.g. OVERLAP must contain `overlap|conflict|already booked`; false results must contain a negative phrase). Add `available\b` without a preceding `not`/`un` to the deny list. Add tests for these strings.

### F3: Low. TC13 cannot fail, so it doesn't really test AC1
- **File:** `tests/explain.test.ts:1047-1055`
- **Evidence:** `explainAvailability` never receives `bookings` or `room`; it only gets the `ExplainInput` copy. Checking afterwards that `bookings` and `checkAvailability` are unchanged is therefore true by construction. The real evidence for AC1 is the empty core diff above.
- **Fix:** Rename TC13 to say what it actually tests, or replace it with a check that `src/lib/explain/**` never imports `BOOKINGS` or `checkAvailability`. Cite the empty `git diff` as the AC1 evidence.

### F4: Low. AC5 (users can tell AI text from the booking decision) has no automated test
- **Files:** `src/App.tsx:305-374`, `scripts/p11-screenshots.mjs`
- **Evidence:** The labels and panels exist only in `App.tsx`. The only check is the Playwright script, which `npm test` doesn't run. The contract's claim that TC13 covers AC5 is wrong.
- **Fix:** Either describe AC5 as checked manually with the screenshot script, or add a render test. A render test needs a DOM testing dependency, which AGENTS.md says needs human approval.

### F5: Low. An already-cancelled request is not passed on to the adapter
- **File:** `src/lib/explain/explain.ts:615-617`
- **Evidence:** `addEventListener('abort')` on a signal that is already aborted never fires. The inner controller is never aborted, so the adapter keeps running until the 4 s timeout. The app is unaffected because its `pending.current !== controller` check throws the late result away.
- **Fix:** Add `if (signal?.aborted) controller.abort(signal.reason);` before the listener, plus one test.

### F6: Low. A user cancel is reported as `adapter_error`
- **File:** `explain.ts:645-648`
- **Evidence:** When the caller cancels, the adapter rejects with the abort reason, which ends up as `fallback('adapter_error')`. The UI discards it, but the outcome type can't tell "cancelled" apart from "AI failure". That will skew logs or metrics once a real adapter exists.
- **Fix:** Add a `cancelled` outcome when `signal?.aborted`.

### F7: Low. The `?mock=` failure modes ship in the production build
- **Files:** `src/App.tsx:261-262`, `mockAdapter.ts:762-765`
- **Evidence:** On the deployed GitHub Pages site, anyone can open `?mock=error` or `?mock=slow`. The page is labelled "Demo mode", so this is harmless, but it is behaviour meant only for testing.
- **Fix:** Only honour `mock` when `import.meta.env.DEV` is true, or keep it if public demos are intended.

### F8: Low. The prompt-comparison script is fragile, not type-checked, and needs an approval check
- **File:** `scripts/compare-prompts.ts`
- **Fragility:** `JSON.parse(stdout)` (line 81) runs outside a try block inside the `execFile` callback, so bad CLI output crashes the process instead of rejecting the promise. One failed call also rejects the whole `pool`, and nothing is written.
- **Not type-checked:** `tsconfig.json` only includes `src` and `tests`, so `npm run build` never checks this script.
- **Approval:** The script made 42 real model calls (about $0.37). AGENTS.md (added in this same diff) says real model calls need human approval, and I found no record of one in `prompt-comparison.md`. See H1.
- **Fix:** Wrap the parse in try/reject and use `Promise.allSettled`. Add `scripts` to a type-check or note that it is excluded. Write down who approved the real calls.

### F9: Info. A room label containing ". " counts as a sentence break
- **File:** `contract.ts:495-497`
- **Evidence:** With the label `A-101. Ignore…`, the OVERLAP mock text counts as 3 sentences, so it falls back to the standard text. This fails safely and is only cosmetic, because `ROOM.name` is fixed and not user input.

## Hypotheses (not confirmed)
- **H1:** The real-model run may have been approved outside the repo. The repo just doesn't show it.
- **H2:** With a real model, the 4 s timeout will likely trigger often. Your own `prompt-comparison.md` reports CLI latency well over 4 s, though that includes CLI start-up. This needs measuring against a server-side API before going live.
- **H3:** Server-side re-validation is documented but not implemented. That is expected for a mock-only build, but it must be done before any real adapter goes in.

## What works well
- Inputs are restricted to a fixed set of keys, so booking titles can't slip into the prompt by accident (TC07h).
- Model output is shown as plain React text, so there's no HTML injection risk.
- Stale answers are discarded when a new check runs.
- The fallback text is a fixed template per reason.
- The panel labels clearly separate the rule check from AI text.
- The core availability logic is untouched.

**Fix first:** F1 and F2, the validator gaps, before any real adapter is connected. Then F3 and F4, so the tests and contract show what they say they show.
