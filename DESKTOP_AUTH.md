# Phoenix Messenger Desktop Auth

## Problem

Firebase Google login inside the Tauri desktop shell was failing with `auth/popup-blocked` because `signInWithPopup()` is not a reliable desktop flow inside an embedded webview.

## Solution

Phoenix Messenger now uses two Google auth paths:

- Web browsers: `signInWithPopup()`
- Tauri desktop app: external-browser redirect bridge

## Desktop Flow

1. The desktop app detects that it is running inside Tauri.
2. Clicking `Continue with Google` creates a short-lived Firestore document in `desktopAuthSessions/{sessionId}`.
3. The desktop app navigates to the hosted Phoenix Messenger URL with:

   - `desktopExternalAuth=1`
   - `desktopAuth=1`
   - `session=<random-session-id>`

4. The Tauri navigation guard intercepts that URL and opens it in the user's default browser instead of inside the desktop webview.
5. The browser page completes Google auth with `signInWithRedirect()`.
6. After Google returns, the browser page writes the Google credential tokens into the matching `desktopAuthSessions/{sessionId}` document.
7. The desktop app polls that document, signs in with `signInWithCredential()`, and deletes the session document.

## Web Flow

The normal web app still uses `signInWithPopup()`.

If the popup is blocked in a regular browser, Phoenix falls back to `signInWithRedirect()`.

## Error Handling

The auth UI now gives clearer feedback for:

- popup blocked
- cancelled login
- network failure
- desktop auth timeout

## Files Changed

- `/Users/princeajmeri/phoenix-messenger/src/auth-chat.js`
- `/Users/princeajmeri/phoenix-messenger/firestore.rules`
- `/Users/princeajmeri/phoenix-messenger/src-tauri/src/lib.rs`

## Verification

Run:

```bash
npm run build
```

For rule validation:

```bash
npx firebase-tools deploy --only firestore:rules --dry-run
```

For local desktop testing:

```bash
npm run desktop:dev
```

## Notes

- The desktop auth bridge stores temporary credential data in Firestore only long enough to finish sign-in.
- This does not expose Firebase Admin credentials or LiveKit secrets.
- Windows installers still need to be built on Windows.
