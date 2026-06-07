# Phoenix Messenger v1.1 Testing

Test with two signed-in accounts in separate browsers or private windows.

## Regression Check

- [ ] Login and username setup work
- [ ] Friends, DMs, rooms, servers, and channels still load
- [ ] Send, edit, delete, reply to, and react to messages
- [ ] Cloudinary image/file upload works
- [ ] LiveKit DM calls and server voice still connect
- [ ] Settings, themes, unread badges, typing indicators, and mobile drawers work

## Presence

- [ ] Set Online, Idle, Do Not Disturb, and Invisible in Settings
- [ ] Status persists after refresh
- [ ] Status dots update in friends, DMs, server members, and profiles
- [ ] Invisible appears Offline to the other account
- [ ] Leave one account inactive for 5 minutes and confirm it becomes Idle
- [ ] Move the mouse or press a key and confirm automatic Idle returns to Online

## Global Search

- [ ] Search accessible DM messages
- [ ] Search accessible server messages
- [ ] Search users and channels
- [ ] Click a DM message result and confirm the exact message is highlighted
- [ ] Click a server message result and confirm the exact message is highlighted
- [ ] Confirm messages from inaccessible DMs and servers are not returned

## Pinned Messages

- [ ] Pin and unpin a DM message from either DM participant
- [ ] Open the pinned-message panel and jump to a pinned message
- [ ] Pin and unpin a server message as owner, admin, and mod
- [ ] Confirm a regular server member does not see the Pin action
- [ ] Confirm Firestore rejects a regular member's direct pin update

## Screen Sharing

- [ ] Join a server voice channel and start screen sharing
- [ ] Confirm the sharer sees a local preview
- [ ] Confirm the other participant sees the shared screen
- [ ] Stop sharing from Phoenix and from the browser's native sharing control
- [ ] Start a DM voice call and share the screen
- [ ] Start a DM video call and share the screen
- [ ] Deny screen-share permission and confirm an error toast appears
- [ ] Leave/end the call and confirm the viewer and share controls reset
- [ ] Briefly disconnect the network and confirm LiveKit reconnect status updates

## Mobile

- [ ] Status dots do not obstruct names or avatars
- [ ] Search results open the correct chat/channel
- [ ] Screen-share viewer fits the viewport
- [ ] Voice/call controls remain reachable

## Build Verification

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npx netlify build --offline`

## Deployment Note

Deploy `firestore.rules` with the v1.1 app. The server pin-permission change is not active in production until the updated Firestore rules are deployed.
