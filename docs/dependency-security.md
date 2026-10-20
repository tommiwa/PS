# Dependency security maintenance

The dependency audit on 2026-10-20 initially reported 99 findings
(1 critical, 39 high, 52 moderate, 7 low). Direct dependencies were updated
within their existing framework families, including MCP SDK, Axios, Express 4,
Vite 6, Vitest, PostCSS, and the Drizzle CLI. Sharp moved from 0.34 to 0.35
to obtain patched native image libraries.

## Overrides

`package.json` also sets patched minimums for transitive dependencies that the
existing lockfile or parent constraints otherwise retain. Keep these overrides
until the relevant parents resolve safe versions on their own. In particular:

- `body-parser` and `brace-expansion` keep separate major-version overrides
  because both major families are in use.
- `postcss-selector-parser` 7 replaces vulnerable 6.x copies held by Tailwind 3,
  `postcss-nested`, and typography. The production CSS build verifies integration;
  this does not migrate Tailwind itself to version 4.
- The deprecated `@esbuild-kit/core-utils` loader in Drizzle pins `esbuild` 0.18;
  an override upgrades pre-0.25 copies to patched 0.25.x. Keep Vite 6 on 0.25.x:
  forcing 0.28 across the tree breaks Vite 6's legacy-browser destructuring
  transform settings. TSX independently uses patched 0.28.x. Regression tests
  exercise the older loader's TypeScript transform API.

## Braces: no upstream fixed release

Upstream `braces` 3.0.3 has no published fix for GHSA-vfj7-8cjw-p6xm
(CVE-2026-93687). An exact npm alias override installs
`@zklogic/braces@3.0.7` for both `micromatch` and `chokidar`.
This is a third-party drop-in fork, not an upstream security release:
https://github.com/ArfanKhalilMughal/braces

The fork bounds parser nesting, so the recursive compile, expansion and stringify
walkers receive bounded ASTs. Excess nesting becomes literal text. Its hard cap
cannot be raised by a caller's `maxDepth` option. Tests cover both consumers,
ordinary globs/ranges and deeply nested brace/parenthesis inputs. Keep the alias
pinned and replace it with an upstream release when a verified fix is available.
Do not remove it merely because a scanner reports no findings for the fork's name.

## Checks

Run `npx vitest run` and `npm run build` after dependency updates, plus a fresh
dependency audit. `server/dependency-security.test.ts` checks patched versions at
every lockfile path and exercises the compatibility-sensitive changes and Sharp.
These tests guard the known advisories, not future vulnerabilities.
