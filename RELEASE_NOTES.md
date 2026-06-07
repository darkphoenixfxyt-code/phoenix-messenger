# Phoenix Messenger v1.0.0-rc.1

Phoenix Messenger v1.0.0-rc.1 is a release candidate focused on stability, performance, and launch readiness. This release does not introduce new product features.

## Highlights

- Improved Firestore listener cleanup when moving between DMs, rooms, and servers.
- Stopped typing-status listeners when moving into servers or voice channels.
- Reduced repeated default-room writes after a browser has completed initial setup.
- Fixed server permission checks so actions use the requested server rather than only the currently active server.
- Improved call cleanup by releasing audio analysis timers, audio contexts, streams, and attached media.
- Improved LiveKit disconnect feedback and preserved LiveKit's built-in reconnect behavior.
- Added throttled, user-friendly errors for important Firestore sync failures.
- Added lazy loading and asynchronous decoding for server icons.
- Improved small-screen chat headers, call bars, notifications, modals, and safe-area spacing.
- Prevented horizontal layout overflow in the landing page and app shell on narrow screens.

## Existing Systems Preserved

- Firebase Authentication and username setup
- Firestore DMs, rooms, servers, channels, friends, and profiles
- Message editing, deletion, replies, reactions, typing indicators, and unread counts
- Cloudinary image and attachment uploads
- LiveKit server voice channels and DM voice/video calls
- Phoenix themes, settings, moderation, invites, and release-candidate launch page

## Verification

Before release, verify the following with two accounts where applicable:

- Login and username setup
- Friend request, acceptance, and DM creation
- DM and channel message delivery after refresh
- Image upload and image loading
- Server creation, invite join, channel access, and moderation permissions
- Voice channel join, mute, deafen, leave, reconnect, and participant list
- DM voice/video call connect, hang up, and cleanup
- Mobile sidebar, composer, keyboard, call bar, and safe-area behavior

## Deployment Notes

- Netlify must include `netlify/functions/livekit-token.js`.
- Netlify must have `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` configured.
- Deploy Firestore rules whenever `firestore.rules` changes.
- No production deployment is performed as part of this stabilization pass.
