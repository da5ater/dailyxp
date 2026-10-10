# UI review fixes

The review reproduced save failures, overflow, modal focus theft, broken removal controls, missing goal preview, and unreachable SAVE. The following fixes passed real input verification on the private production-plugin host.

| Before | After | Why |
| --- | --- | --- |
| New goal persisted but task was rejected | Wait for Goal persistence, then Task persistence before dismissing | StateStore serializes asynchronous saves |
| Unrelated saves focused Pause behind a modal | Compare session identity/status and check modal ownership when deferred focus runs | Form input must not activate background session controls |
| Compact labels expanded past the sheet | Measure compact font, bound chip and row widths, and elide | Long text stays inside available space |
| Expanded form hid SAVE | Bounded scrolling viewport brings focused controls into view | Twenty-one goals keep SAVE reachable |
| Removal handlers addressed the wrong parent | Named form methods, keyboard activation and accessible names | Removal works with real mouse/key input |
| Unqualified goal-preview properties threw errors | Resolve on the sheet and render null-safely | Preview describes new and reused goals |
| A failed FileView write stalled retry | Reload failed-write caches before accepting more recording commands | Retry writes the original durable envelope instead of treating cached bytes as saved |

Run `.agents/skills/verify/scripts/commitment_flow.py /tmp/dailyxp-form-<unique>` to reproduce the regression checks. Its deliberate directory-permission failure causes the expected FileView write warning; other QML reference/type errors are absent. The form remains open with its input and actionable error, then retries successfully when write access returns. Permission changes and state are isolated from personal progress.

The full session-flow regression also passed: live timer, Pause/Resume/Finish, keyboard focus, Escape, SIGKILL/reopen and no double counting. Node tests: 165 passed. Python verifier tests: 4 passed. Scoped qmllint uses installed qs imports, with inherited dynamic access and Quickshell metadata categories disabled; default lint warnings remain documented in the parent evidence README.

The main agent simplified the changed code and inspected renders. These interactions use immediate feedback without additional animation. Independent review is recorded on the issue and PR. The installed application must be refreshed from the final commit and inspected after a real shell restart before local handoff.
