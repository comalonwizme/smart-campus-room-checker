# AGENTS.md — Smart Campus Room Availability Checker

## Scope (do not exceed)
- One fictional room, fictional bookings. **No login, no database, no real personal data, no secrets, no external services.**
- Preserve acceptance contract AC1–AC7 (see README). Never weaken a test to make it pass.
- Core logic lives only in `src/lib/availability.ts` (pure, must not mutate its inputs). UI in `src/App.tsx`.

## "Explain availability" (LLM) feature — Practice #11
- Code: `src/lib/explain/` (contract, prompt, mock adapter, orchestrator). Contract: `docs/practice-11/feature-contract.md`.
- The rule engine is the only source of truth. The LLM path may **read** the structured result; it must never call into, change or override `checkAvailability`, `BOOKINGS` or the decision panel.
- Send the model only `ExplainInput` (room label, times, isAvailable, reasonCode). No booking titles, ids, names or other personal data.
- Treat model output as untrusted: it must pass `validateExplanation`, otherwise show the deterministic fallback.
- The shipped adapter is the labelled mock. A real adapter must run server-side; API keys never go in client code, `VITE_*` variables or the repo. Adding an SDK or making real model calls needs human approval.
- Changes here ship with tests in `tests/explain.test.ts` (AC1–AC5 of the feature contract).

## Safe commands
- `npm ci` · `npm test` · `npm run build` · `npm run dev`
- Run `npm test` **and** `npm run build` before proposing any change as done. Report real output; never claim a test passed unless it ran.

## Forbidden without explicit human approval
- Deploying/publishing, `git push`, force-push, merging, changing git remotes.
- Adding dependencies, editing `package-lock.json`, touching `.github/`, `.env*`.
- Network calls to external services; reading files outside this repository.
- Unrelated refactors or reformatting of files you were not asked to change.

## Review gates
1. Work on an isolated branch/worktree, never `main`.
2. Every behaviour change ships with a regression test (fails before, passes after).
3. Hand back: diff summary, test + build output, updated `docs/risk-register.md` rows.
4. A human reviews the diff and approves before merge.
