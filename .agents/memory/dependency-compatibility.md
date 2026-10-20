---
name: Dependency compatibility constraints
description: Why security updates must preserve Vite 6 transform compatibility and bounded brace parsing.
---

Use a compatible patched esbuild family for Vite 6 instead of forcing the newest
esbuild across the entire dependency tree.

**Why:** Vite 6 passes legacy-browser feature overrides that cause esbuild 0.28
to reject otherwise normal array destructuring. A global upgrade passed unit
tests but failed the production build. Patched 0.25 works with Vite 6; newer
loaders can retain their own patched family.

**How to apply:** Always run the production build after esbuild overrides. Scope
upgrades of the deprecated Drizzle loader's vulnerable copy rather than forcing
all consumers onto one release.

Keep a verified depth-guarded braces replacement until upstream provides a fix,
even when the dependency scanner reports zero findings.

**Why:** At remediation time upstream had no patched release. A fork has a new
package identity, so a clean scan alone does not prove its parser is safe.

**How to apply:** Preserve functional tests for normal patterns and pathological
nesting through both consuming packages. Review the depth guard and hard-cap
behavior when changing forks or moving back upstream.
