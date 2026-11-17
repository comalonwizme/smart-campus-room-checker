# Task #05/#06 — Agent-readiness audit & AGENTS.md review

## Checks (Lecture #10 rubric), state at tag `baseline` → now
| Area | Baseline | Now |
|------|----------|-----|
| README accurate (setup, commands, AC list) | Yes, short | Updated with Practice #10 section |
| Folder layout | `src/lib` (logic), `src/App.tsx`, `tests/` | + `docs/`, `evidence/`, `screenshots/`, `scripts/` |
| Automated tests | 6 unit tests (AC1–AC6) | 14 tests incl. 8 regression cases |
| Build reproducible | `npm run build` OK, lockfile committed | same; run `npm ci` in docs |
| Formatter / linter | **missing** | missing |
| Type check | via `tsc` in `build` (strict) | same |
| Pinned dependencies | lockfile only; `^` ranges | same |
| `.env.example` | **missing** (no env needed) | missing (not needed; stated in AGENTS.md) |
| Architecture notes | none | this folder |
| AGENTS.md | present, 4 lines, no boundaries | scope, safe commands, forbidden actions, review gates |
| CI / hooks | **missing** | missing |
| Integration / UI checks | none | manual script `scripts/screenshots.mjs` (not CI) |

**Assigned level: Level 1 (Baseline), partially Level 2.** Justification: unit tests, strict typecheck, lockfile and a build exist; but there is no formatter/linter, `.env.example` is absent, and no CI/hooks (Level 3). AGENTS.md now meets the Level-2 "documented" bar, yet architecture notes are only informal.

**Missing evidence:** lint/format config, CI run, pre-commit hook, UI/integration tests in CI, TZ matrix run.

## AGENTS.md review vs. constraints
| Constraint | Baseline AGENTS.md | Gap |
|------------|-------------------|-----|
| one fictional room | not stated | missing |
| no login/database | not stated | missing |
| preserve AC1–AC6 | not stated | missing |
| no secrets | not stated (only "no real personal data") | partial |
| no external deployments | not stated | missing |
| run tests before proposing acceptance | "Run npm test after changes" | partial — no build, no "report real output" |
| conflicting rules | none found | — |

**Minimal patch** (diff of `AGENTS.md` between `baseline` and HEAD): adds Scope, Safe commands, Forbidden-without-approval, Review gates. The slide asks to wait for approval before applying; the patch was applied here because the repo owner asked for the whole assignment to be completed end-to-end — review it in the commit `Patch AGENTS.md` and revert if unwanted.
