import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
const result = spawnSync(process.execPath, ["scripts/package-cpanel.mjs"], {
  stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status ?? 1);
const out = path.resolve(
  process.env.CPANEL_PACKAGE_DIR || "../cpanel-upload/badmintonxp-node",
);
await cp("V1_SETUP.md", path.join(out, "V1_SETUP.md"));
await cp("ADMIN_GUIDE.md", path.join(out, "ADMIN_GUIDE.md"));
await cp("DEPENDENCY_AUDIT.md", path.join(out, "DEPENDENCY_AUDIT.md"));
await cp("V1_ARCHITECTURE.md", path.join(out, "V1_ARCHITECTURE.md"));
await mkdir(path.join(out, "supabase/migrations"), { recursive: true });
await cp("supabase/migrations", path.join(out, "supabase/migrations"), {
  recursive: true,
});
await writeFile(
  path.join(out, "UPLOAD.md"),
  "# BadmintonXP v1 — badmintonxp.com\n\nRead V1_SETUP.md. Stop the app and back up the current runtime BEFORE extracting; preserve any existing runtime-demo-backup. Back up app.js/package manifests, preserve node_modules symlink and working domain .htaccess, install dependencies, enter NEW-project runtime settings yourself, then restart. Homepage: /play. Guest game: /demo. www redirects to HTTPS apex. World Tour Finals 2026 publication is blocked until owner approval. No keys included.\n",
);
const info = JSON.parse(
  await readFile(path.join(out, "PACKAGE-INFO.json"), "utf8"),
);
const migrations = (await readdir("supabase/migrations"))
  .filter((file) => file.endsWith(".sql"))
  .sort();
await writeFile(
  path.join(out, "BADMINTONXP_V1_SCHEMA.sql"),
  (
    await Promise.all(
      migrations.map((file) =>
        readFile(path.join("supabase/migrations", file), "utf8"),
      ),
    )
  ).join("\n\n"),
);
await cp(
  "supabase/migrations/202611100001_content_editors.sql",
  path.join(out, "CONTENT_EDITOR_UPGRADE.sql"),
);

info.purpose = "BadmintonXP v1 for badmintonxp.com; see V1_SETUP.md";
info.canonicalOrigin = "https://badmintonxp.com";
info.homepage = "/play";
info.healthPath = "/api/health";
info.passwordMinimum = 6;
info.publicationHold = "World Tour Finals 2026";
info.requiresRuntimeConfiguration = true;
await writeFile(
  path.join(out, "PACKAGE-INFO.json"),
  JSON.stringify(info, null, 2) + "\n",
);
console.log(
  "Added v1 setup guide, architecture notes and migrations. No environment values or credentials included.",
);
