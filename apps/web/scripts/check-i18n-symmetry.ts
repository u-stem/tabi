import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const messagesDir = resolve(scriptDir, "../messages");
const locales = ["ja", "en"] as const;

function flatten(obj: unknown, prefix = ""): Set<string> {
  const out = new Set<string>();
  if (obj === null || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      for (const sub of flatten(v, key)) out.add(sub);
    } else {
      out.add(key);
    }
  }
  return out;
}

const maps = Object.fromEntries(
  locales.map((l) => {
    const raw = readFileSync(resolve(messagesDir, `${l}.json`), "utf8");
    return [l, flatten(JSON.parse(raw))] as const;
  }),
) as Record<(typeof locales)[number], Set<string>>;

const diffs: string[] = [];
for (const a of locales) {
  for (const b of locales) {
    if (a === b) continue;
    const missing = [...maps[a]].filter((k) => !maps[b].has(k));
    if (missing.length > 0) {
      diffs.push(`${b}.json is missing ${missing.length} key(s) that exist in ${a}.json:`);
      for (const k of missing.slice(0, 30)) diffs.push(`  - ${k}`);
      if (missing.length > 30) diffs.push(`  … and ${missing.length - 30} more`);
    }
  }
}

if (diffs.length > 0) {
  console.error(diffs.join("\n"));
  process.exit(1);
}
console.log(`i18n keys symmetric across: ${locales.join(", ")} (${maps.ja.size} keys)`);
