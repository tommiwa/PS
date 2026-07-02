---
name: Recharts drill-down testing
description: Why automated e2e test agents struggle to click into Recharts bar/line charts, and what to do instead.
---

Charts built with Recharts (e.g. a `ComposedChart`/`BarChart` with per-datapoint `onClick` on a `Bar`, using `Cell` children for per-point styling but no per-point `data-testid`) render as SVG rects without stable per-datapoint selectors. Playwright-based testing subagents repeatedly fail to hover/click the exact bar corresponding to a specific date, even with detailed pixel/tooltip guidance, across multiple retry attempts.

**Why:** SVG bar charts have no accessible per-point identifiers, and pixel-precise clicking (especially on thin bars in dense timelines) is unreliable for a testing agent, even when the app behavior itself is correct. This is a testing-tool limitation, not necessarily an app bug.

**How to apply:** For features gated behind a chart drill-down (e.g. click a bar → see a details table → interact with an action in that table), don't sink multiple e2e attempts into automating the chart click itself. Instead: (1) unit/integration-test the backend logic thoroughly, (2) code-review the frontend component for correctness against existing verified patterns in the same file, (3) if e2e coverage is required, consider adding a stable `data-testid` per bar/point up front, or test the post-drill-down UI directly via a route/state that bypasses the chart click.
