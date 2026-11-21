# Submission — Practice work #11

**To:** b.azimkhanov@kbtu.kz

**Subject** (format from the slide; the slide's example says "#12", so confirm with the teacher which number to use):
```
AI-Driven Software Engineering Practice #11, [FULL NAME], [STUDENT ID]
```

**Body:**
```
Hello,

Please find my Practice work #11 (Build a small AI-enabled feature) below.

Student: [FULL NAME], ID [STUDENT ID]
Class time: [DAY OF WEEK], [TIME]
AI tool: Claude Code 2.1.330 (CLI), model Claude Opus 5.5 (claude-opus-5-5)

Live demo: https://comalonwizme.github.io/smart-campus-room-checker/
  - "Explain availability" appears after "Check availability".
  - Failure modes can be tried with ?mock=slow (timeout), ?mock=error (API failure),
    ?mock=contradict, ?mock=malformed
Repository: https://github.com/comalonwizme/smart-campus-room-checker
Pull request (full diff + review): https://github.com/comalonwizme/smart-campus-room-checker/pull/1
Report (all tasks): attached Practice11-report.pdf, also in the repo at docs/practice-11/

Summary:
- The deterministic checker remains the only source of truth (0 diff lines in the rule files).
- The explanation comes from a clearly labelled mock LLM adapter, is validated against the
  decision, and is replaced by a fixed fallback on timeout, API error or unsupported output.
- Three prompts were compared on a real model (42 calls); prompt C was chosen.
- 15 test cases with expected vs observed results; 78/78 automated tests pass; build OK.
- Agentic code review: 9 findings evaluated (all reproduced). The 2 most important were
  fixed with regression tests (16 failing before, all passing after).

Screenshots are attached.

Best regards,
[FULL NAME]
```

**Attachments** (separate files; no ZIP, RAR or OneDrive links, as the slide requires). They are in `~/Downloads/Practice11-submission/` and are also committed under `screenshots/p11/` and `docs/practice-11/`:

| File | Shows |
|---|---|
| `Practice11-report.pdf` | Full report: baseline, contract and diagram, prompt comparison, tests, manual + agentic review, repairs, discussion, reflection, verbatim review transcript |
| `01-live-ai-explanation-overlap.png` | Live demo: AI explanation, clearly separated from the authoritative rule check |
| `02-live-ai-explanation-available.png` | Live demo: available slot |
| `03-live-fallback-api-failure.png` | Live demo: simulated API failure → deterministic fallback |
| `04-timeout-fallback.png` | Timeout (4 s) → fallback, decision unchanged |
| `05-contradicting-ai-answer-blocked.png` | AI answer contradicts the decision → rejected, fallback shown |
| `06-malformed-ai-answer.png` | Malformed AI output → fallback |
| `07-past-time.png`, `08-invalid-time.png`, `09-empty-input.png`, `10-too-short.png` | Other normal / invalid cases |
| `11-mobile-overlap.png`, `12-mobile-timeout.png` | Mobile layout (390 px) |
| `13-architecture-diagram.png` | Request → rule engine → LLM adapter → validation → UI |
| `14-prompt-comparison.png` | Task #04 results |
| `15-test-results.png` | Tests before/after the fixes, build, AC1 diff |
| `16-agentic-review-top.png`, `17-agentic-review-full.png` | Task #06: the agent's review (verbatim) |
