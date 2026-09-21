#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -z "${JAVA_HOME:-}" ]]; then
  for candidate in "$HOME"/Library/Java/JavaVirtualMachines/*.jdk/Contents/Home; do
    if [[ -x "$candidate/bin/java" ]]; then export JAVA_HOME="$candidate"; break; fi
  done
fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
: "${JAVA_HOME:?Set JAVA_HOME to a JDK 21 installation} "
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
BUILD_TOOLS="$ANDROID_HOME/build-tools/36.0.0"
SIGNING_DIR="${WANDER_SIGNING_DIR:-$HOME/.local/share/universal-wander/signing}"
export SIGNING_DIR
mkdir -p "$SIGNING_DIR" output/release
chmod 700 "$SIGNING_DIR"
python3 - <<'PY'
import os,pathlib,secrets,subprocess
p=pathlib.Path(os.environ['SIGNING_DIR'])
key=p/'release.jks';password=p/'password.txt'
if not key.exists():
    if not password.exists():
        password.write_text(secrets.token_urlsafe(40));password.chmod(0o600)
    env={**os.environ,'WANDER_KEY_PASSWORD':password.read_text()}
    subprocess.run(['keytool','-genkeypair','-keystore',str(key),'-storepass:env','WANDER_KEY_PASSWORD','-keypass:env','WANDER_KEY_PASSWORD','-alias','wander','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Universal Wander Local, O=Personal, C=CN'],env=env,check=True)
    key.chmod(0o600)
if not password.exists():raise SystemExit('Signing password missing; restore the original signing backup.')
PY
npm run android:sync
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > android/local.properties
(cd android && ./gradlew :app:assembleRelease --console=plain)
VERSION="$(node -p 'JSON.parse(require("fs").readFileSync("package.json")).version')"
APK="output/release/universal-wander-$VERSION.apk"
"$BUILD_TOOLS/zipalign" -f -p 4 android/app/build/outputs/apk/release/app-release-unsigned.apk output/release/aligned.apk
"$BUILD_TOOLS/apksigner" sign --ks "$SIGNING_DIR/release.jks" --ks-key-alias wander --ks-pass "file:$SIGNING_DIR/password.txt" --out "$APK" output/release/aligned.apk
"$BUILD_TOOLS/apksigner" verify --verbose "$APK"
rm output/release/aligned.apk
(cd output/release && shasum -a 256 "universal-wander-$VERSION.apk" > "universal-wander-$VERSION.apk.sha256")
printf '\nAPK: %s/%s\n' "$PWD" "$APK"
