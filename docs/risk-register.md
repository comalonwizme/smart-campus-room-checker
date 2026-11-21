# Risk register — Smart Campus Room Availability Checker

Scoring: likelihood (1–3) × impact (1–3) = score (1–9). Labels: **confirmed** (I reproduced it / inspected the code), **plausible** (not executed), **unsupported** (checked, evidence contradicts it).
The initial review was produced by an AI reviewer (Claude Code, read-only pass, see `docs/ai-review.md`); every finding below was then checked by running code or reading the cited lines.

| ID | Category | Cause → Event → Consequence | Component | Evidence | Status | L | I | Score | Mitigation | Owner | Verification | After (L×I) |
|----|----------|-----------------------------|-----------|----------|--------|---|---|-------|------------|-------|--------------|-------------|
| R-02 | Correctness / reliability | Stored booking has unparsable time → `new Date()` gives NaN → every comparison is false → overlap loop never fires → **"available" returned for a slot that may be taken** (double booking) | `checkAvailability`, overlap loop | Probe (`evidence/`): booking `start:'garbage'` → `{"available":true}` before fix | **confirmed** | 2 | 3 | **6** | Fail closed: `DATA_ERROR` for any invalid stored booking | Dev | `tests/regression.test.ts` R-02 (failed before, passes after) | 1×3 = 3 |
| R-01 | Correctness | `new Date('2099-02-31T10:00')` rolls over instead of failing → impossible date, plus `"… 10:00"` and `:30` seconds accepted → AC1 violated for non-UI callers (browser `datetime-local` hides it, hence L=2) | `toDate()` | Probe: 31 Feb accepted as available; test failed before fix | **confirmed** | 2 | 2 | **4** | Strict `parseLocal()` (regex + round-trip check) | Dev | `tests/regression.test.ts` R-01 | 1×2 = 2 |
| R-05 | Agent operations | No CI, no lint/format/typecheck script, caret-ranged deps (lockfile present) → regressions can merge unnoticed | repo root, `package.json` | No `.github/`, no `lint` script | **confirmed** | 2 | 2 | 4 | Not mitigated now (out of scope for two-fix limit) | Maintainer | Add CI running `npm ci && npm test && npm run build` | 4 (open) |
| R-07 | Agent operations | Baseline `AGENTS.md` had no forbidden actions, no review gate, no "report real output" rule → agent may push/add deps/overclaim | `AGENTS.md` | Baseline file: 4 lines (`git show baseline:AGENTS.md`) | **confirmed** | 2 | 2 | 4 | AGENTS.md patch (this PR) | Dev | Read-through vs constraints, `docs/agents-audit.md` | 1×2 = 2 |
| R-06 | Reliability | Local-time parsing + campus time zone ≠ viewer time zone; DST-gap times; default `now = new Date()` | `parseLocal`, default `now` | Tests inject `now`; no TZ run executed | **plausible / unverified** | 2 | 2 | 4 | Run suite with `TZ=` variants; decide canonical campus TZ | Maintainer | `TZ=Pacific/Auckland npm test` (**not run**) | 4 (open) |
| R-09 | Reliability | No automated UI tests; only the manual check in `evidence/04-manual-ui-check.txt` | `src/App.tsx` | `tests/` has logic tests only | **confirmed** | 2 | 1 | 2 | Manual check recorded; add component tests later | Maintainer | — | 2 (open) |
| R-03 | Correctness (contract gap) | No opening hours: a 03:00 or overnight booking is "available" | `checkAvailability` | Probe: 03:00 and 23:30→00:30 accepted | **confirmed behaviour; contract silent** | 3 | 1 | 3 | Product decision; not an AC1–AC7 violation | Product owner | — | 3 (open) |
| R-04 | Security | Booking title injected into result message could enable XSS | `App.tsx` result, `availability.ts` message | Message is rendered as a React text node (auto-escaped); the probe confirmed the title only appears inside a string passed to a React text node (browser rendering of a hostile title was **not** executed); no `dangerouslySetInnerHTML` in `src/` | **unsupported** | 1 | 3 | 3 | None needed; keep rule "no `dangerouslySetInnerHTML`" | Dev | `grep -rn dangerouslySetInnerHTML src` → no matches | 3→1 |

## Ranking — top two for action
1. **R-02** (score 6) — silent double booking breaks the core purpose of the product.
2. **R-01** (score 4) — ties with R-05/R-06/R-07 at 4; chosen over them because it is a direct acceptance-contract (AC1) violation and is verifiable by a test. R-07 was also fixed because the task requires an AGENTS.md patch (Task #06).

Residual-risk scores are my estimate after verified tests; they are judgement, not measurement.

## Practice #11 additions — "Explain availability" (LLM) feature

| ID | Category | Cause → Event → Consequence | Component | Evidence | Status | L×I before | Mitigation | After |
|----|----------|-----------------------------|-----------|----------|--------|-----------|------------|-------|
| R-11 | Correctness / trust | Model text implies a booking or contradicts the decision → student believes the wrong outcome | `validateExplanation` | Agent F2; real prompt-B output "You're all set to go ahead with this booking" was accepted | **confirmed** | 2×3 = 6 | FIX-1: negation-aware, fail-closed polarity + reason terms + "go ahead/all set" banned; labelled AI panel | 1×3 = 3 |
| R-12 | Correctness | Model invents a time or date in prose/ISO-T/am-pm form → "no invented details" (AC2) broken | `validateExplanation` | Agent F1, my M4; probes accepted 6 invented values | **confirmed** | 2×2 = 4 | FIX-2: `findInventedDateTime` | 1×2 = 2 |
| R-13 | Quality | Correct negated wording rejected → needless fallback | `validateExplanation` | My M1; probes | **confirmed** | 2×1 = 2 | FIX-1 | 1×1 = 1 |
| R-14 | Reliability | Real model latency > 4 s timeout → frequent fallback | `explainAvailability` | CLI median 7–9 s (includes start-up) | **plausible** | 3×1 = 3 | Fallback is safe; measure API latency server-side before going live | 3 (open) |
| R-15 | Security | API key exposed if a real adapter runs in the browser | (future adapter) | Mock only today; AGENTS.md rule added | **plausible (future)** | 1×3 = 3 | Server-side adapter only; no `VITE_*` secrets | 3 (open) |
| R-16 | Reliability | Cancel not propagated / reported as error | `explain.ts` | Agent F5, F6 reproduced | **confirmed** | 1×1 = 1 | Open (UI discards stale results) | 1 (open) |
