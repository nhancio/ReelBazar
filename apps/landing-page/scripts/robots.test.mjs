import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";

const route = new URL("../src/app/robots.ts", import.meta.url);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === route.href && specifier === "../lib/config") {
      return nextResolve("../lib/config.ts", context);
    }
    return nextResolve(specifier, context);
  },
});
const { default: robots } = await import(route.href);
hooks.deregister();

test("search crawlers can load Next.js assets without crawling API routes", () => {
  const policy = robots();
  const renderAsset = "/_next/static/chunks/main.js";
  assert.ok(policy.rules.length > 0);
  for (const { disallow } of policy.rules) {
    assert.ok(disallow.includes("/api/"));
    assert.ok(!disallow.some((prefix) => renderAsset.startsWith(prefix)));
  }

  const exported = readFileSync(new URL("../out/robots.txt", import.meta.url), "utf8");
  const exportedDisallows = [...exported.matchAll(/^Disallow:\s*(\S+)/gm)].map(([, path]) => path);
  assert.ok(exportedDisallows.includes("/api/"));
  assert.ok(!exportedDisallows.some((prefix) => renderAsset.startsWith(prefix)));
});
