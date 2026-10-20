---
name: BC Pacific time policy
description: Business-time scope and historical-data safety for the BC permanent-time transition
---

For Pacific-region ParkShare parking, assess BC permanent UTC−7 independently of Los Angeles seasonal rules. PCT is official display terminology, not an IANA zone identifier. Preserve historical DST and date-only bookings; a timezone correction is not authorization to rewrite stored days or historical timestamps.

**Why:** BC's new permanent offset applies prospectively, not retroactively to historical parking records. Node, client engines, and database rules are independent readiness requirements; choosing Vancouver alone does not guarantee current rules.

**How to apply:** Seek separate approval for implementation/runtime/configuration changes. Verify live parking geography (mountain arrangements are separate), actual deployed conversions, and supported client engines before asserting readiness.
