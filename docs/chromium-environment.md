# Chromium Browser Environment

We are moving from the Suno Receipts extension to a Chromium-derived browser so we can own deeper browser-level behavior around Suno: controlled styling, capture instrumentation, product chrome, persistence, and eventually native filesystem integration.

## Current Local State

- Chromium workspace: `/Users/justintylermoore/Documents/suno-browser-chromium`
- `depot_tools`: downloaded at `/Users/justintylermoore/Documents/suno-browser-chromium/depot_tools`
- Current blocker: only about `14Gi` free on the local disk.
- Current blocker: full Xcode is not installed or not selected. `xcodebuild` currently points at Command Line Tools.

## Required Before `fetch chromium`

Chromium's official Mac build flow requires `depot_tools`, full Xcode, and a Chromium checkout through `fetch chromium`. The checkout plus build outputs are large; practically, this machine should have at least `200Gi` free before starting. More is better if we plan to keep multiple build configs.

Install/select Xcode:

```bash
xcode-select -p
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
```

Confirm:

```bash
xcodebuild -version
ls "$(xcode-select -p)"/Platforms/MacOSX.platform/Developer/SDKs
```

## Prepared Tooling

Run:

```bash
/Users/justintylermoore/Documents/New\ project\ 8/scripts/prepare-chromium-env.sh
```

That script verifies `depot_tools`, `gclient`, `fetch`, disk, and Xcode status.

## Full Checkout Command

Do not run this until disk and Xcode are fixed:

```bash
cd /Users/justintylermoore/Documents/suno-browser-chromium
PATH=/Users/justintylermoore/Documents/suno-browser-chromium/depot_tools:$PATH fetch --no-history chromium
```

After checkout:

```bash
cd /Users/justintylermoore/Documents/suno-browser-chromium/src
gn gen out/SunoDebug --args='is_debug=true symbol_level=1 is_component_build=true'
autoninja -C out/SunoDebug chrome
```

## Product Architecture Direction

The custom browser should not start as a loose source fork with random edits. The first stable target should be a branded Chromium build with a small owned layer:

- A first-run profile configured for Suno workflows.
- Browser-level CSS/JS injection for `suno.com` only.
- Native receipt storage under `~/Music/SunoReceipts/`.
- A built-in project library surface instead of only an extension popup.
- A narrow patch strategy so Chromium updates remain possible.

The extension remains useful as the product prototype and as a reference implementation for event semantics, UI, receipt storage, and export format.
