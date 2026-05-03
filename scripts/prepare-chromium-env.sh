#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="${CHROMIUM_WORKSPACE:-/Users/justintylermoore/Documents/suno-browser-chromium}"
DEPOT_TOOLS="$WORKSPACE/depot_tools"
CHROMIUM_DIR="$WORKSPACE/chromium"

mkdir -p "$WORKSPACE"

if [ ! -d "$DEPOT_TOOLS/.git" ]; then
  git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git "$DEPOT_TOOLS"
fi

export PATH="$DEPOT_TOOLS:$PATH"

echo "Workspace: $WORKSPACE"
echo "depot_tools: $DEPOT_TOOLS"
echo "Chromium checkout target: $CHROMIUM_DIR"
echo

echo "Tooling check:"
git --version
python3 --version
gclient --version >/dev/null && echo "gclient: ok"
fetch --help >/dev/null && echo "fetch: ok"

echo
echo "System check:"
df -h "$WORKSPACE"
if xcodebuild -version >/dev/null 2>&1; then
  xcodebuild -version
else
  echo "xcodebuild: missing full Xcode or Xcode is not selected"
fi

echo
echo "Next step after freeing disk and installing Xcode:"
echo "  cd \"$WORKSPACE\""
echo "  PATH=\"$DEPOT_TOOLS:\$PATH\" fetch --no-history chromium"
echo "  cd src"
echo "  gn gen out/SunoDebug --args='is_debug=true symbol_level=1 is_component_build=true'"
echo "  autoninja -C out/SunoDebug chrome"
