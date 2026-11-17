# Task #02 — Read-only AI risk review

**Reviewer:** Claude Code (model `claude-sonnet-5-5`), read-only inspection of the repo at tag `baseline`, prompt per the Practice #10 slide:
> Act as a cautious software reviewer. Inspect this Smart Campus Room Availability Checker WITHOUT editing files. Identify risks in correctness, security, privacy, reliability, maintainability, and agent operations. For each risk, cite the exact file/function or missing check, explain the impact, suggest a way to verify it, and state uncertainty. Do not invent test results.

## Proposed risks (before verification)
| # | Category | Claim | Cited location | How to verify | Uncertainty |
|---|----------|-------|----------------|---------------|-------------|
| 1 | Correctness | Invalid calendar dates (31 Feb) silently roll over | `availability.ts` `toDate` | Call with `2099-02-31` | `Date` parsing is engine-dependent |
| 2 | Correctness/Reliability | NaN from a bad stored booking makes the overlap check pass | overlap loop | Booking with `start:'garbage'` | Depends on data ever being malformed |
| 3 | Correctness | Non-ISO strings/seconds accepted | `toDate` | `'2099-01-15 10:00'` | Same as #1 |
| 4 | Correctness (contract) | No opening hours | `checkAvailability` | 03:00 request | Not in AC list |
| 5 | Security | Booking title in message → XSS | `App.tsx` | Title `<img onerror>` | React escapes; likely a false alarm |
| 6 | Reliability | TZ / DST / default `now` | `parseLocal`, `now` param | Run with other `TZ` | Not executed |
| 7 | Maintainability/Agent ops | No CI, lint, typecheck script; `^` deps | `package.json` | inspect repo | Lockfile mitigates drift |
| 8 | Agent ops | AGENTS.md has no forbidden actions / review gates | `AGENTS.md` | read it | — |
| 9 | Reliability | No UI tests | `tests/` | inspect | Manual check exists |
| 10 | Privacy | Real personal data in bookings | `src/data/bookings.ts` | read it | Data is fictional → no finding |

Verification outcome is in `docs/risk-register.md` (items 1+3 → R-01, 2 → R-02, 4 → R-03, 5 → R-04 *unsupported*, 6 → R-06, 7 → R-05, 8 → R-07, 9 → R-09; #10 dropped: all data is fictional).

**Honesty note:** the original Practice #09 project (Bolt.new) was not available on this machine, so the baseline was rebuilt from the same acceptance contract. Nothing in the original project was audited.
