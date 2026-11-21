# Task #07 — Repair and regression test

Both fixes are in `validateExplanation` (`src/lib/explain/contract.ts`), the check that every model answer must pass before a student sees it. No other production code changed. `availability.ts`, `bookings.ts` and the old tests are untouched (`evidence/p11/07-ac1-diff.txt`: 0 diff lines).

Process: I wrote the regression tests first and ran them (**16 failed**, `evidence/p11/07-regression-BEFORE-fix.txt`), then changed the code and reran (**78/78 passed**, `evidence/p11/07-tests-AFTER-fix.txt`).

## FIX-1 — Agreement check follows the decision *and* the reason, and understands negation (agent F2 + my M1)

**Why it is necessary.** AC2 says the explanation must agree with the deterministic result. AC5 says a student must not mistake it for a booking confirmation. The old check banned a short list of phrases, and it failed in both directions:
- *Let through* (false negatives): "You may reserve Room A-101 for this slot", "The slot remains available", "There is no conflict at that time" for an unavailable slot, an OVERLAP result explained as "blocked", and the real prompt-B answer "You're all set to go ahead with this booking".
- *Blocked* (false positives): correct answers such as "free because it **does not overlap** any booking" or "there is **no conflict**" were rejected for an available slot, so students got the fallback for no reason.

**Change.**
1. Polarity is now **fail-closed and negation-aware**. An unavailable result must contain an un-negated "refusal" phrase and no un-negated "available/free/bookable/you may reserve" phrase; an available result is the mirror image. "Negated" means a negator (*not, no, never, nothing, cannot, …n't*) appears within the four words before the phrase, in the same clause (the clause ends at punctuation or *because/but/so/…*).
2. The text must mention its **reason** (e.g. OVERLAP → overlap/conflict/existing booking; DURATION → minutes/duration/length).
3. "go ahead" and "all set" are added to the banned booking-action phrases.

**Verified by:** FIX-1 tests (5 rejections for OVERLAP, 2 for available, 3 negated acceptances, plus a check that the mock passes for all 7 reason codes). Re-scoring the 42 saved real-model answers: shipped prompt C still 14/14, and B's two "go ahead" answers are now rejected (`evidence/p11/07-rescore-real-model-outputs.txt`).

## FIX-2 — No invented times, dates or weekdays in any common format (agent F1 + my M4)

**Why it is necessary.** AC2 says "no invented booking details". The old check only recognised `HH:MM` and `YYYY-MM-DD`, and because of `\b` word boundaries it also missed ISO datetimes like `2099-01-16T08:00`. The shipped prompt C writes dates as "15 January 2099", so the check was blind to its normal output format.

**Change.** `findInventedDateTime` now extracts clock times (`09:30`, `9:30 am`, `10:45pm`, `8am`), ISO dates and datetimes, "15 January 2099", "January 15, 2099", "16/01/2099" (either day/month order), and weekday names. Each one must equal the request's start/end time, date or weekday. Times are compared as minutes after midnight, so "9:30 am" and "09:30" are the same.

**Verified by:** FIX-2 tests (7 invented values rejected, 3 real values in other formats accepted). One bug was caught during the fix: the bare "8am" pattern also matched the "30 am" inside "9:30 am". A lookbehind fixed it, and the "9:30 am" acceptance test protects it.

## Regression results

| Check | Before fix | After fix | Evidence |
|---|---|---|---|
| Old booking tests (14) | 14/14 | 14/14 | `07-tests-AFTER-fix.txt` |
| LLM-feature tests | 47/63 (the 16 new regression tests fail) | 64/64 (adds the F3 import-isolation test) | `07-regression-BEFORE-fix.txt`, `07-tests-AFTER-fix.txt` |
| Build (`tsc && vite build`) | exit 0 | exit 0 | `07-build-AFTER-fix.txt` |
| UI scenarios, decision unchanged after "Explain" | 13/13 | 13/13 | `07-ui-check-AFTER-fix.txt`, `screenshots/p11/` |
| Real-model answers accepted (prompt C) | 14/14 | 14/14 | `07-rescore-real-model-outputs.txt` |
| Rule files diff vs `practice11-baseline` | 0 lines | 0 lines | `07-ac1-diff.txt` |

## Also corrected (not counted as the two repairs)
- **F3:** TC13 was renamed and commented, because it cannot fail by construction. A real isolation test was added: `src/lib/explain/*` must not import the bookings data or `checkAvailability`.
- **F4:** The contract no longer claims a unit test covers AC5. It is covered by the scripted UI check and screenshots.
- **H1:** The approval for the real-model prompt comparison is now recorded in `prompt-comparison.md`.

## Ready for demonstration? **Yes, with the mock adapter.**
- The deterministic decision is unchanged (AC1). The explanation is validated, labelled and has a safe fallback (AC2–AC5).
- Every acceptance criterion has passing evidence. AC5 is checked only by the scripted UI run.
- The live demo uses the mock. That is stated on screen ("Mock AI (no real model)").

## Not ready for a real model yet. Unresolved:
| Item | Why it matters | Next step |
|---|---|---|
| No server-side adapter (H3) | A real key must never reach the browser | Build a small server endpoint that holds the key, re-validates input and output, and has rate limits |
| Timeout vs real latency (H2) | CLI latency of 7–9 s suggests a 4 s timeout would fall back often | Measure API latency from the server, then tune the timeout and model choice |
| F5 / F6 cancel handling | Wasted calls and wrong metrics once a real adapter exists | Abort immediately when the signal is already aborted; add a `cancelled` outcome |
| F8 script robustness | One CLI failure loses the whole comparison | try/catch + `Promise.allSettled` |
| F9 room label with ". " | Cosmetic fallback | Count sentences on text with the room label masked |
| M2 hard-coded "30 and 120 minutes" | If the rule changes, the explanations would state a wrong rule | Build the texts from `MIN_MINUTES`/`MAX_MINUTES` |
| M3 `aria-live` | Screen readers may miss the explanation | Keep an empty live region mounted |
| Keyword checks are heuristics | No regex can prove agreement. The validator reduces risk; it does not remove it | Keep reading samples of real answers; the deterministic decision stays authoritative |
