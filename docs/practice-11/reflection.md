# Reflection: what the AI generated, what I verified, what I changed

**AI tools used**
- **Claude Code 2.1.330**, model **claude-opus-5-5** (Claude Opus 5.5). It was the coding assistant, working from the slide's implementation prompt and constraints: mock adapter first, preserve the booking rules and tests, validate inputs and outputs, no login/database/personal data/client-side secrets.
- A separate **read-only headless Claude Code session** (same model) was the agentic reviewer.
- **claude-opus-5-5 via `claude -p`** was the "real model" in the prompt comparison.

## What the AI generated
- The feature code: `src/lib/explain/` (contract and validators, prompt builder with three variants, mock adapter with 5 simulated modes, orchestrator with timeout and fallback), the UI panel in `App.tsx`, and styles.
- 42 unit tests, the Playwright UI script, the prompt-comparison runner, and first drafts of the docs.
- The 42 real-model explanations used to compare the prompts.
- The agentic review report (9 findings, 3 hypotheses).

## What was verified, and how
- **Every test claim has a captured command output in `evidence/p11/`.** Baseline 14/14. 56/56 after the feature. 16 failed before the fixes. 78/78 after.
- **AC1:** `git diff practice11-baseline` of the rule files and the old tests is 0 lines.
- **The UI never changes the decision:** the screenshot script compares the decision text before and after "Explain" in 13 scenarios, before and after the fixes.
- **Every agent finding** was reproduced with a probe before I accepted it. All 9 reproduced. Two report-quality problems were noted: the line numbers were diff positions, and F1 was labelled "confirmed" without being run.
- **The prompt choice** was checked on real outputs, not just the validator. That reading found B's "You're all set to go ahead with this booking", which the validator had accepted.

## What was changed because of verification
1. **FIX-1, agreement check.** Changed after the review, prompted by F2 and my M1. The first version would have let a real model imply a booking, and it rejected correct negated wording.
2. **FIX-2, invented date/time check.** Changed after F1 and M4. The first version could not see the format the chosen prompt actually uses.
3. **A test that could not fail (TC13)** was renamed, and a real isolation test was added. The contract's AC5 claim was corrected to "scripted UI check only".
4. **A bug introduced during FIX-2** ("30 am" matched inside "9:30 am") was caught by an acceptance test before commit.
5. **A build break** caused by using `node:fs` in a test was caught by `npm run build`, not by `npm test`. Vitest does not type-check. I switched to `import.meta.glob` rather than adding `@types/node`, which AGENTS.md forbids without approval.

## What I would not trust yet
- Keyword validators are heuristics. They lower the risk of a wrong explanation; they cannot prove agreement. The deterministic decision panel stays the source of truth, and the AI text is labelled as such.
- Real-model latency was only measured through the CLI. The server-side adapter, API latency, F5/F6, F8, F9, M2 and M3 are open (`repair-log.md`).
