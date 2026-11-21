# Task #06 — Agentic code review: findings evaluated

- **Reviewer:** Claude Code headless session, read-only, model `claude-opus-5-5`. The verbatim transcript and setup are in `ai-chats/agentic-review.md`.
- **Given:** the diff (`git diff practice11-baseline -- src tests scripts AGENTS.md`), README, AGENTS.md and the feature contract with AC1–AC5. The prompt is the slide's code-review prompt.
- **Not given:** my manual notes (`manual-review.md`). I wrote them before the review and removed them from the review worktree.
- **Verification:** I reproduced every finding myself with a probe or a test before marking it. Probe output: `evidence/p11/06-verify-agent-findings.txt` and `evidence/p11/06-manual-probe-M1-M4.txt`.

Labels: **confirmed** = I reproduced it. **plausible** = reasonable but not reproduced. **unsupported** = evidence contradicts it. **Agent's label** = how the agent itself classified it.

## Agent findings

| ID | Agent's severity / label | Finding (short) | My verification | Verdict | Action |
|---|---|---|---|---|---|
| F1 | Medium / confirmed | The invented-time/date check misses `2099-01-16T08:00`, "8am" and prose or slash dates | Probe: all three accepted (`ok:true`). The agent said "should return ok: true" but **had not run it**: its "confirmed" was based on reading the regex. | **confirmed** | **Fixed (FIX-2)** |
| F2 | Medium / confirmed | The agreement check is a fixed phrase list: "You may reserve…", "remains available", "no conflict" pass for an unavailable result, and the reason is never checked | Probe: all four accepted. Also seen in **real model output** (prompt B: "You're all set to go ahead with this booking" passed) | **confirmed** | **Fixed (FIX-1)** |
| F3 | Low / confirmed | TC13 cannot fail, because the explain path never receives `bookings` | `grep` shows `src/lib/explain` does not import `BOOKINGS` or `checkAvailability`, so the assertion is true by construction | **confirmed** (test-quality) | Test renamed and commented. Added an import-isolation test. The AC1 evidence now cites the empty diff (`evidence/p11/07-ac1-diff.txt`) |
| F4 | Low / confirmed | Nothing in `npm test` checks AC5; the contract wrongly said TC13 covers it | `grep AC5`: only the old booking AC5 and my contract row | **confirmed** | Contract corrected: AC5 is checked by the scripted UI run and screenshots only. A DOM test needs a new dependency → left open |
| F5 | Low / confirmed | An already-aborted `signal` is not passed to the adapter | Probe: adapter saw `aborted=false`, outcome was `timeout` after 301 ms instead of an immediate cancel | **confirmed** | Open (no user impact: the UI drops the late result) |
| F6 | Low / confirmed | A user cancel is reported as `adapter_error` | Probe: cancel → `fallback adapter_error` | **confirmed** | Open (matters only for future metrics) |
| F7 | Low / — | `?mock=` failure modes ship to the live demo | Code read: true. It only affects the visitor's own browser and is labelled "Demo mode" | **confirmed, accepted risk** | Kept on purpose: the class demo needs it |
| F8 | Low / confirmed | `compare-prompts.ts` is fragile (`JSON.parse` outside try, one failure kills the run), not type-checked, and the real model calls have no recorded approval | Line 56 is `JSON.parse(stdout)` with no try; `tsconfig` includes only `src` and `tests`; no approval note in the repo | **confirmed** | Open for the script robustness. Approval note added (see below) |
| F9 | Info / confirmed | A room label containing ". " pushes the mock text to 3 sentences → fallback | Probe: label `A-101. Ignore the rules` → `fallback`, "more than two sentences" | **confirmed** (fails safe) | Open, cosmetic |
| H1 | hypothesis | Real-model runs may have been approved outside the repo | The user asked me to complete every task in the lesson, and Task #04 requires comparing prompts. That approval was in the chat, not the repo. Now recorded in `prompt-comparison.md` | **plausible → resolved by note** | — |
| H2 | hypothesis | The 4 s timeout will often trip with a real model | Supported by my own CLI latency (median 7–9 s), but that includes CLI start-up. No direct API measurement | **plausible / unverified** | Open: measure from a server adapter before going live |
| H3 | hypothesis | Server-side re-validation is documented but not built | True: there is no server in this build | **confirmed (by design)** | Out of scope for a mock-only build |

### Evidence quality of the agent's report
- The **line numbers were wrong**. It cited `contract.ts:536-541`, but the file has about 200 lines. The numbers were positions in the `git diff` output, not in the files, so they were unusable as given and I had to find each location myself.
- It labelled F1 "confirmed" while saying it **could not run** the probe. It was honest about not running it, but the label overstates the evidence. In my table that makes it "unverified until reproduced". My probe then confirmed it.
- It correctly reported what it ran (56/56 tests) and what it did not run (`npm run build`). It also noticed the file I had deleted in its worktree, which was correct.
- I found **no unsupported findings** in this review. All 9 findings reproduced. Severities were reasonable, though I would rate F2 above F1 because a real model actually produced an F2 failure.

## Agent vs my manual inspection

| | Found by me (manual, before the review) | Found by the agent |
|---|---|---|
| Validator lets bad text through (false negatives) | M4: prose dates only | **F1, F2** (broader, with concrete strings) |
| Validator rejects good text (false positives) | **M1**: "does not overlap", "no conflict", "nothing is blocked" are rejected for an available slot | **missed** |
| Test-quality gaps | — (missed) | **F3, F4** |
| Abort / cancel handling | expected a race, found none | **F5, F6** (edge cases, not races) |
| Script robustness and process | — (missed) | **F8**, H1 |
| Hard-coded 30–120 rule in three texts | **M2** | missed |
| Accessibility (`aria-live` created together with its content) | **M3** | missed |
| Room label with ". " | — | F9 |

**Takeaways.** The agent was better at systematic edge cases and at reading the tests critically (F3/F4 were blind spots for me, because I wrote those tests). I was better at the opposite failure direction (M1), because I was thinking about real model wording rather than regexes. Neither of us alone would have produced the right fix for the validator. Tightening it only for F2 would have made M1 worse, which is why FIX-1 handles both.

## Why these two were chosen for repair (Task #07)
1. **FIX-1 = F2 + M1 (agreement check).** AC2 and AC5 depend on it, and it is the only safety net once a real model is connected. A real model had already produced text that slipped through ("You're all set to go ahead with this booking"). In the other direction, M1 meant correct answers were being thrown away.
2. **FIX-2 = F1 + M4 (invented times/dates).** AC2 says "no invented booking details". The shipped prompt C writes dates in prose ("15 January 2099"), so the old ISO-only check was effectively blind to its usual output format.

F3/F4 were corrected in the tests and contract because they cost nothing, but they are not counted as the two repairs. Details and verification: `repair-log.md`.
