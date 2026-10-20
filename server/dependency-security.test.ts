import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));

// Check every installed path, including nested copies, not only top-level versions.
const minimumVersions: Record<string, string> = {
  "@babel/core": "7.29.6",
  "@hono/node-server": "1.19.15",
  "@modelcontextprotocol/sdk": "1.31.0",
  "@vitest/mocker": "4.1.11",
  axios: "1.20.0",
  "baseline-browser-mapping": "2.11.0",
  browserslist: "4.28.7",
  dompurify: "3.4.16",
  esbuild: "0.25.0",
  "fast-uri": "3.1.8",
  fflate: "0.8.3",
  "form-data": "4.0.6",
  hono: "4.13.11",
  "ip-address": "10.7.1",
  nanoid: "3.3.18",
  postcss: "8.5.23",
  "postcss-selector-parser": "7.1.6",
  "proxy-addr": "2.0.8",
  qs: "6.16.0",
  sharp: "0.35.5",
  "shell-quote": "1.11.0",
  "source-map-js": "1.2.2",
  vitest: "4.1.11",
};

function atLeast(actual: string, minimum: string) {
  const a = actual.split(".").map(Number);
  const b = minimum.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return !actual.includes("-");
}

describe("dependency security regressions", () => {
  it("keeps all affected lockfile paths on patched releases", () => {
    for (const [path, entry] of Object.entries(lock.packages) as [string, { version: string; name?: string }][]) {
      if (!path) continue;
      const name = path.split("node_modules/").at(-1)!;
      let minimum = minimumVersions[name];
      if (name === "body-parser") minimum = entry.version.startsWith("1.") ? "1.20.6" : "2.3.0";
      if (name === "brace-expansion") minimum = entry.version.startsWith("1.") ? "1.1.21" : "2.1.7";
      if (name === "vite") minimum = entry.version.startsWith("6.") ? "6.4.4" : "8.0.16";
      if (minimum) expect(atLeast(entry.version, minimum), `${path}@${entry.version} must be >=${minimum}`).toBe(true);
      // esbuild's later vulnerable interval is independent of the old <0.25 advisory.
      if (name === "esbuild" && atLeast(entry.version, "0.27.3")) {
        expect(atLeast(entry.version, "0.28.1")).toBe(true);
      }
      if (name === "braces") {
        expect(entry.name).toBe("@zklogic/braces");
        expect(entry.version).toBe("3.0.7");
      }
    }
  });

  for (const parent of ["micromatch", "chokidar"]) {
    const parentRequire = createRequire(require.resolve(parent));
    const braces = parentRequire("braces");

    it(`${parent} uses the depth-guarded braces replacement with normal expansion intact`, () => {
      expect(braces("src/{one,two}.ts", { expand: true })).toEqual(["src/one.ts", "src/two.ts"]);
      expect(braces.expand("{01..03}")).toEqual(["01", "02", "03"]);
      expect(braces.compile("src/{one,two}.ts")).toBe("src/(one|two).ts");
    });

    it(`${parent} handles deeply nested braces and parentheses without stack exhaustion`, () => {
      // Below the upstream character cap, but far deeper than a safe recursive AST.
      for (const [open, close] of [["{", "}"], ["(", ")"]]) {
        const pattern = open.repeat(4000) + "a" + close.repeat(4000);
        for (const options of [{}, { maxDepth: Infinity }, { maxDepth: 1e9 }]) {
          expect(() => braces.compile(pattern, options)).not.toThrow();
          expect(() => braces.expand(pattern, options)).not.toThrow();
          expect(() => braces.stringify(braces.parse(pattern, options))).not.toThrow();
        }
      }
    });
  }

  it("preserves micromatch glob and range matching through the replacement", () => {
    const micromatch = require("micromatch");
    expect(micromatch(["src/a.ts", "src/b.ts", "src/c.js"], "src/*.{ts,tsx}")).toEqual(["src/a.ts", "src/b.ts"]);
    expect(micromatch.braceExpand("spot-{1..3}")).toEqual(["spot-1", "spot-2", "spot-3"]);
  });

  it("keeps Drizzle's older loader compatible with the overridden esbuild", async () => {
    const loaderRequire = createRequire(require.resolve("@esbuild-kit/core-utils"));
    const esbuild = loaderRequire("esbuild");
    const result = await esbuild.transform("const value: number = 1; export default value;", { loader: "ts", format: "esm" });
    expect(result.code).not.toContain(": number");
    expect(result.code).toContain("export");
  });

  it("loads sharp's updated native libraries and processes an image", async () => {
    const image = await sharp({ create: { width: 4, height: 4, channels: 4, background: "#ffffff" } })
      .resize(2, 2).png().toBuffer();
    const metadata = await sharp(image).metadata();
    expect(metadata).toMatchObject({ width: 2, height: 2, format: "png" });
  });
});
