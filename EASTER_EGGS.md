# Phoenix Messenger v1.3 Easter Eggs

All v1.3 Easter eggs run locally in the browser. Secret composer commands are
intercepted before the existing message send path and are never written to
Firestore.

| Trigger | Effect | Storage key | Notes |
| --- | --- | --- | --- |
| Type `phoenix` and send | Opens the "Phoenix has risen." secret modal | None | Includes the Phoenix rise animation and quote |
| Type `440255` and send | Unlocks the local Founder Mode badge | `phoenix_founder_mode=true` | Does not write Founder Mode to Firestore |
| Click the Phoenix Launcher mark 10 times | Toggles Aurora Mode | `phoenix_aurora=true` or `false` | Adds a lightweight animated orange and purple glow |
| Click a visible version label 7 times | Opens developer credits | None | Available from the landing footer and Settings support section |
| 5% chance on page load | Shows the rare transmission toast | None | Runs once per page load |
| Type `/ai` and send | Opens the Phoenix AI teaser panel | None | The command is not sent as a message |
| Type `/launcher` and send | Opens the Phoenix Launcher tribute panel | None | Shows the Launcher-style feature checklist |

## UI

- Easter egg panels reuse the Phoenix glass modal system.
- Orange is the primary glow color, supported by purple accents.
- Animation respects the existing reduced-motion and inactive-tab behavior.

## Safety

- No Easter egg changes Firebase Authentication, Firestore, Cloudinary, or
  LiveKit behavior.
- Founder Mode is a visual local-device badge only.
- Secret command text is removed from the composer after activation.
