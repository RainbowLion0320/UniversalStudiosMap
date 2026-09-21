#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -z "${JAVA_HOME:-}" ]]; then
  for candidate in "$HOME"/Library/Java/JavaVirtualMachines/*.jdk/Contents/Home; do
    if [[ -x "$candidate/bin/java" ]]; then export JAVA_HOME="$candidate"; break; fi
  done
fi
VERSION="$(node -p 'JSON.parse(require("fs").readFileSync("package.json")).version')"
TAG="v$VERSION"
APK="output/release/universal-wander-$VERSION.apk"
NOTES="docs/releases/$TAG.md"
[[ -z "$(git status --porcelain)" ]] || { echo 'Commit all changes before publishing.' >&2; exit 1; }
[[ -f "$APK" && -f "$APK.sha256" && -f "$NOTES" ]] || { echo 'Build the APK and prepare version notes first.' >&2; exit 1; }
[[ "$(gh repo view --json visibility --jq .visibility)" == PUBLIC ]] || { echo 'Expected a public repository.' >&2; exit 1; }
(cd output/release && shasum -a 256 -c "universal-wander-$VERSION.apk.sha256")
"${ANDROID_HOME:-$HOME/Library/Android/sdk}/build-tools/36.0.0/apksigner" verify "$APK"
if git rev-parse "$TAG" >/dev/null 2>&1; then
  [[ "$(git rev-list -n 1 "$TAG")" == "$(git rev-parse HEAD)" ]] || { echo 'Version tag points to another commit.' >&2; exit 1; }
else
  git tag -a "$TAG" -m "Universal Wander $VERSION"
fi
git push origin HEAD:main "$TAG"
gh release create "$TAG" "$APK" "$APK.sha256" THIRD_PARTY_NOTICES.md --verify-tag --title "环球漫游 $TAG" --notes-file "$NOTES" --latest
