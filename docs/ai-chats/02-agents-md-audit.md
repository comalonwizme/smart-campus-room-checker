# Task #06 — Audit the agent playbook

Tool: Claude Code 2.1.326 (headless, `claude -p`) · Model: claude-opus-5-5 · Date: 2026-11-17 · Session: ec866c52-95a8-4cac-8ad8-14603bf6b06e  
Repo state: git tag `baseline` (separate worktree) · Allowed tools: Read, Grep, Glob only (no edit, no shell) · Turns: 5

## Prompt

> Review AGENTS.md and project documentation only. Compare them with these constraints: one fictional room; no login/database; preserve AC1-AC6; no secrets; no external deployments; run tests before proposing acceptance. Report missing or conflicting rules. Draft a minimal patch to AGENTS.md, but wait for my approval before applying it.

## Response (verbatim)

I reviewed `AGENTS.md`, `README.md` and `package.json`, which are the only documentation in the repo. I didn't open any source or test files.

## How the docs compare with your constraints

| Constraint | AGENTS.md | README.md | Status |
|---|---|---|---|
| One fictional room | — | "Single fictional room, fictional bookings" | **Missing from AGENTS.md** |
| No login/database | — | "no login, no database" | **Missing from AGENTS.md** |
| Preserve AC1–AC6 | — | Lists AC1–AC7 | **Missing.** Nothing says the ACs must stay unchanged. |
| No secrets | — | — | **Missing from both.** "Do not add real personal data" is a separate rule. |
| No external deployments | — | — | **Missing from both** |
| Run tests before proposing acceptance | "Run `npm test` after changes" | Lists `npm test` | **Only partly covered.** It doesn't say tests must pass, or that results must be reported, before acceptance is proposed. |

## Conflicts and unclear points

1. **AC7:** The README defines AC7 (clear feedback, works on desktop and mobile), but your constraint only covers AC1–AC6. That doesn't contradict anything, but it leaves AC7 unclear. My draft protects only AC1–AC6 and doesn't mention AC7. Tell me if AC7 should be protected too.
2. **Build check:** The README lists `npm run build`, which runs the type check (`tsc`). The test rule only mentions `npm test`, so a change could pass the tests and still fail the type check. Requiring the build too is optional, and I left it out of the draft.
3. There are no direct contradictions. "Keep the logic in `src/lib/availability.ts`" and "no real personal data" both fit your constraints.

## Draft patch (not applied)

```diff
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -1,5 +1,11 @@
 # AGENTS.md
 - This is a Smart Campus room availability checker (React + Vite + TypeScript).
+- Scope: exactly one fictional room with fictional bookings. No login, auth, or database.
 - Keep the logic in `src/lib/availability.ts`.
-- Run `npm test` after changes.
+- Preserve acceptance criteria AC1–AC6 (see README.md); do not weaken, remove, or redefine them.
+- Run `npm test` after changes; tests must pass, with results shown, before proposing acceptance.
 - Do not add real personal data.
+- Do not add secrets (API keys, tokens, credentials, `.env` values) to the repo.
+- Do not deploy or publish to any external service.
```

This adds 5 lines and rewords 1, and leaves the existing rules as they are. Do you want me to apply it as written, or adjust it first (for example, add AC7 or `npm run build`)?
