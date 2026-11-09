import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const result = spawnSync(process.execPath, ["scripts/package-cpanel.mjs"], {
  stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status ?? 1);
const out = path.resolve(
  process.env.CPANEL_PACKAGE_DIR || "../cpanel-upload/badmintonxp-node",
);
await cp("V1_SETUP.md", path.join(out, "V1_SETUP.md"));
await cp("V1_ARCHITECTURE.md", path.join(out, "V1_ARCHITECTURE.md"));
await mkdir(path.join(out, "supabase/migrations"), { recursive: true });
await cp("supabase/migrations", path.join(out, "supabase/migrations"), {
  recursive: true,
});
await writeFile(
  path.join(out, "UPLOAD.md"),
  "# BadmintonXP v1 test copy\n\nRead V1_SETUP.md before uploading. Use a separate app root, hostname and Supabase test project. Do not overwrite the live guest application. The complete build is in runtime/.next (show hidden files). Configure the three V1 runtime variables in cPanel; no service key is needed.\n",
);
const info = JSON.parse(
  await readFile(path.join(out, "PACKAGE-INFO.json"), "utf8"),
);
info.purpose = "Isolated BadmintonXP v1 test copy; see V1_SETUP.md";
info.requiresRuntimeConfiguration = true;
await writeFile(
  path.join(out, "PACKAGE-INFO.json"),
  JSON.stringify(info, null, 2) + "\n",
);
console.log(
  "Added v1 setup guide, architecture notes and migrations. No environment values or credentials included.",
);
