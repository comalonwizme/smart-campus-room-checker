# Task #09 — Background agent thought experiment

Assume an agent works asynchronously on branch `agent/<task-id>`.

**Isolation:** its own `git worktree` + cloud sandbox; no host credentials, no SSH keys, no `gh` token; network egress limited to the npm registry; unique dev-server port (e.g. derived from task id) so parallel agents don't collide; no shared database exists (none in project).

**Permitted files:** `src/**`, `tests/**`, `docs/risk-register.md`. **Not permitted:** `package.json`/lockfile (unless the task says so), `.github/`, `.env*`, `AGENTS.md`, other branches.

**Permitted commands:** `npm ci`, `npm test`, `npm run build`, `git diff/status/add/commit` on its own branch.
**Prohibited:** `git push --force`, merging, deploying/publishing, installing global tools, reading outside the worktree, network calls to other hosts, editing/deleting tests to make them pass.

**Required evidence in the hand-back:** (1) diff + list of changed files; (2) captured output of `npm test` and `npm run build` with exit codes; (3) regression test that fails before / passes after; (4) updated risk-register rows; (5) review note stating assumptions and any command *not* run.

**Before merge/deploy:** a human reads the full diff, re-runs tests locally, checks AC1–AC7 still hold, confirms no scope creep, then merges manually. Deployment is a separate human-triggered step. An agent claim without recorded tool output is treated as unverified.

## Optional — read-only review checklist for the agent
- [ ] Working in an isolated branch/worktree (record `git branch --show-current`)
- [ ] No credentials/secrets present or requested
- [ ] No deployment or push performed
- [ ] `npm test` and `npm run build` run — output pasted, exit codes recorded
- [ ] Risk register updated for every touched risk
- [ ] Each claim linked to evidence (file:line, test name, command output)
- [ ] Summary of changed files (`git diff --stat`)
- [ ] **Human approval gate**: reviewer name/date before merge
- [ ] If no tool execution was recorded, the agent states "not run" — never "passed"
