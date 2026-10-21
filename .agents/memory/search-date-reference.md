---
name: Search date-reference consistency
description: Why search date tests must include the early availability filter, not just effective-date matching.
---

Use the configured parking calendar day for Today and every earlier stage that can reject a daily tile, on both mobile and desktop. Preserve desktop's unfiltered initial state; mobile defaults to Today.

**Why:** The user requires the front page's Today filter to show only that BC parking day, never tomorrow's spots. A correct date parser can still show false empty results if the base filter uses the device's day. This occurs when the device calendar is ahead of BC; isolated parser tests do not catch it.

**How to apply:** Freeze instants when device and parking dates differ, then exercise the base availability predicate followed by parsed-date matching. Check both screen sizes and an open page crossing parking midnight, including resume from a suspended tab. Wider backend timezone changes still require separate scope.
