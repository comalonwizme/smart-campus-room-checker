# Release decision: **CONDITIONAL GO**

(for the fictional, no-login, no-database demo — not a production campus system)

## Evidence
- `npm test`: 14/14 pass after mitigations (`evidence/03-regression-AFTER-fix.txt`); before fixes 4 regression tests failed (`evidence/02-…BEFORE-fix.txt`). Baseline 6/6 (`evidence/01-…`).
- `npm run build`: exit 0 (`evidence/03-build-AFTER-fix.txt`).
- Manual UI check, desktop 1280px and mobile 390px: all five scenarios show correct feedback, no horizontal overflow (`evidence/04-manual-ui-check.txt`, `screenshots/`).
- Mitigated: R-02 (6→3), R-01 (4→2), R-07 (4→2). R-04 checked, unsupported.

## Why not plain GO
Open risks with no control yet: R-05 (no CI/lint → regressions can merge unnoticed), R-06 (time-zone/DST behaviour never executed), R-09 (no automated UI tests), R-03 (no opening hours — needs a product decision).

## Conditions (owner → before)
1. Add CI (`npm ci && npm test && npm run build`) — Maintainer — before any further agent-made change is merged.
2. Run the suite under at least two `TZ` values and fix findings — Maintainer — before use outside a demo.
3. Product owner decides opening hours / max advance window — before real use.

## Remaining uncertainty
The original Bolt.new project was not audited (rebuilt baseline). Residual scores are judgement. A failing TZ run or a new overlap defect would change this to NO-GO; CI + TZ run green would make it GO.

## Discussion answers (short)
- *What makes an AI risk finding trustworthy?* A cited location plus a reproduced result; here 1 of 10 findings was unsupported (XSS) and 1 dropped (privacy).
- *Which missing check most weakens agent readiness?* CI — nothing enforces the tests an agent is told to run.
- *Allow a background agent to merge automatically?* No — human approval gate.
- *What evidence would change the decision?* See "Remaining uncertainty".
