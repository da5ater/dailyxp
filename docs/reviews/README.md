# Visual implementation reviews

Open a self-contained HTML review after each implementation. Include real before/during/after evidence, the blast radius, verification limits and the shortest manual path. Keep the page current after review fixes.

For the routine review, start from the repository root:

```sh
.agents/skills/verify/scripts/review_page.py docs/reviews/pr-105.html --port 8765
```

Open http://127.0.0.1:8765. Start private preview creates an isolated instance of the production plugin. The page's controls drive its actual routine form and display the resulting app capture. Stop/reset and idle cleanup operate only on disposable state. The HTML also opens offline for the screenshot comparison; real preview controls need the local server. No external assets or hosted plan service are required.
