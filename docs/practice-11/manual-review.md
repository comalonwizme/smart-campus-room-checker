# Task #06 (part 1) — My manual inspection, written BEFORE the agentic review

Scope: `git diff practice11-baseline..practice-11` (new `src/lib/explain/*`, `src/App.tsx`, `src/styles.css`, `tests/explain.test.ts`). I wrote this before reading the agent's report so the two can be compared fairly.

| # | Dimension | Finding | Where | Severity (my guess) | How I would verify |
|---|---|---|---|---|---|
| M1 | Correctness / quality | The agreement check is keyword-based and ignores negation. A correct explanation for an **available** slot such as "it does not overlap any existing booking" contains `overlap`, so it is rejected and the user gets the fallback instead of the AI text. Same for "no conflict", "not blocked". | `SAYS_UNAVAILABLE` in `src/lib/explain/contract.ts` | Medium (fails safe, but wastes the model call and makes the feature look broken) | Unit test: `validateExplanation({explanation: 'The room is free because the slot does not overlap any existing booking.'}, availableInput)` → expect ok |
| M2 | Maintainability / correctness drift | The 30–120 minute rule is hard-coded as text in three places (fallback template, `REASON_MEANINGS`, mock text) instead of using `MIN_MINUTES`/`MAX_MINUTES`. If the rule changes, the explanation would state a wrong rule (violates AC2). | `contract.ts` FALLBACK, `prompt.ts` REASON_MEANINGS, `mockAdapter.ts` | Low–Medium | Change `MAX_MINUTES` in a test double / grep for `120` |
| M3 | Accessibility | `aria-live` is on an element that is created together with its content, so screen readers may not announce the explanation. | `ExplanationPanel` in `src/App.tsx` | Low | Screen-reader test (not available to me) |
| M4 | Correctness (limit of the check) | The "no invented details" check only catches `HH:MM` and `YYYY-MM-DD`. A model could invent "on 16 January" or "until half past ten" and pass. | `validateExplanation` | Low (contract limitation; document it) | Unit test with prose dates |
| M5 | UX (pre-existing) | Editing the time inputs does not clear the old decision (Practice #10 finding C5). The explanation is tied to the *checked* request, so it stays consistent with the decision panel, but both can be stale relative to the inputs. | `App.tsx` input `onChange` | Low | Manual |
| M6 | Security (checked, probably fine) | `?mock=` lets anyone switch the mock into failure modes on the live demo. It only affects their own browser and is labelled on screen. | `mockModeFromSearch` | Info | Read code |

What I expect an agent to find that I might have missed: race conditions in `onExplain`, timer/abort leaks in `explainAvailability`, and anything about the prompt-injection boundary.
