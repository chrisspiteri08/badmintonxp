import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const standalone = path.resolve(".next/standalone");
const output = path.resolve(
  process.env.CPANEL_PACKAGE_DIR || "../cpanel-upload/badmintonxp-node",
);
if (!output.endsWith(`${path.sep}badmintonxp-node`) || output === process.cwd())
  throw new Error("Use a separate badmintonxp-node package directory.");
await stat(path.join(standalone, "server.js"));
await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, "runtime"), { recursive: true });
await cp(path.join(standalone, ".next"), path.join(output, "runtime/.next"), {
  recursive: true,
});
await cp(
  path.join(standalone, "server.js"),
  path.join(output, "runtime/server.js"),
);
await cp("public", path.join(output, "runtime/public"), { recursive: true });
await cp(".next/static", path.join(output, "runtime/.next/static"), {
  recursive: true,
});
await cp("deployment/cpanel/app.js", path.join(output, "app.js"));
await cp("deployment/cpanel/UPLOAD.md", path.join(output, "UPLOAD.md"));
// Production JS was compiled locally. Install these runtime packages on the host,
// rather than shipping Mac native modules or overwriting cPanel's node_modules link.
const dependencies = {};
for (const name of ["next", "react", "react-dom", "zod"])
  dependencies[name] = require(`${name}/package.json`).version;
const manifest = {
  name: "badmintonxp-cpanel-guest",
  version: "1.0.0",
  private: true,
  main: "app.js",
  engines: { node: "22.x" },
  scripts: { start: "node app.js" },
  dependencies,
};
await writeFile(
  path.join(output, "package.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
await writeFile(
  path.join(output, ".npmrc"),
  "omit=dev\naudit=false\nfund=false\n",
);
await mkdir(path.join(output, "tmp"));
await writeFile(path.join(output, "tmp/.keep"), "");
const result = spawnSync(
  "npm",
  [
    "install",
    "--package-lock-only",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
  ],
  { cwd: output, stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);
const forbiddenNames =
  /^(\.env(?:\..*)?|\.git|node_modules|.*\.(?:pem|key|node))$/i;
let files = 0;
async function inspect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (forbiddenNames.test(entry.name))
      throw new Error(`Forbidden package path: ${path.relative(output, file)}`);
    if (entry.isSymbolicLink())
      throw new Error("Symlinks must not be included in the portable upload.");
    if (entry.isDirectory()) await inspect(file);
    else {
      files++;
      if (/\.(?:js|json|html|txt|md|css)$/.test(file)) {
        const text = await readFile(file, "utf8");
        if (
          /sb_(?:secret|publishable)_[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(
            text,
          )
        )
          throw new Error(
            `Possible embedded key detected in ${path.relative(output, file)}. Value not displayed.`,
          );
      }
    }
  }
}
await inspect(output);
await writeFile(
  path.join(output, "PACKAGE-INFO.json"),
  JSON.stringify(
    {
      next: dependencies.next,
      node: "22.x",
      startup: "app.js",
      dependenciesInstalledOnHost: true,
      auditedFiles: files,
      supabaseKeysIncluded: false,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Prepared ${output} (${files} audited files; no node_modules, native modules, .env files or key-shaped values).`,
);
