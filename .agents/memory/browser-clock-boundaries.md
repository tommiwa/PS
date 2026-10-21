---
name: Browser clock boundary testing
description: Keep date-boundary browser checks fixed while the page loads and assert the actual clock at each step
---

Pause the browser clock explicitly for boundary assertions; installing a clock with a starting time does not freeze it. Record the evaluated browser instant alongside each date assertion.

**Why:** Page loading and fixture setup can cross a nearby midnight while an installed clock keeps advancing. A screenshot of the next day's correctly filtered results can then be misreported as tomorrow leaking into Today.

**How to apply:** For midnight and cancellation-cutoff browser tests, pause before navigation, assert the current instant, then advance the paused clock deliberately through each boundary. Use raw tile dates as well as displayed labels.

For this app's React/timezone loading gate, a fresh browser context with only `Date`/`Date.now` controlled proved more reliable than pausing all browser timers. Keep scheduler timers and `performance` real, change the controlled instant, then allow the UI clock subscription to refresh.

**Why:** Fully paused browser timers stalled the timezone gate or query-loading skeleton during controlled boundary tests, while Date-only control allowed both the search and cancellation layouts to finish loading and react to the boundary.
