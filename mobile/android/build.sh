#!/usr/bin/env bash
# Builds ForgingXP.apk without Gradle: aapt2 -> javac -> d8 -> zipalign -> apksigner
set -euo pipefail
SDK=${ANDROID_HOME:-/opt/android}
BT=$SDK/build-tools/${BUILD_TOOLS:-35.0.0}
JAR=$SDK/platforms/${PLATFORM:-android-34}/android.jar
cd "$(dirname "$0")"
rm -rf build && mkdir -p build/res build/gen build/classes build/apk
rm -rf assets/www && mkdir -p assets && cp -r ../www assets/www
$BT/aapt2 compile --dir res -o build/res.zip
$BT/aapt2 link -I "$JAR" --manifest AndroidManifest.xml -A assets \
  --java build/gen -o build/apk/unsigned.apk build/res.zip --min-sdk-version 24 --target-sdk-version 34 \
  --version-code 2 --version-name 1.1
javac -nowarn -source 8 -target 8 -bootclasspath "$JAR" -classpath "$JAR" -d build/classes \
  $(find src build/gen -name '*.java') 2>&1 | grep -v "warning: \[options\]" || true
(cd build/classes && jar cf ../classes.jar .)
$BT/d8 --release --min-api 24 --lib "$JAR" --output build build/classes.jar
(cd build && zip -q -j apk/unsigned.apk classes.dex)
$BT/zipalign -f -p 4 build/apk/unsigned.apk build/apk/aligned.apk
if [ ! -f forgingxp.keystore ]; then
  keytool -genkeypair -keystore forgingxp.keystore -storepass forgingxp -keypass forgingxp \
    -alias forgingxp -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Forging XP, O=Michael" >/dev/null 2>&1
fi
$BT/apksigner sign --ks forgingxp.keystore --ks-pass pass:forgingxp --key-pass pass:forgingxp \
  --out ForgingXP.apk build/apk/aligned.apk
$BT/apksigner verify ForgingXP.apk && echo "OK -> $(pwd)/ForgingXP.apk"
