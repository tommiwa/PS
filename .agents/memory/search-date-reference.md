---
name: Search date-reference consistency
description: Why search date tests must include the early availability filter, not just effective-date matching.
---

Use the same calendar-day reference for mobile search defaults and every earlier stage that can reject a daily tile. Preserve desktop's separate behavior unless that change is explicitly authorized.

**Why:** A correct parking-timezone Today default can still show false empty results if a base availability check rejects that date using the device-local day. This occurs when UTC or another device timezone has crossed midnight before the parking timezone; isolated parser and date-matching tests do not catch it.

**How to apply:** Freeze an instant when those dates differ, then exercise the page's base availability predicate followed by its parsed-date predicate. Assert that the parking-zone Today tile survives both. Treat wider configured-timezone standardization as a separate scope decision rather than silently changing global date semantics.
