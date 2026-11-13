#!/usr/bin/env bash
set -euo pipefail

branch=feature/v1-accounts-server-scoring-20261109
server=${NEOSERV_SSH_TARGET:-shuttles@sh6.neoserv.si}
port=${NEOSERV_SSH_PORT:-22}
app=/home/shuttles/badmintonxp-node
cd "$(git rev-parse --show-toplevel)"
commit=$(git rev-parse HEAD)
remote=$(git ls-remote --exit-code origin "refs/heads/$branch" | cut -f1)
[[ "$commit" == "$remote" ]] || { echo "HEAD must match the pushed feature branch." >&2; exit 1; }
node -e 'if (process.versions.node.split(".")[0] !== "22") process.exit(1)' ||
  { echo "Select Node 22 first." >&2; exit 1; }

ssh_args=(-o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 -p "$port" "$server")
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
mkdir "$stage/source"
git archive "$commit" | tar -xf - -C "$stage/source"
(
  cd "$stage/source"
  npm ci
  npm run build:cpanel
  CPANEL_PACKAGE_DIR="$stage/badmintonxp-node" npm run package:v1
)
release="$stage/badmintonxp-node"
printf '%s\n' "$commit" > "$release/DEPLOY_COMMIT"
tar -czf "$stage/release.tgz" -C "$release" runtime app.js package.json package-lock.json .npmrc DEPLOY_COMMIT

# Send the script and release separately so the remote shell can read the archive.
remote_stage=$(ssh "${ssh_args[@]}" "mktemp -d /home/shuttles/.badmintonxp-release.XXXXXXXX")
[[ "$remote_stage" =~ ^/home/shuttles/\.badmintonxp-release\.[a-zA-Z0-9]+$ ]]
trap 'ssh "${ssh_args[@]}" "rm -rf -- $remote_stage" || true; rm -rf "$stage"' EXIT
ssh "${ssh_args[@]}" "cat > '$remote_stage/release.tgz'" < "$stage/release.tgz"
ssh "${ssh_args[@]}" "bash -s -- '$app' '$remote_stage' '$commit'" <<'REMOTE'
set -euo pipefail
app=$1
stage=$2
commit=$3
cd "$app"
test -f app.js
test -f runtime/.next/BUILD_ID
lock="$app/.deploy-lock"
mkdir "$lock" || { echo "Deployment already running." >&2; exit 1; }
trap 'rmdir "$lock"' EXIT
backup="/home/shuttles/badmintonxp-backups/$(date -u +%Y%m%dT%H%M%SZ)-${commit:0:12}"
umask 077
mkdir -p "$(dirname "$backup")"
mkdir "$backup"
files=(app.js package.json package-lock.json .npmrc DEPLOY_COMMIT)
cp -a runtime "$backup/"
for file in "${files[@]}" .htaccess; do
  if [[ -e "$file" ]]; then cp -a "$file" "$backup/"; fi
done
domain_htaccess=/home/shuttles/badmintonxp.com/.htaccess
if [[ -f "$domain_htaccess" ]]; then
  cp -a "$domain_htaccess" "$backup/domain-root.htaccess"
fi
echo "Backup: $backup"
tar -xzf "$stage/release.tgz" -C "$stage"
test -f "$stage/runtime/.next/BUILD_ID"
changed=0
for file in package.json package-lock.json .npmrc; do
  if ! cmp -s "$file" "$stage/$file"; then changed=1; fi
done
if (( changed )); then
  activate=/home/shuttles/nodevenv/badmintonxp-node/22/bin/activate
  test -r "$activate"
  . "$activate"
  node -e 'if (process.versions.node.split(".")[0] !== "22") process.exit(1)'
fi
restart() { mkdir -p tmp && touch tmp/restart.txt; }
health() {
  local url=https://badmintonxp.com route code
  curl -fsS --max-time 12 "$url/api/health" |
    grep -Eq '^\{[[:space:]]*"databaseConnected"[[:space:]]*:[[:space:]]*true[[:space:]]*\}$' || return 1
  for route in /play /play/standings /demo; do
    code=$(curl -sS --max-time 12 -o /dev/null -w '%{http_code}' "$url$route") || return 1
    [[ "$code" == 200 ]] || return 1
  done
}
rollback() {
  local result=$?
  trap - EXIT
  set +e
  echo "Restoring $backup" >&2
  if [[ -d "$stage/previous-runtime" ]]; then
    rm -rf -- runtime
    mv "$stage/previous-runtime" runtime || cp -a "$backup/runtime" runtime
  fi
  for file in "${files[@]}"; do
    if [[ -f "$backup/$file" ]]; then cp -a "$backup/$file" "$file"; else rm -f -- "$file"; fi
  done
  if (( changed )); then npm install --omit=dev --no-audit --no-fund || echo "Rollback dependency install failed" >&2; fi
  restart
  rmdir "$lock"
  exit "$result"
}
trap rollback EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP
mv runtime "$stage/previous-runtime"
mv "$stage/runtime" runtime
chmod --reference="$backup/runtime" runtime
for file in "${files[@]}"; do cp "$stage/$file" "$file"; done
if (( changed )); then npm install --omit=dev --no-audit --no-fund; fi
restart
for attempt in {1..8}; do
  if health; then
    cmp -s DEPLOY_COMMIT "$stage/DEPLOY_COMMIT"
    echo "Commit: $commit"
    echo "/api/health databaseConnected:true; /play, /play/standings, /demo HTTP 200"
    trap 'rmdir "$lock"' EXIT
    exit 0
  fi
  sleep 3
done
exit 1
REMOTE
