# Passkey Auth Strategy

Passkey support is a hard architecture constraint for the Suno Receipts workspace.

## Current Product Path

The current implementation is a Chrome extension that opens real top-level browser pages:

- `https://suno.com/create`
- `https://chatgpt.com`

This path supports passkey login because authentication happens inside Chrome itself. We do not iframe either site and we do not replace ChatGPT with an API clone.

## Electron Risk

Electron should not be the default container for this product if passkey login to third-party sites is mandatory.

As of May 2026, Electron passkey/WebAuthn support is still not reliable enough to treat as a product foundation, especially on macOS. Some teams work around this with native modules, but that is platform-specific and still leaves us maintaining sensitive auth plumbing.

## Why External Browser Login Is Not Enough

For websites we do not own, opening an external browser popup does not solve embedded Electron login in a general way:

- ChatGPT/Suno session cookies are scoped to the browser profile that completed login.
- HttpOnly cookies cannot be copied safely by app code.
- A default-browser login does not automatically authenticate an Electron WebView profile.
- OAuth-style deep-link handoff only works for auth flows we own or that explicitly support native-app redirects.

So a browser popup is useful for apps we control, but not a dependable way to log an Electron WebView into `chatgpt.com` or `suno.com` with passkeys.

## Required Product Rule

If the product must support ChatGPT/Suno passkey login, use one of these:

1. Chrome extension running in the user's real Chrome profile.
2. A managed Chromium/Chrome launched as real browser windows with our extension installed.
3. A full Chromium-derived browser only if we later need browser-engine-level changes.

Avoid:

- ChatGPT/Suno inside Electron WebViews.
- ChatGPT/Suno inside iframes.
- Auth flows that depend on copying cookies across browser profiles.

## Practical Direction

Keep the current extension architecture for the next build phase:

- Workspace button opens Suno and ChatGPT as real browser windows.
- Passkeys remain browser-native.
- Content scripts provide the controlled styling, field extraction/insertion, and receipt logging.

If we later package this as a desktop product, package a launcher/companion around Chrome/Chromium plus the extension rather than moving the authenticated sites into Electron.
