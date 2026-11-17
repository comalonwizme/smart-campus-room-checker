# Optional — Agent review checklist

Tool: Claude Code 2.1.326 (headless, `claude -p`) · Model: claude-opus-5-5 · Date: 2026-11-17 · Session: 140b30cf-2601-4ac3-a3d2-5e06b9cb65a9  
Repo state: git tag `baseline` (separate worktree) · Allowed tools: Read, Grep, Glob only (no edit, no shell) · Turns: 7

## Prompt

> Design a read-only review checklist for a background coding agent working on Smart Campus. Include: isolated branch/worktree; no credentials; no deployment; test and build commands; risk register updates; evidence for each claim; a summary of changed files; and an explicit human approval gate before merge. Do not claim the agent ran unless a real tool execution is recorded.

## Response (verbatim)

I've written the checklist below. It's based on reading this repo: `package.json`, `AGENTS.md`, `README.md`, `src/data/bookings.ts` and `evidence/`. **I didn't run any commands, tests or builds, and I didn't change any files.**

Two things in the repo affect the checklist:
- **The existing evidence wasn't recorded in this worktree.** Both files in `evidence/` show `RUN … /home/saintholly/smart-campus-checker`. They prove nothing about this checkout or any agent branch, and item E3 is there to catch exactly this.
- **There's no risk register yet.** Item F1 asks the agent's branch to add one. I've called it `RISKS.md` as a placeholder name.

---

# Smart Campus: review checklist for background-agent changes

**Rules for the reviewer:**
- The review is read-only. Don't edit, commit, push, deploy or merge while reviewing.
- If you re-run anything, do it in a separate throwaway worktree. `npm ci` and `npm run build` create `node_modules/` and `dist/`.

**Status for each item:**
- ✅ **Verified:** you checked the evidence yourself.
- ⚠️ **Claimed:** the agent says so, but there's no evidence. This is the same as failing.
- ❌ **Failed**
- ➖ **Not applicable:** give a reason.

**Main rule:** A claim that something "ran", "passed" or "built" counts only with a recorded tool execution. That record must include:
- the command
- the working directory
- the commit SHA
- the full output
- the exit code
- a timestamp

Prose like "tests pass" with no record is ⚠️.

### A. Isolation
- [ ] **A1:** The work is on its own branch, not `main`. Check with `git rev-parse --abbrev-ref HEAD`.
- [ ] **A2:** The work was done in its own worktree or clone. Check with `git worktree list`, or the agent's recorded working directory.
- [ ] **A3:** The branch starts from a known `main` commit. Check with `git merge-base main HEAD` and write down the SHA.
- [ ] **A4:** Nothing was pushed to `main` or any shared branch. Check the reflog or remote log, and fail on any direct commit to `main`.
- [ ] **A5:** No `git stash` was used without a unique tag. Background agents share the stash stack.

### B. No credentials or personal data
- [ ] **B1:** The diff adds no secrets. Search the diff for `key`, `token`, `secret`, `password`, `Bearer`, `-----BEGIN` and long base64/hex strings: `git diff main...HEAD | grep -inE '…'`.
- [ ] **B2:** No `.env*`, `*.pem`, `*.key` or `.npmrc` (with auth) files were added, and `.gitignore` wasn't loosened.
- [ ] **B3:** The agent's run used no credentials. Check that the transcript shows no auth prompts, tokens in commands, or logins.
- [ ] **B4:** There's still no real personal data, as AGENTS.md requires. `src/data/bookings.ts` keeps fictional titles and `2099-` dates, and there are no real names, emails or student IDs.

### C. No deployment
- [ ] **C1:** The transcript shows no deploy, publish or release command: `vercel`, `netlify`, `gh-pages`, `npm publish`, `firebase deploy`, `docker push`, and so on.
- [ ] **C2:** No deploy config was added: CI deploy jobs, `vercel.json`, `netlify.toml`, Dockerfiles, or new workflow files.
- [ ] **C3:** No new network-facing dependencies or `postinstall` scripts in `package.json` or `package-lock.json`.

### D. Tests and build (recorded runs only)
The project commands, from `package.json`:

| Purpose | Command | Pass condition |
|---|---|---|
| Install | `npm ci` | exit 0, lockfile unchanged |
| Tests | `npm test` (runs `vitest run`) | exit 0, test count ≥ the 6 in the baseline |
| Build | `npm run build` (runs `tsc && vite build`) | exit 0, no TypeScript errors |

- [ ] **D1:** There's a recorded `npm test` run on the branch's final commit SHA, with exit 0.
- [ ] **D2:** There's a recorded `npm run build` run on the same SHA, with exit 0.
- [ ] **D3:** No tests were deleted, skipped (`.skip`, `.only`, `xit`) or weakened to make them pass. Compare `tests/` against `main`.
- [ ] **D4:** Each changed behaviour has a test, mapped to the acceptance criteria AC1–AC6 in `README.md`. AC7 is UI-only, so it needs a manual check or screenshot.
- [ ] **D5:** The logic stays in `src/lib/availability.ts`, as AGENTS.md requires. No availability rules are copied into `App.tsx`.

### E. Evidence for every claim
- [ ] **E1:** Every statement in the agent's summary links to an evidence item: a log file, a transcript line or a diff hunk.
- [ ] **E2:** Evidence files sit under `evidence/` and are named `NN-<what>.txt`, like the existing ones. Each holds the command, the full output and `exit=<code>`.
- [ ] **E3:** The recorded working directory and SHA match this branch. A log from a different path or commit is ⚠️, not ✅.
- [ ] **E4:** Any step the agent didn't run is labelled **NOT RUN** with a reason, not left out silently.

### F. Risk register
- [ ] **F1:** `RISKS.md` (or whatever file you choose) exists. If it's missing, the agent's branch must create it.
- [ ] **F2:** There's one entry per new or changed risk, with these fields:
  - ID
  - description
  - likelihood
  - impact
  - mitigation
  - owner (a role, not a real name)
  - status
  - evidence link
- [ ] **F3:** If no risk changed, the summary says "no risk change" and explains why.
- [ ] **F4:** Risks to always consider:
  - time-zone or boundary errors in overlap checks (AC4)
  - mutation of `BOOKINGS` (AC6)
  - personal data creeping into fixtures
  - dependency supply chain

### G. Summary of changed files
- [ ] **G1:** The agent's summary has a file table that matches `git diff --name-status main...HEAD` exactly. Any file left out or added is a fail.

  | File | Change type (A/M/D/R) | Why | Evidence |
  |---|---|---|---|

- [ ] **G2:** `git diff --stat main...HEAD` totals look reasonable for the task. Flag large lockfile churn or generated files such as `dist/`.
- [ ] **G3:** No changes outside the task's scope, unless the summary explains them.

### H. Human approval before merge
- [ ] **H1:** Sections A–G are all ✅ or ➖. No ⚠️ or ❌ remains.
- [ ] **H2:** A named human reviewer signs off on the record below. The agent can't sign off its own work.
- [ ] **H3:** Only the human merges. The agent has no merge permission, and the branch protection on `main` requires approval.
- [ ] **H4:** After merge, the human re-runs `npm test` and `npm run build` on `main` and saves the logs as new evidence.

```
Approval record
Branch / head SHA: ____________   Base SHA: ____________
Reviewer (role):   ____________   Date: ____________
Sections A–G:      all ✅/➖  [ ] yes
Decision:          [ ] APPROVE MERGE   [ ] REQUEST CHANGES   [ ] REJECT
Notes:
```

---

If you'd like it saved in the repo, `docs/agent-review-checklist.md` would be a natural place. I left it out because you asked for a read-only design.
